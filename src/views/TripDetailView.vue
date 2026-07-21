<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ThamesMap from '../components/ThamesMap.vue';
import { db } from '../data/db.js';
import { accessPoints } from '../data/access-points.js';
import { locks } from '../data/thames-locks.js';
import { pubsCafes } from '../data/pubs-cafes.js';
import { formatDistance, formatDuration, formatSpeed } from '../utils/river.js';
import { generateGpx } from '../utils/gpx.js';
import { useShare } from '../composables/useShare.js';
import { extractExifGps } from '../utils/exif.js';
import { nearestRoutePoint } from '../utils/river.js';

const props = defineProps({
  id: { type: [String, Number], required: true }
});

const router = useRouter();
const trip = ref(null);
const photos = ref([]);
const lightboxPhoto = ref(null);
const photoInput = ref(null);
const share = useShare();
const expandedLegs = ref(new Set([0])); // First leg expanded by default

onMounted(async () => {
  trip.value = await db.trips.get(Number(props.id));
  await loadPhotos();
});

async function loadPhotos() {
  try {
    photos.value = await db.photos.where('tripId').equals(Number(props.id)).toArray();
  } catch (e) {
    photos.value = [];
  }
}

function getPointName(id) {
  return accessPoints.find(p => p.id === id)?.name || id;
}

function getPoint(id) {
  return accessPoints.find(p => p.id === id);
}

const startPoint = computed(() => getPoint(trip.value?.startPointId));
const endPoint = computed(() => getPoint(trip.value?.endPointId));

// Direction of travel
const direction = computed(() => {
  if (!startPoint.value || !endPoint.value) return null;
  const downstream = endPoint.value.riverMile > startPoint.value.riverMile;
  // Calculate rough compass direction from track or from start/end points
  let heading = null;
  if (trip.value?.recordedTrack?.length > 1) {
    const first = trip.value.recordedTrack[0];
    const last = trip.value.recordedTrack[trip.value.recordedTrack.length - 1];
    const dLat = last.lat - first.lat;
    const dLng = last.lng - first.lng;
    const deg = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    heading = dirs[Math.round(deg / 45) % 8];
  }
  return {
    downstream,
    label: downstream ? 'Downstream' : 'Upstream',
    icon: downstream ? '⬇️' : '⬆️',
    heading
  };
});

const routeLocks = computed(() => {
  if (!startPoint.value || !endPoint.value) return [];
  const lo = Math.min(startPoint.value.riverMile, endPoint.value.riverMile);
  const hi = Math.max(startPoint.value.riverMile, endPoint.value.riverMile);
  return locks.filter(l => l.riverMile >= lo && l.riverMile <= hi);
});

// Time breakdown
const timeBreakdown = computed(() => {
  if (!trip.value) return null;
  const totalMs = trip.value.totalTimeMs || 0;
  if (!totalMs) return null;

  // Calculate lock time (estimate ~15 min per lock traversed)
  const numLocks = routeLocks.value.length;
  const lockMs = numLocks * 15 * 60 * 1000; // 15 min per lock

  // Calculate pause/stopped time
  let pauseMs = 0;
  if (trip.value.pauseLog?.length) {
    for (const p of trip.value.pauseLog) {
      if (p.pausedAt && p.resumedAt) {
        pauseMs += new Date(p.resumedAt) - new Date(p.pausedAt);
      }
    }
  }

  // Paddle time = total - locks - pauses
  const paddleMs = Math.max(0, totalMs - lockMs - pauseMs);

  const paddlePct = totalMs > 0 ? Math.round((paddleMs / totalMs) * 100) : 0;
  const lockPct = totalMs > 0 ? Math.round((lockMs / totalMs) * 100) : 0;
  const pausePct = totalMs > 0 ? 100 - paddlePct - lockPct : 0;

  return {
    paddleMs,
    paddlePct,
    lockMs,
    lockPct,
    numLocks,
    pauseMs,
    pausePct
  };
});

