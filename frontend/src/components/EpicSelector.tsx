/**
 * EpicSelector Component
 * Story 6.7: Epic Navigation and Selection
 *
 * Features:
 * - Dropdown selector for switching between epics
 * - Shows all epics with completion status (✓ completed, ◉ in-progress, · backlog)
 * - Displays epic progress (completed/total stories)
 * - Persists selected epic to localStorage
 * - Epic artifacts displayed under header when epic is selected
 */

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EpicData } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface EpicSelectorProps {
  /** All epics from SprintStatus */
  epics: EpicData[]
  /** Currently selected epic number */
  selectedEpicNumber: number
  /** Callback when epic is selected */
  onEpicSelect: (epicNumber: number) => void
}

/**
 * Get status icon for an epic based on completion
 * ✓ = All stories completed (completedCount === storyCount)
 * ◉ = Some stories completed (in-progress epic)
 * · = No stories completed (backlog epic)
 */
function getEpicStatusIcon(epic: EpicData): string {
  if (epic.completedCount === epic.storyCount && epic.storyCount > 0) {
    return '✓'
  }
  if (epic.completedCount > 0) {
    return '◉'
  }
  return '·'
}

/**
 * Get status color for an epic
 */
function getEpicStatusColor(epic: EpicData): string {
  if (epic.completedCount === epic.storyCount && epic.storyCount > 0) {
    return 'text-green-600 dark:text-green-500'
  }
  if (epic.completedCount > 0) {
    return 'text-yellow-600 dark:text-yellow-500'
  }
  return 'text-gray-500 dark:text-gray-600'
}

/**
 * EpicSelector - Dropdown for navigating between epics
 */
export function EpicSelector({ epics, selectedEpicNumber, onEpicSelect }: EpicSelectorProps) {
  // Sort epics by epicNumber in ascending order
  const sortedEpics = [...epics].sort((a, b) => a.epicNumber - b.epicNumber)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-[#434C5E] text-[#88C0D0] rounded hover:bg-[#4C566A] transition-colors">
        <span>Epic {selectedEpicNumber}</span>
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[320px] bg-[#3B4252] border-[#4C566A]">
        {sortedEpics.map((epic) => {
          const statusIcon = getEpicStatusIcon(epic)
          const statusColor = getEpicStatusColor(epic)
          const isSelected = epic.epicNumber === selectedEpicNumber

          return (
            <DropdownMenuItem
              key={epic.epicNumber}
              onClick={() => onEpicSelect(epic.epicNumber)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 cursor-pointer',
                'hover:bg-[#434C5E] focus:bg-[#434C5E]',
                isSelected && 'font-bold bg-[#434C5E] dark:bg-[#4C566A]'
              )}
            >
              {/* Status icon */}
              <span className={cn('text-base', statusColor)}>{statusIcon}</span>

              {/* Epic title */}
              <span className="flex-1 text-sm text-foreground">
                Epic {epic.epicNumber}
                {epic.title && `: ${epic.title}`}
              </span>

              {/* Progress */}
              <span className="text-xs text-foreground-secondary">
                {epic.completedCount}/{epic.storyCount}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
