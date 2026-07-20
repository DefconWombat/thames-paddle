<script setup>
import { ref, onMounted, computed } from 'vue';
import { thamesGauges } from '../data/thames-gauges.js';
import {
  fetchStationLevel,
  fetchWeather,
  classifyLevel,
  windDescription,
  weatherCodeToInfo
} from '../services/conditions.js';

const loading = ref(true);
const error = ref(null);
const weather = ref(null);
const gaugeReadings = ref([]);
const selectedDay = ref(0);

onMounted(async () => {
  try {
    // Fetch weather for mid-route (Wallingford/Goring area) and gauge data in parallel
    const weatherLat = 51.60;
    const weatherLng = -1.13;
    const [weatherData, ...gaugeResults] = await Promise.all([
      fetchWeather(weatherLat, weatherLng),
      ...thamesGauges.map(async (gauge) => {
        try {
          const reading = await fetchStationLevel(gauge.stationRef);
          return reading ? { ...gauge, ...reading } : { ...gauge, level: null };
        } catch {
          return { ...gauge, level: null };
        }
      })
    ]);

    weather.value = weatherData;
    gaugeReadings.value = gaugeResults;
  } catch (err) {
    error.value = 'Unable to load conditions data. Check your connection.';
    console.error(err);
  } finally {
    loading.value = false;
  }
});

const currentWeather = computed(() => {
  if (!weather.value?.current) return null;
  const c = weather.value.current;
  const info = weatherCodeToInfo(c.weather_code);
  return {
    temp: Math.round(c.temperature_2m),
    windSpeed: Math.round(c.wind_speed_10m),
    windDir: windDescription(c.wind_direction_10m),
    windDeg: c.wind_direction_10m,
    gusts: Math.round(c.wind_gusts_10m),
    rain: c.precipitation,
    desc: info.desc,
    icon: info.icon
  };
});

const dailyForecast = computed(() => {
  if (!weather.value?.daily) return [];
  const d = weather.value.daily;
  return d.time.map((date, i) => ({
    date,
    dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(date).toLocaleDateString('en-GB', { weekday: 'short' }),
    tempMax: Math.round(d.temperature_2m_max[i]),
    tempMin: Math.round(d.temperature_2m_min[i]),
    rain: d.precipitation_sum[i],
    rainProb: d.precipitation_probability_max?.[i] ?? null,
    windMax: Math.round(d.wind_speed_10m_max[i]),
    gustsMax: Math.round(d.wind_gusts_10m_max?.[i] ?? 0),
    windDir: windDescription(d.wind_direction_10m_dominant[i]),
    uv: d.uv_index_max[i],
    sunrise: d.sunrise?.[i]?.split('T')[1] ?? '',
    sunset: d.sunset?.[i]?.split('T')[1] ?? ''
  }));
});

const windWarning = computed(() => {
  if (!currentWeather.value) return null;
  const speed = currentWeather.value.windSpeed;
  if (speed > 40) return { level: 'danger', text: 'Very strong winds — paddling not recommended' };
  if (speed > 30) return { level: 'warning', text: 'Strong winds — challenging conditions, especially for inflatables' };
  if (speed > 20) return { level: 'caution', text: 'Moderate wind — expect some chop on open stretches' };
  return null;
});

function levelClass(gauge) {
  const classification = classifyLevel(gauge.level, gauge.typicalRange);
  return `level-${classification}`;
}

function levelLabel(gauge) {
  return classifyLevel(gauge.level, gauge.typicalRange);
}

function uvLabel(uv) {
  if (uv >= 8) return { text: 'Very high', class: 'uv-very-high' };
  if (uv >= 6) return { text: 'High', class: 'uv-high' };
  if (uv >= 3) return { text: 'Moderate', class: 'uv-moderate' };
  return { text: 'Low', class: 'uv-low' };
}
</script>

