import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export interface SessionDestroyDialogProps {
  /** Session ID to destroy */
  sessionId: string
  /** Session name to display in message */
  sessionName: string
  /** Session status (Story 4.18: used for active session warning) */
  sessionStatus: 'active' | 'idle' | 'waiting' | 'error' | 'stopped' | string
  /** Whether dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed (Cancel button or X) */
  onClose: () => void
  /** Callback when user confirms destruction */
  onConfirm: (cleanup: boolean) => void
  /** Whether destruction is in progress */
  isLoading?: boolean
}

/**
 * SessionDestroyDialog Component
 * Story 2.7: Session Destruction with Cleanup Options
 * Story 4.18: Active Session Destroy Protection
 *
 * Confirmation dialog for destroying sessions with optional worktree cleanup.
 * Implements destructive action pattern from Oceanic Calm design system.
 * Shows enhanced warning for active sessions.
 *
 * @example
 * ```tsx
 * <SessionDestroyDialog
 *   sessionId="abc-123"
 *   sessionName="feature-auth"
 *   sessionStatus="active"
 *   isOpen={true}
 *   onClose={() => setDialogOpen(false)}
 *   onConfirm={(cleanup) => handleDestroy(sessionId, cleanup)}
 * />
 * ```
 */
export function SessionDestroyDialog({
  sessionId,
  sessionName,
  sessionStatus,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: SessionDestroyDialogProps) {
  // Checkbox state for worktree cleanup (defaults to unchecked)
  const [deleteWorktree, setDeleteWorktree] = useState(false)

  // Story 4.18: Check if session is actively running
  const isActiveSession = sessionStatus === 'active'

  // Reset checkbox when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteWorktree(false)
      onClose()
    }
  }

  // Handle confirm button click
  const handleConfirm = () => {
    onConfirm(deleteWorktree)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Destroy Session?</DialogTitle>
          <DialogDescription>
            {/* Story 4.18: Enhanced warning for active sessions */}
            {isActiveSession && (
              <span className="block mb-3 p-3 bg-[#EBCB8B]/10 border border-[#EBCB8B] rounded text-[#EBCB8B] font-medium">
                ⚠️ This session is actively running. Are you sure you want to destroy it?
              </span>
            )}
            Session <span className="font-semibold text-[#D8DEE9]">'{sessionName}'</span> will be terminated.
            {!deleteWorktree && (
              <span className="block mt-2">
                Git worktree and branch will remain for later use.
              </span>
            )}
            {deleteWorktree && (
              <span className="block mt-2 text-[#EBCB8B]">
                Warning: Git worktree will be permanently deleted.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id={`destroy-worktree-${sessionId}`}
            checked={deleteWorktree}
            onCheckedChange={(checked: boolean | 'indeterminate') => setDeleteWorktree(checked === true)}
            disabled={isLoading}
          />
          <Label
            htmlFor={`destroy-worktree-${sessionId}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Delete git worktree
          </Label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-[#BF616A] hover:bg-[#A54E56] text-[#ECEFF4]"
          >
            {isLoading ? 'Destroying...' : 'Destroy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
