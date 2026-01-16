<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-4 py-4 flex-shrink-0">
      <h1 class="text-2xl font-bold text-gray-800 text-center">Timeline</h1>
    </div>

    <!-- Timeline Content -->
    <div class="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      <div v-if="store.groupedByDay.length === 0" class="text-center py-12">
        <p class="text-gray-500 text-lg">No activity recorded yet</p>
      </div>

      <!-- Day Cards -->
      <div
        v-for="day in store.groupedByDay"
        :key="day.date"
        class="bg-white rounded-xl shadow-md overflow-hidden"
      >
        <!-- Day Header -->
        <div class="bg-gray-100 px-4 py-3 border-b border-gray-200">
          <h2 class="font-bold text-lg text-gray-800">{{ formatDate(day.date) }}</h2>
          <p class="text-sm text-gray-600">{{ day.entries.length }} activities</p>
        </div>

        <!-- Timeline Visualization -->
        <div class="p-4">
          <!-- 24-hour grid visualization -->
          <div class="relative h-16 bg-gray-100 rounded-lg overflow-hidden mb-4">
            <div
              v-for="entry in day.entries"
              :key="entry.id"
              class="absolute top-0 bottom-0 cursor-pointer transition-opacity hover:opacity-80"
              :class="getActivityColorClass(entry.type)"
              :style="getTimelineStyle(entry)"
              @click="handleEditEntry(entry)"
            ></div>

            <!-- Hour markers -->
            <div class="absolute inset-0 flex">
              <div
                v-for="hour in 24"
                :key="hour"
                class="flex-1 border-r border-gray-300 last:border-r-0"
              ></div>
            </div>
          </div>

          <!-- Entry List -->
          <div class="space-y-2">
            <div
              v-for="entry in day.entries"
              :key="entry.id"
              class="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              @click="handleEditEntry(entry)"
            >
              <div class="flex items-center space-x-3">
                <div
                  class="w-4 h-4 rounded-full"
                  :class="getActivityColorClass(entry.type)"
                ></div>
                <div>
                  <div class="font-semibold text-gray-800">{{ getActivityLabel(entry.type) }}</div>
                  <div class="text-sm text-gray-600">
                    {{ formatTime(entry.startTime) }} - {{ formatTime(entry.endTime) }}
                  </div>
                </div>
              </div>
              <div class="text-sm font-medium text-gray-700">
                {{ getDuration(entry) }}
              </div>
            </div>
          </div>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
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

          <!-- Buttons -->
          <div class="flex space-x-3 mt-6">
            <button
              @click="handleSaveEdit"
              class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Save
            </button>
            <button
              @click="handleDeleteEntry"
              class="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Delete
            </button>
            <button
              @click="closeEditModal"
              class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBabyTrackerStore } from '@/stores/babyTracker'
import type { ActivityEntry, ActivityType } from '@/types'

const store = useBabyTrackerStore()
const editingEntry = ref<ActivityEntry | null>(null)
const editStartTime = ref('')
const editEndTime = ref('')

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateKey = date.toISOString().split('T')[0]
  const todayKey = today.toISOString().split('T')[0]
  const yesterdayKey = yesterday.toISOString().split('T')[0]

  if (dateKey === todayKey) {
    return 'Today'
  } else if (dateKey === yesterdayKey) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
}

const formatTime = (date: Date | null) => {
  if (!date) return 'Now'
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const getDuration = (entry: ActivityEntry) => {
  if (!entry.endTime) return 'Ongoing'

  const diff = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  } else {
    return `${mins}m`
  }
}

const getActivityLabel = (type: ActivityType) => {
  switch (type) {
    case 'sleeping':
      return '😴 Sleeping'
    case 'eating':
      return '🍼 Eating'
    case 'awake':
      return '👶 Awake'
    default:
      return type
  }
}

const getActivityColorClass = (type: ActivityType) => {
  switch (type) {
    case 'sleeping':
      return 'bg-indigo-500'
    case 'eating':
      return 'bg-green-500'
    case 'awake':
      return 'bg-amber-500'
    default:
      return 'bg-gray-400'
  }
}

const getTimelineStyle = (entry: ActivityEntry) => {
  const dayStart = new Date(entry.startTime)
  dayStart.setHours(0, 0, 0, 0)

  const startMinutes = (new Date(entry.startTime).getTime() - dayStart.getTime()) / 60000
  const endTime = entry.endTime ? new Date(entry.endTime) : new Date()
  const endMinutes = (endTime.getTime() - dayStart.getTime()) / 60000

  const startPercent = (startMinutes / 1440) * 100
  const widthPercent = ((endMinutes - startMinutes) / 1440) * 100

  return {
    left: `${startPercent}%`,
    width: `${widthPercent}%`
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
