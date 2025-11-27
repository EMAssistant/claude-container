/**
 * AttentionBadge Component Tests
 * Story 4.2: Session Attention Badges and Prioritization
 *
 * Tests:
 * - Priority calculation (error > stuck > waiting)
 * - Tooltip content for each status type
 * - Badge color mapping to Oceanic Calm palette
 * - Badge visibility (only error/stuck/waiting shown)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttentionBadge, calculatePriority } from './AttentionBadge'

describe('AttentionBadge', () => {
  const mockLastActivity = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago

  describe('Priority Calculation', () => {
    it('should calculate error priority correctly', () => {
      expect(calculatePriority('error', false)).toBe('error')
      expect(calculatePriority('error', true)).toBe('error') // error overrides stuck
    })

    it('should calculate stuck priority correctly', () => {
      expect(calculatePriority('active', true)).toBe('stuck')
      expect(calculatePriority('idle', true)).toBe('stuck')
      expect(calculatePriority('waiting', true)).toBe('stuck') // stuck overrides waiting
    })

    it('should calculate waiting priority correctly', () => {
      expect(calculatePriority('waiting', false)).toBe('waiting')
    })

    it('should calculate active priority correctly', () => {
      expect(calculatePriority('active', false)).toBe('active')
    })

    it('should calculate idle priority correctly', () => {
      expect(calculatePriority('idle', false)).toBe('idle')
      expect(calculatePriority('stopped', false)).toBe('idle') // unknown status defaults to idle
    })
  })

  describe('Badge Visibility', () => {
    it('should render badge for error status', () => {
      render(<AttentionBadge status="error" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-error')
      expect(badge).toBeInTheDocument()
    })

    it('should render badge for stuck status', () => {
      render(<AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={true} />)
      const badge = screen.getByTestId('attention-badge-stuck')
      expect(badge).toBeInTheDocument()
    })

    it('should render badge for waiting status', () => {
      render(<AttentionBadge status="waiting" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-waiting')
      expect(badge).toBeInTheDocument()
    })

    it('should NOT render badge for active status', () => {
      render(<AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={false} />)
      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()
    })

    it('should NOT render badge for idle status', () => {
      render(<AttentionBadge status="idle" lastActivity={mockLastActivity} isStuck={false} />)
      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()
    })

    it('should NOT render badge for stopped status', () => {
      render(<AttentionBadge status="stopped" lastActivity={mockLastActivity} isStuck={false} />)
      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()
    })
  })

  describe('Badge Colors (Oceanic Calm Palette)', () => {
    it('should use red color (#BF616A) for error badge', () => {
      render(<AttentionBadge status="error" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-error')
      expect(badge).toHaveStyle({ backgroundColor: '#BF616A' })
    })

    it('should use yellow color (#EBCB8B) for stuck badge', () => {
      render(<AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={true} />)
      const badge = screen.getByTestId('attention-badge-stuck')
      expect(badge).toHaveStyle({ backgroundColor: '#EBCB8B' })
    })

    it('should use blue color (#88C0D0) for waiting badge', () => {
      render(<AttentionBadge status="waiting" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-waiting')
      expect(badge).toHaveStyle({ backgroundColor: '#88C0D0' })
    })
  })

  describe('Tooltip Content', () => {
    it('should show "Session crashed" tooltip for error status', () => {
      render(<AttentionBadge status="error" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-error')
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Session crashed'))
    })

    it('should show "No output for 30+ minutes" tooltip for stuck status', () => {
      render(<AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={true} />)
      const badge = screen.getByTestId('attention-badge-stuck')
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('No output for 30+ minutes'))
    })

    it('should show "Waiting for input" tooltip for waiting status', () => {
      render(<AttentionBadge status="waiting" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-waiting')
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Waiting for input'))
    })

    it('should include relative time in tooltip', () => {
      render(<AttentionBadge status="waiting" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-waiting')
      // Should show "2m ago" for 2 minutes
      expect(badge).toHaveAttribute('aria-label', expect.stringMatching(/\d+[smhd] ago/))
    })
  })

  describe('Real-time Updates', () => {
    it('should update badge when status changes from active to error', () => {
      const { rerender } = render(
        <AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={false} />
      )
      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()

      rerender(<AttentionBadge status="error" lastActivity={mockLastActivity} isStuck={false} />)
      expect(screen.getByTestId('attention-badge-error')).toBeInTheDocument()
    })

    it('should update badge when session becomes stuck', () => {
      const { rerender } = render(
        <AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={false} />
      )
      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()

      rerender(<AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={true} />)
      expect(screen.getByTestId('attention-badge-stuck')).toBeInTheDocument()
    })

    it('should update badge when status changes from waiting to active', () => {
      const { rerender } = render(
        <AttentionBadge status="waiting" lastActivity={mockLastActivity} isStuck={false} />
      )
      expect(screen.getByTestId('attention-badge-waiting')).toBeInTheDocument()

      rerender(<AttentionBadge status="active" lastActivity={mockLastActivity} isStuck={false} />)
      expect(screen.queryByTestId(/attention-badge/)).not.toBeInTheDocument()
    })
  })

  describe('Priority Ordering', () => {
    it('should prioritize error over stuck', () => {
      const errorPriority = calculatePriority('error', true)
      const stuckPriority = calculatePriority('active', true)
      expect(errorPriority).toBe('error')
      expect(stuckPriority).toBe('stuck')
    })

    it('should prioritize stuck over waiting', () => {
      const stuckPriority = calculatePriority('waiting', true)
      const waitingPriority = calculatePriority('waiting', false)
      expect(stuckPriority).toBe('stuck')
      expect(waitingPriority).toBe('waiting')
    })

    it('should prioritize waiting over active', () => {
      const waitingPriority = calculatePriority('waiting', false)
      const activePriority = calculatePriority('active', false)
      expect(waitingPriority).toBe('waiting')
      expect(activePriority).toBe('active')
    })
  })

  describe('Accessibility', () => {
    it('should have aria-label attribute for screen readers', () => {
      render(<AttentionBadge status="error" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-error')
      expect(badge).toHaveAttribute('aria-label')
    })

    it('should have appropriate size for visibility (2x2 pixels minimum)', () => {
      render(<AttentionBadge status="error" lastActivity={mockLastActivity} isStuck={false} />)
      const badge = screen.getByTestId('attention-badge-error')
      expect(badge).toHaveClass('w-2', 'h-2')
    })
  })
})
