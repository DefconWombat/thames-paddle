<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ThamesMap from '../components/ThamesMap.vue';
import { accessPoints } from '../data/access-points.js';
import { locks } from '../data/thames-locks.js';
import { pubsCafes } from '../data/pubs-cafes.js';
import { campsites } from '../data/campsites.js';
import { riverDistance, formatDistance, estimateTime, getRouteSection } from '../utils/river.js';
import { DEFAULT_SPEED_MPH } from '../data/thames-route.js';
import { db } from '../data/db.js';

const SPEED_PRESETS = [
  { label: 'Fast', mph: 4.0, type: 'rigid' },
  { label: 'Cruising', mph: 3.5, type: 'rigid' },
  { label: 'Leisurely', mph: 3.0, type: 'rigid' },
  { label: 'Cruising', mph: 2.5, type: 'inflatable' },
  { label: 'Easy', mph: 2.0, type: 'inflatable' },
];

const equipment = ref('rigid');
const startPointId = ref('');
const endPointId = ref('');
const speedPreset = ref('3.0');
const customSpeedInput = ref(DEFAULT_SPEED_MPH);

// Waypoints: array of { pointId, note }
const waypoints = ref([]);
const showAddWaypoint = ref(false);
const newWaypointId = ref('');
const newWaypointNote = ref('');

const filteredSpeedPresets = computed(() => {
  return SPEED_PRESETS.filter(p => p.type === equipment.value);
});

const customSpeed = computed(() => {
  if (speedPreset.value === 'custom') return customSpeedInput.value;
  return parseFloat(speedPreset.value);
});

// Auto-select appropriate speed when equipment changes
watch(equipment, (eq) => {
  if (eq === 'inflatable' && parseFloat(speedPreset.value) > 2.5) {
    speedPreset.value = '2.5';
  } else if (eq === 'rigid' && parseFloat(speedPreset.value) < 3.0 && speedPreset.value !== 'custom') {
    speedPreset.value = '3.0';
  }
});

// Filter access points by equipment
const availablePoints = computed(() => {
  return accessPoints.filter(ap => {
    if (equipment.value === 'rigid') return ap.suitability.rigidHull;
    if (equipment.value === 'inflatable') return ap.suitability.inflatable;
    return true;
  }).sort((a, b) => a.riverMile - b.riverMile);
});

// Points available as waypoints (between start and end, not already used)
const availableWaypoints = computed(() => {
  if (!startPoint.value || !endPoint.value) return [];
  const loMile = Math.min(startPoint.value.riverMile, endPoint.value.riverMile);
  const hiMile = Math.max(startPoint.value.riverMile, endPoint.value.riverMile);
  const usedIds = new Set([startPointId.value, endPointId.value, ...waypoints.value.map(w => w.pointId)]);

  // Include all POIs (access points, pubs, locks) as potential waypoints
  const allPois = [
    ...accessPoints.map(p => ({ ...p, poiType: 'access' })),
    ...pubsCafes.map(p => ({ ...p, poiType: 'pub' })),
    ...locks.map(p => ({ ...p, poiType: 'lock' })),
  ];

  return allPois
    .filter(p => p.riverMile > loMile && p.riverMile < hiMile && !usedIds.has(p.id))
    .sort((a, b) => a.riverMile - b.riverMile);
});

// Resolve waypoint objects
const resolvedWaypoints = computed(() => {
  const allPois = [...accessPoints, ...pubsCafes, ...locks];
  return waypoints.value
    .map(w => {
      const poi = allPois.find(p => p.id === w.pointId);
      return poi ? { ...poi, note: w.note } : null;
    })
    .filter(Boolean);
});

const startPoint = computed(() => accessPoints.find(p => p.id === startPointId.value));
const endPoint = computed(() => accessPoints.find(p => p.id === endPointId.value));

