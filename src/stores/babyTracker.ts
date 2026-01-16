import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ActivityEntry, ActivityType, DayData } from '@/types'

const STORAGE_KEY = 'baby-tracker-data'

export const useBabyTrackerStore = defineStore('babyTracker', () => {
  // State
  const entries = ref<ActivityEntry[]>([])
  const currentActivity = ref<ActivityType>('awake')
  const isEating = ref(false)
  const currentEntryStartTime = ref<Date>(new Date())

  // Load from localStorage on initialization
  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        entries.value = data.entries.map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : null
        }))

        // Restore current state
        if (data.currentActivity) {
          currentActivity.value = data.currentActivity
          isEating.value = data.isEating || false
          currentEntryStartTime.value = new Date(data.currentEntryStartTime)
        }
      }
    } catch (error) {
      console.error('Error loading from storage:', error)
    }
  }

  // Save to localStorage
  const saveToStorage = () => {
    try {
      const data = {
        entries: entries.value,
        currentActivity: currentActivity.value,
        isEating: isEating.value,
        currentEntryStartTime: currentEntryStartTime.value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving to storage:', error)
    }
  }

  // Computed
  const currentActivityType = computed<ActivityType>(() => {
    if (isEating.value) return 'eating'
    return currentActivity.value
  })

  const groupedByDay = computed<DayData[]>(() => {
    const groups = new Map<string, ActivityEntry[]>()

    entries.value.forEach(entry => {
      const dateKey = entry.startTime.toISOString().split('T')[0] as string
      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      const group = groups.get(dateKey)
      if (group) {
        group.push(entry)
      }
    })

    return Array.from(groups.entries())
      .map(([date, entries]) => ({
        date,
        entries: entries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  })

  const elapsedTime = computed(() => {
    const now = new Date()
    const diff = now.getTime() - currentEntryStartTime.value.getTime()
    return Math.floor(diff / 1000) // seconds
  })

  // Actions
  const toggleSleepAwake = () => {
    // End current entry
    const newEntry: ActivityEntry = {
      id: crypto.randomUUID(),
      type: currentActivityType.value,
      startTime: currentEntryStartTime.value,
      endTime: new Date()
    }
    entries.value.push(newEntry)

    // Start new entry with opposite state
    currentActivity.value = currentActivity.value === 'sleeping' ? 'awake' : 'sleeping'
    isEating.value = false // Reset eating when switching states
    currentEntryStartTime.value = new Date()

    saveToStorage()
  }

  const toggleEating = () => {
    if (currentActivity.value === 'sleeping') {
      // Can't eat while sleeping, switch to awake first
      toggleSleepAwake()
    }

    // If currently eating, end eating period
    if (isEating.value) {
      const newEntry: ActivityEntry = {
        id: crypto.randomUUID(),
        type: 'eating',
        startTime: currentEntryStartTime.value,
        endTime: new Date()
      }
      entries.value.push(newEntry)

      isEating.value = false
      currentEntryStartTime.value = new Date()
    } else {
      // If currently awake (not eating), end awake and start eating
      if (currentActivity.value === 'awake') {
        const newEntry: ActivityEntry = {
          id: crypto.randomUUID(),
          type: 'awake',
          startTime: currentEntryStartTime.value,
          endTime: new Date()
        }
        entries.value.push(newEntry)
      }

      isEating.value = true
      currentEntryStartTime.value = new Date()
    }

    saveToStorage()
  }

  const updateEntry = (id: string, startTime: Date, endTime: Date) => {
    const entry = entries.value.find(e => e.id === id)
    if (entry) {
      entry.startTime = startTime
      entry.endTime = endTime
      saveToStorage()
    }
  }

  const deleteEntry = (id: string) => {
    entries.value = entries.value.filter(e => e.id !== id)
    saveToStorage()
  }

  const initialize = () => {
    loadFromStorage()

    // If no data, start with awake state
    if (entries.value.length === 0) {
      currentActivity.value = 'awake'
      isEating.value = false
      currentEntryStartTime.value = new Date()
      saveToStorage()
    }
  }

  return {
    // State
    entries,
    currentActivity,
    isEating,
    currentEntryStartTime,

    // Computed
    currentActivityType,
    groupedByDay,
    elapsedTime,

    // Actions
    toggleSleepAwake,
    toggleEating,
    updateEntry,
    deleteEntry,
    initialize
  }
})
