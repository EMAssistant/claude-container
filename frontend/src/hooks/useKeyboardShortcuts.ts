/**
 * useKeyboardShortcuts Hook
 * Story 4.9: Keyboard Shortcuts and Accessibility Enhancements
 *
 * Centralized keyboard shortcut management with:
 * - Platform-aware modifiers (Cmd on macOS, Ctrl on Windows/Linux)
 * - Session switching (Cmd/Ctrl+1-4)
 * - New session modal (Cmd/Ctrl+N)
 * - Layout changes (Cmd/Ctrl+T/A/W)
 * - Modal close (ESC)
 * - Terminal focus exclusion (shortcuts disabled when terminal has focus, except ESC)
 */

import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  key: string
  modifiers: ('meta' | 'ctrl' | 'alt' | 'shift')[]
  action: string
  description: string
  enabled: boolean
}

export interface UseKeyboardShortcutsOptions {
  /**
   * Switch to session by index (0-3)
   */
  onSwitchSession?: (index: number) => void

  /**
   * Open new session modal
   */
  onNewSession?: () => void

  /**
   * Set main content mode to 'terminal' (100% terminal view)
   */
  onFocusTerminal?: () => void

  /**
   * Set main content mode to 'split' (70/30 artifact/terminal)
   */
  onFocusArtifacts?: () => void

  /**
   * Toggle left sidebar view between 'files' and 'workflow'
   */
  onToggleSidebarView?: () => void

  /**
   * Close active modal (if any)
   */
  onCloseModal?: () => void
}

/**
 * Detect if running on macOS (use Cmd) or Windows/Linux (use Ctrl)
 */
function isMacPlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  // Check navigator.platform for macOS variants
  const platform = navigator.platform.toUpperCase()
  return platform.indexOf('MAC') >= 0
}

/**
 * Check if terminal currently has focus
 * Terminal component should have a wrapper with class 'terminal-wrapper'
 */
function isTerminalFocused(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const activeElement = document.activeElement
  if (!activeElement) {
    return false
  }

  // Check if active element is within terminal wrapper
  return activeElement.closest('.terminal-wrapper') !== null
}

/**
 * Global keyboard shortcut hook
 *
 * Registers keyboard shortcuts and manages event listeners.
 * Shortcuts are disabled when terminal has focus (except ESC).
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const {
    onSwitchSession,
    onNewSession,
    onFocusTerminal,
    onFocusArtifacts,
    onToggleSidebarView,
    onCloseModal,
  } = options

  // Platform detection (run once)
  const isMac = isMacPlatform()
  const modifierKey = isMac ? 'meta' : 'ctrl'

  // Build shortcut registry
  const shortcuts: KeyboardShortcut[] = [
    { key: '1', modifiers: [modifierKey], action: 'switchSession1', description: 'Switch to session 1', enabled: true },
    { key: '2', modifiers: [modifierKey], action: 'switchSession2', description: 'Switch to session 2', enabled: true },
    { key: '3', modifiers: [modifierKey], action: 'switchSession3', description: 'Switch to session 3', enabled: true },
    { key: '4', modifiers: [modifierKey], action: 'switchSession4', description: 'Switch to session 4', enabled: true },
    { key: 'n', modifiers: [modifierKey], action: 'newSession', description: 'Create new session', enabled: true },
    { key: 't', modifiers: [modifierKey], action: 'focusTerminal', description: 'Focus terminal (100% view)', enabled: true },
    { key: 'a', modifiers: [modifierKey], action: 'focusArtifacts', description: 'Focus artifacts (70/30 split)', enabled: true },
    { key: 'w', modifiers: [modifierKey], action: 'toggleSidebarView', description: 'Toggle Files/Workflow sidebar', enabled: true },
    { key: 'Escape', modifiers: [], action: 'closeModal', description: 'Close modal', enabled: true },
  ]

  // Handle shortcut actions
  const handleAction = useCallback((action: string) => {
    switch (action) {
      case 'switchSession1':
        onSwitchSession?.(0)
        break
      case 'switchSession2':
        onSwitchSession?.(1)
        break
      case 'switchSession3':
        onSwitchSession?.(2)
        break
      case 'switchSession4':
        onSwitchSession?.(3)
        break
      case 'newSession':
        onNewSession?.()
        break
      case 'focusTerminal':
        onFocusTerminal?.()
        break
      case 'focusArtifacts':
        onFocusArtifacts?.()
        break
      case 'toggleSidebarView':
        onToggleSidebarView?.()
        break
      case 'closeModal':
        onCloseModal?.()
        break
      default:
        console.warn('Unknown keyboard shortcut action:', action)
    }
  }, [onSwitchSession, onNewSession, onFocusTerminal, onFocusArtifacts, onToggleSidebarView, onCloseModal])

  // Check if keyboard event matches a shortcut
  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    // Key must match (case-insensitive)
    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
    if (!keyMatch) {
      return false
    }

    // Modifiers must match exactly
    const hasRequiredModifiers = shortcut.modifiers.every(modifier => {
      switch (modifier) {
        case 'meta':
          return event.metaKey
        case 'ctrl':
          return event.ctrlKey
        case 'alt':
          return event.altKey
        case 'shift':
          return event.shiftKey
        default:
          return false
      }
    })

    // No extra modifiers should be pressed (except shift for uppercase)
    const noExtraModifiers =
      (!event.metaKey || shortcut.modifiers.includes('meta')) &&
      (!event.ctrlKey || shortcut.modifiers.includes('ctrl')) &&
      (!event.altKey || shortcut.modifiers.includes('alt')) &&
      (!event.shiftKey || shortcut.modifiers.includes('shift'))

    return hasRequiredModifiers && noExtraModifiers
  }, [])

  // Global keydown handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if terminal has focus
      const terminalFocused = isTerminalFocused()

      // If terminal has focus, only allow ESC (for modal close)
      // All other shortcuts are disabled to let terminal handle input
      if (terminalFocused && event.key !== 'Escape') {
        return
      }

      // Check if any input field has focus (additional safety)
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow ESC to close modals even in input fields
        if (event.key !== 'Escape') {
          return
        }
      }

      // Match against shortcuts
      for (const shortcut of shortcuts) {
        if (!shortcut.enabled) {
          continue
        }

        if (matchesShortcut(event, shortcut)) {
          // Prevent default browser behavior (e.g., Cmd+N new window)
          event.preventDefault()

          // Execute action
          handleAction(shortcut.action)

          // Stop after first match
          break
        }
      }
    }

    // Register global listener
    window.addEventListener('keydown', handleKeyDown)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleAction, matchesShortcut])

  // Return shortcuts for documentation/help UI
  return {
    shortcuts,
    isMac,
  }
}