// Build legs from start -> waypoints -> end
const legs = computed(() => {
  if (!startPoint.value || !endPoint.value) return [];

  const downstream = endPoint.value.riverMile > startPoint.value.riverMile;
  const sortedWaypoints = [...resolvedWaypoints.value]
    .sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  const stops = [startPoint.value, ...sortedWaypoints, endPoint.value];
  const speed = customSpeed.value;
  const result = [];
  let cumulativeMile = 0;
  let cumulativeTime = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const dist = Math.abs(to.riverMile - from.riverMile);
    const loMile = Math.min(from.riverMile, to.riverMile);
    const hiMile = Math.max(from.riverMile, to.riverMile);
    const legLocks = locks.filter(l => l.riverMile > loMile && l.riverMile < hiMile);
    const paddleHrs = dist / speed;
    const lockMin = legLocks.length * 15;
    const totalHrs = paddleHrs + lockMin / 60;

    cumulativeMile += dist;
    cumulativeTime += totalHrs;

    result.push({
      from,
      to,
      distance: dist,
      locks: legLocks.length,
      lockTimeMin: lockMin,
      paddleHrs,
      totalHrs,
      totalTime: `${Math.floor(totalHrs)}h ${Math.round((totalHrs % 1) * 60)}m`,
      cumulativeMile,
      cumulativeTime,
      cumulativeTimeStr: `${Math.floor(cumulativeTime)}h ${Math.round((cumulativeTime % 1) * 60)}m`,
      waypointNote: to.note || null
    });
  }

  return result;
});

const routeInfo = computed(() => {
  if (!startPoint.value || !endPoint.value) return null;

  const dist = Math.abs(endPoint.value.riverMile - startPoint.value.riverMile);
  const downstream = endPoint.value.riverMile > startPoint.value.riverMile;
  const loMile = Math.min(startPoint.value.riverMile, endPoint.value.riverMile);
  const hiMile = Math.max(startPoint.value.riverMile, endPoint.value.riverMile);

  // Find locks along the route
  const routeLocks = locks.filter(l => l.riverMile > loMile && l.riverMile < hiMile)
    .sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  // Find pubs along the route
  const routePubs = pubsCafes.filter(p => p.riverMile >= loMile && p.riverMile <= hiMile)
    .sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  // Find campsites along the route
  const routeCamps = campsites.filter(c => c.riverMile >= loMile && c.riverMile <= hiMile)
    .sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  // Find bail-out points
  const bailOuts = accessPoints.filter(ap => {
    if (ap.id === startPointId.value || ap.id === endPointId.value) return false;
    if (waypoints.value.some(w => w.pointId === ap.id)) return false;
    if (ap.riverMile <= loMile || ap.riverMile >= hiMile) return false;
    if (equipment.value === 'rigid') return ap.suitability.rigidHull && ap.access.vehicleAccess;
    return ap.suitability.inflatable;
  }).sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  // Estimate time
  const speed = customSpeed.value;
  const paddleHrs = dist / speed;
  const lockTimeMin = routeLocks.length * 15;
  const totalHrs = paddleHrs + lockTimeMin / 60;
  const timeEst = `${Math.floor(totalHrs)}h ${Math.round((totalHrs % 1) * 60)}m`;
  const paddleOnly = `${Math.floor(paddleHrs)}h ${Math.round((paddleHrs % 1) * 60)}m`;

  // Check for hazards
  const hazards = routeLocks.filter(l => l.hazard);

  return {
    distance: dist,
    downstream,
    locks: routeLocks,
    pubs: routePubs,
    camps: routeCamps,
    bailOuts,
    timeEstimate: timeEst,
    paddleTime: paddleOnly,
    lockTime: lockTimeMin,
    speed,
    hazards,
    startMile: startPoint.value.riverMile,
    endMile: endPoint.value.riverMile
  };
});

// Waypoint management
function addWaypoint() {
  if (!newWaypointId.value) return;
  waypoints.value.push({
    pointId: newWaypointId.value,
    note: newWaypointNote.value.trim() || ''
  });
  newWaypointId.value = '';
  newWaypointNote.value = '';
  showAddWaypoint.value = false;
}

function removeWaypoint(index) {
  waypoints.value.splice(index, 1);
}

// Reset trip
function resetTrip() {
  startPointId.value = '';
  endPointId.value = '';
  waypoints.value = [];
  showAddWaypoint.value = false;
}

