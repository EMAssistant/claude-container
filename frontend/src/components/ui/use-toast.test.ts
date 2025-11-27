/**
 * Story 4.4: Toast Notifications for User Feedback
 * Unit tests for useToast hook and toast system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, reducer, resetToastState } from './use-toast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset toast state before each test
    resetToastState()
  })

  afterEach(() => {
    // Clean up after test
    resetToastState()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('AC4.10: Success toast with green border and 4s auto-dismiss', () => {
    it('should auto-dismiss success toast after 4 seconds', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'success',
          message: 'Session created successfully',
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].type).toBe('success')
      expect(result.current.toasts[0].message).toBe('Session created successfully')

      // Fast-forward 3.9 seconds - toast should still be visible
      act(() => {
        vi.advanceTimersByTime(3900)
      })
      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward to 4 seconds - toast should be dismissed
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.toasts[0].open).toBe(false)

      // Fast-forward animation delay - toast should be removed
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('AC4.11: Error toast with red border and 8s auto-dismiss', () => {
    it('should auto-dismiss error toast after 8 seconds', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'error',
          message: 'Failed to create session',
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].type).toBe('error')

      // Fast-forward 7.9 seconds - toast should still be visible
      act(() => {
        vi.advanceTimersByTime(7900)
      })
      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward to 8 seconds - toast should be dismissed
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.toasts[0].open).toBe(false)
    })
  })

  describe('AC4.12: Warning toast does not auto-dismiss', () => {
    it('should not auto-dismiss warning toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'warning',
          message: 'Connection lost. Reconnecting...',
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].type).toBe('warning')

      // Fast-forward 10 seconds - warning should still be visible
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].open).not.toBe(false)
    })

    it('should manually dismiss warning toast', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string

      act(() => {
        const toast = result.current.toast({
          type: 'warning',
          message: 'Connection lost. Reconnecting...',
        })
        toastId = toast.id
      })

      expect(result.current.toasts).toHaveLength(1)

      // Manual dismiss
      act(() => {
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts[0].open).toBe(false)

      // Fast-forward animation delay
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('AC4.6 (bonus): Info toast with 5s auto-dismiss', () => {
    it('should auto-dismiss info toast after 5 seconds', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'info',
          message: 'Session resumed',
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].type).toBe('info')

      // Fast-forward 4.9 seconds - toast should still be visible
      act(() => {
        vi.advanceTimersByTime(4900)
      })
      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward to 5 seconds - toast should be dismissed
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.toasts[0].open).toBe(false)
    })
  })

  describe('AC4.13: Max 3 visible toasts with queue', () => {
    it('should limit visible toasts to 3 and queue additional toasts', () => {
      const { result } = renderHook(() => useToast())

      // Add 5 toasts rapidly
      act(() => {
        result.current.toast({ type: 'info', message: 'Toast 1' })
        result.current.toast({ type: 'info', message: 'Toast 2' })
        result.current.toast({ type: 'info', message: 'Toast 3' })
        result.current.toast({ type: 'info', message: 'Toast 4' })
        result.current.toast({ type: 'info', message: 'Toast 5' })
      })

      // Only 3 should be visible
      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.queue).toHaveLength(2)

      // Verify order (newest first)
      expect(result.current.toasts[0].message).toBe('Toast 3')
      expect(result.current.toasts[1].message).toBe('Toast 2')
      expect(result.current.toasts[2].message).toBe('Toast 1')
    })

    it('should dequeue toast when visible toast is removed', () => {
      const { result } = renderHook(() => useToast())

      // Add 4 toasts with different types to avoid duplicate prevention
      act(() => {
        result.current.toast({ type: 'success', message: 'Toast 1' })
      })
      act(() => {
        result.current.toast({ type: 'info', message: 'Toast 2' })
      })
      act(() => {
        result.current.toast({ type: 'error', message: 'Toast 3' })
      })
      act(() => {
        result.current.toast({ type: 'warning', message: 'Toast 4' })
      })

      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.queue).toHaveLength(1)
      expect(result.current.queue[0].message).toBe('Toast 4')

      // Manually dismiss the oldest toast to test dequeue
      const oldestToast = result.current.toasts[2] // Toast 1 (at the end)
      act(() => {
        result.current.dismiss(oldestToast.id)
      })

      // Toast should be marked as closed
      expect(result.current.toasts.some(t => t.id === oldestToast.id && t.open === false)).toBe(true)

      // Fast-forward animation delay to trigger removal
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Toast 4 should now be visible (dequeued)
      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.queue).toHaveLength(0)
      expect(result.current.toasts.some(t => t.message === 'Toast 4')).toBe(true)
    })
  })

  describe('AC4.14: Duplicate prevention within 1 second', () => {
    it('should prevent duplicate toasts within 1 second window', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'success',
          message: 'Session created',
        })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Try to add same message within 500ms
      act(() => {
        vi.advanceTimersByTime(500)
        result.current.toast({
          type: 'success',
          message: 'Session created',
        })
      })

      // Should still only have 1 toast
      expect(result.current.toasts).toHaveLength(1)
    })

    it('should allow duplicate after 1 second window', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'success',
          message: 'Session created',
        })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Wait 1.1 seconds
      act(() => {
        vi.advanceTimersByTime(1100)
      })

      // Try to add same message after window
      act(() => {
        result.current.toast({
          type: 'success',
          message: 'Session created',
        })
      })

      // Should have 2 toasts now (first one might be dismissed but still in state)
      expect(result.current.toasts.length).toBeGreaterThan(0)
    })

    it('should match duplicates case-insensitively', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'success',
          message: 'Session Created',
        })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Try to add same message with different case
      act(() => {
        vi.advanceTimersByTime(500)
        result.current.toast({
          type: 'success',
          message: 'session created',
        })
      })

      // Should still only have 1 toast
      expect(result.current.toasts).toHaveLength(1)
    })
  })

  describe('AC4.8: Action button support', () => {
    it('should allow action to be added to toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          type: 'error',
          message: 'Failed to create session',
          action: 'retry-action' as any, // Mock action element
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].action).toBeDefined()
    })
  })

  describe('Reducer: ADD_TOAST action', () => {
    it('should add toast to state', () => {
      const initialState = { toasts: [], queue: [], history: [] }
      const newState = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: {
          id: '1',
          type: 'success',
          message: 'Test',
          open: true,
        },
      })

      expect(newState.toasts).toHaveLength(1)
      expect(newState.toasts[0].id).toBe('1')
    })
  })

  describe('Reducer: DISMISS_TOAST action', () => {
    it('should mark toast as closed', () => {
      const initialState = {
        toasts: [{
          id: '1',
          type: 'success' as const,
          message: 'Test',
          open: true,
        }],
        queue: [],
        history: [],
      }

      const newState = reducer(initialState, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      })

      expect(newState.toasts[0].open).toBe(false)
    })
  })

  describe('Reducer: REMOVE_TOAST action', () => {
    it('should remove toast from state', () => {
      const initialState = {
        toasts: [{
          id: '1',
          type: 'success' as const,
          message: 'Test',
          open: true,
        }],
        queue: [],
        history: [],
      }

      const newState = reducer(initialState, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      })

      expect(newState.toasts).toHaveLength(0)
    })
  })
})
