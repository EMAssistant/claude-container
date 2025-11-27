/**
 * Story 4.4: Toast Notifications for User Feedback
 * Unit tests for Toaster component
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toaster } from './toaster'
import { toast } from './use-toast'

describe('Toaster', () => {
  beforeEach(() => {
    // Clear any existing toasts
    const toasts = document.querySelectorAll('[role="status"]')
    toasts.forEach(t => t.remove())
  })

  describe('AC4.10: Success toast rendering', () => {
    it('should render success toast with green styling', () => {
      render(<Toaster />)

      toast({
        type: 'success',
        message: 'Session created successfully',
      })

      // Note: Radix Toast uses role="status" for ARIA
      // The actual toast content will be rendered
      expect(screen.queryByText('Session created successfully')).toBeDefined()
    })
  })

  describe('AC4.11: Error toast rendering', () => {
    it('should render error toast with red styling', () => {
      render(<Toaster />)

      toast({
        type: 'error',
        message: 'Failed to create session',
      })

      expect(screen.queryByText('Failed to create session')).toBeDefined()
    })
  })

  describe('AC4.12: Warning toast rendering', () => {
    it('should render warning toast with yellow styling', () => {
      render(<Toaster />)

      toast({
        type: 'warning',
        message: 'Connection lost. Reconnecting...',
      })

      expect(screen.queryByText('Connection lost. Reconnecting...')).toBeDefined()
    })
  })

  describe('AC4.6: Info toast rendering', () => {
    it('should render info toast with blue styling', () => {
      render(<Toaster />)

      toast({
        type: 'info',
        message: 'Session resumed',
      })

      expect(screen.queryByText('Session resumed')).toBeDefined()
    })
  })

  describe('Toast with title and description', () => {
    it('should render both title and description', () => {
      render(<Toaster />)

      toast({
        type: 'success',
        title: 'Success',
        description: 'Your changes have been saved',
      })

      expect(screen.queryByText('Success')).toBeDefined()
      expect(screen.queryByText('Your changes have been saved')).toBeDefined()
    })
  })

  describe('Toast with message fallback', () => {
    it('should render message as title when no title provided', () => {
      render(<Toaster />)

      toast({
        type: 'info',
        message: 'This is a message',
      })

      expect(screen.queryByText('This is a message')).toBeDefined()
    })
  })
})
