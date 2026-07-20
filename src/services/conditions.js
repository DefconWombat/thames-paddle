/**
 * River conditions service — fetches live data from:
 * - EA Hydrology API (water levels, flow)
 * - Open-Meteo (weather forecast)
 */

const EA_BASE = 'https://environment.data.gov.uk/flood-monitoring';
const METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch current water levels from EA for Thames stations.
 * Returns array of { stationRef, level, timestamp, trend }
 */
export async function fetchWaterLevels() {
  try {
    const res = await fetch(
      `${EA_BASE}/id/stations?riverName=Thames&parameter=level&_limit=50`
    );
    if (!res.ok) throw new Error(`EA API ${res.status}`);
    const data = await res.json();

    const stations = data.items || [];
    const readings = [];

    // Fetch latest readings for each station
    const promises = stations.slice(0, 20).map(async (station) => {
      try {
        const measures = Array.isArray(station.measures) ? station.measures : [station.measures];
        const levelMeasure = measures.find(m =>
          m && (m.parameter === 'level' || (typeof m['@id'] === 'string' && m['@id'].includes('-level-')))
        );
        if (!levelMeasure) return null;

        const readingUrl = typeof levelMeasure === 'string'
          ? `${levelMeasure}/readings?latest`
          : `${levelMeasure['@id']}/readings?latest`;

        const rRes = await fetch(readingUrl);
        if (!rRes.ok) return null;
        const rData = await rRes.json();
        const items = rData.items || [];
        if (!items.length) return null;

        const latest = items[0];
        return {
          stationRef: station.stationReference,
          name: station.label,
          lat: station.lat,
          lng: station.long,
          level: latest.value,
          timestamp: latest.dateTime,
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter(Boolean);
  } catch (err) {
    console.warn('Failed to fetch water levels:', err);
    return [];
  }
}

/**
 * Simpler approach: fetch readings for a specific station by reference.
 * Uses the flood-monitoring API which is more reliable for quick lookups.
 */
export async function fetchStationLevel(stationRef) {
  try {
    const res = await fetch(
      `${EA_BASE}/id/stations/${stationRef}/measures`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const measures = data.items || [];

    // Find level measure
    const levelMeasure = measures.find(m =>
      m.parameter === 'level' || (m.parameterName && m.parameterName.toLowerCase().includes('level'))
    );
    if (!levelMeasure) return null;

    // Get latest reading
    const readRes = await fetch(`${levelMeasure['@id']}/readings?latest`);
    if (!readRes.ok) return null;
    const readData = await readRes.json();
    const items = readData.items || [];
    if (!items.length) return null;

    return {
      level: items[0].value,
      timestamp: items[0].dateTime,
      unit: levelMeasure.unitName || 'mAOD'
    };
  } catch {
    return null;
  }
}

/**
 * Fetch weather forecast for a point on the Thames.
 * Returns { current, hourly, daily } with relevant paddling conditions.
 */
export async function fetchWeather(lat = 51.65, lng = -1.15) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      hourly: [
        'temperature_2m',
        'precipitation',
        'rain',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'weather_code'
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
        'uv_index_max',
        'sunrise',
        'sunset'
      ].join(','),
      current: [
        'temperature_2m',
        'precipitation',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'weather_code'
      ].join(','),
      timezone: 'Europe/London',
      forecast_days: 7
    });

    const res = await fetch(`${METEO_BASE}?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = await res.json();

    return {
      current: data.current || null,
      hourly: data.hourly || null,
      daily: data.daily || null,
      timezone: data.timezone
    };
  } catch (err) {
    console.warn('Failed to fetch weather:', err);
    return null;
  }
}

/**
 * Classify water level relative to typical range.
 * Returns 'low' | 'normal' | 'high' | 'very-high'
 */
export function classifyLevel(level, typicalRange) {
  if (!typicalRange || level == null) return 'unknown';
  const [lo, hi] = typicalRange;
  const range = hi - lo;
  if (level < lo) return 'low';
  if (level > hi + range * 0.5) return 'very-high';
  if (level > hi) return 'high';
  return 'normal';
}

/**
 * Describe wind direction as compass bearing and paddling impact.
 */
export function windDescription(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(degrees / 22.5) % 16;
  return dirs[idx];
}

/**
 * WMO weather code to description and emoji.
 */
export function weatherCodeToInfo(code) {
  const map = {
    0: { desc: 'Clear sky', icon: '☀️' },
    1: { desc: 'Mainly clear', icon: '🌤️' },
    2: { desc: 'Partly cloudy', icon: '⛅' },
    3: { desc: 'Overcast', icon: '☁️' },
    45: { desc: 'Foggy', icon: '🌫️' },
    48: { desc: 'Rime fog', icon: '🌫️' },
    51: { desc: 'Light drizzle', icon: '🌦️' },
    53: { desc: 'Moderate drizzle', icon: '🌧️' },
    55: { desc: 'Dense drizzle', icon: '🌧️' },
    61: { desc: 'Slight rain', icon: '🌦️' },
    63: { desc: 'Moderate rain', icon: '🌧️' },
    65: { desc: 'Heavy rain', icon: '🌧️' },
    80: { desc: 'Slight showers', icon: '🌦️' },
    81: { desc: 'Moderate showers', icon: '🌧️' },
    82: { desc: 'Violent showers', icon: '⛈️' },
    95: { desc: 'Thunderstorm', icon: '⛈️' },
    96: { desc: 'Thunderstorm with hail', icon: '⛈️' },
    99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' },
  };
  return map[code] || { desc: 'Unknown', icon: '❓' };
}
