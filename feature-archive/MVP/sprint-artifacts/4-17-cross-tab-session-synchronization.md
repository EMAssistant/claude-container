# Story 4-17: Cross-Tab Session Synchronization

## User Story

**As a** Claude Container user with multiple browser tabs open
**I want** session changes in one tab to reflect in all other tabs
**So that** I have a consistent view of my workspace regardless of which tab I'm using

## Background

The container maintains the source of truth for sessions. Multiple browser tabs are simply views into that shared state. Currently:
- WebSocket broadcasts exist but `session.created` isn't handled in App.tsx
- If Tab A creates a session, Tab B doesn't see it until refresh
- If Tab A destroys a session that Tab B has active, Tab B may break

## Acceptance Criteria

```gherkin
AC1: Cross-Tab Session Creation (Silent Add)
  GIVEN Tab A and Tab B are both open
  WHEN Tab A creates a new session
  THEN Tab B receives session.created via WebSocket
  AND Tab B adds the session to its list
  AND Tab B does NOT switch activeSessionId (silent add)

AC2: Cross-Tab Session Destruction (Inactive Session)
  GIVEN Tab A and Tab B are open
  AND Tab B has Session Y as active
  WHEN Tab A destroys Session X (not Y)
  THEN Tab B removes Session X from its list
  AND Tab B keeps Session Y as active
  AND no toast or interruption in Tab B

AC3: Cross-Tab Session Destruction (Active Session)
  GIVEN Tab B has Session X as active
  WHEN Tab A destroys Session X
  THEN Tab B receives session.destroyed via WebSocket
  AND Tab B removes Session X from list
  AND Tab B switches to next available session (sessions[0])
  AND Tab B shows toast "Session 'X' was closed in another tab"

AC4: Cross-Tab Session Status Updates
  GIVEN Tab A and Tab B both show Session X
  WHEN Session X status changes (idle → active → waiting)
  THEN both tabs reflect the updated status
  AND attention badges update accordingly

AC5: No Active Session Hijacking
  GIVEN Tab A creates a new session
  WHEN Tab B receives session.created
  THEN Tab B's activeSessionId remains unchanged
  AND Tab B's terminal view is not interrupted
```

## Technical Implementation

### Backend Changes

**File**: `backend/src/server.ts`

Verify broadcasts include full session data:

```typescript
// On session creation, broadcast to ALL clients
wss.clients.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'session.created',
      session: newSession  // Full session object
    }));
  }
});

// On session destruction
wss.clients.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'session.destroyed',
      sessionId: destroyedSessionId
    }));
  }
});

// On session status update
wss.clients.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'session.updated',
      session: updatedSession  // Full session object
    }));
  }
});
```

### Frontend Changes

**File**: `frontend/src/App.tsx`

```typescript
// Add session.created listener
useEffect(() => {
  const unsubscribe = on('session.created', (message) => {
    if (message.session) {
      setSessions(prev => {
        // Avoid duplicates (in case we created it ourselves)
        if (prev.some(s => s.id === message.session.id)) {
          return prev;
        }
        return [...prev, message.session];
      });
      // Note: Do NOT change activeSessionId - silent add
    }
  });
  return unsubscribe;
}, [on]);

// Update session.destroyed listener for cross-tab awareness
useEffect(() => {
  const unsubscribe = on('session.destroyed', (message) => {
    if (message.sessionId) {
      const destroyedId = message.sessionId;

      setSessions(prev => {
        const wasActive = destroyedId === activeSessionId;
        const filtered = prev.filter(s => s.id !== destroyedId);

        // If destroyed session was our active one, switch
        if (wasActive && filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
          // Only show toast if WE didn't initiate the destroy
          if (!destroyInProgress) {
            toast({
              type: 'info',
              title: 'Session closed',
              description: `Session was closed in another tab.`,
            });
          }
        }

        return filtered;
      });
    }
  });
  return unsubscribe;
}, [on, activeSessionId, destroyInProgress]);

// Add session.updated listener
useEffect(() => {
  const unsubscribe = on('session.updated', (message) => {
    if (message.session) {
      setSessions(prev =>
        prev.map(s => s.id === message.session.id ? message.session : s)
      );
    }
  });
  return unsubscribe;
}, [on]);
```

### WebSocket Message Types

**File**: `frontend/src/hooks/useWebSocket.ts`

Add to WebSocketMessage interface:

```typescript
export interface WebSocketMessage {
  // ... existing fields
  session?: Session;  // For session.created, session.updated
}
```

## Files to Modify

- `backend/src/server.ts` - Ensure broadcasts include full session data
- `frontend/src/App.tsx` - Add session.created, session.updated listeners
- `frontend/src/hooks/useWebSocket.ts` - Extend message type
- `frontend/src/types.ts` - Ensure Session type is complete

## Estimated Effort

2-3 hours

## Dependencies

- Story 4-16 (Session List Hydration) - shares the session list infrastructure

## Test Scenarios

1. Tab A creates session - Tab B list updates, Tab B stays on current session
2. Tab A destroys Tab B's active session - Tab B switches + shows toast
3. Tab A destroys inactive session - Tab B removes from list silently
4. Rapid creates/destroys - both tabs stay consistent
5. Session status change - both tabs show updated status
