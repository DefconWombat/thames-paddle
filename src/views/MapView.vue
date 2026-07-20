<script setup>
import { ref, watch, onMounted } from 'vue';
import ThamesMap from '../components/ThamesMap.vue';
import { useGps } from '../composables/useGps.js';
import { useTripRecorder } from '../composables/useTripRecorder.js';
import { useUnits } from '../composables/useUnits.js';

const equipment = ref('all');
const showLocks = ref(true);
const showAccess = ref(true);
const showPubs = ref(true);
const showCamps = ref(true);
const showParking = ref(true);
const showFilters = ref(false);
const selectedPoint = ref(null);
const showEndConfirm = ref(false);
const showUnitPicker = ref(false);
const thamesMapRef = ref(null);

// GPS tracking
const gps = useGps();

// Trip recording
const recorder = useTripRecorder();

// Units
const { units, toggleUnits, formatDist, formatDistShort, formatSpd, formatRiverMile } = useUnits();

// Auto-start GPS when map opens
onMounted(() => {
  if (!gps.tracking.value) {
    gps.startTracking();
    gps.followMode.value = false; // Don't auto-centre — user chooses
  }
});

// Feed GPS positions into the trip recorder
watch(() => gps.position.value, (pos) => {
  if (pos && recorder.status.value === 'recording') {
    recorder.recordPoint(pos);
  }
}, { deep: true });

// When user pans the map, disable follow
function onUserPan() {
  gps.followMode.value = false;
}

function onPointClick(point) {
  selectedPoint.value = point;
}

// Re-centre on GPS position
function recentre() {
  if (thamesMapRef.value) {
    gps.followMode.value = true;
    thamesMapRef.value.recentreOnGps();
  }
}

// Trip controls
async function handleStartTrip() {
  if (!gps.tracking.value) {
    gps.startTracking();
  }
  gps.followMode.value = true;
  await recorder.startTrip({ equipment: equipment.value });
}

async function handlePauseTrip() {
  await recorder.pauseTrip();
}

async function handleResumeTrip() {
  await recorder.resumeTrip();
}

async function handleEndTrip() {
  showEndConfirm.value = false;
  await recorder.endTrip();
  setTimeout(() => {
    gps.followMode.value = false;
  }, 2000);
}

async function handleDiscardTrip() {
  showEndConfirm.value = false;
  await recorder.discardTrip();
}

function handleDismissFinished() {
  recorder.resetState();
}
</script>

