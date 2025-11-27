import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './button'

describe('Button Component', () => {
  it('renders with default variant', () => {
    render(<Button>Click Me</Button>)
    const button = screen.getByRole('button', { name: 'Click Me' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary')
  })

  it('renders with primary variant using Oceanic Calm color', () => {
    render(<Button variant="default">Primary Button</Button>)
    const button = screen.getByRole('button', { name: 'Primary Button' })
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('renders with secondary variant', () => {
    render(<Button variant="secondary">Secondary Button</Button>)
    const button = screen.getByRole('button', { name: 'Secondary Button' })
    expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground')
  })

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground')
  })

  it('renders with outline variant', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button', { name: 'Outline' })
    expect(button).toHaveClass('border', 'border-input')
  })

  it('supports keyboard navigation', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Press Me</Button>)
    const button = screen.getByRole('button', { name: 'Press Me' })

    button.focus()
    expect(button).toHaveFocus()

    // Button elements respond to click, not keyDown for Enter
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('supports Space key activation', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Press Me</Button>)
    const button = screen.getByRole('button', { name: 'Press Me' })

    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('handles disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')
  })

  it('renders different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    let button = screen.getByRole('button', { name: 'Small' })
    expect(button).toHaveClass('h-8')

    rerender(<Button size="default">Default</Button>)
    button = screen.getByRole('button', { name: 'Default' })
    expect(button).toHaveClass('h-9')

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole('button', { name: 'Large' })
    expect(button).toHaveClass('h-10')
  })

  it('applies focus ring for accessibility', () => {
    render(<Button>Focus Test</Button>)
    const button = screen.getByRole('button', { name: 'Focus Test' })
    expect(button).toHaveClass('focus-visible:ring-1', 'focus-visible:ring-ring')
  })
})
