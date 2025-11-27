# Story 4.3: Browser Notifications When Claude Asks Questions

Status: drafted

## Story

As a developer running multiple parallel Claude sessions,
I want browser notifications when background sessions need my input,
so that I can respond promptly without constantly monitoring inactive tabs.

## Acceptance Criteria

1. **AC4.7**: Browser notification sent for background sessions
   - Given: A background (inactive) session detects 'waiting' status (question ending with "?")
   - When: The backend sends a `session.needsInput` WebSocket message
   - Then: A browser notification appears with session name and "needs input" message
   - And: No notification is sent if the session is currently active (already visible)

2. **AC4.8**: Notification click focuses correct session
   - Given: A browser notification is displayed for a background session
   - When: The user clicks the notification
   - Then: The browser window is brought to focus (`window.focus()`)
   - And: The session is switched to active (`switchSession(sessionId)`)
   - And: The terminal scrolls to the bottom to show the question

3. **AC4.9**: No notification for active session
   - Given: The currently active session detects 'waiting' status
   - When: The backend sends a `session.needsInput` message
   - Then: No browser notification is sent (the question is already visible)
   - And: The session badge updates to 'waiting' status (Story 4.2)

4. **Notification permission check**
   - Given: A background session needs input
   - When: The notification is about to be sent
   - Then: Permission state is checked first
   - And: If `Notification.permission !== 'granted'`, notification is skipped (badge-only mode)

5. **Notification content follows security best practices**
   - Given: A notification is sent
   - When: The notification is displayed
   - Then: Title is "Session [name] needs input"
   - And: Body text is generic: "Claude is asking a question"
   - And: No terminal output or sensitive data is included in notification

6. **Notification uses session-scoped tag**
   - Given: Multiple notifications could be sent for the same session
   - When: A new notification is created
   - Then: Notification tag is set to `sessionId` (prevents duplicate notifications)
   - And: Previous notification for same session is automatically replaced

7. **Frontend unit tests**: Notification logic tested
   - Test: `useNotifications.ts` - sendNotification() only for background sessions
   - Test: Active session detection (currentSessionId check)
   - Test: Permission check before sending
   - Test: Notification click handler switches session
   - Coverage: ≥50% for notification-related hooks

## Tasks / Subtasks

