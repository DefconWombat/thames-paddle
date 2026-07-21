<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ThamesMap from '../components/ThamesMap.vue';
import { useGps } from '../composables/useGps.js';
import { useTripRecorder } from '../composables/useTripRecorder.js';
import { useUnits } from '../composables/useUnits.js';
import { useShare } from '../composables/useShare.js';
import { locks } from '../data/thames-locks.js';
import { accessPoints } from '../data/access-points.js';
import { db } from '../data/db.js';
import { nearestRoutePoint } from '../utils/river.js';
import { extractExifGps } from '../utils/exif.js';

const equipment = ref('all');
const tripEquipment = ref('rigid'); // equipment for trip recording
const showLocks = ref(true);
const showAccess = ref(true);
const showPubs = ref(true);
const showCamps = ref(true);
const showParking = ref(true);
const showFilters = ref(false);
const selectedPoint = ref(null);
const showEndConfirm = ref(false);
const showStartDialog = ref(false);
const thamesMapRef = ref(null);
const viewMode = ref('map'); // 'map' | 'dashboard'
const destinationId = ref(null); // access point ID for destination
const savedRoutes = ref([]);

// Share menu
const shareMenuOpen = ref(false);

// Share map point pick mode
const sharePickMode = ref(false);

// Safety check-in
const checkinEnabled = ref(false);
const checkinDuration = ref(120); // minutes
const checkinTime = ref(null); // timestamp deadline
const checkinDisplay = ref({ status: '', countdown: '', statusClass: 'ok', dueStr: '' });
let checkinInterval = null;

// Camera
const cameraInput = ref(null);

// GPS tracking
const gps = useGps();

// Trip recording
const recorder = useTripRecorder();

// Units
const { units, toggleUnits, formatDist, formatDistShort, formatSpd } = useUnits();

// Share
const share = useShare();

const mapRoute = useRoute();

// Auto-start GPS when map opens
onMounted(() => {
  if (!gps.tracking.value) {
    gps.startTracking();
    gps.followMode.value = false;
  }
  checkinInterval = setInterval(updateCheckinDisplay, 1000);

  // Handle startTrip query param from PlanView
  if (mapRoute.query.startTrip === 'true') {
    if (mapRoute.query.equipment) {
      tripEquipment.value = mapRoute.query.equipment;
      equipment.value = mapRoute.query.equipment;
    }
    if (mapRoute.query.destination) {
      destinationId.value = mapRoute.query.destination;
    }
    // Show the start dialog so user can confirm
    showStartDialog.value = true;
  }
});

