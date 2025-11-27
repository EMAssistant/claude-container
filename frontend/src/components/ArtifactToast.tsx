// Story 5.8: Quick-approve toast notification component
// AC#1, AC#2, AC#3, AC#4, AC#7, AC#8

import { useEffect, useState } from 'react'
import { getFileIcon } from '@/utils/fileTypes'
import { cn } from '@/lib/utils'

export interface ArtifactToastProps {
  artifactName: string
  artifactPath: string
  sessionId: string
  onApprove: (path: string) => Promise<void>
  onViewDiff: (path: string) => void
  onDismiss: () => void
}

/**
 * ArtifactToast component - Quick-approve toast for Claude-modified files
 *
 * Features:
 * - AC#1: Displays file icon + filename + action buttons
 * - AC#2: Approve button approves and stages without navigation
 * - AC#3: View Diff button opens ArtifactViewer
 * - AC#4: Dismiss button or auto-timeout leaves file pending
 * - AC#7: Oceanic Calm theme styling
 * - AC#8: Error handling for API failures
 */
export function ArtifactToast({
  artifactName,
  artifactPath,
  sessionId: _sessionId,
  onApprove,
  onViewDiff,
  onDismiss,
}: ArtifactToastProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  // AC#1: Auto-dismiss timer (10 seconds)
  useEffect(() => {
    // Don't auto-dismiss if currently approving, already approved, or has error
    if (isApproving || isApproved || error || isPaused) {
      return
    }

    const timer = setTimeout(() => {
      onDismiss()
    }, 10000)

    return () => clearTimeout(timer)
  }, [isApproving, isApproved, error, isPaused, onDismiss])

  // AC#8: Error auto-dismiss after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        onDismiss()
      }, 8000)

      return () => clearTimeout(timer)
    }
  }, [error, onDismiss])

  // AC#2: Handle approve action
  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(artifactPath)
      setIsApproved(true)
      // AC#2: Success toast auto-dismisses after 4 seconds
      setTimeout(onDismiss, 4000)
    } catch (err) {
      // AC#8: Show error, allow retry
      setError(err instanceof Error ? err.message : 'Failed to approve')
      setIsApproving(false)
    }
  }

  // AC#1: Pause timer on hover (good UX practice from story)
  const handleMouseEnter = () => setIsPaused(true)
  const handleMouseLeave = () => setIsPaused(false)

  // AC#2: Success state - green checkmark with "approved and staged" message
  if (isApproved) {
    return (
      <div
        className="flex items-center gap-2 bg-[#2E3440] border-l-4 border-[#A3BE8C] p-3 rounded min-w-[400px] max-w-[600px] shadow-lg"
        role="status"
        aria-live="polite"
      >
        <span className="text-lg" role="img" aria-label="Success">✓</span>
        <span className="text-sm text-[#D8DEE9]">{artifactName} approved and staged</span>
      </div>
    )
  }

  // AC#8: Error state - red border with error message
  if (error) {
    return (
      <div
        className="flex items-center gap-2 bg-[#2E3440] border-l-4 border-[#BF616A] p-3 rounded min-w-[400px] max-w-[600px] shadow-lg"
        role="alert"
        aria-live="assertive"
      >
        <span className="text-sm text-[#D8DEE9]">Failed to approve: {error}</span>
      </div>
    )
  }

  // AC#1, AC#7: Default state - info variant with file icon and action buttons
  const fileIcon = getFileIcon(artifactPath)

  return (
    <div
      className="flex items-center gap-2 bg-[#2E3440] border-l-4 border-[#88C0D0] p-3 rounded min-w-[400px] max-w-[600px] shadow-lg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="status"
      aria-live="polite"
    >
      {/* AC#1: File icon */}
      <span className="text-lg" role="img" aria-label="File">
        {fileIcon}
      </span>

      {/* AC#1: Filename */}
      <span className="text-sm text-[#D8DEE9] flex-1">{artifactName} modified</span>

      {/* AC#1, AC#2, AC#3, AC#4: Action buttons */}
      <div className="flex gap-1">
        {/* AC#3: View Diff button */}
        <button
          onClick={() => onViewDiff(artifactPath)}
          className={cn(
            "px-2 py-1 text-xs rounded text-[#88C0D0]",
            "hover:bg-[#3B4252] transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-[#88C0D0]"
          )}
          aria-label={`View diff for ${artifactName}`}
        >
          View Diff
        </button>

        {/* AC#2: Approve button with loading state */}
        <button
          onClick={handleApprove}
          disabled={isApproving}
          className={cn(
            "px-2 py-1 text-xs rounded bg-[#A3BE8C]/20 text-[#A3BE8C]",
            "hover:bg-[#A3BE8C]/30 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-[#A3BE8C]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label={`Approve ${artifactName}`}
        >
          {isApproving ? '...' : '✓ Approve'}
        </button>

        {/* AC#4: Dismiss button */}
        <button
          onClick={onDismiss}
          className={cn(
            "px-2 py-1 text-xs rounded text-[#D8DEE9]",
            "hover:bg-[#3B4252] transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-[#88C0D0]"
          )}
          aria-label={`Dismiss notification for ${artifactName}`}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
