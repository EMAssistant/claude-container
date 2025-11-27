/**
 * Workflow Action Utilities
 * Story 6.5: Action Buttons for Workflow Execution
 *
 * Provides utility functions for executing BMAD workflows from UI components
 * These functions are designed to be reused across Sprint Tracker, Story Rows, and Workflow Progress components
 */

import type { StoryData } from '@/types'

/**
 * Action button configuration based on story status
 * Story 6.5 AC6.23-AC6.26
 */
export interface ActionConfig {
  label: string
  command: string | null
  color: 'blue' | 'green' | 'yellow' | 'gray'
  disabled: boolean
}

/**
 * Valid story ID pattern for security validation
 * Story 6.5: Command Injection Prevention
 * Pattern: {epicNum}-{storyNum} or {epicNum}-{storyNum}-{slug}
 */
const STORY_ID_PATTERN = /^[0-9]+-[0-9]+(-[a-z0-9-]+)?$/

/**
 * Allowed BMAD workflow commands
 * Story 6.5: Security - whitelist only known workflows
 */
const ALLOWED_WORKFLOWS = ['story-context', 'dev-story', 'code-review'] as const
type AllowedWorkflow = typeof ALLOWED_WORKFLOWS[number]

/**
 * Allowed BMAD epic workflows
 * For workflows that operate on epics rather than stories
 */
const ALLOWED_EPIC_WORKFLOWS = ['epic-tech-context'] as const
type AllowedEpicWorkflow = typeof ALLOWED_EPIC_WORKFLOWS[number]

/**
 * Validate story ID format to prevent command injection
 * Story 6.5 Task 5: Command Validation and Security
 *
 * @param storyId - Story ID to validate (e.g., "4-16" or "4-16-session-list-hydration")
 * @returns true if valid, false otherwise
 */
export function isValidStoryId(storyId: string): boolean {
  if (!STORY_ID_PATTERN.test(storyId)) {
    console.warn('[Security] Invalid story ID rejected:', storyId)
    return false
  }
  return true
}

/**
 * Check if workflow command is allowed
 * Story 6.5 Task 5: Command Validation and Security
 *
 * @param workflow - Workflow command to validate
 * @returns true if allowed, false otherwise
 */
export function isAllowedWorkflow(workflow: string): workflow is AllowedWorkflow {
  return ALLOWED_WORKFLOWS.includes(workflow as AllowedWorkflow)
}

/**
 * Get action button configuration for a story based on its status
 * Story 6.5 AC6.23-AC6.26: Status-to-button mapping
 *
 * @param status - Current story status
 * @returns ActionConfig or null if no button should be shown
 */
export function getActionConfig(status: StoryData['status']): ActionConfig | null {
  switch (status) {
    case 'drafted':
      return {
        label: '▶ Context',
        command: 'story-context',
        color: 'blue',
        disabled: false
      }
    case 'ready-for-dev':
      return {
        label: '▶ Start',
        command: 'dev-story',
        color: 'green',
        disabled: false
      }
    case 'review':
      return {
        label: '▶ Review',
        command: 'code-review',
        color: 'yellow',
        disabled: false
      }
    case 'done':
      return {
        label: '✓ Done',
        command: null,
        color: 'gray',
        disabled: true
      }
    case 'in-progress':
    case 'backlog':
    default:
      return null // No button for these statuses
  }
}

/**
 * Build full BMAD workflow command string
 * Story 6.5 AC6.23-AC6.25: Command format
 *
 * @param workflow - Workflow name (story-context, dev-story, code-review)
 * @param storyId - Story ID (e.g., "4-16")
 * @returns Full command string or null if invalid
 */
export function buildWorkflowCommand(workflow: string, storyId: string): string | null {
  // Validate inputs
  if (!isValidStoryId(storyId)) {
    console.error('[Workflow Actions] Invalid story ID:', storyId)
    return null
  }

  if (!isAllowedWorkflow(workflow)) {
    console.error('[Workflow Actions] Invalid workflow command:', workflow)
    return null
  }

  // Build command: /bmad:bmm:workflows:{workflow} {storyId}
  const command = `/bmad:bmm:workflows:${workflow} ${storyId}`
  console.log('[Workflow Actions] Built command:', command)
  return command
}

/**
 * Execute workflow command via WebSocket
 * Story 6.5 AC6.27: Send command to active session terminal
 *
 * @param params - Execution parameters
 * @param params.command - Workflow command name
 * @param params.storyId - Story ID
 * @param params.activeSessionId - Active session ID (required)
 * @param params.sendMessage - WebSocket send function
 * @param params.setMainContentMode - Layout context function to focus terminal
 * @param params.showToast - Toast notification function
 * @returns true if command sent, false otherwise
 */
