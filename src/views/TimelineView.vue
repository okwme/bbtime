<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex-shrink-0 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-800">Activity Calendar</h1>
      <div class="flex items-center gap-2">
        <button
          @click="zoomOut"
          :disabled="zoomLevel === 0"
          class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
          title="Zoom out"
        >
          <span class="text-lg font-bold text-gray-700">−</span>
        </button>
        <span class="text-xs text-gray-600 w-12 text-center">{{ zoomLabel }}</span>
        <button
          @click="zoomIn"
          :disabled="zoomLevel === 5"
          class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
          title="Zoom in"
        >
          <span class="text-lg font-bold text-gray-700">+</span>
        </button>
      </div>
    </div>

    <!-- Calendar Content -->
    <div v-if="store.groupedByDay.length === 0" class="flex-1 flex items-center justify-center">
      <p class="text-gray-500 text-lg">No activity recorded yet</p>
    </div>

    <div
      v-else
      class="flex-1 overflow-x-auto overflow-y-auto touch-pan-x touch-pan-y"
      style="touch-action: pan-x pan-y;"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- Calendar Grid -->
      <div class="flex p-4 gap-4 min-w-min" :style="{ height: calendarHeight }">
        <!-- Day Column -->
        <div
          v-for="day in store.groupedByDay"
          :key="day.date"
          class="flex-shrink-0 w-32 flex flex-col"
        >
          <!-- Day Header -->
          <div class="mb-3 text-center bg-white rounded-lg border border-gray-200 py-2 px-2">
            <div class="text-sm font-bold text-gray-900">{{ formatDayOfWeek(day.date) }}</div>
            <div class="text-2xl font-bold text-gray-900">{{ formatDayNumber(day.date) }}</div>
            <div class="text-sm text-gray-700">{{ formatMonth(day.date) }}</div>
          </div>

          <!-- 24-Hour Column -->
          <div class="flex-1 relative bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            <!-- Hour grid lines (faint) -->
            <div class="absolute inset-0 flex flex-col">
              <div
                v-for="hour in 24"
                :key="hour"
                class="flex-1 border-b border-gray-100 last:border-b-0"
              ></div>
            </div>

            <!-- Activity blocks -->
            <div
              v-for="entry in visibleEntries(day.entries)"
              :key="entry.id"
              class="absolute cursor-pointer transition-opacity hover:opacity-90 flex flex-col items-center justify-center border-l-4 overflow-hidden"
              :class="getActivityColorClass(entry.type)"
              :style="getColumnStyle(entry)"
              @click="handleEditEntry(entry)"
            >
              <span class="text-xs font-bold" :class="getTextColorClass(entry.type)">
                {{ getActivityEmoji(entry.type) }}
              </span>
              <span
                v-if="shouldShowDuration(entry)"
                class="text-xs font-semibold mt-1"
                :class="getTextColorClass(entry.type)"
              >
                {{ getShortDuration(entry) }}
              </span>
            </div>

            <!-- Time markers on the side -->
            <div class="absolute inset-y-0 left-0 flex flex-col pointer-events-none px-1" :class="timeMarkerClass" style="justify-content: space-between;">
              <div v-for="marker in timeMarkers" :key="marker.label" :class="marker.emphasized ? 'text-gray-900' : 'text-gray-700'">
                {{ marker.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-2">
      <div class="flex justify-center gap-4 text-xs">
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded bg-indigo-100 border-2 border-indigo-600"></div>
          <span class="text-gray-700">Sleeping</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded bg-green-100 border-2 border-green-600"></div>
          <span class="text-gray-700">Eating</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded bg-amber-100 border-2 border-amber-600"></div>
          <span class="text-gray-700">Awake</span>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="editingEntry"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeEditModal"
    >
      <div class="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 class="text-xl font-bold mb-4 text-gray-800">Edit Activity</h3>

        <div class="space-y-4">
          <!-- Activity Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <div class="text-lg font-semibold text-gray-900">
              {{ getActivityLabel(editingEntry.type) }}
            </div>
          </div>

          <!-- Start Time -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              v-model="editStartTime"
              type="datetime-local"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- End Time -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              v-model="editEndTime"
              type="datetime-local"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Duration Display -->
          <div v-if="editingEntry.endTime" class="text-sm text-gray-600">
            Duration: {{ getDuration(editingEntry) }}
          </div>

          <!-- Buttons -->
          <div class="flex gap-2 mt-6">
            <button
              @click="handleSaveEdit"
              class="flex-1 bg-blue-500 text-white font-bold py-3 px-4 rounded-xl"
            >
              Save
            </button>
            <button
              @click="handleDeleteEntry"
              class="flex-1 bg-red-500 text-white font-bold py-3 px-4 rounded-xl"
            >
              Delete
            </button>
          </div>
          <button
            @click="closeEditModal"
            class="w-full bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBabyTrackerStore } from '@/stores/babyTracker'
import type { ActivityEntry, ActivityType, DayData } from '@/types'

const store = useBabyTrackerStore()
const editingEntry = ref<ActivityEntry | null>(null)
const editStartTime = ref('')
const editEndTime = ref('')
const currentTime = ref(new Date())
const zoomLevel = ref(2) // 0 (most out) to 5 (most in)
let intervalId: number | null = null

// Touch/pinch zoom state
let initialPinchDistance = 0
let initialZoomLevel = 2
let isPinching = false

// Zoom configuration
const zoomConfig = [
  { height: 300, interval: 6, label: 'Day' },      // Level 0: Every 6 hours (12a, 6a, 12p, 6p)
  { height: 400, interval: 2, label: '2h' },       // Level 1: Every 2 hours
  { height: 600, interval: 1, label: '1h' },       // Level 2: Every hour
  { height: 1200, interval: 0.5, label: '30m' },   // Level 3: Every 30 minutes
  { height: 2400, interval: 0.25, label: '15m' },  // Level 4: Every 15 minutes
  { height: 4800, interval: 1/12, label: '5m' }    // Level 5: Every 5 minutes
]

const calendarHeight = computed(() => `${zoomConfig[zoomLevel.value].height}px`)
const zoomLabel = computed(() => zoomConfig[zoomLevel.value].label)

const timeMarkerClass = computed(() => {
  if (zoomLevel.value <= 1) return 'text-xs font-semibold'
  if (zoomLevel.value <= 3) return 'text-xs font-semibold'
  return 'text-[10px] font-medium'
})

const timeMarkers = computed(() => {
  const interval = zoomConfig[zoomLevel.value].interval
  const markers: { label: string; emphasized: boolean }[] = []

  if (interval >= 1) {
    // Hourly or less frequent
    const totalMarkers = Math.floor(24 / interval) + 1
    for (let i = 0; i < totalMarkers && i * interval < 24; i++) {
      const hour = i * interval
      const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const period = hour < 12 ? 'a' : 'p'
      const emphasized = hour % 6 === 0
      markers.push({ label: `${h}${period}`, emphasized })
    }
  } else {
    // Sub-hourly (30min, 15min, 5min)
    const minuteInterval = Math.round(interval * 60)
    const totalMarkers = Math.floor((24 * 60) / minuteInterval) + 1

    for (let i = 0; i < totalMarkers; i++) {
      const totalMinutes = i * minuteInterval
      if (totalMinutes >= 24 * 60) break

      const hour = Math.floor(totalMinutes / 60)
      const minute = totalMinutes % 60
      const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const period = hour < 12 ? 'a' : 'p'

      if (minute === 0) {
        markers.push({ label: `${h}${period}`, emphasized: hour % 6 === 0 })
      } else {
        markers.push({ label: `:${String(minute).padStart(2, '0')}`, emphasized: false })
      }
    }
  }

  return markers
})

const zoomIn = () => {
  if (zoomLevel.value < 5) zoomLevel.value++
}

const zoomOut = () => {
  if (zoomLevel.value > 0) zoomLevel.value--
}

// Touch/pinch zoom handlers
const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    isPinching = true
    initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1])
    initialZoomLevel = zoomLevel.value
    e.preventDefault()
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (isPinching && e.touches.length === 2) {
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1])
    const distanceChange = currentDistance - initialPinchDistance

    // Scale factor: ~100px change = 1 zoom level
    const zoomChange = Math.round(distanceChange / 100)
    const newZoomLevel = Math.max(0, Math.min(5, initialZoomLevel + zoomChange))

    if (newZoomLevel !== zoomLevel.value) {
      zoomLevel.value = newZoomLevel
    }

    e.preventDefault()
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (e.touches.length < 2) {
    isPinching = false
    initialPinchDistance = 0
  }
}

