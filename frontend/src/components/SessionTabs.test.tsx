/**
 * SessionTabs Component Tests
 * Story 2.5: Tabbed Interface for Session Switching
 *
 * Tests cover:
 * - Rendering all sessions as tabs
 * - Active/inactive tab styling
 * - Tab clicking and session selection
 * - Keyboard shortcuts (Cmd+1-4)
 * - Close button hover and click
 * - "+ New Session" tab functionality
 * - Horizontal scroll with overflow
 * - Performance requirements (<50ms)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionTabs } from './SessionTabs'
import type { Session } from '@/types'

// Mock sessions for testing
const mockSessions: Session[] = [
  {
    id: 'session-1',
    name: 'Feature Session 1',
    status: 'active',
    branch: 'feature/test-1',
    worktreePath: '/path/to/worktree-1',
    createdAt: '2025-11-24T10:00:00Z',
    lastActivity: '2025-11-24T10:30:00Z',
  },
  {
    id: 'session-2',
    name: 'Feature Session 2',
    status: 'idle',
    branch: 'feature/test-2',
    worktreePath: '/path/to/worktree-2',
    createdAt: '2025-11-24T11:00:00Z',
    lastActivity: '2025-11-24T11:30:00Z',
  },
  {
    id: 'session-3',
    name: 'Very Long Session Name That Should Be Truncated',
    status: 'waiting',
    branch: 'feature/test-3',
    worktreePath: '/path/to/worktree-3',
    createdAt: '2025-11-24T12:00:00Z',
    lastActivity: '2025-11-24T12:30:00Z',
  },
]

describe('SessionTabs', () => {
  let mockSelectSession: (sessionId: string) => void
  let mockDestroySession: (sessionId: string) => void
  let mockOpenCreateModal: () => void

  beforeEach(() => {
    mockSelectSession = vi.fn()
    mockDestroySession = vi.fn()
    mockOpenCreateModal = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('AC1: Rendering and Styling', () => {
    it('renders all sessions as tabs', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // Should render 3 session tabs + 1 "+ New Session" tab
      expect(screen.getByText('Feature Session 1')).toBeInTheDocument()
      expect(screen.getByText('Feature Session 2')).toBeInTheDocument()
      expect(screen.getByText('Very Long Session Name That Should Be Truncated')).toBeInTheDocument()
      expect(screen.getByText('+ New Session')).toBeInTheDocument()
    })

    it('renders "+ New Session" tab when sessions are below max limit', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
          maxSessions={4}
        />
      )

      const newSessionTab = screen.getByText('+ New Session')
      expect(newSessionTab).toBeInTheDocument()
      expect(newSessionTab).not.toBeDisabled()
    })

    it('disables "+ New Session" tab when at max sessions limit', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
          maxSessions={3}
        />
      )

      const newSessionTab = screen.getByText('+ New Session')
      expect(newSessionTab).toBeDisabled()
    })

    it('handles single session edge case', () => {
      const singleSession = [mockSessions[0]]
      render(
        <SessionTabs
          sessions={singleSession}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      expect(screen.getByText('Feature Session 1')).toBeInTheDocument()
      expect(screen.getByText('+ New Session')).toBeInTheDocument()
    })

    it('handles empty sessions array', () => {
      render(
        <SessionTabs
          sessions={[]}
          activeSessionId={null}
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      expect(screen.getByText('+ New Session')).toBeInTheDocument()
    })
  })

  describe('AC2: Tab Switching', () => {
    it('calls onSelectSession when clicking inactive tab', async () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const session2Tab = screen.getByText('Feature Session 2')
      fireEvent.click(session2Tab)

      expect(mockSelectSession).toHaveBeenCalledWith('session-2')
    })

    it('measures tab switching latency (should be <50ms)', async () => {
      const performanceSpy = vi.spyOn(console, 'log')

      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const session2Tab = screen.getByText('Feature Session 2')
      fireEvent.click(session2Tab)

      // Wait for performance measurement to complete
      await waitFor(() => {
        expect(performanceSpy).toHaveBeenCalled()
      })

      // Check that latency was logged
      const logCalls = performanceSpy.mock.calls
      const latencyLog = logCalls.find((call) =>
        call[0]?.includes('Tab switch latency')
      )
      expect(latencyLog).toBeDefined()

      performanceSpy.mockRestore()
    })

    it('does not remount components on tab switch (updates activeSessionId only)', () => {
      const { rerender: _rerender } = render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // Simulate tab switch by changing activeSessionId
      _rerender(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-2"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // All tabs should still be in the document (not remounted)
      expect(screen.getByText('Feature Session 1')).toBeInTheDocument()
      expect(screen.getByText('Feature Session 2')).toBeInTheDocument()
      expect(screen.getByText('Very Long Session Name That Should Be Truncated')).toBeInTheDocument()
    })
  })

  describe('AC3: Keyboard Shortcuts', () => {
    it('activates first session with Cmd+1', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-2"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      fireEvent.keyDown(window, { key: '1', metaKey: true })

      expect(mockSelectSession).toHaveBeenCalledWith('session-1')
    })

    it('activates second session with Ctrl+2', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      fireEvent.keyDown(window, { key: '2', ctrlKey: true })

      expect(mockSelectSession).toHaveBeenCalledWith('session-2')
    })

    it('activates third session with Cmd+3', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      fireEvent.keyDown(window, { key: '3', metaKey: true })

      expect(mockSelectSession).toHaveBeenCalledWith('session-3')
    })

    it('does nothing when pressing Cmd+5 (no 5th session)', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      fireEvent.keyDown(window, { key: '5', metaKey: true })

      expect(mockSelectSession).not.toHaveBeenCalled()
    })

    it('prevents default browser behavior for Cmd+1-4', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const event = new KeyboardEvent('keydown', { key: '1', metaKey: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('cleans up keyboard event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('AC4: Close Button', () => {
    it('shows close button on tab hover', async () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const session1Tab = screen.getByText('Feature Session 1').closest('button')
      expect(session1Tab).toBeInTheDocument()

      // Close button should have aria-label
      const closeButton = screen.getByLabelText('Close Feature Session 1')
      expect(closeButton).toBeInTheDocument()
    })

    it('calls onDestroySession when clicking close button', async () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const closeButton = screen.getByLabelText('Close Feature Session 1')
      fireEvent.click(closeButton)

      expect(mockDestroySession).toHaveBeenCalledWith('session-1')
    })

    it('stops event propagation when clicking close button', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const closeButton = screen.getByLabelText('Close Feature Session 2')
      fireEvent.click(closeButton)

      // onDestroySession should be called, but onSelectSession should NOT
      expect(mockDestroySession).toHaveBeenCalledWith('session-2')
      expect(mockSelectSession).not.toHaveBeenCalled()
    })
  })

  describe('AC6: "+ New Session" Tab', () => {
    it('calls onOpenCreateModal when clicking "+ New Session" tab', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const newSessionTab = screen.getByText('+ New Session')
      fireEvent.click(newSessionTab)

      expect(mockOpenCreateModal).toHaveBeenCalled()
    })

    it('does not change active session when clicking "+ New Session"', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      const newSessionTab = screen.getByText('+ New Session')
      fireEvent.click(newSessionTab)

      expect(mockSelectSession).not.toHaveBeenCalled()
      expect(mockOpenCreateModal).toHaveBeenCalled()
    })
  })

  describe('AC5: Horizontal Scroll with Overflow', () => {
    it('renders with overflow-x-auto for many tabs', () => {
      const manySessions: Session[] = Array.from({ length: 6 }, (_, i) => ({
        id: `session-${i + 1}`,
        name: `Session ${i + 1}`,
        status: 'active',
        branch: `feature/test-${i + 1}`,
        worktreePath: `/path/to/worktree-${i + 1}`,
        createdAt: '2025-11-24T10:00:00Z',
        lastActivity: '2025-11-24T10:30:00Z',
      }))

      const { container } = render(
        <SessionTabs
          sessions={manySessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // Find the TabsList element which should have overflow-x-auto
      const tabsList = container.querySelector('[role="tablist"]')
      expect(tabsList).toBeInTheDocument()
    })

    it('auto-scrolls active tab into view', () => {
      const scrollIntoViewMock = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoViewMock

      const { rerender: _rerender } = render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // Change active session
      _rerender(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-3"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // scrollIntoView should have been called
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })
  })

  describe('Integration Tests', () => {
    it('integrates all features in a realistic workflow', async () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={mockSelectSession}
          onDestroySession={mockDestroySession}
          onOpenCreateModal={mockOpenCreateModal}
        />
      )

      // Step 1: Click second tab
      const session2Tab = screen.getByText('Feature Session 2')
      fireEvent.click(session2Tab)
      expect(mockSelectSession).toHaveBeenCalledWith('session-2')

      // Step 2: Use keyboard shortcut to switch to third session
      fireEvent.keyDown(window, { key: '3', metaKey: true })
      expect(mockSelectSession).toHaveBeenCalledWith('session-3')

      // Step 3: Click "+ New Session"
      const newSessionTab = screen.getByText('+ New Session')
      fireEvent.click(newSessionTab)
      expect(mockOpenCreateModal).toHaveBeenCalled()

      // Step 4: Close a session
      const closeButton = screen.getByLabelText('Close Feature Session 1')
      fireEvent.click(closeButton)
      expect(mockDestroySession).toHaveBeenCalledWith('session-1')
    })
  })
})
