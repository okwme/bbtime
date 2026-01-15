<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
      <h1 class="text-2xl font-bold text-gray-800 text-center">Baby Time Tracker</h1>
    </div>

    <!-- Current Status Display -->
    <div class="flex-1 flex flex-col justify-center items-center px-4 py-8">
      <!-- Status Circle -->
      <div class="relative mb-8">
        <div
          class="w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300"
          :class="statusBackgroundClass"
        >
          <div class="text-center">
            <div class="text-6xl mb-2">{{ statusEmoji }}</div>
            <div class="text-2xl font-bold text-white mb-1">{{ statusText }}</div>
            <div class="text-lg text-white opacity-90">{{ formattedElapsedTime }}</div>
          </div>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="w-full max-w-md space-y-3">
        <!-- Sleep/Wake Toggle -->
        <button
          @click="handleToggleSleepAwake"
          class="w-full py-6 px-6 rounded-2xl font-bold text-xl shadow-lg transition-all duration-200 active:scale-95"
          :class="sleepWakeButtonClass"
        >
          {{ sleepWakeButtonText }}
        </button>

        <!-- Eating Toggle -->
        <button
          @click="handleToggleEating"
          class="w-full py-6 px-6 rounded-2xl font-bold text-xl shadow-lg transition-all duration-200 active:scale-95"
          :class="eatingButtonClass"
          :disabled="store.currentActivity === 'sleeping'"
        >
          {{ eatingButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useBabyTrackerStore } from '@/stores/babyTracker'

const store = useBabyTrackerStore()
const currentTime = ref(new Date())
let intervalId: number | null = null

// Update current time every second
onMounted(() => {
  store.initialize()
  intervalId = window.setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

const statusEmoji = computed(() => {
  switch (store.currentActivityType) {
    case 'sleeping':
      return '😴'
    case 'eating':
      return '🍼'
    case 'awake':
      return '👶'
    default:
      return '👶'
  }
})

const statusText = computed(() => {
  switch (store.currentActivityType) {
    case 'sleeping':
      return 'Sleeping'
    case 'eating':
      return 'Eating'
    case 'awake':
      return 'Awake'
    default:
      return 'Awake'
  }
})

const statusBackgroundClass = computed(() => {
  switch (store.currentActivityType) {
    case 'sleeping':
      return 'bg-indigo-500'
    case 'eating':
      return 'bg-green-500'
    case 'awake':
      return 'bg-amber-500'
    default:
      return 'bg-amber-500'
  }
})

const sleepWakeButtonClass = computed(() => {
  if (store.currentActivity === 'sleeping') {
    return 'bg-amber-500 hover:bg-amber-600 text-white'
  } else {
    return 'bg-indigo-500 hover:bg-indigo-600 text-white'
  }
})

const sleepWakeButtonText = computed(() => {
  if (store.currentActivity === 'sleeping') {
    return '☀️ Wake Up'
  } else {
    return '🌙 Sleep'
  }
})

const eatingButtonClass = computed(() => {
  if (store.currentActivity === 'sleeping') {
    return 'bg-gray-300 text-gray-500 cursor-not-allowed'
  } else if (store.isEating) {
    return 'bg-red-500 hover:bg-red-600 text-white'
  } else {
    return 'bg-green-500 hover:bg-green-600 text-white'
  }
})

const eatingButtonText = computed(() => {
  if (store.isEating) {
    return '⏹️ Stop Eating'
  } else {
    return '🍼 Start Eating'
  }
})

const formattedElapsedTime = computed(() => {
  const diff = currentTime.value.getTime() - store.currentEntryStartTime.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  const s = seconds % 60
  const m = minutes % 60

  if (hours > 0) {
    return `${hours}h ${m}m ${s}s`
  } else if (minutes > 0) {
    return `${m}m ${s}s`
  } else {
    return `${s}s`
  }
})

const handleToggleSleepAwake = () => {
  store.toggleSleepAwake()
}

const handleToggleEating = () => {
  if (store.currentActivity !== 'sleeping') {
    store.toggleEating()
  }
}
</script>
