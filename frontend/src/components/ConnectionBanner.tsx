import { useEffect, useState, useRef } from 'react'
import type { ConnectionStatus } from '@/hooks/useWebSocket'

export interface ConnectionBannerProps {
  connectionStatus: ConnectionStatus
  onRetry?: () => void
}

export function ConnectionBanner({ connectionStatus, onRetry }: ConnectionBannerProps) {
  const [showConnectedBanner, setShowConnectedBanner] = useState(false)
  const prevStatusRef = useRef<ConnectionStatus>(connectionStatus)

  // Track when we transition from reconnecting to connected
  useEffect(() => {
    if (prevStatusRef.current === 'reconnecting' && connectionStatus === 'connected') {
      setShowConnectedBanner(true)
      // Auto-dismiss after 2 seconds
      const timer = setTimeout(() => {
        setShowConnectedBanner(false)
      }, 2000)
      prevStatusRef.current = connectionStatus
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = connectionStatus
  }, [connectionStatus])

  // Don't show banner if connected and no transition happened
  if (connectionStatus === 'connected' && !showConnectedBanner) {
    return null
  }

  // Reconnecting state
  if (connectionStatus === 'reconnecting') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center bg-[#EBCB8B] px-4 py-2 text-[#2E3440]">
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="font-medium">Connection lost. Reconnecting...</span>
      </div>
    )
  }

  // Connected state (after reconnection)
  if (connectionStatus === 'connected' && showConnectedBanner) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center bg-[#A3BE8C] px-4 py-2 text-white animate-fade-in">
        <svg
          className="mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="font-medium">Connected</span>
      </div>
    )
  }

  // Failed state (after 5 minutes)
  if (connectionStatus === 'failed') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center bg-[#BF616A] px-4 py-2 text-white">
        <svg
          className="mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="mr-4 font-medium">Connection lost. Please refresh page.</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded bg-white px-3 py-1 text-sm font-medium text-[#BF616A] hover:bg-gray-100 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return null
}
