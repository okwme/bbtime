<template>
  <div class="h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex-shrink-0">
      <h1 class="text-xl font-bold text-gray-800 text-center">Settings</h1>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Notifications Section -->
      <div class="bg-white rounded-xl shadow-md p-6 mb-4">
        <h2 class="text-lg font-bold text-gray-800 mb-3">🔔 Notifications</h2>

        <!-- Enable Notifications Toggle -->
        <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div>
            <div class="font-medium text-gray-900">Enable Alerts</div>
            <div class="text-sm text-gray-600">Get notified about sleep/wake times</div>
          </div>
          <label class="relative inline-block w-12 h-6">
            <input
              v-model="notifSettings.enabled"
              type="checkbox"
              class="sr-only peer"
              @change="handleNotificationToggle"
            />
            <div class="w-12 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
            <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
          </label>
        </div>

        <!-- Permission Status -->
        <div v-if="notifSettings.enabled && notificationPermission !== 'granted'" class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div class="text-sm text-amber-900 mb-2">
            <span class="font-medium">Permission needed:</span> Allow notifications when prompted
          </div>
          <button
            @click="requestPermission"
            class="w-full bg-amber-600 text-white py-2 px-3 rounded-lg text-sm font-medium"
          >
            Request Permission
          </button>
        </div>

        <!-- Alert Settings -->
        <div v-if="notifSettings.enabled" class="space-y-4">
          <!-- Awake Alert -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Alert when awake for (minutes)
            </label>
            <input
              v-model.number="notifSettings.awakeAlertMinutes"
              type="number"
              min="1"
              max="300"
              step="15"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg"
              @change="saveNotificationSettings"
            />
            <div class="text-xs text-gray-500 mt-1">
              Default: 90 minutes (1.5 hours)
            </div>
          </div>

          <!-- Sleep Alert -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Alert when asleep for (minutes)
            </label>
            <input
              v-model.number="notifSettings.sleepAlertMinutes"
              type="number"
              min="1"
              max="300"
              step="15"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg"
              @change="saveNotificationSettings"
            />
            <div class="text-xs text-gray-500 mt-1">
              Default: 120 minutes (2 hours)
            </div>
          </div>
        </div>

        <!-- iOS Limitations Note -->
        <div v-if="notifSettings.enabled" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <div class="text-sm text-blue-900">
            <strong>📱 iPhone Note:</strong> Notifications work when the app is open or in background. iOS doesn't support lock screen widgets or interactive buttons for web apps.
          </div>
        </div>
      </div>

      <div class="border-t-8 border-gray-100 my-4"></div>
      <h2 class="text-lg font-bold text-gray-800 mb-4">☁️ Cloud Sync</h2>

      <!-- Connected State -->
      <div v-if="store.isConnectedToRoom" class="space-y-4">
        <!-- Room Info Card -->
        <div class="bg-white rounded-xl shadow-md p-6">
          <div class="text-center mb-4">
            <div class="text-green-500 text-4xl mb-2">✓</div>
            <h2 class="text-lg font-bold text-gray-800">Connected to Room</h2>
          </div>

          <!-- Room ID Display -->
          <div class="bg-gray-100 rounded-lg p-4 mb-4">
            <div class="text-sm text-gray-600 mb-1">Room ID</div>
            <div class="text-sm font-mono text-center text-gray-900 break-all px-2 py-2 bg-white rounded border border-gray-200">
              {{ store.roomInfo?.binId }}
            </div>
            <button
              @click="copyRoomCode"
              class="w-full mt-3 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium"
            >
              {{ copied ? '✓ Copied!' : '📋 Copy ID' }}
            </button>
          </div>

          <!-- Sync Status -->
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Status</span>
              <span class="font-medium" :class="syncStatusClass">
                {{ syncStatusText }}
              </span>
            </div>
            <div v-if="store.lastSyncTime" class="flex justify-between">
              <span class="text-gray-600">Last Sync</span>
              <span class="font-medium text-gray-900">{{ formatSyncTime }}</span>
            </div>
            <div v-if="store.syncError" class="text-red-500 text-center mt-2">
              {{ store.syncError }}
            </div>
          </div>

          <!-- Leave Room Button -->
          <button
            @click="handleLeaveRoom"
            class="w-full mt-6 bg-red-500 text-white py-3 px-4 rounded-xl font-bold"
          >
            Leave Room
          </button>
        </div>

        <!-- Instructions -->
        <div class="bg-blue-50 rounded-lg p-4">
          <h3 class="font-bold text-blue-900 mb-2">Share with Others</h3>
          <p class="text-sm text-blue-800">
            Share your room ID with other caregivers so everyone sees the same data in real-time!
          </p>
        </div>
      </div>

      <!-- Not Connected State -->
      <div v-else class="space-y-4">
        <!-- Create Room -->
        <div class="bg-white rounded-xl shadow-md p-6">
          <h2 class="text-lg font-bold text-gray-800 mb-3">Create New Room</h2>
          <p class="text-sm text-gray-600 mb-4">
            Start a new shared room and get a code to share with others
          </p>
          <button
            @click="handleCreateRoom"
            :disabled="store.isSyncing"
            class="w-full bg-green-500 text-white py-3 px-4 rounded-xl font-bold disabled:opacity-50"
          >
            {{ store.isSyncing ? 'Creating...' : '+ Create Room' }}
          </button>
        </div>

        <!-- Join Room -->
        <div class="bg-white rounded-xl shadow-md p-6">
          <h2 class="text-lg font-bold text-gray-800 mb-3">Join Existing Room</h2>
          <p class="text-sm text-gray-600 mb-4">
            Enter a room ID to sync with others
          </p>

          <input
            v-model="joinCode"
            type="text"
            placeholder="Paste room ID here"
            class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-mono mb-4"
          />

          <button
            @click="handleJoinRoom"
            :disabled="!isValidJoinCode || store.isSyncing"
            class="w-full bg-blue-500 text-white py-3 px-4 rounded-xl font-bold disabled:opacity-50"
          >
            {{ store.isSyncing ? 'Joining...' : 'Join Room' }}
          </button>

          <div v-if="joinError" class="text-red-500 text-center text-sm mt-2">
            {{ joinError }}
          </div>
        </div>

        <!-- Info -->
        <div class="bg-amber-50 rounded-lg p-4">
          <h3 class="font-bold text-amber-900 mb-2">How It Works</h3>
          <ul class="text-sm text-amber-800 space-y-1">
            <li>• Data syncs every 15 seconds automatically</li>
            <li>• All devices in the same room see the same data</li>
            <li>• Changes merge automatically</li>
            <li>• Works offline - syncs when reconnected</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBabyTrackerStore } from '@/stores/babyTracker'
