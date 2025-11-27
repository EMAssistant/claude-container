# Story 4.1: Session Status Tracking with Idle Detection

Status: drafted

## Story

As a developer managing multiple parallel Claude sessions,
I want the system to automatically track session activity and detect idle or stuck states,
so that I can quickly identify which sessions need my attention.

## Acceptance Criteria

1. **AC4.1**: Backend tracks session lastActivity timestamp
   - Given: A PTY process outputs data for a session
   - When: The output is received by the backend
   - Then: The session's `lastActivity` field is updated to the current ISO 8601 UTC timestamp
   - And: The update occurs within 100ms of receiving the data

2. **AC4.2**: Idle detection triggers at 5 minutes
   - Given: A session has status 'active'
   - When: 5 minutes pass with no PTY output
   - Then: The session status changes to 'idle'
   - And: A `session.status` WebSocket message is sent to connected clients

3. **AC4.3**: Stuck warning triggers at 30 minutes
   - Given: A session has been idle for 30 minutes
   - When: The status checker runs
   - Then: A `session.warning` WebSocket message is sent with message "No output for 30+ minutes"
   - And: The session metadata includes `stuckSince` ISO 8601 timestamp

4. **AC4.4**: "Waiting" status detected from PTY output
   - Given: A PTY process outputs text ending with "?"
   - When: No additional output occurs for 10 seconds
   - Then: The session status changes to 'waiting'
   - And: If the session is not currently active, a `session.needsInput` WebSocket message is sent

5. **Backend unit tests**: Status detection logic tested
   - Test: lastActivity updates on PTY output
   - Test: Status transitions (active → idle → stuck)
   - Test: "Waiting" detection from output patterns
   - Coverage: ≥70% for session status tracking code

## Tasks / Subtasks

