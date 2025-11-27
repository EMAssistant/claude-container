import { useMemo, memo, useState, useEffect } from 'react'
import type { Session } from '@/types'
import { cn, relativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { GitBranch, GitBranchPlus, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AttentionBadge, calculatePriority, type AttentionPriority } from '@/components/AttentionBadge'

export interface SessionListProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (id: string) => void
  onDestroySession: (id: string) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onNewSession?: () => void
}

// Constants
const STUCK_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Check if a session is stuck (active but no activity for >30 minutes)
 */
function isSessionStuck(session: Session): boolean {
  const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime()
  return timeSinceActivity > STUCK_THRESHOLD_MS && session.status === 'active'
}

interface SessionListItemProps {
  session: Session
  isActive: boolean
  onSelect: (id: string) => void
  onDestroy: (id: string) => void
}

function SessionListItem({ session, isActive, onSelect, onDestroy }: SessionListItemProps) {
  const isStuck = useMemo(() => isSessionStuck(session), [session])
  const isWaiting = session.status === 'waiting'

  const handleDestroy = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent session selection
    onDestroy(session.id)
  }
  const branchType = session.branchType || 'new' // Default to 'new' for backward compatibility

  // Truncate session name at 20 characters
  const truncatedName = session.name.length > 20
    ? session.name.slice(0, 20) + '...'
    : session.name

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onSelect(session.id)}
            className={cn(
              'group w-full px-3 py-2.5 text-left transition-colors duration-200',
              'hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
              'border-b border-border/50',
              isActive && 'bg-secondary'
            )}
            aria-label={`Switch to session ${session.name}, status ${session.status}`}
          >
            <div className="flex items-start gap-2.5 relative">
              {/* Close button - shown on hover */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleDestroy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleDestroy(e as unknown as React.MouseEvent)
                  }
                }}
                className={cn(
                  "absolute -top-0.5 -right-1 flex items-center justify-center",
                  "w-4 h-4 rounded-sm",
                  "text-foreground-secondary hover:text-error",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-200",
                  "focus:outline-none focus:ring-1 focus:ring-error",
                  "cursor-pointer z-10"
                )}
                aria-label={`Close ${session.name}`}
              >
                <X className="w-3 h-3" />
              </div>
              {/* Unified Status Badge */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <AttentionBadge
                  status={session.status}
                  lastActivity={session.lastActivity}
                  isStuck={isStuck}
                />
              </div>

              {/* Session Info */}
              <div className="flex-1 min-w-0">
                {/* Name and Badges */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium text-foreground truncate">
                    {truncatedName}
                  </span>

                  {/* Branch Type Badge */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-4 px-1 flex items-center gap-0.5 border-0 text-xs font-medium',
                          branchType === 'new' ? 'bg-[#88C0D0] text-[#2E3440]' : 'bg-[#A3BE8C] text-[#2E3440]'
                        )}
                        aria-label={`Branch type: ${branchType}`}
                      >
                        {branchType === 'new' ? (
                          <GitBranchPlus className="h-2.5 w-2.5" />
                        ) : (
                          <GitBranch className="h-2.5 w-2.5" />
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{branchType === 'new' ? 'This session created a new branch' : 'This session uses an existing branch'}</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Waiting Badge */}
                  {isWaiting && (
                    <Badge
                      variant="outline"
                      className="h-4 w-4 p-0 flex items-center justify-center bg-[#EBCB8B] text-[#2E3440] border-0 text-xs font-bold"
                      aria-label="Waiting for input"
                    >
                      !
                    </Badge>
                  )}

                  {/* Stuck Warning Badge */}
                  {isStuck && (
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 bg-[#EBCB8B] text-[#2E3440] border-0 text-xs font-semibold"
                      aria-label="Session may be stuck"
                    >
                      Stuck?
                    </Badge>
                  )}
                </div>

                {/* Branch Name and Last Activity */}
                <p className="text-xs text-muted-foreground truncate" title={session.branch}>
                  {session.branch}
                </p>
                <p className="text-xs text-muted-foreground">
                  {relativeTime(session.lastActivity)}
                </p>
              </div>
            </div>
          </button>
        </TooltipTrigger>
        {session.name.length > 20 && (
          <TooltipContent side="left">
            <p>{session.name}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Priority ordering for session sorting
 * error > stuck > waiting > active > idle
 */
const PRIORITY_ORDER: Record<AttentionPriority, number> = {
  error: 0,
  stuck: 1,
  waiting: 2,
  active: 3,
  idle: 4,
}

/**
 * SessionList component displays all active sessions in a sidebar
 * with real-time status indicators, last activity timestamps, and
 * visual warnings for stuck or waiting sessions.
 *
 * Story 4.2: Sessions are sorted by attention priority (error > stuck > waiting > active > idle)
 * with secondary sort by most recent activity.
 */
/**
 * Story 4.10 AC#7: SessionList component wrapped with React.memo
 * Prevents re-renders when props haven't changed for performance optimization
 */
const SessionListComponent = ({ sessions, activeSessionId, onSessionSelect, onDestroySession, isCollapsed = false, onToggleCollapse, onNewSession }: SessionListProps) => {
  // Force re-render every 5 seconds to update relative time display
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Story 4.2: Sort sessions by priority, then by lastActivity (most recent first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      // Calculate priority for each session
      const priorityA = calculatePriority(a.status, isSessionStuck(a))
      const priorityB = calculatePriority(b.status, isSessionStuck(b))

      // Primary sort: by priority
      const priorityDiff = PRIORITY_ORDER[priorityA] - PRIORITY_ORDER[priorityB]
      if (priorityDiff !== 0) {
        return priorityDiff
      }

      // Secondary sort: by lastActivity descending (most recent first)
      const timeA = new Date(a.lastActivity).getTime()
      const timeB = new Date(b.lastActivity).getTime()
      return timeB - timeA
    })
  }, [sessions])

  // Collapsed view: show only status badges vertically
  if (isCollapsed) {
    return (
      <aside
        className="w-full h-full border-l border-border bg-background-secondary flex flex-col items-center"
        aria-label="Session List (Collapsed)"
      >
        {/* Expand button at top */}
        {onToggleCollapse && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="p-2 hover:bg-secondary/50 transition-colors w-full flex justify-center"
                  aria-label="Expand session list"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground-secondary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Expand sessions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Session badges in collapsed mode */}
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center gap-1 py-2">
            {sortedSessions.map((session) => (
              <TooltipProvider key={session.id} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSessionSelect(session.id)}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        session.id === activeSessionId ? "bg-secondary" : "hover:bg-secondary/50"
                      )}
                      aria-label={`Switch to session ${session.name}`}
                    >
                      <AttentionBadge
                        status={session.status}
                        lastActivity={session.lastActivity}
                        isStuck={isSessionStuck(session)}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="font-medium">{session.name}</p>
                    <p className="text-xs text-muted-foreground">{session.branch}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </ScrollArea>
      </aside>
    )
  }

  // Expanded view: full session list
  return (
    <aside
      className="w-full h-full border-l border-border bg-background-secondary"
      aria-label="Session List"
    >
      {/* Compact header with New Session button and collapse */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/50">
        <div className="flex items-center gap-1">
          {onNewSession && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onNewSession}
                    className="p-1 hover:bg-primary/20 rounded transition-colors"
                    aria-label="New session"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>New Session</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className="text-[10px] font-medium text-foreground-secondary uppercase tracking-wide">Sessions</span>
        </div>
        {onToggleCollapse && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="p-1 hover:bg-secondary/50 rounded transition-colors"
                  aria-label="Collapse session list"
                >
                  <ChevronRight className="w-3 h-3 text-foreground-secondary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Collapse sessions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <ScrollArea className="h-[calc(100%-26px)]">
        <div className="py-2">
          {sortedSessions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No active sessions</p>
            </div>
          ) : (
            sortedSessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={onSessionSelect}
                onDestroy={onDestroySession}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

/**
 * Story 4.10 AC#7: Export memoized SessionList component
 * Shallow comparison is sufficient for sessions array and primitive props
 */
export const SessionList = memo(SessionListComponent)