// Swap start and end
function swapPoints() {
  const tmp = startPointId.value;
  startPointId.value = endPointId.value;
  endPointId.value = tmp;
}

// Clear waypoints when start/end change
watch([startPointId, endPointId], () => {
  waypoints.value = [];
});

// ===== Saved Routes =====
const router = useRouter();
const savedRoutes = ref([]);
const saveConfirm = ref(false);

onMounted(async () => {
  await loadSavedRoutes();
});

async function loadSavedRoutes() {
  try {
    savedRoutes.value = await db.savedRoutes.toArray();
  } catch (e) {
    savedRoutes.value = [];
  }
}

async function saveRoute() {
  if (!startPointId.value || !endPointId.value) return;
  const stops = [startPointId.value, ...waypoints.value.map(w => w.pointId), endPointId.value];
  const startName = startPoint.value?.name || '';
  const endName = endPoint.value?.name || '';
  const name = `${startName} → ${endName}`;

  await db.savedRoutes.add({
    name,
    stops,
    equipment: equipment.value,
    speed: customSpeed.value,
    created: new Date().toISOString()
  });

  saveConfirm.value = true;
  setTimeout(() => { saveConfirm.value = false; }, 1500);
  await loadSavedRoutes();
}

function loadRoute(route) {
  if (!route.stops?.length) return;
  startPointId.value = route.stops[0];
  endPointId.value = route.stops[route.stops.length - 1];
  if (route.equipment) equipment.value = route.equipment;
  // Restore waypoints
  const wpStops = route.stops.slice(1, -1);
  waypoints.value = wpStops.map(id => ({ pointId: id, note: '' }));
}

async function deleteSavedRoute(id) {
  await db.savedRoutes.delete(id);
  await loadSavedRoutes();
}

function startThisTrip() {
  if (!startPointId.value || !endPointId.value) return;
  // Navigate to map view — the MapView's start dialog will handle actual recording
  // We pass route info via query params
  router.push({
    path: '/',
    query: {
      startTrip: 'true',
      equipment: equipment.value,
      destination: endPointId.value
    }
  });
}

function getSavedRouteDist(route) {
  const stops = (route.stops || []).map(id => accessPoints.find(a => a.id === id)).filter(Boolean);
  if (stops.length >= 2) {
    return Math.abs(stops[stops.length - 1].riverMile - stops[0].riverMile).toFixed(1);
  }
  return null;
}
</script>

