/**
 * LayoutContext - Global Layout State Management
 * Story 3.3: Left Sidebar with Files/Workflow Toggle
 * Story 3.6: Context-Aware Layout Shifting (Terminal ↔ Artifacts)
 * Story 5.3: Git Panel UI Component
 *
 * Manages:
 * - Left sidebar view ('files' | 'workflow' | 'git')
 * - Left sidebar width (200-400px, default 280px)
 * - Left sidebar collapse state
 * - Main content layout mode ('terminal' | 'artifact' | 'split')
 * - Split ratio for terminal/artifact panels (0.3-0.7)
 * - Auto-shift pause state for manual overrides
 *
 * State persisted to localStorage for session continuity.
 */

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

// Constants - Left Sidebar
const DEFAULT_LEFT_SIDEBAR_WIDTH = 280
const MIN_LEFT_SIDEBAR_WIDTH = 200
const MAX_LEFT_SIDEBAR_WIDTH = 400
const COLLAPSED_WIDTH = 40

// Constants - Right Sidebar (Session List)
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 220
const MIN_RIGHT_SIDEBAR_WIDTH = 200
const MAX_RIGHT_SIDEBAR_WIDTH = 350

// Story 3.6: Layout mode constants
const DEFAULT_SPLIT_RATIO = 0.7 // 70% artifact, 30% terminal
const MIN_SPLIT_RATIO = 0.3 // Minimum 30% for each panel
const MAX_SPLIT_RATIO = 0.7 // Maximum 70% for each panel

// localStorage keys
const STORAGE_KEYS = {
  leftSidebarView: 'leftSidebarView',
  leftSidebarWidth: 'leftSidebarWidth',
  isLeftCollapsed: 'isLeftCollapsed',
  rightSidebarWidth: 'rightSidebarWidth',
  isRightCollapsed: 'isRightCollapsed',
  mainContentMode: 'mainContentMode',
  splitRatio: 'splitRatio',
  autoShiftPaused: 'autoShiftPaused',
}

// Types
export type LeftSidebarView = 'files' | 'workflow' | 'git'
export type MainContentMode = 'terminal' | 'artifact' | 'split'

export interface LayoutState {
  // Left sidebar state
  leftSidebarView: LeftSidebarView
  leftSidebarWidth: number
  isLeftCollapsed: boolean
  setLeftSidebarView: (view: LeftSidebarView) => void
  toggleLeftSidebarView: () => void
  setLeftSidebarWidth: (width: number) => void
  setIsLeftCollapsed: (collapsed: boolean) => void
  toggleLeftSidebarCollapse: () => void

  // Right sidebar state (Session List)
  rightSidebarWidth: number
  isRightCollapsed: boolean
  setRightSidebarWidth: (width: number) => void
  setIsRightCollapsed: (collapsed: boolean) => void
  toggleRightSidebarCollapse: () => void

  // Story 3.6: Main content layout state
  mainContentMode: MainContentMode
  splitRatio: number
  autoShiftPaused: boolean
  setMainContentMode: (mode: MainContentMode) => void
  setSplitRatio: (ratio: number) => void
  pauseAutoShift: () => void
  resumeAutoShift: () => void

  // Story 3.4/3.5: Selected file for ArtifactViewer (per-session)
  selectedFiles: Record<string, string | undefined>
  getSelectedFile: (sessionId: string | null) => string | undefined
  setSelectedFile: (sessionId: string | null, filePath: string | undefined) => void

  // Workflow diagram view state
  showWorkflowDiagram: boolean
  setShowWorkflowDiagram: (show: boolean) => void
}

// Context
const LayoutContext = createContext<LayoutState | undefined>(undefined)

/**
 * Load state from localStorage with fallback to defaults
 */
