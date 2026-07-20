<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ThamesMap from '../components/ThamesMap.vue';
import { db } from '../data/db.js';
import { accessPoints } from '../data/access-points.js';
import { locks } from '../data/thames-locks.js';
import { formatDistance, formatDuration, formatSpeed } from '../utils/river.js';
import { generateGpx } from '../utils/gpx.js';

const props = defineProps({
  id: { type: [String, Number], required: true }
});

const router = useRouter();
const trip = ref(null);

onMounted(async () => {
  trip.value = await db.trips.get(Number(props.id));
});

function getPointName(id) {
  return accessPoints.find(p => p.id === id)?.name || id;
}

function getPoint(id) {
  return accessPoints.find(p => p.id === id);
}

const startPoint = computed(() => getPoint(trip.value?.startPointId));
const endPoint = computed(() => getPoint(trip.value?.endPointId));

const routeLocks = computed(() => {
  if (!startPoint.value || !endPoint.value) return [];
  const lo = Math.min(startPoint.value.riverMile, endPoint.value.riverMile);
  const hi = Math.max(startPoint.value.riverMile, endPoint.value.riverMile);
  return locks.filter(l => l.riverMile >= lo && l.riverMile <= hi);
});

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
    router.push('/history');
  }
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
        {{ trip.equipmentType === 'rigid' ? '🚣 Rigid Hull' : '🎈 Inflatable' }}
      </span>

      <div class="stats-grid" style="margin: 16px 0">
        <div class="stat-tile" v-if="trip.actualDistanceMiles">
          <div class="stat-value">{{ trip.actualDistanceMiles.toFixed(1) }}</div>
          <div class="stat-label">Miles</div>
        </div>
        <div class="stat-tile" v-if="trip.totalTimeMs">
          <div class="stat-value">{{ formatDuration(trip.totalTimeMs) }}</div>
          <div class="stat-label">Total Time</div>
        </div>
        <div class="stat-tile" v-if="trip.movingTimeMs && trip.movingTimeMs !== trip.totalTimeMs">
          <div class="stat-value">{{ formatDuration(trip.movingTimeMs) }}</div>
          <div class="stat-label">Moving Time</div>
        </div>
        <div class="stat-tile" v-if="trip.avgSpeedMph">
          <div class="stat-value">{{ trip.avgSpeedMph.toFixed(1) }}</div>
          <div class="stat-label">Avg MPH</div>
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

      <!-- Locks passed -->
      <div v-if="routeLocks.length" class="section">
        <h3>Locks ({{ routeLocks.length }})</h3>
        <ul class="poi-list">
          <li v-for="lock in routeLocks" :key="lock.id" class="poi-item">
            <span class="poi-icon lock">🔒</span>
            <div>
              <div class="poi-name">{{ lock.name }}</div>
              <div class="poi-detail">Portage: {{ lock.portage }} bank</div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Notes -->
      <div v-if="trip.notes" class="section">
        <h3>Notes</h3>
        <p class="trip-notes">{{ trip.notes }}</p>
      </div>

      <!-- Actions -->
      <div class="actions" style="margin-top:24px;display:flex;gap:8px">
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
  </div>

  <div v-else class="empty-state" style="height:100%;display:flex;align-items:center;justify-content:center">
    <div>Loading trip...</div>
  </div>
</template>

<style scoped>
.detail-view {
  display: flex;
  height: 100%;
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