<template>
  <div class="map-view">
    <ThamesMap
      ref="thamesMapRef"
      :equipment="equipment"
      :showLocks="showLocks"
      :showAccess="showAccess"
      :showPubs="showPubs"
      :showCamps="showCamps"
      :showParking="showParking"
      :selectedPointId="selectedPoint?.id"
      :gpsPosition="gps.position.value"
      :followGps="gps.followMode.value"
      :trackPoints="recorder.track.value"
      height="100%"
      @point-click="onPointClick"
      @user-pan="onUserPan"
    />

    <!-- Re-centre / GPS button -->
    <button
      v-if="gps.tracking.value && gps.position.value"
      class="gps-btn"
      :class="{ following: gps.followMode.value }"
      @click="recentre"
      title="Centre on my location"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    </button>

    <!-- GPS info strip (when tracking but not recording a trip) -->
    <div v-if="gps.tracking.value && gps.position.value && recorder.status.value === 'idle'" class="gps-info">
      <span v-if="gps.riverMile.value != null" class="gps-info-item">
        📍 {{ formatRiverMile(gps.riverMile.value) }}
      </span>
      <span v-if="gps.position.value.speed != null && gps.position.value.speed > 0.5" class="gps-info-item">
        {{ formatSpd(gps.position.value.speed) }}
      </span>
      <span v-if="gps.nearestPoi.value?.lock" class="gps-info-item">
        🔒 {{ gps.nearestPoi.value.lock.name }} ({{ formatDistShort(gps.nearestPoi.value.lock.distance) }})
      </span>
    </div>

    <!-- GPS error -->
    <div v-if="gps.error.value" class="gps-error">
      {{ gps.error.value }}
    </div>

    <!-- Trip controls -->
    <div class="trip-controls">
      <!-- Start button (when idle and GPS is on) -->
      <button
        v-if="recorder.status.value === 'idle' && gps.tracking.value && gps.position.value"
        class="trip-btn trip-start"
        @click="handleStartTrip"
      >
        ▶ Start Trip
      </button>

      <!-- Recording controls -->
      <template v-if="recorder.status.value === 'recording'">
        <button class="trip-btn trip-pause" @click="handlePauseTrip">⏸ Pause</button>
        <button class="trip-btn trip-end" @click="showEndConfirm = true">⏹ End</button>
      </template>

      <!-- Paused controls -->
      <template v-if="recorder.status.value === 'paused'">
        <button class="trip-btn trip-resume" @click="handleResumeTrip">▶ Resume</button>
        <button class="trip-btn trip-end" @click="showEndConfirm = true">⏹ End</button>
      </template>
    </div>

    <!-- Live stats panel (during recording or paused) -->
    <div v-if="recorder.status.value === 'recording' || recorder.status.value === 'paused'" class="live-stats">
      <div class="stat-row">
        <div class="stat">
          <div class="stat-value">{{ recorder.stats.value.elapsedFormatted }}</div>
          <div class="stat-label">Time</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ formatDist(recorder.stats.value.distance) }}</div>
          <div class="stat-label">Distance</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ formatSpd(recorder.stats.value.currentSpeed) }}</div>
          <div class="stat-label">Speed</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ formatSpd(recorder.stats.value.avgSpeed) }}</div>
          <div class="stat-label">Avg</div>
        </div>
      </div>
      <div class="stat-footer">
        <span v-if="gps.riverMile.value != null" class="stat-mile">
          📍 {{ formatRiverMile(gps.riverMile.value) }}
        </span>
        <button class="unit-toggle" @click="toggleUnits">
          {{ units === 'imperial' ? 'mi/mph' : 'km/kmh' }}
        </button>
      </div>
      <div v-if="recorder.status.value === 'paused'" class="stat-paused">⏸ PAUSED</div>
    </div>

    <!-- Trip finished summary -->
    <div v-if="recorder.status.value === 'finished'" class="trip-summary card">
      <h3>Trip Complete</h3>
      <div class="summary-stats">
        <div class="summary-stat">
          <div class="summary-value">{{ formatDist(recorder.stats.value.distance) }}</div>
          <div class="summary-label">Distance</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">{{ recorder.stats.value.elapsedFormatted }}</div>
          <div class="summary-label">Total time</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">{{ recorder.stats.value.movingTimeFormatted }}</div>
          <div class="summary-label">Moving time</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">{{ formatSpd(recorder.stats.value.avgSpeed) }}</div>
          <div class="summary-label">Avg speed</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">{{ formatSpd(recorder.stats.value.maxSpeed) }}</div>
          <div class="summary-label">Max speed</div>
        </div>
      </div>
      <p class="summary-note">Trip saved to your history.</p>
      <button class="btn btn-primary" @click="handleDismissFinished">Done</button>
    </div>

    <!-- End trip confirmation -->
    <div v-if="showEndConfirm" class="confirm-overlay">
      <div class="confirm-dialog card">
        <h3>End this trip?</h3>
        <p>{{ formatDist(recorder.stats.value.distance) }} covered in {{ recorder.stats.value.elapsedFormatted }}</p>
        <div class="confirm-buttons">
          <button class="btn btn-primary" @click="handleEndTrip">Save & End</button>
          <button class="btn btn-outline" @click="handleDiscardTrip">Discard</button>
          <button class="btn btn-outline" @click="showEndConfirm = false">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Filter controls overlay -->
    <div class="map-controls">
      <button class="btn btn-sm btn-outline control-btn" @click="showFilters = !showFilters">
        ⚙️ Filters
      </button>

      <div v-if="showFilters" class="filter-panel card">
        <div class="form-group">
          <label class="form-label">Equipment</label>
          <div class="equipment-toggle">
            <button class="equipment-btn" :class="{ active: equipment === 'all' }" @click="equipment = 'all'">
              <span class="eq-icon">🛶</span><span class="eq-label">All</span>
            </button>
            <button class="equipment-btn" :class="{ active: equipment === 'rigid' }" @click="equipment = 'rigid'">
              <span class="eq-icon">🚣</span><span class="eq-label">Rigid</span>
            </button>
            <button class="equipment-btn" :class="{ active: equipment === 'inflatable' }" @click="equipment = 'inflatable'">
              <span class="eq-icon">🎈</span><span class="eq-label">Inflatable</span>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Units</label>
          <div class="equipment-toggle">
            <button class="equipment-btn" :class="{ active: units === 'imperial' }" @click="units = 'imperial'">
              mi / mph
            </button>
            <button class="equipment-btn" :class="{ active: units === 'metric' }" @click="units = 'metric'">
              km / km/h
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Show / Hide</label>
          <div class="toggle-list">
            <label class="toggle-item"><input type="checkbox" v-model="showLocks" /><span>🔒 Locks & Weirs</span></label>
            <label class="toggle-item"><input type="checkbox" v-model="showAccess" /><span>🚣 Access Points</span></label>
            <label class="toggle-item"><input type="checkbox" v-model="showPubs" /><span>🍺 Pubs & Cafés</span></label>
            <label class="toggle-item"><input type="checkbox" v-model="showCamps" /><span>⛺ Campsites</span></label>
            <label class="toggle-item"><input type="checkbox" v-model="showParking" /><span>🅿️ Car Parks</span></label>
          </div>
        </div>
      </div>
    </div>

    <!-- Point detail panel -->
    <div v-if="selectedPoint" class="point-detail card">
      <button class="panel-close" @click="selectedPoint = null">✕</button>
      <div class="popup-title">{{ selectedPoint.name }}</div>
      <div class="popup-detail" v-if="selectedPoint.riverMile != null">
        {{ formatRiverMile(selectedPoint.riverMile) }}
      </div>
      <div class="popup-detail" v-if="selectedPoint.notes">{{ selectedPoint.notes }}</div>
      <div v-if="selectedPoint.hazard" class="popup-detail" style="color:var(--danger);font-weight:600">
        ⚠️ {{ selectedPoint.hazard }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-view {
  position: relative;
  height: 100%;
}

/* GPS locate / recentre button */
.gps-btn {
  position: absolute;
  bottom: 24px;
  left: 12px;
  z-index: 800;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  box-shadow: var(--shadow-lg);
  color: #4285f4;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.gps-btn.following {
  background: #4285f4;
  color: white;
}

/* GPS info strip */
.gps-info {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 800;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 70%;
}

.gps-info-item {
  background: var(--card-bg);
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: var(--shadow);
  white-space: nowrap;
}

.gps-error {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 800;
  background: var(--danger-light);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  text-align: center;
}

/* Trip controls */
.trip-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 800;
  display: flex;
  gap: 8px;
}

