/**
 * WorkflowProgress Component
 * Story 3.2: Workflow Progress Component (Compact Linear View)
 * Story 6.6: Collapsible Phase Overview
 *
 * Features:
 * - Overview mode with collapsible phases and sprint tracker (PhaseOverview) - default view
 * - Swim Lane diagram toggle (opens in main content area)
 * - Tooltips on view toggle buttons (100ms delay)
 */

import { cn } from '@/lib/utils'
import { PhaseOverview } from '@/components/PhaseOverview'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Columns } from 'lucide-react'
import { useLayout } from '@/context/LayoutContext'

/**
 * WorkflowProgress Component
 * Shows PhaseOverview (phases + embedded SprintTracker) with Swim Lane toggle
 */
export function WorkflowProgress() {
  const { setShowWorkflowDiagram, setMainContentMode, showWorkflowDiagram } = useLayout()

  return (
    <div className="h-full flex flex-col">
      {/* Header with Swim Lane toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary">
        <span className="text-xs font-medium text-foreground-secondary uppercase tracking-wider">
          Overview
        </span>
        <TooltipProvider delayDuration={100}>
          <div className="flex gap-1">
            {/* Swim Lane button - shows full workflow diagram in main content area */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setShowWorkflowDiagram(true)
                    setMainContentMode('artifact')
                  }}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    showWorkflowDiagram
                      ? 'bg-[#88C0D0] text-[#2E3440]'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="Show Swim Lane Diagram"
                  aria-pressed={showWorkflowDiagram}
                >
                  <Columns className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Swim Lane Diagram</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Content area - always shows PhaseOverview */}
      <div className="flex-1 overflow-hidden">
        <PhaseOverview />
      </div>
    </div>
  )
}
