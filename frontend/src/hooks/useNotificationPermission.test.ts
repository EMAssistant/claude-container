import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotificationPermission } from './useNotificationPermission'

describe('useNotificationPermission', () => {
  // Store original Notification object
  let originalNotification: typeof Notification | undefined

  beforeEach(() => {
    // Save original Notification
    originalNotification = (window as any).Notification

    // Mock Notification API
    const mockNotification = {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn(),
    }
    ;(window as any).Notification = mockNotification
  })

  afterEach(() => {
    // Restore original Notification
    if (originalNotification) {
      ;(window as any).Notification = originalNotification
    } else {
      delete (window as any).Notification
    }
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('initializes with "default" permission state', () => {
      const { result } = renderHook(() => useNotificationPermission())
      expect(result.current.permissionState).toBe('default')
    })

    it('checks permission on mount', async () => {
      ;(window as any).Notification.permission = 'granted'

      const { result } = renderHook(() => useNotificationPermission())

      await waitFor(() => {
        expect(result.current.permissionState).toBe('granted')
      })
    })

    it('handles "denied" permission on mount', async () => {
      ;(window as any).Notification.permission = 'denied'

      const { result } = renderHook(() => useNotificationPermission())

      await waitFor(() => {
        expect(result.current.permissionState).toBe('denied')
      })
    })
  })

  describe('requestPermission', () => {
    it('calls Notification.requestPermission and updates state to "granted"', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted')
      ;(window as any).Notification.requestPermission = mockRequestPermission

      const { result } = renderHook(() => useNotificationPermission())

      let permissionResult: string | undefined
      await act(async () => {
        permissionResult = await result.current.requestPermission()
      })

      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
      expect(permissionResult).toBe('granted')
      expect(result.current.permissionState).toBe('granted')
    })

    it('calls Notification.requestPermission and updates state to "denied"', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('denied')
      ;(window as any).Notification.requestPermission = mockRequestPermission

      const { result } = renderHook(() => useNotificationPermission())

      let permissionResult: string | undefined
      await act(async () => {
        permissionResult = await result.current.requestPermission()
      })

      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
      expect(permissionResult).toBe('denied')
      expect(result.current.permissionState).toBe('denied')
    })

    it('handles requestPermission error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockRequestPermission = vi.fn().mockRejectedValue(new Error('Permission denied by user'))
      ;(window as any).Notification.requestPermission = mockRequestPermission

      const { result } = renderHook(() => useNotificationPermission())

      let permissionResult: string | undefined
      await act(async () => {
        permissionResult = await result.current.requestPermission()
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(permissionResult).toBe('denied')
      consoleErrorSpy.mockRestore()
    })

    it('returns "denied" when Notification API not available', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      delete (window as any).Notification

      const { result } = renderHook(() => useNotificationPermission())

      let permissionResult: string | undefined
      await act(async () => {
        permissionResult = await result.current.requestPermission()
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith('Notification API not available')
      expect(permissionResult).toBe('denied')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('checkPermission', () => {
    it('manually updates permission state when called', async () => {
      ;(window as any).Notification.permission = 'default'

      const { result } = renderHook(() => useNotificationPermission())

      await waitFor(() => {
        expect(result.current.permissionState).toBe('default')
      })

      // Change permission externally
      ;(window as any).Notification.permission = 'granted'

      // Manually check permission
      await act(async () => {
        result.current.checkPermission()
      })

      await waitFor(() => {
        expect(result.current.permissionState).toBe('granted')
      })
    })

    it('handles missing Notification API gracefully', async () => {
      delete (window as any).Notification

      const { result } = renderHook(() => useNotificationPermission())

      await act(async () => {
        result.current.checkPermission()
      })

      // Should not throw, state remains at default
      expect(result.current.permissionState).toBe('default')
    })
  })

  describe('Browser Compatibility', () => {
    it('gracefully handles environments without Notification API', async () => {
      // This test ensures the hook doesn't crash in browsers that don't support notifications
      delete (window as any).Notification

      const { result } = renderHook(() => useNotificationPermission())

      let permissionResult: string | undefined
      await act(async () => {
        permissionResult = await result.current.requestPermission()
      })

      expect(permissionResult).toBe('denied')
      expect(result.current.permissionState).toBe('default')
    })
  })
})
