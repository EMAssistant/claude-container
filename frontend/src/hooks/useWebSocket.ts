import { useEffect, useRef, useState, useCallback } from 'react'

export interface WebSocketMessage {
  type: string
  sessionId?: string
  data?: string
  timestamp?: number
  status?: string
  // Story 4.1: Session status update fields
  lastActivity?: string
  isStuck?: boolean
  // Story 3.6: Layout shift message fields
  mode?: 'terminal' | 'artifact' | 'split'
  trigger?: 'file_write' | 'user_input'
  // Story 4.3: Browser notification message fields
  message?: string
  // Story 4.8: Resource warning message fields
  memoryUsagePercent?: number
  isAcceptingNewSessions?: boolean
  // Story 4.17: Cross-tab session sync message fields
  session?: import('@/types').Session
  // Story 3.1: Workflow update message fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow?: any
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'failed'

export interface UseWebSocketReturn {
  isConnected: boolean
  reconnecting: boolean
  connectionStatus: ConnectionStatus
  send: (message: WebSocketMessage) => void
  sendInput: (sessionId: string, data: string) => void
  sendInterrupt: (sessionId: string) => void
  sendAttach: (sessionId: string) => void
  sendDetach: (sessionId: string) => void
  sendResume: (sessionId: string) => void
  sendResize: (sessionId: string, cols: number, rows: number) => void
  on: (type: string, callback: (message: WebSocketMessage) => void) => () => void
  retryConnection: () => void
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected')
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Map<string, Set<(message: WebSocketMessage) => void>>>(new Map())
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectDelayRef = useRef(1000) // Start at 1 second
  const reconnectAttemptRef = useRef(0)
  const reconnectStartTimeRef = useRef<number | null>(null)
  const attachedSessionsRef = useRef<Set<string>>(new Set())

  // Track if this is initial connection or reconnection
  const isInitialConnectionRef = useRef(true)

  // 5-minute timeout constant (300000ms)
  const MAX_RECONNECT_TIME = 300000

  const attemptReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    // Check if we've exceeded 5-minute threshold
    if (reconnectStartTimeRef.current) {
      const totalReconnectTime = Date.now() - reconnectStartTimeRef.current
      if (totalReconnectTime >= MAX_RECONNECT_TIME) {
        console.warn('WebSocket reconnection timeout (5 minutes), switching to failed state')
        setConnectionStatus('failed')
        setReconnecting(false)
        return
      }
    }

    // Calculate exponential backoff delay
    const delay = Math.min(Math.pow(2, reconnectAttemptRef.current) * 1000, 30000)
    reconnectDelayRef.current = delay

    console.debug('Attempting reconnection', {
      attempt: reconnectAttemptRef.current + 1,
      delay
    })

    reconnectTimeoutRef.current = window.setTimeout(() => {
      connect()
      // Increment attempt counter AFTER timeout completes
      reconnectAttemptRef.current += 1
    }, delay)
  }, [])

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.info('WebSocket reconnected', {
          totalAttempts: reconnectAttemptRef.current,
          totalDowntime: reconnectStartTimeRef.current
            ? Date.now() - reconnectStartTimeRef.current
            : 0
        })

        setIsConnected(true)
        setConnectionStatus('connected')

        // Reset reconnection state
        reconnectDelayRef.current = 1000
        reconnectAttemptRef.current = 0
        reconnectStartTimeRef.current = null

        // Only set reconnecting to false after a delay for initial connection
        // For reconnections, set immediately to show "Connected" banner
        if (isInitialConnectionRef.current) {
          setReconnecting(false)
          isInitialConnectionRef.current = false
        } else {
          setReconnecting(false)

          // Re-attach to all previously attached sessions
          attachedSessionsRef.current.forEach(sessionId => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session.attach', sessionId }))
              console.info('Re-attached to session after reconnection', { sessionId })
            }
          })
        }
      }

      ws.onclose = (event) => {
        console.warn('WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        })

        setIsConnected(false)
        wsRef.current = null

        // Start reconnection tracking if not already tracking
        if (!reconnectStartTimeRef.current) {
          reconnectStartTimeRef.current = Date.now()
        }

        setReconnecting(true)
        setConnectionStatus('reconnecting')

        // Attempt to reconnect with exponential backoff
        attemptReconnect()
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)

          // Call all listeners registered for this message type
          const listeners = listenersRef.current.get(message.type)
          if (listeners) {
            listeners.forEach(callback => callback(message))
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setReconnecting(true)
      setConnectionStatus('reconnecting')
      attemptReconnect()
    }
  }, [url, attemptReconnect])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected, cannot send message')
    }
  }, [])

  const sendInput = useCallback((sessionId: string, data: string) => {
    send({ type: 'terminal.input', sessionId, data })
  }, [send])

  const sendInterrupt = useCallback((sessionId: string) => {
    send({ type: 'terminal.interrupt', sessionId })
  }, [send])

  const sendAttach = useCallback((sessionId: string) => {
    // Track attached sessions for reconnection
    attachedSessionsRef.current.add(sessionId)
    send({ type: 'session.attach', sessionId })
  }, [send])

  const sendDetach = useCallback((sessionId: string) => {
    // Remove from tracked sessions
    attachedSessionsRef.current.delete(sessionId)
    send({ type: 'session.detach', sessionId })
  }, [send])

  const sendResume = useCallback((sessionId: string) => {
    send({ type: 'session.resume', sessionId })
  }, [send])

  const sendResize = useCallback((sessionId: string, cols: number, rows: number) => {
    send({ type: 'terminal.resize', sessionId, cols, rows } as WebSocketMessage & { cols: number; rows: number })
  }, [send])

  const retryConnection = useCallback(() => {
    // Reset backoff state and attempt immediate reconnection
    console.info('Manual retry requested, resetting backoff')
    reconnectAttemptRef.current = 0
    reconnectDelayRef.current = 1000
    reconnectStartTimeRef.current = Date.now()
    setConnectionStatus('reconnecting')
    setReconnecting(true)
    connect()
  }, [connect])

  const on = useCallback((type: string, callback: (message: WebSocketMessage) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set())
    }
    listenersRef.current.get(type)!.add(callback)

    // Return unsubscribe function
    return () => {
      const listeners = listenersRef.current.get(type)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          listenersRef.current.delete(type)
        }
      }
    }
  }, [])

  return {
    isConnected,
    reconnecting,
    connectionStatus,
    send,
    sendInput,
    sendInterrupt,
    sendAttach,
    sendDetach,
    sendResume,
    sendResize,
    on,
    retryConnection,
  }
}
