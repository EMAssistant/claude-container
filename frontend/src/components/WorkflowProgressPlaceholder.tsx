/**
 * WorkflowProgressPlaceholder Component
 * Temporary placeholder for Story 3.2: BMAD Workflow Progress
 *
 * This component will be replaced by the full WorkflowProgress implementation.
 */

import { GitBranch } from 'lucide-react'

export function WorkflowProgressPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <GitBranch className="w-8 h-8 text-[#88C0D0] mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-2">Workflow Progress</h3>
      <p className="text-xs text-foreground-secondary max-w-xs">
        BMAD workflow visualization will be implemented in Story 3.2. This view will show your current position in the BMAD development process.
      </p>

      {/* Preview of what workflow steps might look like */}
      <div className="mt-6 space-y-2 text-xs text-foreground-secondary">
        <div className="flex items-center gap-2">
          <span className="text-[#A3BE8C]">✓</span>
          <span>Brainstorming</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#88C0D0]">→</span>
          <span>PRD Creation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">○</span>
          <span className="text-muted">Architecture</span>
        </div>
      </div>
    </div>
  )
}
