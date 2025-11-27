/**
 * ActionButton Component
 * Story 6.5: Action Buttons for Workflow Execution
 *
 * Renders status-aware action buttons for story workflow execution
 * Used in Sprint Tracker story rows to execute BMAD workflows with one click
 */

import { useCallback } from 'react'
import { useLayout } from '@/context/LayoutContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useToast } from '@/components/ui/use-toast'
import type { StoryData } from '@/types'
import {
  getActionConfig,
  executeWorkflow,
  getActionButtonClasses
} from '@/utils/workflowActions'

interface ActionButtonProps {
  /** Story data containing ID and status */
  story: StoryData
  /** Active session ID from SessionContext */
  activeSessionId: string | null
  /** Optional additional CSS classes */
  className?: string
}

/**
 * ActionButton renders a workflow execution button based on story status
 * Story 6.5 AC6.23-AC6.28
 *
 * Button mappings:
 * - drafted → [▶ Context] (blue)
 * - ready-for-dev → [▶ Start] (green)
 * - review → [▶ Review] (yellow)
 * - done → [✓ Done] (gray, disabled)
 * - in-progress, backlog → no button
 */
export function ActionButton({ story, activeSessionId, className = '' }: ActionButtonProps) {
  const { setMainContentMode } = useLayout()
  const websocketUrl = 'ws://localhost:3000'
  const ws = useWebSocket(websocketUrl)
  const { toast } = useToast()

  // Get action configuration based on story status
  const actionConfig = getActionConfig(story.status)

  // Show toast notification
  const showToast = useCallback(
    (message: string, type: 'error' | 'info') => {
      toast({
        type,
        title: type === 'error' ? 'Workflow Error' : 'Info',
        description: message
      })
    },
    [toast]
  )

  // Handle button click
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Stop propagation to prevent row expansion toggle
      e.stopPropagation()

      // If button is disabled or no command, do nothing
      if (!actionConfig || actionConfig.disabled || !actionConfig.command) {
        return
      }

      // Execute workflow
      executeWorkflow({
        command: actionConfig.command,
        storyId: story.storyId,
        activeSessionId,
        sendMessage: ws.send,
        setMainContentMode,
        showToast
      })
    },
    [actionConfig, story.storyId, activeSessionId, ws.send, setMainContentMode, showToast]
  )

  // If no action button should be shown, return null
  if (!actionConfig) {
    return null
  }

  const buttonClasses = getActionButtonClasses(actionConfig)

  return (
    <button
      onClick={handleClick}
      disabled={actionConfig.disabled}
      className={`${buttonClasses} ${className}`}
      title={
        actionConfig.disabled
          ? 'Story completed'
          : `Execute ${actionConfig.command} workflow for story ${story.storyId}`
      }
    >
      {actionConfig.label}
    </button>
  )
}
