/**
 * AccessibilityAnnouncer Component Tests
 * Story 4.9: Keyboard Shortcuts and Accessibility Enhancements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AccessibilityAnnouncer, useAccessibility } from './AccessibilityAnnouncer'

describe('AccessibilityAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should render ARIA live regions', () => {
    render(
      <AccessibilityAnnouncer>
        <div>Test content</div>
      </AccessibilityAnnouncer>
    )

    // Check for polite live region
    const politeRegion = screen.getByRole('status')
    expect(politeRegion).toBeInTheDocument()
    expect(politeRegion).toHaveAttribute('aria-live', 'polite')
    expect(politeRegion).toHaveAttribute('aria-atomic', 'true')
    expect(politeRegion).toHaveClass('sr-only')

    // Check for assertive live region
    const assertiveRegion = screen.getByRole('alert')
    expect(assertiveRegion).toBeInTheDocument()
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive')
    expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true')
    expect(assertiveRegion).toHaveClass('sr-only')
  })

  it('should render children', () => {
    render(
      <AccessibilityAnnouncer>
        <div data-testid="child">Test content</div>
      </AccessibilityAnnouncer>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  describe('Polite Announcements', () => {
    it('should announce polite messages', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('Test polite message', 'polite')}>
            Announce
          </button>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')

      act(() => {
        button.click()
      })

      const politeRegion = screen.getByRole('status')
      expect(politeRegion).toHaveTextContent('Test polite message')
    })

    it('should clear polite message after 1 second', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('Test message', 'polite')}>
            Announce
          </button>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')
      const politeRegion = screen.getByRole('status')

      act(() => {
        button.click()
      })

      // Message should be present initially
      expect(politeRegion).toHaveTextContent('Test message')

      // Fast-forward time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Message should be cleared
      expect(politeRegion).toHaveTextContent('')
    })

    it('should replace previous polite message with new one', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <>
            <button onClick={() => announce('First message', 'polite')}>
              First
            </button>
            <button onClick={() => announce('Second message', 'polite')}>
              Second
            </button>
          </>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const firstButton = screen.getByText('First')
      const secondButton = screen.getByText('Second')
      const politeRegion = screen.getByRole('status')

      act(() => {
        firstButton.click()
      })

      expect(politeRegion).toHaveTextContent('First message')

      // Announce second message
      act(() => {
        secondButton.click()
      })

      expect(politeRegion).toHaveTextContent('Second message')
    })
  })

  describe('Assertive Announcements', () => {
    it('should announce assertive messages', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('Critical error!', 'assertive')}>
            Announce Error
          </button>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')

      act(() => {
        button.click()
      })

      const assertiveRegion = screen.getByRole('alert')
      expect(assertiveRegion).toHaveTextContent('Critical error!')
    })

    it('should clear assertive message after 1 second', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('Error message', 'assertive')}>
            Announce Error
          </button>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')
      const assertiveRegion = screen.getByRole('alert')

      act(() => {
        button.click()
      })

      expect(assertiveRegion).toHaveTextContent('Error message')

      // Fast-forward time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(assertiveRegion).toHaveTextContent('')
    })
  })

  describe('Default Priority', () => {
    it('should default to polite priority when not specified', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('Default priority message')}>
            Announce
          </button>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')

      act(() => {
        button.click()
      })

      const politeRegion = screen.getByRole('status')
      expect(politeRegion).toHaveTextContent('Default priority message')

      // Assertive region should be empty
      const assertiveRegion = screen.getByRole('alert')
      expect(assertiveRegion).toHaveTextContent('')
    })
  })

  describe('Empty Message Handling', () => {
    it('should not announce empty messages', async () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('', 'polite')}>
            Announce Empty
          </button>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')
      button.click()

      const politeRegion = screen.getByRole('status')
      expect(politeRegion).toHaveTextContent('')
    })
  })

  describe('useAccessibility Hook Error Handling', () => {
    it('should throw error when used outside AccessibilityAnnouncer', () => {
      function TestComponent() {
        // This should throw an error
        const { announce } = useAccessibility()
        announce('test')
        return <div>Test</div>
      }

      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => render(<TestComponent />)).toThrow(
        'useAccessibility must be used within AccessibilityAnnouncer'
      )

      console.error = originalError
    })
  })

  describe('Concurrent Announcements', () => {
    it('should handle polite and assertive announcements independently', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <>
            <button onClick={() => announce('Polite message', 'polite')}>
              Polite
            </button>
            <button onClick={() => announce('Assertive message', 'assertive')}>
              Assertive
            </button>
          </>
        )
      }

      render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const politeButton = screen.getByText('Polite')
      const assertiveButton = screen.getByText('Assertive')

      act(() => {
        politeButton.click()
        assertiveButton.click()
      })

      const politeRegion = screen.getByRole('status')
      const assertiveRegion = screen.getByRole('alert')

      expect(politeRegion).toHaveTextContent('Polite message')
      expect(assertiveRegion).toHaveTextContent('Assertive message')
    })
  })

  describe('Timer Cleanup', () => {
    it('should cleanup timers on unmount', () => {
      function TestComponent() {
        const { announce } = useAccessibility()

        return (
          <button onClick={() => announce('Test message', 'polite')}>
            Announce
          </button>
        )
      }

      const { unmount } = render(
        <AccessibilityAnnouncer>
          <TestComponent />
        </AccessibilityAnnouncer>
      )

      const button = screen.getByRole('button')
      button.click()

      // Unmount before timer fires
      unmount()

      // Advance timers - should not throw error
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    })
  })
})
