import { useState, useEffect, useCallback } from 'react'

export type NotificationPermissionState = 'granted' | 'denied' | 'default'

export interface UseNotificationPermissionReturn {
  permissionState: NotificationPermissionState
  requestPermission: () => Promise<NotificationPermissionState>
  checkPermission: () => void
}

/**
 * Custom hook to manage browser notification permissions.
 *
 * This hook provides:
 * - Current permission state (granted/denied/default)
 * - Function to request permission from the user
 * - Function to manually check/refresh permission state
 *
 * Used by NotificationContext to provide notification permission state
 * to the entire application.
 *
 * @returns {UseNotificationPermissionReturn} Object containing permission state and control functions
 */
export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>('default')

  // Check current permission state
  const checkPermission = useCallback(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }, [])

  // Request permission from user
  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notification API not available')
      return 'denied'
    }

    try {
      const permission = await Notification.requestPermission()
      setPermissionState(permission)
      return permission
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return 'denied'
    }
  }, [])

  // Check permission on mount
  useEffect(() => {
    checkPermission()
  }, [checkPermission])

  return {
    permissionState,
    requestPermission,
    checkPermission,
  }
}
