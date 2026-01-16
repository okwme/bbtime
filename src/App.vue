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

      <router-link
        to="/settings"
        class="nav-item"
        :class="{ active: route.name === 'settings' }"
      >
        <div class="nav-icon">⚙️</div>
        <div class="nav-label">Sync</div>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.app-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4rem;
}

.bottom-nav {
  display: flex;
  background: white;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  flex-shrink: 0;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  color: #6b7280;
  text-decoration: none;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
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
  line-height: 1;
}

.nav-label {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
}
</style>
