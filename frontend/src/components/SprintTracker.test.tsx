/**
 * SprintTracker Component Tests
 * Story 6.3: Sprint Tracker Component (MVP View)
 * Story 6.4: Artifact Display Under Steps (StoryRow integration)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SprintTracker } from './SprintTracker'
import * as SprintContext from '@/context/SprintContext'
import type { SprintStatus } from '@/types'

// Mock SprintContext
vi.mock('@/context/SprintContext', () => ({
  useSprint: vi.fn(),
}))

// Mock LayoutContext for StoryRow component
vi.mock('@/context/LayoutContext', () => ({
  useLayout: () => ({
    setSelectedFile: vi.fn(),
    setMainContentMode: vi.fn(),
  }),
}))

describe('SprintTracker', () => {
  const mockSprintStatus: SprintStatus = {
    epics: [
      {
        epicNumber: 6,
        epicKey: 'epic-6',
        status: 'contexted',
        retrospective: null,
        title: 'Interactive Workflow Tracker',
        storyCount: 10,
        completedCount: 2,
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
        artifacts: [
          { name: 'Story', path: 'docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md', exists: true, icon: '📄' },
        ],
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
        storyKey: '6-3-sprint-tracker-component-mvp-view',
        epicNumber: 6,
        storyNumber: 3,
        slug: 'sprint-tracker-component-mvp-view',
        status: 'in-progress',
        artifacts: [],
      },
      {
        storyId: '6-4',
        storyKey: '6-4-artifact-display-under-steps',
        epicNumber: 6,
        storyNumber: 4,
        slug: 'artifact-display-under-steps',
        status: 'drafted',
        artifacts: [],
      },
      {
        storyId: '6-5',
        storyKey: '6-5-action-buttons',
        epicNumber: 6,
        storyNumber: 5,
        slug: 'action-buttons',
        status: 'backlog',
        artifacts: [],
      },
    ],
    currentEpic: 6,
    currentStory: '6-3',
    lastUpdated: '2025-11-26T12:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: null,
        selectedEpicNumber: 0,
        isLoading: true,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      expect(screen.getByText(/loading sprint status/i)).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('shows error message when error is present', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: null,
        selectedEpicNumber: 0,
        isLoading: false,
        error: 'Failed to fetch sprint status',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      expect(screen.getByText(/error: failed to fetch sprint status/i)).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows empty state when sprintStatus is null', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: null,
        selectedEpicNumber: 0,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      expect(screen.getByText(/no sprint status data available/i)).toBeInTheDocument()
      expect(screen.getByText(/run sprint-planning workflow/i)).toBeInTheDocument()
    })
  })

  describe('Epic Header with Progress', () => {
    it('displays epic header with number and title', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      expect(screen.getByText(/epic 6: interactive workflow tracker/i)).toBeInTheDocument()
    })

    it('displays correct story count', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      // 2 done out of 5 total stories in epic 6 - use getAllByText since it appears in both summary and progress bar
      const storyCountElements = screen.getAllByText(/2\/5 stories/i)
      expect(storyCountElements.length).toBeGreaterThan(0)
    })

    it('displays progress bar with correct percentage', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      // 2/5 = 40%
      expect(screen.getByText(/40%/i)).toBeInTheDocument()
    })
  })

  describe('Status Icons', () => {
    it('renders correct icon for done status', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      // Find story by role and check it contains the checkmark icon
      const doneStory = screen.getByRole('button', { name: /6-1/i })
      expect(doneStory).toBeInTheDocument()
      expect(doneStory).toHaveTextContent('✓')
    })

    it('renders correct icon for in-progress status', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      const inProgressStory = screen.getByRole('button', { name: /6-3/i })
      expect(inProgressStory).toBeInTheDocument()
      expect(inProgressStory).toHaveTextContent('→')
    })

    it('renders correct icon for drafted status', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      const draftedStory = screen.getByRole('button', { name: /6-4/i })
      expect(draftedStory).toBeInTheDocument()
      expect(draftedStory).toHaveTextContent('○')
    })

    it('renders correct icon for backlog status', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      const backlogStory = screen.getByRole('button', { name: /6-5/i })
      expect(backlogStory).toBeInTheDocument()
      expect(backlogStory).toHaveTextContent('·')
    })
  })

  describe('Current Story Highlight', () => {
    it('highlights current story with special background', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      // The current story is 6-3 which is highlighted
      // Find the story row container by text and check parent for highlight classes
      const storyIdElement = screen.getByText('6-3')
      const storyRowContainer = storyIdElement.closest('[class*="border-l-4"]')
      expect(storyRowContainer).toBeInTheDocument()
      expect(storyRowContainer).toHaveClass('border-l-4')
      expect(storyRowContainer).toHaveClass('border-blue-500')
    })
  })

  describe('Story Row Expansion', () => {
    it('toggles story expansion on click', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      // Find story row button by role and text content
      const storyRow = screen.getByRole('button', { name: /6-1/i })

      // Initially collapsed (not expanded)
      expect(storyRow).toHaveAttribute('aria-expanded', 'false')

      // Click to expand
      fireEvent.click(storyRow)
      expect(storyRow).toHaveAttribute('aria-expanded', 'true')

      // Click again to collapse
      fireEvent.click(storyRow)
      expect(storyRow).toHaveAttribute('aria-expanded', 'false')
    })

    it('shows artifacts when story is expanded', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      // Find story 6-1 which has artifacts in the mock data
      const storyRow = screen.getByRole('button', { name: /6-1/i })

      // Artifacts not visible initially (check for artifact name)
      expect(screen.queryByText('Story')).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(storyRow)

      // Artifacts now visible - the artifact name is "Story"
      expect(screen.getByText('Story')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles epic with no stories', () => {
      const emptyEpicStatus: SprintStatus = {
        epics: [
          {
            epicNumber: 7,
            epicKey: 'epic-7',
            status: 'backlog',
            retrospective: null,
            storyCount: 0,
            completedCount: 0,
            artifacts: [],
          },
        ],
        stories: [],
        currentEpic: 7,
        currentStory: null,
        lastUpdated: '2025-11-26T12:00:00Z',
      }

      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: emptyEpicStatus,
        selectedEpicNumber: 7,
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      expect(screen.getByText(/no stories in this epic yet/i)).toBeInTheDocument()
    })

    it('handles epic not found', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatus,
        selectedEpicNumber: 99, // Non-existent epic
        isLoading: false,
        error: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<SprintTracker />)
      expect(screen.getByText(/epic 99 not found/i)).toBeInTheDocument()
    })
  })
})
