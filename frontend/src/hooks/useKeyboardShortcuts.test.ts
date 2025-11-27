/**
 * useKeyboardShortcuts Hook Tests
 * Story 4.9: Keyboard Shortcuts and Accessibility Enhancements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  let mockCallbacks: {
    onSwitchSession: ReturnType<typeof vi.fn>
    onNewSession: ReturnType<typeof vi.fn>
    onFocusTerminal: ReturnType<typeof vi.fn>
    onFocusArtifacts: ReturnType<typeof vi.fn>
    onToggleSidebarView: ReturnType<typeof vi.fn>
    onCloseModal: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockCallbacks = {
      onSwitchSession: vi.fn(),
      onNewSession: vi.fn(),
      onFocusTerminal: vi.fn(),
      onFocusArtifacts: vi.fn(),
      onToggleSidebarView: vi.fn(),
      onCloseModal: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper to trigger keyboard event
  const triggerKeyboard = (key: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}, target?: EventTarget) => {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: modifiers.metaKey || false,
      ctrlKey: modifiers.ctrlKey || false,
      altKey: modifiers.altKey || false,
      shiftKey: modifiers.shiftKey || false,
      bubbles: true,
    })

    // Dispatch on target if provided, otherwise on window
    if (target) {
      target.dispatchEvent(event)
    } else {
      window.dispatchEvent(event)
    }
    return event
  }

  describe('Platform Detection', () => {
    it('should detect macOS platform', () => {
      // Mock navigator.platform
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      const { result } = renderHook(() => useKeyboardShortcuts(mockCallbacks))
      expect(result.current.isMac).toBe(true)
    })

    it('should detect non-macOS platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      })

      const { result } = renderHook(() => useKeyboardShortcuts(mockCallbacks))
      expect(result.current.isMac).toBe(false)
    })
  })

  describe('Session Switching (Cmd/Ctrl+1-4)', () => {
    it('should switch to session 1 with Cmd+1 on macOS', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('1', { metaKey: true })

      expect(mockCallbacks.onSwitchSession).toHaveBeenCalledWith(0)
    })

    it('should switch to session 2 with Ctrl+2 on Windows', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('2', { ctrlKey: true })

      expect(mockCallbacks.onSwitchSession).toHaveBeenCalledWith(1)
    })

    it('should switch to session 3 with Cmd+3', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('3', { metaKey: true })

      expect(mockCallbacks.onSwitchSession).toHaveBeenCalledWith(2)
    })

    it('should switch to session 4 with Cmd+4', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('4', { metaKey: true })

      expect(mockCallbacks.onSwitchSession).toHaveBeenCalledWith(3)
    })
  })

  describe('New Session (Cmd/Ctrl+N)', () => {
    it('should open new session modal with Cmd+N', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('n', { metaKey: true })

      expect(mockCallbacks.onNewSession).toHaveBeenCalled()
    })

    it('should open new session modal with Ctrl+N', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('n', { ctrlKey: true })

      expect(mockCallbacks.onNewSession).toHaveBeenCalled()
    })
  })

  describe('Layout Changes (Cmd/Ctrl+T/A/W)', () => {
    it('should focus terminal with Cmd+T', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('t', { metaKey: true })

      expect(mockCallbacks.onFocusTerminal).toHaveBeenCalled()
    })

    it('should focus artifacts with Cmd+A', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('a', { metaKey: true })

      expect(mockCallbacks.onFocusArtifacts).toHaveBeenCalled()
    })

    it('should toggle sidebar view with Cmd+W', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('w', { metaKey: true })

      expect(mockCallbacks.onToggleSidebarView).toHaveBeenCalled()
    })
  })

  describe('Modal Close (ESC)', () => {
    it('should close modal with ESC key', () => {
      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('Escape')

      expect(mockCallbacks.onCloseModal).toHaveBeenCalled()
    })

    it('should close modal with ESC even when terminal has focus', () => {
      // Create a mock terminal element with class 'terminal-wrapper'
      const terminalWrapper = document.createElement('div')
      terminalWrapper.className = 'terminal-wrapper'
      const terminalInput = document.createElement('input')
      terminalWrapper.appendChild(terminalInput)
      document.body.appendChild(terminalWrapper)

      // Focus the terminal input
      terminalInput.focus()

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('Escape')

      expect(mockCallbacks.onCloseModal).toHaveBeenCalled()

      // Cleanup
      document.body.removeChild(terminalWrapper)
    })
  })

  describe('Terminal Focus Exclusion', () => {
    it('should NOT trigger shortcuts when terminal has focus (except ESC)', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      // Create a mock terminal element
      const terminalWrapper = document.createElement('div')
      terminalWrapper.className = 'terminal-wrapper'
      const terminalInput = document.createElement('input')
      terminalWrapper.appendChild(terminalInput)
      document.body.appendChild(terminalWrapper)

      // Focus the terminal
      terminalInput.focus()

      renderHook(() => useKeyboardShortcuts(mockCallbacks))

      // Try Cmd+N (should not trigger)
      triggerKeyboard('n', { metaKey: true })
      expect(mockCallbacks.onNewSession).not.toHaveBeenCalled()

      // Try Cmd+T (should not trigger)
      triggerKeyboard('t', { metaKey: true })
      expect(mockCallbacks.onFocusTerminal).not.toHaveBeenCalled()

      // Cleanup
      document.body.removeChild(terminalWrapper)
    })

    it('should trigger shortcuts when terminal does NOT have focus', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      // Focus on body (not terminal)
      document.body.focus()

      renderHook(() => useKeyboardShortcuts(mockCallbacks))
      triggerKeyboard('n', { metaKey: true })

      expect(mockCallbacks.onNewSession).toHaveBeenCalled()
    })
  })

  describe('Input Field Exclusion', () => {
    it('should NOT trigger shortcuts when input field has focus (except ESC)', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      // Create an input element
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      renderHook(() => useKeyboardShortcuts(mockCallbacks))

      // Try Cmd+N (should not trigger because input has focus)
      // Dispatch event from the input element itself
      const event = new KeyboardEvent('keydown', {
        key: 'n',
        metaKey: true,
        bubbles: true,
      })
      Object.defineProperty(event, 'target', { value: input, enumerable: true })
      input.dispatchEvent(event)

      expect(mockCallbacks.onNewSession).not.toHaveBeenCalled()

      // Try ESC (should trigger even from input)
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      })
      Object.defineProperty(escEvent, 'target', { value: input, enumerable: true })
      input.dispatchEvent(escEvent)

      expect(mockCallbacks.onCloseModal).toHaveBeenCalled()

      // Cleanup
      document.body.removeChild(input)
    })

    it('should NOT trigger shortcuts when textarea has focus (except ESC)', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      // Create a textarea element
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      renderHook(() => useKeyboardShortcuts(mockCallbacks))

      // Try Cmd+T (should not trigger because textarea has focus)
      const event = new KeyboardEvent('keydown', {
        key: 't',
        metaKey: true,
        bubbles: true,
      })
      Object.defineProperty(event, 'target', { value: textarea, enumerable: true })
      textarea.dispatchEvent(event)

      expect(mockCallbacks.onFocusTerminal).not.toHaveBeenCalled()

      // Cleanup
      document.body.removeChild(textarea)
    })
  })

  describe('Shortcut Registry', () => {
    it('should return shortcuts array with correct structure', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      const { result } = renderHook(() => useKeyboardShortcuts(mockCallbacks))

      expect(result.current.shortcuts).toBeDefined()
      expect(result.current.shortcuts.length).toBeGreaterThan(0)

      // Check first shortcut structure
      const firstShortcut = result.current.shortcuts[0]
      expect(firstShortcut).toHaveProperty('key')
      expect(firstShortcut).toHaveProperty('modifiers')
      expect(firstShortcut).toHaveProperty('action')
      expect(firstShortcut).toHaveProperty('description')
      expect(firstShortcut).toHaveProperty('enabled')
    })

    it('should use meta modifier on macOS', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      })

      const { result } = renderHook(() => useKeyboardShortcuts(mockCallbacks))

      // Check that shortcuts use 'meta' modifier
      const sessionShortcut = result.current.shortcuts.find(s => s.action === 'switchSession1')
      expect(sessionShortcut?.modifiers).toContain('meta')
    })

    it('should use ctrl modifier on Windows', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      })

      const { result } = renderHook(() => useKeyboardShortcuts(mockCallbacks))

      // Check that shortcuts use 'ctrl' modifier
      const sessionShortcut = result.current.shortcuts.find(s => s.action === 'switchSession1')
      expect(sessionShortcut?.modifiers).toContain('ctrl')
    })
  })

  describe('Event Cleanup', () => {
    it('should remove event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useKeyboardShortcuts(mockCallbacks))

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })
})
