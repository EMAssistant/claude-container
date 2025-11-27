import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionList } from './SessionList'
import type { Session } from '@/types'

// Helper function to create mock sessions
function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-1',
    name: 'Test Session',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  }
}

describe('SessionList', () => {
  describe('Rendering', () => {
    it('renders all sessions from props', () => {
      const sessions: Session[] = [
        createMockSession({ id: '1', name: 'feature-auth' }),
        createMockSession({ id: '2', name: 'feature-ui', status: 'waiting' }),
        createMockSession({ id: '3', name: 'feature-api', status: 'idle' }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.getByText('feature-auth')).toBeInTheDocument()
      expect(screen.getByText('feature-ui')).toBeInTheDocument()
      expect(screen.getByText('feature-api')).toBeInTheDocument()
    })

    it('displays empty state when no sessions', () => {
      render(
        <SessionList
          sessions={[]}
          activeSessionId=""
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.getByText('No active sessions')).toBeInTheDocument()
    })

    it('truncates session name at 20 characters', () => {
      const longName = 'very-long-session-name-that-exceeds-twenty-characters'
      const sessions = [createMockSession({ id: '1', name: longName })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      // Should display truncated name with ellipsis
      expect(screen.getByText('very-long-session-na...')).toBeInTheDocument()
      // Original name should not be directly visible
      expect(screen.queryByText(longName)).not.toBeInTheDocument()
    })

    it('displays last activity in relative time format', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const sessions = [
        createMockSession({ id: '1', lastActivity: fiveMinutesAgo }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })
  })

  describe('Status Indicators', () => {
    it('displays green status dot for active session', () => {
      const sessions = [createMockSession({ id: '1', status: 'active' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByTestId('status-dot-1')
      expect(statusDot).toHaveStyle({ backgroundColor: '#A3BE8C' })
    })

    it('displays yellow status dot for waiting session', () => {
      const sessions = [createMockSession({ id: '1', status: 'waiting' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByTestId('status-dot-1')
      expect(statusDot).toHaveStyle({ backgroundColor: '#EBCB8B' })
    })

    it('displays blue status dot for idle session', () => {
      const sessions = [createMockSession({ id: '1', status: 'idle' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByTestId('status-dot-1')
      expect(statusDot).toHaveStyle({ backgroundColor: '#88C0D0' })
    })

    it('displays red status dot for error session', () => {
      const sessions = [createMockSession({ id: '1', status: 'error' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByTestId('status-dot-1')
      expect(statusDot).toHaveStyle({ backgroundColor: '#BF616A' })
    })

    it('applies pulsing animation to active status dot', () => {
      const sessions = [createMockSession({ id: '1', status: 'active' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByTestId('status-dot-1')
      expect(statusDot).toHaveClass('animate-pulse-status')
    })

    it('does not apply pulsing animation to non-active sessions', () => {
      const sessions = [createMockSession({ id: '1', status: 'idle' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByTestId('status-dot-1')
      expect(statusDot).not.toHaveClass('animate-pulse-status')
    })
  })

  describe('Badges', () => {
    it('shows "!" badge when session status is waiting', () => {
      const sessions = [createMockSession({ id: '1', status: 'waiting' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const badge = screen.getByText('!')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveAttribute('aria-label', 'Waiting for input')
    })

    it('does not show "!" badge for non-waiting sessions', () => {
      const sessions = [createMockSession({ id: '1', status: 'active' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.queryByText('!')).not.toBeInTheDocument()
    })

    it('shows "Stuck?" badge when session is active and inactive for >30 min', () => {
      const thirtyOneMinutesAgo = new Date(
        Date.now() - 31 * 60 * 1000
      ).toISOString()
      const sessions = [
        createMockSession({
          id: '1',
          status: 'active',
          lastActivity: thirtyOneMinutesAgo,
        }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const badge = screen.getByText('Stuck?')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveAttribute('aria-label', 'Session may be stuck')
    })

    it('does not show "Stuck?" badge when lastActivity < 30 min', () => {
      const twentyNineMinutesAgo = new Date(
        Date.now() - 29 * 60 * 1000
      ).toISOString()
      const sessions = [
        createMockSession({
          id: '1',
          status: 'active',
          lastActivity: twentyNineMinutesAgo,
        }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.queryByText('Stuck?')).not.toBeInTheDocument()
    })

    it('does not show "Stuck?" badge for idle sessions even if >30 min', () => {
      const thirtyOneMinutesAgo = new Date(
        Date.now() - 31 * 60 * 1000
      ).toISOString()
      const sessions = [
        createMockSession({
          id: '1',
          status: 'idle',
          lastActivity: thirtyOneMinutesAgo,
        }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.queryByText('Stuck?')).not.toBeInTheDocument()
    })
  })

  describe('Session Selection', () => {
    it('calls onSessionSelect when session is clicked', () => {
      const onSessionSelect = vi.fn()
      const sessions = [createMockSession({ id: 'session-1', name: 'Test' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="other-session"
          onSessionSelect={onSessionSelect}
        />
      )

      const sessionButton = screen.getByRole('button', {
        name: /Switch to session Test/,
      })
      fireEvent.click(sessionButton)

      expect(onSessionSelect).toHaveBeenCalledWith('session-1')
      expect(onSessionSelect).toHaveBeenCalledTimes(1)
    })

    it('highlights active session with background', () => {
      const sessions = [
        createMockSession({ id: '1', name: 'Session 1' }),
        createMockSession({ id: '2', name: 'Session 2' }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const activeButton = screen.getByRole('button', {
        name: /Switch to session Session 1/,
      })
      const inactiveButton = screen.getByRole('button', {
        name: /Switch to session Session 2/,
      })

      expect(activeButton).toHaveClass('bg-secondary')
      expect(inactiveButton).not.toHaveClass('bg-secondary')
    })
  })

  describe('Accessibility', () => {
    it('has accessible labels for session buttons', () => {
      const sessions = [
        createMockSession({ id: '1', name: 'Test', status: 'active' }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const button = screen.getByRole('button', {
        name: 'Switch to session Test, status active',
      })
      expect(button).toBeInTheDocument()
    })

    it('has accessible labels for status dots', () => {
      const sessions = [createMockSession({ id: '1', status: 'waiting' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const statusDot = screen.getByLabelText('Status: waiting')
      expect(statusDot).toBeInTheDocument()
    })

    it('supports keyboard navigation with focus indicators', () => {
      const sessions = [createMockSession({ id: '1', name: 'Test' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2')
    })
  })

  describe('Story 4.2: Attention Badges', () => {
    it('shows attention badge for error status', () => {
      const sessions = [createMockSession({ id: '1', status: 'error' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const badge = screen.getByTestId('attention-badge-error')
      expect(badge).toBeInTheDocument()
    })

    it('shows attention badge for stuck status (>30 min no activity)', () => {
      const thirtyOneMinutesAgo = new Date(
        Date.now() - 31 * 60 * 1000
      ).toISOString()
      const sessions = [
        createMockSession({
          id: '1',
          status: 'active',
          lastActivity: thirtyOneMinutesAgo,
        }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const badge = screen.getByTestId('attention-badge-stuck')
      expect(badge).toBeInTheDocument()
    })

    it('shows attention badge for waiting status', () => {
      const sessions = [createMockSession({ id: '1', status: 'waiting' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const badge = screen.getByTestId('attention-badge-waiting')
      expect(badge).toBeInTheDocument()
    })

    it('does not show attention badge for active status', () => {
      const sessions = [createMockSession({ id: '1', status: 'active' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()
    })

    it('does not show attention badge for idle status', () => {
      const sessions = [createMockSession({ id: '1', status: 'idle' })]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()
    })
  })

  describe('Story 4.2: Session Priority Sorting', () => {
    it('sorts sessions by priority: error > stuck > waiting > active > idle', () => {
      const sessions = [
        createMockSession({ id: '1', name: 'Active Session', status: 'active' }),
        createMockSession({ id: '2', name: 'Error Session', status: 'error' }),
        createMockSession({ id: '3', name: 'Waiting Session', status: 'waiting' }),
        createMockSession({
          id: '4',
          name: 'Stuck Session',
          status: 'active',
          lastActivity: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 min ago = stuck
        }),
        createMockSession({ id: '5', name: 'Idle Session', status: 'idle' }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      // Order should be: Error, Stuck, Waiting, Active, Idle
      expect(buttons[0]).toHaveAccessibleName(/Error Session/)
      expect(buttons[1]).toHaveAccessibleName(/Stuck Session/)
      expect(buttons[2]).toHaveAccessibleName(/Waiting Session/)
      expect(buttons[3]).toHaveAccessibleName(/Active Session/)
      expect(buttons[4]).toHaveAccessibleName(/Idle Session/)
    })

    it('sorts sessions with same priority by most recent activity', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      const sessions = [
        createMockSession({
          id: '1',
          name: 'Session A',
          status: 'active',
          lastActivity: tenMinutesAgo,
        }),
        createMockSession({
          id: '2',
          name: 'Session B',
          status: 'active',
          lastActivity: twoMinutesAgo,
        }),
        createMockSession({
          id: '3',
          name: 'Session C',
          status: 'active',
          lastActivity: fiveMinutesAgo,
        }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      // Order should be: Session B (most recent), Session C, Session A (oldest)
      expect(buttons[0]).toHaveAccessibleName(/Session B/)
      expect(buttons[1]).toHaveAccessibleName(/Session C/)
      expect(buttons[2]).toHaveAccessibleName(/Session A/)
    })

    it('prioritizes error over stuck even with older lastActivity', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

      const sessions = [
        createMockSession({
          id: '1',
          name: 'Stuck Session',
          status: 'active',
          lastActivity: oneHourAgo, // Stuck (>30 min)
        }),
        createMockSession({
          id: '2',
          name: 'Error Session',
          status: 'error',
          lastActivity: twoMinutesAgo, // Recent but error
        }),
      ]

      render(
        <SessionList
          sessions={sessions}
          activeSessionId="1"
          onSessionSelect={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      // Error should come first despite being more recent
      expect(buttons[0]).toHaveAccessibleName(/Error Session/)
      expect(buttons[1]).toHaveAccessibleName(/Stuck Session/)
    })
  })
})
