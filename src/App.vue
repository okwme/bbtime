<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app-container">
    <!-- Main Content -->
    <main class="main-content">
      <RouterView />
    </main>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <router-link
        to="/"
        class="nav-item"
        :class="{ active: route.name === 'tracker' }"
      >
        <div class="nav-icon">⏱️</div>
        <div class="nav-label">Tracker</div>
      </router-link>

      <router-link
        to="/timeline"
        class="nav-item"
        :class="{ active: route.name === 'timeline' }"
      >
        <div class="nav-icon">📊</div>
        <div class="nav-label">Timeline</div>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.bottom-nav {
  display: flex;
  background: white;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  position: sticky;
  bottom: 0;
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0;
  color: #6b7280;
  text-decoration: none;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:active {
  background-color: #f3f4f6;
}

.nav-item.active {
  color: #3b82f6;
}

.nav-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.nav-label {
  font-size: 0.75rem;
  font-weight: 500;
}

/* iOS safe area support */
@supports (padding: max(0px)) {
  .bottom-nav {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
}
</style>
