/**
 * LeftSidebar Component
 * Story 3.3: Left Sidebar with Files/Workflow Toggle
 * Story 5.3: Git Panel UI Component
 *
 * Features:
 * - Tabbed interface switching between Files, Workflow, and Git views
 * - Default 280px width, resizable 200-400px
 * - Keyboard shortcut: Cmd+W / Ctrl+W to toggle views
 * - Collapsible to 40px bar with vertical text
 * - State persisted to localStorage via LayoutContext
 * - <50ms tab switching performance
 */

import { useEffect, useCallback, lazy, Suspense } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight, FolderTree, GitBranch, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLayout, COLLAPSED_WIDTH, type LeftSidebarView } from '@/context/LayoutContext'
import { FileTree } from '@/components/FileTree'
import { GitPanel } from '@/components/GitPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * Story 4.10 AC#8: Lazy load WorkflowProgress for code splitting
 * WorkflowProgress is only needed when the Workflow tab is active
 */
const WorkflowProgress = lazy(() => import('@/components/WorkflowProgress').then(module => ({ default: module.WorkflowProgress })))

export interface LeftSidebarProps {
  activeSessionId: string | null
  ws: ReturnType<typeof useWebSocket>
}

/**
 * LeftSidebar Component
 */
export function LeftSidebar({ activeSessionId, ws }: LeftSidebarProps) {
  const {
    leftSidebarView,
    isLeftCollapsed,
    setLeftSidebarView,
    toggleLeftSidebarView,
    toggleLeftSidebarCollapse,
    setSelectedFile,
  } = useLayout()

  // Wrap setSelectedFile to include the active session ID
  const handleFileSelect = useCallback((filePath: string | undefined) => {
    setSelectedFile(activeSessionId, filePath)
  }, [activeSessionId, setSelectedFile])

  // Keyboard shortcut: Cmd+W / Ctrl+W to toggle views
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check for Cmd (macOS) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey

      if (isCmdOrCtrl && e.key === 'w') {
        // Only trigger if focus is not in input/textarea/contenteditable
        const activeElement = document.activeElement
        const isInputFocused =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute('contenteditable') === 'true'

        if (!isInputFocused) {
          e.preventDefault() // Prevent browser close tab behavior
          toggleLeftSidebarView()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [toggleLeftSidebarView])

  // Handle tab switching with performance measurement (dev-only logging)
  const handleTabChange = useCallback(
    (value: string) => {
      const startTime = performance.now()
      setLeftSidebarView(value as 'files' | 'workflow' | 'git')

      // Performance logging only in development
      if (import.meta.env.DEV) {
        requestAnimationFrame(() => {
          const endTime = performance.now()
          const latency = endTime - startTime
          if (latency > 50) {
            console.warn(`Left sidebar tab switch latency: ${latency.toFixed(2)}ms (exceeds 50ms requirement)`)
          }
        })
      }
    },
    [setLeftSidebarView]
  )

  // Handle collapsed tab click: set view and expand in one action
  const handleCollapsedTabClick = useCallback((view: LeftSidebarView) => {
    setLeftSidebarView(view)
    toggleLeftSidebarCollapse()
  }, [setLeftSidebarView, toggleLeftSidebarCollapse])

  // Collapsed state: show all tabs as icons with expand button
  if (isLeftCollapsed) {
    return (
      <div
        className={cn(
          'h-full bg-background-secondary border-r border-border',
          'flex flex-col items-center justify-start',
          'transition-all duration-300 ease-out'
        )}
        style={{ width: `${COLLAPSED_WIDTH}px` }}
      >
        {/* Expand button */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleLeftSidebarCollapse}
                className={cn(
                  'w-full h-10 flex items-center justify-center',
                  'hover:bg-muted transition-colors',
                  'text-foreground-secondary hover:text-foreground',
                  'border-b border-border'
                )}
                aria-label="Expand left sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Expand sidebar</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Tab icons - click to expand and switch in one action */}
        <div className="flex flex-col items-center gap-1 py-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleCollapsedTabClick('files')}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded',
                    'transition-colors',
                    leftSidebarView === 'files'
                      ? 'bg-[#434C5E] text-[#88C0D0]'
                      : 'text-[#81A1C1] hover:text-[#5E81AC] hover:bg-muted'
                  )}
                  aria-label="Open Files"
                >
                  <FolderTree className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Files</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleCollapsedTabClick('workflow')}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded',
                    'transition-colors',
                    leftSidebarView === 'workflow'
                      ? 'bg-[#434C5E] text-[#88C0D0]'
                      : 'text-[#81A1C1] hover:text-[#5E81AC] hover:bg-muted'
                  )}
                  aria-label="Open Workflow"
                >
                  <ListTree className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Workflow</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleCollapsedTabClick('git')}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded',
                    'transition-colors',
                    leftSidebarView === 'git'
                      ? 'bg-[#434C5E] text-[#88C0D0]'
                      : 'text-[#81A1C1] hover:text-[#5E81AC] hover:bg-muted'
                  )}
                  aria-label="Open Git"
                >
                  <GitBranch className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Git</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    )
  }

  // Expanded state: show full sidebar with tabs
  return (
    <aside
      role="complementary"
      aria-label="Navigation sidebar"
      className={cn(
        'h-full w-full bg-background-secondary border-r border-border',
        'flex flex-col',
        'transition-all duration-300 ease-out'
      )}
    >
    <Tabs
      value={leftSidebarView}
      onValueChange={handleTabChange}
      className="h-full flex flex-col"
    >
      {/* Header with tabs and collapse button */}
      <div className="flex items-center justify-between border-b border-border">
        <TabsList
          className={cn(
            'h-9 rounded-none bg-transparent p-0',
            'flex items-center justify-start gap-0'
          )}
        >
          <TabsTrigger
            value="files"
            className={cn(
              'rounded-none px-3 h-9 text-xs font-medium',
              'transition-colors duration-200',
              // Inactive state
              'text-[#81A1C1] hover:text-[#5E81AC]',
              // Active state
              'data-[state=active]:text-[#88C0D0] data-[state=active]:bg-[#434C5E]',
              'data-[state=active]:border-b-2 data-[state=active]:border-[#88C0D0]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0'
            )}
          >
            Files
          </TabsTrigger>
          <TabsTrigger
            value="workflow"
            className={cn(
              'rounded-none px-3 h-9 text-xs font-medium',
              'transition-colors duration-200',
              // Inactive state
              'text-[#81A1C1] hover:text-[#5E81AC]',
              // Active state
              'data-[state=active]:text-[#88C0D0] data-[state=active]:bg-[#434C5E]',
              'data-[state=active]:border-b-2 data-[state=active]:border-[#88C0D0]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0'
            )}
          >
            Workflow
          </TabsTrigger>
          <TabsTrigger
            value="git"
            className={cn(
              'rounded-none px-3 h-9 text-xs font-medium',
              'transition-colors duration-200',
              // Inactive state
              'text-[#81A1C1] hover:text-[#5E81AC]',
              // Active state
              'data-[state=active]:text-[#88C0D0] data-[state=active]:bg-[#434C5E]',
              'data-[state=active]:border-b-2 data-[state=active]:border-[#88C0D0]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0'
            )}
          >
            Git
          </TabsTrigger>
        </TabsList>

        {/* Collapse button */}
        <button
          onClick={toggleLeftSidebarCollapse}
          className={cn(
            'h-9 px-2 flex items-center justify-center',
            'hover:bg-muted transition-colors',
            'text-foreground-secondary hover:text-foreground',
            'border-l border-border'
          )}
          aria-label="Collapse left sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      </div>

      {/* Screen reader announcement for view changes */}
      <div role="status" aria-live="polite" className="sr-only">
        {leftSidebarView === 'files' ? 'Files' : leftSidebarView === 'workflow' ? 'Workflow' : 'Git'} view active
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <TabsContent value="files" className="h-full m-0 p-0">
          <FileTree onFileSelect={handleFileSelect} />
        </TabsContent>
        <TabsContent value="workflow" className="h-full m-0 p-0">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-[#D8DEE9] text-sm">Loading workflow...</div>
            </div>
          }>
            <WorkflowProgress />
          </Suspense>
        </TabsContent>
        <TabsContent value="git" className="h-full m-0 p-0">
          {activeSessionId && ws ? (
            <GitPanel sessionId={activeSessionId} ws={ws} />
          ) : (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-sm text-[#81A1C1] text-center">
                No session selected. Create or select a session to view git status.
              </div>
            </div>
          )}
        </TabsContent>
      </div>
    </Tabs>
    </aside>
  )
}
