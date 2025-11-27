/**
 * useGitStatus Hook
 * Story 5.3: Git Panel UI Component
 *
 * Features:
 * - Fetches initial git status from GET /api/sessions/:sessionId/git/status
 * - Subscribes to git.status.updated WebSocket message for real-time updates
 * - Filters WebSocket messages by sessionId
 * - Returns { status, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react'
import type { UseWebSocketReturn } from './useWebSocket'

export interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?' | 'MM' | 'AM'
  oldPath?: string
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFileEntry[]
  modified: GitFileEntry[]
  untracked: GitFileEntry[]
}

export interface UseGitStatusReturn {
  status: GitStatus | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export interface UseGitStatusOptions {
  ws: UseWebSocketReturn
}

/**
 * useGitStatus Hook
 *
 * Manages git status state for a session with real-time WebSocket updates.
 *
 * @param sessionId - The session ID to fetch git status for
 * @param options - WebSocket instance from useWebSocket hook
 * @returns Git status state with loading/error states and refetch function
 */
export function useGitStatus(sessionId: string, options: UseGitStatusOptions): UseGitStatusReturn {
  const { ws } = options
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch git status from API
  const fetchStatus = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/sessions/${sessionId}/git/status`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch git status: ${response.statusText}`)
      }

      const data = await response.json()
      setStatus(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching git status'
      setError(errorMessage)
      console.error('Failed to fetch git status:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Initial fetch on mount or sessionId change
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Subscribe to WebSocket git.status.updated messages
  useEffect(() => {
    if (!sessionId || !ws) {
      return
    }

    const unsubscribe = ws.on('git.status.updated', (message) => {
      // Filter by sessionId - only update if message is for this session
      if (message.sessionId === sessionId && message.status) {
        setStatus(message.status as unknown as GitStatus)
      }
    })

    return unsubscribe
  }, [sessionId, ws])

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
  }
}
