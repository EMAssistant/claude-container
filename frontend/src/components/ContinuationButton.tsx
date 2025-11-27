/**
 * ContinuationButton Component - Create Next Story / Start Next Epic
 * Story 6.9: Create Next Story Action
 *
 * Displays action buttons when:
 * - All stories in current epic are done/review → [+ Create Next Story]
 * - Epic is complete and next epic exists → [+ Start Epic N+1]
 *
 * Sends workflow commands to terminal via WebSocket
 */

import { useCallback, useMemo } from 'react'
import { Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSprint } from '@/context/SprintContext'
import type { EpicData, StoryData } from '@/types'

export interface ContinuationButtonProps {
  /** Active session ID for command execution */
  activeSessionId: string | null
  /** Optional className for styling */
  className?: string
}

/**
 * Determine continuation action based on epic/story state
 */
interface ContinuationAction {
  type: 'create-story' | 'start-epic' | 'none'
  label: string
  command: string
  icon: 'plus' | 'arrow'
}

function determineContinuationAction(
  stories: StoryData[],
  epicData: EpicData | null,
  epics: EpicData[]
): ContinuationAction {
  if (!epicData || stories.length === 0) {
    return { type: 'none', label: '', command: '', icon: 'plus' }
  }

  // Check if all stories are done or review
  const allDoneOrReview = stories.every(
    (s) => s.status === 'done' || s.status === 'review'
  )

  // Check if epic is complete (all stories done, retrospective completed or null)
  const allDone = stories.every((s) => s.status === 'done')
  const retroComplete = epicData.retrospective === 'completed' || epicData.retrospective === null

  // Find next epic
  const nextEpic = epics.find((e) => e.epicNumber === epicData.epicNumber + 1)

  // Logic from Story 6.9:
  // If epic complete and next epic exists → Start next epic
  if (allDone && retroComplete && nextEpic) {
    return {
      type: 'start-epic',
      label: `Start Epic ${nextEpic.epicNumber}`,
      command: `/bmad:bmm:workflows:epic-tech-context ${nextEpic.epicNumber}`,
      icon: 'arrow',
    }
  }

  // If all stories done/review → Create next story
  if (allDoneOrReview) {
    return {
      type: 'create-story',
      label: 'Create Next Story',
      command: '/bmad:bmm:workflows:create-story',
      icon: 'plus',
    }
  }

  return { type: 'none', label: '', command: '', icon: 'plus' }
}

/**
 * Send command to terminal via WebSocket
 */
function sendCommand(sessionId: string, command: string): void {
  // Construct WebSocket message
  const message = {
    type: 'terminal.input',
    sessionId,
    data: `${command}\n`,
  }

  // Get WebSocket from global or context
  // For now, dispatch a custom event that App.tsx will handle
  const event = new CustomEvent('terminal-command', {
    detail: message,
  })
  window.dispatchEvent(event)
}

/**
 * ContinuationButton Component
 */
export function ContinuationButton({
  activeSessionId,
  className = '',
}: ContinuationButtonProps) {
  const { sprintStatus, selectedEpicNumber } = useSprint()

  // Get current epic data and stories
  const epicData = useMemo(() => {
    if (!sprintStatus) return null
    return (
      sprintStatus.epics.find((e) => e.epicNumber === selectedEpicNumber) || null
    )
  }, [sprintStatus, selectedEpicNumber])

  const stories = useMemo(() => {
    if (!sprintStatus) return []
    return sprintStatus.stories.filter(
      (s) => s.epicNumber === selectedEpicNumber
    )
  }, [sprintStatus, selectedEpicNumber])

  // Determine action
  const action = useMemo(
    () => determineContinuationAction(stories, epicData, sprintStatus?.epics || []),
    [stories, epicData, sprintStatus?.epics]
  )

  // Handle button click
  const handleClick = useCallback(() => {
    if (!activeSessionId || action.type === 'none') return
    sendCommand(activeSessionId, action.command)
  }, [activeSessionId, action])

  // Don't render if no action or no session
  if (action.type === 'none') {
    return null
  }

  const isDisabled = !activeSessionId

  return (
    <div className={`px-4 py-3 border-t border-border bg-background-secondary ${className}`}>
      <Button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full justify-center gap-2 ${
          action.type === 'start-epic'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        title={
          isDisabled
            ? 'No active session - select a session first'
            : `Execute: ${action.command}`
        }
      >
        {action.icon === 'plus' ? (
          <Plus className="w-4 h-4" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
        {action.label}
      </Button>
      {isDisabled && (
        <p className="mt-2 text-xs text-center text-gray-500">
          Select an active session to execute workflow
        </p>
      )}
    </div>
  )
}
