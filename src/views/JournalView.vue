<script setup>
import { ref, computed, onMounted } from 'vue';
import { db } from '../data/db.js';
import { useGps } from '../composables/useGps.js';
import { accessPoints } from '../data/access-points.js';
import { locks } from '../data/thames-locks.js';
import { pubsCafes } from '../data/pubs-cafes.js';
import { haversineDistance } from '../utils/river.js';

const gps = useGps();
const entries = ref([]);
const inputText = ref('');
const loading = ref(true);

// Find the nearest named landmark to the current GPS position
function nearestLandmarkName() {
  if (!gps.position.value) return null;
  const { lat, lng } = gps.position.value;

  let bestName = null;
  let bestDist = Infinity;

  for (const ap of accessPoints) {
    const d = haversineDistance(lat, lng, ap.lat, ap.lng);
    if (d < bestDist) { bestDist = d; bestName = ap.name; }
  }
  for (const lk of locks) {
    const d = haversineDistance(lat, lng, lk.lat, lk.lng);
    if (d < bestDist) { bestDist = d; bestName = lk.name + ' Lock'; }
  }
  for (const pub of pubsCafes) {
    const d = haversineDistance(lat, lng, pub.lat, pub.lng);
    if (d < bestDist) { bestDist = d; bestName = pub.name; }
  }

  return bestName;
}

// Get the active trip ID (if any)
async function getActiveTripId() {
  const active = await db.trips
    .where('status').anyOf('active', 'paused')
    .first();
  return active?.id || null;
}

// Load journal entries (most recent first)
async function loadEntries() {
  loading.value = true;
  const all = await db.journalEntries.orderBy('timestamp').reverse().toArray();
  entries.value = all;
  loading.value = false;
}

// Add a new journal entry
async function addEntry() {
  const text = inputText.value.trim();
  if (!text) return;

  const now = new Date();
  const location = nearestLandmarkName();
  const tripId = await getActiveTripId();

  const entry = {
    tripId,
    timestamp: now.toISOString(),
    text,
    location: location ? `Near ${location}` : null,
    lat: gps.position.value?.lat || null,
    lng: gps.position.value?.lng || null,
  };

  await db.journalEntries.add(entry);
  inputText.value = '';
  await loadEntries();
}

// Delete an entry
async function deleteEntry(id) {
  await db.journalEntries.delete(id);
  await loadEntries();
}

// Format timestamp for display
function formatTime(isoString) {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Group entries by date
const groupedEntries = computed(() => {
  const groups = {};
  for (const entry of entries.value) {
    const dateKey = entry.timestamp.slice(0, 10);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(entry);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
});

// Today's entries for the "current session" feel
const todayKey = new Date().toISOString().slice(0, 10);
const todayEntries = computed(() => {
  return entries.value.filter(e => e.timestamp.startsWith(todayKey));
});

onMounted(() => {
  loadEntries();
  // Start GPS if not already tracking so we can tag location
  if (!gps.tracking.value) {
    gps.startTracking();
  }
});
</script>

<template>
  <div class="journal-view">
    <div class="page-content">
      <h2>Trip Journal</h2>

      <!-- Input row — always visible -->
      <div class="log-input-row">
        <input
          class="log-input"
          v-model="inputText"
          placeholder="Add a journal entry..."
          @keyup.enter="addEntry"
        />
        <button class="log-add-btn" @click="addEntry">Add</button>
      </div>

      <div v-if="gps.position.value" class="journal-location-hint">
        📍 {{ nearestLandmarkName() ? 'Near ' + nearestLandmarkName() : 'GPS active' }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="empty-state" style="padding: 24px">
        Loading...
      </div>

      <!-- Empty state -->
      <div v-else-if="entries.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No journal entries yet</h3>
        <p>Add notes about your paddle — conditions, wildlife, good spots, anything worth remembering.</p>
      </div>

      <!-- Entries grouped by date -->
      <template v-else>
        <div v-for="[dateKey, dateEntries] in groupedEntries" :key="dateKey" class="journal-day">
          <div class="journal-day-header">{{ formatDate(dateEntries[0].timestamp) }}</div>
          <div class="card">
            <div
              v-for="entry in dateEntries"
              :key="entry.id"
              class="log-entry"
            >
              <div class="log-time">
                {{ formatTime(entry.timestamp) }}
                <span v-if="entry.location"> — {{ entry.location }}</span>
              </div>
              <div class="log-text">{{ entry.text }}</div>
              <button class="journal-delete" @click="deleteEntry(entry.id)" title="Delete entry">✕</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.journal-view {
  height: 100%;
  overflow-y: auto;
}

.journal-location-hint {
  font-size: 11px;
  color: var(--text-light);
  margin-top: 6px;
  margin-bottom: 4px;
}

.journal-day {
  margin-top: 16px;
}

.journal-day-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-light);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.log-entry {
  position: relative;
  padding: 10px 24px 10px 0;
  border-bottom: 1px solid var(--border);
}

.log-entry:last-child {
  border-bottom: none;
}

.journal-delete {
  position: absolute;
  top: 10px;
  right: 0;
  background: none;
  border: none;
  color: var(--text-light);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.4;
  transition: opacity 0.15s;
}

.journal-delete:hover {
  opacity: 1;
  color: var(--danger);
}

@media (orientation: landscape) and (max-height: 500px) {
  .journal-view .page-content {
    max-width: 100%;
  }
}
</style>