onUnmounted(() => {
  if (checkinInterval) clearInterval(checkinInterval);
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

// Compass heading helper
function compassDirection(deg) {
  if (deg == null) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

// Is trip active?
const isRecording = computed(() =>
  recorder.status.value === 'recording' || recorder.status.value === 'paused'
);

// Next lock downstream from current position
const nextLock = computed(() => {
  if (gps.riverMile.value == null) return null;
  const mile = gps.riverMile.value;
  let best = null;
  for (const lock of locks) {
    if (lock.riverMile > mile) {
      if (!best || lock.riverMile < best.riverMile) {
        best = lock;
      }
    }
  }
  if (!best) return null;
  return {
    ...best,
    distanceMiles: best.riverMile - mile
  };
});

// Distance to destination access point
const distToDestination = computed(() => {
  if (!destinationId.value || gps.riverMile.value == null) return null;
  const dest = accessPoints.find(a => a.id === destinationId.value);
  if (!dest) return null;
  const remaining = dest.riverMile - gps.riverMile.value;
  return {
    name: dest.name,
    distanceMiles: remaining,
    riverMile: dest.riverMile,
    lat: dest.lat,
    lng: dest.lng
  };
});

// ETA to destination
const etaToDestination = computed(() => {
  if (!distToDestination.value || !recorder.stats.value.avgSpeed) return null;
  const hours = distToDestination.value.distanceMiles / recorder.stats.value.avgSpeed;
  if (hours <= 0 || !isFinite(hours)) return null;
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
});

// Nearest landmark (access point or lock)
const nearestLandmark = computed(() => {
  if (gps.riverMile.value == null) return null;
  const mile = gps.riverMile.value;
  let best = null;
  let bestDist = Infinity;

  for (const ap of accessPoints) {
    const d = Math.abs(ap.riverMile - mile);
    if (d < bestDist) { bestDist = d; best = { name: ap.name, dist: d, type: 'access' }; }
  }
  for (const lk of locks) {
    const d = Math.abs(lk.riverMile - mile);
    if (d < bestDist) { bestDist = d; best = { name: lk.name, dist: d, type: 'lock' }; }
  }
  return best;
});

// Destination POI object
const destinationPoi = computed(() => {
  if (!destinationId.value) return null;
  return accessPoints.find(a => a.id === destinationId.value) || null;
});

// ======= Share menu =======
function toggleShareMenu() {
  shareMenuOpen.value = !shareMenuOpen.value;
}

function closeShareMenu() {
  shareMenuOpen.value = false;
}

function handleShareCurrent() {
  closeShareMenu();
  share.shareCurrentLocation(
    gps.position.value,
    nearestLandmark.value?.name,
    gps.riverMile.value
  );
}

function handleSharePickup() {
  closeShareMenu();
  share.sharePickupPoint(
    destinationPoi.value,
    gps.riverMile.value,
    recorder.stats.value.avgSpeed
  );
}

function handleShareMapPoint() {
  closeShareMenu();
  sharePickMode.value = true;
  // ThamesMap will emit 'map-click' events
}

function handleShareCheckinUpdate() {
  closeShareMenu();
  share.shareCheckinUpdate(
    gps.position.value,
    nearestLandmark.value?.name,
    checkinTime.value
  );
}

// Map pick for sharing
function onMapClick(e) {
  if (!sharePickMode.value) return;
  const { lat, lng } = e;
  const snap = nearestRoutePoint(lat, lng);
  const snapMile = snap.point[2]; // river mile from route point

  // Find nearest POI to this river mile
  let nearPoi = null;
  let nearDist = Infinity;
  for (const ap of accessPoints) {
    const d = Math.abs(ap.riverMile - snapMile);
    if (d < nearDist) { nearDist = d; nearPoi = ap; }
  }
  for (const lk of locks) {
    const d = Math.abs(lk.riverMile - snapMile);
    if (d < nearDist) { nearDist = d; nearPoi = lk; }
  }
  const nearText = (nearPoi && nearDist < 2) ? nearPoi.name : `Mile ${snapMile.toFixed(1)}`;

  // Calculate ETA if trip is running
  let etaText = '';
  if (isRecording.value && recorder.stats.value.avgSpeed > 0 && gps.riverMile.value != null) {
    const dist = Math.abs(snapMile - gps.riverMile.value);
    if (dist > 0.1) {
      const mins = Math.round((dist / recorder.stats.value.avgSpeed) * 60);
      etaText = mins < 60 ? ` (approx ${mins} min away)` : ` (approx ${Math.floor(mins / 60)}h ${mins % 60}m away)`;
    }
  }

  share.shareMapPoint(lat, lng, nearText, etaText);
  sharePickMode.value = false;
}

function cancelSharePick() {
  sharePickMode.value = false;
}

// ======= Safety Check-in =======
function updateCheckinDisplay() {
  if (!checkinTime.value || recorder.status.value === 'idle') {
    checkinDisplay.value = { status: '', countdown: '', statusClass: 'ok', dueStr: '' };
    return;
  }
  const remaining = checkinTime.value - Date.now();
  const dueTime = new Date(checkinTime.value);
  const dueStr = dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (remaining <= 0) {
    const overMins = Math.round(-remaining / 60000);
    checkinDisplay.value = {
      status: 'OVERDUE',
      countdown: `${overMins} min overdue`,
      statusClass: 'overdue',
      dueStr
    };
  } else if (remaining < 900000) {
    const mins = Math.ceil(remaining / 60000);
    checkinDisplay.value = {
      status: 'Finishing soon',
      countdown: `${mins} min left`,
      statusClass: 'warn',
      dueStr
    };
  } else {
    const mins = Math.round(remaining / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    checkinDisplay.value = {
      status: 'On track',
      countdown: h > 0 ? `${h}h ${m}m left` : `${m} min left`,
      statusClass: 'ok',
      dueStr
    };
  }
}

function handleShareCheckinSetup() {
  share.shareCheckin(
    gps.position.value,
    nearestLandmark.value?.name,
    destinationPoi.value,
    checkinTime.value || (Date.now() + checkinDuration.value * 60000)
  );
}

// ======= Camera =======
function openCamera() {
  cameraInput.value?.click();
}

async function handleCameraCapture(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const exifGps = extractExifGps(dataUrl);

    const photoLat = exifGps ? exifGps.lat : (gps.position.value?.lat || null);
    const photoLng = exifGps ? exifGps.lng : (gps.position.value?.lng || null);

    let riverMile = null;
    if (photoLat && photoLng) {
      const snap = nearestRoutePoint(photoLat, photoLng);
      if (snap.distanceFromRiver < 2) riverMile = snap.point[2];
    }

    // Save to IndexedDB
    await db.photos.add({
      tripId: recorder.tripId.value,
      timestamp: Date.now(),
      dataUrl,
      name: file.name,
      lat: photoLat,
      lng: photoLng,
      hasGps: !!(exifGps || gps.position.value),
      riverMile
    });

    share.showToast('📷 Photo saved to trip log');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// Trip controls
async function showStart() {
  // Load saved routes for the start dialog
  try {
    savedRoutes.value = await db.savedRoutes.toArray();
  } catch (e) { savedRoutes.value = []; }
  showStartDialog.value = true;
}

async function handleStartTrip() {
  showStartDialog.value = false;
  if (!gps.tracking.value) {
    gps.startTracking();
  }
  gps.followMode.value = true;

  // Sync map equipment filter with trip equipment
  equipment.value = tripEquipment.value;

  // Set up check-in if enabled
  if (checkinEnabled.value) {
    checkinTime.value = Date.now() + checkinDuration.value * 60000;
  } else {
    checkinTime.value = null;
  }

  await recorder.startTrip({ equipment: tripEquipment.value });
}

function handleStartOpenPaddle() {
  destinationId.value = null;
  handleStartTrip();
}

function handleStartFromSaved(route) {
  // Use the last stop as destination
  if (route.stops?.length >= 2) {
    destinationId.value = route.stops[route.stops.length - 1];
    tripEquipment.value = route.equipment || tripEquipment.value;
  }
  handleStartTrip();
}

function getRouteName(route) {
  if (route.name) return route.name;
  const stops = (route.stops || []).map(id => accessPoints.find(a => a.id === id));
  if (stops.length >= 2 && stops[0] && stops[stops.length - 1]) {
    return `${stops[0].name} → ${stops[stops.length - 1].name}`;
  }
  return 'Saved Route';
}

function getRouteDist(route) {
  const stops = (route.stops || []).map(id => accessPoints.find(a => a.id === id)).filter(Boolean);
  if (stops.length >= 2) {
    return Math.abs(stops[stops.length - 1].riverMile - stops[0].riverMile).toFixed(1);
  }
  return null;
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
  checkinTime.value = null;
  setTimeout(() => {
    gps.followMode.value = false;
  }, 2000);
}

async function handleDiscardTrip() {
  showEndConfirm.value = false;
  await recorder.discardTrip();
  checkinTime.value = null;
}

function handleDismissFinished() {
  recorder.resetState();
  viewMode.value = 'map';
}
</script>

<template>
  <div class="map-view" @click="shareMenuOpen && closeShareMenu()">
    <!-- Map view -->
    <div v-show="viewMode === 'map'" class="map-layer">
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
        :sharePickMode="sharePickMode"
        height="100%"
        @point-click="onPointClick"
        @user-pan="onUserPan"
        @map-click="onMapClick"
      />
    </div>

    <!-- Share pick banner -->
    <div v-if="sharePickMode" class="map-pick-banner">
      📌 Tap a point to share
      <button class="btn" @click="cancelSharePick">Cancel</button>
    </div>

    <!-- Dashboard view -->
    <div v-if="viewMode === 'dashboard'" class="dashboard-layer">
      <div class="dash-content">
        <!-- Big speed display -->
        <div class="dash-hero">
          <div class="dash-speed-value">
            {{ formatSpd(recorder.status.value !== 'idle' ? recorder.stats.value.currentSpeed : (gps.position.value?.speed || 0)) }}
          </div>
          <div class="dash-speed-label">Current Speed</div>
        </div>

        <!-- Compass tile -->
        <div v-if="gps.position.value" class="dash-compass-tile">
          <div class="compass-rose" :style="{ transform: `rotate(${gps.position.value.heading || 0}deg)` }">↑</div>
          <div class="compass-info">
            <div class="compass-heading">{{ compassDirection(gps.position.value.heading) }}</div>
            <div v-if="gps.position.value.heading != null" class="compass-degrees">{{ Math.round(gps.position.value.heading) }}°</div>
          </div>
        </div>

        <!-- Stats grid -->
        <div class="dash-grid">
          <div class="dash-tile">
            <div class="dash-tile-value">{{ recorder.status.value !== 'idle' ? recorder.stats.value.elapsedFormatted : '—' }}</div>
            <div class="dash-tile-label">Time</div>
          </div>
          <div class="dash-tile">
            <div class="dash-tile-value">{{ recorder.status.value !== 'idle' ? formatDist(recorder.stats.value.distance) : '—' }}</div>
            <div class="dash-tile-label">Distance</div>
          </div>
          <div class="dash-tile">
            <div class="dash-tile-value">{{ recorder.status.value !== 'idle' ? formatSpd(recorder.stats.value.avgSpeed) : '—' }}</div>
            <div class="dash-tile-label">Avg Speed</div>
          </div>
          <div class="dash-tile">
            <div class="dash-tile-value">{{ recorder.status.value !== 'idle' ? formatSpd(recorder.stats.value.maxSpeed) : '—' }}</div>
            <div class="dash-tile-label">Top Speed</div>
          </div>
        </div>

        <!-- Safety check-in display -->
        <div v-if="checkinTime && isRecording" class="dash-checkin">
          <div class="dash-checkin-header">
            <span class="dash-checkin-label">🛟 Safety Check-in</span>
            <span :class="['dash-checkin-status', checkinDisplay.statusClass]">{{ checkinDisplay.status }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span class="dash-checkin-time">{{ checkinDisplay.countdown }}</span>
            <span style="font-size:12px;color:var(--text-light)">due by {{ checkinDisplay.dueStr }}</span>
          </div>
        </div>

        <!-- Navigation info -->
        <div class="dash-section">
          <div class="dash-row" v-if="nextLock">
            <span class="dash-row-label">🔒 Next Lock</span>
            <span class="dash-row-value">{{ nextLock.name }} <span class="dash-row-sub">({{ formatDistShort(nextLock.distanceMiles) }})</span></span>
          </div>
          <div class="dash-row" v-if="nearestLandmark">
            <span class="dash-row-label">📍 Near</span>
            <span class="dash-row-value">{{ nearestLandmark.name }}</span>
          </div>
          <div class="dash-row" v-if="distToDestination">
            <span class="dash-row-label">🏁 To {{ distToDestination.name }}</span>
            <span class="dash-row-value">
              {{ formatDist(distToDestination.distanceMiles) }}
              <span v-if="etaToDestination" class="dash-row-sub">(ETA {{ etaToDestination }})</span>
            </span>
          </div>
          <div class="dash-row" v-if="gps.position.value?.accuracy">
            <span class="dash-row-label">📡 GPS Accuracy</span>
            <span class="dash-row-value">±{{ Math.round(gps.position.value.accuracy) }}m</span>
          </div>
        </div>

        <!-- Unit toggle -->
        <div class="dash-footer">
          <button class="unit-toggle" @click="toggleUnits">
            {{ units === 'imperial' ? 'mi / mph' : 'km / km/h' }}
          </button>
          <span v-if="recorder.status.value === 'paused'" class="dash-paused">⏸ PAUSED</span>
        </div>
      </div>
    </div>

    <!-- View toggle button (map ↔ dashboard) -->
    <button
      v-if="recorder.status.value === 'recording' || recorder.status.value === 'paused' || (gps.tracking.value && gps.position.value)"
      class="view-toggle-btn"
      @click="viewMode = viewMode === 'map' ? 'dashboard' : 'map'"
      :title="viewMode === 'map' ? 'Show dashboard' : 'Show map'"
    >
      <span v-if="viewMode === 'map'">📊</span>
      <span v-else>🗺️</span>
    </button>

    <!-- Re-centre / GPS button (map view only) -->
    <button
      v-if="viewMode === 'map' && gps.tracking.value && gps.position.value"
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

    <!-- Camera button (visible during recording) -->
    <button
      v-if="viewMode === 'map' && isRecording"
      class="camera-btn"
      @click="openCamera"
      title="Take photo"
    >📷</button>
    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      style="display:none"
      @change="handleCameraCapture"
    />

    <!-- Share button -->
    <button
      v-if="viewMode === 'map' && gps.tracking.value && gps.position.value"
      class="share-btn"
      @click.stop="toggleShareMenu"
      title="Share location"
    >📤</button>

    <!-- Share menu -->
    <div v-if="shareMenuOpen" class="share-menu" @click.stop>
      <button class="share-menu-item" @click="handleShareCurrent">
        <span class="smi-icon">📍</span> Share my location
      </button>
      <button v-if="isRecording && destinationId" class="share-menu-item" @click="handleSharePickup">
        <span class="smi-icon">🏁</span> Share pickup point
      </button>
      <button class="share-menu-item" @click="handleShareMapPoint">
        <span class="smi-icon">📌</span> Share a map point
      </button>
      <button v-if="isRecording && checkinTime" class="share-menu-item" @click="handleShareCheckinUpdate">
        <span class="smi-icon">🛟</span> Share check-in update
      </button>
    </div>

    <!-- GPS info strip (when tracking but not recording a trip) -->
    <div v-if="viewMode === 'map' && gps.tracking.value && gps.position.value && recorder.status.value === 'idle'" class="gps-info">
      <span v-if="nearestLandmark" class="gps-info-item">
        📍 Near {{ nearestLandmark.name }}
      </span>
      <span v-if="gps.position.value.speed != null && gps.position.value.speed > 0.5" class="gps-info-item">
        {{ formatSpd(gps.position.value.speed) }}
      </span>
      <span v-if="nextLock" class="gps-info-item">
        🔒 {{ nextLock.name }} ({{ formatDistShort(nextLock.distanceMiles) }})
      </span>
    </div>

    <!-- GPS error -->
    <div v-if="gps.error.value" class="gps-error">
      {{ gps.error.value }}
    </div>

    <!-- Trip controls -->
    <div v-if="!sharePickMode" class="trip-controls">
      <!-- Start button (when idle and GPS is on) -->
      <button
        v-if="recorder.status.value === 'idle' && gps.tracking.value && gps.position.value"
        class="trip-btn trip-start"
        @click="showStart"
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

    <!-- Live stats bar on map view (during recording or paused) -->
    <div v-if="viewMode === 'map' && isRecording" class="live-stats">
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
        <span v-if="nextLock" class="stat-mile">
          🔒 {{ nextLock.name }} {{ formatDistShort(nextLock.distanceMiles) }}
        </span>
        <span v-else-if="nearestLandmark" class="stat-mile">
          📍 {{ nearestLandmark.name }}
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
          <div class="summary-label">Top speed</div>
        </div>
      </div>
      <p class="summary-note">Trip saved to your history.</p>
      <button class="btn btn-primary" @click="handleDismissFinished">Done</button>
    </div>

    <!-- Start trip dialog -->
    <div v-if="showStartDialog" class="confirm-overlay">
      <div class="confirm-dialog card" style="max-width:360px">
        <h3>Start Trip</h3>

        <!-- Equipment selector -->
        <div class="form-group">
          <label class="form-label">Equipment</label>
          <div class="equipment-toggle">
            <button class="equipment-btn" :class="{ active: tripEquipment === 'rigid' }" @click="tripEquipment = 'rigid'">
              <span class="eq-icon">🚣</span><span class="eq-label">Rigid</span>
            </button>
            <button class="equipment-btn" :class="{ active: tripEquipment === 'inflatable' }" @click="tripEquipment = 'inflatable'">
              <span class="eq-icon">🎈</span><span class="eq-label">Inflatable</span>
            </button>
          </div>
        </div>

        <!-- Destination -->
        <div class="form-group">
          <label class="form-label">Destination (optional)</label>
          <select v-model="destinationId" class="form-select">
            <option :value="null">No destination set</option>
            <option v-for="ap in accessPoints" :key="ap.id" :value="ap.id">
              {{ ap.name }}
            </option>
          </select>
        </div>

        <!-- Saved routes -->
        <div v-if="savedRoutes.length" class="start-saved-routes">
          <label class="form-label">Saved Routes</label>
          <div class="saved-routes-list">
            <div v-for="route in savedRoutes" :key="route.id" class="saved-route-item" @click="handleStartFromSaved(route)">
              <div class="saved-route-icon">📍</div>
              <div class="saved-route-info">
                <div class="saved-route-name">{{ getRouteName(route) }}</div>
                <div class="saved-route-detail">
                  <span v-if="getRouteDist(route)">{{ getRouteDist(route) }} mi</span>
                  <span v-if="route.stops">· {{ route.stops.length - 2 > 0 ? (route.stops.length - 2) + ' stop' + (route.stops.length - 2 > 1 ? 's' : '') : '' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Safety check-in -->
        <div class="checkin-row">
          <label class="checkin-toggle">
            <input type="checkbox" v-model="checkinEnabled" />
            <span>🛟 Safety check-in</span>
          </label>
          <div v-if="checkinEnabled" class="checkin-fields">
            <div class="checkin-time-row">
              <select v-model.number="checkinDuration" class="form-select">
                <option :value="30">30 min</option>
                <option :value="60">1 hour</option>
                <option :value="90">1.5 hours</option>
                <option :value="120">2 hours</option>
                <option :value="180">3 hours</option>
                <option :value="240">4 hours</option>
                <option :value="360">6 hours</option>
                <option :value="480">8 hours</option>
              </select>
            </div>
            <button class="checkin-share-btn" @click="handleShareCheckinSetup">📤 Share check-in with contact</button>
          </div>
        </div>

        <div class="confirm-buttons">
          <button class="btn btn-primary" style="background:var(--success)" @click="handleStartTrip">▶ Start with Destination</button>
          <button class="btn btn-primary" style="background:var(--primary)" @click="handleStartOpenPaddle">🛶 Open Paddle</button>
          <button class="btn btn-outline" @click="showStartDialog = false">Cancel</button>
        </div>
      </div>
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

    <!-- Filter controls — bottom-right -->
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
            <label class="toggle-item"><input type="checkbox" v-model="showPubs" /><span>🍺 Pubs & Cafes</span></label>
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
      <div class="popup-detail" v-if="selectedPoint.notes">{{ selectedPoint.notes }}</div>
      <div v-if="selectedPoint.hazard" class="popup-detail" style="color:var(--danger);font-weight:600">
        ⚠️ {{ selectedPoint.hazard }}
      </div>
    </div>

    <!-- Toast notifications -->
    <div v-if="share.toastVisible.value" class="toast">
      {{ share.toastMessage.value }}
    </div>
  </div>
</template>

<style scoped>
.map-view {
  position: relative;
  height: 100%;
}

.map-layer {
  height: 100%;
}

/* ===== Map pick banner ===== */
.map-pick-banner {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  background: var(--primary);
  color: #fff;
  padding: 10px 20px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  gap: 10px;
  align-items: center;
  white-space: nowrap;
}

.map-pick-banner .btn {
  padding: 5px 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

/* ===== Dashboard ===== */
.dashboard-layer {
  height: 100%;
  background: var(--bg);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.dash-content {
  padding: 16px;
  max-width: 420px;
  margin: 0 auto;
}

.dash-hero {
  text-align: center;
  padding: 24px 0 20px;
}

.dash-speed-value {
  font-size: 56px;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
  letter-spacing: -1px;
}

.dash-speed-label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-light);
  margin-top: 4px;
  font-weight: 600;
}

/* ===== Compass tile ===== */
.dash-compass-tile {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.compass-rose {
  font-size: 36px;
  font-weight: 800;
  color: var(--primary);
  transition: transform 0.3s ease;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: 50%;
}

.compass-info { flex: 1; }

.compass-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.compass-degrees {
  font-size: 13px;
  color: var(--text-light);
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.dash-tile {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px 12px;
  text-align: center;
}

.dash-tile-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.dash-tile-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-light);
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

/* ===== Safety check-in (dashboard) ===== */
.dash-checkin {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 10px 14px;
  margin-bottom: 12px;
}

.dash-checkin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.dash-checkin-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-light);
  letter-spacing: 0.3px;
}

.dash-checkin-time {
  font-size: 18px;
  font-weight: 700;
}

.dash-checkin-status {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.dash-checkin-status.ok { background: var(--success-light, #e8f5e9); color: var(--success); }
.dash-checkin-status.warn { background: #fff3cd; color: #856404; }
.dash-checkin-status.overdue { background: var(--danger-light, #fde8e5); color: var(--danger); animation: blink 1s ease-in-out infinite; }

.dash-section {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 12px;
  overflow: hidden;
}

.dash-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.dash-row:last-child {
  border-bottom: none;
}

.dash-row-label {
  font-size: 13px;
  color: var(--text-light);
  font-weight: 500;
}

.dash-row-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  text-align: right;
}

.dash-row-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-light);
}

.dash-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 16px;
}

.dash-paused {
  font-size: 14px;
  font-weight: 700;
  color: #f39c12;
  animation: blink 1.5s ease-in-out infinite;
}

/* ===== View toggle button ===== */
.view-toggle-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 800;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  box-shadow: var(--shadow-lg);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.view-toggle-btn:active {
  transform: scale(0.92);
}

/* ===== GPS locate / recentre button ===== */
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

/* ===== Camera button ===== */
.camera-btn {
  position: absolute;
  bottom: 108px;
  right: max(10px, env(safe-area-inset-right, 0));
  z-index: 800;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  box-shadow: var(--shadow-lg);
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.camera-btn:active { transform: scale(0.9); }

/* ===== Share button & menu ===== */
.share-btn {
  position: absolute;
  bottom: 60px;
  right: max(10px, env(safe-area-inset-right, 0));
  z-index: 800;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  box-shadow: var(--shadow-lg);
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.share-menu {
  position: absolute;
  bottom: 106px;
  right: max(10px, env(safe-area-inset-right, 0));
  z-index: 810;
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  min-width: 180px;
}

.share-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
}

.share-menu-item:active { background: var(--bg); }
.smi-icon { font-size: 16px; flex-shrink: 0; }

/* ===== GPS info strip ===== */
.gps-info {
  position: absolute;
  top: 64px;
  left: 12px;
  z-index: 800;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  max-width: 75%;
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
  left: 60px;
  right: 12px;
  z-index: 800;
  background: var(--danger-light, #fde8e5);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  text-align: center;
}

/* ===== Trip controls ===== */
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

/* ===== Live stats panel ===== */
.live-stats {
  position: absolute;
  top: 12px;
  left: 60px;
  right: 60px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
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
  flex-shrink: 0;
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

/* ===== Trip finished summary ===== */
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

/* ===== Dialogs ===== */
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
.confirm-dialog h3 { margin-bottom: 12px; }
.confirm-dialog p { font-size: 14px; color: var(--text-light); margin-bottom: 16px; }
.confirm-buttons { display: flex; flex-direction: column; gap: 8px; }

.confirm-dialog .form-group {
  text-align: left;
  margin-bottom: 16px;
}

/* ===== Start dialog equipment & saved routes ===== */
.start-saved-routes {
  text-align: left;
  margin-bottom: 12px;
}

.saved-routes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.saved-route-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  cursor: pointer;
  border: 1px solid var(--border);
  transition: background 0.15s;
}

.saved-route-item:hover {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.saved-route-item:hover .saved-route-detail {
  color: rgba(255,255,255,0.8);
}

.saved-route-icon { font-size: 16px; flex-shrink: 0; }
.saved-route-info { flex: 1; min-width: 0; }
.saved-route-name { font-size: 13px; font-weight: 600; }
.saved-route-detail { font-size: 11px; color: var(--text-light); }

/* ===== Check-in in start dialog ===== */
.checkin-row {
  text-align: left;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  margin-bottom: 16px;
}

.checkin-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 8px;
}

.checkin-toggle input { accent-color: var(--primary); }

.checkin-fields { margin-top: 6px; }

.checkin-time-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.checkin-share-btn {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: var(--radius);
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 6px;
}

/* ===== Map controls (Filters) — bottom-right ===== */
.map-controls {
  position: absolute;
  bottom: 24px;
  right: 12px;
  z-index: 800;
}

.control-btn {
  background: var(--card-bg);
  box-shadow: var(--shadow);
}

.filter-panel {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  width: 240px;
}

.toggle-list { display: flex; flex-direction: column; gap: 8px; }
.toggle-item { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.toggle-item input { accent-color: var(--primary); }

.point-detail {
  position: absolute;
  bottom: 80px;
  left: 16px;
  right: 16px;
  max-width: 400px;
  z-index: 800;
}

/* ===== Toast ===== */
.toast {
  position: absolute;
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

@media (min-width: 768px) {
  .point-detail { left: auto; right: 16px; bottom: 16px; }
}

@media (max-width: 768px) {
  .gps-btn { bottom: 80px; }
  .trip-controls { bottom: 80px; }
  .trip-summary { bottom: 80px; }
  .map-controls { bottom: 80px; }
  .stat-value { font-size: 16px; }
  .gps-info { top: 64px; }
  .share-btn { bottom: 140px; }
  .camera-btn { bottom: 188px; }
  .share-menu { bottom: 186px; }
  .toast { bottom: 160px; }

  .view-toggle-btn {
    top: auto;
    bottom: 80px;
    left: auto;
    right: 12px;
  }

  .dash-speed-value { font-size: 48px; }
}
</style>
