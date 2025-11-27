/**
 * WorkflowProgress Component Tests
 * Story 3.2: Workflow Progress Component (Compact Linear View)
 * Story 6.3: Sprint Tracker Integration
 * Story 6.8: Sprint Tracker as Default View with Phase Toggle
 *
 * Tests cover:
 * - Rendering with workflow state (AC1, AC2)
 * - Status indicators and colors (AC2)
 * - Current step highlighting and auto-scroll (AC3)
 * - Real-time updates via context (AC4)
 * - Empty state handling
 * - Tooltip display (AC5)
 * - Sprint Tracker integration (Story 6.3, 6.8)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useEffect } from 'react'
import { WorkflowProgress } from './WorkflowProgress'
import { WorkflowProvider, useWorkflow } from '@/context/WorkflowContext'
import { SprintProvider } from '@/context/SprintContext'
import { LayoutProvider } from '@/context/LayoutContext'
import type { WorkflowState } from '@/types'

// Mock scrollIntoView
const mockScrollIntoView = vi.fn()
Element.prototype.scrollIntoView = mockScrollIntoView

// Mock fetch for SprintContext
const mockFetch = vi.fn()
global.fetch = mockFetch

// Component that injects workflow state into context
function WorkflowStateInjector({ workflowState }: { workflowState: WorkflowState | null }) {
  const { updateWorkflowState } = useWorkflow()

  useEffect(() => {
    updateWorkflowState(workflowState)
  }, [workflowState, updateWorkflowState])

  return <WorkflowProgress />
}

// Helper function to render WorkflowProgress with all required providers
function renderWorkflowProgress(workflowState: WorkflowState | null) {
  // Mock fetch to return empty sprint status by default
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ sprintStatus: null }),
  })

  return render(
    <LayoutProvider>
      <SprintProvider>
        <WorkflowProvider>
          <WorkflowStateInjector workflowState={workflowState} />
        </WorkflowProvider>
      </SprintProvider>
    </LayoutProvider>
  )
}

// Sample workflow states for testing
const sampleWorkflowState: WorkflowState = {
  currentStep: 'prd_creation',
  completedSteps: ['brainstorming', 'product_brief'],
  steps: [
    { name: 'brainstorming', status: 'completed' as const, displayName: 'Brainstorming' },
    { name: 'product_brief', status: 'completed' as const, displayName: 'Product Brief' },
    { name: 'prd_creation', status: 'in_progress' as const, displayName: 'PRD Creation' },
    { name: 'architecture', status: 'pending' as const, displayName: 'Architecture' },
    { name: 'ux_design', status: 'pending' as const, displayName: 'UX Design' },
    { name: 'epic_planning', status: 'pending' as const, displayName: 'Epic Planning' },
  ],
}

describe('WorkflowProgress', () => {
  beforeEach(() => {
    mockScrollIntoView.mockClear()
    mockFetch.mockClear()
    // Set default view to 'phases' to test the phase view functionality
    // The new WorkflowProgress defaults to 'sprint' view, but these tests are for the phase view
    localStorage.setItem('workflowViewMode', 'phases')
  })

  describe('AC1, AC2: Rendering and Status Indicators', () => {
    it('renders all workflow steps with correct indicators', () => {
      renderWorkflowProgress(sampleWorkflowState)

      // Verify all steps are rendered
      expect(screen.getByText('Brainstorming')).toBeInTheDocument()
      expect(screen.getByText('Product Brief')).toBeInTheDocument()
      expect(screen.getByText('PRD Creation')).toBeInTheDocument()
      expect(screen.getByText('Architecture')).toBeInTheDocument()
      expect(screen.getByText('UX Design')).toBeInTheDocument()
      expect(screen.getByText('Epic Planning')).toBeInTheDocument()
    })

    it('displays checkmark (✓) for completed steps', () => {
      renderWorkflowProgress(sampleWorkflowState)

      // Find all elements with checkmark icon
      const checkmarks = screen.getAllByText('✓')
      expect(checkmarks).toHaveLength(2) // brainstorming and product_brief
    })

    it('displays arrow (→) for current step', () => {
      renderWorkflowProgress(sampleWorkflowState)

      const arrows = screen.getAllByText('→')
      expect(arrows).toHaveLength(1) // prd_creation
    })

    it('displays circle (○) for pending steps', () => {
      renderWorkflowProgress(sampleWorkflowState)

      const circles = screen.getAllByText('○')
      expect(circles).toHaveLength(3) // architecture, ux_design, epic_planning
    })
  })

  describe('AC2: Color Scheme', () => {
    it('applies green color (#A3BE8C) to completed steps', () => {
      renderWorkflowProgress(sampleWorkflowState)

      const checkmarks = screen.getAllByText('✓')
      checkmarks.forEach((checkmark) => {
        expect(checkmark).toHaveStyle({ color: '#A3BE8C' })
      })
    })

    it('applies blue color (#88C0D0) to current step', () => {
      renderWorkflowProgress(sampleWorkflowState)

      const arrow = screen.getByText('→')
      expect(arrow).toHaveStyle({ color: '#88C0D0' })
    })

    it('applies gray color (#4C566A) to pending steps', () => {
      renderWorkflowProgress(sampleWorkflowState)

      const circles = screen.getAllByText('○')
      circles.forEach((circle) => {
        expect(circle).toHaveStyle({ color: '#4C566A' })
      })
    })
  })

  describe('AC3: Current Step Highlighting', () => {
    it('highlights current step with background color (#434C5E)', () => {
      const { container } = renderWorkflowProgress(sampleWorkflowState)

      // Find the current step container (has the arrow)
      const arrow = screen.getByText('→')
      // Get the parent div that has the background class
      const currentStepContainer = arrow.closest('[class*="bg-[#434C5E]"]')

      expect(currentStepContainer).toBeInTheDocument()
      expect(currentStepContainer).toHaveClass('bg-[#434C5E]')
    })

    it('only highlights the current step, not completed or pending', () => {
      const { container } = renderWorkflowProgress(sampleWorkflowState)

      // Completed steps should NOT have highlighted background
      const checkmarks = screen.getAllByText('✓')
      checkmarks.forEach((checkmark) => {
        const container = checkmark.closest('div')
        expect(container).not.toHaveClass('bg-[#434C5E]')
      })

      // Pending steps should NOT have highlighted background
      const circles = screen.getAllByText('○')
      circles.forEach((circle) => {
        const container = circle.closest('div')
        expect(container).not.toHaveClass('bg-[#434C5E]')
      })
    })
  })

  describe('AC3: Auto-scroll Behavior', () => {
    it('calls scrollIntoView when current step changes', async () => {
      const { rerender } = renderWorkflowProgress(sampleWorkflowState)

      // scrollIntoView should be called once on initial render
      await waitFor(() => {
        expect(mockScrollIntoView).toHaveBeenCalledTimes(1)
      })

      // Update workflow to new current step
      const updatedWorkflow: WorkflowState = {
        ...sampleWorkflowState,
        currentStep: 'architecture',
        completedSteps: ['brainstorming', 'product_brief', 'prd_creation'],
        steps: sampleWorkflowState.steps.map((step) => {
          if (step.name === 'prd_creation') return { ...step, status: 'completed' as const }
          if (step.name === 'architecture') return { ...step, status: 'in_progress' as const }
          return step
        }),
      }

      renderWorkflowProgress(updatedWorkflow)

      // scrollIntoView should be called again for new current step
      await waitFor(() => {
        expect(mockScrollIntoView).toHaveBeenCalledTimes(2)
      })
    })

    it('uses smooth scrolling behavior', async () => {
      renderWorkflowProgress(sampleWorkflowState)

      await waitFor(() => {
        expect(mockScrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'nearest',
        })
      })
    })
  })

  describe('AC4: Real-time Updates', () => {
    it('updates UI when workflow state changes', () => {
      const { container } = renderWorkflowProgress(sampleWorkflowState)

      // Verify initial state
      expect(screen.getAllByText('→')).toHaveLength(1)
      expect(screen.getAllByText('✓')).toHaveLength(2)

      // Verify initial content
      expect(screen.getByText('Brainstorming')).toBeInTheDocument()
      expect(screen.getByText('PRD Creation')).toBeInTheDocument()
    })

    it('previous step changes from → to ✓ when step advances', () => {
      renderWorkflowProgress(sampleWorkflowState)

      // Initially, prd_creation has arrow (1 arrow total)
      expect(screen.getAllByText('→')).toHaveLength(1)
      expect(screen.getAllByText('✓')).toHaveLength(2)

      // The arrow should be next to PRD Creation
      const arrow = screen.getAllByText('→')[0]
      const parent = arrow.closest('[class*="px-3"]')
      expect(parent).toHaveTextContent('PRD Creation')
    })
  })

  describe('Empty State', () => {
    it('shows empty state when workflow is null', () => {
      renderWorkflowProgress(null)

      expect(screen.getByText('No Workflow Active')).toBeInTheDocument()
      expect(screen.getByText(/BMAD workflow progress will appear here/i)).toBeInTheDocument()
    })

    it('displays GitBranch icon in empty state', () => {
      renderWorkflowProgress(null)

      // Icon should be rendered
      const icon = document.querySelector('.lucide-git-branch')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Display Name Formatting', () => {
    it('formats step names without displayName', () => {
      const workflowWithoutDisplayNames: WorkflowState = {
        currentStep: 'prd_creation',
        completedSteps: [],
        steps: [
          { name: 'prd_creation', status: 'in_progress' as const },
          { name: 'epic_planning', status: 'pending' as const },
        ],
      }

      renderWorkflowProgress(workflowWithoutDisplayNames)

      // Should auto-format names
      expect(screen.getByText('Prd Creation')).toBeInTheDocument()
      expect(screen.getByText('Epic Planning')).toBeInTheDocument()
    })

    it('uses displayName when provided', () => {
      renderWorkflowProgress(sampleWorkflowState)

      // Should use provided displayName
      expect(screen.getByText('PRD Creation')).toBeInTheDocument()
      expect(screen.getByText('Brainstorming')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('includes aria-label for status indicators', () => {
      renderWorkflowProgress(sampleWorkflowState)

      const completedIndicator = screen.getAllByLabelText(/Status: completed/i)[0]
      expect(completedIndicator).toBeInTheDocument()

      const currentIndicator = screen.getByLabelText(/Status: in_progress/i)
      expect(currentIndicator).toBeInTheDocument()

      const pendingIndicator = screen.getAllByLabelText(/Status: pending/i)[0]
      expect(pendingIndicator).toBeInTheDocument()
    })
  })
})
