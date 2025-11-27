/**
 * MainContentArea Component
 * Story 3.6: Context-Aware Layout Shifting (Terminal ↔ Artifacts)
 *
 * Features:
 * - Dynamic layout modes: terminal (100%), artifact (70/30), split (custom)
 * - Resizable panels with drag handle
 * - CSS transitions (350ms ease-out) for smooth layout changes
 * - Keyboard shortcuts: Cmd+T (terminal), Cmd+A (artifact)
 * - Auto-shift on file writes (paused by manual override)
 */

import { useEffect, useCallback, useRef } from 'react'
import { Terminal } from '@/components/Terminal'
import { ArtifactViewer } from '@/components/ArtifactViewer'
import { WorkflowDiagram } from '@/components/WorkflowDiagram'
import { useLayout } from '@/context/LayoutContext'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Monitor, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UseWebSocketReturn } from '@/hooks/useWebSocket'
import type { ImperativePanelHandle } from 'react-resizable-panels'

export interface MainContentAreaProps {
  /** Active session ID */
  sessionId: string
  /** WebSocket hook instance */
  ws: UseWebSocketReturn
  /** Optional additional CSS classes */
  className?: string
}

/**
 * MainContentArea component
 * Manages layout between Terminal and ArtifactViewer with context-aware shifting
 */
export function MainContentArea({ sessionId, ws, className }: MainContentAreaProps) {
  const {
    mainContentMode,
    splitRatio,
    setMainContentMode,
    setSplitRatio,
    pauseAutoShift,
    getSelectedFile,
    setSelectedFile,
    showWorkflowDiagram,
  } = useLayout()

  // Get the selected file for this session
  const selectedFile = getSelectedFile(sessionId)

  // Refs for panels to control programmatically
  const artifactPanelRef = useRef<ImperativePanelHandle>(null)
  const terminalPanelRef = useRef<ImperativePanelHandle>(null)

  // Story 3.6 AC #5: Keyboard shortcut for "Focus Terminal" (Cmd+T)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if target is an input field to avoid conflicts
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Cmd+T (macOS) or Ctrl+T (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 't') {
        event.preventDefault()
        setMainContentMode('terminal')
        pauseAutoShift()
      }

      // Cmd+Shift+A (macOS) or Ctrl+Shift+A (Windows/Linux) for artifact focus
      // Note: Using Shift modifier to avoid conflict with browser's "Select All" (Cmd+A)
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'a') {
        event.preventDefault()
        setMainContentMode('artifact')
        pauseAutoShift()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setMainContentMode, pauseAutoShift])

  // Update panel sizes when mode changes
  useEffect(() => {
    if (mainContentMode === 'terminal') {
      // Terminal-dominant: 100% terminal, 0% artifact
      terminalPanelRef.current?.resize(100)
      artifactPanelRef.current?.resize(0)
    } else if (mainContentMode === 'artifact') {
      // Artifact-dominant: 70% artifact, 30% terminal
      artifactPanelRef.current?.resize(70)
      terminalPanelRef.current?.resize(30)
    } else if (mainContentMode === 'split') {
      // Custom split based on splitRatio
      const artifactPercent = splitRatio * 100
      artifactPanelRef.current?.resize(artifactPercent)
      terminalPanelRef.current?.resize(100 - artifactPercent)
    }
  }, [mainContentMode, splitRatio])

  // Handle manual resize - switch to split mode and pause auto-shift
  const handleResize = useCallback(
    (sizes: number[]) => {
      const [artifactSize] = sizes
      const newRatio = artifactSize / 100

      // Only update if significantly different (avoid tiny changes)
      if (Math.abs(newRatio - splitRatio) > 0.01) {
        setSplitRatio(newRatio)
        setMainContentMode('split')
        pauseAutoShift()
      }
    },
    [splitRatio, setSplitRatio, setMainContentMode, pauseAutoShift]
  )

  // Manual override buttons
  const renderControlButtons = () => (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#4C566A] bg-[#3B4252]">
      <button
        onClick={() => {
          setMainContentMode('terminal')
          pauseAutoShift()
        }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors',
          mainContentMode === 'terminal'
            ? 'bg-[#88C0D0] text-[#2E3440] font-semibold'
            : 'bg-[#4C566A] text-[#D8DEE9] hover:bg-[#5E81AC]'
        )}
        title="Focus Terminal (Cmd+T)"
      >
        <Monitor className="w-4 h-4" />
        Terminal
      </button>
      <button
        onClick={() => {
          setMainContentMode('artifact')
          pauseAutoShift()
        }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors',
          mainContentMode === 'artifact'
            ? 'bg-[#88C0D0] text-[#2E3440] font-semibold'
            : 'bg-[#4C566A] text-[#D8DEE9] hover:bg-[#5E81AC]'
        )}
        title="Focus Artifacts (Cmd+Shift+A)"
      >
        <FileText className="w-4 h-4" />
        Artifacts
      </button>
    </div>
  )

  return (
    <main role="main" className={cn('flex flex-col h-full', className)}>
      {/* Control buttons */}
      {renderControlButtons()}

      {/* Resizable layout */}
      <ResizablePanelGroup
        direction="vertical"
        onLayout={handleResize}
        className="flex-1"
      >
        {/* Artifact Panel (Top) - Shows WorkflowDiagram or ArtifactViewer */}
        <ResizablePanel
          ref={artifactPanelRef}
          defaultSize={mainContentMode === 'artifact' ? 70 : 0}
          minSize={0}
          maxSize={70}
          className="transition-all duration-[350ms] ease-out"
        >
          {mainContentMode !== 'terminal' && (
            showWorkflowDiagram ? (
              <WorkflowDiagram />
            ) : (
              <ArtifactViewer
                filePath={selectedFile}
                onClose={() => setSelectedFile(sessionId, undefined)}
                ws={ws}
                sessionId={sessionId}
                className="h-full"
              />
            )
          )}
        </ResizablePanel>

        {/* Resize Handle */}
        {mainContentMode !== 'terminal' && (
          <ResizableHandle withHandle className="bg-[#4C566A] hover:bg-[#5E81AC]" />
        )}

        {/* Terminal Panel (Bottom) */}
        <ResizablePanel
          ref={terminalPanelRef}
          defaultSize={mainContentMode === 'terminal' ? 100 : 30}
          minSize={30}
          maxSize={100}
          className="transition-all duration-[350ms] ease-out"
        >
          <Terminal sessionId={sessionId} ws={ws} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