- [ ] Task 1: Extend Session interface with activity tracking (AC: #1)
  - [ ] Add `lastActivity: string` field to Session interface in `backend/src/types.ts`
  - [ ] Add `metadata.stuckSince?: string` field to Session interface
  - [ ] Add `metadata.lastWarning?: string` field to Session interface
  - [ ] Update session creation to initialize `lastActivity` to current timestamp
  - [ ] Update TypeScript types in `frontend/src/types.ts` to match

- [ ] Task 2: Implement lastActivity timestamp updates (AC: #1)
  - [ ] Modify `ptyManager.ts` to update session lastActivity on PTY data events
  - [ ] Ensure update happens synchronously within PTY onData handler
  - [ ] Update session in SessionManager's in-memory map
  - [ ] Persist lastActivity to session JSON file (atomic write)
  - [ ] Add unit test: Verify lastActivity updates on PTY output

- [ ] Task 3: Create StatusChecker service for idle/stuck detection (AC: #2, #3)
  - [ ] Create `backend/src/statusChecker.ts` module
  - [ ] Implement interval timer (runs every 60 seconds)
  - [ ] For each session, calculate time since lastActivity
  - [ ] If lastActivity > 5 min and status is 'active' → Set status = 'idle'
  - [ ] If lastActivity > 30 min and status in ['active', 'idle'] → Set metadata.stuckSince, send warning
  - [ ] Send `session.status` WebSocket message on status changes
  - [ ] Send `session.warning` WebSocket message for stuck sessions
  - [ ] Add unit tests: Idle detection at 5 minutes, stuck warning at 30 minutes

- [ ] Task 4: Implement "waiting" status detection (AC: #4)
  - [ ] In `ptyManager.ts`, track PTY output buffer
  - [ ] Detect if output ends with "?" character
  - [ ] Set 10-second timeout after question mark detected
  - [ ] If timeout expires without new output → Set status = 'waiting'
  - [ ] Send `session.needsInput` WebSocket message if session not active
  - [ ] Clear timeout if new output arrives before 10s
  - [ ] Add unit tests: Waiting detection from "?" pattern, timeout behavior

- [ ] Task 5: Define new WebSocket message types (AC: #2, #3, #4)
  - [ ] Add `session.status` message type to `backend/src/types.ts`
    - Fields: `sessionId`, `status`, `lastActivity`, `isStuck`
  - [ ] Add `session.warning` message type
    - Fields: `sessionId`, `message`, `severity`
  - [ ] Add `session.needsInput` message type
    - Fields: `sessionId`, `message`
  - [ ] Update `frontend/src/types.ts` with matching types
  - [ ] Document new message types in `docs/websocket-protocol.md`

- [ ] Task 6: Integrate StatusChecker into server lifecycle
  - [ ] Instantiate StatusChecker in `backend/src/server.ts`
  - [ ] Start checker on server startup (after SessionManager initialized)
  - [ ] Stop checker on graceful shutdown
  - [ ] Pass SessionManager and WebSocket server references to checker
  - [ ] Add error handling for checker failures (log, don't crash server)

- [ ] Task 7: Frontend updates for new message types
  - [ ] Update `frontend/src/hooks/useWebSocket.ts` to handle new message types
  - [ ] Add WebSocket message handlers for `session.status`, `session.warning`, `session.needsInput`
  - [ ] Update SessionContext state when status changes
  - [ ] Log received messages (debug level) for troubleshooting
  - [ ] Add unit tests: Verify message handling updates session state

- [ ] Task 8: Write comprehensive unit tests (AC: #5)
  - [ ] Backend: `statusChecker.test.ts` - Idle/stuck detection logic
  - [ ] Backend: `ptyManager.test.ts` - lastActivity updates, waiting detection
  - [ ] Backend: `sessionManager.test.ts` - Status field persistence
  - [ ] Frontend: `useWebSocket.test.ts` - Message handling for new types
  - [ ] Verify ≥70% backend coverage for session status code

- [ ] Task 9: Update documentation
  - [ ] Add status tracking flow diagram to `docs/architecture.md`
  - [ ] Document idle/stuck thresholds (5 min / 30 min) in architecture
  - [ ] Update `docs/websocket-protocol.md` with new message types
  - [ ] Add session status state machine diagram to docs

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Session Entity Extension:**
- Session interface already exists from Epic 2
- Add `lastActivity: string` (ISO 8601 UTC timestamp)
- Add `metadata.stuckSince?: string`, `metadata.lastWarning?: string`
- Status enum extended: 'active' | 'waiting' | 'idle' | 'error' | 'stopped'

**Idle/Stuck Detection Thresholds:**
- **Idle**: 5 minutes of no PTY output
- **Stuck**: 30 minutes of no PTY output
- **Waiting**: Output ends with "?" + 10 seconds silence

**WebSocket Message Types (ADR-013 pattern):**
```typescript
// session.status
{
  type: 'session.status',
  sessionId: string,
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped',
  lastActivity: string,
  isStuck: boolean
}

// session.warning
{
  type: 'session.warning',
  sessionId: string,
  message: string,
  severity: 'warning' | 'error'
}

// session.needsInput
{
  type: 'session.needsInput',
  sessionId: string,
  message: string
}
```

**From Architecture (docs/architecture.md)**:

**Logging Strategy (ADR-012):**
- Winston structured JSON logging
- All status changes logged at `info` level
- Include `sessionId`, `from`, `to`, `timestamp` in status change logs

**Date Handling:**
- ALWAYS use ISO 8601 UTC: `new Date().toISOString()`
- Backend stores UTC, frontend displays local time

**Error Handling:**
- StatusChecker failures must not crash server
- Log errors at `error` level with full context
- Continue checking other sessions if one fails

### Project Structure Notes

**New Files to Create:**
```
backend/src/
├── statusChecker.ts          # Idle/stuck detection service
└── statusChecker.test.ts     # Unit tests for status checker
```

**Files to Modify:**
```
backend/src/
├── types.ts                  # Add lastActivity, metadata fields to Session
├── sessionManager.ts         # Persist lastActivity in session state
├── ptyManager.ts             # Update lastActivity on PTY output, waiting detection
├── server.ts                 # Instantiate and start StatusChecker

frontend/src/
├── types.ts                  # Match backend Session interface
├── hooks/useWebSocket.ts     # Handle new message types

docs/
├── architecture.md           # Document status tracking flow
└── websocket-protocol.md     # Document new message types
```

**No New Dependencies:**
- Epic 4 reuses all existing dependencies from Epic 1-3
- Winston already installed for logging
- No new npm packages required for this story

### Implementation Guidance

**StatusChecker Service Pattern:**
```typescript
export class StatusChecker {
  private intervalId?: NodeJS.Timeout;
  private readonly IDLE_THRESHOLD = 5 * 60 * 1000;  // 5 minutes
  private readonly STUCK_THRESHOLD = 30 * 60 * 1000; // 30 minutes

  start() {
    this.intervalId = setInterval(() => this.checkAllSessions(), 60000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async checkAllSessions() {
    const sessions = await this.sessionManager.getAllSessions();
    for (const session of sessions) {
      await this.checkSession(session);
    }
  }

  private async checkSession(session: Session) {
    const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();

    // Idle detection
    if (timeSinceActivity > this.IDLE_THRESHOLD && session.status === 'active') {
      await this.sessionManager.updateStatus(session.id, 'idle');
      this.broadcastStatusChange(session.id, 'idle');
    }

    // Stuck detection
    if (timeSinceActivity > this.STUCK_THRESHOLD) {
      this.sendStuckWarning(session.id);
    }
  }
}
```

**Waiting Detection Pattern (in PTYManager):**
```typescript
private setupWaitingDetection(sessionId: string, ptyProcess: IPty) {
  let waitingTimeout: NodeJS.Timeout | null = null;

  ptyProcess.onData((data: string) => {
    // Clear any existing timeout
    if (waitingTimeout) clearTimeout(waitingTimeout);

    // Check if output ends with question mark
    if (data.trim().endsWith('?')) {
      waitingTimeout = setTimeout(() => {
        this.sessionManager.updateStatus(sessionId, 'waiting');
        this.sendNeedsInputNotification(sessionId);
      }, 10000); // 10 seconds
    }
  });
}
```

**Testing Considerations:**
- Mock `Date.now()` and `setTimeout`/`setInterval` for deterministic time-based tests
- Use Jest fake timers: `jest.useFakeTimers()`
- Test edge cases: Session destroyed during check, PTY crash during check
- Verify WebSocket messages sent with correct payload structure

### Learnings from Previous Story

**From Story 3-11 (Browser Notifications Prep for Epic 4)**

**Status:** done

**New Infrastructure Created:**
- **NotificationContext** (`frontend/src/context/NotificationContext.tsx`): Global notification state management
  - Provides `permissionGranted` boolean for quick permission checks
  - Tracks banner dismissal in localStorage (`notification-permission-dismissed`)
  - Ready to extend with `sendNotification()` function in Story 4.3
- **useNotificationPermission hook** (`frontend/src/hooks/useNotificationPermission.ts`): Permission state management
  - Checks `Notification.permission` on mount
  - Handles all three states: granted/denied/default
  - Gracefully handles missing Notification API
- **NotificationBanner component** (`frontend/src/components/NotificationBanner.tsx`): Permission request UI
  - Only shows when permission is "default" AND not dismissed
  - Auto-dismisses after permission request

**Patterns to Follow:**
- **Context Splitting (ADR-005)**: Keep NotificationContext focused, don't mix with session state
- **localStorage Keys**: Use hyphenated format (`notification-permission-dismissed`)
- **TypeScript Strict Mode**: Enable strict null checks for permission state
- **Component Testing**: Aim for comprehensive test coverage (49+ tests in Story 3-11)

**Integration Points for This Story:**
- **Story 4.3** will consume NotificationContext to send browser notifications
- **This story (4.1)** provides the `session.needsInput` WebSocket message that Story 4.3 will trigger on
- NotificationContext already wired into App.tsx (no additional setup needed)

**Technical Debt Items:**
- None that affect this story directly
- Notification sending deferred to Story 4.3 as planned

**Testing Patterns Established:**
- Mock `window.Notification` API in tests (not available in jsdom)
- Test all three permission states independently
- Test localStorage persistence and cleanup
- Comprehensive unit coverage prevents regressions (96%+ coverage in Epic 2)

**Decisions Made in Previous Story:**
1. Separate context file instead of extending existing context (ADR-005)
2. Used `notification-permission-dismissed` localStorage key for dismissal tracking
3. Auto-dismiss banner after permission request (UX best practice)
4. Three-state conditional rendering: granted/denied/default

**Files to Be Aware Of:**
- `frontend/src/context/NotificationContext.tsx` - Will be consumed in Story 4.3
- `frontend/src/hooks/useNotificationPermission.ts` - Permission check logic
- `frontend/src/components/NotificationBanner.tsx` - UI component (no changes needed this story)
- `frontend/src/components/TopBar.tsx` - Settings dropdown has notification section

[Source: docs/sprint-artifacts/3-11-browser-notifications-prep-for-epic-4.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Detailed-Design] - Session status tracking design, StatusChecker service
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - Session entity extension with lastActivity
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#APIs-and-Interfaces] - New WebSocket message types
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Workflows-and-Sequencing] - Idle/stuck detection flow
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.1-AC4.4 traceability
- [Source: docs/architecture.md#ADR-012] - Session lifecycle management patterns
- [Source: docs/architecture.md#ADR-013] - WebSocket message protocol patterns
- [Source: docs/architecture.md#Logging-Strategy] - Winston structured JSON logging
- [Source: docs/sprint-artifacts/epic-3-retrospective.md#Action-Items-for-Epic-4] - NOTIFY-1 integration point

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 3-11
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
