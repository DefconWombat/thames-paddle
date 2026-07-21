<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ThamesMap from '../components/ThamesMap.vue';
import { db } from '../data/db.js';
import { accessPoints } from '../data/access-points.js';
import { locks } from '../data/thames-locks.js';
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
