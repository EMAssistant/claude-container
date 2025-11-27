# Story 4-18: Active Session Destroy Protection

## User Story

**As a** Claude Container user
**I want** to be prevented from destroying a session while Claude is actively working
**So that** I don't accidentally corrupt files or lose work in progress

## Background

Currently, users can destroy any session regardless of its state. If Claude CLI is mid-operation (writing files, running commands, streaming a response), destroying the session could:
- Corrupt partially-written files
- Leave git in a broken state
- Lose unsaved work or context

The session `status` field already tracks: `active`, `idle`, `waiting`, `error`, `stopped`. We need to use this to guard the destroy operation.

## Acceptance Criteria

```gherkin
AC1: Backend Rejects Destroying Active Sessions
  GIVEN a session with status 'active'
  WHEN DELETE /api/sessions/:id is called (without force flag)
  THEN return 409 Conflict
  AND body contains { error: 'SESSION_BUSY', message: 'Cannot destroy session while Claude is working.' }

AC2: Backend Allows Force Destroy
  GIVEN a session with status 'active'
  WHEN DELETE /api/sessions/:id?force=true is called
  THEN destroy the session regardless of status
  AND return 200 success

AC3: Dialog Shows Warning for Active Sessions
  GIVEN user clicks destroy on a session with status 'active'
  WHEN SessionDestroyDialog opens
  THEN display warning icon (yellow/orange)
  AND show message "Claude is currently working in this session"
  AND show subtext "Destroying now may corrupt files or lose progress."
  AND show three buttons: [Cancel] [Interrupt First] [Force Destroy]

AC4: Dialog Shows Normal Flow for Non-Active Sessions
  GIVEN user clicks destroy on a session with status 'idle', 'waiting', or 'error'
  WHEN SessionDestroyDialog opens
  THEN display standard confirmation without warning
  AND show two buttons: [Cancel] [Destroy]

AC5: Interrupt-Then-Destroy Flow
  GIVEN user clicks "Interrupt First" button
  WHEN clicked
  THEN send SIGINT to session via WebSocket
  AND show spinner with "Interrupting Claude..."
  AND poll/listen for session status change (max 10 seconds)
  WHEN session status becomes 'idle' or 'waiting'
  THEN automatically proceed with destroy operation

AC6: Interrupt Timeout Handling
  GIVEN "Interrupt First" was clicked
  WHEN 10 seconds pass without session becoming idle
  THEN show message "Session didn't respond to interrupt"
  AND change button to "Force Destroy" (enabled)
  AND show warning "Claude may be stuck. Force destroy will terminate the process."

AC7: Force Destroy Confirmation
  GIVEN user clicks "Force Destroy" on an active session
  WHEN clicked
  THEN show secondary confirmation: "This may corrupt files. Continue?"
  AND require explicit "Yes, Force Destroy" click
  WHEN confirmed
  THEN call DELETE /api/sessions/:id?force=true

AC8: Real-time Status Updates in Dialog
  GIVEN SessionDestroyDialog is open for an active session
  WHEN session status changes via WebSocket (e.g., active → idle)
  THEN dialog updates to reflect new status
  AND if status becomes non-active, switch to normal destroy flow
  AND hide warning, show standard [Cancel] [Destroy] buttons

AC9: Force Destroy Button Styling
  GIVEN "Force Destroy" button is displayed
  THEN style as destructive-outline (red border, red text)
  AND visually de-emphasize compared to "Interrupt First"
```

## Technical Implementation

### Backend Changes

**File**: `backend/src/server.ts`

```typescript
app.delete('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const force = req.query.force === 'true';
  const cleanup = req.query.cleanup === 'true';

  try {
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Guard against destroying active sessions (unless forced)
    if (session.status === 'active' && !force) {
      return res.status(409).json({
        error: 'SESSION_BUSY',
        message: 'Cannot destroy session while Claude is working. Use interrupt first or force=true to override.',
        sessionStatus: session.status
      });
    }

    // Proceed with destruction
    await sessionManager.destroySession(sessionId, { cleanup, force });

    // Broadcast to all clients
    broadcastToAll({
      type: 'session.destroyed',
      sessionId
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to destroy session', { sessionId, error });
    res.status(500).json({ error: 'Failed to destroy session' });
  }
});
```

### Frontend Changes

**File**: `frontend/src/components/SessionDestroyDialog.tsx`