function loadPersistedState(): {
  view: LeftSidebarView
  width: number
  collapsed: boolean
  rightWidth: number
  rightCollapsed: boolean
  mode: MainContentMode
  ratio: number
  paused: boolean
} {
  try {
    const savedView = localStorage.getItem(STORAGE_KEYS.leftSidebarView)
    const savedWidth = localStorage.getItem(STORAGE_KEYS.leftSidebarWidth)
    const savedCollapsed = localStorage.getItem(STORAGE_KEYS.isLeftCollapsed)
    const savedRightWidth = localStorage.getItem(STORAGE_KEYS.rightSidebarWidth)
    const savedRightCollapsed = localStorage.getItem(STORAGE_KEYS.isRightCollapsed)
    const savedMode = localStorage.getItem(STORAGE_KEYS.mainContentMode)
    const savedRatio = localStorage.getItem(STORAGE_KEYS.splitRatio)
    const savedPaused = localStorage.getItem(STORAGE_KEYS.autoShiftPaused)

    // Parse left width with fallback to default if NaN
    const parsedWidth = savedWidth ? parseInt(savedWidth, 10) : DEFAULT_LEFT_SIDEBAR_WIDTH
    const width = isNaN(parsedWidth) ? DEFAULT_LEFT_SIDEBAR_WIDTH : parsedWidth

    // Parse right width with fallback to default if NaN
    const parsedRightWidth = savedRightWidth ? parseInt(savedRightWidth, 10) : DEFAULT_RIGHT_SIDEBAR_WIDTH
    const rightWidth = isNaN(parsedRightWidth) ? DEFAULT_RIGHT_SIDEBAR_WIDTH : parsedRightWidth

    // Parse split ratio with fallback to default if NaN
    const parsedRatio = savedRatio ? parseFloat(savedRatio) : DEFAULT_SPLIT_RATIO
    const ratio = isNaN(parsedRatio) ? DEFAULT_SPLIT_RATIO : parsedRatio

    return {
      view: (savedView === 'workflow' || savedView === 'git' ? savedView : 'files') as LeftSidebarView,
      width: width,
      collapsed: savedCollapsed === 'true',
      rightWidth: rightWidth,
      rightCollapsed: savedRightCollapsed === 'true',
      mode: (savedMode === 'artifact' || savedMode === 'split' ? savedMode : 'terminal') as MainContentMode,
      ratio: ratio,
      paused: savedPaused === 'true',
    }
  } catch (error) {
    console.warn('Failed to load layout state from localStorage:', error)
    return {
      view: 'files',
      width: DEFAULT_LEFT_SIDEBAR_WIDTH,
      collapsed: false,
      rightWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
      rightCollapsed: false,
      mode: 'terminal',
      ratio: DEFAULT_SPLIT_RATIO,
      paused: false,
    }
  }
}

/**
 * Validate and constrain left sidebar width
 */
function constrainLeftWidth(width: number): number {
  return Math.max(MIN_LEFT_SIDEBAR_WIDTH, Math.min(MAX_LEFT_SIDEBAR_WIDTH, width))
}

/**
 * Validate and constrain right sidebar width
 */
function constrainRightWidth(width: number): number {
  return Math.max(MIN_RIGHT_SIDEBAR_WIDTH, Math.min(MAX_RIGHT_SIDEBAR_WIDTH, width))
}

/**
 * Validate and constrain split ratio (0.3-0.7)
 */
function constrainSplitRatio(ratio: number): number {
  return Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio))
}

export interface LayoutProviderProps {
  children: ReactNode
}

/**
 * LayoutProvider - Provides layout state to entire app
 */
