import type { ActivityEntry } from '@/types'

const JSONBIN_API_BASE = 'https://api.jsonbin.io/v3'
const DEVICE_ID_KEY = 'baby-tracker-device-id'

/**
 * Get or create a unique device ID for this device
 * Stored in localStorage so it persists across sessions
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    // Generate a unique ID using crypto.randomUUID if available, otherwise use timestamp + random
    deviceId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

/**
 * Validate that an API key looks complete
 * Bcrypt hashes are typically 60 characters and start with $2a$ or $2b$
 */
function validateApiKey(key: string): boolean {
  if (!key || key.length < 50) {
    return false
  }
  // Bcrypt hashes start with $2a$ or $2b$ followed by cost (usually $10$ or $12$)
  if (!key.match(/^\$2[ab]\$\d{2}\$/)) {
    return false
  }
  return true
}

// Get API key from localStorage or environment
// You can set this in the app settings or hardcode for simplicity
function getApiKey(): string | null {
  // Try localStorage first (user can set in settings)
  const storedKey = localStorage.getItem('jsonbin-api-key')
  if (storedKey) {
    console.log('[JSONBin] Using API key from localStorage', storedKey)
    return storedKey
  }

  // Fallback to environment variable (for deployment)
  // Note: In Vite, env vars are replaced at build time, so they must be set during build
  const envKey = import.meta.env.VITE_JSONBIN_API_KEY
  if (envKey) {
    console.log('[JSONBin] Using API key from environment variable, ', envKey)
    // Trim whitespace in case it was accidentally added
    return envKey.trim()
  }

  // Debug: Check if env var exists but is empty/undefined
  if (import.meta.env.VITE_JSONBIN_API_KEY === '') {
    console.warn('[JSONBin] VITE_JSONBIN_API_KEY is set but empty')
  } else if (import.meta.env.VITE_JSONBIN_API_KEY === undefined) {
    console.warn('[JSONBin] VITE_JSONBIN_API_KEY is not defined. Make sure it\'s set in .env file or environment')
  }

  return null
}

/**
 * Determine if a key is a master key or access key
 * Master keys typically start with $2a$ (bcrypt) but we can't reliably detect
 * So we'll try to use X-Master-Key first, and fall back to X-Access-Key
 * Actually, JSONBin.io requires you to know which type you have.
 * Master keys use X-Master-Key, Access keys use X-Access-Key
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('JSONBin API key not found. Set VITE_JSONBIN_API_KEY or store in localStorage as "jsonbin-api-key"')
    return headers
  }

  // Debug: Log key info (masked for security)
  const keyLength = apiKey.length
  const keyPrefix = apiKey.substring(0, 7) // First 7 chars (e.g., "$2a$10.")
  const keySuffix = apiKey.substring(Math.max(0, keyLength - 4)) // Last 4 chars
  console.log(`[JSONBin] Using API key:${apiKey}  ${keyPrefix}...${keySuffix} (length: ${keyLength})`)
  
  // Validate key format
  if (!validateApiKey(apiKey)) {
    console.error(`[JSONBin] ERROR: API key appears invalid or truncated!`)
    console.error(`[JSONBin] Key length: ${keyLength} (expected ~60 chars)`)
    console.error(`[JSONBin] Key prefix: ${keyPrefix}`)
    console.error(`[JSONBin] Full key value:`, apiKey)
    console.error(`[JSONBin] Please check that your API key is complete and correctly set.`)
    throw new Error('Invalid JSONBin API key: key appears to be truncated or invalid. Please check your VITE_JSONBIN_API_KEY environment variable or localStorage value.')
  }

  // Check if key type is stored in localStorage (user preference)
  const keyType = localStorage.getItem('jsonbin-key-type') || 'master'
  
  // Use appropriate header based on key type
  // Master keys have full access, Access keys have restricted permissions
    headers['X-Access-Key'] = apiKey
 

  return headers
}

export interface SyncData {
  entries: ActivityEntry[]
  currentActivity: 'sleeping' | 'awake' | 'eating'
  isEating: boolean
  currentEntryStartTime: string // ISO date string
  lastUpdated: string // ISO date string
  writerDeviceId?: string // ID of the device that last wrote to the store
}

export interface RoomInfo {
  binId: string
  roomCode: string
}

/**
 * Generate a user-friendly room code from bin ID
 * Format: ABC-DEF (6 characters, uppercase)
 */
export function formatRoomCode(binId: string): string {
  // Take last 6 chars of bin ID and format as XXX-XXX
  const code = binId.slice(-6).toUpperCase()
  return `${code.slice(0, 3)}-${code.slice(3)}`
}

/**
 * Extract bin ID from room code (for backwards compatibility)
 * Removes dashes and converts to lowercase
 */
export function parseRoomCode(roomCode: string): string {
  return roomCode.replace('-', '').toLowerCase().trim()
}

/**
 * Create a new room (bin) and return the room info
 */
export async function createRoom(initialData: SyncData): Promise<RoomInfo> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('JSONBin API key is required. Please set VITE_JSONBIN_API_KEY or store in localStorage as "jsonbin-api-key"')
  }

  try {
    const headers = getHeaders()
    const deviceId = getDeviceId()
    const response = await fetch(`${JSONBIN_API_BASE}/b`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...initialData,
        writerDeviceId: deviceId,
        lastUpdated: new Date().toISOString()
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Failed to create room: ${response.status} ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorMessage
      } catch {
        // If not JSON, use the text as-is
        if (errorText) errorMessage += ` - ${errorText}`
      }

      // Provide helpful error messages for common issues
      if (response.status === 401 || response.status === 403) {
        errorMessage += '. Please check your API key is correct and has the right permissions.'
      }

      throw new Error(errorMessage)
    }

    const result = await response.json()
    const binId = result.metadata.id

    if (!binId) {
      throw new Error('Invalid response from JSONBin: missing bin ID')
    }

    return {
      binId,
      roomCode: formatRoomCode(binId)
    }
  } catch (error) {
    console.error('Error creating room:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error creating room')
  }
}

