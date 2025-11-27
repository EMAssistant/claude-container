/**
 * Unit tests for SessionModal component
 * Story 2.3: Session Creation REST API and Modal Dialog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionModal, type Session } from './SessionModal'

// Mock fetch API
global.fetch = vi.fn()

describe('SessionModal', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSessionCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
  })

  it('should render when open', () => {
    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    expect(screen.getByText('Create New Session')).toBeInTheDocument()
    expect(screen.getByLabelText('Session Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Branch Name')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <SessionModal
        open={false}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    expect(screen.queryByText('Create New Session')).not.toBeInTheDocument()
  })

  it('should pre-fill auto-generated session name', () => {
    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const sessionNameInput = screen.getByLabelText('Session Name') as HTMLInputElement
    expect(sessionNameInput.value).toMatch(/^feature-\d{4}-\d{2}-\d{2}-\d{3}$/)
  })

  it('should auto-update branch name when session name changes', () => {
    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const sessionNameInput = screen.getByLabelText('Session Name') as HTMLInputElement
    const branchNameInput = screen.getByLabelText('Branch Name') as HTMLInputElement

    fireEvent.change(sessionNameInput, { target: { value: 'my-feature' } })

    expect(branchNameInput.value).toBe('feature/my-feature')
  })

  it('should call API on Create button click', async () => {
    const mockSession: Session = {
      id: 'test-id',
      name: 'test-session',
      status: 'active',
      branch: 'feature/test-session',
      worktreePath: '/workspace/.worktrees/test-id',
      createdAt: '2025-11-24T10:00:00.000Z',
      lastActivity: '2025-11-24T10:00:00.000Z'
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: mockSession })
    })

    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const createButton = screen.getByText('Create')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })
  })

  it('should display loading state during creation', async () => {
    ;(global.fetch as any).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    )

    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const createButton = screen.getByText('Create')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })

  it('should display error message on API failure', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Session name already exists' })
    })

    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const createButton = screen.getByText('Create')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Session name already exists')).toBeInTheDocument()
    })
  })

  it('should call onSessionCreated on successful creation', async () => {
    const mockSession: Session = {
      id: 'test-id',
      name: 'test-session',
      status: 'active',
      branch: 'feature/test-session',
      worktreePath: '/workspace/.worktrees/test-id',
      createdAt: '2025-11-24T10:00:00.000Z',
      lastActivity: '2025-11-24T10:00:00.000Z'
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: mockSession })
    })

    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const createButton = screen.getByText('Create')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(mockOnSessionCreated).toHaveBeenCalledWith(mockSession)
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('should close modal on Cancel button click', () => {
    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('should disable Create button when session name is empty', () => {
    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const sessionNameInput = screen.getByLabelText('Session Name') as HTMLInputElement
    const createButton = screen.getByText('Create') as HTMLButtonElement

    fireEvent.change(sessionNameInput, { target: { value: '' } })

    expect(createButton.disabled).toBe(true)
  })

  it('should disable inputs during loading', async () => {
    ;(global.fetch as any).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    )

    render(
      <SessionModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSessionCreated={mockOnSessionCreated}
      />
    )

    const createButton = screen.getByText('Create')
    fireEvent.click(createButton)

    await waitFor(() => {
      const sessionNameInput = screen.getByLabelText('Session Name') as HTMLInputElement
      const branchNameInput = screen.getByLabelText('Branch Name') as HTMLInputElement
      expect(sessionNameInput.disabled).toBe(true)
      expect(branchNameInput.disabled).toBe(true)
    })
  })
})
