import '@/styles/globals.css'
import { useCallback, useState, useEffect, useRef } from 'react'
import { MainContentArea } from '@/components/MainContentArea'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { SessionList } from '@/components/SessionList'
import { SessionModal } from '@/components/SessionModal'
import { SessionDestroyDialog } from '@/components/SessionDestroyDialog'
import { LeftSidebar } from '@/components/LeftSidebar'
import { TopBar } from '@/components/TopBar'
import { EmptyState } from '@/components/EmptyState'
import { NotificationBanner } from '@/components/NotificationBanner'
import { Toaster } from '@/components/ui/toaster'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useToast } from '@/components/ui/use-toast'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useArtifactNotifications } from '@/hooks/useArtifactNotifications'
import { AccessibilityAnnouncer } from '@/components/AccessibilityAnnouncer'
import { LayoutProvider, useLayout, DEFAULT_LEFT_SIDEBAR_WIDTH, MIN_LEFT_SIDEBAR_WIDTH, MAX_LEFT_SIDEBAR_WIDTH, DEFAULT_RIGHT_SIDEBAR_WIDTH, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH, COLLAPSED_WIDTH } from '@/context/LayoutContext'
import { NotificationProvider, useNotification } from '@/context/NotificationContext'
import { WorkflowProvider, useWorkflow } from '@/context/WorkflowContext'
import { SprintProvider, useSprintInternal } from '@/context/SprintContext'
import type { Session } from '@/types'
import type { ImperativePanelHandle } from 'react-resizable-panels'

/**
 * Story 4.10 AC#8: Lazy load WorkflowProgress and DiffView for code splitting
 * These components are not critical for initial page load
 * Note: WorkflowProgress and DiffView are lazy loaded in their parent components
 * (LeftSidebar and ArtifactViewer respectively)
 */

/**
 * Internal component that needs access to LayoutContext
 * Handles layout.shift WebSocket messages
 */
