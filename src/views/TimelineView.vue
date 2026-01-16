<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex-shrink-0">
      <h1 class="text-xl font-bold text-gray-800 text-center">Activity Calendar</h1>
    </div>

    <!-- Calendar Content -->
    <div v-if="store.groupedByDay.length === 0" class="flex-1 flex items-center justify-center">
      <p class="text-gray-500 text-lg">No activity recorded yet</p>
    </div>

    <div v-else class="flex-1 overflow-x-auto overflow-y-hidden">
      <!-- Calendar Grid -->
      <div class="h-full flex p-4 gap-3 min-w-min">
        <!-- Day Column -->
        <div
          v-for="day in store.groupedByDay"
          :key="day.date"
          class="flex-shrink-0 w-24 flex flex-col"
        >
          <!-- Day Header -->
          <div class="mb-2 text-center">
            <div class="text-xs font-bold text-gray-800">{{ formatDayOfWeek(day.date) }}</div>
            <div class="text-lg font-bold text-gray-900">{{ formatDayNumber(day.date) }}</div>
            <div class="text-xs text-gray-600">{{ formatMonth(day.date) }}</div>
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
              class="absolute left-0 right-0 cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center"
              :class="getActivityColorClass(entry.type)"
              :style="getColumnStyle(entry)"
              @click="handleEditEntry(entry)"
            >
              <span class="text-white text-xs font-bold transform -rotate-0">
                {{ getActivityEmoji(entry.type) }}
              </span>
            </div>

            <!-- Time markers on the side -->
            <div class="absolute inset-y-0 left-0 flex flex-col text-xs text-gray-400 pointer-events-none px-1" style="justify-content: space-between;">
              <div>12a</div>
              <div>2a</div>
              <div>4a</div>
              <div>6a</div>
              <div>8a</div>
              <div>10a</div>
              <div>12p</div>
              <div>2p</div>
              <div>4p</div>
              <div>6p</div>
              <div>8p</div>
              <div>10p</div>
            </div>
          </div>

          <!-- Summary -->
          <div class="mt-2 text-center">
            <div class="flex justify-around text-xs">
              <div class="flex flex-col items-center">
                <span class="text-lg">😴</span>
                <span class="text-gray-600">{{ getDaySummary(day, 'sleeping') }}</span>
              </div>
              <div class="flex flex-col items-center">
                <span class="text-lg">🍼</span>
                <span class="text-gray-600">{{ getDaySummary(day, 'eating') }}</span>
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
          <div class="w-3 h-3 rounded bg-indigo-500"></div>
          <span class="text-gray-700">Sleeping</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded bg-green-500"></div>
          <span class="text-gray-700">Eating</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded bg-amber-500"></div>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useBabyTrackerStore } from '@/stores/babyTracker'
import type { ActivityEntry, ActivityType, DayData } from '@/types'

const store = useBabyTrackerStore()
const editingEntry = ref<ActivityEntry | null>(null)
const editStartTime = ref('')
const editEndTime = ref('')
const currentTime = ref(new Date())
let intervalId: number | null = null

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
    case 'sleeping': return 'bg-indigo-500'
    case 'eating': return 'bg-green-500'
    case 'awake': return 'bg-amber-500'
    default: return 'bg-gray-400'
  }
}

const visibleEntries = (entries: ActivityEntry[]) => {
  return entries.filter(entry => {
    // Always show ongoing activities (no endTime)
    if (!entry.endTime) return true

    // Calculate duration in minutes
    const durationMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()
    const durationMinutes = durationMs / 60000

    // Only show if >= 5 minutes
    return durationMinutes >= 5
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
    height: `${Math.max(heightPercent, 2)}%` // Minimum 2% height for visibility
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
