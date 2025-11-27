/**
 * AttentionBadge Component
 * Story 4.2: Session Attention Badges and Prioritization
 *
 * Displays visual priority badges for sessions that need attention:
 * - Error (red #BF616A): Session crashed
 * - Stuck (yellow #EBCB8B): No output for 30+ minutes
 * - Waiting (blue #88C0D0): Waiting for user input
 *
 * Features:
 * - Priority ordering: error > stuck > waiting > active/idle
 * - Tooltip with detailed status and relative time
 * - Oceanic Calm theme colors
 * - WCAG AA contrast compliance
 * - Real-time updates via WebSocket
 */

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { relativeTime } from '@/lib/utils'

export interface AttentionBadgeProps {
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped' | string
  lastActivity: string  // ISO 8601 timestamp
  isStuck: boolean      // 30+ minutes no output
}

export type AttentionPriority = 'error' | 'stuck' | 'waiting' | 'active' | 'idle'

// Oceanic Calm color palette for all status states
const BADGE_COLORS = {
  error: '#BF616A',    // Red (Nord11)
  stuck: '#EBCB8B',    // Yellow (Nord13)
  waiting: '#88C0D0',  // Blue (Nord8)
  active: '#A3BE8C',   // Green (Nord14)
  idle: '#88C0D0',     // Blue (Nord8)
} as const

/**
 * Calculate attention priority based on session status
 * Priority order: error > stuck > waiting > active/idle
 */
export function calculatePriority(status: string, isStuck: boolean): AttentionPriority {
  if (status === 'error') return 'error'
  if (isStuck) return 'stuck'
  if (status === 'waiting') return 'waiting'
  if (status === 'active') return 'active'
  return 'idle'
}

/**
 * Get tooltip content for session status
 */
function getTooltipContent(priority: AttentionPriority, lastActivity: string): string {
  const relTime = relativeTime(lastActivity)

  switch (priority) {
    case 'error':
      return `Session crashed - ${relTime}`
    case 'stuck':
      return `No output for 30+ minutes - last activity ${relTime}`
    case 'waiting':
      return `Waiting for input - ${relTime}`
    case 'active':
      return `Active - ${relTime}`
    case 'idle':
      return `Idle - ${relTime}`
  }
}

/**
 * StatusBadge Component (formerly AttentionBadge)
 *
 * Unified status indicator for all session states.
 * Shows colored dot with tooltip for all states.
 * Pulses for active sessions.
 */
export function AttentionBadge({ status, lastActivity, isStuck }: AttentionBadgeProps) {
  const priority = useMemo(
    () => calculatePriority(status, isStuck),
    [status, isStuck]
  )

  const tooltipText = useMemo(
    () => getTooltipContent(priority, lastActivity),
    [priority, lastActivity]
  )

  const badgeColor = BADGE_COLORS[priority]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
            style={{ backgroundColor: badgeColor }}
            aria-label={tooltipText}
            data-testid={`status-badge-${priority}`}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
