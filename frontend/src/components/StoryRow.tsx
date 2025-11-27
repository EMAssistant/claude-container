/**
 * StoryRow Component - Individual Story Display with Artifacts
 * Story 6.4: Artifact Display Under Steps
 * Story 6.5: Action Buttons for Workflow Execution
 * Story 5.5: Artifact Review Badges in Sprint Tracker
 *
 * Displays a story row with expandable artifact list. Each artifact shows:
 * - File type icon (📄 .md, 📋 .xml, 📊 .yaml)
 * - Artifact name with [View] button
 * - Missing artifacts shown grayed with "(missing)" label
 * - Action button for workflow execution (Story 6.5)
 * - Review status badge (pending/approved/changes-requested) - Story 5.5
 * - Hover-reveal [✓] Approve and [✎] Request Changes buttons - Story 5.5
 *
 * Props:
 * - story: StoryData with artifacts array
 * - isExpanded: Whether artifact list is visible
 * - onToggle: Callback to toggle expansion
 * - isHighlighted: Whether this is the current story
 * - activeSessionId: Active session for command execution (Story 6.5)
 */

import { Button } from '@/components/ui/button'
import { useLayout } from '@/context/LayoutContext'
import { ActionButton } from '@/components/ActionButton'
import { ArtifactReviewBadge } from '@/components/ArtifactReviewBadge'
import { RequestChangesModal } from '@/components/RequestChangesModal'
import { useToast } from '@/components/ui/use-toast'
import { useSprint } from '@/context/SprintContext'
import { Check, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { StoryData, ArtifactInfo } from '@/types'

export interface StoryRowProps {
  story: StoryData
  isExpanded: boolean
  onToggle: () => void
  isHighlighted: boolean
  activeSessionId?: string | null // Story 6.5: Active session for command execution
}

/**
 * Get status icon and color based on story status
 */
function getStatusIcon(status: StoryData['status']): { icon: string; color: string } {
  switch (status) {
    case 'done':
      return { icon: '✓', color: 'text-success' }
    case 'review':
      return { icon: '◉', color: 'text-warning' }
    case 'in-progress':
      return { icon: '→', color: 'text-primary' }
    case 'ready-for-dev':
      return { icon: '○', color: 'text-secondary' }
    case 'drafted':
      return { icon: '○', color: 'text-foreground-secondary' }
    case 'backlog':
      return { icon: '·', color: 'text-muted' }
    default:
      return { icon: '○', color: 'text-foreground-secondary' }
  }
}

/**
 * Get file type icon based on file extension
 */
function getFileIcon(path: string): string {
  if (path.endsWith('.md')) return '📄'
  if (path.endsWith('.xml')) return '📋'
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return '📊'
  return '📄' // Default to document icon
}

/**
 * Count pending/changes-requested artifacts (Story 5.5)
 */
function countPendingArtifacts(artifacts: ArtifactInfo[]): number {
  return artifacts.filter(
    (a) => a.reviewStatus === 'pending' || a.reviewStatus === 'changes-requested'
  ).length
}

/**
 * Check if all reviewable artifacts are approved (Story 5.5)
 * Returns true only if there are reviewable artifacts AND all are approved
 */
function allArtifactsApproved(artifacts: ArtifactInfo[]): boolean {
  const reviewableArtifacts = artifacts.filter((a) => a.reviewStatus !== null && a.reviewStatus !== undefined)
  if (reviewableArtifacts.length === 0) return false // No reviewable artifacts
  return reviewableArtifacts.every((a) => a.reviewStatus === 'approved')
}

/**
 * ArtifactList - Renders nested artifact list with [View] buttons and review badges (Story 5.5)
 */
interface ArtifactListProps {
  artifacts: ArtifactInfo[]
  onViewArtifact: (path: string) => void
}

function ArtifactList({ artifacts, onViewArtifact }: ArtifactListProps) {
  const { toast } = useToast()
  const { activeSessionId } = useSprint()

  // Story 5.7: Modal state for request changes
  const [isRequestChangesModalOpen, setIsRequestChangesModalOpen] = useState(false)
  const [selectedArtifactForChanges, setSelectedArtifactForChanges] = useState<ArtifactInfo | null>(null)

  if (artifacts.length === 0) {
    return null
  }

  // Story 5.6: Approve artifact handler with API call
  const handleApprove = async (artifactPath: string) => {
    if (!activeSessionId) {
      toast({
        title: 'No active session',
        description: 'Please select a session to approve artifacts',
        type: 'error',
      })
      return
    }

    try {
      // Extract relative path from artifact (remove workspace prefix if present)
      const relativePath = artifactPath.replace('/workspace/', '')
      const encodedPath = encodeURIComponent(relativePath)

      const response = await fetch(
        `/api/sessions/${activeSessionId}/artifacts/${encodedPath}/approve`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to approve: ${response.statusText}`)
      }

      await response.json()

      // Story 5.6 AC #1: Show success toast
      const approvedFilename = artifactPath.split('/').pop() || artifactPath
      toast({
        title: 'Artifact Approved',
        description: `${approvedFilename} approved and staged`,
        type: 'success',
      })

      // UI will update via artifact.updated WebSocket message
    } catch (error) {
      const errorFilename = artifactPath.split('/').pop() || artifactPath
      toast({
        title: 'Approval Failed',
        description: `Failed to approve ${errorFilename}: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
      })
    }
  }

  // Story 5.7: Request changes handler - open modal
  const handleRequestChanges = (artifact: ArtifactInfo) => {
    setSelectedArtifactForChanges(artifact)
    setIsRequestChangesModalOpen(true)
  }

  // Story 5.7: Submit feedback handler - call API
  const handleSubmitFeedback = async (feedback: string) => {
    if (!activeSessionId || !selectedArtifactForChanges) return

    try {
      // Extract relative path from artifact (remove workspace prefix if present)
      const relativePath = selectedArtifactForChanges.path.replace('/workspace/', '')
      const encodedPath = encodeURIComponent(relativePath)

      const response = await fetch(
        `/api/sessions/${activeSessionId}/artifacts/${encodedPath}/request-changes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to send feedback: ${response.statusText}`)
      }

      await response.json()

      // Story 5.7 AC #3: Show success toast
      toast({
        title: 'Feedback Sent',
        description: `Feedback sent to Claude`,
        type: 'success',
      })

      // Close modal on success
      setIsRequestChangesModalOpen(false)
      setSelectedArtifactForChanges(null)

      // UI will update via artifact.updated WebSocket message
    } catch (error) {
      // Story 5.7 AC #7: Show error toast, keep modal open
      toast({
        title: 'Failed to Send Feedback',
        description: `Failed to send feedback: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
      })
      throw error // Re-throw so modal knows submission failed
    }
  }

  return (
    <ul className="ml-8 mt-2 space-y-1 border-l-2 border-border pl-4">
      {artifacts.map((artifact, index) => {
        // Check if artifact is pending or changes-requested (show action buttons)
        const isPendingOrChangesRequested =
          artifact.reviewStatus === 'pending' || artifact.reviewStatus === 'changes-requested'

        return (
          <li
            key={`${artifact.path}-${index}`}
            className="flex items-center gap-2 text-sm group hover:bg-muted rounded px-2 py-1 -ml-2"
          >
            <span className="flex-shrink-0">{artifact.icon || getFileIcon(artifact.path)}</span>

            {/* Clickable artifact name */}
            {artifact.exists ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewArtifact(artifact.path)
                }}
                className="text-foreground hover:text-primary hover:underline flex-1 truncate text-left cursor-pointer"
                title={artifact.name}
              >
                {artifact.name}
              </button>
            ) : (
              <span
                className="text-foreground-secondary flex-1 truncate"
                title={artifact.name}
              >
                {artifact.name}
                <span className="ml-1 text-xs">(missing)</span>
              </span>
            )}

            {/* Story 5.5: Review status badge */}
            {artifact.reviewStatus && (
              <ArtifactReviewBadge reviewStatus={artifact.reviewStatus} />
            )}

            {/* Story 5.5: Approve and Request Changes buttons (hover-reveal) */}
            {isPendingOrChangesRequested && artifact.exists && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleApprove(artifact.path)
                  }}
                  className="h-7 px-2"
                  title="Approve"
                  aria-label={`Approve ${artifact.name}`}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRequestChanges(artifact)
                  }}
                  className="h-7 px-2"
                  title="Request Changes"
                  aria-label={`Request changes for ${artifact.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        )
      })}

      {/* Story 5.7: Request Changes Modal */}
      {selectedArtifactForChanges && activeSessionId && (
        <RequestChangesModal
          isOpen={isRequestChangesModalOpen}
          onClose={() => {
            setIsRequestChangesModalOpen(false)
            setSelectedArtifactForChanges(null)
          }}
          artifactPath={selectedArtifactForChanges.path}
          artifactName={selectedArtifactForChanges.name}
          sessionId={activeSessionId}
          onSubmit={handleSubmitFeedback}
        />
      )}
    </ul>
  )
}

