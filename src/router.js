import { createRouter, createWebHashHistory } from 'vue-router';
import MapView from './views/MapView.vue';
import PlanView from './views/PlanView.vue';
import LogView from './views/LogView.vue';
import HistoryView from './views/HistoryView.vue';
import TripDetailView from './views/TripDetailView.vue';
import ConditionsView from './views/ConditionsView.vue';

const routes = [
  { path: '/', name: 'map', component: MapView },
  { path: '/plan', name: 'plan', component: PlanView },
  { path: '/conditions', name: 'conditions', component: ConditionsView },
  { path: '/log', name: 'log', component: LogView },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/trip/:id', name: 'trip-detail', component: TripDetailView, props: true },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