export function executeWorkflow({
  command,
  storyId,
  activeSessionId,
  sendMessage,
  setMainContentMode,
  showToast
}: {
  command: string
  storyId: string
  activeSessionId: string | null
  sendMessage: (message: { type: string; sessionId: string; data: string }) => void
  setMainContentMode: (mode: 'terminal' | 'artifact' | 'split') => void
  showToast: (message: string, type: 'error' | 'info') => void
}): boolean {
  // Validate story ID
  if (!isValidStoryId(storyId)) {
    showToast('Invalid story ID format', 'error')
    return false
  }

  // Check active session exists
  if (!activeSessionId) {
    showToast('No active session - create one first', 'error')
    return false
  }

  // Build full command
  const fullCommand = buildWorkflowCommand(command, storyId)
  if (!fullCommand) {
    showToast('Failed to build workflow command', 'error')
    return false
  }

  // Log execution for debugging
  console.log('[Sprint Tracker] Executing workflow:', {
    storyId,
    command,
    sessionId: activeSessionId,
    fullCommand
  })

  // Send WebSocket message
  try {
    sendMessage({
      type: 'terminal.input',
      sessionId: activeSessionId,
      data: fullCommand + '\n' // Always end with newline
    })

    // Focus terminal panel
    setMainContentMode('terminal')

    return true
  } catch (error) {
    console.error('[Sprint Tracker] Failed to send workflow command:', error)
    showToast('Failed to execute workflow command', 'error')
    return false
  }
}

/**
 * Check if epic workflow command is allowed
 *
 * @param workflow - Workflow command to validate
 * @returns true if allowed, false otherwise
 */
export function isAllowedEpicWorkflow(workflow: string): workflow is AllowedEpicWorkflow {
  return ALLOWED_EPIC_WORKFLOWS.includes(workflow as AllowedEpicWorkflow)
}

/**
 * Build full BMAD epic workflow command string
 *
 * @param workflow - Workflow name (epic-tech-context)
 * @param epicNumber - Epic number (e.g., 6)
 * @returns Full command string or null if invalid
 */
export function buildEpicWorkflowCommand(workflow: string, epicNumber: number): string | null {
  // Validate epic number
  if (!Number.isInteger(epicNumber) || epicNumber < 1) {
    console.error('[Workflow Actions] Invalid epic number:', epicNumber)
    return null
  }

  if (!isAllowedEpicWorkflow(workflow)) {
    console.error('[Workflow Actions] Invalid epic workflow command:', workflow)
    return null
  }

  // Build command: /bmad:bmm:workflows:{workflow} {epicNumber}
  const command = `/bmad:bmm:workflows:${workflow} ${epicNumber}`
  console.log('[Workflow Actions] Built epic command:', command)
  return command
}

/**
 * Execute epic workflow command via WebSocket
 *
 * @param params - Execution parameters
 * @param params.workflow - Workflow command name
 * @param params.epicNumber - Epic number
 * @param params.activeSessionId - Active session ID (required)
 * @param params.sendMessage - WebSocket send function
 * @param params.setMainContentMode - Layout context function to focus terminal
 * @param params.showToast - Toast notification function
 * @returns true if command sent, false otherwise
 */
export function executeEpicWorkflow({
  workflow,
  epicNumber,
  activeSessionId,
  sendMessage,
  setMainContentMode,
  showToast
}: {
  workflow: string
  epicNumber: number
  activeSessionId: string | null
  sendMessage: (message: { type: string; sessionId: string; data: string }) => void
  setMainContentMode: (mode: 'terminal' | 'artifact' | 'split') => void
  showToast: (message: string, type: 'error' | 'info') => void
}): boolean {
  // Check active session exists
  if (!activeSessionId) {
    showToast('No active session - create one first', 'error')
    return false
  }

  // Build full command
  const fullCommand = buildEpicWorkflowCommand(workflow, epicNumber)
  if (!fullCommand) {
    showToast('Failed to build epic workflow command', 'error')
    return false
  }

  // Log execution for debugging
  console.log('[Workflow Actions] Executing epic workflow:', {
    epicNumber,
    workflow,
    sessionId: activeSessionId,
    fullCommand
  })

  // Send WebSocket message
  try {
    sendMessage({
      type: 'terminal.input',
      sessionId: activeSessionId,
      data: fullCommand + '\n' // Always end with newline
    })

    // Focus terminal panel
    setMainContentMode('terminal')

    return true
  } catch (error) {
    console.error('[Workflow Actions] Failed to send epic workflow command:', error)
    showToast('Failed to execute epic workflow command', 'error')
    return false
  }
}

/**
 * Get button styling classes based on action config
 * Story 6.5: Button color styling
 *
 * @param config - Action button configuration
 * @returns Tailwind CSS classes for button styling
 */
export function getActionButtonClasses(config: ActionConfig): string {
  const baseClasses = 'px-3 py-1 text-xs rounded font-medium transition-colors duration-200'

  if (config.disabled) {
    return `${baseClasses} bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed`
  }

  switch (config.color) {
    case 'blue':
      return `${baseClasses} bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white`
    case 'green':
      return `${baseClasses} bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white`
    case 'yellow':
      return `${baseClasses} bg-amber-500 hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-500 text-white`
    case 'gray':
    default:
      return `${baseClasses} bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700 text-white`
  }
}
