import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ActivityEntry, ActivityType, DayData } from '@/types'
import { createRoom, fetchRoomData, updateRoomData, mergeData, parseRoomCode, formatRoomCode, getDeviceId, type SyncData, type RoomInfo } from '@/services/jsonbin'
import {
  loadNotificationSettings,
  saveNotificationSettings,
  showNotification,
  type NotificationSettings
} from '@/services/notifications'

const STORAGE_KEY = 'baby-tracker-data'
const ROOM_KEY = 'baby-tracker-room'
const SYNC_INTERVAL = 15000 // 15 seconds

// Helper function to format date in local timezone as YYYY-MM-DD
// This avoids timezone issues with toISOString() which converts to UTC
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

  // Writer device state
  const isReadOnly = ref(false)
  const currentWriterDeviceId = ref<string | null>(null)
  const pendingWriteAction = ref<(() => void) | null>(null)
  const showWriterTakeoverDialog = ref(false)

  // Notification state
  const notificationSettings = ref<NotificationSettings>(loadNotificationSettings())
  const lastAwakeAlert = ref<Date | null>(null)
  const lastSleepAlert = ref<Date | null>(null)
  let notificationCheckInterval: number | null = null

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
    const deviceId = getDeviceId()
    return {
      entries: entries.value.map(e => ({
        ...e,
        startTime: e.startTime,
        endTime: e.endTime
      })),
      currentActivity: currentActivity.value,
      isEating: isEating.value,
      currentEntryStartTime: currentEntryStartTime.value.toISOString(),
      lastUpdated: new Date().toISOString(),
      writerDeviceId: deviceId
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
    
    // Check writer device ID
    const deviceId = getDeviceId()
    const remoteWriterId = data.writerDeviceId
    
    if (remoteWriterId && remoteWriterId !== deviceId) {
      // Another device is the writer
      const previousWriterId = currentWriterDeviceId.value
      currentWriterDeviceId.value = remoteWriterId
      
      // Only show dialog if:
      // 1. We're not already in read-only mode
      // 2. The dialog isn't already showing
      // 3. This is a new writer (different from what we saw before)
      if (!isReadOnly.value && !showWriterTakeoverDialog.value && previousWriterId !== remoteWriterId) {
        // Show dialog to ask if user wants to take over
        showWriterTakeoverDialog.value = true
      }
    } else if (remoteWriterId === deviceId) {
      // We are the writer
      currentWriterDeviceId.value = deviceId
      isReadOnly.value = false
      showWriterTakeoverDialog.value = false // Close dialog if it was open
    } else {
      // No writer set yet, we can become the writer
      currentWriterDeviceId.value = deviceId
      isReadOnly.value = false
      showWriterTakeoverDialog.value = false // Close dialog if it was open
    }
    
    saveToStorage()
  }

  // Sync to cloud
  const syncToCloud = async () => {
    if (!roomInfo.value || isSyncing.value || isReadOnly.value) return

    try {
      isSyncing.value = true
      syncError.value = null

      const localData = toSyncData()
      const success = await updateRoomData(roomInfo.value.binId, localData)

      if (success) {
        lastSyncTime.value = new Date()
        // Update our writer status
        const deviceId = getDeviceId()
        currentWriterDeviceId.value = deviceId
        isReadOnly.value = false
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

      // Only push merged data back if we're the writer
      if (!isReadOnly.value) {
        await updateRoomData(roomInfo.value.binId, merged)
        lastSyncTime.value = new Date()
      }
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

      // When creating a room, we automatically become the writer
      const deviceId = getDeviceId()
      currentWriterDeviceId.value = deviceId
      isReadOnly.value = false

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
  const joinRoom = async (binIdOrCode: string) => {
    try {
      isSyncing.value = true
      syncError.value = null

      // Accept either full bin ID or use parseRoomCode for backwards compatibility
      const binId = binIdOrCode.includes('-') ? parseRoomCode(binIdOrCode) : binIdOrCode.trim()
      const remoteData = await fetchRoomData(binId)

      if (!remoteData) {
        syncError.value = 'Room not found'
        throw new Error('Room not found')
      }

      // Merge with local data
      const localData = toSyncData()
      const merged = mergeData(localData, remoteData)

      fromSyncData(merged)

      // Save room info (generate roomCode for backwards compatibility)
      const roomCode = formatRoomCode(binId)
      const newRoomInfo: RoomInfo = { binId, roomCode }
      roomInfo.value = newRoomInfo
      localStorage.setItem(ROOM_KEY, JSON.stringify(newRoomInfo))

      // Only push merged data if we're the writer (or if there's no writer yet)
      // The fromSyncData function will have set isReadOnly appropriately
      if (!isReadOnly.value) {
        await updateRoomData(binId, merged)
      }

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

  const getGroupedDays = (dayCount: number, offset: number): DayData[] => {
    const groups = new Map<string, ActivityEntry[]>()

    // Generate date range based on requested day count and offset
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate start and end based on day count
    // When offset=0, today is the leftmost column
    const startOffset = offset
    const endOffset = offset + dayCount - 1

    for (let i = startOffset; i <= endOffset; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateKey = formatDateLocal(date)
      groups.set(dateKey, [])
    }

    // Add all completed entries (only within the requested date range)
    entries.value.forEach(entry => {
      const dateKey = formatDateLocal(entry.startTime)
      // Only add entries that fall within the requested date range
      if (groups.has(dateKey)) {
        const group = groups.get(dateKey)
        if (group) {
          group.push(entry)
        }
      }
    })

    // Add current ongoing activity (only if within the requested date range)
    const currentEntry: ActivityEntry = {
      id: 'current-activity',
      type: currentActivityType.value,
      startTime: currentEntryStartTime.value,
      endTime: null // Ongoing
    }
    const currentDateKey = formatDateLocal(currentEntryStartTime.value)
    if (groups.has(currentDateKey)) {
      const currentGroup = groups.get(currentDateKey)
      if (currentGroup) {
        currentGroup.push(currentEntry)
      }
    }

    return Array.from(groups.entries())
      .map(([date, entries]) => ({
        date,
        entries: entries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      }))
      .sort((a, b) => a.date.localeCompare(b.date)) // Ascending order (old to new, left to right)
  }

  // Default computed version for backward compatibility
  const groupedByDay = computed<DayData[]>(() => getGroupedDays(3, 0))

  const elapsedTime = computed(() => {
    const now = new Date()
    const diff = now.getTime() - currentEntryStartTime.value.getTime()
    return Math.floor(diff / 1000) // seconds
  })

  const isConnectedToRoom = computed(() => roomInfo.value !== null)

  // Notification functions
  const checkNotifications = () => {
    if (!notificationSettings.value.enabled) return

    const now = new Date()
    const elapsedMinutes = (now.getTime() - currentEntryStartTime.value.getTime()) / 60000

    // Check awake alert
    if (currentActivityType.value === 'awake' && elapsedMinutes >= notificationSettings.value.awakeAlertMinutes) {
      // Only alert once per session, or if 30 minutes have passed since last alert
      if (!lastAwakeAlert.value || (now.getTime() - lastAwakeAlert.value.getTime()) > 30 * 60000) {
        const hours = Math.floor(elapsedMinutes / 60)
        const mins = Math.floor(elapsedMinutes % 60)
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
        showNotification(
          '👶 Baby has been awake a while',
          `Baby has been awake for ${timeStr}. Consider nap time?`,
          'awake-alert'
        )
        lastAwakeAlert.value = now
      }
    }

    // Check sleep alert
    if (currentActivityType.value === 'sleeping' && elapsedMinutes >= notificationSettings.value.sleepAlertMinutes) {
      if (!lastSleepAlert.value || (now.getTime() - lastSleepAlert.value.getTime()) > 30 * 60000) {
        const hours = Math.floor(elapsedMinutes / 60)
        const mins = Math.floor(elapsedMinutes % 60)
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
        showNotification(
          '😴 Baby has been sleeping a while',
          `Baby has been asleep for ${timeStr}. Check if they need feeding?`,
          'sleep-alert'
        )
        lastSleepAlert.value = now
      }
    }
  }

  const startNotificationChecks = () => {
    if (notificationCheckInterval) return

    // Check every minute
    notificationCheckInterval = window.setInterval(() => {
      checkNotifications()
    }, 60000) // Check every minute

    // Initial check
    checkNotifications()
  }

  const stopNotificationChecks = () => {
    if (notificationCheckInterval) {
      clearInterval(notificationCheckInterval)
      notificationCheckInterval = null
    }
  }

  const updateNotificationSettings = (settings: NotificationSettings) => {
    notificationSettings.value = settings
    saveNotificationSettings(settings)

    if (settings.enabled) {
      startNotificationChecks()
    } else {
      stopNotificationChecks()
    }
  }

  // Writer device management
  const takeOverWriteRole = async () => {
    const deviceId = getDeviceId()
    currentWriterDeviceId.value = deviceId
    isReadOnly.value = false
    showWriterTakeoverDialog.value = false
    
    // Immediately sync to claim write role
    if (roomInfo.value) {
      const localData = toSyncData()
      await updateRoomData(roomInfo.value.binId, localData)
    }
    
    // Execute any pending write action
    if (pendingWriteAction.value) {
      const action = pendingWriteAction.value
      pendingWriteAction.value = null
      action()
    }
  }

  const declineWriteRole = () => {
    isReadOnly.value = true
    showWriterTakeoverDialog.value = false
    pendingWriteAction.value = null
  }

  const requestWriteAccess = (action: () => void): boolean => {
    const deviceId = getDeviceId()
    
    // If we're already the writer, execute immediately
    if (currentWriterDeviceId.value === deviceId || !currentWriterDeviceId.value) {
      return true
    }
    
    // If we're in read-only mode, ask to take over
    if (isReadOnly.value || currentWriterDeviceId.value !== deviceId) {
      pendingWriteAction.value = action
      showWriterTakeoverDialog.value = true
      return false
    }
    
    return true
  }

  // Actions
  const toggleSleepAwake = () => {
    if (!requestWriteAccess(() => toggleSleepAwake())) {
      return // Will be executed after user confirms take-over
    }

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

    // Reset alert trackers
    lastAwakeAlert.value = null
    lastSleepAlert.value = null

    saveToStorage()
  }

  const toggleEating = () => {
    if (!requestWriteAccess(() => toggleEating())) {
      return // Will be executed after user confirms take-over
    }

    // If currently eating, end eating period and return to awake
    if (isEating.value) {
      const newEntry: ActivityEntry = {
        id: crypto.randomUUID(),
        type: 'eating',
        startTime: currentEntryStartTime.value,
        endTime: new Date()
      }
      entries.value.push(newEntry)

      isEating.value = false
      currentActivity.value = 'awake'
      currentEntryStartTime.value = new Date()

      // Reset alert trackers
      lastAwakeAlert.value = null
      lastSleepAlert.value = null
    } else {
      // End current activity (sleeping or awake) and start eating
      const newEntry: ActivityEntry = {
        id: crypto.randomUUID(),
        type: currentActivity.value,
        startTime: currentEntryStartTime.value,
        endTime: new Date()
      }
      entries.value.push(newEntry)

      isEating.value = true
      currentActivity.value = 'awake' // Eating is a type of awake state
      currentEntryStartTime.value = new Date()

      // Reset alert trackers
      lastAwakeAlert.value = null
      lastSleepAlert.value = null
    }

    saveToStorage()
  }

  const updateEntry = (id: string, startTime: Date, endTime: Date, type?: ActivityType) => {
    if (!requestWriteAccess(() => updateEntry(id, startTime, endTime, type))) {
      return // Will be executed after user confirms take-over
    }

    const entry = entries.value.find(e => e.id === id)
    if (entry) {
      entry.startTime = startTime
      entry.endTime = endTime
      if (type) {
        entry.type = type
      }
      saveToStorage()
    }
  }

  const updateCurrentActivity = (startTime: Date, endTime: Date | null, type?: ActivityType) => {
    if (!requestWriteAccess(() => updateCurrentActivity(startTime, endTime, type))) {
      return // Will be executed after user confirms take-over
    }

    // Update the current activity start time
    currentEntryStartTime.value = startTime

    // Update the current activity type if provided
    if (type) {
      // Check if type changed
      if (type === 'eating') {
        // If changing to eating, set isEating flag
        if (currentActivity.value === 'sleeping') {
          currentActivity.value = 'awake'
        }
        isEating.value = true
      } else if (type === 'sleeping' || type === 'awake') {
        currentActivity.value = type
        isEating.value = false
      }
    }

    // If endTime is provided, end the current activity and start a new one
    if (endTime) {
      const newEntry: ActivityEntry = {
        id: crypto.randomUUID(),
        type: currentActivityType.value,
        startTime: currentEntryStartTime.value,
        endTime: endTime
      }
      entries.value.push(newEntry)
      currentEntryStartTime.value = endTime
    }

    saveToStorage()
  }

  const createEntry = (type: ActivityType, startTime: Date, endTime: Date) => {
    if (!requestWriteAccess(() => createEntry(type, startTime, endTime))) {
      return // Will be executed after user confirms take-over
    }

    const newEntry: ActivityEntry = {
      id: crypto.randomUUID(),
      type,
      startTime,
      endTime
    }
    entries.value.push(newEntry)
    saveToStorage()
  }

  const deleteEntry = (id: string) => {
    if (!requestWriteAccess(() => deleteEntry(id))) {
      return // Will be executed after user confirms take-over
    }

    entries.value = entries.value.filter(e => e.id !== id)
    saveToStorage()
  }

  const initialize = async () => {
    loadFromStorage()

    // Auto-join default room if not already connected
    // Set this to your JSONBin bin ID to auto-connect on load
    const DEFAULT_BIN_ID = '6969d1f2d0ea881f406f476b'
    if (!roomInfo.value && DEFAULT_BIN_ID) {
      try {
        await joinRoom(DEFAULT_BIN_ID)
        console.log('Connected to default room')
        // After joining, wait a moment for initial sync to complete
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.warn('Could not auto-join default room:', error)
        // Continue without sync - this is non-blocking
      }
    }

    // If no data, check if we need to create a default state
    // Only create default state if we have no entries AND the currentEntryStartTime is very recent
    // (indicating it might be uninitialized or just created, not a synced ongoing activity)
    // This prevents overwriting synced ongoing activities
    if (entries.value.length === 0) {
      const timeSinceStart = new Date().getTime() - currentEntryStartTime.value.getTime()
      // If current activity started less than 2 seconds ago, it's likely uninitialized
      // Create a fresh default state
      if (timeSinceStart < 2000) {
        currentActivity.value = 'awake'
        isEating.value = false
        currentEntryStartTime.value = new Date()
        saveToStorage()
      }
    }

    // Start notification checks if enabled
    if (notificationSettings.value.enabled) {
      startNotificationChecks()
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

    // Writer device state
    isReadOnly,
    currentWriterDeviceId,
    showWriterTakeoverDialog,

    // Notification state
    notificationSettings,

    // Computed
    currentActivityType,
    groupedByDay,
    getGroupedDays,
    elapsedTime,
    isConnectedToRoom,

    // Actions
    toggleSleepAwake,
    toggleEating,
    updateEntry,
    updateCurrentActivity,
    createEntry,
    deleteEntry,
    initialize,

    // Sync actions
    createNewRoom,
    joinRoom,
    leaveRoom,
    syncToCloud,
    syncFromCloud,

    // Writer device actions
    takeOverWriteRole,
    declineWriteRole,

    // Notification actions
    updateNotificationSettings,
    startNotificationChecks,
    stopNotificationChecks
  }
})
