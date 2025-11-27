/**
 * GitPanel Component Tests
 * Story 5.3: Git Panel UI Component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GitPanel } from './GitPanel'
import type { UseWebSocketReturn } from '@/hooks/useWebSocket'

// Mock useGitStatus hook
vi.mock('@/hooks/useGitStatus', () => ({
  useGitStatus: vi.fn(),
}))

// Mock useToast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

// Mock useSprint hook
vi.mock('@/context/SprintContext', () => ({
  useSprint: vi.fn(() => ({
    sprintStatus: null,
    selectedEpicNumber: 0,
    isLoading: false,
    error: null,
    activeSessionId: null,
    setSelectedEpic: vi.fn(),
    refreshStatus: vi.fn(),
  })),
}))

import { useGitStatus } from '@/hooks/useGitStatus'
import { useToast } from '@/components/ui/use-toast'
import { useSprint } from '@/context/SprintContext'

// Mock fetch globally
global.fetch = vi.fn()

describe('GitPanel', () => {
  let mockWs: UseWebSocketReturn
  let mockToast: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockWs = {
      isConnected: true,
      reconnecting: false,
      connectionStatus: 'connected',
      send: vi.fn(),
      sendInput: vi.fn(),
      sendInterrupt: vi.fn(),
      sendAttach: vi.fn(),
      sendDetach: vi.fn(),
      sendResume: vi.fn(),
      retryConnection: vi.fn(),
      on: vi.fn(() => vi.fn()),
    }

    mockToast = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: mockToast })

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText('Loading git status...')).toBeInTheDocument()
  })

  it('renders error state with retry button', () => {
    const mockRefetch = vi.fn()
    vi.mocked(useGitStatus).mockReturnValue({
      status: null,
      loading: false,
      error: 'Failed to fetch',
      refetch: mockRefetch,
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText(/Error: Failed to fetch/)).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('renders branch name and ahead/behind indicators', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'feature-branch',
        ahead: 2,
        behind: 1,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText('feature-branch')).toBeInTheDocument()
    expect(screen.getByText('↑ 2 ahead')).toBeInTheDocument()
    expect(screen.getByText('↓ 1 behind')).toBeInTheDocument()
  })

  it('displays "Up to date" when ahead and behind are 0', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText('Up to date')).toBeInTheDocument()
  })

  it('renders staged files with unstage buttons', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [
          { path: 'file1.ts', status: 'M' },
          { path: 'file2.ts', status: 'A' },
        ],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText('Staged (2)')).toBeInTheDocument()
    expect(screen.getByText('file1.ts')).toBeInTheDocument()
    expect(screen.getByText('file2.ts')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /unstage/i })).toHaveLength(2)
  })

  it('renders modified files with stage buttons', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [
          { path: 'modified1.ts', status: 'M' },
          { path: 'modified2.ts', status: 'M' },
        ],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText('Modified (2)')).toBeInTheDocument()
    expect(screen.getByText('modified1.ts')).toBeInTheDocument()
    expect(screen.getByText('modified2.ts')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^stage$/i })).toHaveLength(2)
  })

  it('renders untracked files with stage buttons', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [
          { path: 'new1.ts', status: '?' },
          { path: 'new2.ts', status: '?' },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    expect(screen.getByText('Untracked (2)')).toBeInTheDocument()
    expect(screen.getByText('new1.ts')).toBeInTheDocument()
    expect(screen.getByText('new2.ts')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^stage$/i })).toHaveLength(2)
  })

  it('calls stage API when stage button clicked', async () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [{ path: 'test.ts', status: 'M' }],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const stageButton = screen.getByRole('button', { name: /^stage$/i })
    fireEvent.click(stageButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/git/stage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: ['test.ts'] }),
        })
      )
    })
  })

  it('calls unstage API when unstage button clicked', async () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [{ path: 'test.ts', status: 'M' }],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const unstageButton = screen.getByRole('button', { name: /unstage/i })
    fireEvent.click(unstageButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/git/unstage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: ['test.ts'] }),
        })
      )
    })
  })

  it('disables commit button when no files staged', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const commitButton = screen.getByRole('button', { name: /commit staged files/i })
    expect(commitButton).toBeDisabled()
  })

  it('disables commit button when message is empty', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [{ path: 'test.ts', status: 'M' }],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const commitButton = screen.getByRole('button', { name: /commit staged files/i })
    expect(commitButton).toBeDisabled()
  })

  it('auto-generates commit message for single file', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [{ path: 'test.ts', status: 'M' }],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const autoGenButton = screen.getByRole('button', { name: /auto-generate message/i })
    fireEvent.click(autoGenButton)

    const textarea = screen.getByPlaceholderText(/commit message/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('Update test.ts')
  })

  it('auto-generates commit message for multiple files', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [
          { path: 'file1.ts', status: 'M' },
          { path: 'file2.ts', status: 'A' },
        ],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const autoGenButton = screen.getByRole('button', { name: /auto-generate message/i })
    fireEvent.click(autoGenButton)

    const textarea = screen.getByPlaceholderText(/commit message/i) as HTMLTextAreaElement
    // New behavior: uses "Implement feature" for code files without story context
    expect(textarea.value).toContain('Implement feature')
    expect(textarea.value).toContain('- file1.ts')
    expect(textarea.value).toContain('- file2.ts')
  })

  it('disables push button when ahead is 0', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const pushButton = screen.getByRole('button', { name: /push/i })
    expect(pushButton).toBeDisabled()
  })

  it('enables push button when ahead > 0', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 2,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const pushButton = screen.getByRole('button', { name: /push/i })
    expect(pushButton).not.toBeDisabled()
  })

  it('disables pull button when behind is 0', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const pullButton = screen.getByRole('button', { name: /pull/i })
    expect(pullButton).toBeDisabled()
  })

  it('enables pull button when behind > 0', () => {
    vi.mocked(useGitStatus).mockReturnValue({
      status: {
        branch: 'main',
        ahead: 0,
        behind: 3,
        staged: [],
        modified: [],
        untracked: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<GitPanel sessionId="session-1" ws={mockWs} />)

    const pullButton = screen.getByRole('button', { name: /pull/i })
    expect(pullButton).not.toBeDisabled()
  })
})