// Update current time every second to trigger reactivity for ongoing activities
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

const formatDayOfWeek = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

const formatDayNumber = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.getDate()
}

const formatMonth = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short' })
}

const getActivityEmoji = (type: ActivityType) => {
  switch (type) {
    case 'sleeping': return '😴'
    case 'eating': return '🍼'
    case 'awake': return '👶'
    default: return ''
  }
}

const getActivityLabel = (type: ActivityType) => {
  switch (type) {
    case 'sleeping': return '😴 Sleeping'
    case 'eating': return '🍼 Eating'
    case 'awake': return '👶 Awake'
    default: return type
  }
}

const getActivityColorClass = (type: ActivityType) => {
  switch (type) {
    case 'sleeping': return 'bg-indigo-100 border-indigo-600'
    case 'eating': return 'bg-green-100 border-green-600'
    case 'awake': return 'bg-amber-100 border-amber-600'
    default: return 'bg-gray-100 border-gray-400'
  }
}

const getTextColorClass = (type: ActivityType) => {
  switch (type) {
    case 'sleeping': return 'text-indigo-900'
    case 'eating': return 'text-green-900'
    case 'awake': return 'text-amber-900'
    default: return 'text-gray-900'
  }
}

const visibleEntries = (entries: ActivityEntry[]) => {
  // Minimum duration threshold based on zoom level
  const minDurations = [30, 15, 5, 3, 2, 1] // minutes for levels 0-5

  return entries.filter(entry => {
    // Always show ongoing activities (no endTime)
    if (!entry.endTime) return true

    // Calculate duration in minutes
    const durationMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()
    const durationMinutes = durationMs / 60000

    // Show based on zoom level threshold
    return durationMinutes >= minDurations[zoomLevel.value]
  })
}