<template>
  <div class="plan-view">
    <div class="plan-sidebar">
      <h2>Plan a Trip</h2>

      <div class="form-group">
        <label class="form-label">Equipment</label>
        <div class="equipment-toggle">
          <button
            class="equipment-btn"
            :class="{ active: equipment === 'rigid' }"
            @click="equipment = 'rigid'"
          >
            <span class="eq-icon">🚣</span>
            <span class="eq-label">Rigid</span>
          </button>
          <button
            class="equipment-btn"
            :class="{ active: equipment === 'inflatable' }"
            @click="equipment = 'inflatable'"
          >
            <span class="eq-icon">🎈</span>
            <span class="eq-label">Inflatable</span>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Start Point</label>
        <select class="form-select" v-model="startPointId">
          <option value="">Choose start...</option>
          <option v-for="ap in availablePoints" :key="ap.id" :value="ap.id">
            {{ ap.name }} (mile {{ ap.riverMile }})
          </option>
        </select>
      </div>

      <!-- Waypoints -->
      <div v-if="startPointId && endPointId" class="waypoints-section">
        <div v-for="(wp, idx) in resolvedWaypoints" :key="wp.id" class="waypoint-item">
          <div class="waypoint-marker">
            <div class="waypoint-line"></div>
            <div class="waypoint-dot">{{ idx + 1 }}</div>
            <div class="waypoint-line"></div>
          </div>
          <div class="waypoint-info">
            <div class="waypoint-name">{{ wp.name }}</div>
            <div v-if="wp.note" class="waypoint-note">{{ wp.note }}</div>
          </div>
          <button class="waypoint-remove" @click="removeWaypoint(idx)" title="Remove">✕</button>
        </div>

        <div v-if="showAddWaypoint" class="add-waypoint-form">
          <select class="form-select form-select-sm" v-model="newWaypointId">
            <option value="">Choose a stop...</option>
            <optgroup label="Access Points">
              <option v-for="p in availableWaypoints.filter(p => p.poiType === 'access')" :key="p.id" :value="p.id">
                {{ p.name }} (mile {{ p.riverMile }})
              </option>
            </optgroup>
            <optgroup label="Pubs & Cafes">
              <option v-for="p in availableWaypoints.filter(p => p.poiType === 'pub')" :key="p.id" :value="p.id">
                {{ p.name }} (mile {{ p.riverMile }})
              </option>
            </optgroup>
            <optgroup label="Locks">
              <option v-for="p in availableWaypoints.filter(p => p.poiType === 'lock')" :key="p.id" :value="p.id">
                {{ p.name }} (mile {{ p.riverMile }})
              </option>
            </optgroup>
          </select>
          <input
            class="form-input form-input-sm"
            v-model="newWaypointNote"
            placeholder="Reason, e.g. Stop for lunch here"
            style="margin-top:4px"
          />
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn btn-sm btn-primary" @click="addWaypoint" :disabled="!newWaypointId">Add</button>
            <button class="btn btn-sm btn-outline" @click="showAddWaypoint = false">Cancel</button>
          </div>
        </div>

        <button v-else class="btn btn-sm btn-outline add-waypoint-btn" @click="showAddWaypoint = true">
          + Add waypoint
        </button>
      </div>

      <div style="text-align:center;display:flex;gap:8px;justify-content:center">
        <button class="btn btn-sm btn-outline" @click="swapPoints" title="Swap direction">
          ↕️ Swap
        </button>
        <button
          v-if="startPointId || endPointId"
          class="btn btn-sm btn-outline btn-reset"
          @click="resetTrip"
          title="Reset trip"
        >
          ✕ Reset
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">End Point</label>
        <select class="form-select" v-model="endPointId">
          <option value="">Choose end...</option>
          <option v-for="ap in availablePoints" :key="ap.id" :value="ap.id">
            {{ ap.name }} (mile {{ ap.riverMile }})
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Speed</label>
        <select class="form-select" v-model="speedPreset">
          <option v-for="p in filteredSpeedPresets" :key="p.mph" :value="String(p.mph)">
            {{ p.label }} ({{ p.mph }} mph)
          </option>
          <option value="custom">Custom...</option>
        </select>
        <input v-if="speedPreset === 'custom'"
          type="number" class="form-input" style="margin-top:6px"
          v-model.number="customSpeedInput" min="0.5" max="10" step="0.5"
          placeholder="mph" />
      </div>

      <!-- Route summary -->
      <div v-if="routeInfo" class="route-summary card">
        <div class="route-direction">
          {{ routeInfo.downstream ? '⬇️ Downstream' : '⬆️ Upstream' }}
        </div>

        <div class="stats-grid" style="margin: 12px 0">
          <div class="stat-tile">
            <div class="stat-value">{{ routeInfo.distance.toFixed(1) }}</div>
            <div class="stat-label">Miles</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ routeInfo.timeEstimate }}</div>
            <div class="stat-label">Total Time</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ routeInfo.locks.length }}</div>
            <div class="stat-label">Locks</div>
          </div>
        </div>

        <div style="font-size:12px; color:var(--text-light); margin-bottom:12px">
          Paddle: {{ routeInfo.paddleTime }} at {{ routeInfo.speed }} mph
          · Locks: ~{{ routeInfo.lockTime }}m (~15m each)
        </div>

        <!-- Leg-by-leg breakdown (when waypoints exist) -->
        <div v-if="legs.length > 1" class="legs-section">
          <h3>Leg-by-leg</h3>
          <div v-for="(leg, idx) in legs" :key="idx" class="leg-item">
            <div class="leg-header">
              <span class="leg-label">Leg {{ idx + 1 }}</span>
              <span class="leg-stats">{{ leg.distance.toFixed(1) }} mi · {{ leg.totalTime }}</span>
            </div>
            <div class="leg-route">
              {{ leg.from.name }} → {{ leg.to.name }}
            </div>
            <div v-if="leg.locks > 0" class="leg-detail">
              🔒 {{ leg.locks }} lock{{ leg.locks > 1 ? 's' : '' }}
            </div>
            <div v-if="leg.waypointNote" class="leg-note">
              📌 {{ leg.waypointNote }}
            </div>
            <div class="leg-cumulative">
              Cumulative: {{ leg.cumulativeMile.toFixed(1) }} mi · {{ leg.cumulativeTimeStr }}
            </div>
          </div>
        </div>

        <!-- Hazards -->
        <div v-if="routeInfo.hazards.length" class="hazard-warning">
          <div v-for="h in routeInfo.hazards" :key="h.id" class="hazard-item">
            ⚠️ <strong>{{ h.name }}:</strong> {{ h.hazard }}
          </div>
        </div>

        <!-- What you'll pass -->
        <div class="route-pois">
          <h3>Along the route</h3>
          <ul class="poi-list">
            <li v-for="lock in routeInfo.locks" :key="lock.id" class="poi-item">
              <span class="poi-icon lock">🔒</span>
              <div>
                <div class="poi-name">{{ lock.name }}</div>
                <div class="poi-detail">
                  Portage: {{ lock.portage }} bank
                  <span v-if="lock.canoePass"> · Canoe pass available</span>
                </div>
              </div>
            </li>
            <li v-for="pub in routeInfo.pubs" :key="pub.id" class="poi-item">
              <span class="poi-icon pub">{{ pub.type === 'cafe' ? '☕' : '🍺' }}</span>
              <div>
                <div class="poi-name">{{ pub.name }}</div>
                <div class="poi-detail">{{ pub.notes }}</div>
              </div>
            </li>
            <li v-for="camp in routeInfo.camps" :key="camp.id" class="poi-item">
              <span class="poi-icon camp">⛺</span>
              <div>
                <div class="poi-name">{{ camp.name }}</div>
                <div class="poi-detail">
                  {{ camp.type === 'lock' ? 'Lock campsite' : 'Commercial campsite' }}
                  · {{ camp.notes }}
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Bail-out points -->
        <div v-if="routeInfo.bailOuts.length" class="route-pois" style="margin-top:16px">
          <h3>🚨 Bail-out options</h3>
          <p style="font-size:12px;color:var(--text-light);margin-bottom:8px">
            Alternative landing points with {{ equipment === 'rigid' ? 'vehicle' : 'foot' }} access
          </p>
          <ul class="poi-list">
            <li v-for="bp in routeInfo.bailOuts" :key="bp.id" class="poi-item">
              <span class="poi-icon access">🚣</span>
              <div>
                <div class="poi-name">{{ bp.name }}</div>
                <div class="poi-detail">
                  Mile {{ bp.riverMile }}
                  <span v-if="bp.access.vehicleAccess"> · 🚗 Vehicle access</span>
                  <span v-if="bp.access.parkingNotes"> · {{ bp.access.parkingNotes }}</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
        <!-- Save & Start buttons -->
        <div class="route-actions">
          <button class="btn btn-primary route-action-btn" @click="startThisTrip">
            ▶ Start This Trip
          </button>
          <button class="btn btn-outline route-action-btn" @click="saveRoute">
            {{ saveConfirm ? '✓ Saved!' : '💾 Save Route' }}
          </button>
        </div>
      </div>

      <div v-else class="empty-state" style="padding: 24px 0">
        <div class="empty-icon">📍</div>
        <h3>Select start and end points</h3>
        <p>Choose your launch and landing sites to see route details, locks, pubs, and bail-out options.</p>
      </div>

      <!-- Saved routes -->
      <div v-if="savedRoutes.length" class="saved-routes-section">
        <h3>📁 Saved Routes</h3>
        <div class="saved-routes-list">
          <div v-for="route in savedRoutes" :key="route.id" class="saved-route-card">
            <div class="saved-route-card-info" @click="loadRoute(route)">
              <div class="saved-route-card-name">{{ route.name }}</div>
              <div class="saved-route-card-detail">
                <span v-if="getSavedRouteDist(route)">{{ getSavedRouteDist(route) }} mi</span>
                <span v-if="route.equipment"> · {{ route.equipment === 'rigid' ? '🚣 Rigid' : '🎈 Inflatable' }}</span>
                <span v-if="route.stops?.length > 2"> · {{ route.stops.length - 2 }} stop{{ route.stops.length - 2 > 1 ? 's' : '' }}</span>
              </div>
            </div>
            <div class="saved-route-card-actions">
              <button class="saved-route-action" @click="loadRoute(route)" title="Load">✏️</button>
              <button class="saved-route-action" @click="deleteSavedRoute(route.id)" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="plan-map">
      <ThamesMap
        :equipment="equipment"
        :highlightStart="routeInfo?.startMile"
        :highlightEnd="routeInfo?.endMile"
        height="100%"
      />
    </div>
  </div>
