import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert an ISO 8601 timestamp to relative time format
 * @param isoString - ISO 8601 timestamp string
 * @returns Relative time string (e.g., "5m ago", "2h ago")
 */
export function relativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime()

  // Handle future timestamps (edge case)
  if (ms < 0) return 'just now'

  // Less than 60 seconds
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`

  // Less than 60 minutes
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`

  // Less than 24 hours
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`

  // Days
  return `${Math.floor(ms / 86400000)}d ago`
}

// Story 6.7: Epic Navigation and Selection - localStorage helpers

const SELECTED_EPIC_KEY = 'claude-container-selected-epic'

/**
 * Load the selected epic number from localStorage
 * Story 6.7: Epic Navigation and Selection
 * @returns Selected epic number or null if not found/invalid
 */
export function loadSelectedEpic(): number | null {
  try {
    const stored = localStorage.getItem(SELECTED_EPIC_KEY)
    if (!stored) return null
    const parsed = parseInt(stored, 10)
    return isNaN(parsed) ? null : parsed
  } catch (error) {
    console.warn('[EpicSelector] Failed to load selected epic:', error)
    return null
  }
}

/**
 * Save the selected epic number to localStorage
 * Story 6.7: Epic Navigation and Selection
 * @param epicNumber - Epic number to save
 */
export function saveSelectedEpic(epicNumber: number): void {
  try {
    localStorage.setItem(SELECTED_EPIC_KEY, epicNumber.toString())
  } catch (error) {
    console.error('[EpicSelector] Failed to save selected epic:', error)
    // Graceful degradation: continue without persistence
  }
}
