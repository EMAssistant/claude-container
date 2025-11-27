import * as React from "react"

import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

// Story 4.4: Epic 4 toast configuration
const TOAST_LIMIT = 3 // AC4.13: Max 3 visible toasts
const TOAST_REMOVE_DELAY = 1000 // Animation delay before removal

// AC4.10, AC4.11: Auto-dismiss timing
const AUTO_DISMISS_TIMING = {
  success: 4000, // 4 seconds
  error: 8000,   // 8 seconds
  warning: 0,    // Manual dismiss only
  info: 5000,    // 5 seconds
} as const

// AC4.14: Duplicate prevention window
const DEDUP_WINDOW_MS = 1000 // 1 second

// Omit the Radix 'type' property to avoid conflict with our custom type
type ToasterToast = Omit<ToastProps, 'type'> & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  type?: 'success' | 'error' | 'warning' | 'info'
  message?: string
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
  queue: ToasterToast[] // AC4.13: Queue for toasts beyond limit
  history: Array<{ message: string; timestamp: number }> // AC4.14: Duplicate prevention
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const autoDismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

// Clean up auto-dismiss timeout when toast is removed
const clearAutoDismissTimeout = (toastId: string) => {
  const timeout = autoDismissTimeouts.get(toastId)
  if (timeout) {
    clearTimeout(timeout)
    autoDismissTimeouts.delete(toastId)
  }
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST": {
      const newToast = action.toast

      // AC4.14: Duplicate prevention - check if same message exists within 1 second
      const now = Date.now()
      const message = newToast.message || newToast.title?.toString() || ''
      const isDuplicate = state.history.some(
        h => h.message.toLowerCase() === message.toLowerCase() &&
             now - h.timestamp < DEDUP_WINDOW_MS
      )

      if (isDuplicate) {
        console.log('Toast duplicate prevented:', message)
        return state
      }

      // Add to history for duplicate prevention
      const newHistory = [
        ...state.history,
        { message, timestamp: now }
      ].filter(h => now - h.timestamp < DEDUP_WINDOW_MS * 2) // Clean up old entries

      // AC4.13: If at limit, add to queue instead of visible toasts
      if (state.toasts.length >= TOAST_LIMIT) {
        return {
          ...state,
          queue: [...state.queue, newToast],
          history: newHistory,
        }
      }

      // AC4.10, AC4.11: Auto-dismiss based on type
      const toastType = newToast.type || 'info'
      const dismissDelay = AUTO_DISMISS_TIMING[toastType]

      if (dismissDelay > 0) {
        const timeout = setTimeout(() => {
          dispatch({ type: "DISMISS_TOAST", toastId: newToast.id })
        }, dismissDelay)
        autoDismissTimeouts.set(newToast.id, timeout)
      }

      return {
        ...state,
        toasts: [newToast, ...state.toasts],
        history: newHistory,
      }
    }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
        clearAutoDismissTimeout(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
          clearAutoDismissTimeout(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }

    case "REMOVE_TOAST": {
      if (action.toastId === undefined) {
        // Clear all timeouts
        state.toasts.forEach(toast => clearAutoDismissTimeout(toast.id))
        return {
          ...state,
          toasts: [],
          queue: [],
        }
      }

      clearAutoDismissTimeout(action.toastId)

      const newToasts = state.toasts.filter((t) => t.id !== action.toastId)

      // AC4.13: Dequeue next toast if available
      let newQueue = state.queue
      if (state.queue.length > 0) {
        const [nextToast, ...remainingQueue] = state.queue
        newQueue = remainingQueue

        // Auto-dismiss the dequeued toast
        const toastType = nextToast.type || 'info'
        const dismissDelay = AUTO_DISMISS_TIMING[toastType]

        if (dismissDelay > 0) {
          const timeout = setTimeout(() => {
            dispatch({ type: "DISMISS_TOAST", toastId: nextToast.id })
          }, dismissDelay)
          autoDismissTimeouts.set(nextToast.id, timeout)
        }

        return {
          ...state,
          toasts: [...newToasts, nextToast],
          queue: newQueue,
        }
      }

      return {
        ...state,
        toasts: newToasts,
        queue: newQueue,
      }
    }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [], queue: [], history: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

// Test helper to reset state
function resetToastState() {
  // Clear all timeouts
  toastTimeouts.forEach(timeout => clearTimeout(timeout))
  toastTimeouts.clear()
  autoDismissTimeouts.forEach(timeout => clearTimeout(timeout))
  autoDismissTimeouts.clear()

  // Reset memory state
  memoryState = { toasts: [], queue: [], history: [] }

  // Notify all listeners
  listeners.forEach(listener => listener(memoryState))
}

export { useToast, toast, resetToastState }
