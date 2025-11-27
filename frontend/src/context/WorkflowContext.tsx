/**
 * WorkflowContext - BMAD Workflow State Management
 * Story 3.2: Workflow Progress Component (Compact Linear View)
 *
 * Manages:
 * - Current workflow state (steps, status, completion)
 * - WebSocket subscription to workflow.updated messages
 * - Per-session workflow tracking
 *
 * State updated in real-time via WebSocket when BMAD status YAML files change.
 */

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { WorkflowState } from '@/types'

// Types
export interface WorkflowContextState {
  /** Current workflow state (null if no active session or no workflow data) */
  workflowState: WorkflowState | null
  /** Whether workflow data is available */
  hasWorkflow: boolean
  /** Update workflow state (used by WebSocket message handler) */
  updateWorkflowState: (state: WorkflowState | null) => void
}

// Context
const WorkflowContext = createContext<WorkflowContextState | undefined>(undefined)

export interface WorkflowProviderProps {
  children: ReactNode
}

/**
 * WorkflowProvider - Provides workflow state to entire app
 */
export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null)

  const updateWorkflowState = useCallback((state: WorkflowState | null) => {
    setWorkflowState(state)
  }, [])

  const hasWorkflow = workflowState !== null

  const value: WorkflowContextState = {
    workflowState,
    hasWorkflow,
    updateWorkflowState,
  }

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

/**
 * Hook to access workflow context
 * @throws Error if used outside WorkflowProvider
 */
export function useWorkflow(): WorkflowContextState {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider')
  }
  return context
}
