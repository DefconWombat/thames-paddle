<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { accessPoints } from '../data/access-points.js';
import { db } from '../data/db.js';
import { parseGpx } from '../utils/gpx.js';
import { trackDistance, calculateMovingTime, formatDistance, formatDuration, formatSpeed } from '../utils/river.js';

const router = useRouter();

const equipment = ref('rigid');
const startPointId = ref('');
const endPointId = ref('');
const tripDate = ref(new Date().toISOString().slice(0, 10));
const startTime = ref('');
const endTime = ref('');
const notes = ref('');
const gpxFile = ref(null);
const gpxData = ref(null);
const gpxFileName = ref('');
const saving = ref(false);
const pauseEntries = ref([]);

const availablePoints = computed(() => {
  return accessPoints.filter(ap => {
    if (equipment.value === 'rigid') return ap.suitability.rigidHull;
    if (equipment.value === 'inflatable') return ap.suitability.inflatable;
    return true;
  }).sort((a, b) => a.riverMile - b.riverMile);
});

const startPoint = computed(() => accessPoints.find(p => p.id === startPointId.value));
const endPoint = computed(() => accessPoints.find(p => p.id === endPointId.value));

const tripDistance = computed(() => {
  if (gpxData.value?.points?.length > 1) {
    return trackDistance(gpxData.value.points);
  }
  if (startPoint.value && endPoint.value) {
    return Math.abs(endPoint.value.riverMile - startPoint.value.riverMile);
  }
  return 0;
});

const tripTiming = computed(() => {
  if (!startTime.value || !endTime.value) return null;

  const start = new Date(`${tripDate.value}T${startTime.value}`);
  const end = new Date(`${tripDate.value}T${endTime.value}`);
  let totalMs = end - start;
  if (totalMs < 0) totalMs += 24 * 3600000; // crossed midnight

  // Subtract pause time
  let pauseMs = 0;
  for (const p of pauseEntries.value) {
    if (p.pausedAt && p.resumedAt) {
      const pd = new Date(`${tripDate.value}T${p.pausedAt}`);
      const rd = new Date(`${tripDate.value}T${p.resumedAt}`);
      pauseMs += rd - pd;
    }
  }

  const movingMs = totalMs - pauseMs;
  const movingHours = movingMs / 3600000;
  const avgSpeed = movingHours > 0 ? tripDistance.value / movingHours : 0;

  return { totalMs, movingMs, pauseMs, avgSpeed };
});

function handleGpxUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  gpxFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      gpxData.value = parseGpx(e.target.result);
    } catch (err) {
      alert('Error reading GPX file: ' + err.message);
      gpxData.value = null;
    }
  };
  reader.readAsText(file);
}

function addPause() {
  pauseEntries.value.push({ pausedAt: '', resumedAt: '' });
}

function removePause(index) {
  pauseEntries.value.splice(index, 1);
}

