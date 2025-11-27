/**
 * RequestChangesModal Component Tests
 * Story 5.7: Request Changes Modal with Claude Injection
 *
 * Tests for RequestChangesModal component:
 * - Modal rendering with artifact info
 * - Textarea auto-focus
 * - Real-time preview updates
 * - Keyboard shortcuts (Cmd/Ctrl+Enter, Escape)
 * - Character limit enforcement
 * - Form submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestChangesModal } from '../RequestChangesModal'

describe('RequestChangesModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSubmit = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    artifactPath: 'src/components/SessionList.tsx',
    artifactName: 'SessionList.tsx',
    sessionId: 'test-session-123',
    onSubmit: mockOnSubmit,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render modal with artifact name', () => {
    render(<RequestChangesModal {...defaultProps} />)

    expect(screen.getByText('✎ Request Changes')).toBeInTheDocument()
    expect(screen.getByText('SessionList.tsx')).toBeInTheDocument()
  })

  it('should auto-focus textarea when modal opens', async () => {
    render(<RequestChangesModal {...defaultProps} />)

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')
      expect(textarea).toHaveFocus()
    }, { timeout: 200 })
  })

  it('should update preview as user types', async () => {
    const user = userEvent.setup()
    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')

    // Initially shows placeholder text
    expect(screen.getByText('(Type feedback above to see preview)')).toBeInTheDocument()

    // Type feedback
    await user.type(textarea, 'Add error handling')

    // Preview should update
    await waitFor(() => {
      expect(screen.getByText(/Please revise src\/components\/SessionList.tsx:/)).toBeInTheDocument()
      expect(screen.getByText(/Add error handling/)).toBeInTheDocument()
    })
  })

  it('should show character counter', async () => {
    const user = userEvent.setup()
    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')

    // Initial count
    expect(screen.getByText('0 / 5000 characters')).toBeInTheDocument()

    // Type some text
    await user.type(textarea, 'Test feedback')

    // Count should update
    expect(screen.getByText('13 / 5000 characters')).toBeInTheDocument()
  })

  it('should enforce character limit', async () => {
    const user = userEvent.setup()
    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...') as HTMLTextAreaElement

    // Try to paste text exceeding limit
    const longText = 'x'.repeat(5001)
    await user.click(textarea)
    await user.paste(longText)

    // Should only have 5000 characters
    expect(textarea.value.length).toBe(5000)
    expect(screen.getByText('5000 / 5000 characters')).toBeInTheDocument()
  })

  it('should disable submit button when feedback is empty', () => {
    render(<RequestChangesModal {...defaultProps} />)

    const submitButton = screen.getByText('Send to Claude →')
    expect(submitButton).toBeDisabled()
  })

  it('should enable submit button when feedback is provided', async () => {
    const user = userEvent.setup()
    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')
    const submitButton = screen.getByText('Send to Claude →')

    expect(submitButton).toBeDisabled()

    await user.type(textarea, 'Add error handling')

    expect(submitButton).not.toBeDisabled()
  })

  it('should call onSubmit when submit button is clicked', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValue(undefined)

    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')
    const submitButton = screen.getByText('Send to Claude →')

    await user.type(textarea, 'Add error handling')
    await user.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith('Add error handling')
  })

  it('should submit with Cmd+Enter on macOS', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValue(undefined)

    // Mock navigator.platform for macOS
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })

    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')

    await user.type(textarea, 'Add error handling')
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(mockOnSubmit).toHaveBeenCalledWith('Add error handling')
  })

  it('should submit with Ctrl+Enter on Windows/Linux', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValue(undefined)

    // Mock navigator.platform for Windows
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    })

    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')

    await user.type(textarea, 'Add error handling')
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(mockOnSubmit).toHaveBeenCalledWith('Add error handling')
  })

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<RequestChangesModal {...defaultProps} />)

    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show submitting state while request is in progress', async () => {
    const user = userEvent.setup()
    let resolveSubmit: () => void
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve
    })
    mockOnSubmit.mockReturnValue(submitPromise)

    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')
    const submitButton = screen.getByText('Send to Claude →')

    await user.type(textarea, 'Add error handling')
    await user.click(submitButton)

    // Should show submitting state
    expect(screen.getByText('Sending...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    // Resolve the promise
    resolveSubmit!()
    await waitFor(() => {
      expect(screen.queryByText('Sending...')).not.toBeInTheDocument()
    })
  })

  it('should keep modal open when submission fails', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockRejectedValue(new Error('Network error'))

    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...') as HTMLTextAreaElement
    const submitButton = screen.getByText('Send to Claude →')

    await user.type(textarea, 'Add error handling')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })

    // Modal should still be open
    expect(screen.getByText('✎ Request Changes')).toBeInTheDocument()
    // Feedback should be preserved
    expect(textarea.value).toBe('Add error handling')
  })

  it('should reset feedback when modal is closed and reopened', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...') as HTMLTextAreaElement

    // Type some feedback
    await user.type(textarea, 'Add error handling')
    expect(textarea.value).toBe('Add error handling')

    // Close modal
    rerender(<RequestChangesModal {...defaultProps} isOpen={false} />)

    // Reopen modal
    rerender(<RequestChangesModal {...defaultProps} isOpen={true} />)

    // Feedback should be reset
    await waitFor(() => {
      const newTextarea = screen.getByPlaceholderText('Describe what needs to be changed...') as HTMLTextAreaElement
      expect(newTextarea.value).toBe('')
    })
  })

  it('should not submit when feedback is only whitespace', async () => {
    const user = userEvent.setup()
    render(<RequestChangesModal {...defaultProps} />)

    const textarea = screen.getByPlaceholderText('Describe what needs to be changed...')
    const submitButton = screen.getByText('Send to Claude →')

    await user.type(textarea, '   ')

    expect(submitButton).toBeDisabled()
  })

  it('should show correct keyboard hint based on platform', () => {
    // Test macOS
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })

    const { rerender } = render(<RequestChangesModal {...defaultProps} />)
    expect(screen.getByText(/Cmd\+Enter to submit/)).toBeInTheDocument()

    // Test Windows
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    })

    rerender(<RequestChangesModal {...defaultProps} />)
    expect(screen.getByText(/Ctrl\+Enter to submit/)).toBeInTheDocument()
  })
})