- [ ] Task 1: Extend backend to send session.needsInput messages (AC: #1)
  - [ ] Review session status tracking from Story 4.1 (waiting detection logic)
  - [ ] Modify `backend/src/sessionManager.ts` or `backend/src/server.ts`
  - [ ] When session status changes to 'waiting', send WebSocket message:
    - Type: `session.needsInput`
    - Payload: `{ sessionId, message: "Claude is asking a question" }`
  - [ ] Add unit test for WebSocket message sending on 'waiting' status

- [ ] Task 2: Implement sendNotification() function in NotificationContext (AC: #1, #4, #5, #6)
  - [ ] Extend `frontend/src/context/NotificationContext.tsx` (from Epic 3 Story 3.11)
  - [ ] Add `sendNotification(sessionId: string, message: string)` function to context
  - [ ] Check `Notification.permission === 'granted'` before sending
  - [ ] Create notification with:
    - Title: `Session ${sessionName} needs input`
    - Body: `message` (generic text, no terminal output)
    - Tag: `sessionId` (prevent duplicates)
    - Icon: Optional (Claude logo or default)
  - [ ] Return early if permission not granted (graceful degradation)
  - [ ] Add unit tests for permission checks and notification creation

- [ ] Task 3: Filter notifications for background sessions only (AC: #9)
  - [ ] In NotificationContext or consumer hook, check if `sessionId === currentSessionId`
  - [ ] Only call `sendNotification()` if session is NOT active
  - [ ] Active session questions should only update badge (Story 4.2)
  - [ ] Add unit test: Mock active session → verify no notification sent

- [ ] Task 4: Handle session.needsInput WebSocket messages (AC: #1, #3)
  - [ ] Modify `frontend/src/hooks/useWebSocket.ts` (from Epic 1)
  - [ ] Add handler for `session.needsInput` message type
  - [ ] Extract `sessionId` and `message` from WebSocket payload
  - [ ] Call `sendNotification(sessionId, message)` from NotificationContext
  - [ ] Add integration test: Simulate WebSocket message → verify notification

- [ ] Task 5: Implement notification click handler (AC: #2)
  - [ ] In `sendNotification()`, set notification.onclick:
    - `window.focus()` - bring browser window to foreground
    - `switchSession(sessionId)` - activate the session
    - `scrollTerminalToBottom()` - ensure question is visible (optional)
  - [ ] Ensure notification.onclick has access to SessionContext methods
  - [ ] Add unit test for click handler (mock switchSession, verify called)

- [ ] Task 6: Add scrollTerminalToBottom() utility (optional, AC: #2)
  - [ ] If not already available, add helper in Terminal component
  - [ ] Expose via SessionContext or imperative handle
  - [ ] Call from notification click handler
  - [ ] Test: Verify terminal scrolls to end after click

- [ ] Task 7: Write comprehensive unit tests (AC: #7)
  - [ ] `NotificationContext.test.tsx`: sendNotification() logic
  - [ ] `useWebSocket.test.ts`: session.needsInput message handling
  - [ ] Test permission states: granted, denied, default
  - [ ] Test active vs. background session filtering
  - [ ] Test notification tag prevents duplicates (mock Notification API)
  - [ ] Verify ≥50% frontend coverage for notification code

- [ ] Task 8: Update WebSocket protocol documentation
  - [ ] Add `session.needsInput` message type to `docs/websocket-protocol.md`
  - [ ] Document message schema: `{ type, sessionId, message }`
  - [ ] Note when message is sent (waiting status detected)
  - [ ] Add example to protocol docs

- [ ] Task 9: Test notification behavior across browsers
  - [ ] Manual test: Chrome, Firefox, Safari (macOS)
  - [ ] Verify notification appearance, click behavior
  - [ ] Test permission denied state (graceful degradation)
  - [ ] Test notification replacement (same session, multiple questions)

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**WebSocket Message Type (new)**:
```typescript
// Server → Client: Background session needs input
{
  type: 'session.needsInput',
  sessionId: string,
  message: string  // "Claude is asking a question"
}
```

**Notification Flow (from Tech Spec)**:
```
1. Session status changes to 'waiting' (detected question)
   ↓
2. Backend sends: { type: 'session.needsInput', sessionId, message }
   ↓
3. Frontend checks:
   ├─ Is this session currently active? → Skip notification
   └─ Is Notification.permission === 'granted'?
       ├─ No → Show badge only
       └─ Yes → new Notification('Session X needs input', { body, icon, tag: sessionId })
   ↓
4. User clicks notification
   ↓
5. notification.onclick:
   ├─ window.focus()
   ├─ switchSession(sessionId)
   └─ scrollTerminalToBottom()
```

**Security Best Practices (Tech Spec AC4.9)**:
- No terminal output in notification body (privacy, security)
- Generic message: "Claude is asking a question"
- Session name only (no branch names, file paths, etc.)
- Notification tag scoped to sessionId (prevent info leakage across sessions)

**From Architecture (docs/architecture.md)**:

**Browser Notification API Integration**:
- `Notification.permission` states: 'default', 'granted', 'denied'
- Permission handled by Epic 3 Story 3.11 (NotificationContext)
- Graceful degradation: Badge-only if permission not granted

**NotificationContext (from Epic 3)**:
- Created in Story 3.11 as preparation for Epic 4
- Provides `permissionGranted` boolean (from `useNotificationPermission` hook)
- This story extends context with `sendNotification()` function

**WebSocket Protocol (ADR-013)**:
- Message format: `resource.action` convention
- `session.needsInput` follows established pattern
- Document in `docs/websocket-protocol.md`

### Project Structure Notes

**Files to Modify:**
```
backend/src/
├── server.ts                       # Add session.needsInput WebSocket send logic
└── sessionManager.ts               # (or wherever waiting detection lives - Story 4.1)

frontend/src/
├── context/NotificationContext.tsx # Add sendNotification() function
├── hooks/useWebSocket.ts           # Add session.needsInput message handler
└── components/Terminal.tsx         # Optional: Add scrollTerminalToBottom() helper
```

**Files to Create:**
```
frontend/src/
├── context/NotificationContext.test.tsx  # Unit tests for sendNotification()
└── hooks/useNotifications.test.ts        # Optional: Separate hook tests
```

**Files to Update:**
```
docs/
└── websocket-protocol.md           # Document session.needsInput message type
```

**No New Dependencies:**
- Browser Notification API is native (no npm package required)
- NotificationContext already created in Epic 3
- useWebSocket hook already exists (Epic 1)

### Implementation Guidance

**sendNotification() Function Pattern:**
```typescript
// In NotificationContext.tsx
import { useContext } from 'react';
import { SessionContext } from './SessionContext';

export function NotificationProvider({ children }) {
  const { sessions, currentSessionId, switchSession } = useContext(SessionContext);
  const { permissionGranted } = useNotificationPermission();

  const sendNotification = (sessionId: string, message: string) => {
    // Filter: Only for background sessions
    if (sessionId === currentSessionId) {
      return; // Active session - question already visible
    }

    // Permission check
    if (!permissionGranted || Notification.permission !== 'granted') {
      console.log('Notification permission not granted, skipping notification');
      return; // Graceful degradation - badge-only mode
    }

    // Get session name for title
    const session = sessions.find(s => s.id === sessionId);
    const sessionName = session?.name || 'Unknown';

    // Create notification
    const notification = new Notification(`Session ${sessionName} needs input`, {
      body: message,
      tag: sessionId,  // Prevent duplicates
      icon: '/claude-icon.png',  // Optional
      requireInteraction: false  // Auto-dismiss after OS default
    });

    // Click handler: Focus session
    notification.onclick = () => {
      window.focus();
      switchSession(sessionId);
      // Optional: scrollTerminalToBottom()
      notification.close();
    };
  };

  return (
    <NotificationContext.Provider value={{ permissionGranted, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}
```

**WebSocket Message Handler Pattern:**
```typescript
// In useWebSocket.ts
useEffect(() => {
  const ws = new WebSocket(url);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case 'session.needsInput':
        // Call sendNotification from NotificationContext
        sendNotification(message.sessionId, message.message);
        break;

      // ... other message handlers
    }
  };

  return () => ws.close();
}, [url, sendNotification]);
```

**Backend WebSocket Send Pattern:**
```typescript
// In sessionManager.ts or server.ts
function onSessionStatusChange(sessionId: string, newStatus: string) {
  // When status changes to 'waiting', send needsInput message
  if (newStatus === 'waiting') {
    const message = {
      type: 'session.needsInput',
      sessionId,
      message: 'Claude is asking a question'
    };

    // Broadcast to all connected clients (or specific client)
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Also send general status update
  // ... existing session.status WebSocket send logic
}
```

**Testing Considerations:**
- Mock Notification API (not available in Node.js test environment)
- Mock `window.focus()` for click handler tests
- Use `jest.spyOn(window, 'Notification')` to verify notification creation
- Test permission states: Mock `Notification.permission` getter
- Integration test: Mock WebSocket message → verify sendNotification called

**Browser Compatibility:**
- Notification API supported in Chrome, Firefox, Safari, Edge
- Safari requires user interaction before requesting permission (Epic 3 handled this)
- Permission state persists across browser sessions
- Test on macOS (primary target platform)

### Learnings from Previous Story

**From Story 4-2 (Session Attention Badges and Prioritization)**

**Status**: drafted

**New Infrastructure Created:**
- **AttentionBadge component** at `frontend/src/components/AttentionBadge.tsx`:
  - Priority calculation: `error > stuck > waiting > active > idle`
  - Tooltip with relative time formatting
  - Oceanic Calm color mapping: error (#BF616A), stuck (#EBCB8B), waiting (#88C0D0)
- **Session sorting** in SessionList by priority + lastActivity
- **Badge rendering** in both SessionList and session tabs

**Integration Points for This Story:**
- **Waiting status detection** already implemented in Story 4.1 (session status tracking)
  - Backend detects PTY output ending with "?" → sets status to 'waiting'
  - `session.status` WebSocket message sent with `status: 'waiting'`
- **session.needsInput** is a NEW message type (not implemented yet)
  - Similar to `session.status` but specifically for notifications
  - Triggers browser notification for background sessions

**Patterns to Follow:**
- **WebSocket message handling**: Follow existing pattern in `useWebSocket.ts`
- **Context API usage**: Extend NotificationContext (created in Epic 3 Story 3.11)
- **Status-based logic**: Use session.status === 'waiting' as trigger condition
- **Oceanic Calm theme**: Notification styling should align with badge colors (if customizable)

**Technical Decisions from Story 4.1-4.2:**
1. Session status field extended to include 'waiting' state (Story 4.1)
2. WebSocket message types use `resource.action` naming convention (ADR-013)
3. Status changes broadcast via WebSocket immediately (no polling)
4. Frontend state updates trigger component re-renders automatically

**Files to Be Aware Of:**
- `frontend/src/context/NotificationContext.tsx` - Created in Epic 3, provides `permissionGranted`
- `frontend/src/hooks/useNotificationPermission.ts` - Permission hook from Epic 3
- `frontend/src/hooks/useWebSocket.ts` - WebSocket message handling
- `backend/src/types.ts` - Session interface with status field
- `docs/websocket-protocol.md` - Protocol documentation (update with session.needsInput)

**Differences from Previous Story:**
- Story 4.2 focused on **visual badges** (UI-only, no user action)
- Story 4.3 focuses on **browser notifications** (system-level, requires permission, triggers action)
- Both stories use the same underlying 'waiting' status detection (Story 4.1)
- This story adds a new WebSocket message type (`session.needsInput`) distinct from `session.status`

[Source: docs/sprint-artifacts/4-2-session-attention-badges-and-prioritization.md#Dev-Notes]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - session.needsInput WebSocket message schema
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Workflows-and-Sequencing] - Browser Notification Flow
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.7-AC4.9 notification requirements
- [Source: docs/architecture.md#ADR-017] - Browser Notification Permission Flow (Epic 3)
- [Source: docs/sprint-artifacts/4-1-session-status-tracking-with-idle-detection.md] - Session status tracking, waiting detection
- [Source: docs/sprint-artifacts/4-2-session-attention-badges-and-prioritization.md] - Attention badge patterns, waiting status UI

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-2
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