const getColumnStyle = (entry: ActivityEntry) => {
  const dayStart = new Date(entry.startTime)
  dayStart.setHours(0, 0, 0, 0)

  const startMinutes = (new Date(entry.startTime).getTime() - dayStart.getTime()) / 60000
  // Use currentTime for ongoing activities to trigger reactivity
  const endTime = entry.endTime ? new Date(entry.endTime) : currentTime.value
  const endMinutes = (endTime.getTime() - dayStart.getTime()) / 60000

  const topPercent = (startMinutes / 1440) * 100
  const heightPercent = ((endMinutes - startMinutes) / 1440) * 100

  return {
    top: `${topPercent}%`,
    height: `${Math.max(heightPercent, 2)}%`, // Minimum 2% height for visibility
    left: '20px', // Leave space for time markers
    right: '0'
  }
}

const getDuration = (entry: ActivityEntry) => {
  // Use currentTime for ongoing activities to show live duration
  const endTime = entry.endTime ? new Date(entry.endTime) : currentTime.value
  const diff = endTime.getTime() - new Date(entry.startTime).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (!entry.endTime) {
    // Show ongoing with live time
    if (hours > 0) {
      return `${hours}h ${mins}m (ongoing)`
    } else {
      return `${mins}m (ongoing)`
    }
  }

  if (hours > 0) {
    return `${hours}h ${mins}m`
  } else {
    return `${mins}m`
  }
}

const getShortDuration = (entry: ActivityEntry) => {
  const endTime = entry.endTime ? new Date(entry.endTime) : currentTime.value
  const diff = endTime.getTime() - new Date(entry.startTime).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
  } else {
    return `${mins}m`
  }
}

const shouldShowDuration = (entry: ActivityEntry) => {
  // Only show duration if zoomed in enough AND block is tall enough
  if (zoomLevel.value < 2) return false

  const endTime = entry.endTime ? new Date(entry.endTime) : currentTime.value
  const durationMinutes = (endTime.getTime() - new Date(entry.startTime).getTime()) / 60000

  // Calculate pixel height of this block
  const heightPercent = (durationMinutes / 1440) * 100
  const pixelHeight = (heightPercent / 100) * zoomConfig[zoomLevel.value].height

  // Show duration if block is at least 40px tall
  return pixelHeight >= 40
}

const getDaySummary = (day: DayData, type: ActivityType) => {
  const entries = day.entries.filter(e => e.type === type)
  if (entries.length === 0) return '-'

  const totalMinutes = entries.reduce((sum, entry) => {
    // Use currentTime for ongoing activities
    const endTime = entry.endTime ? new Date(entry.endTime) : currentTime.value
    const duration = (endTime.getTime() - new Date(entry.startTime).getTime()) / 60000
    return sum + duration
  }, 0)

  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.floor(totalMinutes % 60)

  if (hours > 0) {
    return `${hours}h`
  } else {
    return `${mins}m`
  }
}

const handleEditEntry = (entry: ActivityEntry) => {
  editingEntry.value = entry
  editStartTime.value = formatDateTimeLocal(entry.startTime)
  editEndTime.value = entry.endTime ? formatDateTimeLocal(entry.endTime) : ''
}

const formatDateTimeLocal = (date: Date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const closeEditModal = () => {
  editingEntry.value = null
  editStartTime.value = ''
  editEndTime.value = ''
}

const handleSaveEdit = () => {
  if (!editingEntry.value || !editStartTime.value || !editEndTime.value) return

  const startTime = new Date(editStartTime.value)
  const endTime = new Date(editEndTime.value)

  store.updateEntry(editingEntry.value.id, startTime, endTime)
  closeEditModal()
}

const handleDeleteEntry = () => {
  if (!editingEntry.value) return

  if (confirm('Are you sure you want to delete this activity?')) {
    store.deleteEntry(editingEntry.value.id)
    closeEditModal()
  }
}
</script>
