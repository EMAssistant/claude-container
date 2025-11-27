/**
 * LayoutContext Tests
 * Story 3.3: Left Sidebar with Files/Workflow Toggle
 * Story 5.3: Git Panel UI Component
 *
 * Tests cover:
 * - Initial state defaults
 * - View toggling (files ↔ workflow ↔ git)
 * - Width constraints (200-400px)
 * - Collapse/expand functionality
 * - localStorage persistence
 * - Error handling for corrupted localStorage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { LayoutProvider, useLayout, DEFAULT_LEFT_SIDEBAR_WIDTH, MIN_LEFT_SIDEBAR_WIDTH, MAX_LEFT_SIDEBAR_WIDTH, COLLAPSED_WIDTH } from './LayoutContext'
import { ReactNode } from 'react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('LayoutContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('AC3: Default State', () => {
    it('initializes with files view by default', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      expect(result.current.leftSidebarView).toBe('files')
    })

    it('initializes with default 280px width', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      expect(result.current.leftSidebarWidth).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH)
    })

    it('initializes with expanded state (not collapsed)', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      expect(result.current.isLeftCollapsed).toBe(false)
    })
  })

  describe('AC4: View Toggling', () => {
    it('allows setting view to workflow', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setLeftSidebarView('workflow')
      })

      expect(result.current.leftSidebarView).toBe('workflow')
    })

    it('toggles between files, workflow, and git views', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      // Start with files
      expect(result.current.leftSidebarView).toBe('files')

      // Toggle to workflow
      act(() => {
        result.current.toggleLeftSidebarView()
      })
      expect(result.current.leftSidebarView).toBe('workflow')

      // Toggle to git
      act(() => {
        result.current.toggleLeftSidebarView()
      })
      expect(result.current.leftSidebarView).toBe('git')

      // Toggle back to files
      act(() => {
        result.current.toggleLeftSidebarView()
      })
      expect(result.current.leftSidebarView).toBe('files')
    })
  })

  describe('AC1: Width Constraints', () => {
    it('allows setting width within valid range (200-400px)', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setLeftSidebarWidth(300)
      })

      expect(result.current.leftSidebarWidth).toBe(300)
    })

    it('constrains width to minimum 200px', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setLeftSidebarWidth(150)
      })

      expect(result.current.leftSidebarWidth).toBe(MIN_LEFT_SIDEBAR_WIDTH)
    })

    it('constrains width to maximum 400px', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setLeftSidebarWidth(500)
      })

      expect(result.current.leftSidebarWidth).toBe(MAX_LEFT_SIDEBAR_WIDTH)
    })
  })

  describe('AC9, AC10: Collapse/Expand Functionality', () => {
    it('allows setting collapsed state', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setIsLeftCollapsed(true)
      })

      expect(result.current.isLeftCollapsed).toBe(true)
    })

    it('toggles collapsed state', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      // Start expanded
      expect(result.current.isLeftCollapsed).toBe(false)

      // Collapse
      act(() => {
        result.current.toggleLeftSidebarCollapse()
      })
      expect(result.current.isLeftCollapsed).toBe(true)

      // Expand
      act(() => {
        result.current.toggleLeftSidebarCollapse()
      })
      expect(result.current.isLeftCollapsed).toBe(false)
    })
  })

  describe('AC8: localStorage Persistence', () => {
    it('saves view preference to localStorage', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setLeftSidebarView('workflow')
      })

      expect(localStorageMock.getItem('leftSidebarView')).toBe('workflow')
    })

    it('loads saved view preference from localStorage', () => {
      localStorageMock.setItem('leftSidebarView', 'workflow')

      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      expect(result.current.leftSidebarView).toBe('workflow')
    })

    it('saves sidebar width to localStorage', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setLeftSidebarWidth(350)
      })

      expect(localStorageMock.getItem('leftSidebarWidth')).toBe('350')
    })

    it('loads saved width from localStorage', () => {
      localStorageMock.setItem('leftSidebarWidth', '350')

      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      expect(result.current.leftSidebarWidth).toBe(350)
    })

    it('saves collapsed state to localStorage', () => {
      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      act(() => {
        result.current.setIsLeftCollapsed(true)
      })

      expect(localStorageMock.getItem('isLeftCollapsed')).toBe('true')
    })

    it('loads saved collapsed state from localStorage', () => {
      localStorageMock.setItem('isLeftCollapsed', 'true')

      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      expect(result.current.isLeftCollapsed).toBe(true)
    })

    it('handles corrupted/missing localStorage gracefully', () => {
      localStorageMock.setItem('leftSidebarView', 'invalid-view')
      localStorageMock.setItem('leftSidebarWidth', 'not-a-number')

      const { result } = renderHook(() => useLayout(), {
        wrapper: LayoutProvider,
      })

      // Should default to files view
      expect(result.current.leftSidebarView).toBe('files')
      // Should default to 280px width (NaN becomes 280)
      expect(result.current.leftSidebarWidth).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH)
    })
  })

  describe('Error Handling', () => {
    it('throws error when useLayout is used outside LayoutProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        renderHook(() => useLayout())
      }).toThrow('useLayout must be used within a LayoutProvider')

      console.error = originalError
    })
  })

  describe('Integration', () => {
    it('provides layout state to child components', () => {
      function TestComponent() {
        const { leftSidebarView } = useLayout()
        return <div data-testid="view">{leftSidebarView}</div>
      }

      render(
        <LayoutProvider>
          <TestComponent />
        </LayoutProvider>
      )

      expect(screen.getByTestId('view')).toHaveTextContent('files')
    })

    it('allows child components to update layout state', () => {
      function TestComponent() {
        const { leftSidebarView, setLeftSidebarView } = useLayout()
        return (
          <div>
            <div data-testid="view">{leftSidebarView}</div>
            <button onClick={() => setLeftSidebarView('workflow')}>Switch to Workflow</button>
          </div>
        )
      }

      render(
        <LayoutProvider>
          <TestComponent />
        </LayoutProvider>
      )

      expect(screen.getByTestId('view')).toHaveTextContent('files')

      fireEvent.click(screen.getByText('Switch to Workflow'))

      expect(screen.getByTestId('view')).toHaveTextContent('workflow')
    })
  })
})
