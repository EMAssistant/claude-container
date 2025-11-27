// Story 5.8: ArtifactToast component tests
// AC#1, AC#2, AC#3, AC#4, AC#7, AC#8

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ArtifactToast } from '../ArtifactToast'

describe('ArtifactToast', () => {
  // Mock props
  let mockProps: any

  beforeEach(() => {
    mockProps = {
      artifactName: 'SessionList.tsx',
      artifactPath: 'frontend/src/components/SessionList.tsx',
      sessionId: 'test-session-123',
      onApprove: vi.fn(),
      onViewDiff: vi.fn(),
      onDismiss: vi.fn(),
    }
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('AC#1: Toast display with filename and buttons', () => {
    it('should render filename with "modified" label', () => {
      render(<ArtifactToast {...mockProps} />)

      expect(screen.getByText('SessionList.tsx modified')).toBeInTheDocument()
    })

    it('should render file icon', () => {
      render(<ArtifactToast {...mockProps} />)

      // Check for file icon emoji (📄)
      const icon = screen.getByRole('img', { name: 'File' })
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveTextContent('📄')
    })

    it('should render three action buttons', () => {
      render(<ArtifactToast {...mockProps} />)

      expect(screen.getByRole('button', { name: /view diff/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    })
  })

  describe('AC#7: Oceanic Calm theme styling', () => {
    it('should have info variant styling with blue border', () => {
      const { container } = render(<ArtifactToast {...mockProps} />)

      const toast = container.firstChild as HTMLElement
      expect(toast).toHaveClass('border-[#88C0D0]')
    })

    it('should have approve button with green background', () => {
      render(<ArtifactToast {...mockProps} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      expect(approveButton).toHaveClass('bg-[#A3BE8C]/20')
      expect(approveButton).toHaveClass('text-[#A3BE8C]')
    })

    it('should have min-width of 400px and max-width of 600px', () => {
      const { container } = render(<ArtifactToast {...mockProps} />)

      const toast = container.firstChild as HTMLElement
      expect(toast).toHaveClass('min-w-[400px]')
      expect(toast).toHaveClass('max-w-[600px]')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA roles and labels', () => {
      render(<ArtifactToast {...mockProps} />)

      // Check status role for live region
      const toast = screen.getByRole('status')
      expect(toast).toBeInTheDocument()

      // Check button labels
      expect(screen.getByRole('button', { name: 'View diff for SessionList.tsx' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Approve SessionList.tsx' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dismiss notification for SessionList.tsx' })).toBeInTheDocument()
    })
  })

  describe('AC#4: Auto-dismiss timer and hover behavior', () => {
    it('should auto-dismiss after 10 seconds', () => {
      render(<ArtifactToast {...mockProps} />)

      // Fast-forward time by 10 seconds
      vi.advanceTimersByTime(10000)

      // onDismiss should be called
      expect(mockProps.onDismiss).toHaveBeenCalledTimes(1)
    })

    it('should pause timer on hover', async () => {
      const { container } = render(<ArtifactToast {...mockProps} />)
      const toast = container.firstChild as HTMLElement

      // Verify timer starts
      expect(mockProps.onDismiss).not.toHaveBeenCalled()

      // Hover over toast immediately (before timer fires) using fireEvent
      act(() => {
        fireEvent.mouseEnter(toast)
      })

      // Advance way past the 10 second mark
      act(() => {
        vi.advanceTimersByTime(20000)
      })

      // onDismiss should NOT be called (timer paused)
      expect(mockProps.onDismiss).not.toHaveBeenCalled()
    })

    it('should resume timer after mouse leave', () => {
      const { container } = render(<ArtifactToast {...mockProps} />)
      const toast = container.firstChild as HTMLElement

      // Hover and unhover
      toast.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
      vi.advanceTimersByTime(5000) // 5s while paused
      toast.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))

      // Fast-forward remaining time
      vi.advanceTimersByTime(10000) // 10s after unpause

      // onDismiss should now be called
      expect(mockProps.onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('AC#2: Button interactions', () => {
    it('should call handleApprove when Approve button clicked', async () => {
      const onApprove = vi.fn().mockResolvedValue(undefined)
      render(<ArtifactToast {...mockProps} onApprove={onApprove} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      approveButton.click()

      expect(onApprove).toHaveBeenCalledWith('frontend/src/components/SessionList.tsx')
    })

    it('should call handleViewDiff when View Diff button clicked', () => {
      render(<ArtifactToast {...mockProps} />)

      const viewDiffButton = screen.getByRole('button', { name: /view diff/i })
      viewDiffButton.click()

      expect(mockProps.onViewDiff).toHaveBeenCalledWith('frontend/src/components/SessionList.tsx')
    })

    it('should call handleDismiss when Dismiss button clicked', () => {
      render(<ArtifactToast {...mockProps} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      dismissButton.click()

      expect(mockProps.onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('AC#2: Success state after approval', () => {
    it('should show success state after successful approval', async () => {
      const onApprove = vi.fn().mockResolvedValue(undefined)
      const { rerender } = render(<ArtifactToast {...mockProps} onApprove={onApprove} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      approveButton.click()

      // Wait for state update
      await vi.waitFor(() => {
        expect(screen.getByText(/approved and staged/i)).toBeInTheDocument()
      })

      // Success checkmark should be visible
      const successIcon = screen.getByRole('img', { name: 'Success' })
      expect(successIcon).toBeInTheDocument()
      expect(successIcon).toHaveTextContent('✓')

      // Success state should auto-dismiss after 4 seconds
      vi.advanceTimersByTime(4000)
      expect(mockProps.onDismiss).toHaveBeenCalledTimes(1)
    })

    it('should show loading state during approval', async () => {
      const onApprove = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
      render(<ArtifactToast {...mockProps} onApprove={onApprove} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      approveButton.click()

      // Wait for state update to show loading state
      await vi.waitFor(() => {
        const button = screen.getByRole('button', { name: /approve/i })
        expect(button).toBeDisabled()
        expect(button).toHaveTextContent('...')
      })
    })
  })

  describe('AC#8: Error state on API failure', () => {
    it('should show error state on approval failure', async () => {
      const onApprove = vi.fn().mockRejectedValue(new Error('Network error'))
      render(<ArtifactToast {...mockProps} onApprove={onApprove} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      approveButton.click()

      // Wait for error state
      await vi.waitFor(() => {
        expect(screen.getByText(/failed to approve/i)).toBeInTheDocument()
      })

      // Error should have alert role
      const errorToast = screen.getByRole('alert')
      expect(errorToast).toBeInTheDocument()

      // Error state should have red border
      expect(errorToast).toHaveClass('border-[#BF616A]')

      // Error state should auto-dismiss after 8 seconds
      vi.advanceTimersByTime(8000)
      expect(mockProps.onDismiss).toHaveBeenCalledTimes(1)
    })

    it('should not auto-dismiss while in error state before timeout', async () => {
      const onApprove = vi.fn().mockRejectedValue(new Error('Network error'))
      render(<ArtifactToast {...mockProps} onApprove={onApprove} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      approveButton.click()

      // Wait for error state
      await vi.waitFor(() => {
        expect(screen.getByText(/failed to approve/i)).toBeInTheDocument()
      })

      // Advance time by less than 8 seconds
      vi.advanceTimersByTime(5000)

      // Should NOT be dismissed yet
      expect(mockProps.onDismiss).not.toHaveBeenCalled()
    })
  })
})
