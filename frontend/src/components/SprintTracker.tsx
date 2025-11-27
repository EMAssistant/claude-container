/**
 * SprintTracker Component
 * Story 6.3: Sprint Tracker Component (MVP View)
 * Story 6.4: Artifact Display Under Steps (StoryRow integration)
 *
 * Displays epic and story progress with:
 * - Epic header with progress bar (completedStories/totalStories)
 * - Status icons: ✓ (done), ◉ (review), → (in-progress), ○ (drafted/ready-for-dev), · (backlog)
 * - Current story highlighted
 * - Story rows with expandable artifact display
 * - Real-time updates via sprint.updated WebSocket messages
 */

import { useMemo, useState, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { useSprint } from '@/context/SprintContext'
import { useLayout } from '@/context/LayoutContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useToast } from '@/components/ui/use-toast'
import { StoryRow } from '@/components/StoryRow'
import { EpicSelector } from '@/components/EpicSelector'
import { ContinuationButton } from '@/components/ContinuationButton'
import { Button } from '@/components/ui/button'
import { executeEpicWorkflow } from '@/utils/workflowActions'

/**
 * ProgressBar Component
 * Displays completion ratio with animated progress bar
 */
interface ProgressBarProps {
  completed: number
  total: number
}

function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0

  return (
    <div className="mt-2">
      {/* Progress bar container */}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-success transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      {/* Numeric label */}
      <div className="mt-1 text-sm text-foreground-secondary">
        {completed}/{total} stories ({percentage}%)
      </div>
    </div>
  )
}

/**
 * SprintTracker Component
 * Main sprint visualization showing epic/story progress
 */
export function SprintTracker() {
  const { sprintStatus, selectedEpicNumber, isLoading, error, activeSessionId, setSelectedEpic } = useSprint()
  const { setSelectedFile, setMainContentMode } = useLayout()
  const websocketUrl = 'ws://localhost:3000'
  const ws = useWebSocket(websocketUrl)
  const { toast } = useToast()
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set())

  /**
   * Filter stories for selected epic
   */
  const stories = useMemo(() => {
    if (!sprintStatus) return []
    return sprintStatus.stories
      .filter(story => story.epicNumber === selectedEpicNumber)
      .sort((a, b) => a.storyNumber - b.storyNumber)
  }, [sprintStatus, selectedEpicNumber])

  /**
   * Get epic data for selected epic
   */
  const epicData = useMemo(() => {
    if (!sprintStatus) return null
    return sprintStatus.epics.find(epic => epic.epicNumber === selectedEpicNumber) || null
  }, [sprintStatus, selectedEpicNumber])

  /**
   * Calculate completion count
   */
  const completedCount = useMemo(() => {
    return stories.filter(story => story.status === 'done').length
  }, [stories])

  /**
   * Toggle story expansion
   */
  const handleToggleExpand = useCallback((storyId: string) => {
    setExpandedStories(prev => {
      const next = new Set(prev)
      if (next.has(storyId)) {
        next.delete(storyId)
      } else {
        next.add(storyId)
      }
      return next
    })
  }, [])

  /**
   * Check if epic has tech spec (status === 'contexted')
   */
  const hasTechSpec = epicData?.status === 'contexted'

  /**
   * Get the tech spec artifact from epic data
   */
  const techSpecArtifact = epicData?.artifacts?.find(a => a.name === 'Tech Spec')

  /**
   * Handle viewing tech spec
   */
  const handleViewTechSpec = useCallback(() => {
    if (techSpecArtifact?.path) {
      setSelectedFile(activeSessionId, techSpecArtifact.path)
      setMainContentMode('artifact')
    }
  }, [techSpecArtifact, activeSessionId, setSelectedFile, setMainContentMode])

  /**
   * Handle creating tech spec
   */
  const handleCreateTechSpec = useCallback(() => {
    if (!epicData) return

    const showToast = (message: string, type: 'error' | 'info') => {
      toast({
        variant: type === 'error' ? 'error' : 'default',
        title: type === 'error' ? 'Error' : 'Info',
        description: message
      })
    }

    executeEpicWorkflow({
      workflow: 'epic-tech-context',
      epicNumber: epicData.epicNumber,
      activeSessionId,
      sendMessage: ws.send,
      setMainContentMode,
      showToast
    })
  }, [epicData, activeSessionId, ws.send, setMainContentMode, toast])

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className="p-4 text-center text-foreground-secondary">
        Loading sprint status...
      </div>
    )
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="p-4 text-center text-error">
        Error: {error}
      </div>
    )
  }

  /**
   * Empty state (no sprint-status.yaml)
   */
  if (!sprintStatus) {
    return (
      <div className="p-4 text-center text-foreground-secondary">
        <p>No sprint status data available.</p>
        <p className="text-sm mt-2">Run sprint-planning workflow to initialize.</p>
      </div>
    )
  }

  /**
   * No epic selected or epic not found
   */
  if (!epicData) {
    return (
      <div className="p-4 text-center text-foreground-secondary">
        Epic {selectedEpicNumber} not found.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Epic header */}
      <div className="px-4 py-3 border-b border-border bg-background-secondary">
        {/* Story 6.7: Epic selector dropdown */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">
            Epic {epicData.epicNumber}: {epicData.title || epicData.epicKey}
          </h2>
          {/* Epic navigation dropdown */}
          {sprintStatus.epics.length > 1 && (
            <EpicSelector
              epics={sprintStatus.epics}
              selectedEpicNumber={selectedEpicNumber}
              onEpicSelect={setSelectedEpic}
            />
          )}
        </div>

        {/* Tech Spec artifact display */}
        <div className="flex items-center gap-2 text-sm mb-2 group">
          <span className="text-muted">└─</span>
          <span>📄</span>
          {hasTechSpec ? (
            <button
              onClick={handleViewTechSpec}
              className="text-foreground-secondary hover:text-primary hover:underline cursor-pointer"
            >
              Tech Spec
            </button>
          ) : (
            <>
              <span className="text-foreground-secondary">Tech Spec</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateTechSpec}
                className="h-5 px-2 text-xs text-primary hover:text-primary hover:bg-primary/20"
                title="Generate Epic Tech Spec"
              >
                <FileText className="w-3 h-3 mr-1" />
                Create
              </Button>
            </>
          )}
        </div>

        {/* Progress bar with story count */}
        <ProgressBar completed={completedCount} total={stories.length} />
      </div>

      {/* Story list */}
      <div className="flex-1 overflow-y-auto">
        {stories.length === 0 ? (
          <div className="p-4 text-center text-foreground-secondary">
            No stories in this epic yet.
          </div>
        ) : (
          <div className="divide-y divide-border" role="list" aria-label="Story list">
            {stories.map(story => (
              <StoryRow
                key={story.storyId}
                story={story}
                isHighlighted={story.storyId === sprintStatus.currentStory}
                isExpanded={expandedStories.has(story.storyId)}
                onToggle={() => handleToggleExpand(story.storyId)}
                activeSessionId={activeSessionId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Story 6.9: Continuation button for creating next story or starting next epic */}
      <ContinuationButton activeSessionId={activeSessionId} />
    </div>
  )
}
