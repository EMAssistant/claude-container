/**
 * RequestChangesModal Component
 * Story 5.7: Request Changes Modal with Claude Injection
 *
 * Modal for providing feedback on artifacts that need changes.
 * Injects feedback into Claude's PTY stdin for revision.
 *
 * Features:
 * - Auto-focus textarea for immediate typing
 * - Real-time preview of message to be sent to Claude
 * - Keyboard shortcuts: Cmd/Ctrl+Enter to submit, Escape to close
 * - Character limit: 5000 characters with counter
 * - Feedback injection via PTY stdin
 */

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface RequestChangesModalProps {
  isOpen: boolean
  onClose: () => void
  artifactPath: string
  artifactName: string
  sessionId: string
  onSubmit: (feedback: string) => Promise<void>
}

const MAX_FEEDBACK_LENGTH = 5000

/**
 * RequestChangesModal Component
 * Story 5.7 AC #1, #2, #6: Modal with feedback form and preview
 */
export function RequestChangesModal({
  isOpen,
  onClose,
  artifactPath,
  artifactName,
  sessionId: _sessionId,
  onSubmit,
}: RequestChangesModalProps) {
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Story 5.7 AC #1: Auto-focus textarea on modal open
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Delay focus slightly to ensure modal animation completes
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Reset feedback when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFeedback('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Story 5.7 AC #6: Keyboard shortcuts (Cmd+Enter to submit, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      // Cmd+Enter / Ctrl+Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }

      // Note: Escape is handled by Dialog component automatically
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, feedback, isSubmitting])

  const handleSubmit = async () => {
    if (!feedback.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(feedback)
      // Modal will be closed by parent component on success
    } catch (error) {
      // Error is handled by parent component (shows toast)
      // Keep modal open with feedback preserved (Story 5.7 AC #7)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Story 5.7 AC #2: Preview message format
  const previewMessage = feedback.trim()
    ? `Please revise ${artifactPath}:\n${feedback}`
    : ''

  // Platform detection for keyboard hint
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const submitShortcut = isMac ? 'Cmd+Enter' : 'Ctrl+Enter'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>✎ Request Changes</DialogTitle>
          <DialogDescription className="text-sm text-foreground-secondary">
            {artifactName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Story 5.7 AC #1: Feedback textarea */}
          <div>
            <label htmlFor="feedback-textarea" className="text-sm font-medium mb-2 block">
              What needs to be changed?
            </label>
            <Textarea
              id="feedback-textarea"
              ref={textareaRef}
              value={feedback}
              onChange={(e) => {
                const value = e.target.value
                // Enforce character limit
                if (value.length <= MAX_FEEDBACK_LENGTH) {
                  setFeedback(value)
                }
              }}
              placeholder="Describe what needs to be changed..."
              className="min-h-[100px]"
              maxLength={MAX_FEEDBACK_LENGTH}
            />
            <p className="text-xs text-foreground-secondary mt-1 text-right">
              {feedback.length} / {MAX_FEEDBACK_LENGTH} characters
            </p>
          </div>

          {/* Story 5.7 AC #2: Preview section */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Preview (will be sent to Claude):
            </label>
            <div className="bg-muted p-3 rounded-md whitespace-pre-wrap text-sm font-mono min-h-[80px]">
              {previewMessage || '(Type feedback above to see preview)'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!feedback.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send to Claude →'}
            </Button>
          </div>
        </div>

        {/* Story 5.7 AC #6: Keyboard hint */}
        <p className="text-xs text-foreground-secondary text-center mt-2">
          Press {submitShortcut} to submit, Escape to cancel
        </p>
      </DialogContent>
    </Dialog>
  )
}