<template>
  <div class="conditions-panel">
    <!-- Loading state -->
    <div v-if="loading" class="conditions-loading">
      <div class="spinner"></div>
      <span>Loading conditions...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="conditions-error">
      <p>{{ error }}</p>
      <p style="font-size:12px;color:var(--text-light)">
        River conditions require an internet connection to the EA and Open-Meteo APIs.
      </p>
    </div>

    <!-- Loaded -->
    <template v-else>
      <!-- Current conditions -->
      <div v-if="currentWeather" class="current-conditions card">
        <h3>Right now</h3>
        <p class="weather-location">Weather for mid-route (Wallingford / Goring area)</p>
        <div class="current-main">
          <span class="current-icon">{{ currentWeather.icon }}</span>
          <span class="current-temp">{{ currentWeather.temp }}°C</span>
          <span class="current-desc">{{ currentWeather.desc }}</span>
        </div>
        <div class="current-details">
          <div class="detail-item">
            <span class="detail-label">Wind</span>
            <span class="detail-value">{{ currentWeather.windSpeed }} km/h {{ currentWeather.windDir }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Gusts</span>
            <span class="detail-value">{{ currentWeather.gusts }} km/h</span>
          </div>
          <div v-if="currentWeather.rain > 0" class="detail-item">
            <span class="detail-label">Rain</span>
            <span class="detail-value">{{ currentWeather.rain }} mm</span>
          </div>
        </div>

        <div v-if="windWarning" class="wind-warning" :class="windWarning.level">
          {{ windWarning.text }}
        </div>
      </div>

      <!-- 7-day forecast -->
      <div v-if="dailyForecast.length" class="forecast card">
        <h3>7-day forecast</h3>
        <div class="forecast-grid">
          <div v-for="day in dailyForecast" :key="day.date" class="forecast-day">
            <div class="day-name">{{ day.dayName }}</div>
            <div class="day-temp">{{ day.tempMax }}° / {{ day.tempMin }}°</div>
            <div class="day-wind">💨 {{ day.windMax }} km/h {{ day.windDir }}</div>
            <div class="day-rain" v-if="day.rain > 0">🌧️ {{ day.rain.toFixed(1) }}mm</div>
            <div class="day-rain" v-else>☀️ Dry</div>
            <div class="day-uv">
              <span class="uv-badge" :class="uvLabel(day.uv).class">UV {{ day.uv }}</span>
            </div>
            <div class="day-sun" v-if="day.sunrise">
              🌅 {{ day.sunrise }} · 🌇 {{ day.sunset }}
            </div>
          </div>
        </div>
      </div>

      <!-- River levels -->
      <div class="river-levels card">
        <h3>River levels</h3>
        <p class="levels-note">Live data from Environment Agency gauging stations</p>
        <div v-if="gaugeReadings.length" class="gauge-list">
          <div v-for="gauge in gaugeReadings" :key="gauge.id" class="gauge-item">
            <div class="gauge-name">{{ gauge.name }}</div>
            <div v-if="gauge.level != null" class="gauge-reading">
              <span class="gauge-value">{{ gauge.level.toFixed(2) }}m</span>
              <span class="gauge-badge" :class="levelClass(gauge)">{{ levelLabel(gauge) }}</span>
            </div>
            <div v-else class="gauge-reading">
              <span class="gauge-na">No data</span>
            </div>
            <div v-if="gauge.level != null && gauge.typicalRange" class="gauge-bar">
              <div class="gauge-bar-bg">
                <div class="gauge-bar-typical"
                  :style="{
                    left: '10%',
                    width: '60%'
                  }"
                ></div>
                <div class="gauge-bar-marker"
                  :style="{
                    left: Math.min(95, Math.max(5, ((gauge.level - gauge.typicalRange[0] * 0.5) / (gauge.typicalRange[1] * 1.5)) * 100)) + '%'
                  }"
                  :class="levelClass(gauge)"
                ></div>
              </div>
              <div class="gauge-range-labels">
                <span>Low</span>
                <span>Normal</span>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-gauges">
          <p>Could not load river level data.</p>
        </div>
        <div class="levels-attribution">
          Data: <a href="https://check-for-flooding.service.gov.uk/river-and-sea-levels/river/river-thames" target="_blank">Environment Agency</a>
          · Weather: <a href="https://open-meteo.com" target="_blank">Open-Meteo</a>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.conditions-panel {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.conditions-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-light);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.conditions-error {
  text-align: center;
  padding: 40px;
  color: var(--danger);
}

.card {
  margin-bottom: 16px;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text);
}

/* Current conditions */
.current-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.current-icon {
  font-size: 36px;
}

.current-temp {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
}

.current-desc {
  font-size: 14px;
  color: var(--text-light);
}

.current-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-light);
  font-weight: 600;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
}

.wind-warning {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
}

.wind-warning.caution {
  background: #fff8e1;
  color: #f57f17;
}

.wind-warning.warning {
  background: #fff3e0;
  color: #e65100;
}

.wind-warning.danger {
  background: #fde8e5;
  color: #c0392b;
}

/* Forecast */
.forecast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.forecast-day {
  padding: 8px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  text-align: center;
  font-size: 12px;
}

.day-name {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text);
}

.day-temp {
  font-weight: 500;
  margin-bottom: 2px;
}

.day-wind, .day-rain, .day-sun {
  color: var(--text-light);
  font-size: 11px;
}

.uv-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  margin-top: 2px;
}

.uv-low { background: #e8f5e9; color: #2e7d32; }
.uv-moderate { background: #fff8e1; color: #f57f17; }
.uv-high { background: #fff3e0; color: #e65100; }
.uv-very-high { background: #fde8e5; color: #c0392b; }

/* River levels */
.weather-location {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 10px;
  font-style: italic;
}

.levels-note {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 12px;
}

.gauge-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gauge-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.gauge-item:last-child {
  border-bottom: none;
}

.gauge-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.gauge-reading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.gauge-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.gauge-badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
}

.level-low { background: #fff8e1; color: #f57f17; }
.level-normal { background: #e8f5e9; color: #2e7d32; }
.level-high { background: #fff3e0; color: #e65100; }
.level-very-high { background: #fde8e5; color: #c0392b; }
.level-unknown { background: #f5f5f5; color: #999; }

.gauge-na {
  font-size: 13px;
  color: var(--text-light);
}

.gauge-bar {
  margin-top: 4px;
}

.gauge-bar-bg {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  position: relative;
  overflow: visible;
}

.gauge-bar-typical {
  position: absolute;
  top: 0;
  height: 100%;
  background: #c8e6c9;
  border-radius: 3px;
}

.gauge-bar-marker {
  position: absolute;
  top: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transform: translateX(-50%);
}

.gauge-bar-marker.level-low { background: #f57f17; }
.gauge-bar-marker.level-normal { background: #2e7d32; }
.gauge-bar-marker.level-high { background: #e65100; }
.gauge-bar-marker.level-very-high { background: #c0392b; }
.gauge-bar-marker.level-unknown { background: #999; }

.gauge-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--text-light);
  margin-top: 2px;
}

.levels-attribution {
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-light);
}

.levels-attribution a {
  color: var(--primary);
}

@media (max-width: 600px) {
  .forecast-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