```typescript
export interface SessionDestroyDialogProps {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;  // NEW: Pass current status
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cleanup: boolean, force?: boolean) => void;
  onInterrupt: () => void;  // NEW: Interrupt handler
  isLoading: boolean;
}

export function SessionDestroyDialog({
  sessionId,
  sessionName,
  sessionStatus,
  isOpen,
  onClose,
  onConfirm,
  onInterrupt,
  isLoading,
}: SessionDestroyDialogProps) {
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [interruptTimeout, setInterruptTimeout] = useState(false);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);

  const isActive = sessionStatus === 'active';

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsInterrupting(false);
      setInterruptTimeout(false);
      setForceConfirmOpen(false);
    }
  }, [isOpen]);

  // Watch for status change during interrupt
  useEffect(() => {
    if (isInterrupting && sessionStatus !== 'active') {
      // Session stopped, proceed with destroy
      setIsInterrupting(false);
      onConfirm(false, false);
    }
  }, [sessionStatus, isInterrupting, onConfirm]);

  // Interrupt timeout handler
  useEffect(() => {
    if (isInterrupting) {
      const timer = setTimeout(() => {
        setIsInterrupting(false);
        setInterruptTimeout(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isInterrupting]);

  const handleInterruptFirst = () => {
    setIsInterrupting(true);
    onInterrupt();
  };

  const handleForceDestroy = () => {
    setForceConfirmOpen(true);
  };

  const handleForceConfirm = () => {
    onConfirm(false, true);  // force=true
  };

  // ... render logic with conditional UI
}
```

**File**: `frontend/src/App.tsx`

Update SessionDestroyDialog usage:

```typescript
<SessionDestroyDialog
  sessionId={sessionToDestroy.id}
  sessionName={sessionToDestroy.name}
  sessionStatus={sessionToDestroy.status}  // NEW
  isOpen={destroyDialogOpen}
  onClose={handleDestroyDialogClose}
  onConfirm={handleConfirmDestroy}
  onInterrupt={() => sendInterrupt(sessionToDestroy.id)}  // NEW
  isLoading={destroyInProgress}
/>
```

Update handleConfirmDestroy:

```typescript
const handleConfirmDestroy = useCallback(async (cleanup: boolean, force: boolean = false) => {
  if (!sessionToDestroy) return;

  setDestroyInProgress(true);

  try {
    const url = `/api/sessions/${sessionToDestroy.id}?cleanup=${cleanup}${force ? '&force=true' : ''}`;
    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error === 'SESSION_BUSY') {
        // This shouldn't happen if UI is correct, but handle gracefully
        toast({
          type: 'warning',
          title: 'Session is busy',
          description: 'Use "Interrupt First" or "Force Destroy".',
        });
        return;
      }
      throw new Error(errorData.message || 'Failed to destroy session');
    }

    // Success handling...
  } catch (error) {
    // Error handling...
  } finally {
    setDestroyInProgress(false);
  }
}, [sessionToDestroy, toast]);
```

## Files to Modify

- `backend/src/server.ts` - Add status guard to DELETE endpoint
- `frontend/src/components/SessionDestroyDialog.tsx` - Add warning UI + interrupt flow
- `frontend/src/App.tsx` - Pass status + interrupt handler to dialog

## Estimated Effort

3-4 hours

## Dependencies

None (can be implemented in parallel with 4-16, 4-17)

## Test Scenarios

1. Destroy idle session - normal flow, no warning
2. Destroy active session - warning shown, normal destroy blocked
3. Interrupt active session - wait for idle, then auto-destroy
4. Interrupt timeout - force destroy button enabled after 10s
5. Force destroy - secondary confirmation required
6. Session becomes idle while dialog open - UI updates to normal flow
7. API returns SESSION_BUSY - UI shows appropriate message

## UI Mockup

### Active Session Warning State

```
┌─────────────────────────────────────────────────┐
│  ⚠️  Destroy Session                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Claude is currently working in this session    │
│                                                 │
│  Destroying now may corrupt files or lose       │
│  work in progress.                              │
│                                                 │
│  Session: feature-2025-11-26-001                │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Cancel]  [Interrupt First]  [Force Destroy]   │
│                               (red outline)     │
└─────────────────────────────────────────────────┘
```

### Interrupting State

```
┌─────────────────────────────────────────────────┐
│  ⏳ Interrupting...                             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Sending interrupt signal to Claude...          │
│  Waiting for session to stop.                   │
│                                                 │
│  ◐ (spinner)                                    │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Cancel]                                       │
└─────────────────────────────────────────────────┘
```
