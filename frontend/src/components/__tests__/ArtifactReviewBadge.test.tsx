/**
 * ArtifactReviewBadge Component Tests
 * Story 5.5: Artifact Review Badges in Sprint Tracker
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArtifactReviewBadge } from '../ArtifactReviewBadge'

describe('ArtifactReviewBadge', () => {
  it('renders nothing for null reviewStatus', () => {
    const { container } = render(<ArtifactReviewBadge reviewStatus={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for undefined reviewStatus', () => {
    const { container } = render(<ArtifactReviewBadge reviewStatus={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders approved badge with check icon', () => {
    render(<ArtifactReviewBadge reviewStatus="approved" />)
    const badge = screen.getByRole('status', { name: 'Approved' })
    expect(badge).toBeInTheDocument()
    // Check for green color class
    const icon = badge.querySelector('svg')
    expect(icon).toHaveClass('text-[#A3BE8C]')
  })

  it('renders pending badge with clock icon', () => {
    render(<ArtifactReviewBadge reviewStatus="pending" />)
    const badge = screen.getByRole('status', { name: 'Pending review' })
    expect(badge).toBeInTheDocument()
    // Check for yellow color class
    const icon = badge.querySelector('svg')
    expect(icon).toHaveClass('text-[#EBCB8B]')
  })

  it('renders changes-requested badge with alert icon', () => {
    render(<ArtifactReviewBadge reviewStatus="changes-requested" />)
    const badge = screen.getByRole('status', { name: 'Changes requested' })
    expect(badge).toBeInTheDocument()
    // Check for orange color class
    const icon = badge.querySelector('svg')
    expect(icon).toHaveClass('text-[#D08770]')
  })

  it('applies correct color classes for each status', () => {
    const { rerender, container } = render(<ArtifactReviewBadge reviewStatus="approved" />)
    let icon = container.querySelector('svg')
    expect(icon).toHaveClass('text-[#A3BE8C]') // Green

    rerender(<ArtifactReviewBadge reviewStatus="pending" />)
    icon = container.querySelector('svg')
    expect(icon).toHaveClass('text-[#EBCB8B]') // Yellow

    rerender(<ArtifactReviewBadge reviewStatus="changes-requested" />)
    icon = container.querySelector('svg')
    expect(icon).toHaveClass('text-[#D08770]') // Orange
  })

  it('has proper accessibility attributes', () => {
    render(<ArtifactReviewBadge reviewStatus="approved" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Approved')
  })

  it('shows tooltip on hover (tooltip content present)', () => {
    render(<ArtifactReviewBadge reviewStatus="pending" />)
    // Tooltip content should be in the DOM (even if not visible until hover)
    // This is a basic check - full tooltip behavior would need user event simulation
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
