/**
 * Standalone test page for WorkflowDiagram component
 *
 * Run with: npm run dev
 * Then visit: http://localhost:5173/test-workflow.html
 */

import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import { WorkflowProvider, useWorkflow } from '@/context/WorkflowContext'
import { LayoutProvider, useLayout } from '@/context/LayoutContext'
import { WorkflowDiagram } from '@/components/WorkflowDiagram'
import type { WorkflowState } from '@/types'
import '@/styles/globals.css'

// Mock workflow state with sample data showing implementation phase progress
const mockWorkflowState: WorkflowState = {
  steps: [
    { name: 'brainstorm-project', status: 'completed' },
    { name: 'research', status: 'completed' },
    { name: 'product-brief', status: 'completed' },
    { name: 'prd', status: 'completed' },
    { name: 'validate-prd', status: 'skipped' },
    { name: 'has-ui-decision', status: 'completed' },
    { name: 'create-design', status: 'completed' },
    { name: 'create-architecture', status: 'completed' },
    { name: 'validate-architecture', status: 'skipped' },
    { name: 'create-epics-and-stories', status: 'completed' },
    { name: 'test-design', status: 'completed' },
    { name: 'implementation-readiness', status: 'completed' },
    { name: 'sprint-planning', status: 'completed' },
    { name: 'create-story', status: 'completed' },
    { name: 'validate-story', status: 'skipped' },
    { name: 'develop-story', status: 'in_progress' },
    { name: 'code-review', status: 'pending' },
    { name: 'code-review-pass', status: 'pending' },
    { name: 'more-stories', status: 'pending' },
    { name: 'retrospective', status: 'pending' },
    { name: 'more-epics', status: 'pending' },
    { name: 'end', status: 'pending' },
  ],
  completedSteps: [
    'brainstorm-project', 'research', 'product-brief', 'prd',
    'has-ui-decision', 'create-design', 'create-architecture',
    'create-epics-and-stories', 'test-design', 'implementation-readiness',
    'sprint-planning', 'create-story'
  ],
  currentStep: 'develop-story',
}

// Component that initializes mock data after mount
function WorkflowInitializer({ children }: { children: React.ReactNode }) {
  const { updateWorkflowState } = useWorkflow()
  const { setShowWorkflowDiagram } = useLayout()

  useEffect(() => {
    // Initialize with mock workflow state
    updateWorkflowState(mockWorkflowState)
    // Show the workflow diagram
    setShowWorkflowDiagram(true)
  }, [updateWorkflowState, setShowWorkflowDiagram])

  return <>{children}</>
}

function TestWorkflowDiagram() {
  return (
    <LayoutProvider>
      <WorkflowProvider>
        <WorkflowInitializer>
          <div className="h-screen w-screen bg-[#2E3440]">
            <WorkflowDiagram />
          </div>
        </WorkflowInitializer>
      </WorkflowProvider>
    </LayoutProvider>
  )
}

// Mount to DOM
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<TestWorkflowDiagram />)
}

export default TestWorkflowDiagram
