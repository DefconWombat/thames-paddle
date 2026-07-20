import { ref, computed, onUnmounted } from 'vue';
import { nearestRoutePoint, haversineDistance } from '../utils/river.js';
import { locks } from '../data/thames-locks.js';
import { accessPoints } from '../data/access-points.js';
import { pubsCafes } from '../data/pubs-cafes.js';

/**
 * GPS position tracking composable.
 * Uses the browser Geolocation API (works in iOS PWAs via Safari).
 */
export function useGps() {
  const position = ref(null);       // { lat, lng, accuracy, speed, heading, timestamp }
  const riverMile = ref(null);
  const distFromRiver = ref(null);
  const tracking = ref(false);
  const error = ref(null);
  const followMode = ref(true);

  let watchId = null;

  // Nearest POIs computed from current position
  const nearestPoi = computed(() => {
    if (!position.value) return null;
    const { lat, lng } = position.value;

    const nearest = (items, label) => {
      let best = null;
      let bestDist = Infinity;
      for (const item of items) {
        const d = haversineDistance(lat, lng, item.lat, item.lng);
        if (d < bestDist) {
          bestDist = d;
          best = item;
        }
      }
      return best ? { ...best, distance: bestDist, type: label } : null;
    };

    return {
      lock: nearest(locks, 'lock'),
      access: nearest(accessPoints, 'access'),
      pub: nearest(pubsCafes.filter(p => p.type !== 'cafe'), 'pub'),
    };
  });

  function startTracking() {
    if (!('geolocation' in navigator)) {
      error.value = 'GPS not available on this device';
      return;
    }

    error.value = null;
    tracking.value = true;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        position.value = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy,
          speed: speed != null ? speed * 2.23694 : null, // m/s to mph
          heading: heading,
          timestamp: pos.timestamp
        };

        // Calculate river mile
        const snap = nearestRoutePoint(latitude, longitude);
        riverMile.value = snap.point[2];
        distFromRiver.value = snap.distanceFromRiver;
      },
      (err) => {
        switch (err.code) {
          case 1:
            error.value = 'Location permission denied. Enable in Settings > Safari > Location.';
            break;
          case 2:
            error.value = 'Unable to get GPS position. Are you outdoors?';
            break;
          case 3:
            error.value = 'GPS timeout — trying again...';
            break;
          default:
            error.value = 'GPS error: ' + err.message;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000
      }
    );
  }

  function stopTracking() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    tracking.value = false;
  }

  function toggleFollow() {
    followMode.value = !followMode.value;
  }

  onUnmounted(() => {
    stopTracking();
  });

  return {
    position,
    riverMile,
    distFromRiver,
    tracking,
    error,
    followMode,
    nearestPoi,
    startTracking,
    stopTracking,
    toggleFollow
  };
}