function AppContent() {
  // WebSocket configuration - single connection for entire app
  const websocketUrl = 'ws://localhost:3000'
  const ws = useWebSocket(websocketUrl)
  const { isConnected, connectionStatus, retryConnection, sendInterrupt, on } = ws
  const { toast } = useToast()

  // Story 3.6: Access layout context for auto-shift
  // Story 3.8: Access layout context for left sidebar resizing
  // Right sidebar: Access layout context for right sidebar resizing
  const {
    setMainContentMode, autoShiftPaused, resumeAutoShift,
    leftSidebarWidth, setLeftSidebarWidth, isLeftCollapsed, toggleLeftSidebarView,
    rightSidebarWidth, setRightSidebarWidth, isRightCollapsed, setIsRightCollapsed, toggleRightSidebarCollapse
  } = useLayout()

  // Story 4.3: Access notification context for browser notifications
  const { sendNotification } = useNotification()

  // Story 3.1: Access workflow context for workflow status updates
  const { updateWorkflowState } = useWorkflow()

  // Story 6.3: Access sprint context for sprint status updates
  // Story 6.5: Sync activeSessionId to sprint context for action buttons
  // Story 5.5: Access updateArtifact for artifact.updated WebSocket messages
  const { updateSprintStatus, setActiveSessionId: syncActiveSessionId, updateArtifact } = useSprintInternal()

  // Story 3.8: Ref for left sidebar panel to control programmatically
  const leftSidebarPanelRef = useRef<ImperativePanelHandle>(null)

  // Ref for right sidebar panel to control programmatically
  const rightSidebarPanelRef = useRef<ImperativePanelHandle>(null)

  // Story 3.8: Track viewport width for percentage calculation
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth)

  // Story 2.3/2.5: Session management state
  // Story 3.10: Start with empty sessions array to show EmptyState on first load
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Story 3.10: Track session modal state for EmptyState CTA
  const [sessionModalOpen, setSessionModalOpen] = useState(false)

  // Story 2.7: Session destruction state
  const [destroyDialogOpen, setDestroyDialogOpen] = useState(false)
  const [sessionToDestroy, setSessionToDestroy] = useState<Session | null>(null)
  const [destroyInProgress, setDestroyInProgress] = useState(false)

  // Story 4.8: Resource warning state
  const [resourceWarning, setResourceWarning] = useState<{ memoryUsagePercent: number; isAcceptingNewSessions: boolean } | null>(null)

  // Repository name state (fetched from backend)
  const [repoName, setRepoName] = useState<string | null>(null)

  // Fetch workspace info on mount
  useEffect(() => {
    fetch('/api/workspace/info')
      .then(res => res.json())
      .then(data => {
        if (data.repoName) {
          setRepoName(data.repoName)
        }
      })
      .catch(err => {
        console.warn('Failed to fetch workspace info:', err)
      })
  }, [])

  // Story 4.9: Keyboard shortcuts integration
  useKeyboardShortcuts({
    onSwitchSession: (index: number) => {
      if (sessions[index]) {
        handleSelectSession(sessions[index].id)
      }
    },
    onNewSession: () => {
      setSessionModalOpen(true)
    },
    onFocusTerminal: () => {
      setMainContentMode('terminal')
    },
    onFocusArtifacts: () => {
      setMainContentMode('split')
    },
    onToggleSidebarView: () => {
      toggleLeftSidebarView()
    },
    onCloseModal: () => {
      // Close session modal if open
      if (sessionModalOpen) {
        setSessionModalOpen(false)
      }
      // Close destroy dialog if open
      if (destroyDialogOpen && !destroyInProgress) {
        setDestroyDialogOpen(false)
        setSessionToDestroy(null)
      }
    },
  })

  // Story 5.8: Quick-approve toast notifications
  useArtifactNotifications(ws)

  // Handle STOP button click
  const handleInterrupt = useCallback(() => {
    if (activeSessionId) {
      sendInterrupt(activeSessionId)
    }
  }, [activeSessionId, sendInterrupt])

  // Handle new session creation
  const handleSessionCreated = useCallback((session: Session) => {
    console.log('Session created:', session)
    setSessions((prev) => {
      // Avoid duplicates - WebSocket broadcast may have already added this session
      if (prev.some(s => s.id === session.id)) {
        console.log('Session already in list (from WebSocket broadcast), skipping duplicate add')
        return prev
      }
      return [...prev, session]
    })
    setActiveSessionId(session.id) // Switch to newly created session
    setSessionModalOpen(false) // Close modal after creation
  }, [])

  // Handle session selection
  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
  }, [])

  // Story 2.7: Listen for session.destroyed WebSocket messages
  useEffect(() => {
    const unsubscribe = on('session.destroyed', (message) => {
      if (message.sessionId) {
        handleSessionDestroyedEvent(message.sessionId)
      }
    })
    return unsubscribe
  }, [on])

  // Story 4.17: Listen for session.created WebSocket messages (cross-tab sync)
  useEffect(() => {
    const unsubscribe = on('session.created', (message) => {
      if (message.session) {
        setSessions(prev => {
          // Avoid duplicates (in case we created it ourselves)
          if (prev.some(s => s.id === message.session!.id)) {
            return prev
          }
          console.log('Session created in another tab, adding to list:', message.session!.id)
          return [...prev, message.session!]
        })
        // Note: Do NOT change activeSessionId - silent add (AC1)
      }
    })
    return unsubscribe
  }, [on])

  // Story 4.17: Listen for session.updated WebSocket messages (cross-tab sync)
  useEffect(() => {
    const unsubscribe = on('session.updated', (message) => {
      if (message.session) {
        setSessions(prev =>
          prev.map(s => s.id === message.session!.id ? message.session! : s)
        )
      }
    })
    return unsubscribe
  }, [on])

  // Listen for session.status WebSocket messages to update lastActivity and status
  useEffect(() => {
    const unsubscribe = on('session.status', (message) => {
      if (message.sessionId && (message.status || message.lastActivity)) {
        setSessions(prev =>
          prev.map(s => {
            if (s.id === message.sessionId) {
              return {
                ...s,
                status: message.status || s.status,
                lastActivity: message.lastActivity || s.lastActivity
              }
            }
            return s
          })
        )
      }
    })
    return unsubscribe
  }, [on])

  // Story 3.6: Listen for layout.shift WebSocket messages
  useEffect(() => {
    const unsubscribe = on('layout.shift', (message) => {
      // Only auto-shift if not paused by manual override
      if (!autoShiftPaused && message.mode) {
        console.log('Layout auto-shift triggered:', message.mode, message.trigger)
        setMainContentMode(message.mode as 'terminal' | 'artifact' | 'split')
        // Resume auto-shift on file write events
        if (message.trigger === 'file_write') {
          resumeAutoShift()
        }
      }
    })
    return unsubscribe
  }, [on, autoShiftPaused, setMainContentMode, resumeAutoShift])

  // Story 4.8: Listen for resource.warning WebSocket messages
  useEffect(() => {
    const unsubscribe = on('resource.warning', (message) => {
      console.log('Resource warning received:', message)
      if (message.memoryUsagePercent !== undefined && message.isAcceptingNewSessions !== undefined) {
        setResourceWarning({
          memoryUsagePercent: message.memoryUsagePercent,
          isAcceptingNewSessions: message.isAcceptingNewSessions
        })
      }
    })
    return unsubscribe
  }, [on])

  // Story 3.1: Listen for workflow.updated WebSocket messages
  useEffect(() => {
    const unsubscribe = on('workflow.updated', (message) => {
      console.log('Workflow update received:', message)
      if (message.workflow) {
        updateWorkflowState(message.workflow)
      }
    })
    return unsubscribe
  }, [on, updateWorkflowState])

  // Story 6.3: Listen for sprint.updated WebSocket messages
  useEffect(() => {
    const unsubscribe = on('sprint.updated', (message) => {
      console.log('Sprint update received:', message)
      // Type assertion for sprint.updated message
      const sprintMessage = message as any
      if (sprintMessage.sprintStatus) {
        updateSprintStatus(sprintMessage.sprintStatus)
      }
    })
    return unsubscribe
  }, [on, updateSprintStatus])

  // Story 5.5: Listen for artifact.updated WebSocket messages
  useEffect(() => {
    const unsubscribe = on('artifact.updated', (message) => {
      console.log('Artifact update received:', message)
      // Type assertion for artifact.updated message
      const artifactMessage = message as any
      if (artifactMessage.storyId && artifactMessage.artifact) {
        updateArtifact(artifactMessage.storyId, artifactMessage.artifact)
      }
    })
    return unsubscribe
  }, [on, updateArtifact])

  // Story 6.5: Sync activeSessionId to SprintContext for action buttons
  useEffect(() => {
    syncActiveSessionId(activeSessionId)
  }, [activeSessionId, syncActiveSessionId])

  // Story 3.1: Fetch initial workflow status on WebSocket connection
  useEffect(() => {
    const fetchWorkflowStatus = async () => {
      try {
        console.log('Fetching initial workflow status')
        const response = await fetch('/api/workflow/status')

        if (!response.ok) {
          throw new Error(`Failed to fetch workflow status: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('Workflow status fetched:', data)

        if (data.workflow) {
          updateWorkflowState(data.workflow)
        }
      } catch (error) {
        console.error('Failed to fetch workflow status:', error)
        // Don't show error toast - workflow status is optional
      }
    }

    // Fetch workflow status when WebSocket connects
    if (isConnected) {
      fetchWorkflowStatus()
    }
  }, [isConnected, updateWorkflowState])

  // Story 4.16/4.19: Fetch existing sessions on mount and WebSocket reconnection
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        console.log('Fetching existing sessions from /api/sessions')
        const response = await fetch('/api/sessions')

        if (!response.ok) {
          throw new Error(`Failed to fetch sessions: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('Sessions fetched:', data.sessions)

        if (data.sessions && Array.isArray(data.sessions)) {
          // Story 4.19 AC3: Preserve activeSessionId if that session still exists
          // Capture current activeSessionId value at fetch time
          setSessions(() => {
            const currentActiveSession = activeSessionId
            const activeSessionStillExists = currentActiveSession &&
              data.sessions.some((s: Session) => s.id === currentActiveSession)

            // Story 4.19 AC3/AC4: Handle activeSessionId based on session availability
            if (data.sessions.length > 0) {
              if (activeSessionStillExists) {
                // Keep current active session
                console.log('Active session still exists, preserving:', currentActiveSession)
              } else if (currentActiveSession) {
                // Story 4.19 AC4: Active session no longer exists, switch to first available
                setActiveSessionId(data.sessions[0].id)
                console.log('Active session destroyed, switching to first available:', data.sessions[0].id)
              } else {
                // Initial load with no active session
                setActiveSessionId(data.sessions[0].id)
                console.log('Set active session to first session:', data.sessions[0].id)
              }
            } else {
              // Story 4.19 AC5: No sessions exist, clear active session (show EmptyState)
              setActiveSessionId(null)
              console.log('No sessions available, clearing active session')
            }

            return data.sessions
          })
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
        toast({
          type: 'error',
          title: 'Failed to load sessions',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    }

    // Story 4.16: Fetch sessions on initial connection
    // Story 4.19 AC1: Re-fetch sessions on WebSocket reconnection
    if (isConnected) {
      fetchSessions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  // Story 4.3: Listen for session.needsInput WebSocket messages
  useEffect(() => {
    const unsubscribe = on('session.needsInput', (message) => {
      console.log('Session needs input:', message)

      if (!message.sessionId || !message.message) {
        console.warn('Invalid session.needsInput message', message)
        return
      }

      // AC4.9: Only send notification for background sessions (not currently active)
      // AC4.7: Check if session is in the background (not visible)
      const isActiveSession = message.sessionId === activeSessionId
      const isPageFocused = document.hasFocus()

      // Skip notification if session is already visible to user
      if (isActiveSession && isPageFocused) {
        console.log('Session is active and page focused, skipping notification', { sessionId: message.sessionId })
        return
      }

      // Find session to get its name
      const session = sessions.find(s => s.id === message.sessionId)
      const sessionName = session?.name || 'Unknown'

      // Send browser notification with click handler to switch session
      sendNotification(
        message.sessionId,
        sessionName,
        message.message,
        () => {
          // AC4.8: Click handler focuses correct session
          console.log('Notification clicked, switching to session', { sessionId: message.sessionId })
          if (message.sessionId) {
            handleSelectSession(message.sessionId)
          }
        }
      )
    })
    return unsubscribe
  }, [on, activeSessionId, sessions, sendNotification, handleSelectSession])

  // Story 3.8: Track viewport width for percentage calculations
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Story 3.8: Convert pixel width to percentage for ResizablePanel
  const leftSidebarPercentage = (leftSidebarWidth / viewportWidth) * 100

  // Story 3.8: Handle left sidebar resize
  const handleLeftSidebarResize = useCallback((sizes: number[]) => {
    const [leftPercent] = sizes
    const newWidth = Math.round((leftPercent / 100) * viewportWidth)

    // Only update if significantly different (avoid tiny changes)
    if (Math.abs(newWidth - leftSidebarWidth) > 5) {
      setLeftSidebarWidth(newWidth)
    }
  }, [viewportWidth, leftSidebarWidth, setLeftSidebarWidth])

  // Story 3.8: Double-click handle to reset to default width
  const handleDoubleClick = useCallback(() => {
    setLeftSidebarWidth(DEFAULT_LEFT_SIDEBAR_WIDTH)
    // Programmatically resize the panel
    const defaultPercentage = (DEFAULT_LEFT_SIDEBAR_WIDTH / viewportWidth) * 100
    leftSidebarPanelRef.current?.resize(defaultPercentage)
  }, [setLeftSidebarWidth, viewportWidth])

  // Right sidebar: Calculate percentage based on the available width (viewport minus left sidebar)
  const availableWidthForRightPanel = viewportWidth - leftSidebarWidth
  const rightSidebarPercentage = (rightSidebarWidth / availableWidthForRightPanel) * 100

  // Right sidebar: Handle resize
  const handleRightSidebarResize = useCallback((sizes: number[]) => {
    // sizes[1] is the right panel's percentage of the inner panel group
    const rightPercent = sizes[1]
    const newWidth = Math.round((rightPercent / 100) * availableWidthForRightPanel)

    // Only update if significantly different (avoid tiny changes)
    if (Math.abs(newWidth - rightSidebarWidth) > 5) {
      setRightSidebarWidth(newWidth)
    }
  }, [availableWidthForRightPanel, rightSidebarWidth, setRightSidebarWidth])

  // Right sidebar: Double-click handle to reset to default width
  const handleRightSidebarDoubleClick = useCallback(() => {
    setRightSidebarWidth(DEFAULT_RIGHT_SIDEBAR_WIDTH)
    // Programmatically resize the panel
    const defaultPercentage = (DEFAULT_RIGHT_SIDEBAR_WIDTH / availableWidthForRightPanel) * 100
    rightSidebarPanelRef.current?.resize(defaultPercentage)
  }, [setRightSidebarWidth, availableWidthForRightPanel])

  // Right sidebar: Sync panel collapse state when toggle button is clicked
  useEffect(() => {
    if (isRightCollapsed) {
      rightSidebarPanelRef.current?.collapse()
    } else {
      rightSidebarPanelRef.current?.expand()
    }
  }, [isRightCollapsed])

  // Story 3.8: Keyboard resize (Ctrl+Arrow keys for 10px increments)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Ctrl+Arrow when not in input fields
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (event.ctrlKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()

        const increment = event.key === 'ArrowRight' ? 10 : -10
        const newWidth = leftSidebarWidth + increment

        // Respect min/max constraints
        if (newWidth >= MIN_LEFT_SIDEBAR_WIDTH && newWidth <= MAX_LEFT_SIDEBAR_WIDTH) {
          setLeftSidebarWidth(newWidth)
          // Update panel size
          const newPercentage = (newWidth / viewportWidth) * 100
          leftSidebarPanelRef.current?.resize(newPercentage)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [leftSidebarWidth, setLeftSidebarWidth, viewportWidth])

  // Handle session.destroyed WebSocket event
  const handleSessionDestroyedEvent = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const session = prev.find((s) => s.id === sessionId)
      const filtered = prev.filter((s) => s.id !== sessionId)

      // Story 4.17 AC3: If destroyed session was our active one, switch to first available
      if (sessionId === activeSessionId && filtered.length > 0) {
        setActiveSessionId(filtered[0].id)

        // Story 4.17 AC3: Show toast if WE didn't initiate the destroy (cross-tab scenario)
        // If destroyInProgress is true, we initiated it, so skip toast
        if (!destroyInProgress && session) {
          toast({
            title: 'Session closed',
            description: `Session '${session.name}' was closed in another tab.`,
          })
        }
      } else if (session && !destroyInProgress) {
        // Story 4.17 AC2: Inactive session destroyed - show basic notification
        toast({
          title: 'Session destroyed',
          description: `Session '${session.name}' has been destroyed.`,
        })
      }

      return filtered
    })
  }, [activeSessionId, destroyInProgress, toast])

  // Handle session destruction button click
  const handleDestroySession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      setSessionToDestroy(session)
      setDestroyDialogOpen(true)
    }
  }, [sessions])

  // Handle session destruction confirmation
  const handleConfirmDestroy = useCallback(async (cleanup: boolean) => {
    if (!sessionToDestroy) return

    setDestroyInProgress(true)

    try {
      const response = await fetch(`/api/sessions/${sessionToDestroy.id}?cleanup=${cleanup}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || 'Failed to destroy session')
      }

      // Close dialog
      setDestroyDialogOpen(false)
      setSessionToDestroy(null)

      // WebSocket will broadcast session.destroyed message
      // handleSessionDestroyedEvent will update UI
    } catch (error) {
      console.error('Failed to destroy session:', error)
      toast({
        type: 'error',
        title: 'Failed to destroy session',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setDestroyInProgress(false)
    }
  }, [sessionToDestroy, toast])

  // Handle destroy dialog close
  const handleDestroyDialogClose = useCallback(() => {
    if (!destroyInProgress) {
      setDestroyDialogOpen(false)
      setSessionToDestroy(null)
    }
  }, [destroyInProgress])

  // Handle opening create session modal (called from TopBar "+" button or EmptyState)
  const handleOpenCreateModal = useCallback(() => {
    setSessionModalOpen(true)
  }, [])

  // Compute active session name for TopBar display
  const activeSessionName = activeSessionId
    ? sessions.find(s => s.id === activeSessionId)?.name ?? null
    : null

  return (
    <AccessibilityAnnouncer>
          <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
          {/* Connection Status Banner */}
          <ConnectionBanner connectionStatus={connectionStatus} onRetry={retryConnection} />

          {/* Story 3.10: Notification Permission Banner */}
          <NotificationBanner />

          {/* Story 3.10: Show EmptyState when no sessions exist, otherwise show main layout */}
          {sessions.length === 0 ? (
            <>
              {/* Story 3.9: Top Bar (always visible for branding and consistency) */}
              <TopBar
                activeSessionId={activeSessionId}
                activeSessionName={activeSessionName}
                repoName={repoName}
                isConnected={isConnected}
                onSessionCreated={handleSessionCreated}
                onInterrupt={handleInterrupt}
                resourceWarning={resourceWarning}
              />

              {/* Story 3.10: Empty State for first-time users */}
              <EmptyState onCreateSession={handleOpenCreateModal} />

              {/* Story 2.3: Session Creation Modal */}
              <SessionModal
                open={sessionModalOpen}
                onOpenChange={setSessionModalOpen}
                onSessionCreated={handleSessionCreated}
              />
            </>
          ) : (
            <>
              {/* Story 3.9: Top Bar with Logo, Actions, and Settings */}
              <TopBar
                activeSessionId={activeSessionId}
                activeSessionName={activeSessionName}
                repoName={repoName}
                isConnected={isConnected}
                onSessionCreated={handleSessionCreated}
                onInterrupt={handleInterrupt}
                resourceWarning={resourceWarning}
              />

              {/* Main Content Area - Left Sidebar, Main Content (Terminal/Artifacts), Right Sidebar */}
              {/* Story 3.8: Resizable panels for left sidebar */}
              <main className="flex flex-1 overflow-hidden bg-background">
                <ResizablePanelGroup
                  direction="horizontal"
                  onLayout={handleLeftSidebarResize}
                  className="flex-1"
                >
                  {/* Story 3.3/3.8: Left Sidebar with Files/Workflow Toggle (Resizable) */}
                  <ResizablePanel
                    ref={leftSidebarPanelRef}
                    defaultSize={leftSidebarPercentage}
                    minSize={(MIN_LEFT_SIDEBAR_WIDTH / viewportWidth) * 100}
                    maxSize={(MAX_LEFT_SIDEBAR_WIDTH / viewportWidth) * 100}
                    collapsible={false}
                    className="transition-all duration-300 ease-out"
                  >
                    <LeftSidebar activeSessionId={activeSessionId} ws={ws} />
                  </ResizablePanel>

                  {/* Story 3.8: Resize Handle with visual feedback */}
                  {!isLeftCollapsed && (
                    <ResizableHandle
                      onDoubleClick={handleDoubleClick}
                      className="w-1 bg-border hover:bg-[#88C0D0] transition-colors duration-200 cursor-col-resize relative group"
                      title="Drag to resize, double-click to reset to 280px, or use Ctrl+Arrow keys"
                    />
                  )}

                  {/* Story 3.6: Main Content Area with Terminal and Artifact Viewer */}
                  <ResizablePanel defaultSize={100 - leftSidebarPercentage} minSize={30} className="overflow-hidden">
                    {/* Nested horizontal panel group for main content and right sidebar */}
                    <ResizablePanelGroup
                      direction="horizontal"
                      className="h-full w-full"
                      onLayout={handleRightSidebarResize}
                    >
                      {/* Main Content */}
                      <ResizablePanel defaultSize={100 - rightSidebarPercentage} minSize={50}>
                        {activeSessionId && (
                          <div className="h-full overflow-hidden">
                            <MainContentArea sessionId={activeSessionId} ws={ws} />
                          </div>
                        )}
                      </ResizablePanel>

                      {/* Resizable Handle for right sidebar (hidden when collapsed) */}
                      {!isRightCollapsed && (
                        <ResizableHandle
                          onDoubleClick={handleRightSidebarDoubleClick}
                          className="w-1 bg-border hover:bg-[#88C0D0] transition-colors duration-200 cursor-col-resize"
                          title="Drag to resize, double-click to reset to 220px"
                        />
                      )}

                      {/* Story 2.4: Session List Sidebar (Right) - Resizable with explicit pixel widths */}
                      <ResizablePanel
                        ref={rightSidebarPanelRef}
                        defaultSize={isRightCollapsed
                          ? (COLLAPSED_WIDTH / availableWidthForRightPanel) * 100
                          : rightSidebarPercentage}
                        minSize={isRightCollapsed
                          ? (COLLAPSED_WIDTH / availableWidthForRightPanel) * 100
                          : (MIN_RIGHT_SIDEBAR_WIDTH / availableWidthForRightPanel) * 100}
                        maxSize={(MAX_RIGHT_SIDEBAR_WIDTH / availableWidthForRightPanel) * 100}
                        collapsible={true}
                        collapsedSize={(COLLAPSED_WIDTH / availableWidthForRightPanel) * 100}
                        onCollapse={() => setIsRightCollapsed(true)}
                        onExpand={() => setIsRightCollapsed(false)}
                        className="overflow-hidden transition-all duration-300 ease-out"
                      >
                        <SessionList
                          sessions={sessions}
                          activeSessionId={activeSessionId}
                          onSessionSelect={handleSelectSession}
                          onDestroySession={handleDestroySession}
                          isCollapsed={isRightCollapsed}
                          onToggleCollapse={toggleRightSidebarCollapse}
                          onNewSession={() => setSessionModalOpen(true)}
                        />
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </main>
            </>
          )}

          {/* Story 2.7: Session Destruction Dialog */}
          {/* Story 4.18: Pass session status for active session warning */}
          {sessionToDestroy && (
            <SessionDestroyDialog
              sessionId={sessionToDestroy.id}
              sessionName={sessionToDestroy.name}
              sessionStatus={sessionToDestroy.status}
              isOpen={destroyDialogOpen}
              onClose={handleDestroyDialogClose}
              onConfirm={handleConfirmDestroy}
              isLoading={destroyInProgress}
            />
          )}

          {/* Toast notifications */}
          <Toaster />
        </div>
    </AccessibilityAnnouncer>
    )
}

/**
 * Main App wrapper with Context providers
 */
function App() {
  return (
    <NotificationProvider>
      <LayoutProvider>
        <WorkflowProvider>
          <SprintProvider>
            <AppContent />
          </SprintProvider>
        </WorkflowProvider>
      </LayoutProvider>
    </NotificationProvider>
  )
}

export default App
