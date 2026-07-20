<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import { locks } from '../data/thames-locks.js';
import { accessPoints } from '../data/access-points.js';
import { pubsCafes } from '../data/pubs-cafes.js';
import { campsites } from '../data/campsites.js';
import { parking } from '../data/parking.js';
import { thamesRoute } from '../data/thames-route.js';
import { formatDistance } from '../utils/river.js';

const props = defineProps({
  equipment: { type: String, default: 'all' },        // 'all', 'rigid', 'inflatable'
  highlightStart: { type: Number, default: null },      // river mile
  highlightEnd: { type: Number, default: null },        // river mile
  selectedPointId: { type: String, default: null },
  showLocks: { type: Boolean, default: true },
  showAccess: { type: Boolean, default: true },
  showPubs: { type: Boolean, default: true },
  showCamps: { type: Boolean, default: true },
  showParking: { type: Boolean, default: true },
  trackPoints: { type: Array, default: () => [] },      // GPS track to display
  gpsPosition: { type: Object, default: null },          // { lat, lng, accuracy }
  followGps: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true },
  height: { type: String, default: '100%' },
});

const emit = defineEmits(['point-click', 'map-ready', 'user-pan']);

const mapContainer = ref(null);
let map = null;
let routeLine = null;
let highlightLine = null;
let markerLayers = { locks: null, access: null, pubs: null, camps: null, parking: null };
let trackLine = null;
let gpsMarker = null;
let gpsCircle = null;

// Marker icons
function createIcon(emoji, size = 28) {
  return L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

const lockIcon = createIcon('🔒', 22);
const accessIcon = createIcon('🚣', 24);
const accessCarIcon = createIcon('🅿️', 22);
const pubIcon = createIcon('🍺', 22);
const hazardIcon = createIcon('⚠️', 24);
const campIcon = createIcon('⛺', 22);
const cafeIcon = createIcon('☕', 22);
const parkingIcon = createIcon('🅿️', 22);

function buildPopup(item, type) {
  let html = `<div class="popup-title">${item.name}</div>`;

  if (item.riverMile != null) {
    html += `<div class="popup-detail">River mile: ${item.riverMile}</div>`;
  }

  if (item.notes) {
    html += `<div class="popup-detail">${item.notes}</div>`;
  }

  if (item.hazard) {
    html += `<div class="popup-detail" style="color:var(--danger);font-weight:600">⚠️ ${item.hazard}</div>`;
  }

  if (type === 'access') {
    html += '<div class="popup-badges">';
    if (item.access?.vehicleAccess) {
      html += '<span class="badge badge-vehicle">🚗 Vehicle access</span>';
    }
    if (item.access?.footpathOnly) {
      html += '<span class="badge badge-footpath">🚶 Footpath only</span>';
    }
    if (item.suitability?.rigidHull) {
      html += '<span class="badge badge-rigid">Rigid hull</span>';
    }
    if (item.suitability?.inflatable) {
      html += '<span class="badge badge-inflatable">Inflatable</span>';
    }
    html += '</div>';
    if (item.access?.parkingNotes) {
      html += `<div class="popup-detail" style="margin-top:6px">🅿️ ${item.access.parkingNotes}</div>`;
    }
  }

  if (type === 'parking') {
    html += '<div class="popup-badges">';
    html += `<span class="badge" style="background:${item.type === 'free' ? '#e8f5e9;color:#2e7d32' : '#fff3e0;color:#e65100'}">${item.type === 'free' ? 'Free parking' : 'Pay & display'}</span>`;
    if (item.walkMin) {
      html += `<span class="badge badge-footpath">🚶 ${item.walkMin} min walk</span>`;
    }
    html += '</div>';
  }

  if (type === 'lock') {
    html += '<div class="popup-badges">';
    html += `<span class="badge" style="background:#fde8e5;color:#c0392b">Portage: ${item.portage} bank</span>`;
    if (item.canoePass) {
      html += '<span class="badge badge-vehicle">Canoe pass available</span>';
    }
    html += '</div>';
  }

  if (item.facilities?.length) {
    const facilityIcons = {
      toilets: '🚻', water: '🚰', pub: '🍺', shop: '🛒',
      cafe: '☕', parking: '🅿️', train_station: '🚂'
    };
    const icons = item.facilities.map(f => facilityIcons[f] || f).join(' ');
    html += `<div class="popup-detail" style="margin-top:6px">${icons}</div>`;
  }

  return html;
}

function initMap() {
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, {
    center: [51.62, -1.15],
    zoom: 10,
    zoomControl: true,
    attributionControl: true
  });

  // OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
    referrerPolicy: 'origin'
  }).addTo(map);

  // Draw the Thames route
  const routeCoords = thamesRoute.map(p => [p[0], p[1]]);
  routeLine = L.polyline(routeCoords, {
    color: '#3498db',
    weight: 4,
    opacity: 0.6,
    smoothFactor: 1
  }).addTo(map);

  // Fit to route
  map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

  // Detect user panning — disable follow mode
  map.on('dragstart', () => {
    emit('user-pan');
  });

  // Add markers
  updateMarkers();

  emit('map-ready', map);
}

