import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'
import type { NotificationPermissionState } from '@/hooks/useNotificationPermission'

/**
 * localStorage keys for tracking notification permission state
 */
const STORAGE_KEY_DISMISSED = 'notification-permission-dismissed'
const STORAGE_KEY_LAST_CHECK = 'notification-permission-last-check'

export interface NotificationContextValue {
  /**
   * Convenience boolean for quick permission check
   */
  permissionGranted: boolean

  /**
   * Full permission state: "granted" | "denied" | "default"
   */
  permissionState: NotificationPermissionState

  /**
   * Whether the user has dismissed the permission banner
   */
  isDismissed: boolean

  /**
   * Request notification permission from the user
   * Must be called from a user gesture (button click)
   */
  requestPermission: () => Promise<NotificationPermissionState>

  /**
   * Dismiss the permission banner (stores in localStorage)
   */
  dismissBanner: () => void

  /**
   * Reset the dismissed state (for Settings to re-show banner)
   */
  resetDismissal: () => void

  /**
   * Manually check/refresh permission state
   */
  checkPermission: () => void

  /**
   * Send a browser notification for a session that needs input
   * Story 4.3: Browser Notifications When Claude Asks Questions
   *
   * @param sessionId - ID of the session needing input
   * @param sessionName - Name of the session for notification title
   * @param message - Generic message (e.g., "Claude is asking a question")
   * @param onClickHandler - Callback to invoke when notification is clicked
   */
  sendNotification: (
    sessionId: string,
    sessionName: string,
    message: string,
    onClickHandler: () => void
  ) => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export interface NotificationProviderProps {
  children: ReactNode
}

/**
 * NotificationContext Provider
 *
 * Provides notification permission state and management functions to the entire app.
 * Tracks whether user has dismissed the permission banner using localStorage.
 *
 * This is preparation for Epic 4 Story 4.3 which will add actual notification sending.
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  const { permissionState, requestPermission: hookRequestPermission, checkPermission } = useNotificationPermission()
  const [isDismissed, setIsDismissed] = useState(false)

  // Load dismissed state from localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED)
    if (dismissed === 'true') {
      setIsDismissed(true)
    }
  }, [])

  // Update last check timestamp when permission state changes
  useEffect(() => {
    if (permissionState !== 'default') {
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, new Date().toISOString())
    }
  }, [permissionState])

  // Dismiss banner and store in localStorage
  const dismissBanner = useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(STORAGE_KEY_DISMISSED, 'true')
  }, [])

  // Reset dismissal state (for Settings)
  const resetDismissal = useCallback(() => {
    setIsDismissed(false)
    localStorage.removeItem(STORAGE_KEY_DISMISSED)
  }, [])

  // Wrap request permission to auto-dismiss banner on completion
  const requestPermission = useCallback(async () => {
    const result = await hookRequestPermission()
    // Auto-dismiss banner after permission request (regardless of result)
    dismissBanner()
    return result
  }, [hookRequestPermission, dismissBanner])

  // Story 4.3: Send browser notification for background sessions
  const sendNotification = useCallback((
    sessionId: string,
    sessionName: string,
    message: string,
    onClickHandler: () => void
  ) => {
    // AC4.4: Check permission state first
    const isGranted = permissionState === 'granted'
    if (!isGranted) {
      console.log('Notification permission not granted, skipping notification', { sessionId })
      return // Graceful degradation - badge-only mode
    }

    // Check if browser supports Notification API
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notification API not available')
      return
    }

    // AC4.5: Create notification with security best practices
    // Title: "Session [name] needs input"
    // Body: Generic message (no terminal output or sensitive data)
    const notification = new Notification(`Session ${sessionName} needs input`, {
      body: message,
      tag: sessionId, // AC4.6: Session-scoped tag prevents duplicates
      icon: '/favicon.svg', // Optional: Claude logo or default
      requireInteraction: false, // Auto-dismiss after OS default
    })

    console.log('Browser notification sent', { sessionId, sessionName })

    // AC4.8: Click handler focuses session
    notification.onclick = () => {
      console.log('Notification clicked', { sessionId })
      window.focus() // Bring browser window to foreground
      onClickHandler() // Switch to session (provided by caller)
      notification.close()
    }
  }, [permissionState])

  const value: NotificationContextValue = {
    permissionGranted: permissionState === 'granted',
    permissionState,
    isDismissed,
    requestPermission,
    dismissBanner,
    resetDismissal,
    checkPermission,
    sendNotification,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Hook to consume NotificationContext
 *
 * @throws {Error} If used outside NotificationProvider
 */
export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
