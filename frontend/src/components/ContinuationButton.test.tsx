/**
 * ContinuationButton Component Tests
 * Story 6.9: Create Next Story Action
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContinuationButton } from './ContinuationButton'
import * as SprintContext from '@/context/SprintContext'
import type { SprintStatus } from '@/types'

// Mock SprintContext
vi.mock('@/context/SprintContext', () => ({
  useSprint: vi.fn(),
}))

describe('ContinuationButton', () => {
  const mockSprintStatusWithInProgress: SprintStatus = {
    epics: [
      {
        epicNumber: 6,
        epicKey: 'epic-6',
        status: 'contexted',
        retrospective: null,
        title: 'Interactive Workflow Tracker',
        storyCount: 3,
        completedCount: 1,
        artifacts: [],
      },
      {
        epicNumber: 7,
        epicKey: 'epic-7',
        status: 'backlog',
        retrospective: null,
        title: 'Next Epic',
        storyCount: 0,
        completedCount: 0,
        artifacts: [],
      },
    ],
    stories: [
      {
        storyId: '6-1',
        storyKey: '6-1-story-one',
        epicNumber: 6,
        storyNumber: 1,
        slug: 'story-one',
        status: 'done',
        artifacts: [],
      },
      {
        storyId: '6-2',
        storyKey: '6-2-story-two',
        epicNumber: 6,
        storyNumber: 2,
        slug: 'story-two',
        status: 'in-progress',
        artifacts: [],
      },
    ],
    currentEpic: 6,
    currentStory: '6-2',
    lastUpdated: '2025-11-26T12:00:00Z',
  }

  const mockSprintStatusAllDoneOrReview: SprintStatus = {
    epics: [
      {
        epicNumber: 6,
        epicKey: 'epic-6',
        status: 'contexted',
        retrospective: null,
        title: 'Interactive Workflow Tracker',
        storyCount: 2,
        completedCount: 1,
        artifacts: [],
      },
    ],
    stories: [
      {
        storyId: '6-1',
        storyKey: '6-1-story-one',
        epicNumber: 6,
        storyNumber: 1,
        slug: 'story-one',
        status: 'done',
        artifacts: [],
      },
      {
        storyId: '6-2',
        storyKey: '6-2-story-two',
        epicNumber: 6,
        storyNumber: 2,
        slug: 'story-two',
        status: 'review',
        artifacts: [],
      },
    ],
    currentEpic: 6,
    currentStory: '6-2',
    lastUpdated: '2025-11-26T12:00:00Z',
  }

  const mockSprintStatusEpicComplete: SprintStatus = {
    epics: [
      {
        epicNumber: 6,
        epicKey: 'epic-6',
        status: 'contexted',
        retrospective: 'completed',
        title: 'Interactive Workflow Tracker',
        storyCount: 2,
        completedCount: 2,
        artifacts: [],
      },
      {
        epicNumber: 7,
        epicKey: 'epic-7',
        status: 'backlog',
        retrospective: null,
        title: 'Next Epic',
        storyCount: 0,
        completedCount: 0,
        artifacts: [],
      },
    ],
    stories: [
      {
        storyId: '6-1',
        storyKey: '6-1-story-one',
        epicNumber: 6,
        storyNumber: 1,
        slug: 'story-one',
        status: 'done',
        artifacts: [],
      },
      {
        storyId: '6-2',
        storyKey: '6-2-story-two',
        epicNumber: 6,
        storyNumber: 2,
        slug: 'story-two',
        status: 'done',
        artifacts: [],
      },
    ],
    currentEpic: 6,
    currentStory: null,
    lastUpdated: '2025-11-26T12:00:00Z',
  }

  let commandHandler: (event: Event) => void

  beforeEach(() => {
    vi.clearAllMocks()
    commandHandler = vi.fn()
    window.addEventListener('terminal-command', commandHandler)
  })

  afterEach(() => {
    window.removeEventListener('terminal-command', commandHandler)
  })

  describe('Visibility', () => {
    it('does not render when stories are in progress', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusWithInProgress,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders Create Next Story when all stories are done or review', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusAllDoneOrReview,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      expect(screen.getByRole('button', { name: /create next story/i })).toBeInTheDocument()
    })

    it('renders Start Epic N+1 when epic is complete and next epic exists', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusEpicComplete,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      expect(screen.getByRole('button', { name: /start epic 7/i })).toBeInTheDocument()
    })
  })

  describe('Command Execution', () => {
    it('sends create-story command when Create Next Story is clicked', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusAllDoneOrReview,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      const button = screen.getByRole('button', { name: /create next story/i })
      fireEvent.click(button)

      expect(commandHandler).toHaveBeenCalled()
      const event = (commandHandler as ReturnType<typeof vi.fn>).mock.calls[0][0] as CustomEvent
      expect(event.detail.command || event.detail.data).toContain('create-story')
    })

    it('sends epic-tech-context command when Start Epic is clicked', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusEpicComplete,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      const button = screen.getByRole('button', { name: /start epic 7/i })
      fireEvent.click(button)

      expect(commandHandler).toHaveBeenCalled()
      const event = (commandHandler as ReturnType<typeof vi.fn>).mock.calls[0][0] as CustomEvent
      expect(event.detail.command || event.detail.data).toContain('epic-tech-context')
      expect(event.detail.command || event.detail.data).toContain('7')
    })
  })

  describe('Disabled State', () => {
    it('is disabled when no active session', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusAllDoneOrReview,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId={null} />)

      const button = screen.getByRole('button', { name: /create next story/i })
      expect(button).toBeDisabled()
    })

    it('shows helper text when disabled', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: mockSprintStatusAllDoneOrReview,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: null,
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId={null} />)

      expect(screen.getByText(/select an active session/i)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles no sprint status gracefully', () => {
      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: null,
        selectedEpicNumber: 0,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('handles empty stories array', () => {
      const emptyStoriesStatus: SprintStatus = {
        ...mockSprintStatusAllDoneOrReview,
        stories: [],
      }

      vi.mocked(SprintContext.useSprint).mockReturnValue({
        sprintStatus: emptyStoriesStatus,
        selectedEpicNumber: 6,
        isLoading: false,
        error: null,
        activeSessionId: 'session-1',
        setSelectedEpic: vi.fn(),
        refreshStatus: vi.fn(),
      })

      render(<ContinuationButton activeSessionId="session-1" />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
