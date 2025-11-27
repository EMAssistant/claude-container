/**
 * GitPanel Component
 * Story 5.3: Git Panel UI Component
 *
 * Features:
 * - New "Git" tab in left sidebar (alongside Files, Workflow)
 * - Branch name display with ahead/behind counts
 * - Pull/Push buttons (disabled when nothing to push/pull)
 * - Staged files section (green #A3BE8C) with [Unstage] buttons
 * - Modified files section (yellow #EBCB8B) with [Diff] [Stage] buttons
 * - Untracked files section (gray #81A1C1) with [Diff] [Stage] buttons
 * - Commit message input with [Auto-generate] button
 * - [Commit Staged Files] button (disabled when no staged files)
 * - Real-time updates via WebSocket git.status.updated
 */

import { useState } from 'react'
import { GitBranch, ArrowUp, ArrowDown, Circle, CheckCircle2, HelpCircle } from 'lucide-react'
import { useGitStatus } from '@/hooks/useGitStatus'
import { useSprint } from '@/context/SprintContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { generateCommitMessage } from '@/utils/commitMessageGenerator'
import type { UseWebSocketReturn } from '@/hooks/useWebSocket'
import type { GitFileEntry } from '@/hooks/useGitStatus'

export interface GitPanelProps {
  sessionId: string
  ws: UseWebSocketReturn
}

/**
 * GitPanel Component
 *
 * Displays git status for a session worktree with real-time updates.
 * Provides UI for staging, committing, pushing, and pulling changes.
 */
