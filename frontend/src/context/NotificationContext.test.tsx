import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotification } from './NotificationContext'
import { ReactNode } from 'react'

// Helper to create wrapper with NotificationProvider
function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <NotificationProvider>{children}</NotificationProvider>
  )
}

describe('NotificationContext', () => {
  // Store original Notification and localStorage
  let originalNotification: typeof Notification | undefined
  let localStorageMock: { [key: string]: string }

  beforeEach(() => {
    // Save original Notification
    originalNotification = (window as any).Notification

    // Mock Notification API
    const mockNotification = {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    }
    ;(window as any).Notification = mockNotification

    // Mock localStorage
    localStorageMock = {}
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key]
      }),
      clear: vi.fn(() => {
        localStorageMock = {}
      }),
      length: 0,
      key: vi.fn(),
    } as Storage
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

  describe('Provider Setup', () => {
    it('provides notification context to children', () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      expect(result.current).toBeDefined()
      expect(result.current.permissionState).toBeDefined()
      expect(result.current.requestPermission).toBeDefined()
    })

    it('throws error when useNotification used outside provider', () => {
      // Suppress console.error for this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useNotification())
      }).toThrow('useNotification must be used within a NotificationProvider')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Permission State', () => {
    it('initializes with default permission state', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionState).toBe('default')
        expect(result.current.permissionGranted).toBe(false)
      })
    })

    it('sets permissionGranted to true when permission is "granted"', async () => {
      ;(window as any).Notification.permission = 'granted'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionState).toBe('granted')
        expect(result.current.permissionGranted).toBe(true)
      })
    })

    it('sets permissionGranted to false when permission is "denied"', async () => {
      ;(window as any).Notification.permission = 'denied'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionState).toBe('denied')
        expect(result.current.permissionGranted).toBe(false)
      })
    })
  })

  describe('localStorage Integration', () => {
    it('loads dismissed state from localStorage on mount', async () => {
      localStorageMock['notification-permission-dismissed'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.isDismissed).toBe(true)
      })
    })

    it('initializes isDismissed to false when not in localStorage', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.isDismissed).toBe(false)
      })
    })

    it('stores last check timestamp when permission changes', async () => {
      ;(window as any).Notification.requestPermission = vi.fn().mockResolvedValue('granted')

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await act(async () => {
        await result.current.requestPermission()
      })

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'notification-permission-last-check',
          expect.any(String)
        )
      })
    })
  })

  describe('dismissBanner', () => {
    it('sets isDismissed to true and stores in localStorage', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await act(async () => {
        result.current.dismissBanner()
      })

      expect(result.current.isDismissed).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('notification-permission-dismissed', 'true')
    })
  })

  describe('resetDismissal', () => {
    it('sets isDismissed to false and removes from localStorage', async () => {
      localStorageMock['notification-permission-dismissed'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.isDismissed).toBe(true)
      })

      await act(async () => {
        result.current.resetDismissal()
      })

      expect(result.current.isDismissed).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('notification-permission-dismissed')
    })
  })

  describe('requestPermission', () => {
    it('requests permission and auto-dismisses banner', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted')
      ;(window as any).Notification.requestPermission = mockRequestPermission

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await act(async () => {
        const permission = await result.current.requestPermission()
        expect(permission).toBe('granted')
      })

      // Should auto-dismiss after request
      expect(result.current.isDismissed).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('notification-permission-dismissed', 'true')
    })

    it('auto-dismisses even when permission denied', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('denied')
      ;(window as any).Notification.requestPermission = mockRequestPermission

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await act(async () => {
        await result.current.requestPermission()
      })

      // Should auto-dismiss after request regardless of result
      expect(result.current.isDismissed).toBe(true)
    })
  })

  describe('checkPermission', () => {
    it('manually refreshes permission state', async () => {
      ;(window as any).Notification.permission = 'default'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionState).toBe('default')
      })

      // Change permission externally
      ;(window as any).Notification.permission = 'granted'

      await act(async () => {
        result.current.checkPermission()
      })

      await waitFor(() => {
        expect(result.current.permissionState).toBe('granted')
        expect(result.current.permissionGranted).toBe(true)
      })
    })
  })

  describe('Context API Surface', () => {
    it('provides all expected properties', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current).toHaveProperty('permissionGranted')
        expect(result.current).toHaveProperty('permissionState')
        expect(result.current).toHaveProperty('isDismissed')
        expect(result.current).toHaveProperty('requestPermission')
        expect(result.current).toHaveProperty('dismissBanner')
        expect(result.current).toHaveProperty('resetDismissal')
        expect(result.current).toHaveProperty('checkPermission')
        expect(result.current).toHaveProperty('sendNotification')
      })
    })

    it('provides functions that are stable across renders', async () => {
      const wrapper = createWrapper()
      const { result, rerender } = renderHook(() => useNotification(), { wrapper })

      const firstRequestPermission = result.current.requestPermission
      const firstDismissBanner = result.current.dismissBanner
      const firstCheckPermission = result.current.checkPermission

      rerender()

      expect(result.current.requestPermission).toBe(firstRequestPermission)
      expect(result.current.dismissBanner).toBe(firstDismissBanner)
      expect(result.current.checkPermission).toBe(firstCheckPermission)
    })
  })

  describe('sendNotification (Story 4.3)', () => {
    // Mock browser Notification constructor
    let mockNotificationInstances: any[]

    beforeEach(() => {
      mockNotificationInstances = []

      // Create a mock Notification class
      class MockNotification {
        title: string
        options: NotificationOptions
        onclick: (() => void) | null = null
        close = vi.fn()

        constructor(title: string, options: NotificationOptions) {
          this.title = title
          this.options = options
          mockNotificationInstances.push(this)
        }

        static permission: NotificationPermission = 'granted'
      }

      // Replace Notification with our mock
      ;(window as any).Notification = MockNotification
    })

    it('AC4.7: sends browser notification when permission is granted', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(true)
      })

      const onClickHandler = vi.fn()

      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          onClickHandler
        )
      })

      expect(mockNotificationInstances.length).toBe(1)

      const notification = mockNotificationInstances[0]
      expect(notification.title).toBe('Session feature-auth needs input')
      expect(notification.options.body).toBe('Claude is asking a question')
    })

    it('AC4.4: skips notification when permission is not granted', async () => {
      ;(window as any).Notification.permission = 'denied'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(false)
      })

      const consoleLogSpy = vi.spyOn(console, 'log')

      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          vi.fn()
        )
      })

      expect(mockNotificationInstances.length).toBe(0)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Notification permission not granted, skipping notification',
        { sessionId: 'session-123' }
      )
    })

    it('AC4.5: uses generic message with no sensitive data', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(true)
      })

      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          vi.fn()
        )
      })

      const notification = mockNotificationInstances[0]

      // Title contains session name but is generic
      expect(notification.title).toBe('Session feature-auth needs input')

      // Body is generic message (no terminal output or sensitive data)
      expect(notification.options.body).toBe('Claude is asking a question')

      // Should not contain file paths, branch names, etc.
      expect(notification.title).not.toContain('/')
      expect(notification.options.body).not.toContain('/')
    })

    it('AC4.6: uses session-scoped tag to prevent duplicates', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(true)
      })

      // Send first notification
      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          vi.fn()
        )
      })

      // Send second notification for same session
      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Another question',
          vi.fn()
        )
      })

      // Both notifications should have the same tag (prevents duplicates)
      expect(mockNotificationInstances[0].options.tag).toBe('session-123')
      expect(mockNotificationInstances[1].options.tag).toBe('session-123')
    })

    it('AC4.8: notification click focuses window and switches session', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(true)
      })

      const windowFocusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {})
      const onClickHandler = vi.fn()

      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          onClickHandler
        )
      })

      const notification = mockNotificationInstances[0]

      // Simulate notification click
      await act(async () => {
        notification.onclick?.()
      })

      // Should focus window
      expect(windowFocusSpy).toHaveBeenCalled()

      // Should call onClickHandler (switches session)
      expect(onClickHandler).toHaveBeenCalled()

      // Should close notification
      expect(notification.close).toHaveBeenCalled()

      windowFocusSpy.mockRestore()
    })

    it('handles missing Notification API gracefully', async () => {
      // Setup: Create wrapper with granted permission first
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(true)
      })

      // Then remove Notification API after permission is granted
      const originalNotification = (window as any).Notification
      delete (window as any).Notification

      const consoleWarnSpy = vi.spyOn(console, 'warn')

      // Now try to send notification with missing API
      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          vi.fn()
        )
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith('Notification API not available')

      // Restore Notification API
      ;(window as any).Notification = originalNotification
    })

    it('sets requireInteraction to false for auto-dismiss', async () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useNotification(), { wrapper })

      await waitFor(() => {
        expect(result.current.permissionGranted).toBe(true)
      })

      await act(async () => {
        result.current.sendNotification(
          'session-123',
          'feature-auth',
          'Claude is asking a question',
          vi.fn()
        )
      })

      const notification = mockNotificationInstances[0]
      expect(notification.options.requireInteraction).toBe(false)
    })
  })
})
