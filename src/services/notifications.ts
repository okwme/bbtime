// Notification service for baby tracker alerts

export interface NotificationSettings {
  enabled: boolean
  awakeAlertMinutes: number  // Alert when baby has been awake for this long
  sleepAlertMinutes: number  // Alert when baby has been asleep for this long
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  awakeAlertMinutes: 90, // 1.5 hours
  sleepAlertMinutes: 120 // 2 hours
}

const STORAGE_KEY = 'baby-tracker-notification-settings'

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

// Show a notification
export function showNotification(title: string, body: string, tag?: string) {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications')
    return
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return
  }

  // Use service worker if available for better background support
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: tag || 'baby-tracker',
        requireInteraction: true, // Keep notification visible
        vibrate: [200, 100, 200],
      })
    })
  } else {
    // Fallback to regular notification
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: tag || 'baby-tracker',
      requireInteraction: true,
    })
  }
}

// Load notification settings
export function loadNotificationSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Error loading notification settings:', error)
  }
  return DEFAULT_SETTINGS
}

// Save notification settings
export function saveNotificationSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Error saving notification settings:', error)
  }
}

// Check if notifications are supported
export function areNotificationsSupported(): boolean {
  return 'Notification' in window
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | null {
  if (!('Notification' in window)) {
    return null
  }
  return Notification.permission
}
