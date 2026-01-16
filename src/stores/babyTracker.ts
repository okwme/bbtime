import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ActivityEntry, ActivityType, DayData } from '@/types'
import { createRoom, fetchRoomData, updateRoomData, mergeData, parseRoomCode, type SyncData, type RoomInfo } from '@/services/jsonbin'

const STORAGE_KEY = 'baby-tracker-data'
const ROOM_KEY = 'baby-tracker-room'
const SYNC_INTERVAL = 15000 // 15 seconds

export const useBabyTrackerStore = defineStore('babyTracker', () => {
  // State
  const entries = ref<ActivityEntry[]>([])
  const currentActivity = ref<ActivityType>('awake')
  const isEating = ref(false)
  const currentEntryStartTime = ref<Date>(new Date())

  // Sync state
  const roomInfo = ref<RoomInfo | null>(null)
  const isSyncing = ref(false)
  const lastSyncTime = ref<Date | null>(null)
  const syncError = ref<string | null>(null)
  let syncInterval: number | null = null

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

      // Load room info
      const storedRoom = localStorage.getItem(ROOM_KEY)
      if (storedRoom) {
        roomInfo.value = JSON.parse(storedRoom)
        startAutoSync()
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

      // Auto-sync if connected to room
      if (roomInfo.value) {
        syncToCloud()
      }
    } catch (error) {
      console.error('Error saving to storage:', error)
    }
  }

  // Convert store state to SyncData format
  const toSyncData = (): SyncData => {
    return {
      entries: entries.value.map(e => ({
        ...e,
        startTime: e.startTime,
        endTime: e.endTime
      })),
      currentActivity: currentActivity.value,
      isEating: isEating.value,
      currentEntryStartTime: currentEntryStartTime.value.toISOString(),
      lastUpdated: new Date().toISOString()
    }
  }

  // Apply SyncData to store state
  const fromSyncData = (data: SyncData) => {
    entries.value = data.entries.map(entry => ({
      ...entry,
      startTime: new Date(entry.startTime),
      endTime: entry.endTime ? new Date(entry.endTime) : null
    }))
    currentActivity.value = data.currentActivity
    isEating.value = data.isEating
    currentEntryStartTime.value = new Date(data.currentEntryStartTime)
    saveToStorage()
  }

  // Sync to cloud
  const syncToCloud = async () => {
    if (!roomInfo.value || isSyncing.value) return

    try {
      isSyncing.value = true
      syncError.value = null

      const localData = toSyncData()
      const success = await updateRoomData(roomInfo.value.binId, localData)

      if (success) {
        lastSyncTime.value = new Date()
      }
    } catch (error) {
      console.error('Sync error:', error)
      syncError.value = 'Failed to sync'
    } finally {
      isSyncing.value = false
    }
  }

  // Sync from cloud
  const syncFromCloud = async () => {
    if (!roomInfo.value || isSyncing.value) return

    try {
      isSyncing.value = true
      syncError.value = null

      const remoteData = await fetchRoomData(roomInfo.value.binId)
      if (!remoteData) {
        syncError.value = 'Room not found'
        return
      }

      const localData = toSyncData()
      const merged = mergeData(localData, remoteData)

      fromSyncData(merged)

      // Push merged data back
      await updateRoomData(roomInfo.value.binId, merged)
      lastSyncTime.value = new Date()
    } catch (error) {
      console.error('Sync error:', error)
      syncError.value = 'Failed to sync'
    } finally {
      isSyncing.value = false
    }
  }

  // Start auto-sync
  const startAutoSync = () => {
    if (syncInterval) return

    // Initial sync
    syncFromCloud()

    // Set up interval
    syncInterval = window.setInterval(() => {
      syncFromCloud()
    }, SYNC_INTERVAL)
  }

  // Stop auto-sync
  const stopAutoSync = () => {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  }

  // Create a new room
  const createNewRoom = async () => {
    try {
      isSyncing.value = true
      syncError.value = null

      const initialData = toSyncData()
      const newRoomInfo = await createRoom(initialData)

      roomInfo.value = newRoomInfo
      localStorage.setItem(ROOM_KEY, JSON.stringify(newRoomInfo))

      startAutoSync()

      return newRoomInfo
    } catch (error) {
      console.error('Error creating room:', error)
      syncError.value = 'Failed to create room'
      throw error
    } finally {
      isSyncing.value = false
    }
  }

  // Join an existing room
  const joinRoom = async (roomCode: string) => {
    try {
      isSyncing.value = true
      syncError.value = null

      const binId = parseRoomCode(roomCode)
      const remoteData = await fetchRoomData(binId)

      if (!remoteData) {
        syncError.value = 'Room not found'
        throw new Error('Room not found')
      }

      // Merge with local data
      const localData = toSyncData()
      const merged = mergeData(localData, remoteData)

      fromSyncData(merged)

      // Save room info
      const newRoomInfo: RoomInfo = { binId, roomCode }
      roomInfo.value = newRoomInfo
      localStorage.setItem(ROOM_KEY, JSON.stringify(newRoomInfo))

      // Push merged data
      await updateRoomData(binId, merged)

      startAutoSync()

      return newRoomInfo
    } catch (error) {
      console.error('Error joining room:', error)
      syncError.value = 'Failed to join room'
      throw error
    } finally {
      isSyncing.value = false
    }
  }

  // Leave current room
  const leaveRoom = () => {
    stopAutoSync()
    roomInfo.value = null
    lastSyncTime.value = null
    syncError.value = null
    localStorage.removeItem(ROOM_KEY)
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

  const isConnectedToRoom = computed(() => roomInfo.value !== null)

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

    // Sync state
    roomInfo,
    isSyncing,
    lastSyncTime,
    syncError,

    // Computed
    currentActivityType,
    groupedByDay,
    elapsedTime,
    isConnectedToRoom,

    // Actions
    toggleSleepAwake,
    toggleEating,
    updateEntry,
    deleteEntry,
    initialize,

    // Sync actions
    createNewRoom,
    joinRoom,
    leaveRoom,
    syncToCloud,
    syncFromCloud
  }
})
