/**
 * EmptyState Component Tests
 * Story 3.10: Empty State UI for First-Time Users
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders welcome heading and description', () => {
    const mockOnCreateSession = vi.fn()
    render(<EmptyState onCreateSession={mockOnCreateSession} />)

    // Check heading
    expect(screen.getByText('Start your first project with Claude')).toBeInTheDocument()

    // Check description
    expect(
      screen.getByText(/Create a session to begin autonomous development/i)
    ).toBeInTheDocument()
  })

  it('renders feature highlights', () => {
    const mockOnCreateSession = vi.fn()
    render(<EmptyState onCreateSession={mockOnCreateSession} />)

    // Check feature highlights
    expect(screen.getByText(/Parallel Development/i)).toBeInTheDocument()
    expect(screen.getByText(/BMAD Integration/i)).toBeInTheDocument()
    expect(screen.getByText(/Document Viewer/i)).toBeInTheDocument()
  })

  it('renders terminal icon', () => {
    const mockOnCreateSession = vi.fn()
    const { container } = render(<EmptyState onCreateSession={mockOnCreateSession} />)

    // Check for terminal icon (lucide-react renders svg)
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('renders CTA button with correct text', () => {
    const mockOnCreateSession = vi.fn()
    render(<EmptyState onCreateSession={mockOnCreateSession} />)

    const button = screen.getByRole('button', { name: /Create Your First Session/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('data-testid', 'create-session-btn')
  })

  it('calls onCreateSession when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnCreateSession = vi.fn()
    render(<EmptyState onCreateSession={mockOnCreateSession} />)

    const button = screen.getByRole('button', { name: /Create Your First Session/i })
    await user.click(button)

    expect(mockOnCreateSession).toHaveBeenCalledTimes(1)
  })

  it('applies correct styling classes for centering and card layout', () => {
    const mockOnCreateSession = vi.fn()
    const { container } = render(<EmptyState onCreateSession={mockOnCreateSession} />)

    // Check for centered container
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('flex', 'h-full', 'w-full', 'items-center', 'justify-center')

    // Check for card styling
    const card = wrapper.firstChild as HTMLElement
    expect(card).toHaveClass('rounded-lg', 'bg-card')
  })

  it('uses Oceanic Calm theme colors', () => {
    const mockOnCreateSession = vi.fn()
    const { container } = render(<EmptyState onCreateSession={mockOnCreateSession} />)

    // Terminal icon should use primary color (#88C0D0 from theme)
    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('text-primary')

    // Description text should use muted-foreground
    const description = screen.getByText(/Create a session to begin autonomous development/i)
    expect(description).toHaveClass('text-muted-foreground')
  })
})
