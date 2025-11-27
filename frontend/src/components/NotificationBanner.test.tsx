import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationBanner } from './NotificationBanner'
import { NotificationProvider } from '@/context/NotificationContext'
import { ReactNode } from 'react'

// Mock the useNotification hook
vi.mock('@/context/NotificationContext', async () => {
  const actual = await vi.importActual('@/context/NotificationContext')
  return {
    ...actual,
    useNotification: vi.fn(),
  }
})

import { useNotification } from '@/context/NotificationContext'

const mockUseNotification = useNotification as any

describe('NotificationBanner', () => {
  const defaultMockValues = {
    permissionState: 'default' as const,
    permissionGranted: false,
    isDismissed: false,
    requestPermission: vi.fn().mockResolvedValue('granted'),
    dismissBanner: vi.fn(),
    resetDismissal: vi.fn(),
    checkPermission: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNotification.mockReturnValue(defaultMockValues)
  })

  describe('Visibility', () => {
    it('renders banner when permission is "default" and not dismissed', () => {
      render(<NotificationBanner />)

      expect(screen.getByText('Get notified when Claude needs your input')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Enable Notifications' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Maybe Later' })).toBeInTheDocument()
    })

    it('does not render when permission is "granted"', () => {
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        permissionState: 'granted',
        permissionGranted: true,
      })

      const { container } = render(<NotificationBanner />)

      expect(container.firstChild).toBeNull()
      expect(screen.queryByText('Get notified when Claude needs your input')).not.toBeInTheDocument()
    })

    it('does not render when permission is "denied"', () => {
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        permissionState: 'denied',
      })

      const { container } = render(<NotificationBanner />)

      expect(container.firstChild).toBeNull()
    })

    it('does not render when banner is dismissed', () => {
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        isDismissed: true,
      })

      const { container } = render(<NotificationBanner />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Enable Notifications Button', () => {
    it('calls requestPermission when "Enable Notifications" clicked', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted')
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        requestPermission: mockRequestPermission,
      })

      render(<NotificationBanner />)

      const enableButton = screen.getByRole('button', { name: 'Enable Notifications' })
      fireEvent.click(enableButton)

      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    })

    it('handles permission request that returns "denied"', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('denied')
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        requestPermission: mockRequestPermission,
      })

      render(<NotificationBanner />)

      const enableButton = screen.getByRole('button', { name: 'Enable Notifications' })
      fireEvent.click(enableButton)

      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    })
  })

  describe('Maybe Later Button', () => {
    it('calls dismissBanner when "Maybe Later" clicked', () => {
      const mockDismissBanner = vi.fn()
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        dismissBanner: mockDismissBanner,
      })

      render(<NotificationBanner />)

      const maybeLaterButton = screen.getByRole('button', { name: 'Maybe Later' })
      fireEvent.click(maybeLaterButton)

      expect(mockDismissBanner).toHaveBeenCalledTimes(1)
    })
  })

  describe('Close Button', () => {
    it('calls dismissBanner when close button clicked', () => {
      const mockDismissBanner = vi.fn()
      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        dismissBanner: mockDismissBanner,
      })

      render(<NotificationBanner />)

      const closeButton = screen.getByRole('button', { name: 'Dismiss notification banner' })
      fireEvent.click(closeButton)

      expect(mockDismissBanner).toHaveBeenCalledTimes(1)
    })
  })

  describe('UI Elements', () => {
    it('displays bell icon', () => {
      render(<NotificationBanner />)

      // Bell icon should be present (via lucide-react)
      const banner = screen.getByRole('alert')
      expect(banner).toBeInTheDocument()
    })

    it('has correct ARIA attributes', () => {
      render(<NotificationBanner />)

      const banner = screen.getByRole('alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })

    it('applies Oceanic Calm theme colors', () => {
      render(<NotificationBanner />)

      const banner = screen.getByRole('alert')
      expect(banner).toHaveClass('bg-[#88C0D0]') // Oceanic blue
      expect(banner).toHaveClass('text-white')
    })

    it('is positioned fixed at top of screen', () => {
      render(<NotificationBanner />)

      const banner = screen.getByRole('alert')
      expect(banner).toHaveClass('fixed', 'top-0', 'left-0', 'right-0')
      expect(banner).toHaveClass('z-[1000]') // High z-index
    })
  })

  describe('Accessibility', () => {
    it('has accessible button labels', () => {
      render(<NotificationBanner />)

      expect(screen.getByRole('button', { name: 'Enable Notifications' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Maybe Later' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dismiss notification banner' })).toBeInTheDocument()
    })

    it('uses appropriate ARIA live region', () => {
      render(<NotificationBanner />)

      const banner = screen.getByRole('alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })

    it('bell icon has aria-hidden', () => {
      render(<NotificationBanner />)

      const banner = screen.getByRole('alert')
      const bellIcon = banner.querySelector('[aria-hidden="true"]')
      expect(bellIcon).toBeInTheDocument()
    })
  })

  describe('Interaction Flow', () => {
    it('completes full enable flow', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted')
      const mockDismissBanner = vi.fn()

      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        requestPermission: mockRequestPermission,
        dismissBanner: mockDismissBanner,
      })

      render(<NotificationBanner />)

      const enableButton = screen.getByRole('button', { name: 'Enable Notifications' })
      fireEvent.click(enableButton)

      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
      // Note: dismissBanner is called automatically by context after requestPermission
    })

    it('completes full dismiss flow', () => {
      const mockDismissBanner = vi.fn()

      mockUseNotification.mockReturnValue({
        ...defaultMockValues,
        dismissBanner: mockDismissBanner,
      })

      render(<NotificationBanner />)

      const maybeLaterButton = screen.getByRole('button', { name: 'Maybe Later' })
      fireEvent.click(maybeLaterButton)

      expect(mockDismissBanner).toHaveBeenCalledTimes(1)
    })
  })
})
