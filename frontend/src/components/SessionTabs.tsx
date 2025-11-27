/**
 * SessionTabs Component
 * Story 2.5: Tabbed Interface for Session Switching
 *
 * Features:
 * - Tab-based session switching with Oceanic Calm theme styling
 * - Keyboard shortcuts (Cmd/Ctrl+1-4) for quick navigation
 * - Close button (X) on hover with destroy confirmation
 * - Horizontal scroll for overflow tabs
 * - "+ New Session" tab always visible
 * - <50ms tab switching performance
 */

import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'
import { AttentionBadge } from '@/components/AttentionBadge'

export interface SessionTabsProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onDestroySession: (sessionId: string) => void
  onOpenCreateModal: () => void
  maxSessions?: number
}

// Constants
const STUCK_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Check if a session is stuck (no activity for >30 minutes)
 */
function isSessionStuck(session: Session): boolean {
  const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime()
  return timeSinceActivity > STUCK_THRESHOLD_MS
}

/**
 * SessionTabs Component
 *
 * Displays tabs for each active session with quick switching,
 * keyboard shortcuts, and session management controls.
 */
export function SessionTabs({
  sessions,
  activeSessionId,
  onSelectSession,
  onDestroySession,
  onOpenCreateModal,
  maxSessions = 4,
}: SessionTabsProps) {
  const tabsListRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  // Force re-render every 5 seconds to update relative time display
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Keyboard shortcuts: Cmd/Ctrl+1-4 for session switching
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check for Cmd (macOS) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      const num = parseInt(e.key)

      if (isCmdOrCtrl && num >= 1 && num <= 4) {
        e.preventDefault() // Prevent browser tab switching
        const session = sessions[num - 1]
        if (session) {
          onSelectSession(session.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [sessions, onSelectSession])

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && tabsListRef.current) {
      // Check if scrollIntoView is available (not in all test environments)
      if (typeof activeTabRef.current.scrollIntoView === 'function') {
        activeTabRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    }
  }, [activeSessionId])

  /**
   * Handle tab switching with performance measurement
   */
  const handleTabClick = (sessionId: string) => {
    const startTime = performance.now()
    onSelectSession(sessionId)
    requestAnimationFrame(() => {
      const endTime = performance.now()
      const latency = endTime - startTime
      if (latency > 50) {
        console.warn(`Tab switch latency: ${latency.toFixed(2)}ms (exceeds 50ms requirement)`)
      } else {
        console.log(`Tab switch latency: ${latency.toFixed(2)}ms`)
      }
    })
  }

  /**
   * Handle close button click with event propagation stop
   */
  const handleCloseClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation() // Prevent tab switching
    onDestroySession(sessionId)
  }

  /**
   * Handle "+ New Session" tab click
   */
  const handleNewSessionClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event from bubbling to Tabs component
    onOpenCreateModal()
  }

  const canCreateNewSession = sessions.length < maxSessions

  return (
    <div className="relative w-full flex">
      <Tabs value={activeSessionId || undefined} onValueChange={handleTabClick} className="flex-1">
        {/* Scrollable tab list with overflow handling */}
        <div className="relative">
          {/* Gradient scroll indicators */}
          <div className="absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-background-secondary to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-background-secondary to-transparent pointer-events-none" />

          <TabsList
            ref={tabsListRef}
            className={cn(
              "inline-flex h-12 items-center justify-start gap-0 rounded-none bg-background-secondary p-0",
              "overflow-x-auto overflow-y-hidden",
              "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            )}
          >
            {/* Session Tabs */}
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId
              const isStuck = isSessionStuck(session)
              return (
                <TabsTrigger
                  key={session.id}
                  value={session.id}
                  ref={isActive ? activeTabRef : null}
                  className={cn(
                    // Base styles
                    "group relative inline-flex items-center justify-between gap-2 rounded-none px-4 h-12",
                    "min-w-[120px] max-w-[200px]",
                    "text-sm font-medium transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                    "data-[state=active]:shadow-none",
                    // Inactive tab styles
                    "bg-background-secondary text-foreground-secondary hover:bg-muted",
                    // Active tab styles
                    "data-[state=active]:bg-background data-[state=active]:text-foreground",
                    "data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  )}
                  onClick={() => handleTabClick(session.id)}
                >
                  {/* Story 4.2: Attention Badge for error/stuck/waiting */}
                  <AttentionBadge
                    status={session.status}
                    lastActivity={session.lastActivity}
                    isStuck={isStuck}
                  />

                  {/* Session name with ellipsis truncation */}
                  <span className="truncate flex-1 text-left">
                    {session.name}
                  </span>

                  {/* Close button (X) - shown on hover */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleCloseClick(e, session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleCloseClick(e as any, session.id)
                      }
                    }}
                    className={cn(
                      "flex items-center justify-center",
                      "w-4 h-4 rounded-sm",
                      "text-foreground-secondary hover:text-error",
                      "opacity-0 group-hover:opacity-100",
                      "transition-opacity duration-200",
                      "focus:outline-none focus:ring-1 focus:ring-error",
                      "cursor-pointer"
                    )}
                    aria-label={`Close ${session.name}`}
                  >
                    <X className="w-4 h-4" />
                  </div>
                </TabsTrigger>
              )
            })}

          </TabsList>
        </div>
      </Tabs>

      {/* "+ New Session" Button - COMPLETELY OUTSIDE Tabs component to prevent any event interference */}
      <button
        type="button"
        disabled={!canCreateNewSession}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-none px-4 h-12",
          "min-w-[140px]",
          "text-sm font-medium transition-all",
          "bg-background-secondary text-foreground-secondary hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        onClick={handleNewSessionClick}
      >
        + New Session
      </button>
    </div>
  )
}