// Build legs from pause log and locks
const tripLegs = computed(() => {
  if (!trip.value || !startPoint.value || !endPoint.value) return [];

  const lo = Math.min(startPoint.value.riverMile, endPoint.value.riverMile);
  const hi = Math.max(startPoint.value.riverMile, endPoint.value.riverMile);
  const downstream = endPoint.value.riverMile > startPoint.value.riverMile;

  // Get locks along route in order of travel
  const legLocks = locks
    .filter(l => l.riverMile > lo && l.riverMile < hi)
    .sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  // Get pubs/cafes along route
  const legPubs = pubsCafes
    .filter(p => p.riverMile >= lo && p.riverMile <= hi)
    .sort((a, b) => downstream ? a.riverMile - b.riverMile : b.riverMile - a.riverMile);

  if (legLocks.length === 0) {
    // Single leg - start to end
    return [{
      num: 1,
      from: startPoint.value,
      to: endPoint.value,
      distance: Math.abs(endPoint.value.riverMile - startPoint.value.riverMile),
      locks: 0,
      stops: legPubs.slice(0, 3).map(p => ({
        type: p.type === 'cafe' ? 'cafe' : 'pub',
        name: p.name,
        mile: p.riverMile
      })),
      expanded: expandedLegs.value.has(0)
    }];
  }

  // Build legs between locks
  const result = [];
  let prevPoint = startPoint.value;
  let prevMile = startPoint.value.riverMile;

  legLocks.forEach((lock, idx) => {
    const dist = Math.abs(lock.riverMile - prevMile);
    const legLo = Math.min(prevMile, lock.riverMile);
    const legHi = Math.max(prevMile, lock.riverMile);
    const legStops = [];

    // Add the lock as a stop
    legStops.push({
      type: 'lock',
      name: lock.name,
      mile: lock.riverMile,
      detail: `Portage ${lock.portage} bank`
    });

    // Add pubs along this leg
    legPubs
      .filter(p => p.riverMile > legLo && p.riverMile < legHi)
      .forEach(p => {
        legStops.push({
          type: p.type === 'cafe' ? 'cafe' : 'pub',
          name: p.name,
          mile: p.riverMile
        });
      });

    result.push({
      num: idx + 1,
      from: prevPoint,
      to: { name: lock.name, riverMile: lock.riverMile },
      distance: dist,
      locks: 1,
      stops: legStops,
      expanded: expandedLegs.value.has(idx)
    });

    prevPoint = { name: lock.name, riverMile: lock.riverMile };
    prevMile = lock.riverMile;
  });

  // Final leg from last lock to end
  const finalDist = Math.abs(endPoint.value.riverMile - prevMile);
  const finalLo = Math.min(prevMile, endPoint.value.riverMile);
  const finalHi = Math.max(prevMile, endPoint.value.riverMile);
  const finalStops = legPubs
    .filter(p => p.riverMile > finalLo && p.riverMile < finalHi)
    .map(p => ({
      type: p.type === 'cafe' ? 'cafe' : 'pub',
      name: p.name,
      mile: p.riverMile
    }));

  result.push({
    num: legLocks.length + 1,
    from: prevPoint,
    to: endPoint.value,
    distance: finalDist,
    locks: 0,
    stops: finalStops,
    expanded: expandedLegs.value.has(legLocks.length)
  });

  return result;
});

function toggleLeg(index) {
  if (expandedLegs.value.has(index)) {
    expandedLegs.value.delete(index);
  } else {
    expandedLegs.value.add(index);
  }
  // Force reactivity
  expandedLegs.value = new Set(expandedLegs.value);
}

const stopIcons = { lock: '🔒', pub: '🍺', cafe: '☕', camp: '⛺', access: '🛶' };

