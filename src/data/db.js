import Dexie from 'dexie';

export const db = new Dexie('ThamesKayak');

db.version(1).stores({
  trips: '++id, date, startPointId, endPointId, equipmentType, status',
  customPoi: '++id, type, lat, lng',
  settings: 'key'
});

db.version(2).stores({
  trips: '++id, date, startPointId, endPointId, equipmentType, status',
  customPoi: '++id, type, lat, lng',
  settings: 'key',
  photos: '++id, tripId, timestamp'
});

db.version(3).stores({
  trips: '++id, date, startPointId, endPointId, equipmentType, status',
  customPoi: '++id, type, lat, lng',
  settings: 'key',
  photos: '++id, tripId, timestamp',
  savedRoutes: '++id, name, created'
});

db.version(4).stores({
  trips: '++id, date, startPointId, endPointId, equipmentType, status',
  customPoi: '++id, type, lat, lng',
  settings: 'key',
  photos: '++id, tripId, timestamp',
  savedRoutes: '++id, name, created',
  journalEntries: '++id, tripId, timestamp'
});

/**
 * Trip schema:
 * {
 *   id: auto
 *   date: ISO string
 *   startPointId: string (access point id)
 *   endPointId: string (access point id)
 *   equipmentType: 'rigid' | 'inflatable'
 *   status: 'planned' | 'active' | 'paused' | 'completed'
 *
 *   // Timing
 *   startTime: ISO string
 *   endTime: ISO string
 *   pauseLog: [{ pausedAt: ISO, resumedAt: ISO }]
 *   movingTimeMs: number (calculated)
 *   totalTimeMs: number (calculated)
 *
 *   // Distance & speed
 *   plannedDistanceMiles: number
 *   actualDistanceMiles: number (from GPS or manual)
 *   avgSpeedMph: number (calculated from distance / moving time)
 *   maxSpeedMph: number (from GPS)
 *
 *   // GPS track (from import or live recording)
 *   recordedTrack: [{ lat, lng, timestamp, elevation?, heartRate? }]
 *   recordingSource: 'manual' | 'gpx_import' | 'live'
 *
 *   // Notes & conditions
 *   notes: string
 *   conditions: { waterLevel?, weather?, flow? }
 * }
 */

// Save a setting
export async function saveSetting(key, value) {
  await db.settings.put({ key, value });
}

// Get a setting
export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row?.value;
}
