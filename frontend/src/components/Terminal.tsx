import { useEffect, useRef, useState, memo } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { UseWebSocketReturn } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/button'

export type SessionStatus = 'active' | 'waiting' | 'idle' | 'error' | 'stopped'

export interface TerminalProps {
  sessionId: string
  ws: UseWebSocketReturn
  sessionStatus?: SessionStatus
}

/**
 * Story 4.10 AC#7: Terminal component wrapped with React.memo
 * Prevents re-renders when props haven't changed for performance optimization
 */
const TerminalComponent = ({ sessionId, ws, sessionStatus = 'active' }: TerminalProps) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [currentStatus, setCurrentStatus] = useState<SessionStatus>(sessionStatus)
  const { isConnected, sendInput, sendInterrupt, sendAttach, sendDetach, sendResume, sendResize, on } = ws

  // Store callbacks in refs to avoid stale closures
  const sendInputRef = useRef(sendInput)
  const sendInterruptRef = useRef(sendInterrupt)
  const sendAttachRef = useRef(sendAttach)
  const sendDetachRef = useRef(sendDetach)
  const sendResumeRef = useRef(sendResume)
  const sendResizeRef = useRef(sendResize)
  const isConnectedRef = useRef(isConnected)

  // Keep refs updated
  useEffect(() => {
    sendInputRef.current = sendInput
    sendInterruptRef.current = sendInterrupt
    sendAttachRef.current = sendAttach
    sendDetachRef.current = sendDetach
    sendResumeRef.current = sendResume
    sendResizeRef.current = sendResize
    isConnectedRef.current = isConnected
  }, [sendInput, sendInterrupt, sendAttach, sendDetach, sendResume, sendResize, isConnected])

  // Listen for session status updates
  useEffect(() => {
    const unsubscribe = on('session.status', (message) => {
      if (message.sessionId === sessionId && message.status) {
        setCurrentStatus(message.status as SessionStatus)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sessionId, on])

  // Update current status when prop changes
  useEffect(() => {
    setCurrentStatus(sessionStatus)
  }, [sessionStatus])

  // Handle resume button click
  const handleResume = () => {
    if (isConnected) {
      sendResume(sessionId)
    }
  }

  // Initialize terminal (only once per sessionId)
  useEffect(() => {
    if (!terminalRef.current) return

    // Initialize xterm.js with Oceanic Calm theme
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      lineHeight: 1.6,
      theme: {
        background: '#2E3440',
        foreground: '#D8DEE9',
        cursor: '#88C0D0',
        cursorAccent: '#2E3440',
        selectionBackground: 'rgba(136, 192, 208, 0.3)',
        black: '#3B4252',
        red: '#BF616A',
        green: '#A3BE8C',
        yellow: '#EBCB8B',
        blue: '#88C0D0',
        magenta: '#B48EAD',
        cyan: '#8FBCBB',
        white: '#D8DEE9',
        brightBlack: '#4C566A',
        brightRed: '#BF616A',
        brightGreen: '#A3BE8C',
        brightYellow: '#EBCB8B',
        brightBlue: '#81A1C1',
        brightMagenta: '#B48EAD',
        brightCyan: '#88C0D0',
        brightWhite: '#ECEFF4',
      },
      scrollback: 1000,
    })

    // Initialize fit addon
    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)

    // Initialize web links addon
    const webLinksAddon = new WebLinksAddon()
    xterm.loadAddon(webLinksAddon)

    // Open terminal in DOM
    xterm.open(terminalRef.current)

    // Fit terminal to container
    fitAddon.fit()

    // Send initial resize to backend after fit
    if (isConnectedRef.current) {
      sendResizeRef.current(sessionId, xterm.cols, xterm.rows)
    }

    // Store references
    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle xterm resize events - send to backend when dimensions change
    const disposeOnResize = xterm.onResize(({ cols, rows }) => {
      if (isConnectedRef.current) {
        sendResizeRef.current(sessionId, cols, rows)
      }
    })

    // Handle container resize using ResizeObserver
    // This captures both window resize and panel resize (from layout buttons)
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid layout thrashing
      requestAnimationFrame(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit()
          // Scroll to bottom after resize to keep input area visible
          xtermRef.current.scrollToBottom()
          // Note: onResize event above will automatically send new dimensions to backend
        }
      })
    })
    resizeObserver.observe(terminalRef.current)

    // Handle terminal input (user typing) - use ref to get current callback
    const disposeOnData = xterm.onData((data) => {
      if (isConnectedRef.current) {
        sendInputRef.current(sessionId, data)
      }
    })

    // Handle ESC key for interrupt using xterm's custom key handler
    // This only triggers when terminal has focus, preventing interference with modals/dropdowns
    xterm.attachCustomKeyEventHandler((event) => {
      if (event.key === 'Escape') {
        sendInterruptRef.current(sessionId)
        return false // prevent default xterm handling
      }
      return true // allow normal key handling
    })

    // Cleanup function
    return () => {
      resizeObserver.disconnect()
      disposeOnResize.dispose()
      disposeOnData.dispose()
      xterm.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId])

  // Story 2.6: Send session.attach when component mounts and connected
  useEffect(() => {
    if (isConnected) {
      sendAttach(sessionId)
    }

    // Optional: send session.detach when component unmounts
    return () => {
      if (isConnected) {
        sendDetach(sessionId)
      }
    }
  }, [sessionId, isConnected, sendAttach, sendDetach])

  // Clear terminal when session is attached (before history replay)
  // This prevents duplicate content when reconnecting or switching sessions
  useEffect(() => {
    const unsubscribe = on('session.attached', (message) => {
      if (message.sessionId === sessionId && xtermRef.current) {
        // Clear the terminal buffer before history replay
        xtermRef.current.clear()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sessionId, on])

  // Wire WebSocket output to terminal
  useEffect(() => {
    const unsubscribe = on('terminal.output', (message) => {
      if (message.sessionId === sessionId && message.data && xtermRef.current) {
        xtermRef.current.write(message.data)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sessionId, on])

  // Story 2.9: Listen for terminal.exit events
  useEffect(() => {
    const unsubscribe = on('terminal.exit', (message) => {
      if (message.sessionId === sessionId) {
        // Set status to error when terminal exits
        setCurrentStatus('error')
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sessionId, on])

  // Story 2.10: Show idle state UI for sessions awaiting resume
  if (currentStatus === 'idle') {
    return (
      <div className="relative h-full w-full bg-[#2E3440] flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#88C0D0] bg-opacity-20 mb-4">
            <div className="h-6 w-6 rounded-full bg-[#88C0D0]"></div>
          </div>
          <p className="text-lg text-[#D8DEE9] font-medium">
            Session not running
          </p>
          <p className="text-sm text-[#D8DEE9] opacity-70">
            This session was restored after a container restart.
            <br />
            Click below to spawn a new PTY process and resume your work.
          </p>
          <Button
            onClick={handleResume}
            disabled={!isConnected}
            className="mt-6 bg-[#88C0D0] hover:bg-[#81A1C1] text-[#2E3440] font-semibold px-6 py-2"
          >
            Resume Session
          </Button>
        </div>
      </div>
    )
  }

  // Story 2.9: Show error state UI for crashed sessions (AC #3)
  if (currentStatus === 'error') {
    return (
      <div className="relative h-full w-full bg-[#2E3440] flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#BF616A] bg-opacity-20 mb-4">
            <div className="h-6 w-6 rounded-full bg-[#BF616A]"></div>
          </div>
          <p className="text-lg text-[#D8DEE9] font-medium">
            Process crashed
          </p>
          <p className="text-sm text-[#D8DEE9] opacity-70">
            The Claude CLI process has exited unexpectedly.
            <br />
            Click below to restart the session in the same worktree.
          </p>
          <Button
            onClick={handleResume}
            disabled={!isConnected}
            className="mt-6 bg-[#BF616A] hover:bg-[#BF616A] hover:opacity-90 text-[#ECEFF4] font-semibold px-6 py-2"
          >
            Restart Session
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#2E3440]">
      <div ref={terminalRef} className="h-full w-full p-2" />
    </div>
  )
}

/**
 * Story 4.10 AC#7: Export memoized Terminal component
 * Custom comparison function to optimize re-renders
 */
export const Terminal = memo(TerminalComponent, (prevProps, nextProps) => {
  // Only re-render if sessionId or sessionStatus changed
  // Note: ws object is stable across renders (created once in App.tsx)
  return prevProps.sessionId === nextProps.sessionId &&
         prevProps.sessionStatus === nextProps.sessionStatus
})
