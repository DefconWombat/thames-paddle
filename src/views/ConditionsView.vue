<script setup>
import ConditionsPanel from '../components/ConditionsPanel.vue';
</script>

<template>
  <div class="conditions-view">
    <h2>River Conditions</h2>
    <ConditionsPanel />
  </div>
</template>

<style scoped>
.conditions-view {
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

h2 {
  margin-bottom: 16px;
}
</style>