/**
 * StoryRow Component - Main export
 */
export function StoryRow({ story, isExpanded, onToggle, isHighlighted, activeSessionId }: StoryRowProps) {
  const { setSelectedFile, setMainContentMode } = useLayout()
  const { toast } = useToast()
  const { activeSessionId: contextSessionId } = useSprint()
  const statusInfo = getStatusIcon(story.status)

  // Use activeSessionId from props if provided, otherwise from context
  const sessionId = activeSessionId ?? contextSessionId

  // Story 5.5: Calculate pending count and all-approved status
  const pendingCount = countPendingArtifacts(story.artifacts)
  const allApproved = allArtifactsApproved(story.artifacts)

  const handleViewArtifact = (path: string) => {
    setSelectedFile(sessionId, path)
    setMainContentMode('artifact')
  }

  // Story 5.6: Batch approve all handler with API call
  const handleApproveAll = async (_storyId: string) => {
    if (!sessionId) {
      toast({
        title: 'No active session',
        description: 'Please select a session to approve artifacts',
        type: 'error',
      })
      return
    }

    // Collect pending/changes-requested artifact paths
    const pendingArtifacts = story.artifacts.filter(
      (a) => a.reviewStatus === 'pending' || a.reviewStatus === 'changes-requested'
    )
    const files = pendingArtifacts.map((a) => a.path.replace('/workspace/', ''))

    if (files.length === 0) {
      return
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/artifacts/approve-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to batch approve: ${response.statusText}`)
      }

      const result = await response.json()

      // Story 5.6 AC #4: Show success toast
      toast({
        title: 'All Approved',
        description: `${result.approved} files approved and staged`,
        type: 'success',
      })
    } catch (error) {
      toast({
        title: 'Batch Approval Failed',
        description: `Failed to approve all files: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
      })
    }
  }

  return (
    <div
      className={`
        transition-all duration-200
        ${
          isHighlighted
            ? 'bg-primary/10 border-l-4 border-primary pl-3'
            : 'border-l-4 border-transparent pl-3'
        }
      `}
    >
      {/* Story row - clickable to expand/collapse */}
      <div
        className="flex items-center gap-3 py-2 px-2 cursor-pointer hover:bg-muted rounded group"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        {/* Clickable area for expand/collapse */}
        <div onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0">
          {/* Chevron icon */}
          <span className="flex-shrink-0 text-foreground-secondary text-xs">
            {isExpanded ? '▼' : '▶'}
          </span>

          {/* Status icon */}
          <span className={`flex-shrink-0 font-bold ${statusInfo.color}`}>{statusInfo.icon}</span>

          {/* Story ID */}
          <span className="flex-shrink-0 font-mono text-sm text-foreground-secondary">
            {story.storyId}
          </span>

          {/* Story slug */}
          <span className="flex-1 text-sm text-foreground truncate" title={story.slug}>
            {story.slug}
          </span>

          {/* Story 5.5: Pending count */}
          {pendingCount > 0 && (
            <span className="flex-shrink-0 text-xs text-foreground-secondary">
              ({pendingCount} pending)
            </span>
          )}

          {/* Story 5.5: All approved indicator */}
          {allApproved && (
            <span className="flex-shrink-0 text-xs text-[#A3BE8C] font-medium">
              ✓ All approved
            </span>
          )}

          {/* Status text - hidden for 'done' status since ActionButton shows it */}
          {story.status !== 'done' && !allApproved && pendingCount === 0 && (
            <span className="flex-shrink-0 text-xs text-foreground-secondary capitalize">
              {story.status.replace('-', ' ')}
            </span>
          )}
        </div>

        {/* Story 5.5: Approve All button (hover-reveal) */}
        {pendingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleApproveAll(story.storyId)
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 flex-shrink-0"
            title="Approve all pending artifacts"
            aria-label={`Approve all ${pendingCount} pending artifacts`}
          >
            <Check className="h-4 w-4 mr-1" />
            Approve All
          </Button>
        )}

        {/* Story 6.5: Action button for workflow execution */}
        {activeSessionId !== undefined && (
          <ActionButton
            story={story}
            activeSessionId={activeSessionId}
            className="ml-2 flex-shrink-0"
          />
        )}
      </div>

      {/* Artifact list - shown when expanded */}
      {isExpanded && (
        <div className="overflow-hidden transition-all duration-350">
          <ArtifactList artifacts={story.artifacts} onViewArtifact={handleViewArtifact} />
        </div>
      )}
    </div>
  )
}