/**
 * Fetch data from a room
 */
export async function fetchRoomData(binId: string): Promise<SyncData | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('JSONBin API key not found. Cannot fetch room data.')
    return null
  }

  try {
    const headers = getHeaders()
    const response = await fetch(`${JSONBIN_API_BASE}/b/${binId}/latest`, {
      headers
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null // Room doesn't exist
      }

      const errorText = await response.text()
      let errorMessage = `Failed to fetch room: ${response.status} ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorMessage
      } catch {
        if (errorText) errorMessage += ` - ${errorText}`
      }

      if (response.status === 401 || response.status === 403) {
        errorMessage += '. Please check your API key is correct and has the right permissions.'
      }

      console.error('Error fetching room:', errorMessage)
      throw new Error(errorMessage)
    }

    const result = await response.json()
    return result.record
  } catch (error) {
    console.error('Error fetching room:', error)
    if (error instanceof Error && error.message.includes('Failed to fetch room')) {
      throw error
    }
    return null
  }
}

/**
 * Update room data
 */
export async function updateRoomData(binId: string, data: SyncData, forceWrite: boolean = false): Promise<boolean> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('JSONBin API key not found. Cannot update room data.')
    return false
  }

  try {
    const headers = getHeaders()
    const deviceId = getDeviceId()
    const response = await fetch(`${JSONBIN_API_BASE}/b/${binId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...data,
        writerDeviceId: deviceId, // Always set the writer device ID when writing
        lastUpdated: new Date().toISOString()
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Failed to update room: ${response.status} ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorMessage
      } catch {
        if (errorText) errorMessage += ` - ${errorText}`
      }

      if (response.status === 401 || response.status === 403) {
        errorMessage += '. Please check your API key is correct and has the right permissions.'
      }

      console.error('Error updating room:', errorMessage)
      throw new Error(errorMessage)
    }

    return true
  } catch (error) {
    console.error('Error updating room:', error)
    return false
  }
}

/**
 * Check if a SyncData has a "real" ongoing activity (not just a default state)
 * An ongoing activity is considered "real" if it started more than a few seconds ago
 * and there's no completed entry that would conflict with it
 */
function hasOngoingActivity(data: SyncData): boolean {
  const currentStart = new Date(data.currentEntryStartTime)
  const now = new Date()
  const timeSinceStart = now.getTime() - currentStart.getTime()
  
  // Must have started at least 5 seconds ago (to avoid treating just-initialized states as ongoing)
  if (timeSinceStart < 5000) {
    return false
  }

  // Check if there's a completed entry that ends after the current activity started
  // If so, this might be a stale state
  const hasConflictingEntry = data.entries.some(entry => {
    if (!entry.endTime) return false
    const entryEnd = new Date(entry.endTime)
    return entryEnd.getTime() > currentStart.getTime()
  })

  return !hasConflictingEntry
}

/**
 * Merge local and remote data
 * Strategy: Keep all unique entries, prioritize ongoing activities
 */
export function mergeData(local: SyncData, remote: SyncData): SyncData {
  // Merge entries - keep unique by ID
  const entriesMap = new Map<string, ActivityEntry>()

  // Add all local entries
  local.entries.forEach(entry => {
    entriesMap.set(entry.id, entry)
  })

  // Add remote entries (will overwrite if ID exists)
  remote.entries.forEach(entry => {
    entriesMap.set(entry.id, entry)
  })

  const mergedEntries = Array.from(entriesMap.values())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  // Determine which current state to use
  const localHasOngoing = hasOngoingActivity(local)
  const remoteHasOngoing = hasOngoingActivity(remote)
  const localStartTime = new Date(local.currentEntryStartTime).getTime()
  const remoteStartTime = new Date(remote.currentEntryStartTime).getTime()
  const localUpdated = new Date(local.lastUpdated).getTime()
  const remoteUpdated = new Date(remote.lastUpdated).getTime()

  let useRemoteState: boolean

  if (localHasOngoing && !remoteHasOngoing) {
    // Local has ongoing activity, remote doesn't - use local
    useRemoteState = false
  } else if (remoteHasOngoing && !localHasOngoing) {
    // Remote has ongoing activity, local doesn't - use remote
    useRemoteState = true
  } else if (localHasOngoing && remoteHasOngoing) {
    // Both have ongoing activities - use the one that started more recently
    // (more recent start = newer activity)
    useRemoteState = remoteStartTime > localStartTime
  } else {
    // Neither has a real ongoing activity - use most recently updated
    useRemoteState = remoteUpdated > localUpdated
  }

  // Preserve the remote writerDeviceId if it exists (we'll update it when we write)
  const writerDeviceId = remote.writerDeviceId || local.writerDeviceId

  return {
    entries: mergedEntries,
    currentActivity: useRemoteState ? remote.currentActivity : local.currentActivity,
    isEating: useRemoteState ? remote.isEating : local.isEating,
    currentEntryStartTime: useRemoteState ? remote.currentEntryStartTime : local.currentEntryStartTime,
    lastUpdated: new Date().toISOString(),
    writerDeviceId
  }
}
