import { thamesRoute } from '../data/thames-route.js';

/**
 * Haversine distance between two lat/lng points in miles
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Find the nearest point on the Thames route to a given lat/lng.
 * Returns { index, point, distanceFromRiver }
 */
export function nearestRoutePoint(lat, lng) {
  let minDist = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < thamesRoute.length; i++) {
    const d = haversineDistance(lat, lng, thamesRoute[i][0], thamesRoute[i][1]);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }

  return {
    index: bestIdx,
    point: thamesRoute[bestIdx],
    distanceFromRiver: minDist
  };
}

/**
 * Calculate river distance in miles between two points on the route.
 * Uses the `mile` property on route points for accurate river distance.
 */
export function riverDistance(startLat, startLng, endLat, endLng) {
  const start = nearestRoutePoint(startLat, startLng);
  const end = nearestRoutePoint(endLat, endLng);

  return Math.abs(end.point[2] - start.point[2]);
}

/**
 * Get the river mile for a given lat/lng (snapped to nearest route point)
 */
export function getRiverMile(lat, lng) {
  const nearest = nearestRoutePoint(lat, lng);
  return nearest.point[2];
}

/**
 * Get all route points between two river miles (for highlighting a section)
 */
export function getRouteSection(startMile, endMile) {
  const lo = Math.min(startMile, endMile);
  const hi = Math.max(startMile, endMile);

  return thamesRoute.filter(p => p[2] >= lo && p[2] <= hi);
}

/**
 * Format a distance nicely
 */
export function formatDistance(miles) {
  if (miles < 0.1) return `${Math.round(miles * 1760)} yards`;
  return `${miles.toFixed(1)} miles`;
}

/**
 * Format time duration from milliseconds
 */
export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');

  if (hours === 0) return `${minutes}m ${ss}s`;
  return `${hours}h ${minutes}m ${ss}s`;
}

/**
 * Format speed in mph
 */
export function formatSpeed(mph) {
  return `${mph.toFixed(1)} mph`;
}

/**
 * Estimate trip time based on distance and speed
 */
export function estimateTime(distanceMiles, speedMph = 3.0) {
  const hours = distanceMiles / speedMph;
  return formatDuration(hours * 3600000);
}

/**
 * Calculate total distance from a GPS track (array of {lat, lng})
 */
export function trackDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    );
  }
  return total;
}

/**
 * Calculate moving time from a GPS track (excludes pauses)
 * A "pause" is detected when speed drops below threshold for extended period
 */
export function calculateMovingTime(points, pauseThresholdMph = 0.3) {
  let movingMs = 0;

  for (let i = 1; i < points.length; i++) {
    const dist = haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    );
    const timeMs = points[i].timestamp - points[i - 1].timestamp;
    const timeHours = timeMs / 3600000;
    const speed = timeHours > 0 ? dist / timeHours : 0;

    if (speed >= pauseThresholdMph) {
      movingMs += timeMs;
    }
  }

  return movingMs;
}