export function LayoutProvider({ children }: LayoutProviderProps) {
  // Initialize state from localStorage
  const [leftSidebarView, setLeftSidebarViewState] = useState<LeftSidebarView>(() => {
    return loadPersistedState().view
  })

  const [leftSidebarWidth, setLeftSidebarWidthState] = useState<number>(() => {
    return loadPersistedState().width
  })

  const [isLeftCollapsed, setIsLeftCollapsedState] = useState<boolean>(() => {
    return loadPersistedState().collapsed
  })

  // Right sidebar state (Session List)
  const [rightSidebarWidth, setRightSidebarWidthState] = useState<number>(() => {
    return loadPersistedState().rightWidth
  })

  const [isRightCollapsed, setIsRightCollapsedState] = useState<boolean>(() => {
    return loadPersistedState().rightCollapsed
  })

  // Story 3.6: Main content layout state
  const [mainContentMode, setMainContentModeState] = useState<MainContentMode>(() => {
    return loadPersistedState().mode
  })

  const [splitRatio, setSplitRatioState] = useState<number>(() => {
    return loadPersistedState().ratio
  })

  const [autoShiftPaused, setAutoShiftPausedState] = useState<boolean>(() => {
    return loadPersistedState().paused
  })

  // Story 3.4/3.5: Selected file for ArtifactViewer (per-session)
  const [selectedFiles, setSelectedFilesState] = useState<Record<string, string | undefined>>({})

  // Workflow diagram view state
  const [showWorkflowDiagram, setShowWorkflowDiagramState] = useState(false)

  // Getter for selected file by session
  const getSelectedFile = useCallback((sessionId: string | null): string | undefined => {
    if (!sessionId) return undefined
    return selectedFiles[sessionId]
  }, [selectedFiles])

  // Setter that clears workflow diagram when selecting a file (per-session)
  const setSelectedFile = useCallback((sessionId: string | null, filePath: string | undefined) => {
    if (!sessionId) return
    setSelectedFilesState(prev => ({
      ...prev,
      [sessionId]: filePath
    }))
    if (filePath) {
      setShowWorkflowDiagramState(false) // Close workflow diagram when opening a file
    }
  }, [])

  // Setter for workflow diagram (no longer clears selected files since they're per-session)
  const setShowWorkflowDiagram = useCallback((show: boolean) => {
    setShowWorkflowDiagramState(show)
  }, [])

  // Persist view to localStorage
  const setLeftSidebarView = useCallback((view: LeftSidebarView) => {
    setLeftSidebarViewState(view)
    try {
      localStorage.setItem(STORAGE_KEYS.leftSidebarView, view)
    } catch (error) {
      console.warn('Failed to save leftSidebarView to localStorage:', error)
    }
  }, [])

  // Toggle between files, workflow, and git views (cycles through all three)
  const toggleLeftSidebarView = useCallback(() => {
    if (leftSidebarView === 'files') {
      setLeftSidebarView('workflow')
    } else if (leftSidebarView === 'workflow') {
      setLeftSidebarView('git')
    } else {
      setLeftSidebarView('files')
    }
  }, [leftSidebarView, setLeftSidebarView])

  // Persist width to localStorage
  const setLeftSidebarWidth = useCallback((width: number) => {
    const constrainedWidth = constrainLeftWidth(width)
    setLeftSidebarWidthState(constrainedWidth)
    try {
      localStorage.setItem(STORAGE_KEYS.leftSidebarWidth, constrainedWidth.toString())
    } catch (error) {
      console.warn('Failed to save leftSidebarWidth to localStorage:', error)
    }
  }, [])

  // Persist collapse state to localStorage
  const setIsLeftCollapsed = useCallback((collapsed: boolean) => {
    setIsLeftCollapsedState(collapsed)
    try {
      localStorage.setItem(STORAGE_KEYS.isLeftCollapsed, collapsed.toString())
    } catch (error) {
      console.warn('Failed to save isLeftCollapsed to localStorage:', error)
    }
  }, [])

  // Toggle collapse state
  const toggleLeftSidebarCollapse = useCallback(() => {
    setIsLeftCollapsed(!isLeftCollapsed)
  }, [isLeftCollapsed, setIsLeftCollapsed])

  // Right sidebar: Persist width to localStorage
  const setRightSidebarWidth = useCallback((width: number) => {
    const constrainedWidth = constrainRightWidth(width)
    setRightSidebarWidthState(constrainedWidth)
    try {
      localStorage.setItem(STORAGE_KEYS.rightSidebarWidth, constrainedWidth.toString())
    } catch (error) {
      console.warn('Failed to save rightSidebarWidth to localStorage:', error)
    }
  }, [])

  // Right sidebar: Persist collapse state to localStorage
  const setIsRightCollapsed = useCallback((collapsed: boolean) => {
    setIsRightCollapsedState(collapsed)
    try {
      localStorage.setItem(STORAGE_KEYS.isRightCollapsed, collapsed.toString())
    } catch (error) {
      console.warn('Failed to save isRightCollapsed to localStorage:', error)
    }
  }, [])

  // Right sidebar: Toggle collapse state
  const toggleRightSidebarCollapse = useCallback(() => {
    setIsRightCollapsed(!isRightCollapsed)
  }, [isRightCollapsed, setIsRightCollapsed])

  // Story 3.6: Main content mode setter with persistence
  const setMainContentMode = useCallback((mode: MainContentMode) => {
    setMainContentModeState(mode)
    try {
      localStorage.setItem(STORAGE_KEYS.mainContentMode, mode)
    } catch (error) {
      console.warn('Failed to save mainContentMode to localStorage:', error)
    }
  }, [])

  // Story 3.6: Split ratio setter with validation and persistence
  const setSplitRatio = useCallback((ratio: number) => {
    const constrainedRatio = constrainSplitRatio(ratio)
    setSplitRatioState(constrainedRatio)
    try {
      localStorage.setItem(STORAGE_KEYS.splitRatio, constrainedRatio.toString())
    } catch (error) {
      console.warn('Failed to save splitRatio to localStorage:', error)
    }
  }, [])

  // Story 3.6: Pause auto-shift (for manual overrides)
  const pauseAutoShift = useCallback(() => {
    setAutoShiftPausedState(true)
    try {
      localStorage.setItem(STORAGE_KEYS.autoShiftPaused, 'true')
    } catch (error) {
      console.warn('Failed to save autoShiftPaused to localStorage:', error)
    }
  }, [])

  // Story 3.6: Resume auto-shift (on next file write)
  const resumeAutoShift = useCallback(() => {
    setAutoShiftPausedState(false)
    try {
      localStorage.setItem(STORAGE_KEYS.autoShiftPaused, 'false')
    } catch (error) {
      console.warn('Failed to save autoShiftPaused to localStorage:', error)
    }
  }, [])

  const value: LayoutState = {
    leftSidebarView,
    leftSidebarWidth,
    isLeftCollapsed,
    setLeftSidebarView,
    toggleLeftSidebarView,
    setLeftSidebarWidth,
    setIsLeftCollapsed,
    toggleLeftSidebarCollapse,
    // Right sidebar (Session List)
    rightSidebarWidth,
    isRightCollapsed,
    setRightSidebarWidth,
    setIsRightCollapsed,
    toggleRightSidebarCollapse,
    // Story 3.6: Main content layout
    mainContentMode,
    splitRatio,
    autoShiftPaused,
    setMainContentMode,
    setSplitRatio,
    pauseAutoShift,
    resumeAutoShift,
    // Story 3.4/3.5: Selected file (per-session)
    selectedFiles,
    getSelectedFile,
    setSelectedFile,
    // Workflow diagram
    showWorkflowDiagram,
    setShowWorkflowDiagram,
  }

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

/**
 * Hook to access layout context
 * @throws Error if used outside LayoutProvider
 */
export function useLayout(): LayoutState {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

// Export constants for use in components
export {
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  MIN_LEFT_SIDEBAR_WIDTH,
  MAX_LEFT_SIDEBAR_WIDTH,
  COLLAPSED_WIDTH,
  DEFAULT_RIGHT_SIDEBAR_WIDTH,
  MIN_RIGHT_SIDEBAR_WIDTH,
  MAX_RIGHT_SIDEBAR_WIDTH,
  DEFAULT_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
}
