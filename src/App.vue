<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isOffline = ref(!navigator.onLine);

function handleOnline() { isOffline.value = false; }
function handleOffline() { isOffline.value = true; }

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});
</script>

<template>
  <div class="offline-banner" v-if="isOffline">📡 Offline — using cached data</div>

  <main class="main-content">
    <router-view />
  </main>

  <nav class="app-nav">
    <ul class="nav-links">
      <li>
        <router-link to="/">
          <span class="nav-icon">🗺️</span>
          <span>Map</span>
        </router-link>
      </li>
      <li>
        <router-link to="/dashboard">
          <span class="nav-icon">📊</span>
          <span>Dashboard</span>
        </router-link>
      </li>
      <li>
        <router-link to="/plan">
          <span class="nav-icon">📋</span>
          <span>Plan</span>
        </router-link>
      </li>
      <li>
        <router-link to="/conditions">
          <span class="nav-icon">🌤️</span>
          <span>Conditions</span>
        </router-link>
      </li>
      <li>
        <router-link to="/log">
          <span class="nav-icon">📝</span>
          <span>Log</span>
        </router-link>
      </li>
      <li>
        <router-link to="/history">
          <span class="nav-icon">📜</span>
          <span>History</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>
