/**
 * SprintContext - Sprint Status State Management
 * Story 6.3: Sprint Tracker Component (MVP View)
 * Story 6.5: Action Buttons for Workflow Execution (activeSessionId)
 *
 * Manages:
 * - Sprint status data (epics, stories, artifacts)
 * - Selected epic for filtering story list
 * - Active session ID for command execution (Story 6.5)
 * - WebSocket subscription to sprint.updated messages
 * - Initial data fetch from GET /api/sprint/status
 *
 * State updated in real-time via WebSocket when sprint-status.yaml changes.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SprintStatus, ArtifactInfo } from '@/types'

// Types
export interface SprintContextState {
  /** Current sprint status (null if no sprint-status.yaml exists) */
  sprintStatus: SprintStatus | null
  /** Selected epic number for filtering (defaults to currentEpic) */
  selectedEpicNumber: number
  /** Whether sprint data is being loaded */
  isLoading: boolean
  /** Error message if fetch/parse fails */
  error: string | null
  /** Story 6.5: Active session ID for action button commands */
  activeSessionId: string | null
}

export interface SprintContextValue extends SprintContextState {
  /** Update selected epic number */
  setSelectedEpic: (epicNumber: number) => void
  /** Manually refresh sprint status from API */
  refreshStatus: () => Promise<void>
}

// Context
const SprintContext = createContext<SprintContextValue | undefined>(undefined)

export interface SprintProviderProps {
  children: ReactNode
}

/**
 * SprintProvider - Provides sprint status state to entire app
 *
 * Fetches initial data on mount via GET /api/sprint/status
 * Subscribes to WebSocket sprint.updated messages for real-time updates
 */
export function SprintProvider({ children }: SprintProviderProps) {
  const [state, setState] = useState<SprintContextState>({
    sprintStatus: null,
    selectedEpicNumber: 0,
    isLoading: true,
    error: null,
    activeSessionId: null,
  })

  // Access WebSocket hook (assumes parent provides WebSocket via context or prop)
  // Note: We'll need to pass WebSocket instance or use a global hook
  // For now, using the pattern from WorkflowContext which doesn't subscribe in context
  // Instead, we'll subscribe in App.tsx and update via a method

  /**
   * Fetch sprint status from API
   */
  const fetchSprintStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/sprint/status')

      if (!response.ok) {
        // Handle 404 as empty state (no sprint-status.yaml yet)
        if (response.status === 404) {
          setState({
            sprintStatus: null,
            selectedEpicNumber: 0,
            isLoading: false,
            error: null,
            activeSessionId: null,
          })
          return
        }

        throw new Error(`Failed to fetch sprint status: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.sprintStatus) {
        setState(prev => ({
          sprintStatus: data.sprintStatus,
          selectedEpicNumber: data.sprintStatus.currentEpic || 0,
          isLoading: false,
          error: null,
          activeSessionId: prev.activeSessionId,
        }))
      } else {
        setState(prev => ({
          sprintStatus: null,
          selectedEpicNumber: 0,
          isLoading: false,
          error: null,
          activeSessionId: prev.activeSessionId,
        }))
      }
    } catch (error) {
      console.error('Failed to fetch sprint status:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }))
    }
  }, [])

  /**
   * Fetch initial sprint status on mount
   */
  useEffect(() => {
    fetchSprintStatus()
  }, [fetchSprintStatus])

  /**
   * Update selected epic number
   */
  const setSelectedEpic = useCallback((epicNumber: number) => {
    setState(prev => ({ ...prev, selectedEpicNumber: epicNumber }))
  }, [])

  /**
   * Refresh sprint status from API
   */
  const refreshStatus = useCallback(async () => {
    await fetchSprintStatus()
  }, [fetchSprintStatus])

  /**
   * Update sprint status from WebSocket message
   * This method will be called from App.tsx WebSocket listener
   */
  const updateSprintStatus = useCallback((sprintStatus: SprintStatus) => {
    setState(prev => ({
      ...prev,
      sprintStatus,
      // Preserve selectedEpicNumber unless current epic changed
      selectedEpicNumber: prev.selectedEpicNumber || sprintStatus.currentEpic || 0,
    }))
  }, [])

  /**
   * Story 6.5: Update active session ID
   * Called from App.tsx when active session changes
   */
  const setActiveSessionId = useCallback((sessionId: string | null) => {
    setState(prev => ({ ...prev, activeSessionId: sessionId }))
  }, [])

  /**
   * Story 5.5: Update individual artifact in a story
   * Called from App.tsx when artifact.updated WebSocket message received
   */
  const updateArtifact = useCallback((storyId: string, artifact: ArtifactInfo) => {
    setState(prev => {
      if (!prev.sprintStatus) return prev

      // Find the story and update its artifact
      const updatedStories = prev.sprintStatus.stories.map(story => {
        if (story.storyId !== storyId) return story

        // Find and update the matching artifact
        const updatedArtifacts = story.artifacts.map(a =>
          a.path === artifact.path ? { ...a, ...artifact } : a
        )

        // If artifact not found, add it
        const artifactExists = story.artifacts.some(a => a.path === artifact.path)
        if (!artifactExists) {
          updatedArtifacts.push(artifact)
        }

        return { ...story, artifacts: updatedArtifacts }
      })

      return {
        ...prev,
        sprintStatus: {
          ...prev.sprintStatus,
          stories: updatedStories,
        },
      }
    })
  }, [])

  const value: SprintContextValue = {
    ...state,
    setSelectedEpic,
    refreshStatus,
  }

  // Store internal methods accessible to consumers
  // This is a pattern to allow external updates without re-rendering
  // For simplicity, we'll add them to the context value (even though not in the public interface)
  const extendedValue = {
    ...value,
    updateSprintStatus, // Not in public interface, used internally by App.tsx
    setActiveSessionId, // Story 6.5: Not in public interface, used internally by App.tsx
    updateArtifact, // Story 5.5: Not in public interface, used internally by App.tsx
  } as SprintContextValue & {
    updateSprintStatus: (status: SprintStatus) => void
    setActiveSessionId: (sessionId: string | null) => void
    updateArtifact: (storyId: string, artifact: ArtifactInfo) => void
  }

  return <SprintContext.Provider value={extendedValue}>{children}</SprintContext.Provider>
}

/**
 * Hook to access sprint context
 * @throws Error if used outside SprintProvider
 */
export function useSprint(): SprintContextValue {
  const context = useContext(SprintContext)
  if (!context) {
    throw new Error('useSprint must be used within a SprintProvider')
  }
  return context
}

/**
 * Internal hook to access extended context with updateSprintStatus, setActiveSessionId, and updateArtifact
 * Only used by App.tsx for WebSocket updates and session management
 * Story 5.5: Added updateArtifact method for artifact.updated WebSocket messages
 */
export function useSprintInternal() {
  const context = useContext(SprintContext) as SprintContextValue & {
    updateSprintStatus: (status: SprintStatus) => void
    setActiveSessionId: (sessionId: string | null) => void
    updateArtifact: (storyId: string, artifact: ArtifactInfo) => void
  } | undefined
  if (!context) {
    throw new Error('useSprintInternal must be used within a SprintProvider')
  }
  return context
}