.trip-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  transition: all 0.2s;
  white-space: nowrap;
}

.trip-start { background: var(--success); color: white; }
.trip-pause { background: #f39c12; color: white; }
.trip-resume { background: var(--success); color: white; }
.trip-end { background: var(--danger); color: white; }

/* Live stats panel */
.live-stats {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 800;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 10px 12px;
}

.stat-row {
  display: flex;
  justify-content: space-around;
  gap: 4px;
}

.stat { text-align: center; flex: 1; }

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-light);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.stat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.stat-mile {
  font-size: 12px;
  color: var(--text-light);
}

.unit-toggle {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;
}

.stat-paused {
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #f39c12;
  margin-top: 4px;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Trip finished summary */
.trip-summary {
  position: absolute;
  bottom: 24px;
  left: 16px;
  right: 16px;
  max-width: 420px;
  margin: 0 auto;
  z-index: 800;
  text-align: center;
}

.trip-summary h3 { margin-bottom: 12px; font-size: 18px; }

.summary-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.summary-stat { min-width: 70px; }
.summary-value { font-size: 16px; font-weight: 700; color: var(--text); }
.summary-label { font-size: 10px; text-transform: uppercase; color: var(--text-light); }

.summary-note {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 12px;
}

/* End trip confirmation */
.confirm-overlay {
  position: absolute;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.confirm-dialog { max-width: 320px; width: 100%; text-align: center; }
.confirm-dialog h3 { margin-bottom: 8px; }
.confirm-dialog p { font-size: 14px; color: var(--text-light); margin-bottom: 16px; }
.confirm-buttons { display: flex; flex-direction: column; gap: 8px; }

/* Map controls */
.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 800;
}

.control-btn {
  background: var(--card-bg);
  box-shadow: var(--shadow);
}

.filter-panel {
  margin-top: 8px;
  width: 240px;
}

.toggle-list { display: flex; flex-direction: column; gap: 8px; }
.toggle-item { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.toggle-item input { accent-color: var(--primary); }

.point-detail {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  max-width: 400px;
  z-index: 800;
}

@media (min-width: 768px) {
  .point-detail { left: auto; right: 16px; bottom: 16px; }
}

@media (max-width: 768px) {
  .gps-btn { bottom: 80px; }
  .trip-controls { bottom: 80px; }
  .trip-summary { bottom: 80px; }
  .stat-value { font-size: 16px; }
}
</style>