function recentreOnGps() {
  if (!map || !props.gpsPosition) return;
  map.setView([props.gpsPosition.lat, props.gpsPosition.lng], Math.max(map.getZoom(), 14), { animate: true });
}

function updateMarkers() {
  if (!map) return;

  // Clear existing markers
  Object.values(markerLayers).forEach(layer => {
    if (layer) map.removeLayer(layer);
  });

  // Locks
  if (props.showLocks) {
    markerLayers.locks = L.layerGroup();
    locks.forEach(lock => {
      const icon = lock.hazard ? hazardIcon : lockIcon;
      const marker = L.marker([lock.lat, lock.lng], { icon })
        .bindPopup(buildPopup(lock, 'lock'));
      marker.on('click', () => emit('point-click', { ...lock, pointType: 'lock' }));
      markerLayers.locks.addLayer(marker);
    });
    markerLayers.locks.addTo(map);
  }

  // Access points (filtered by equipment)
  if (props.showAccess) {
    markerLayers.access = L.layerGroup();
    const filtered = accessPoints.filter(ap => {
      if (props.equipment === 'rigid') return ap.suitability.rigidHull;
      if (props.equipment === 'inflatable') return ap.suitability.inflatable;
      return true;
    });

    filtered.forEach(ap => {
      const icon = ap.access.vehicleAccess ? accessCarIcon : accessIcon;
      const marker = L.marker([ap.lat, ap.lng], { icon })
        .bindPopup(buildPopup(ap, 'access'));
      marker.on('click', () => emit('point-click', { ...ap, pointType: 'access' }));
      markerLayers.access.addLayer(marker);
    });
    markerLayers.access.addTo(map);
  }

  // Pubs & cafés
  if (props.showPubs) {
    markerLayers.pubs = L.layerGroup();
    pubsCafes.forEach(pub => {
      const icon = pub.type === 'cafe' ? cafeIcon : pubIcon;
      const marker = L.marker([pub.lat, pub.lng], { icon })
        .bindPopup(buildPopup(pub, 'pub'));
      markerLayers.pubs.addLayer(marker);
    });
    markerLayers.pubs.addTo(map);
  }

  // Parking
  if (props.showParking) {
    markerLayers.parking = L.layerGroup();
    parking.forEach(p => {
      const marker = L.marker([p.lat, p.lng], { icon: parkingIcon })
        .bindPopup(buildPopup(p, 'parking'));
      markerLayers.parking.addLayer(marker);
    });
    markerLayers.parking.addTo(map);
  }

  // Campsites
  if (props.showCamps) {
    markerLayers.camps = L.layerGroup();
    campsites.forEach(camp => {
      const marker = L.marker([camp.lat, camp.lng], { icon: campIcon })
        .bindPopup(buildPopup(camp, 'camp'));
      markerLayers.camps.addLayer(marker);
    });
    markerLayers.camps.addTo(map);
  }
}