</template>

<style scoped>
.plan-view {
  display: flex;
  height: 100%;
}

.plan-sidebar {
  width: 380px;
  padding: 20px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--card-bg);
  flex-shrink: 0;
}

.plan-map {
  flex: 1;
}

.route-summary {
  margin-top: 16px;
}

.btn-reset {
  color: var(--danger);
  border-color: var(--danger);
}

.btn-reset:hover {
  background: var(--danger-light);
}

.route-direction {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}

.hazard-warning {
  background: var(--danger-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 12px;
}

.hazard-item {
  font-size: 13px;
  color: var(--danger);
}

.route-pois h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

/* Waypoints */
.waypoints-section {
  margin: 8px 0;
  padding-left: 4px;
}

.waypoint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.waypoint-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;
}

.waypoint-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waypoint-line {
  width: 2px;
  height: 8px;
  background: var(--border);
}

.waypoint-info {
  flex: 1;
  min-width: 0;
}

.waypoint-name {
  font-size: 13px;
  font-weight: 500;
}

.waypoint-note {
  font-size: 11px;
  color: var(--text-light);
  font-style: italic;
}

.waypoint-remove {
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}

.waypoint-remove:hover {
  background: var(--danger-light);
  color: var(--danger);
}

.add-waypoint-btn {
  margin: 4px 0;
  font-size: 12px;
}

