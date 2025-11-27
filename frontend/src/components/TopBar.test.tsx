/**
 * TopBar Component Tests
 * Story 3.9: Top Bar with Actions and Session Controls
 *
 * Test Coverage:
 * - AC3.16 (part): Top bar displays with logo/title, buttons, settings icon
 * - AC3.16 (part): STOP button sends interrupt to active session
 * - AC3.17: "Update BMAD" executes npx command
 * - Button states (enabled/disabled)
 * - Session modal integration
 * - Settings dropdown functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TopBar } from './TopBar'
import { useNotification } from '@/context/NotificationContext'
import type { Session } from '@/types'

// Mock the UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': testId, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={testId} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <div>{asChild ? children : <button>{children}</button>}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled, 'data-testid': testId }: any) => (
    <div onClick={disabled ? undefined : onClick} data-testid={testId} data-disabled={disabled}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children, className }: any) => <div className={className}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

// Mock useNotification hook
const mockRequestPermission = vi.fn()
const mockResetDismissal = vi.fn()
vi.mock('@/context/NotificationContext', () => ({
  useNotification: vi.fn(() => ({
    permissionState: 'default',
    permissionGranted: false,
    requestPermission: mockRequestPermission,
    resetDismissal: mockResetDismissal,
  })),
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

vi.mock('@/components/SessionModal', () => ({
  SessionModal: ({ open, onSessionCreated }: any) => (
    open ? (
      <div data-testid="session-modal">
        <button onClick={() => onSessionCreated({ id: 'new-session', name: 'Test Session' })}>
          Create
        </button>
      </div>
    ) : null
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Settings: () => <span data-testid="settings-icon">Settings Icon</span>,
  Terminal: () => <span data-testid="terminal-icon">Terminal Icon</span>,
  Loader2: () => <span data-testid="loader-icon">Loader Icon</span>,
  Bell: () => <span data-testid="bell-icon">Bell Icon</span>,
  BellOff: () => <span data-testid="bell-off-icon">BellOff Icon</span>,
  BellRing: () => <span data-testid="bell-ring-icon">BellRing Icon</span>,
  ExternalLink: () => <span data-testid="external-link-icon">ExternalLink Icon</span>,
}))

describe('TopBar Component', () => {
  const mockOnSessionCreated = vi.fn()
  const mockOnInterrupt = vi.fn()

  const defaultProps = {
    activeSessionId: 'test-session-1',
    isConnected: true,
    onSessionCreated: mockOnSessionCreated,
    onInterrupt: mockOnInterrupt,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch for BMAD update
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders logo and title', () => {
      render(<TopBar {...defaultProps} />)

      expect(screen.getByTestId('terminal-icon')).toBeInTheDocument()
      expect(screen.getByText('Claude Container')).toBeInTheDocument()
    })

    it('renders all action buttons', () => {
      render(<TopBar {...defaultProps} />)

      expect(screen.getByTestId('new-session-btn')).toBeInTheDocument()
      expect(screen.getByText('+ New Session')).toBeInTheDocument()

      expect(screen.getByTestId('stop-btn')).toBeInTheDocument()
      expect(screen.getByText('STOP')).toBeInTheDocument()

      expect(screen.getByTestId('settings-btn')).toBeInTheDocument()
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument()
    })

    it('renders with correct height and styling', () => {
      const { container } = render(<TopBar {...defaultProps} />)

      const header = container.querySelector('header')
      expect(header).toHaveClass('h-14') // 56px height (h-14 = 3.5rem = 56px)
      expect(header).toHaveClass('bg-card')
    })
  })

  describe('New Session Button', () => {
    it('opens session modal when clicked', () => {
      render(<TopBar {...defaultProps} />)

      const newSessionBtn = screen.getByTestId('new-session-btn')
      fireEvent.click(newSessionBtn)

      expect(screen.getByTestId('session-modal')).toBeInTheDocument()
    })

    it('calls onSessionCreated when session is created', () => {
      render(<TopBar {...defaultProps} />)

      // Open modal
      const newSessionBtn = screen.getByTestId('new-session-btn')
      fireEvent.click(newSessionBtn)

      // Create session in modal
      const createBtn = screen.getByText('Create')
      fireEvent.click(createBtn)

      expect(mockOnSessionCreated).toHaveBeenCalledWith({
        id: 'new-session',
        name: 'Test Session',
      })
    })

    it('closes modal after session creation', () => {
      render(<TopBar {...defaultProps} />)

      // Open modal
      const newSessionBtn = screen.getByTestId('new-session-btn')
      fireEvent.click(newSessionBtn)
      expect(screen.getByTestId('session-modal')).toBeInTheDocument()

      // Create session
      const createBtn = screen.getByText('Create')
      fireEvent.click(createBtn)

      // Modal should be closed
      expect(screen.queryByTestId('session-modal')).not.toBeInTheDocument()
    })
  })

  describe('STOP Button', () => {
    it('is enabled when connected and has active session', () => {
      render(<TopBar {...defaultProps} />)

      const stopBtn = screen.getByTestId('stop-btn')
      expect(stopBtn).not.toBeDisabled()
    })

    it('is disabled when not connected', () => {
      render(<TopBar {...defaultProps} isConnected={false} />)

      const stopBtn = screen.getByTestId('stop-btn')
      expect(stopBtn).toBeDisabled()
    })

    it('is disabled when no active session', () => {
      render(<TopBar {...defaultProps} activeSessionId={null} />)

      const stopBtn = screen.getByTestId('stop-btn')
      expect(stopBtn).toBeDisabled()
    })

    it('calls onInterrupt when clicked with active session', () => {
      render(<TopBar {...defaultProps} />)

      const stopBtn = screen.getByTestId('stop-btn')
      fireEvent.click(stopBtn)

      expect(mockOnInterrupt).toHaveBeenCalledTimes(1)
    })

    it('does not call onInterrupt when disabled', () => {
      render(<TopBar {...defaultProps} activeSessionId={null} />)

      const stopBtn = screen.getByTestId('stop-btn')
      fireEvent.click(stopBtn)

      expect(mockOnInterrupt).not.toHaveBeenCalled()
    })
  })

  describe('Settings Dropdown', () => {
    it('renders settings button', () => {
      render(<TopBar {...defaultProps} />)

      expect(screen.getByTestId('settings-btn')).toBeInTheDocument()
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument()
    })

    it('displays dropdown menu items', () => {
      render(<TopBar {...defaultProps} />)

      expect(screen.getByTestId('update-bmad-menu-item')).toBeInTheDocument()
      expect(screen.getByTestId('preferences-menu-item')).toBeInTheDocument()
      expect(screen.getByTestId('about-menu-item')).toBeInTheDocument()
    })

    it('Update BMAD menu item is enabled by default', () => {
      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      expect(updateBmadItem).toHaveAttribute('data-disabled', 'false')
    })

    it('Preferences menu item is disabled (future feature)', () => {
      render(<TopBar {...defaultProps} />)

      const preferencesItem = screen.getByTestId('preferences-menu-item')
      expect(preferencesItem).toHaveAttribute('data-disabled', 'true')
    })
  })

  describe('Update BMAD Functionality', () => {
    it('sends POST request to /api/bmad/update when clicked', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Updated successfully' }),
      })
      global.fetch = mockFetch

      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      fireEvent.click(updateBmadItem)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/bmad/update', {
          method: 'POST',
        })
      })
    })

    it('shows loading state during update', async () => {
      const mockFetch = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
      global.fetch = mockFetch

      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      fireEvent.click(updateBmadItem)

      await waitFor(() => {
        expect(screen.getByText('Updating...')).toBeInTheDocument()
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
      })
    })

    it('disables button during update', async () => {
      const mockFetch = vi.fn().mockImplementation(() => new Promise(() => {}))
      global.fetch = mockFetch

      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      fireEvent.click(updateBmadItem)

      await waitFor(() => {
        expect(updateBmadItem).toHaveAttribute('data-disabled', 'true')
      })
    })

    it('handles successful update', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Updated successfully' }),
      })
      global.fetch = mockFetch

      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      fireEvent.click(updateBmadItem)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('handles failed update', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Update failed' }),
      })
      global.fetch = mockFetch

      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      fireEvent.click(updateBmadItem)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('handles network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      render(<TopBar {...defaultProps} />)

      const updateBmadItem = screen.getByTestId('update-bmad-menu-item')
      fireEvent.click(updateBmadItem)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('About Menu Item', () => {
    it('can be clicked', () => {
      render(<TopBar {...defaultProps} />)

      const aboutItem = screen.getByTestId('about-menu-item')
      expect(() => fireEvent.click(aboutItem)).not.toThrow()
    })
  })

  describe('Integration', () => {
    it('all buttons work independently', () => {
      render(<TopBar {...defaultProps} />)

      // Test New Session button
      const newSessionBtn = screen.getByTestId('new-session-btn')
      fireEvent.click(newSessionBtn)
      expect(screen.getByTestId('session-modal')).toBeInTheDocument()

      // Test STOP button
      const stopBtn = screen.getByTestId('stop-btn')
      fireEvent.click(stopBtn)
      expect(mockOnInterrupt).toHaveBeenCalled()

      // Test Settings button exists
      const settingsBtn = screen.getByTestId('settings-btn')
      expect(settingsBtn).toBeInTheDocument()
    })
  })

  describe('Notification Settings (Story 3.11)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('shows "Not Requested" and "Request Permission" when permission is default', () => {
      vi.mocked(useNotification).mockReturnValue({
        permissionState: 'default',
        permissionGranted: false,
        isDismissed: false,
        requestPermission: mockRequestPermission,
        resetDismissal: mockResetDismissal,
        dismissBanner: vi.fn(),
        checkPermission: vi.fn(),
      })

      render(<TopBar {...defaultProps} />)

      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByTestId('notifications-default')).toBeInTheDocument()
      expect(screen.getByText('Not Requested')).toBeInTheDocument()
      expect(screen.getByTestId('request-permission-btn')).toBeInTheDocument()
      expect(screen.getByText('Request Permission')).toBeInTheDocument()
      expect(screen.getByTestId('reset-banner-btn')).toBeInTheDocument()
      expect(screen.getByText('Show Banner Again')).toBeInTheDocument()
    })

    it('shows "Notifications Enabled" when permission is granted', () => {
      vi.mocked(useNotification).mockReturnValue({
        permissionState: 'granted',
        permissionGranted: true,
        isDismissed: false,
        requestPermission: mockRequestPermission,
        resetDismissal: mockResetDismissal,
        dismissBanner: vi.fn(),
        checkPermission: vi.fn(),
      })

      render(<TopBar {...defaultProps} />)

      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByTestId('notifications-enabled')).toBeInTheDocument()
      expect(screen.getByText('Notifications Enabled')).toBeInTheDocument()
      expect(screen.getByTestId('bell-ring-icon')).toBeInTheDocument()
    })

    it('shows "Notifications Blocked" and help option when permission is denied', () => {
      vi.mocked(useNotification).mockReturnValue({
        permissionState: 'denied',
        permissionGranted: false,
        isDismissed: false,
        requestPermission: mockRequestPermission,
        resetDismissal: mockResetDismissal,
        dismissBanner: vi.fn(),
        checkPermission: vi.fn(),
      })

      render(<TopBar {...defaultProps} />)

      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByTestId('notifications-denied')).toBeInTheDocument()
      expect(screen.getByText('Notifications Blocked')).toBeInTheDocument()
      expect(screen.getByTestId('bell-off-icon')).toBeInTheDocument()
      expect(screen.getByTestId('notifications-help')).toBeInTheDocument()
      expect(screen.getByText('How to Enable')).toBeInTheDocument()
    })

    it('calls requestPermission when "Request Permission" is clicked', async () => {
      mockRequestPermission.mockResolvedValue('granted')
      vi.mocked(useNotification).mockReturnValue({
        permissionState: 'default',
        permissionGranted: false,
        isDismissed: false,
        requestPermission: mockRequestPermission,
        resetDismissal: mockResetDismissal,
        dismissBanner: vi.fn(),
        checkPermission: vi.fn(),
      })

      render(<TopBar {...defaultProps} />)

      const requestBtn = screen.getByTestId('request-permission-btn')
      fireEvent.click(requestBtn)

      await waitFor(() => {
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
      })
    })

    it('calls resetDismissal when "Show Banner Again" is clicked', () => {
      vi.mocked(useNotification).mockReturnValue({
        permissionState: 'default',
        permissionGranted: false,
        isDismissed: true,
        requestPermission: mockRequestPermission,
        resetDismissal: mockResetDismissal,
        dismissBanner: vi.fn(),
        checkPermission: vi.fn(),
      })

      render(<TopBar {...defaultProps} />)

      const resetBtn = screen.getByTestId('reset-banner-btn')
      fireEvent.click(resetBtn)

      expect(mockResetDismissal).toHaveBeenCalledTimes(1)
    })

    it('How to Enable button is clickable when permission is denied', () => {
      vi.mocked(useNotification).mockReturnValue({
        permissionState: 'denied',
        permissionGranted: false,
        isDismissed: false,
        requestPermission: mockRequestPermission,
        resetDismissal: mockResetDismissal,
        dismissBanner: vi.fn(),
        checkPermission: vi.fn(),
      })

      render(<TopBar {...defaultProps} />)

      const helpBtn = screen.getByTestId('notifications-help')
      // Just verify it's clickable (toast interaction is tested via integration)
      expect(() => fireEvent.click(helpBtn)).not.toThrow()
    })
  })
})