async function saveTrip() {
  if (!startPointId.value || !endPointId.value) {
    alert('Please select start and end points.');
    return;
  }

  saving.value = true;

  try {
    const trip = {
      date: tripDate.value,
      startPointId: startPointId.value,
      endPointId: endPointId.value,
      equipmentType: equipment.value,
      status: 'completed',
      startTime: startTime.value ? `${tripDate.value}T${startTime.value}` : null,
      endTime: endTime.value ? `${tripDate.value}T${endTime.value}` : null,
      pauseLog: pauseEntries.value.filter(p => p.pausedAt && p.resumedAt).map(p => ({
        pausedAt: `${tripDate.value}T${p.pausedAt}`,
        resumedAt: `${tripDate.value}T${p.resumedAt}`
      })),
      movingTimeMs: tripTiming.value?.movingMs || null,
      totalTimeMs: tripTiming.value?.totalMs || null,
      plannedDistanceMiles: Math.abs(
        (endPoint.value?.riverMile || 0) - (startPoint.value?.riverMile || 0)
      ),
      actualDistanceMiles: tripDistance.value || null,
      avgSpeedMph: tripTiming.value?.avgSpeed || null,
      maxSpeedMph: null,
      recordedTrack: gpxData.value?.points || [],
      recordingSource: gpxData.value ? 'gpx_import' : 'manual',
      notes: notes.value,
      conditions: {}
    };

    const id = await db.trips.add(trip);
    router.push(`/trip/${id}`);
  } catch (err) {
    alert('Error saving trip: ' + err.message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="log-view">
    <div class="log-container">
      <div class="log-header">
        <button class="btn btn-sm btn-outline" @click="router.push('/history')">← Back to History</button>
        <h2>Add Trip</h2>
      </div>

      <div class="form-group">
        <label class="form-label">Equipment Used</label>
        <div class="eq-toggle">
          <button class="eq-btn" :class="{ active: equipment === 'rigid' }" @click="equipment = 'rigid'">🚣 Rigid</button>
          <button class="eq-btn" :class="{ active: equipment === 'inflatable' }" @click="equipment = 'inflatable'">🎈 Inflatable</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" v-model="tripDate" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start Point</label>
          <select class="form-select" v-model="startPointId">
            <option value="">Choose...</option>
            <option v-for="ap in availablePoints" :key="ap.id" :value="ap.id">
              {{ ap.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">End Point</label>
          <select class="form-select" v-model="endPointId">
            <option value="">Choose...</option>
            <option v-for="ap in availablePoints" :key="ap.id" :value="ap.id">
              {{ ap.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start Time</label>
          <input type="time" class="form-input" v-model="startTime" />
        </div>
        <div class="form-group">
          <label class="form-label">End Time</label>
          <input type="time" class="form-input" v-model="endTime" />
        </div>
      </div>

      <!-- Pauses -->
      <div class="form-group">
        <label class="form-label">Breaks / Pauses</label>
        <div v-for="(pause, i) in pauseEntries" :key="i" class="pause-row">
          <input type="time" class="form-input" v-model="pause.pausedAt" placeholder="Paused" />
          <span>to</span>
          <input type="time" class="form-input" v-model="pause.resumedAt" placeholder="Resumed" />
          <button class="btn btn-sm btn-outline" @click="removePause(i)">✕</button>
        </div>
        <button class="btn btn-sm btn-outline" @click="addPause" style="margin-top:8px">
          + Add a break
        </button>
      </div>

      <!-- GPX import -->
      <div class="form-group">
        <label class="form-label">Import GPS Track (optional)</label>
        <div class="gpx-upload">
          <input
            type="file"
            accept=".gpx"
            @change="handleGpxUpload"
            id="gpx-input"
            style="display:none"
          />
          <label for="gpx-input" class="btn btn-sm btn-outline" style="cursor:pointer">
            📂 Choose GPX file
          </label>
          <span v-if="gpxFileName" class="gpx-name">{{ gpxFileName }}</span>
        </div>
        <div v-if="gpxData" class="gpx-info">
          ✅ {{ gpxData.totalPoints }} track points loaded
          <span v-if="tripDistance"> · {{ formatDistance(tripDistance) }}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" v-model="notes" placeholder="Weather, conditions, highlights, wildlife spotted..."></textarea>
      </div>

      <!-- Trip summary preview -->
      <div v-if="tripDistance > 0 || tripTiming" class="trip-preview card">
        <div class="card-header">Trip Summary</div>
        <div class="stats-grid">
          <div class="stat-tile" v-if="tripDistance > 0">
            <div class="stat-value">{{ tripDistance.toFixed(1) }}</div>
            <div class="stat-label">Miles</div>
          </div>
          <div class="stat-tile" v-if="tripTiming">
            <div class="stat-value">{{ formatDuration(tripTiming.totalMs) }}</div>
            <div class="stat-label">Total Time</div>
          </div>
          <div class="stat-tile" v-if="tripTiming && tripTiming.pauseMs > 0">
            <div class="stat-value">{{ formatDuration(tripTiming.movingMs) }}</div>
            <div class="stat-label">Moving Time</div>
          </div>
          <div class="stat-tile" v-if="tripTiming?.avgSpeed">
            <div class="stat-value">{{ formatSpeed(tripTiming.avgSpeed) }}</div>
            <div class="stat-label">Avg Speed</div>
          </div>
        </div>
      </div>

      <button
        class="btn btn-primary"
        style="width:100%;margin-top:20px"
        @click="saveTrip"
        :disabled="saving"
      >
        {{ saving ? 'Saving...' : '💾 Save Trip' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.log-view {
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.log-container {
  max-width: 600px;
  margin: 0 auto;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.log-header h2 {
  margin: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.pause-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pause-row .form-input {
  width: auto;
  flex: 1;
}

.pause-row span {
  font-size: 13px;
  color: var(--text-light);
}

.gpx-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gpx-name {
  font-size: 13px;
  color: var(--text-light);
}

.gpx-info {
  margin-top: 8px;
  font-size: 13px;
  color: var(--success);
}

.trip-preview {
  margin-top: 16px;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
