/**
 * AccessibilityAnnouncer Component
 * Story 4.9: Keyboard Shortcuts and Accessibility Enhancements
 *
 * Provides ARIA live regions for screen reader announcements:
 * - Polite announcements: Status changes, workflow progress
 * - Assertive announcements: Critical errors, session crashes
 *
 * Component is visually hidden but accessible to screen readers.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

type AnnouncementPriority = 'polite' | 'assertive'

interface AccessibilityContextValue {
  /**
   * Announce a message to screen readers
   *
   * @param message - Text to announce
   * @param priority - 'polite' (default) or 'assertive' (urgent)
   */
  announce: (message: string, priority?: AnnouncementPriority) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined)

/**
 * Hook to access accessibility announcements
 */
export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityAnnouncer')
  }
  return context
}

interface AccessibilityAnnouncerProps {
  children: ReactNode
}

/**
 * AccessibilityAnnouncer Component
 *
 * Renders two ARIA live regions:
 * - aria-live="polite": Non-urgent announcements (wait for screen reader to finish)
 * - aria-live="assertive": Urgent announcements (interrupt screen reader)
 *
 * Messages are cleared after 1 second (screen reader has already read them).
 * This prevents stale messages from being re-announced on page updates.
 */
export function AccessibilityAnnouncer({ children }: AccessibilityAnnouncerProps) {
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')

  // Clear timers to prevent memory leaks
  const [politeTimer, setPoliteTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [assertiveTimer, setAssertiveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Announce a message
  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    if (!message) {
      return
    }

    if (priority === 'assertive') {
      // Clear existing timer
      if (assertiveTimer) {
        clearTimeout(assertiveTimer)
      }

      // Set assertive message
      setAssertiveMessage(message)

      // Clear after 1 second (screen reader has read it)
      const timer = setTimeout(() => {
        setAssertiveMessage('')
        setAssertiveTimer(null)
      }, 1000)

      setAssertiveTimer(timer)
    } else {
      // Clear existing timer
      if (politeTimer) {
        clearTimeout(politeTimer)
      }

      // Set polite message
      setPoliteMessage(message)

      // Clear after 1 second (screen reader has read it)
      const timer = setTimeout(() => {
        setPoliteMessage('')
        setPoliteTimer(null)
      }, 1000)

      setPoliteTimer(timer)
    }
  }, [politeTimer, assertiveTimer])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (politeTimer) {
        clearTimeout(politeTimer)
      }
      if (assertiveTimer) {
        clearTimeout(assertiveTimer)
      }
    }
  }, [politeTimer, assertiveTimer])

  const value: AccessibilityContextValue = {
    announce,
  }

  return (
    <AccessibilityContext.Provider value={value}>
      {/* Polite live region - waits for screen reader to finish */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      {/* Assertive live region - interrupts screen reader */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>

      {children}
    </AccessibilityContext.Provider>
  )
}
