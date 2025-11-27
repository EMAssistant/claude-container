// Story 5.8: useArtifactNotifications hook - WebSocket subscription and toast management
// AC#1, AC#5, AC#6

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useLayout } from '@/context/LayoutContext'
import { ArtifactToast } from '@/components/ArtifactToast'
import { isCodeFile, isExcludedPath } from '@/utils/fileTypes'
import type { UseWebSocketReturn } from '@/hooks/useWebSocket'
import type { ArtifactInfo } from '@/types'

const MAX_VISIBLE_TOASTS = 3

interface QueuedArtifact {
  artifact: ArtifactInfo
  sessionId: string
}

/**
 * useArtifactNotifications hook
 *
 * Features:
 * - AC#1: Subscribe to artifact.updated WebSocket messages
 * - AC#5: Queue management - max 3 visible toasts
 * - AC#6: Filter - only Claude-modified code files trigger notifications
 * - AC#8: Error handling for approval failures
 */
export function useArtifactNotifications(ws: UseWebSocketReturn) {
  const { toast } = useToast()
  const { setSelectedFile, setMainContentMode } = useLayout()
  const [_activeToasts, setActiveToasts] = useState<Set<string>>(new Set())
  const [queuedArtifacts, setQueuedArtifacts] = useState<QueuedArtifact[]>([])
  const toastIdsRef = useRef<Map<string, string>>(new Map()) // path -> toastId

  // AC#2: Handle approve action
  const handleApprove = useCallback(async (sessionId: string, path: string) => {
    const response = await fetch(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(path)}/approve`, {
      method: 'POST',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.details || errorData.error || 'Approval failed')
    }

    // Success - WebSocket will broadcast artifact.updated message
  }, [])

  // AC#3: Handle view diff action
  const handleViewDiff = useCallback((sessionId: string, path: string) => {
    // Set selected file in layout context (per-session)
    setSelectedFile(sessionId, path)
    // Shift to split view (70/30 artifact/terminal)
    setMainContentMode('split')
  }, [setSelectedFile, setMainContentMode])

  // AC#4: Handle dismiss action
  const handleDismiss = useCallback((path: string) => {
    // Remove from active toasts
    setActiveToasts(prev => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })

    // Clear toast ID mapping
    toastIdsRef.current.delete(path)

    // AC#5: Show next queued toast if available
    setQueuedArtifacts(prev => {
      if (prev.length > 0) {
        const [nextArtifact, ...remaining] = prev
        // Show next toast asynchronously to avoid state update conflicts
        setTimeout(() => {
          showToastForArtifact(nextArtifact.artifact, nextArtifact.sessionId)
        }, 100)
        return remaining
      }
      return prev
    })
  }, [])

  // Show toast for an artifact
  const showToastForArtifact = useCallback((artifact: ArtifactInfo, sessionId: string) => {
    // Create toast with custom component
    const { id } = toast({
      // Use Radix Toast with custom render
      title: '',
      description: React.createElement(ArtifactToast, {
        artifactName: artifact.name,
        artifactPath: artifact.path,
        sessionId: sessionId,
        onApprove: (path: string) => handleApprove(sessionId, path),
        onViewDiff: (path: string) => handleViewDiff(sessionId, path),
        onDismiss: () => handleDismiss(artifact.path),
      }),
      type: 'info',
    })

    // Store toast ID for this artifact
    toastIdsRef.current.set(artifact.path, id)
  }, [toast, handleApprove, handleViewDiff, handleDismiss])

  // Subscribe to artifact.updated WebSocket messages
  useEffect(() => {
    const unsubscribe = ws.on('artifact.updated', (message) => {
      // Type assertion for artifact.updated message
      const artifactMessage = message as any

      if (!artifactMessage.artifact || !artifactMessage.sessionId) {
        return
      }

      const artifact = artifactMessage.artifact as ArtifactInfo
      const sessionId = artifactMessage.sessionId as string

      // AC#6: Filter - must be pending status
      if (artifact.reviewStatus !== 'pending') {
        return
      }

      // AC#6: Filter - must be Claude-modified
      if (artifact.modifiedBy !== 'claude') {
        return
      }

      // AC#6: Filter - must be a code file (not docs)
      if (!isCodeFile(artifact.path)) {
        return
      }

      // AC#6: Filter - must not be in excluded paths
      if (isExcludedPath(artifact.path)) {
        return
      }

      // AC#5: Check if we can show immediately or need to queue
      // Use functional state update to get latest state
      setActiveToasts(prev => {
        // AC#5: Prevent duplicates - check if already active
        if (prev.has(artifact.path)) {
          return prev
        }

        // AC#5: Check if we can show immediately or need to queue
        if (prev.size < MAX_VISIBLE_TOASTS) {
          // Show immediately
          showToastForArtifact(artifact, sessionId)
          // Add to active toasts
          const next = new Set(prev)
          next.add(artifact.path)
          return next
        } else {
          // Add to queue
          setQueuedArtifacts(prevQueue => {
            // Check if already in queue
            if (prevQueue.some(q => q.artifact.path === artifact.path)) {
              return prevQueue
            }
            return [...prevQueue, { artifact, sessionId }]
          })
          return prev
        }
      })
    })

    return unsubscribe
  }, [ws, showToastForArtifact])

  // Return queue count for potential "and X more..." display (AC#5)
  return {
    queuedCount: queuedArtifacts.length,
  }
}
