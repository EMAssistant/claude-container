/**
 * useGitStatus Hook Tests
 * Story 5.3: Git Panel UI Component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGitStatus } from './useGitStatus'
import type { GitStatus } from './useGitStatus'
import type { UseWebSocketReturn } from './useWebSocket'

// Mock fetch globally
global.fetch = vi.fn()

describe('useGitStatus', () => {
  let mockWs: UseWebSocketReturn
  let onCallbacks: Map<string, (message: any) => void>

  beforeEach(() => {
    onCallbacks = new Map()

    // Mock WebSocket with on/subscribe mechanism
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
      on: vi.fn((type: string, callback: (message: any) => void) => {
        onCallbacks.set(type, callback)
        return () => {
          onCallbacks.delete(type)
        }
      }),
    }

    // Reset fetch mock
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches initial git status on mount', async () => {
    const mockStatus: GitStatus = {
      branch: 'main',
      ahead: 1,
      behind: 0,
      staged: [],
      modified: [{ path: 'test.ts', status: 'M' }],
      untracked: [],
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response)

    const { result } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    // Initial loading state
    expect(result.current.loading).toBe(true)
    expect(result.current.status).toBeNull()
    expect(result.current.error).toBeNull()

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.status).toEqual(mockStatus)
    expect(result.current.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith('/api/sessions/session-1/git/status')
  })

  it('updates state on git.status.updated WebSocket message', async () => {
    const mockStatus: GitStatus = {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response)

    const { result } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Verify WebSocket subscription
    expect(mockWs.on).toHaveBeenCalledWith('git.status.updated', expect.any(Function))

    // Simulate WebSocket message with updated status
    const updatedStatus: GitStatus = {
      branch: 'main',
      ahead: 2,
      behind: 1,
      staged: [{ path: 'new.ts', status: 'A' }],
      modified: [],
      untracked: [],
    }

    const wsCallback = onCallbacks.get('git.status.updated')
    expect(wsCallback).toBeDefined()

    wsCallback!({
      type: 'git.status.updated',
      sessionId: 'session-1',
      status: updatedStatus,
    })

    // Status should update via WebSocket
    await waitFor(() => {
      expect(result.current.status).toEqual(updatedStatus)
    })
  })

  it('filters WebSocket messages by sessionId', async () => {
    const mockStatus: GitStatus = {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response)

    const { result } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const initialStatus = result.current.status

    // Send WebSocket message for different session
    const wsCallback = onCallbacks.get('git.status.updated')
    wsCallback!({
      type: 'git.status.updated',
      sessionId: 'session-2', // Different session
      status: {
        branch: 'other',
        ahead: 5,
        behind: 3,
        staged: [],
        modified: [],
        untracked: [],
      },
    })

    // Status should NOT update (filtered by sessionId)
    expect(result.current.status).toEqual(initialStatus)
  })

  it('handles fetch errors gracefully', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.status).toBeNull()
    expect(result.current.error).toBe('Network error')
  })

  it('handles API error responses', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ error: 'Session not found' }),
    } as Response)

    const { result } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.status).toBeNull()
    expect(result.current.error).toContain('Session not found')
  })

  it('refetch() re-fetches git status', async () => {
    const mockStatus: GitStatus = {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    } as Response)

    const { result } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Call refetch
    result.current.refetch()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('returns error when no sessionId provided', async () => {
    const { result } = renderHook(() => useGitStatus('', { ws: mockWs }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.status).toBeNull()
    expect(result.current.error).toBe('No session ID provided')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('cleans up WebSocket subscription on unmount', async () => {
    const mockStatus: GitStatus = {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response)

    const unsubscribeMock = vi.fn()
    mockWs.on = vi.fn(() => unsubscribeMock)

    const { unmount } = renderHook(() => useGitStatus('session-1', { ws: mockWs }))

    await waitFor(() => {
      expect(mockWs.on).toHaveBeenCalled()
    })

    unmount()

    expect(unsubscribeMock).toHaveBeenCalled()
  })
})
