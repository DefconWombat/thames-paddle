import { ref, computed } from 'vue';
import { saveSetting, getSetting } from '../data/db.js';

/**
 * Unit system composable — persists user preference in IndexedDB.
 * Provides conversion helpers for distance and speed.
 */

const units = ref('imperial'); // 'imperial' | 'metric'
let loaded = false;

export function useUnits() {
  // Load saved preference on first use
  if (!loaded) {
    loaded = true;
    getSetting('units').then(val => {
      if (val) units.value = val;
    });
  }

  const isMetric = computed(() => units.value === 'metric');

  function setUnits(u) {
    units.value = u;
    saveSetting('units', u);
  }

  function toggleUnits() {
    setUnits(units.value === 'imperial' ? 'metric' : 'imperial');
  }

  // Distance formatting
  function formatDist(miles) {
    if (miles == null) return '—';
    if (isMetric.value) {
      const km = miles * 1.60934;
      if (km < 0.1) return `${Math.round(km * 1000)} m`;
      return `${km.toFixed(2)} km`;
    }
    if (miles < 0.1) return `${Math.round(miles * 1760)} yds`;
    return `${miles.toFixed(2)} mi`;
  }

  // Short distance (for nearby POI)
  function formatDistShort(miles) {
    if (miles == null) return '—';
    if (isMetric.value) {
      const km = miles * 1.60934;
      if (km < 1) return `${Math.round(km * 1000)} m`;
      return `${km.toFixed(1)} km`;
    }
    if (miles < 0.5) return `${Math.round(miles * 1760)} yds`;
    return `${miles.toFixed(1)} mi`;
  }

  // Speed formatting
  function formatSpd(mph) {
    if (mph == null) return '—';
    if (isMetric.value) {
      return `${(mph * 1.60934).toFixed(1)} km/h`;
    }
    return `${mph.toFixed(1)} mph`;
  }

  // River mile formatting (always in river miles since that's the marker system)
  function formatRiverMile(mile) {
    if (mile == null) return '—';
    return `${mile.toFixed(1)} mi from Lechlade`;
  }

  // Unit label helpers
  const distUnit = computed(() => isMetric.value ? 'km' : 'mi');
  const speedUnit = computed(() => isMetric.value ? 'km/h' : 'mph');

  return {
    units,
    isMetric,
    distUnit,
    speedUnit,
    setUnits,
    toggleUnits,
    formatDist,
    formatDistShort,
    formatSpd,
    formatRiverMile
  };
}