import {
  requestNotificationPermission,
  getNotificationPermission,
  type NotificationSettings
} from '@/services/notifications'

const store = useBabyTrackerStore()

const joinCode = ref('')
const joinError = ref('')
const copied = ref(false)

// Notification state
const notifSettings = ref<NotificationSettings>({ ...store.notificationSettings })
const notificationPermission = ref(getNotificationPermission())

const isValidJoinCode = computed(() => {
  // Bin IDs are typically 24 characters (hexadecimal)
  const cleaned = joinCode.value.trim()
  return cleaned.length >= 20
})

const syncStatusClass = computed(() => {
  if (store.isSyncing) return 'text-blue-500'
  if (store.syncError) return 'text-red-500'
  return 'text-green-500'
})

const syncStatusText = computed(() => {
  if (store.isSyncing) return 'Syncing...'
  if (store.syncError) return 'Error'
  return 'Synced'
})

const formatSyncTime = computed(() => {
  if (!store.lastSyncTime) return ''

  const now = new Date()
  const diff = now.getTime() - store.lastSyncTime.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
})

const handleCreateRoom = async () => {
  try {
    joinError.value = ''
    await store.createNewRoom()
  } catch (error) {
    joinError.value = 'Failed to create room. Please try again.'
  }
}

const handleJoinRoom = async () => {
  if (!isValidJoinCode.value) return

  try {
    joinError.value = ''
    // Use bin ID directly (trim whitespace)
    await store.joinRoom(joinCode.value.trim())
    joinCode.value = ''
  } catch (error) {
    joinError.value = 'Room not found. Check the ID and try again.'
  }
}

const handleLeaveRoom = () => {
  if (confirm('Leave this room? You can rejoin later with the room ID.')) {
    store.leaveRoom()
  }
}

const copyRoomCode = async () => {
  if (!store.roomInfo?.binId) return

  try {
    await navigator.clipboard.writeText(store.roomInfo.binId)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = store.roomInfo.binId
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)

    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

// Notification handlers
const handleNotificationToggle = async () => {
  if (notifSettings.value.enabled) {
    const granted = await requestNotificationPermission()
    notificationPermission.value = getNotificationPermission()

    if (!granted) {
      notifSettings.value.enabled = false
      alert('Notification permission denied. Please enable in browser settings.')
      return
    }
  }

  saveNotificationSettings()
}

const requestPermission = async () => {
  await requestNotificationPermission()
  notificationPermission.value = getNotificationPermission()
}

const saveNotificationSettings = () => {
  store.updateNotificationSettings(notifSettings.value)
}
</script>
