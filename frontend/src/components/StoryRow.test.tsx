/**
 * StoryRow Component Tests
 * Story 6.4: Artifact Display Under Steps
 *
 * Tests:
 * - Story row renders with correct structure (AC6.19)
 * - Expansion toggles artifact list visibility (AC6.19)
 * - Artifacts rendered with correct icons (AC6.19)
 * - [View] button calls setSelectedFile (AC6.20)
 * - Missing artifacts shown grayed with "(missing)" (AC6.21)
 * - Highlighted story has correct styling (AC6.19)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StoryRow } from './StoryRow'
import type { StoryData } from '@/types'
import * as LayoutContext from '@/context/LayoutContext'

// Mock LayoutContext
const mockSetSelectedFile = vi.fn()
const mockSetMainContentMode = vi.fn()

vi.mock('@/context/LayoutContext', () => ({
  useLayout: () => ({
    setSelectedFile: mockSetSelectedFile,
    setMainContentMode: mockSetMainContentMode,
  }),
}))

describe('StoryRow Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockStoryWithArtifacts: StoryData = {
    storyId: '6-4',
    storyKey: '6-4-artifact-display-under-steps',
    epicNumber: 6,
    storyNumber: 4,
    slug: 'artifact-display-under-steps',
    status: 'drafted',
    artifacts: [
      {
        name: '6-4-artifact-display-under-steps.md',
        path: 'docs/sprint-artifacts/6-4-artifact-display-under-steps.md',
        exists: true,
        icon: '📄',
      },
      {
        name: '6-4-artifact-display-under-steps.context.xml',
        path: 'docs/sprint-artifacts/6-4-artifact-display-under-steps.context.xml',
        exists: false,
        icon: '📋',
      },
    ],
  }

  const mockStoryNoArtifacts: StoryData = {
    storyId: '6-1',
    storyKey: '6-1-sprint-status-yaml-parser',
    epicNumber: 6,
    storyNumber: 1,
    slug: 'sprint-status-yaml-parser',
    status: 'done',
    artifacts: [],
  }

  describe('Story Row Rendering (AC6.19)', () => {
    it('renders story row with correct structure', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // Check status icon
      expect(screen.getByText('○')).toBeInTheDocument() // drafted status

      // Check story ID
      expect(screen.getByText('6-4')).toBeInTheDocument()

      // Check story slug
      expect(screen.getByText('artifact-display-under-steps')).toBeInTheDocument()

      // Check status text
      expect(screen.getByText('drafted')).toBeInTheDocument()
    })

    it('renders collapsed chevron when not expanded', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('▶')).toBeInTheDocument()
    })

    it('renders expanded chevron when expanded', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('▼')).toBeInTheDocument()
    })

    it('shows highlighted styling when isHighlighted is true', () => {
      const onToggle = vi.fn()
      const { container } = render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={true}
        />
      )

      // Check for highlighted classes
      const highlightedDiv = container.querySelector('.bg-blue-50')
      expect(highlightedDiv).toBeInTheDocument()
    })
  })

  describe('Status Icons (AC6.14)', () => {
    it('renders done status with green checkmark', () => {
      const onToggle = vi.fn()
      const doneStory: StoryData = { ...mockStoryNoArtifacts, status: 'done' }
      render(
        <StoryRow story={doneStory} isExpanded={false} onToggle={onToggle} isHighlighted={false} />
      )

      const icon = screen.getByText('✓')
      expect(icon).toBeInTheDocument()
      expect(icon.className).toContain('text-green-600')
    })

    it('renders review status with yellow circle', () => {
      const onToggle = vi.fn()
      const reviewStory: StoryData = { ...mockStoryNoArtifacts, status: 'review' }
      render(
        <StoryRow
          story={reviewStory}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const icon = screen.getByText('◉')
      expect(icon).toBeInTheDocument()
      expect(icon.className).toContain('text-yellow-600')
    })

    it('renders in-progress status with cyan arrow', () => {
      const onToggle = vi.fn()
      const progressStory: StoryData = { ...mockStoryNoArtifacts, status: 'in-progress' }
      render(
        <StoryRow
          story={progressStory}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const icon = screen.getByText('→')
      expect(icon).toBeInTheDocument()
      expect(icon.className).toContain('text-cyan-600')
    })
  })

  describe('Expansion Toggle (AC6.17, AC6.19)', () => {
    it('calls onToggle when story row is clicked', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const storyRow = screen.getByRole('button')
      fireEvent.click(storyRow)

      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('calls onToggle when Enter key is pressed', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const storyRow = screen.getByRole('button')
      fireEvent.keyDown(storyRow, { key: 'Enter' })

      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('calls onToggle when Space key is pressed', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const storyRow = screen.getByRole('button')
      fireEvent.keyDown(storyRow, { key: ' ' })

      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('does not show artifacts when collapsed', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.queryByText('6-4-artifact-display-under-steps.md')).not.toBeInTheDocument()
    })

    it('shows artifacts when expanded', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('6-4-artifact-display-under-steps.md')).toBeInTheDocument()
    })
  })

  describe('Artifact List Rendering (AC6.19)', () => {
    it('renders all artifacts from story.artifacts array', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('6-4-artifact-display-under-steps.md')).toBeInTheDocument()
      expect(
        screen.getByText('6-4-artifact-display-under-steps.context.xml')
      ).toBeInTheDocument()
    })

    it('renders correct icons for .md files', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // Find all icons - first two are chevron and status, then artifact icons
      const icons = screen.getAllByText('📄')
      expect(icons.length).toBeGreaterThan(0)
    })

    it('renders correct icons for .xml files', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('📋')).toBeInTheDocument()
    })

    it('renders no artifact list when artifacts array is empty', () => {
      const onToggle = vi.fn()
      const { container } = render(
        <StoryRow
          story={mockStoryNoArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // No ul element should be rendered
      expect(container.querySelector('ul')).not.toBeInTheDocument()
    })
  })

  describe('Missing Artifacts (AC6.21)', () => {
    it('shows gray text for missing artifacts', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const missingArtifact = screen.getByText('6-4-artifact-display-under-steps.context.xml')
      expect(missingArtifact.className).toContain('text-gray-500')
    })

    it('shows "(missing)" label for missing artifacts', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('(missing)')).toBeInTheDocument()
    })

    it('does not show [View] button for missing artifacts', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // Should only have one View button (for the existing artifact)
      const viewButtons = screen.getAllByText('View')
      expect(viewButtons).toHaveLength(1)
    })
  })

  describe('[View] Button Integration (AC6.20)', () => {
    it('renders [View] button for existing artifacts', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const viewButtons = screen.getAllByText('View')
      expect(viewButtons.length).toBe(1) // Only one existing artifact
    })

    it('calls setSelectedFile when [View] button is clicked', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const viewButton = screen.getByText('View')
      fireEvent.click(viewButton)

      expect(mockSetSelectedFile).toHaveBeenCalledWith(
        'docs/sprint-artifacts/6-4-artifact-display-under-steps.md'
      )
      expect(mockSetMainContentMode).toHaveBeenCalledWith('artifact')
    })

    it('does not toggle row expansion when [View] button is clicked', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const viewButton = screen.getByText('View')
      fireEvent.click(viewButton)

      // onToggle should not be called - click was on button, not row
      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('File Icon Mapping', () => {
    it('maps .yaml files to 📊 icon', () => {
      const onToggle = vi.fn()
      const storyWithYaml: StoryData = {
        ...mockStoryWithArtifacts,
        artifacts: [
          {
            name: 'sprint-status.yaml',
            path: 'docs/sprint-artifacts/sprint-status.yaml',
            exists: true,
            icon: '📊',
          },
        ],
      }

      render(
        <StoryRow story={storyWithYaml} isExpanded={true} onToggle={onToggle} isHighlighted={false} />
      )

      expect(screen.getByText('📊')).toBeInTheDocument()
    })
  })

  describe('Accessibility (Task 6)', () => {
    it('has semantic HTML with role=button', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has aria-expanded attribute', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const buttons = screen.getAllByRole('button')
      // First button is the story row, second is the View button
      const storyRowButton = buttons[0]
      expect(storyRowButton.getAttribute('aria-expanded')).toBe('true')
    })

    it('has aria-label on View button', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const viewButton = screen.getByLabelText(/View artifact/)
      expect(viewButton).toBeInTheDocument()
    })
  })

  describe('Story 5.5: Review Badges and Action Buttons', () => {
    const mockStoryWithReviewableArtifacts: StoryData = {
      storyId: '5-5',
      storyKey: '5-5-artifact-review-badges',
      epicNumber: 5,
      storyNumber: 5,
      slug: 'artifact-review-badges',
      status: 'in-progress',
      artifacts: [
        {
          name: 'Story',
          path: 'docs/sprint-artifacts/5-5-artifact-review-badges.md',
          exists: true,
          icon: '📄',
          reviewStatus: null, // Non-reviewable (Story doc)
        },
        {
          name: 'SessionList.tsx',
          path: 'src/components/SessionList.tsx',
          exists: true,
          icon: '📄',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
          revision: 1,
        },
        {
          name: 'useWebSocket.ts',
          path: 'src/hooks/useWebSocket.ts',
          exists: true,
          icon: '📄',
          reviewStatus: 'approved',
          modifiedBy: 'claude',
          revision: 1,
        },
      ],
    }

    it('displays pending count when artifacts are pending', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithReviewableArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      expect(screen.getByText('(1 pending)')).toBeInTheDocument()
    })

    it('does not show pending count when all approved', () => {
      const allApprovedStory: StoryData = {
        ...mockStoryWithReviewableArtifacts,
        artifacts: mockStoryWithReviewableArtifacts.artifacts.map(a => ({
          ...a,
          reviewStatus: a.reviewStatus === null ? null : 'approved',
        })),
      }
      const onToggle = vi.fn()
      render(
        <StoryRow story={allApprovedStory} isExpanded={false} onToggle={onToggle} isHighlighted={false} />
      )

      expect(screen.queryByText(/pending/)).not.toBeInTheDocument()
    })

    it('shows all-approved indicator when all reviewable artifacts approved', () => {
      const allApprovedStory: StoryData = {
        ...mockStoryWithReviewableArtifacts,
        artifacts: mockStoryWithReviewableArtifacts.artifacts.map(a => ({
          ...a,
          reviewStatus: a.reviewStatus === null ? null : 'approved',
        })),
      }
      const onToggle = vi.fn()
      render(
        <StoryRow story={allApprovedStory} isExpanded={false} onToggle={onToggle} isHighlighted={false} />
      )

      expect(screen.getByText('✓ All approved')).toBeInTheDocument()
    })

    it('does not show all-approved when no reviewable artifacts', () => {
      const noReviewableStory: StoryData = {
        ...mockStoryWithReviewableArtifacts,
        artifacts: [
          {
            name: 'Story',
            path: 'docs/story.md',
            exists: true,
            icon: '📄',
            reviewStatus: null,
          },
        ],
      }
      const onToggle = vi.fn()
      render(
        <StoryRow story={noReviewableStory} isExpanded={false} onToggle={onToggle} isHighlighted={false} />
      )

      expect(screen.queryByText('✓ All approved')).not.toBeInTheDocument()
    })

    it('logs placeholder message when Approve All button clicked', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const onToggle = vi.fn()
      const { container } = render(
        <StoryRow
          story={mockStoryWithReviewableArtifacts}
          isExpanded={false}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // Find and click the Approve All button (hover-reveal, so use container query)
      const approveAllBtn = screen.getByLabelText(/Approve all .* pending/)
      fireEvent.click(approveAllBtn)

      expect(consoleSpy).toHaveBeenCalledWith('Approve all artifacts in story:', '5-5')
      consoleSpy.mockRestore()
    })

    it('does not show Approve All button when no pending artifacts', () => {
      const allApprovedStory: StoryData = {
        ...mockStoryWithReviewableArtifacts,
        artifacts: mockStoryWithReviewableArtifacts.artifacts.map(a => ({
          ...a,
          reviewStatus: a.reviewStatus === null ? null : 'approved',
        })),
      }
      const onToggle = vi.fn()
      render(
        <StoryRow story={allApprovedStory} isExpanded={false} onToggle={onToggle} isHighlighted={false} />
      )

      expect(screen.queryByLabelText(/Approve all/)).not.toBeInTheDocument()
    })

    it('renders approve and request changes buttons for pending artifacts', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithReviewableArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // Should have approve button for pending artifact
      const approveBtn = screen.getByLabelText('Approve SessionList.tsx')
      expect(approveBtn).toBeInTheDocument()

      // Should have request changes button for pending artifact
      const requestBtn = screen.getByLabelText('Request changes for SessionList.tsx')
      expect(requestBtn).toBeInTheDocument()
    })

    it('does not render action buttons for approved artifacts', () => {
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithReviewableArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      // Approved artifact should not have action buttons
      expect(screen.queryByLabelText('Approve useWebSocket.ts')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Request changes for useWebSocket.ts')).not.toBeInTheDocument()
    })

    it('logs placeholder message when approve button clicked', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithReviewableArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const approveBtn = screen.getByLabelText('Approve SessionList.tsx')
      fireEvent.click(approveBtn)

      expect(consoleSpy).toHaveBeenCalledWith('Approve artifact:', 'src/components/SessionList.tsx')
      consoleSpy.mockRestore()
    })

    it('logs placeholder message when request changes button clicked', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const onToggle = vi.fn()
      render(
        <StoryRow
          story={mockStoryWithReviewableArtifacts}
          isExpanded={true}
          onToggle={onToggle}
          isHighlighted={false}
        />
      )

      const requestBtn = screen.getByLabelText('Request changes for SessionList.tsx')
      fireEvent.click(requestBtn)

      expect(consoleSpy).toHaveBeenCalledWith('Request changes:', 'src/components/SessionList.tsx')
      consoleSpy.mockRestore()
    })
  })
})
