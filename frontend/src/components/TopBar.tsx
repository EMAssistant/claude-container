/**
 * TopBar Component
 * Story 3.9: Top Bar with Actions and Session Controls
 * Story 4.8: Resource Warning Banner
 *
 * A fixed top bar providing quick access to core actions:
 * - Logo/title
 * - "+ New Session" button
 * - STOP button for interrupting active session
 * - Settings dropdown menu
 * - Resource warning banner (when memory usage high)
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, Terminal, Loader2, Bell, BellOff, BellRing, AlertTriangle, X, Check, Pause } from 'lucide-react'
import { SessionModal } from '@/components/SessionModal'
import { useToast } from '@/components/ui/use-toast'
import { useNotification } from '@/context/NotificationContext'
import { useLayout } from '@/context/LayoutContext'
import type { Session } from '@/types'

export interface TopBarProps {
  activeSessionId: string | null
  activeSessionName?: string | null
  repoName?: string | null
  isConnected: boolean
  onSessionCreated: (session: Session) => void
  onInterrupt: () => void
  onResourceWarning?: (warning: { memoryUsagePercent: number; isAcceptingNewSessions: boolean }) => void
  resourceWarning?: { memoryUsagePercent: number; isAcceptingNewSessions: boolean } | null
}

/**
 * TopBar component with fixed 56px height
 *
 * Features:
 * - Logo and title (left-aligned)
 * - "+ New Session" button (primary variant, #88C0D0 background)
 * - STOP button (destructive variant, #BF616A background)
 * - Settings dropdown menu (ghost variant, #81A1C1 color)
 * - Resource warning banner (Story 4.8)
 */