.add-waypoint-form {
  margin: 8px 0;
  padding: 8px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.form-select-sm, .form-input-sm {
  font-size: 12px;
  padding: 4px 8px;
}

/* Legs */
.legs-section {
  margin-bottom: 16px;
}

.legs-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.leg-item {
  padding: 8px;
  border-left: 3px solid var(--primary);
  margin-bottom: 6px;
  background: var(--bg);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.leg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.leg-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
}

.leg-stats {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.leg-route {
  font-size: 13px;
  margin: 2px 0;
}

.leg-detail {
  font-size: 11px;
  color: var(--text-light);
}

.leg-note {
  font-size: 12px;
  color: var(--primary);
  font-style: italic;
  margin-top: 2px;
}

.leg-cumulative {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 4px;
  border-top: 1px dashed var(--border);
  padding-top: 4px;
}

/* Route actions */
.route-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.route-action-btn {
  flex: 1;
  font-size: 13px;
  padding: 10px 12px;
}

/* Saved routes section */
.saved-routes-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.saved-routes-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.saved-routes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.saved-route-card {
  display: flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.saved-route-card-info {
  flex: 1;
  padding: 10px 12px;
  cursor: pointer;
  min-width: 0;
}

.saved-route-card-info:hover {
  background: rgba(26, 107, 138, 0.05);
}

.saved-route-card-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.saved-route-card-detail {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 2px;
}

.saved-route-card-actions {
  display: flex;
  gap: 2px;
  padding: 0 6px;
}

.saved-route-action {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 6px;
  border-radius: 4px;
}

.saved-route-action:hover {
  background: var(--border);
}

@media (max-width: 768px) {
  .plan-view {
    flex-direction: column;
  }

  .plan-sidebar {
    width: 100%;
    max-height: 50vh;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .plan-map {
    min-height: 50vh;
  }
}
</style>
