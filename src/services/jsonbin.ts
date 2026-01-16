import type { ActivityEntry } from '@/types'

const JSONBIN_API_BASE = 'https://api.jsonbin.io/v3'

// Get API key from localStorage or environment
// You can set this in the app settings or hardcode for simplicity
function getApiKey(): string | null {
  // Try localStorage first (user can set in settings)
  const storedKey = localStorage.getItem('jsonbin-api-key')
  if (storedKey) return storedKey

  // Fallback to environment variable (for deployment)
  return import.meta.env.VITE_JSONBIN_API_KEY || null
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const apiKey = getApiKey()
  if (apiKey) {
    // JSONBin supports both X-Master-Key and X-Access-Key
    // Use X-Access-Key for access keys (bcrypt format)
    headers['X-Access-Key'] = apiKey
  }

  return headers
}

export interface SyncData {
  entries: ActivityEntry[]
  currentActivity: 'sleeping' | 'awake' | 'eating'
  isEating: boolean
  currentEntryStartTime: string // ISO date string
  lastUpdated: string // ISO date string
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
 * Extract bin ID from room code
 */
export function parseRoomCode(roomCode: string): string {
  return roomCode.replace('-', '').toLowerCase()
}

/**
 * Create a new room (bin) and return the room info
 */
export async function createRoom(initialData: SyncData): Promise<RoomInfo> {
  try {
    const response = await fetch(`${JSONBIN_API_BASE}/b`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...initialData,
        lastUpdated: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.statusText}`)
    }

    const result = await response.json()
    const binId = result.metadata.id

    return {
      binId,
      roomCode: formatRoomCode(binId)
    }
  } catch (error) {
    console.error('Error creating room:', error)
    throw error
  }
}

/**
 * Fetch data from a room
 */
export async function fetchRoomData(binId: string): Promise<SyncData | null> {
  try {
    const response = await fetch(`${JSONBIN_API_BASE}/b/${binId}/latest`, {
      headers: getHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null // Room doesn't exist
      }
      throw new Error(`Failed to fetch room: ${response.statusText}`)
    }

    const result = await response.json()
    return result.record
  } catch (error) {
    console.error('Error fetching room:', error)
    return null
  }
}

/**
 * Update room data
 */
export async function updateRoomData(binId: string, data: SyncData): Promise<boolean> {
  try {
    const response = await fetch(`${JSONBIN_API_BASE}/b/${binId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        ...data,
        lastUpdated: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update room: ${response.statusText}`)
    }

    return true
  } catch (error) {
    console.error('Error updating room:', error)
    return false
  }
}

/**
 * Merge local and remote data
 * Strategy: Keep all unique entries, use latest timestamp for current state
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

  // Use the most recently updated state
  const localUpdated = new Date(local.lastUpdated).getTime()
  const remoteUpdated = new Date(remote.lastUpdated).getTime()

  const useRemoteState = remoteUpdated > localUpdated

  return {
    entries: mergedEntries,
    currentActivity: useRemoteState ? remote.currentActivity : local.currentActivity,
    isEating: useRemoteState ? remote.isEating : local.isEating,
    currentEntryStartTime: useRemoteState ? remote.currentEntryStartTime : local.currentEntryStartTime,
    lastUpdated: new Date().toISOString()
  }
}