export function TopBar({
  activeSessionId,
  activeSessionName,
  repoName,
  isConnected,
  onSessionCreated,
  onInterrupt,
  resourceWarning,
}: TopBarProps) {
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [updatingBmad, setUpdatingBmad] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { toast } = useToast()
  const { permissionState, permissionGranted, requestPermission } = useNotification()
  const { autoShiftPaused, pauseAutoShift, resumeAutoShift } = useLayout()

  // Reset banner dismissal when resource warning changes
  useEffect(() => {
    if (resourceWarning) {
      setBannerDismissed(false)
    }
  }, [resourceWarning])

  /**
   * Handle session creation from modal
   */
  const handleSessionCreated = (session: Session) => {
    onSessionCreated(session)
    setSessionModalOpen(false)
  }

  /**
   * Handle STOP button click
   * Sends interrupt (SIGINT) to active session via WebSocket
   */
  const handleStop = () => {
    if (!activeSessionId) {
      toast({
        type: 'error',
        title: 'No active session',
        description: 'There is no active session to interrupt.',
      })
      return
    }

    onInterrupt()
    toast({
      title: 'Interrupt sent',
      description: 'SIGINT signal sent to active session.',
    })
  }

  /**
   * Handle "Update BMAD" menu item click
   * Executes `npx bmad-method install` command via backend API
   */
  const handleUpdateBmad = async () => {
    try {
      setUpdatingBmad(true)

      // Show loading toast
      const loadingToast = toast({
        title: 'Updating BMAD Method...',
        description: 'Running npx bmad-method install',
      })

      // Send POST request to backend
      const response = await fetch('/api/bmad/update', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to update BMAD Method')
      }

      const data = await response.json()

      // Dismiss loading toast
      loadingToast.dismiss()

      // Show success toast
      toast({
        title: 'BMAD Method updated successfully',
        description: data.message || 'BMAD Method has been updated.',
      })
    } catch (error) {
      console.error('Failed to update BMAD:', error)
      toast({
        type: 'error',
        title: 'Failed to update BMAD Method',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setUpdatingBmad(false)
    }
  }

  /**
   * Handle "About" menu item click (placeholder for future implementation)
   */
  const handleAbout = () => {
    toast({
      title: 'Claude Container',
      description: 'Web interface for Claude CLI with Docker integration.',
    })
  }

  // Show warning banner if resource warning exists and not dismissed
  const showBanner = resourceWarning && !bannerDismissed && resourceWarning.memoryUsagePercent >= 87

  return (
    <>
      {/* Story 4.8: Resource Warning Banner */}
      {showBanner && (
        <div className="bg-[#EBCB8B] text-[#2E3440] px-4 py-2 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">
            {resourceWarning.isAcceptingNewSessions
              ? `High memory usage (${Math.round(resourceWarning.memoryUsagePercent)}%). Consider closing idle sessions.`
              : `Memory critical (${Math.round(resourceWarning.memoryUsagePercent)}%). Cannot create new sessions until memory is freed.`}
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="hover:bg-[#D08770]/20 p-1 rounded"
            aria-label="Dismiss resource warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bar - 44px height, #3B4252 background */}
      {/* Story 4.9: ARIA role="banner" for accessibility */}
      <header role="banner" className="flex h-11 items-center justify-between border-b border-border bg-card px-3">
        {/* Logo, Title, Repo Name, and Active Session (left-aligned) */}
        <div className="flex items-center gap-1.5">
          <Terminal className="h-4 w-4 text-primary" aria-hidden="true" />
          <h1 className="text-sm font-bold text-foreground">Claude Container</h1>
          {repoName && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs font-medium text-foreground-secondary" title={repoName}>
                {repoName}
              </span>
            </>
          )}
          {activeSessionName && (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs font-medium text-foreground-secondary truncate max-w-[200px]" title={activeSessionName}>
                {activeSessionName}
              </span>
            </>
          )}
        </div>

        {/* Action Buttons (right-aligned) */}
        <div className="flex items-center gap-1.5">
          {/* STOP Button - Destructive variant, #BF616A background */}
          <Button
            onClick={handleStop}
            disabled={!isConnected || !activeSessionId}
            variant="destructive"
            size="sm"
            className="font-semibold h-7 px-2 text-xs"
            aria-label="Interrupt active session (SIGINT)"
            data-testid="stop-btn"
          >
            STOP
          </Button>

          {/* Settings Dropdown Menu - Ghost variant, #81A1C1 color */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-7 w-7"
                aria-label="Settings menu"
                data-testid="settings-btn"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={handleUpdateBmad}
                disabled={updatingBmad}
                data-testid="update-bmad-menu-item"
              >
                {updatingBmad && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {updatingBmad ? 'Updating...' : 'Update BMAD'}
              </DropdownMenuItem>
              <DropdownMenuItem disabled data-testid="preferences-menu-item">
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Layout Settings Section */}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Layout
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  if (autoShiftPaused) {
                    resumeAutoShift()
                    toast({
                      title: 'Auto-resize enabled',
                      description: 'Content panels will automatically resize based on activity.',
                    })
                  } else {
                    pauseAutoShift()
                    toast({
                      title: 'Auto-resize paused',
                      description: 'Content panels will stay at their current size.',
                    })
                  }
                }}
                data-testid="auto-resize-toggle"
              >
                {autoShiftPaused ? (
                  <Pause className="mr-2 h-4 w-4 text-warning" />
                ) : (
                  <Check className="mr-2 h-4 w-4 text-success" />
                )}
                {autoShiftPaused ? 'Auto-resize Paused' : 'Auto-resize Enabled'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Story 3.11: Notification Settings - Single line */}
              {permissionGranted ? (
                <DropdownMenuItem disabled data-testid="notifications-enabled">
                  <BellRing className="mr-2 h-4 w-4 text-green-500" />
                  Notifications Enabled
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={async () => {
                    if (permissionState === 'denied') {
                      toast({
                        title: 'Enable in Browser Settings',
                        description: 'Click the lock icon in your browser address bar → Site settings → Notifications → Allow',
                      })
                    } else {
                      const result = await requestPermission()
                      toast({
                        title: result === 'granted' ? 'Notifications Enabled' : 'Notifications Blocked',
                        description: result === 'granted'
                          ? 'You will receive notifications when Claude needs input.'
                          : 'You can enable notifications in your browser settings.',
                      })
                    }
                  }}
                  data-testid="enable-notifications-btn"
                >
                  {permissionState === 'denied' ? (
                    <BellOff className="mr-2 h-4 w-4 text-red-500" />
                  ) : (
                    <Bell className="mr-2 h-4 w-4" />
                  )}
                  {permissionState === 'denied' ? 'Notifications Blocked' : 'Enable Browser Notifications'}
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleAbout} data-testid="about-menu-item">
                About
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Session Creation Modal */}
      <SessionModal
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        onSessionCreated={handleSessionCreated}
      />
    </>
  )
}
