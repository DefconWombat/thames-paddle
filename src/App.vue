<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <nav class="app-nav">
    <div class="app-logo">
      <span class="logo-icon">🛶</span>
      <span>Thames Paddle</span>
    </div>
    <ul class="nav-links">
      <li>
        <router-link to="/">
          <span class="nav-icon">🗺️</span>
          <span>Map</span>
        </router-link>
      </li>
      <li>
        <router-link to="/plan">
          <span class="nav-icon">📍</span>
          <span>Plan</span>
        </router-link>
      </li>
      <li>
        <router-link to="/conditions">
          <span class="nav-icon">🌊</span>
          <span>Conditions</span>
        </router-link>
      </li>
      <li>
        <router-link to="/history">
          <span class="nav-icon">📊</span>
          <span>History</span>
        </router-link>
      </li>
    </ul>
  </nav>

  <main class="main-content">
    <router-view />
  </main>
</template>
