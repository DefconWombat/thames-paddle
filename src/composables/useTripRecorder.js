import { ref, computed, onUnmounted } from 'vue';
import { db } from '../data/db.js';
import { trackDistance, calculateMovingTime, formatDuration, formatSpeed, haversineDistance } from '../utils/river.js';

/**
 * Trip recording composable.
 * Manages start/pause/resume/end lifecycle and stores trips in IndexedDB.
 */
export function useTripRecorder() {
  const tripId = ref(null);
  const status = ref('idle');        // 'idle' | 'recording' | 'paused' | 'finished'
  const track = ref([]);             // [{ lat, lng, timestamp, speed, accuracy }]
  const pauseLog = ref([]);          // [{ pausedAt, resumedAt }]
  const startTime = ref(null);
  const endTime = ref(null);
  const currentPauseStart = ref(null);

  // Timer for elapsed time display
  let timerInterval = null;
  const elapsed = ref(0);            // ms since start, excluding pauses

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (status.value === 'recording' && startTime.value) {
        const now = Date.now();
        const totalPausedMs = pauseLog.value.reduce((sum, p) => {
          return sum + ((p.resumedAt || now) - p.pausedAt);
        }, 0);
        const currentPauseMs = currentPauseStart.value
          ? now - currentPauseStart.value
          : 0;
        elapsed.value = now - startTime.value - totalPausedMs - currentPauseMs;
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Live stats computed from the track
  const stats = computed(() => {
    const pts = track.value;
    const dist = pts.length > 1 ? trackDistance(pts) : 0;
    const movingMs = pts.length > 1 ? calculateMovingTime(pts) : 0;
    const movingHours = movingMs / 3600000;
    const avgSpeed = movingHours > 0 ? dist / movingHours : 0;

    // Current speed from last GPS reading
    const lastPoint = pts.length > 0 ? pts[pts.length - 1] : null;
    const currentSpeed = lastPoint?.speed ?? 0;

    // Max speed
    let maxSpeed = 0;
    for (const p of pts) {
      if (p.speed != null && p.speed > maxSpeed) maxSpeed = p.speed;
    }

    return {
      distance: dist,
      distanceFormatted: dist < 0.1 ? `${Math.round(dist * 1760)} yds` : `${dist.toFixed(2)} mi`,
      elapsed: elapsed.value,
      elapsedFormatted: formatDuration(elapsed.value),
      movingTime: movingMs,
      movingTimeFormatted: formatDuration(movingMs),
      avgSpeed,
      avgSpeedFormatted: formatSpeed(avgSpeed),
      currentSpeed,
      currentSpeedFormatted: formatSpeed(currentSpeed),
      maxSpeed,
      maxSpeedFormatted: formatSpeed(maxSpeed),
      pointCount: pts.length
    };
  });

  /**
   * Record a GPS position into the current track.
   * Call this from the GPS watcher whenever a new position arrives.
   */
  function recordPoint(position) {
    if (status.value !== 'recording') return;
    if (!position) return;

    const point = {
      lat: position.lat,
      lng: position.lng,
      timestamp: position.timestamp || Date.now(),
      speed: position.speed,
      accuracy: position.accuracy
    };

    // Skip if accuracy is too poor (> 50m)
    if (point.accuracy && point.accuracy > 50) return;

    // Skip if too close to last point (< 3m) to avoid noise
    if (track.value.length > 0) {
      const last = track.value[track.value.length - 1];
      const distMiles = haversineDistance(last.lat, last.lng, point.lat, point.lng);
      if (distMiles < 0.002) return; // ~3 metres
    }

    track.value.push(point);
  }

  /**
   * Start a new trip recording.
   */
  async function startTrip(options = {}) {
    const now = Date.now();
    startTime.value = now;
    endTime.value = null;
    track.value = [];
    pauseLog.value = [];
    currentPauseStart.value = null;
    status.value = 'recording';
    elapsed.value = 0;

    // Save to DB
    const id = await db.trips.add({
      date: new Date(now).toISOString().split('T')[0],
      equipmentType: options.equipment || 'rigid',
      status: 'active',
      startTime: new Date(now).toISOString(),
      recordedTrack: [],
      pauseLog: [],
      recordingSource: 'live',
      notes: '',
      startPointId: options.startPointId || null,
      endPointId: options.endPointId || null,
    });
    tripId.value = id;
    startTimer();

    return id;
  }

  /**
   * Pause the current trip.
   */
  async function pauseTrip() {
    if (status.value !== 'recording') return;
    const now = Date.now();
    currentPauseStart.value = now;
    pauseLog.value.push({ pausedAt: now, resumedAt: null });
    status.value = 'paused';

    if (tripId.value) {
      await db.trips.update(tripId.value, {
        status: 'paused',
        pauseLog: [...pauseLog.value]
      });
    }
  }

  /**
   * Resume the current trip.
   */
  async function resumeTrip() {
    if (status.value !== 'paused') return;
    const now = Date.now();
    const lastPause = pauseLog.value[pauseLog.value.length - 1];
    if (lastPause) lastPause.resumedAt = now;
    currentPauseStart.value = null;
    status.value = 'recording';

    if (tripId.value) {
      await db.trips.update(tripId.value, {
        status: 'active',
        pauseLog: [...pauseLog.value]
      });
    }

    startTimer();
  }

  /**
   * End the current trip and save final data.
   */
  async function endTrip() {
    const now = Date.now();
    endTime.value = now;
    stopTimer();

    // If paused, close the pause
    if (currentPauseStart.value) {
      const lastPause = pauseLog.value[pauseLog.value.length - 1];
      if (lastPause) lastPause.resumedAt = now;
      currentPauseStart.value = null;
    }

    status.value = 'finished';

    const pts = track.value;
    const dist = pts.length > 1 ? trackDistance(pts) : 0;
    const movingMs = pts.length > 1 ? calculateMovingTime(pts) : 0;
    const totalMs = now - startTime.value;
    const movingHours = movingMs / 3600000;
    const avgSpeed = movingHours > 0 ? dist / movingHours : 0;
    let maxSpeed = 0;
    for (const p of pts) {
      if (p.speed != null && p.speed > maxSpeed) maxSpeed = p.speed;
    }

    if (tripId.value) {
      await db.trips.update(tripId.value, {
        status: 'completed',
        endTime: new Date(now).toISOString(),
        recordedTrack: [...pts],
        pauseLog: [...pauseLog.value],
        actualDistanceMiles: dist,
        movingTimeMs: movingMs,
        totalTimeMs: totalMs,
        avgSpeedMph: avgSpeed,
        maxSpeedMph: maxSpeed
      });
    }

    const result = {
      tripId: tripId.value,
      distance: dist,
      movingTime: movingMs,
      totalTime: totalMs,
      avgSpeed,
      maxSpeed,
      trackPoints: pts.length
    };

    return result;
  }

  /**
   * Discard the current trip without saving.
   */
  async function discardTrip() {
    stopTimer();
    if (tripId.value) {
      await db.trips.delete(tripId.value);
    }
    resetState();
  }

  function resetState() {
    tripId.value = null;
    status.value = 'idle';
    track.value = [];
    pauseLog.value = [];
    startTime.value = null;
    endTime.value = null;
    currentPauseStart.value = null;
    elapsed.value = 0;
    stopTimer();
  }

  onUnmounted(() => {
    stopTimer();
  });

  return {
    tripId,
    status,
    track,
    stats,
    startTrip,
    pauseTrip,
    resumeTrip,
    endTrip,
    discardTrip,
    recordPoint,
    resetState
  };
}
