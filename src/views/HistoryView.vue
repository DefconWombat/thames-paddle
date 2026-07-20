<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '../data/db.js';
import { accessPoints } from '../data/access-points.js';
import { formatDistance, formatDuration, formatSpeed } from '../utils/river.js';

const router = useRouter();
const trips = ref([]);
const sortBy = ref('date');

onMounted(async () => {
  trips.value = await db.trips.orderBy('date').reverse().toArray();
});

function getPointName(id) {
  const point = accessPoints.find(p => p.id === id);
  return point?.name || id;
}

const stats = computed(() => {
  if (trips.value.length === 0) return null;

  const totalMiles = trips.value.reduce((sum, t) => sum + (t.actualDistanceMiles || 0), 0);
  const totalMovingMs = trips.value.reduce((sum, t) => sum + (t.movingTimeMs || 0), 0);
  const speeds = trips.value.filter(t => t.avgSpeedMph).map(t => t.avgSpeedMph);
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

  // Find personal bests
  const fastestTrip = trips.value.reduce((best, t) => {
    if (!t.avgSpeedMph) return best;
    if (!best || t.avgSpeedMph > best.avgSpeedMph) return t;
    return best;
  }, null);

  const longestTrip = trips.value.reduce((best, t) => {
    if (!t.actualDistanceMiles) return best;
    if (!best || t.actualDistanceMiles > best.actualDistanceMiles) return t;
    return best;
  }, null);

  return {
    totalTrips: trips.value.length,
    totalMiles,
    totalTime: totalMovingMs,
    avgSpeed,
    fastestTrip,
    longestTrip
  };
});

function goToTrip(id) {
  router.push(`/trip/${id}`);
}

async function deleteTrip(id, event) {
  event.stopPropagation();
  if (confirm('Delete this trip?')) {
    await db.trips.delete(id);
    trips.value = trips.value.filter(t => t.id !== id);
  }
}
</script>

<template>
  <div class="history-view">
    <div class="history-container">
      <h2>Trip History</h2>

      <!-- Overall stats -->
      <div v-if="stats" class="stats-grid" style="margin-bottom: 24px">
        <div class="stat-tile">
          <div class="stat-value">{{ stats.totalTrips }}</div>
          <div class="stat-label">Trips</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">{{ stats.totalMiles.toFixed(1) }}</div>
          <div class="stat-label">Total Miles</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">{{ formatDuration(stats.totalTime) }}</div>
          <div class="stat-label">Time on Water</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">{{ stats.avgSpeed.toFixed(1) }}</div>
          <div class="stat-label">Avg MPH</div>
        </div>
      </div>

      <!-- Personal bests -->
      <div v-if="stats?.fastestTrip || stats?.longestTrip" class="records-section">
        <h3 style="font-size:14px;margin-bottom:12px">🏆 Personal Bests</h3>
        <div class="stats-grid">
          <div v-if="stats.fastestTrip" class="stat-tile">
            <div class="stat-value" style="color:var(--accent)">{{ stats.fastestTrip.avgSpeedMph.toFixed(1) }} mph</div>
            <div class="stat-label">Fastest Avg Speed</div>
            <div class="stat-sub">{{ getPointName(stats.fastestTrip.startPointId) }} → {{ getPointName(stats.fastestTrip.endPointId) }}</div>
          </div>
          <div v-if="stats.longestTrip" class="stat-tile">
            <div class="stat-value" style="color:var(--accent)">{{ stats.longestTrip.actualDistanceMiles.toFixed(1) }} mi</div>
            <div class="stat-label">Longest Trip</div>
            <div class="stat-sub">{{ getPointName(stats.longestTrip.startPointId) }} → {{ getPointName(stats.longestTrip.endPointId) }}</div>
          </div>
        </div>
      </div>

      <!-- Trip list -->
      <div v-if="trips.length > 0" class="trips-list">
        <div
          v-for="trip in trips"
          :key="trip.id"
          class="trip-card"
          @click="goToTrip(trip.id)"
        >
          <div class="trip-card-header">
            <div>
              <div class="trip-date">{{ new Date(trip.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }}</div>
              <div class="trip-route">
                {{ getPointName(trip.startPointId) }} → {{ getPointName(trip.endPointId) }}
              </div>
            </div>
            <span class="badge" :class="trip.equipmentType === 'rigid' ? 'badge-rigid' : 'badge-inflatable'">
              {{ trip.equipmentType === 'rigid' ? '🚣 Rigid' : '🎈 Inflatable' }}
            </span>
          </div>
          <div class="trip-stats">
            <span v-if="trip.actualDistanceMiles">📏 {{ trip.actualDistanceMiles.toFixed(1) }} mi</span>
            <span v-if="trip.movingTimeMs">⏱️ {{ formatDuration(trip.movingTimeMs) }}</span>
            <span v-if="trip.avgSpeedMph">🏃 {{ trip.avgSpeedMph.toFixed(1) }} mph</span>
            <button class="btn btn-sm" style="margin-left:auto;padding:4px 8px;font-size:11px;color:var(--danger)" @click="deleteTrip(trip.id, $event)">🗑️</button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No trips yet</h3>
        <p>Log your first paddle to start tracking your progress.</p>
        <router-link to="/log" class="btn btn-primary" style="margin-top:16px">Log a Trip</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-view {
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.history-container {
  max-width: 700px;
  margin: 0 auto;
}

.records-section {
  margin-bottom: 24px;
}

.stat-sub {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 4px;
}

.trips-list {
  margin-top: 16px;
}
</style>