function exportGpx() {
  if (!trip.value?.recordedTrack?.length) return;

  const name = `${getPointName(trip.value.startPointId)} to ${getPointName(trip.value.endPointId)} - ${trip.value.date}`;
  const gpx = generateGpx(name, trip.value.recordedTrack);

  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thames-paddle-${trip.value.date}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteTrip() {
  if (confirm('Delete this trip?')) {
    await db.trips.delete(Number(props.id));
    // Also delete photos
    try {
      await db.photos.where('tripId').equals(Number(props.id)).delete();
    } catch (e) { /* photos table may not exist */ }
    router.push('/history');
  }
}

// Trip sharing
function handleShareTrip() {
  if (!trip.value) return;
  share.shareTripSummary(trip.value, formatDistance, formatDuration, formatSpeed);
}

function handleCopyStats() {
  if (!trip.value) return;
  share.copyTripStats(trip.value, formatDistance, formatDuration, formatSpeed);
}

// Photo handling
function openLightbox(photo) {
  lightboxPhoto.value = photo;
}

function closeLightbox() {
  lightboxPhoto.value = null;
}

function triggerPhotoUpload() {
  photoInput.value?.click();
}

async function handlePhotoUpload(event) {
  const files = event.target.files;
  if (!files?.length) return;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const exifGps = extractExifGps(dataUrl);

      let riverMile = null;
      if (exifGps) {
        const snap = nearestRoutePoint(exifGps.lat, exifGps.lng);
        if (snap.distanceFromRiver < 2) riverMile = snap.point[2];
      }

      await db.photos.add({
        tripId: Number(props.id),
        timestamp: Date.now(),
        dataUrl,
        name: file.name,
        lat: exifGps?.lat || null,
        lng: exifGps?.lng || null,
        hasGps: !!exifGps,
        riverMile
      });
      await loadPhotos();
    };
    reader.readAsDataURL(file);
  }
  event.target.value = '';
}
</script>

