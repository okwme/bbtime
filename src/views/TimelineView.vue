<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex-shrink-0">
      <div class="flex items-center justify-between mb-2">
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

      <!-- Day navigation and view controls -->
      <div class="flex items-center justify-between">
        <!-- Navigation -->
        <div class="flex items-center gap-2">
          <button
            @click="navigatePrevious"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
            title="Previous"
          >
            <span class="text-gray-700">‹</span>
          </button>
          <button
            @click="navigateToday"
            :disabled="dayOffset === 0"
            class="px-3 py-1 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Go to today"
          >
            Today
          </button>
          <button
            @click="navigateNext"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
            title="Next"
          >
            <span class="text-gray-700">›</span>
          </button>
        </div>

        <!-- Day view selector -->
        <div class="flex items-center gap-1 text-xs">
          <button
            v-for="count in [1, 3, 5]"
            :key="count"
            @click="dayViewCount = count"
            class="px-3 py-1 rounded-lg border transition-colors"
            :class="dayViewCount === count ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
          >
            {{ count }}d
          </button>
        </div>
      </div>
    </div>

    <!-- Calendar Content -->
    <div v-if="visibleDays.length === 0" class="flex-1 flex items-center justify-center">
      <p class="text-gray-500 text-lg">No activity recorded yet</p>
    </div>

    <div
      v-else
      ref="calendarScrollContainer"
      class="flex-1 overflow-x-hidden overflow-y-auto touch-pan-y"
      style="touch-action: pan-y;"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- Calendar Grid -->
      <div class="flex p-4 gap-4 justify-center" :style="{ height: calendarHeight }">
        <!-- Day Column -->
        <div
          v-for="day in visibleDays"
          :key="day.date"
          class="flex-1 max-w-xs flex flex-col"
        >
          <!-- Day Header -->
          <div class="mb-3 text-center rounded-lg py-2 px-2" :class="isToday(day.date) ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border border-gray-200'">
            <div class="text-sm font-bold" :class="isToday(day.date) ? 'text-blue-900' : 'text-gray-900'">{{ formatDayOfWeek(day.date) }}</div>
            <div class="text-2xl font-bold" :class="isToday(day.date) ? 'text-blue-900' : 'text-gray-900'">{{ formatDayNumber(day.date) }}</div>
            <div class="text-sm" :class="isToday(day.date) ? 'text-blue-700' : 'text-gray-700'">{{ formatMonth(day.date) }}</div>
          </div>

          <!-- 24-Hour Column -->
          <div
            class="flex-1 relative bg-white rounded-lg border-2 border-gray-200 overflow-hidden"
          >
            <!-- Hour grid lines (faint) - matches time markers -->
            <div class="absolute inset-0 flex flex-col pointer-events-none">
              <div
                v-for="(marker, index) in timeMarkers"
                :key="`grid-${index}`"
                class="flex-1 border-b border-gray-100"
                :class="{ 'last:border-b-0': index === timeMarkers.length - 1 }"
              ></div>
            </div>

            <!-- Activity blocks -->
            <div
              v-for="entry in visibleEntries(day.entries)"
              :key="entry.id"
              class="absolute transition-opacity hover:opacity-90 flex flex-col items-center justify-center border-l-4 overflow-hidden select-none"
              :class="[
                getActivityColorClass(entry.type),
                'cursor-pointer hover:ring-2 hover:ring-blue-400'
              ]"
              :style="getColumnStyle(entry)"
              @mousedown="(e: MouseEvent) => handleBlockMouseDown(e, entry, day.date)"
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

            <!-- Drag preview -->
            <div
              v-if="dragState.isDragging && dragState.entry && dragState.dateKey === day.date"
              class="absolute flex flex-col items-center justify-center border-l-4 overflow-hidden opacity-60 pointer-events-none ring-2 ring-blue-500"
              :class="getActivityColorClass(dragState.entry.type)"
              :style="getColumnStyle(dragState.entry)"
            >
              <span class="text-xs font-bold" :class="getTextColorClass(dragState.entry.type)">
                {{ getActivityEmoji(dragState.entry.type) }}
              </span>
            </div>

            <!-- Time markers on the side -->
            <div class="absolute inset-y-0 left-0 pointer-events-none px-1" :class="timeMarkerClass">
              <div
                v-for="(marker, index) in timeMarkers"
                :key="`${marker.label}-${index}`"
                class="absolute left-0 transform -translate-y-1/2"
                :style="{ top: `${marker.position}%` }"
                :class="marker.emphasized ? 'text-gray-900' : 'text-gray-700'"
              >
                {{ marker.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating + Button -->
    <button
      @click="showCreateModal = true"
      class="fixed bottom-20 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-light z-40 transition-transform hover:scale-110"
      title="Add new activity"
    >
      +
    </button>

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
            <select
              v-model="editActivityType"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            >
              <option value="sleeping">😴 Sleeping</option>
              <option value="eating">🍼 Eating</option>
              <option value="awake">👶 Awake</option>
            </select>
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
            <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <span>End Time</span>
              <label class="flex items-center gap-1 text-xs font-normal text-gray-600">
                <input
                  v-model="isOngoing"
                  type="checkbox"
                  class="rounded border-gray-300"
                />
                <span>Ongoing</span>
              </label>
            </label>
            <input
              v-if="!isOngoing"
              v-model="editEndTime"
              type="datetime-local"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div v-else class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
              Activity is ongoing
            </div>
          </div>

          <!-- Duration Display -->
          <div class="text-sm text-gray-600">
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

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeCreateModal"
    >
      <div class="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 class="text-xl font-bold mb-4 text-gray-800">Add New Activity</h3>

        <div class="space-y-4">
          <!-- Activity Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <select
              v-model="createActivityType"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            >
              <option value="sleeping">😴 Sleeping</option>
              <option value="eating">🍼 Eating</option>
              <option value="awake">👶 Awake</option>
            </select>
          </div>

          <!-- Start Time -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              v-model="createStartTime"
              type="datetime-local"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- End Time -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              v-model="createEndTime"
              type="datetime-local"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- Buttons -->
          <div class="flex gap-2 mt-6">
            <button
              @click="handleCreateEntry"
              :disabled="!createStartTime || !createEndTime"
              class="flex-1 bg-blue-500 text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
          <button
            @click="closeCreateModal"
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
const editActivityType = ref<ActivityType>('awake')
const isOngoing = ref(false)
const currentTime = ref(new Date())
const zoomLevel = ref(4) // 0 (most out) to 5 (most in) - default to 15min
const dayViewCount = ref(3) // 1, 3, or 5 days
const dayOffset = ref(0) // Offset from today
let intervalId: number | null = null

// Touch/pinch zoom state
let initialPinchDistance = 0
let initialZoomLevel = 4
let isPinching = false

// Drag editing state
interface DragState {
  isDragging: boolean
  mode: 'move' | 'resize-start' | 'resize-end' | null
  entry: ActivityEntry | null
  originalStartTime: Date | null
  originalEndTime: Date | null
  dateKey: string | null
  startY: number
  currentY: number
  holdTimer: number | null
}

const dragState = ref<DragState>({
  isDragging: false,
  mode: null,
  entry: null,
  originalStartTime: null,
  originalEndTime: null,
  dateKey: null,
  startY: 0,
  currentY: 0,
  holdTimer: null
})

const showCreateModal = ref(false)
const createActivityType = ref<ActivityType>('eating')
const createStartTime = ref('')
const createEndTime = ref('')
const calendarScrollContainer = ref<HTMLElement | null>(null)

// Zoom configuration
const zoomConfig = [
  { height: 300, interval: 6, label: 'Day' },      // Level 0: Every 6 hours (12a, 6a, 12p, 6p)
  { height: 400, interval: 2, label: '2h' },       // Level 1: Every 2 hours
  { height: 600, interval: 1, label: '1h' },       // Level 2: Every hour
  { height: 1200, interval: 0.5, label: '30m' },   // Level 3: Every 30 minutes
  { height: 2400, interval: 0.25, label: '15m' },  // Level 4: Every 15 minutes
  { height: 4800, interval: 1/12, label: '5m' }    // Level 5: Every 5 minutes
]

const calendarHeight = computed(() => {
  const config = zoomConfig[zoomLevel.value]
  return config ? `${config.height}px` : '600px'
})

const zoomLabel = computed(() => {
  const config = zoomConfig[zoomLevel.value]
  return config ? config.label : '1h'
})

const timeMarkerClass = computed(() => {
  if (zoomLevel.value <= 1) return 'text-xs font-semibold'
  if (zoomLevel.value <= 3) return 'text-xs font-semibold'
  return 'text-[10px] font-medium'
})

const timeMarkers = computed(() => {
  const config = zoomConfig[zoomLevel.value]
  if (!config) return []

  const interval = config.interval
  const markers: { label: string; emphasized: boolean; position: number }[] = []

  if (interval >= 1) {
    // Hourly or less frequent - generate exactly the right number of markers
    const count = Math.floor(24 / interval)
    for (let i = 0; i <= count; i++) {
      const hour = i * interval
      if (hour > 24) break

      const displayHour = hour === 0 ? 12 : hour === 24 ? 12 : hour > 12 ? hour - 12 : hour
      const period = hour < 12 || hour === 24 ? 'a' : 'p'
      const emphasized = hour % 6 === 0
      const position = (hour / 24) * 100 // Percentage position
      markers.push({ label: `${displayHour}${period}`, emphasized, position })
    }
  } else {
    // Sub-hourly (30min, 15min, 5min)
    const minuteInterval = Math.round(interval * 60)
    const totalMinutes = 24 * 60
    const count = Math.floor(totalMinutes / minuteInterval)

    for (let i = 0; i <= count; i++) {
      const mins = i * minuteInterval
      if (mins > totalMinutes) break

      const hour = Math.floor(mins / 60)
      const minute = mins % 60

      // Handle hour display
      let displayHour = hour === 0 ? 12 : hour === 24 ? 12 : hour > 12 ? hour - 12 : hour
      const period = hour < 12 || hour === 24 ? 'a' : 'p'

      const position = (mins / totalMinutes) * 100 // Percentage position

      if (minute === 0) {
        markers.push({ label: `${displayHour}${period}`, emphasized: hour % 6 === 0, position })
      } else {
        markers.push({ label: `:${String(minute).padStart(2, '0')}`, emphasized: false, position })
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

// Navigation functions
const navigatePrevious = () => {
  dayOffset.value -= dayViewCount.value
}

const navigateNext = () => {
  dayOffset.value += dayViewCount.value
}

const navigateToday = () => {
  dayOffset.value = 0
}

// Visible days based on current view settings
const visibleDays = computed(() => store.getGroupedDays(dayViewCount.value, dayOffset.value))

// Touch/pinch zoom handlers
const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
    isPinching = true
    initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1])
    initialZoomLevel = zoomLevel.value
    e.preventDefault()
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (isPinching && e.touches.length === 2 && e.touches[0] && e.touches[1]) {
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

// Drag editing helper functions
const snapToFiveMinutes = (date: Date): Date => {
  const snapped = new Date(date)
  const minutes = snapped.getMinutes()
  const snappedMinutes = Math.round(minutes / 5) * 5
  snapped.setMinutes(snappedMinutes, 0, 0)
  return snapped
}

const yPositionToTime = (y: number, containerHeight: number, dateStr: string): Date => {
  const config = zoomConfig[zoomLevel.value]
  if (!config) return new Date()

  // Calculate what percentage down the column we clicked
  const percentage = Math.max(0, Math.min(1, y / containerHeight))

  // Convert to minutes in the day (0-1440)
  const minutesInDay = percentage * 1440

  // Create date for this time
  const date = new Date(dateStr + 'T00:00:00')
  date.setMinutes(minutesInDay)

  return snapToFiveMinutes(date)
}

const isNearEdge = (mouseY: number, blockTop: number, blockHeight: number): 'top' | 'bottom' | 'center' => {
  const edgeThreshold = 8 // pixels
  const distanceFromTop = mouseY - blockTop
  const distanceFromBottom = (blockTop + blockHeight) - mouseY

  if (distanceFromTop < edgeThreshold) return 'top'
  if (distanceFromBottom < edgeThreshold) return 'bottom'
  return 'center'
}

const hasOverlap = (entries: ActivityEntry[], excludeId?: string): boolean => {
  const sortedEntries = entries
    .filter(e => e.id !== excludeId && e.endTime !== null)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  for (let i = 0; i < sortedEntries.length - 1; i++) {
    const current = sortedEntries[i]
    const next = sortedEntries[i + 1]
    if (current && next && current.endTime && current.endTime.getTime() > next.startTime.getTime()) {
      return true
    }
  }
  return false
}

const checkForOverlap = (entries: ActivityEntry[], testEntry: ActivityEntry): boolean => {
  // Check if testEntry would overlap with any existing entries (excluding itself and current-activity)
  return entries.some(entry => {
    if (entry.id === testEntry.id || entry.id === 'current-activity' || !entry.endTime || !testEntry.endTime) {
      return false
    }

    // Check if ranges overlap
    const testStart = testEntry.startTime.getTime()
    const testEnd = testEntry.endTime.getTime()
    const entryStart = entry.startTime.getTime()
    const entryEnd = entry.endTime.getTime()

    // Overlap if: testStart < entryEnd AND testEnd > entryStart
    return testStart < entryEnd && testEnd > entryStart
  })
}

// Drag editing event handlers
const handleBlockMouseDown = (e: MouseEvent, entry: ActivityEntry, dateKey: string) => {
  if (entry.id === 'current-activity') {
    // Current activity opens edit modal immediately
    handleEditEntry(entry)
    return
  }

  e.stopPropagation()
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const relativeY = e.clientY - rect.top

  const edge = isNearEdge(relativeY, 0, rect.height)

  // Start a timer to detect hold (200ms)
  const holdTimer = window.setTimeout(() => {
    // Hold detected - start drag
    // Trigger haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10) // 10ms click vibration
    }

    dragState.value = {
      isDragging: true,
      mode: edge === 'top' ? 'resize-start' : edge === 'bottom' ? 'resize-end' : 'move',
      entry: { ...entry },
      originalStartTime: new Date(entry.startTime),
      originalEndTime: entry.endTime ? new Date(entry.endTime) : null,
      dateKey,
      startY: e.clientY,
      currentY: e.clientY,
      holdTimer: null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, 200)

  dragState.value.holdTimer = holdTimer

  // Add temporary mouseup to cancel if released quickly (click)
  const handleQuickRelease = () => {
    if (dragState.value.holdTimer) {
      clearTimeout(dragState.value.holdTimer)
      dragState.value.holdTimer = null
      // Quick release = click = open edit modal
      handleEditEntry(entry)
    }
    document.removeEventListener('mouseup', handleQuickRelease)
  }

  document.addEventListener('mouseup', handleQuickRelease)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!dragState.value.isDragging || !dragState.value.entry) return

  dragState.value.currentY = e.clientY

  const deltaY = e.clientY - dragState.value.startY
  const config = zoomConfig[zoomLevel.value]
  if (!config) return

  // Convert pixel delta to time delta (minutes)
  const minutesPerPixel = 1440 / config.height
  const deltaMinutes = Math.round((deltaY * minutesPerPixel) / 5) * 5 // Snap to 5 minutes

  const entry = dragState.value.entry
  const originalStart = dragState.value.originalStartTime
  const originalEnd = dragState.value.originalEndTime

  if (!originalStart) return

  if (dragState.value.mode === 'move') {
    // Move both start and end
    entry.startTime = new Date(originalStart.getTime() + deltaMinutes * 60000)
    if (originalEnd) {
      entry.endTime = new Date(originalEnd.getTime() + deltaMinutes * 60000)
    }
  } else if (dragState.value.mode === 'resize-start') {
    // Only move start time
    const newStart = new Date(originalStart.getTime() + deltaMinutes * 60000)
    if (!originalEnd || newStart.getTime() < originalEnd.getTime() - 5 * 60000) {
      entry.startTime = newStart
    }
  } else if (dragState.value.mode === 'resize-end' || dragState.value.mode === 'create') {
    // Only move end time
    if (originalEnd) {
      const newEnd = new Date(originalEnd.getTime() + deltaMinutes * 60000)
      if (newEnd.getTime() > originalStart.getTime() + 5 * 60000) {
        entry.endTime = newEnd
      }
    }
  }
}

const handleMouseUp = () => {
  if (!dragState.value.isDragging || !dragState.value.entry) {
    dragState.value.isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    return
  }

  const entry = dragState.value.entry
  const dateKey = dragState.value.dateKey

  if (dragState.value.mode === 'create') {
    // Create new entry
    if (entry.endTime) {
      store.createEntry(entry.type, entry.startTime, entry.endTime)

      // Auto-merge after creation
      if (dateKey) {
        mergeAdjacentSameType(dateKey)
      }
    }
  } else {
    // Check for overlaps before updating
    if (entry.endTime && dateKey) {
      const day = store.getGroupedDays(dayViewCount.value, dayOffset.value).find(d => d.date === dateKey)
      if (day) {
        const wouldOverlap = checkForOverlap(day.entries, entry)

        if (wouldOverlap) {
          alert('Cannot move activity - it would overlap with another activity. Please resolve the conflict first.')
          dragState.value.isDragging = false
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
          return
        }
      }

      // Update existing entry
      store.updateEntry(entry.id, entry.startTime, entry.endTime, entry.type)

      // Auto-merge after update
      mergeAdjacentSameType(dateKey)
    }
  }

  dragState.value.isDragging = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// Update current time every second to trigger reactivity for ongoing activities
onMounted(async () => {
  await store.initialize()

  // Scroll to current time
  if (calendarScrollContainer.value) {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const minutesIntoDay = hours * 60 + minutes
    const percentage = minutesIntoDay / 1440 // 1440 minutes in a day

    const config = zoomConfig[zoomLevel.value]
    if (config) {
      const scrollPosition = (percentage * config.height) - (calendarScrollContainer.value.clientHeight / 3)
      calendarScrollContainer.value.scrollTop = Math.max(0, scrollPosition)
    }
  }

  intervalId = window.setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

const isToday = (dateStr: string) => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`
  return dateStr === todayStr
}

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
  const minDuration = minDurations[zoomLevel.value] ?? 5 // Default to 5 minutes

  return entries.filter(entry => {
    // Always show ongoing activities (no endTime)
    if (!entry.endTime) return true

    // Calculate duration in minutes
    const durationMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()
    const durationMinutes = durationMs / 60000

    // Show based on zoom level threshold
    return durationMinutes >= minDuration
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

  const config = zoomConfig[zoomLevel.value]
  if (!config) return false

  const endTime = entry.endTime ? new Date(entry.endTime) : currentTime.value
  const durationMinutes = (endTime.getTime() - new Date(entry.startTime).getTime()) / 60000

  // Calculate pixel height of this block
  const heightPercent = (durationMinutes / 1440) * 100
  const pixelHeight = (heightPercent / 100) * config.height

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
  editActivityType.value = entry.type
  isOngoing.value = !entry.endTime
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
  editActivityType.value = 'awake'
  isOngoing.value = false
}

const handleSaveEdit = () => {
  if (!editingEntry.value || !editStartTime.value) return
  if (!isOngoing.value && !editEndTime.value) return

  const entry = editingEntry.value // Store reference for TypeScript
  const startTime = new Date(editStartTime.value)
  const endTime = isOngoing.value ? null : new Date(editEndTime.value)
  const activityType = editActivityType.value

  // Check if editing the current ongoing activity
  if (entry.id === 'current-activity') {
    // Update current activity state in store
    store.updateCurrentActivity(startTime, endTime, activityType)
  } else {
    // Update completed entry
    if (endTime) {
      store.updateEntry(entry.id, startTime, endTime, activityType)
    }
  }

  closeEditModal()
}

const handleDeleteEntry = () => {
  if (!editingEntry.value) return

  const entry = editingEntry.value // Store reference for TypeScript

  if (confirm('Are you sure you want to delete this activity?')) {
    store.deleteEntry(entry.id)
    closeEditModal()
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createActivityType.value = 'eating'
  createStartTime.value = ''
  createEndTime.value = ''
}

const handleCreateEntry = () => {
  if (!createStartTime.value || !createEndTime.value) return

  const startTime = snapToFiveMinutes(new Date(createStartTime.value))
  const endTime = snapToFiveMinutes(new Date(createEndTime.value))

  if (endTime.getTime() <= startTime.getTime()) {
    alert('End time must be after start time')
    return
  }

  // Check for overlaps before creating
  const dateKey = startTime.toISOString().split('T')[0] as string
  const day = store.getGroupedDays(dayViewCount.value, dayOffset.value).find(d => d.date === dateKey)

  if (day) {
    const testEntry: ActivityEntry = {
      id: 'temp',
      type: createActivityType.value,
      startTime,
      endTime
    }

    const wouldOverlap = checkForOverlap(day.entries, testEntry)

    if (wouldOverlap) {
      alert('Cannot create activity - it would overlap with an existing activity. Please choose a different time.')
      return
    }
  }

  // Create the entry
  store.createEntry(createActivityType.value, startTime, endTime)

  // Auto-merge adjacent same-type events
  mergeAdjacentSameType(dateKey)

  closeCreateModal()
}

const mergeAdjacentSameType = (dateKey: string) => {
  const day = store.getGroupedDays(dayViewCount.value, dayOffset.value).find(d => d.date === dateKey)
  if (!day) return

  // Sort entries by start time
  const sortedEntries = [...day.entries]
    .filter(e => e.id !== 'current-activity' && e.endTime !== null)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  // Find adjacent entries of same type that touch or overlap
  for (let i = 0; i < sortedEntries.length - 1; i++) {
    const current = sortedEntries[i]
    const next = sortedEntries[i + 1]

    if (!current || !next || !current.endTime) continue

    // Check if same type and adjacent/overlapping (within 5 minutes tolerance)
    if (current.type === next.type) {
      const gap = next.startTime.getTime() - current.endTime.getTime()
      const fiveMinutes = 5 * 60 * 1000

      if (gap <= fiveMinutes) {
        // Merge: extend current to next's end time, delete next
        const mergedEndTime = next.endTime || new Date()
        store.updateEntry(current.id, current.startTime, mergedEndTime, current.type)
        store.deleteEntry(next.id)

        // Recursively check for more merges
        mergeAdjacentSameType(dateKey)
        return
      }
    }
  }
}
</script>