export function GitPanel({ sessionId, ws }: GitPanelProps) {
  const { status, loading, error, refetch } = useGitStatus(sessionId, { ws })
  const { sprintStatus } = useSprint()
  const { toast } = useToast()
  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  // Handle stage file
  const handleStage = async (filePath: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [filePath] })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Stage failed')
      }

      // WebSocket git.status.updated will trigger UI update via useGitStatus
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stage file'
      toast({
        type: 'error',
        title: 'Stage failed',
        description: errorMessage,
      })
    }
  }

  // Handle unstage file
  const handleUnstage = async (filePath: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/unstage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [filePath] })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Unstage failed')
      }

      // WebSocket git.status.updated will trigger UI update via useGitStatus
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unstage file'
      toast({
        type: 'error',
        title: 'Unstage failed',
        description: errorMessage,
      })
    }
  }

  // Handle commit
  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast({
        type: 'warning',
        title: 'Commit message required',
        description: 'Please enter a commit message',
      })
      return
    }

    setIsCommitting(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.details || errorData.error || 'Commit failed'
        throw new Error(errorMsg)
      }

      const data = await res.json()
      const shortHash = data.commitHash?.substring(0, 7) || 'unknown'

      toast({
        type: 'success',
        title: 'Commit created',
        description: `Commit ${shortHash} created successfully`,
      })

      // Clear commit message
      setCommitMessage('')

      // WebSocket git.status.updated will trigger UI update
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to commit'
      toast({
        type: 'error',
        title: 'Commit failed',
        description: errorMessage,
      })
    } finally {
      setIsCommitting(false)
    }
  }

  // Handle push
  const handlePush = async () => {
    setIsPushing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Push failed')
      }

      toast({
        type: 'success',
        title: 'Push successful',
        description: 'Commits pushed to remote',
      })

      // Refetch git status to update ahead/behind counts
      refetch()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to push'
      toast({
        type: 'error',
        title: 'Push failed',
        description: errorMessage,
      })
    } finally {
      setIsPushing(false)
    }
  }

  // Handle pull
  const handlePull = async () => {
    setIsPulling(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Pull failed')
      }

      const data = await res.json()
      const commitCount = data.commits || 0

      toast({
        type: 'success',
        title: 'Pull successful',
        description: `Pulled ${commitCount} commit${commitCount !== 1 ? 's' : ''} from remote`,
      })

      // Refetch git status to update ahead/behind counts
      refetch()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pull'
      toast({
        type: 'error',
        title: 'Pull failed',
        description: errorMessage,
      })
    } finally {
      setIsPulling(false)
    }
  }

  // Auto-generate commit message
  const autoGenerateMessage = () => {
    if (!status || status.staged.length === 0) {
      return
    }

    const currentStory = sprintStatus?.currentStory || null
    const generatedMessage = generateCommitMessage(status.staged, currentStory)
    setCommitMessage(generatedMessage)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-sm text-[#D8DEE9]">Loading git status...</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 gap-2">
        <div className="text-sm text-[#BF616A]">Error: {error}</div>
        <Button size="sm" variant="outline" onClick={refetch}>
          Retry
        </Button>
      </div>
    )
  }

  // No status available
  if (!status) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-sm text-[#D8DEE9]">No git status available</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Branch Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#88C0D0]" />
            <span className="font-semibold text-[#D8DEE9]">{status.branch}</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePull}
              disabled={status.behind === 0 || isPulling}
              title={status.behind > 0 ? `Pull ${status.behind} commit${status.behind !== 1 ? 's' : ''} from remote` : 'Already up to date'}
              className="h-8 px-2"
            >
              <ArrowDown className="w-4 h-4 mr-1" />
              Pull
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePush}
              disabled={status.ahead === 0 || isPushing}
              title={status.ahead > 0 ? `Push ${status.ahead} commit${status.ahead !== 1 ? 's' : ''} to remote` : 'Nothing to push'}
              className="h-8 px-2"
            >
              <ArrowUp className="w-4 h-4 mr-1" />
              Push
            </Button>
          </div>
        </div>
        {status.ahead > 0 && (
          <div className="text-xs text-[#A3BE8C]">↑ {status.ahead} ahead</div>
        )}
        {status.behind > 0 && (
          <div className="text-xs text-[#EBCB8B]">↓ {status.behind} behind</div>
        )}
        {status.ahead === 0 && status.behind === 0 && (
          <div className="text-xs text-[#88C0D0]">Up to date</div>
        )}
      </div>

      {/* Scrollable file sections */}
      <div className="flex-1 overflow-auto">
        {/* Staged Files */}
        <div className="border-b border-border">
          <div className="p-2 font-semibold text-sm bg-[#A3BE8C]/10 text-[#A3BE8C] sticky top-0">
            Staged ({status.staged.length})
          </div>
          {status.staged.length === 0 ? (
            <div className="p-4 text-sm text-[#81A1C1] text-center">
              No files staged
            </div>
          ) : (
            status.staged.map((file: GitFileEntry) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 hover:bg-[#3B4252] transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => handleUnstage(file.path)}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity cursor-pointer"
                    title="Click to unstage"
                    aria-label={`Unstage ${file.path}`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#A3BE8C]" />
                  </button>
                  <span className="text-sm text-[#D8DEE9] truncate" title={file.path}>
                    {file.path}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnstage(file.path)}
                  className="h-7 px-2 text-xs flex-shrink-0"
                >
                  Unstage
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Modified Files */}
        <div className="border-b border-border">
          <div className="p-2 font-semibold text-sm bg-[#EBCB8B]/10 text-[#EBCB8B] sticky top-0">
            Modified ({status.modified.length})
          </div>
          {status.modified.length === 0 ? (
            <div className="p-4 text-sm text-[#81A1C1] text-center">
              No modified files
            </div>
          ) : (
            status.modified.map((file: GitFileEntry) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 hover:bg-[#3B4252] transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => handleStage(file.path)}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity cursor-pointer"
                    title="Click to stage"
                    aria-label={`Stage ${file.path}`}
                  >
                    <Circle className="w-4 h-4 text-[#EBCB8B]" />
                  </button>
                  <span className="text-sm text-[#D8DEE9] truncate" title={file.path}>
                    {file.path}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStage(file.path)}
                    className="h-7 px-2 text-xs"
                  >
                    Stage
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Untracked Files */}
        <div className="border-b border-border">
          <div className="p-2 font-semibold text-sm bg-[#81A1C1]/10 text-[#81A1C1] sticky top-0">
            Untracked ({status.untracked.length})
          </div>
          {status.untracked.length === 0 ? (
            <div className="p-4 text-sm text-[#81A1C1] text-center">
              No untracked files
            </div>
          ) : (
            status.untracked.map((file: GitFileEntry) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 hover:bg-[#3B4252] transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => handleStage(file.path)}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity cursor-pointer"
                    title="Click to stage"
                    aria-label={`Stage ${file.path}`}
                  >
                    <HelpCircle className="w-4 h-4 text-[#81A1C1]" />
                  </button>
                  <span className="text-sm text-[#D8DEE9] truncate" title={file.path}>
                    {file.path}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStage(file.path)}
                    className="h-7 px-2 text-xs"
                  >
                    Stage
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Commit Section */}
      <div className="p-4 border-t border-border bg-background-secondary">
        <Button
          size="sm"
          variant="outline"
          onClick={autoGenerateMessage}
          disabled={status.staged.length === 0}
          className={cn(
            "mb-2 w-full",
            status.staged.length === 0 && "opacity-50 cursor-not-allowed"
          )}
        >
          Auto-generate message
        </Button>
        <Textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message (describe your changes)"
          className="mb-2 min-h-[80px] resize-none"
          disabled={status.staged.length === 0}
        />
        <Button
          onClick={handleCommit}
          disabled={status.staged.length === 0 || !commitMessage.trim() || isCommitting}
          title={
            status.staged.length === 0
              ? 'No files staged'
              : !commitMessage.trim()
              ? 'Commit message required'
              : 'Commit staged files'
          }
          className="w-full"
        >
          {isCommitting ? 'Committing...' : 'Commit Staged Files'}
        </Button>
      </div>
    </div>
  )
}
