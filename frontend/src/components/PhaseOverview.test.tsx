/**
 * PhaseOverview Component Tests
 * Story 6.6: Collapsible Phase Overview
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhaseOverview } from './PhaseOverview'
import * as WorkflowContext from '@/context/WorkflowContext'
import * as SprintContext from '@/context/SprintContext'
import type { WorkflowState, SprintStatus } from '@/types'

// Mock contexts
vi.mock('@/context/WorkflowContext', () => ({
  useWorkflow: vi.fn(),
}))

vi.mock('@/context/SprintContext', () => ({
  useSprint: vi.fn(),
}))

vi.mock('@/context/LayoutContext', () => ({
  useLayout: () => ({
    setSelectedFile: vi.fn(),
    setMainContentMode: vi.fn(),
  }),
}))

describe('PhaseOverview', () => {
  const mockWorkflowState: WorkflowState = {
    currentStep: 'prd_creation',
    completedSteps: ['brainstorming', 'product_brief'],
    steps: [
      { name: 'brainstorming', status: 'completed', displayName: 'Brainstorming' },
      { name: 'product_brief', status: 'completed', displayName: 'Product Brief' },
      { name: 'prd_creation', status: 'in_progress', displayName: 'PRD Creation' },
      { name: 'ux_design', status: 'pending', displayName: 'UX Design' },
      { name: 'architecture', status: 'pending', displayName: 'Architecture' },
    ],
  }

  const mockSprintStatus: SprintStatus = {
    epics: [
      {
        epicNumber: 6,
        epicKey: 'epic-6',
        status: 'contexted',
        retrospective: null,
        title: 'Interactive Workflow Tracker',
        storyCount: 10,
        completedCount: 5,
        artifacts: [],
      },
    ],
    stories: [
      {
        storyId: '6-1',
        storyKey: '6-1-sprint-status-yaml-parser',
        epicNumber: 6,
        storyNumber: 1,
        slug: 'sprint-status-yaml-parser',
        status: 'done',
        artifacts: [],
      },
      {
        storyId: '6-2',
        storyKey: '6-2-artifact-path-derivation',
        epicNumber: 6,
        storyNumber: 2,
        slug: 'artifact-path-derivation',
        status: 'done',
        artifacts: [],
      },
      {
        storyId: '6-3',
        storyKey: '6-3-sprint-tracker-component',
        epicNumber: 6,
        storyNumber: 3,
        slug: 'sprint-tracker-component',
        status: 'in-progress',
        artifacts: [],
      },
    ],
    currentEpic: 6,
    currentStory: '6-3',
    lastUpdated: '2025-11-26T12:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Phase Sections', () => {
    it('renders phase sections with correct names', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      expect(screen.getByText('Discovery')).toBeInTheDocument()
      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('Solutioning')).toBeInTheDocument()
      expect(screen.getByText(/Implementation/)).toBeInTheDocument()
    })

    it('shows completion counts in phase headers', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // Discovery has brainstorming completed (1/1)
      expect(screen.getByText('(1/1)')).toBeInTheDocument()
    })
  })

  describe('Collapse/Expand Behavior', () => {
    it('toggles phase section on header click', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // Find Discovery phase header button
      const discoveryButton = screen.getByRole('button', { name: /discovery/i })

      // Default is collapsed (aria-expanded=false)
      expect(discoveryButton).toHaveAttribute('aria-expanded', 'false')

      // Click to expand
      fireEvent.click(discoveryButton)
      expect(discoveryButton).toHaveAttribute('aria-expanded', 'true')

      // Click again to collapse
      fireEvent.click(discoveryButton)
      expect(discoveryButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('persists collapse state to localStorage', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // Expand discovery
      const discoveryButton = screen.getByRole('button', { name: /discovery/i })
      fireEvent.click(discoveryButton)

      // Check localStorage was updated
      const saved = localStorage.getItem('sprintTrackerCollapsedSections')
      expect(saved).toBeTruthy()
      const parsed = JSON.parse(saved!)
      // Discovery should be removed from collapsed set
      expect(parsed).not.toContain('discovery')
    })
  })

  describe('Implementation Section', () => {
    it('shows current epic in implementation header', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      expect(screen.getByText(/Implementation - Epic 6/)).toBeInTheDocument()
    })

    it('shows story count in implementation header', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // 2 done out of 3 stories in epic 6
      expect(screen.getByText('(2/3)')).toBeInTheDocument()
    })

    it('implementation section is expanded by default', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      const implementationButton = screen.getByRole('button', { name: /implementation/i })
      expect(implementationButton).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Status Icons', () => {
    it('shows completed icon for completed steps', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: mockWorkflowState,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // Expand Discovery phase to see steps
      const discoveryButton = screen.getByRole('button', { name: /discovery/i })
      fireEvent.click(discoveryButton)

      // Check for completed icon
      expect(screen.getByText('Brainstorming')).toBeInTheDocument()
    })

    it('shows skipped icon with strikethrough for skipped steps', () => {
      const workflowWithSkipped: WorkflowState = {
        ...mockWorkflowState,
        steps: [
          ...mockWorkflowState.steps,
          { name: 'validate_prd', status: 'skipped', displayName: 'Validate PRD' },
        ],
      }

      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: workflowWithSkipped,
        hasWorkflow: true,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // Expand Planning phase
      const planningButton = screen.getByRole('button', { name: /planning/i })
      fireEvent.click(planningButton)

      // Check that Validate PRD is shown with strikethrough
      const skippedStep = screen.getByText('Validate PRD')
      expect(skippedStep).toHaveClass('line-through')
    })
  })

  describe('Empty State', () => {
    it('handles no workflow data gracefully - only shows Implementation', () => {
      vi.mocked(WorkflowContext.useWorkflow).mockReturnValue({
        workflowState: null,
        hasWorkflow: false,
        updateWorkflowState: vi.fn(),
      })
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<PhaseOverview />)

      // Phase sections without steps won't render headers
      // Only Implementation section should be shown
      expect(screen.queryByText('Discovery')).not.toBeInTheDocument()
      expect(screen.queryByText('Planning')).not.toBeInTheDocument()
      expect(screen.queryByText('Solutioning')).not.toBeInTheDocument()

      // Implementation section should still show
      expect(screen.getByText(/Implementation/)).toBeInTheDocument()
    })
  })
})