function updateHighlight() {
  if (!map) return;

  if (highlightLine) {
    map.removeLayer(highlightLine);
    highlightLine = null;
  }

  if (props.highlightStart != null && props.highlightEnd != null) {
    const lo = Math.min(props.highlightStart, props.highlightEnd);
    const hi = Math.max(props.highlightStart, props.highlightEnd);
    const section = thamesRoute.filter(p => p[2] >= lo && p[2] <= hi);

    if (section.length > 1) {
      highlightLine = L.polyline(
        section.map(p => [p[0], p[1]]),
        { color: '#e67e22', weight: 6, opacity: 0.85 }
      ).addTo(map);

      map.fitBounds(highlightLine.getBounds(), { padding: [60, 60] });
    }
  }
}

function updateTrack() {
  if (!map) return;

  if (trackLine) {
    map.removeLayer(trackLine);
    trackLine = null;
  }

  if (props.trackPoints.length > 1) {
    trackLine = L.polyline(
      props.trackPoints.map(p => [p.lat, p.lng]),
      { color: '#9b59b6', weight: 4, opacity: 0.8, dashArray: '8 4' }
    ).addTo(map);
  }
}

function updateGpsPosition() {
  if (!map) return;
  const pos = props.gpsPosition;

  if (!pos) {
    if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
    if (gpsCircle) { map.removeLayer(gpsCircle); gpsCircle = null; }
    return;
  }

  const latlng = [pos.lat, pos.lng];

  if (!gpsMarker) {
    // Pulsing blue dot
    gpsMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'gps-dot',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: '<div class="gps-dot-inner"></div>'
      }),
      zIndexOffset: 1000
    }).addTo(map);
  } else {
    gpsMarker.setLatLng(latlng);
  }

  // Accuracy circle
  if (!gpsCircle) {
    gpsCircle = L.circle(latlng, {
      radius: pos.accuracy || 20,
      color: '#4285f4',
      fillColor: '#4285f4',
      fillOpacity: 0.1,
      weight: 1,
      opacity: 0.3
    }).addTo(map);
  } else {
    gpsCircle.setLatLng(latlng);
    gpsCircle.setRadius(pos.accuracy || 20);
  }

  // Auto-follow
  if (props.followGps) {
    map.setView(latlng, Math.max(map.getZoom(), 14), { animate: true });
  }
}

// Watch for prop changes
watch(() => props.gpsPosition, updateGpsPosition, { deep: true });
watch(() => props.equipment, updateMarkers);
watch(() => props.showLocks, updateMarkers);
watch(() => props.showAccess, updateMarkers);
watch(() => props.showPubs, updateMarkers);
watch(() => props.showCamps, updateMarkers);
watch(() => props.showParking, updateMarkers);
watch(() => [props.highlightStart, props.highlightEnd], updateHighlight);
watch(() => props.trackPoints, updateTrack, { deep: true });

watch(() => props.selectedPointId, (id) => {
  if (!id || !map) return;
  const all = [...locks, ...accessPoints, ...pubsCafes];
  const point = all.find(p => p.id === id);
  if (point) {
    map.setView([point.lat, point.lng], 14, { animate: true });
  }
});

onMounted(() => {
  nextTick(() => initMap());
});

defineExpose({ map: () => map, recentreOnGps });
</script>

<template>
  <div ref="mapContainer" :style="{ height, width: '100%' }"></div>
</template>

<style>
.custom-marker {
  background: none !important;
  border: none !important;
}

.gps-dot {
  background: none !important;
  border: none !important;
}

.gps-dot-inner {
  width: 18px;
  height: 18px;
  background: #4285f4;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3), 0 2px 6px rgba(0, 0, 0, 0.3);
  animation: gps-pulse 2s ease-in-out infinite;
}

@keyframes gps-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3), 0 2px 6px rgba(0, 0, 0, 0.3); }
  50% { box-shadow: 0 0 0 8px rgba(66, 133, 244, 0.15), 0 2px 6px rgba(0, 0, 0, 0.3); }
}
</style>
