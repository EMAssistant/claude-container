# Story 4-19: WebSocket Reconnection Session Sync

## User Story

**As a** Claude Container user whose browser lost connection temporarily
**I want** my session list to automatically resync when the connection is restored
**So that** I don't miss any session changes that occurred while disconnected

## Background

The WebSocket connection can drop due to:
- Network interruptions
- Laptop sleep/wake
- Container restart
- Server-side timeout

Currently, `useWebSocket.ts` handles reconnection and re-attaches to previously attached sessions. However, if sessions were created or destroyed during the disconnection window, the frontend will have stale data until the user manually refreshes.

## Acceptance Criteria

```gherkin
AC1: Re-fetch Sessions on Reconnect
  GIVEN the WebSocket connection was lost
  WHEN connection is re-established
  THEN automatically fetch GET /api/sessions
  AND update the local sessions state with server state

AC2: Handle New Sessions During Disconnect
  GIVEN Tab was disconnected for 60 seconds
  AND another tab created 2 new sessions during that time
  WHEN Tab reconnects
  THEN both new sessions appear in the list

AC3: Handle Destroyed Sessions During Disconnect
  GIVEN Tab was disconnected
  AND Tab had Session X as active
  AND Session X was destroyed by another tab during disconnect
  WHEN Tab reconnects
  THEN Session X is removed from list
  AND Tab switches to next available session
  AND shows toast "Session 'X' was closed while disconnected"

AC4: No Duplicates After Resync
  GIVEN Tab has sessions [A, B, C]
  WHEN Tab reconnects and fetches sessions [A, B, C]
  THEN list still shows [A, B, C] (no duplicates)

AC5: Preserve Active Session Selection
  GIVEN Tab has Session B as active
  AND Session B still exists on server
  WHEN Tab reconnects
  THEN Session B remains active
  AND terminal view is preserved
```

## Technical Implementation

### Frontend Changes

**File**: `frontend/src/App.tsx`

Add resync on WebSocket reconnect:

```typescript
// Track connection state to detect reconnects
const prevConnectedRef = useRef(isConnected);

useEffect(() => {
  // Detect reconnection (was disconnected, now connected)
  if (isConnected && !prevConnectedRef.current) {
    console.log('WebSocket reconnected, resyncing sessions...');
    resyncSessions();
  }
  prevConnectedRef.current = isConnected;
}, [isConnected]);

const resyncSessions = async () => {
  try {
    const response = await fetch('/api/sessions');
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await response.json();
    const serverSessions: Session[] = data.sessions || [];

    setSessions(prev => {
      // Find sessions that no longer exist on server
      const removedIds = prev
        .filter(local => !serverSessions.some(server => server.id === local.id))
        .map(s => s.id);

      // Check if active session was removed
      if (activeSessionId && removedIds.includes(activeSessionId)) {
        const remaining = serverSessions.filter(s => !removedIds.includes(s.id));
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        }
        toast({
          type: 'info',
          title: 'Session closed',
          description: 'Your active session was closed while disconnected.',
        });
      }

      return serverSessions;
    });

    console.log('Session resync complete', { count: serverSessions.length });
  } catch (error) {
    console.error('Failed to resync sessions:', error);
    toast({
      type: 'error',
      title: 'Sync failed',
      description: 'Could not refresh session list. Please reload the page.',
    });
  }
};
```

**File**: `frontend/src/hooks/useWebSocket.ts`

Optionally expose a `reconnectCount` or emit an event:

```typescript
// Add to return value
return {
  // ... existing
  reconnectCount: reconnectAttemptRef.current,
  onReconnect: (callback: () => void) => {
    // Register callback to fire on successful reconnect
  }
};
```

Alternative: Use existing `isConnected` state transition in App.tsx (simpler).

## Files to Modify

- `frontend/src/App.tsx` - Add reconnect detection + resync logic

## Estimated Effort

1-2 hours

## Dependencies

- Story 4-16 (Session List Hydration) - provides GET /api/sessions endpoint

## Test Scenarios

1. Normal reconnect, no changes - session list unchanged
2. Reconnect after session created elsewhere - new session appears
3. Reconnect after active session destroyed - switches to another + toast
4. Reconnect after all sessions destroyed - shows EmptyState
5. Reconnect fails to fetch - shows error toast, doesn't break UI

## Edge Cases

- **Rapid reconnects**: Debounce resync to avoid multiple fetches
- **Concurrent resync + WebSocket update**: Use server response as source of truth
- **activeSessionId refers to destroyed session**: Handle gracefully, don't crash