<template>
  <div class="detail-view" v-if="trip">
    <div class="detail-sidebar">
      <button class="btn btn-sm btn-outline" @click="router.push('/history')" style="margin-bottom:16px">
        ← Back
      </button>

      <div class="trip-date-lg">
        {{ new Date(trip.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
      </div>

      <h2 class="trip-route-lg">
        {{ getPointName(trip.startPointId) }} → {{ getPointName(trip.endPointId) }}
      </h2>

      <span class="badge" :class="trip.equipmentType === 'rigid' ? 'badge-rigid' : 'badge-inflatable'" style="margin-bottom:16px">
        {{ trip.equipmentType === 'rigid' ? '🚣 Rigid kayak' : '🎈 Inflatable kayak' }}
      </span>

      <!-- Trip Overview -->
      <div class="section">
        <h3>📊 Trip Overview</h3>
        <div class="stats-grid" style="margin: 8px 0">
          <div class="stat-tile highlight" v-if="trip.actualDistanceMiles">
            <div class="stat-value">{{ trip.actualDistanceMiles.toFixed(1) }} mi</div>
            <div class="stat-label">Distance</div>
          </div>
          <div class="stat-tile highlight" v-if="trip.totalTimeMs">
            <div class="stat-value">{{ formatDuration(trip.totalTimeMs) }}</div>
            <div class="stat-label">Total Time</div>
          </div>
          <div class="stat-tile" v-if="direction?.heading">
            <div class="stat-value">{{ direction.heading }}</div>
            <div class="stat-label">Direction</div>
          </div>
          <div class="stat-tile" v-if="trip.avgSpeedMph">
            <div class="stat-value">{{ trip.avgSpeedMph.toFixed(1) }} mph</div>
            <div class="stat-label">Avg Speed</div>
          </div>
          <div class="stat-tile" v-if="trip.maxSpeedMph">
            <div class="stat-value">{{ trip.maxSpeedMph.toFixed(1) }} mph</div>
            <div class="stat-label">Top Speed</div>
          </div>
          <div class="stat-tile" v-if="routeLocks.length">
            <div class="stat-value">{{ routeLocks.length }}</div>
            <div class="stat-label">Locks</div>
          </div>
        </div>

        <!-- Time breakdown -->
        <div v-if="timeBreakdown" class="time-breakdown">
          <div class="time-tile">
            <div class="time-tile-value" style="color:var(--primary)">{{ formatDuration(timeBreakdown.paddleMs) }}</div>
            <div class="time-tile-label">Paddling ({{ timeBreakdown.paddlePct }}%)</div>
          </div>
          <div class="time-tile" v-if="timeBreakdown.numLocks > 0">
            <div class="time-tile-value" style="color:#e67e22">{{ formatDuration(timeBreakdown.lockMs) }}</div>
            <div class="time-tile-label">Locks ({{ timeBreakdown.lockPct }}%)</div>
          </div>
          <div class="time-tile" v-if="timeBreakdown.pauseMs > 0">
            <div class="time-tile-value" style="color:#95a5a6">{{ formatDuration(timeBreakdown.pauseMs) }}</div>
            <div class="time-tile-label">Stopped ({{ timeBreakdown.pausePct }}%)</div>
          </div>
        </div>
      </div>

      <!-- Legs & Stops -->
      <div v-if="tripLegs.length > 0" class="section">
        <h3>🦵 Legs & Stops</h3>
        <div v-for="(leg, idx) in tripLegs" :key="idx" class="td-leg">
          <div class="td-leg-header" @click="toggleLeg(idx)">
            <span class="td-leg-num">Leg {{ leg.num }}</span>
            <span class="td-leg-route">{{ leg.from.name }} → {{ leg.to.name }}</span>
            <span class="td-leg-time">{{ leg.distance.toFixed(1) }} mi</span>
            <span class="td-leg-chevron" :class="{ open: expandedLegs.has(idx) }">▸</span>
          </div>
          <div v-if="expandedLegs.has(idx)" class="td-leg-body">
            <div v-if="leg.locks > 0" class="td-leg-detail">
              🔒 {{ leg.locks }} lock{{ leg.locks > 1 ? 's' : '' }}
            </div>
            <div v-for="(stop, si) in leg.stops" :key="si" class="td-stop">
              <span class="td-stop-icon">{{ stopIcons[stop.type] || '📍' }}</span>
              <div class="td-stop-info">
                <div class="td-stop-name">{{ stop.name }}</div>
                <div class="td-stop-detail" v-if="stop.detail || stop.mile">
                  <span v-if="stop.mile">Mile {{ stop.mile.toFixed(1) }}</span>
                  <span v-if="stop.detail"> · {{ stop.detail }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pause log -->
      <div v-if="trip.pauseLog?.length" class="section">
        <h3>Breaks</h3>
        <div v-for="(pause, i) in trip.pauseLog" :key="i" class="pause-entry">
          ☕ {{ new Date(pause.pausedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}
          – {{ new Date(pause.resumedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}
        </div>
      </div>

      <!-- Photos -->
      <div class="section">
        <h3>📸 Photos</h3>
        <div class="photo-grid">
          <img
            v-for="(photo, i) in photos"
            :key="photo.id || i"
            :src="photo.dataUrl"
            :alt="photo.name || 'Photo'"
            class="photo-thumb"
            @click="openLightbox(photo)"
          />
          <button class="photo-add-btn" @click="triggerPhotoUpload">+</button>
        </div>
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          multiple
          style="display:none"
          @change="handlePhotoUpload"
        />
      </div>

      <!-- Notes -->
      <div v-if="trip.notes" class="section">
        <h3>Notes</h3>
        <p class="trip-notes">{{ trip.notes }}</p>
      </div>

      <!-- Share bar -->
      <div class="share-bar">
        <button class="share-btn-action primary" @click="handleShareTrip">📤 Share Trip</button>
        <button class="share-btn-action outline" @click="handleCopyStats">📋 Copy Stats</button>
      </div>

      <!-- Actions -->
      <div class="actions" style="margin-top:16px;display:flex;gap:8px">
        <button
          v-if="trip.recordedTrack?.length"
          class="btn btn-sm btn-outline"
          @click="exportGpx"
        >
          📤 Export GPX
        </button>
        <button class="btn btn-sm btn-danger" @click="deleteTrip">
          🗑️ Delete
        </button>
      </div>
    </div>

    <div class="detail-map">
      <ThamesMap
        :equipment="trip.equipmentType"
        :highlightStart="startPoint?.riverMile"
        :highlightEnd="endPoint?.riverMile"
        :trackPoints="trip.recordedTrack || []"
        height="100%"
      />
    </div>

    <!-- Photo lightbox -->
    <div v-if="lightboxPhoto" class="photo-lightbox" @click.self="closeLightbox">
      <button class="lightbox-close" @click="closeLightbox">✕</button>
      <img :src="lightboxPhoto.dataUrl" :alt="lightboxPhoto.name || 'Photo'" />
      <div class="lightbox-info">
        {{ lightboxPhoto.name || 'Photo' }}
        <template v-if="lightboxPhoto.riverMile != null"> · Mile {{ lightboxPhoto.riverMile.toFixed(1) }}</template>
        <template v-if="lightboxPhoto.hasGps"> · 📍 GPS</template>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="share.toastVisible.value" class="toast">
      {{ share.toastMessage.value }}
    </div>
  </div>

  <div v-else class="empty-state" style="height:100%;display:flex;align-items:center;justify-content:center">
    <div>Loading trip...</div>
  </div>
</template>

<style scoped>
.detail-view {
  display: flex;
  height: 100%;
  position: relative;
}

.detail-sidebar {
  width: 380px;
  padding: 20px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--card-bg);
  flex-shrink: 0;
}

.detail-map {
  flex: 1;
}

.trip-date-lg {
  font-size: 13px;
  color: var(--text-light);
  margin-bottom: 4px;
}

.trip-route-lg {
  font-size: 20px;
  margin-bottom: 8px;
}

.section {
  margin-top: 20px;
}

.section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.stat-tile.highlight .stat-value {
  color: var(--primary);
  font-size: 16px;
}

/* ===== Time breakdown ===== */
.time-breakdown {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.time-tile {
  flex: 1;
  min-width: 80px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  text-align: center;
  box-shadow: var(--shadow);
}

.time-tile-value {
  font-size: 14px;
  font-weight: 700;
}

.time-tile-label {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 2px;
}

/* ===== Legs ===== */
.td-leg {
  margin-bottom: 6px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.td-leg-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--bg);
  transition: background 0.15s;
}

.td-leg-header:hover {
  background: var(--border);
}

.td-leg-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  white-space: nowrap;
}

.td-leg-route {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-leg-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.td-leg-chevron {
  font-size: 12px;
  color: var(--text-light);
  transition: transform 0.2s;
}

.td-leg-chevron.open {
  transform: rotate(90deg);
}

.td-leg-body {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}

.td-leg-detail {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 6px;
}

.td-stop {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.td-stop-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.td-stop-info {
  flex: 1;
  min-width: 0;
}

.td-stop-name {
  font-size: 12px;
  font-weight: 500;
}

.td-stop-detail {
  font-size: 11px;
  color: var(--text-light);
}

/* ===== Pause entries ===== */
.pause-entry {
  font-size: 13px;
  color: var(--text-light);
  margin-bottom: 4px;
}

.trip-notes {
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
  white-space: pre-wrap;
}

/* ===== Photo grid ===== */
.photo-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.photo-thumb {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  object-fit: cover;
  cursor: pointer;
  box-shadow: var(--shadow);
  border: 2px solid #fff;
}

.photo-thumb:active { transform: scale(0.95); }

.photo-add-btn {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  border: 2px dashed var(--border);
  background: none;
  font-size: 24px;
  color: var(--text-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-add-btn:hover { border-color: var(--primary); color: var(--primary); }

/* ===== Photo lightbox ===== */
.photo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.photo-lightbox img {
  max-width: 92%;
  max-height: 75vh;
  border-radius: 8px;
  object-fit: contain;
}

.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  z-index: 10;
}

.lightbox-info {
  color: #fff;
  text-align: center;
  margin-top: 10px;
  font-size: 12px;
}

/* ===== Share bar ===== */
.share-bar {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.share-btn-action {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.share-btn-action:active { transform: scale(0.97); }
.share-btn-action.primary { background: var(--primary); color: #fff; }
.share-btn-action.outline { background: var(--card-bg); color: var(--text); border: 1px solid var(--border); }

/* ===== Toast ===== */
.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background: var(--success);
  color: #fff;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .detail-view {
    flex-direction: column;
  }

  .detail-sidebar {
    width: 100%;
    max-height: 50vh;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .detail-map {
    min-height: 50vh;
  }
}
</style>
