/**
 * Unit tests for SessionDestroyDialog component
 * Story 2.7: Session Destruction with Cleanup Options
 * Story 4.18: Active Session Destroy Protection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionDestroyDialog } from './SessionDestroyDialog'

describe('SessionDestroyDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render when open', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText('Destroy Session?')).toBeInTheDocument()
      expect(screen.getByText(/test-session/)).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.queryByText('Destroy Session?')).not.toBeInTheDocument()
    })
  })

  describe('Story 4.18: Active Session Warning', () => {
    it('should show active session warning when status is active', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="active"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Check for the warning message
      expect(screen.getByText(/This session is actively running/)).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to destroy it/)).toBeInTheDocument()
    })

    it('should NOT show active session warning when status is idle', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Warning should not be present
      expect(screen.queryByText(/This session is actively running/)).not.toBeInTheDocument()
    })

    it('should NOT show active session warning when status is waiting', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="waiting"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Warning should not be present
      expect(screen.queryByText(/This session is actively running/)).not.toBeInTheDocument()
    })

    it('should NOT show active session warning when status is stopped', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="stopped"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Warning should not be present
      expect(screen.queryByText(/This session is actively running/)).not.toBeInTheDocument()
    })

    it('should NOT show active session warning when status is error', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="error"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Warning should not be present
      expect(screen.queryByText(/This session is actively running/)).not.toBeInTheDocument()
    })
  })

  describe('Story 2.7: Worktree cleanup checkbox', () => {
    it('should render worktree cleanup checkbox', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText('Delete git worktree')).toBeInTheDocument()
    })

    it('should show default message when checkbox is unchecked', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      expect(screen.getByText(/Git worktree and branch will remain for later use/)).toBeInTheDocument()
    })

    it('should show warning message when checkbox is checked', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(screen.getByText(/Warning: Git worktree will be permanently deleted/)).toBeInTheDocument()
    })

    it('should call onConfirm with cleanup=false when Destroy clicked without checkbox', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const destroyButton = screen.getByText('Destroy')
      fireEvent.click(destroyButton)

      expect(mockOnConfirm).toHaveBeenCalledWith(false)
    })

    it('should call onConfirm with cleanup=true when Destroy clicked with checkbox', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      const destroyButton = screen.getByText('Destroy')
      fireEvent.click(destroyButton)

      expect(mockOnConfirm).toHaveBeenCalledWith(true)
    })
  })

  describe('User interactions', () => {
    it('should call onClose when Cancel button is clicked', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should show loading state when isLoading is true', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isLoading={true}
        />
      )

      expect(screen.getByText('Destroying...')).toBeInTheDocument()
    })

    it('should disable buttons when isLoading is true', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isLoading={true}
        />
      )

      const cancelButton = screen.getByText('Cancel') as HTMLButtonElement
      const destroyButton = screen.getByText('Destroying...') as HTMLButtonElement

      expect(cancelButton.disabled).toBe(true)
      expect(destroyButton.disabled).toBe(true)
    })

    it('should disable checkbox when isLoading is true', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="idle"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isLoading={true}
        />
      )

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.disabled).toBe(true)
    })
  })

  describe('Story 4.18: Active session with worktree cleanup warning', () => {
    it('should show both active session warning and worktree warning when active session with cleanup checked', () => {
      render(
        <SessionDestroyDialog
          sessionId="test-id"
          sessionName="test-session"
          sessionStatus="active"
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      )

      // Active session warning should be visible
      expect(screen.getByText(/This session is actively running/)).toBeInTheDocument()

      // Check the worktree cleanup checkbox
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      // Both warnings should now be visible
      expect(screen.getByText(/This session is actively running/)).toBeInTheDocument()
      expect(screen.getByText(/Warning: Git worktree will be permanently deleted/)).toBeInTheDocument()
    })
  })
})
