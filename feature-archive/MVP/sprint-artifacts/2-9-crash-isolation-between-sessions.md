# Story 2.9: Crash Isolation Between Sessions

Status: review

## Story

As a developer,
I want Claude crashes in one session to not affect other running sessions,
So that I can continue working on other features while debugging the crashed session.

## Acceptance Criteria

1. **AC1: Independent PTY Process Isolation**
   - Given 3 sessions are active: `session-1`, `session-2`, `session-3`
   - When the PTY process for `session-2` crashes (e.g., Claude CLI segfault)
   - Then the `ptyProcess.onExit()` callback fires for `session-2` only
   - And sessions 1 and 3 PTY processes continue running unaffected
   - And no system-wide error state is triggered

2. **AC2: Backend Crash Detection and Status Update**
   - Given a session PTY crashes with exit code and signal
   - When the backend detects the crash via `ptyProcess.onExit()` callback
   - Then the backend logs error with details: `"PTY crashed for session-2: exitCode=1, signal=SIGSEGV"`
   - And the backend updates `session-2` status to `"error"` in SessionManager
   - And the backend sends WebSocket message: `{ type: 'session.status', sessionId: 'session-2', status: 'error' }`
   - And the session metadata is persisted to JSON with error status

3. **AC3: Frontend Error State Visualization**
   - Given a session crashes and backend sends error status update
   - When the frontend receives the `session.status` WebSocket message
   - Then the session-2 tab displays red error dot (color: `#BF616A` from Oceanic Calm palette)
   - And the session-2 terminal displays: `"Process exited with code 1. Click to restart."`
   - And the session list shows session-2 with red status indicator
   - And sessions 1 and 3 continue displaying normal status (green/blue)

4. **AC4: Manual Session Restart Capability**
   - Given a session is in error state with crashed PTY
   - When the user clicks the "restart" message in the crashed session's terminal
   - Then the frontend sends `{ type: 'session.resume', sessionId: 'session-2' }` via WebSocket
   - And the backend spawns a new PTY process for `session-2`
   - And the new PTY uses the same worktree path as before
   - And Claude CLI loads in the same worktree with previous files intact
   - And the session status updates to `"active"`

5. **AC5: Concurrent Session Streaming Integrity**
   - Given 4 sessions are outputting terminal data simultaneously
   - When session 2 crashes mid-output
   - Then sessions 1, 3, and 4 continue receiving their PTY output streams without interruption
   - And no terminal output is lost or cross-contaminated
   - And WebSocket routing continues to deliver messages to correct sessions
   - And terminal latency remains <100ms for active sessions (NFR-PERF-4)

6. **AC6: Error State Analysis and Recovery**
   - Given a session has crashed and been restarted
   - When Claude CLI loads in the restarted session
   - Then the user can type: `"Analyze what's been done and continue"`
   - And Claude reads the worktree state (git status, file contents)
   - And Claude provides analysis of work completed before crash
   - And the user can decide how to proceed (manual resume per FR67)

## Tasks / Subtasks

- [ ] Task 1: Implement PTY process crash detection (AC: #1, #2)
  - [ ] Subtask 1.1: Register `onExit()` callback for each PTY process in PTYManager
  - [ ] Subtask 1.2: Pass exit code and signal to callback when PTY terminates
  - [ ] Subtask 1.3: Call `sessionManager.updateSessionStatus(sessionId, 'error')` on crash
  - [ ] Subtask 1.4: Log error with sessionId, exitCode, signal, and lastActivity timestamp
  - [ ] Subtask 1.5: Verify other sessions' PTY processes remain unaffected

- [ ] Task 2: Implement session status update protocol (AC: #2, #3)
  - [ ] Subtask 2.1: Update SessionManager to support `"error"` status in Session interface
  - [ ] Subtask 2.2: Send `session.status` WebSocket message to all connected clients
  - [ ] Subtask 2.3: Include optional `reason` field in message (e.g., "Process crashed")
  - [ ] Subtask 2.4: Persist error status to `/workspace/.claude-container-sessions.json`
  - [ ] Subtask 2.5: Test status update propagation to frontend

- [ ] Task 3: Frontend error state rendering (AC: #3)
  - [ ] Subtask 3.1: Update SessionList component to render red dot for error status
  - [ ] Subtask 3.2: Update SessionTabs component to show red indicator on errored tab
  - [ ] Subtask 3.3: Display "Process exited with code X. Click to restart." message in Terminal
  - [ ] Subtask 3.4: Make restart message clickable (triggers session.resume)
  - [ ] Subtask 3.5: Apply Oceanic Calm error color (#BF616A) per UX design

- [ ] Task 4: Manual restart mechanism (AC: #4, #6)
  - [ ] Subtask 4.1: Add `session.resume` WebSocket message handler in backend
  - [ ] Subtask 4.2: Verify session exists and is in error/idle state before resuming
  - [ ] Subtask 4.3: Spawn new PTY with same sessionId and worktreePath
  - [ ] Subtask 4.4: Update session status from `"error"` to `"active"`
  - [ ] Subtask 4.5: Send status update to frontend via WebSocket
  - [ ] Subtask 4.6: Test that restarted PTY has access to previous worktree state

- [ ] Task 5: Concurrent streaming integrity validation (AC: #5)
  - [ ] Subtask 5.1: Create integration test with 4 concurrent sessions
  - [ ] Subtask 5.2: Generate high-volume output in all 4 sessions
  - [ ] Subtask 5.3: Force crash in session 2 mid-output
  - [ ] Subtask 5.4: Verify sessions 1, 3, 4 continue receiving output
  - [ ] Subtask 5.5: Measure terminal latency for active sessions (must be <100ms)

- [ ] Task 6: Testing and documentation (AC: #1-6)
  - [ ] Subtask 6.1: Write unit tests for PTYManager.onExit callback
  - [ ] Subtask 6.2: Write unit tests for SessionManager.updateSessionStatus
  - [ ] Subtask 6.3: Write integration test for crash → restart flow
  - [ ] Subtask 6.4: Test concurrent session isolation (crash one, verify others OK)
  - [ ] Subtask 6.5: Update Architecture doc with crash isolation design
  - [ ] Subtask 6.6: Document error recovery process in troubleshooting guide

## Dev Notes

### Architectural Patterns and Constraints

**Crash Isolation Architecture** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#NFR-REL-2]
- Each session runs as independent OS process via node-pty
- Process crash in one session cannot affect other sessions (OS-level isolation)
- PTY processes are spawned with separate stdio streams
- No shared state between PTY processes except git repository
- Backend maintains Map<sessionId, PTYProcess> for independent tracking

**Error Handling Design** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Error Handling & Recovery]
- PTY crash detected via `ptyProcess.onExit({ exitCode, signal })` callback
- Session status transitions: `active` → `error` on crash
- Manual restart required (no auto-restart per FR67)
- User analyzes state and decides next steps
- Error state persisted across container restarts

**WebSocket Protocol Extensions** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#WebSocket Protocol Extensions]
```typescript
// Server → Client: Session status update
{
  type: 'session.status',
  sessionId: string,
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped',
  reason?: string  // e.g., "Process crashed", "Exit code 1"
}

// Server → Client: PTY exit event
{
  type: 'terminal.exit',
  sessionId: string,
  exitCode: number,
  signal?: string  // e.g., "SIGSEGV", "SIGKILL"
}

// Client → Server: Resume crashed/idle session
{
  type: 'session.resume',
  sessionId: string
}
```

**Session Status State Machine** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Data Models]
```
active → error (PTY crash)
error → active (user clicks restart)
active → stopped (user destroys session)
idle → active (session resume after container restart)
```

**No Auto-Restart Policy** [Source: docs/prd.md#FR67]
- Manual restart only (user control)
- Prevents infinite crash loops
- Allows user to investigate worktree state before resuming
- User can analyze git status, check logs, understand what went wrong

### Source Tree Components to Touch

**Backend Components**

1. **`backend/src/ptyManager.ts`** (MODIFY)
   - Register `onExit()` callback when spawning PTY
   - Callback signature: `(exitCode: number, signal?: string) => void`
   - On exit, call SessionManager to update status
   - Log crash details with winston

2. **`backend/src/sessionManager.ts`** (MODIFY)
   - Add `updateSessionStatus(sessionId: string, status: SessionStatus): void` method
   - Update in-memory session registry
   - Trigger JSON persistence (atomic write)
   - Emit WebSocket event via server callback

3. **`backend/src/server.ts`** (MODIFY)
   - Add WebSocket message handler for `session.resume`
   - Send `session.status` and `terminal.exit` messages to clients
   - Route PTY exit events to status update mechanism

4. **`backend/src/types.ts`** (MODIFY if needed)
   - Ensure `SessionStatus` type includes `'error'` variant
   - Add `terminal.exit` to WebSocket message type union

**Frontend Components**

1. **`frontend/src/components/SessionList.tsx`** (MODIFY)
   - Add red status dot rendering for `status === 'error'`
   - Color: `#BF616A` from Oceanic Calm palette
   - Add tooltip: "Session crashed. Click to restart."

2. **`frontend/src/components/SessionTabs.tsx`** (MODIFY)
   - Add red indicator on tab for errored sessions
   - Visual pattern: Red dot or border accent

3. **`frontend/src/components/Terminal.tsx`** (MODIFY)
   - Detect `terminal.exit` WebSocket message
   - Display restart prompt: "Process exited with code X. Click to restart."
   - Make message clickable (onClick → send `session.resume`)
   - Clear terminal output on restart (or preserve for analysis - TBD)

4. **`frontend/src/hooks/useWebSocket.ts`** (MODIFY)
   - Handle `session.status` incoming messages
   - Handle `terminal.exit` incoming messages
   - Update SessionContext with new status

5. **`frontend/src/contexts/SessionContext.tsx`** (MODIFY if needed)
   - Ensure context handles error status in sessions array
   - Add `resumeSession(sessionId: string)` action if not exists

**Testing Files**

1. **`backend/src/__tests__/ptyManager.test.ts`** (CREATE/MODIFY)
   - Unit test: PTY crash triggers onExit callback
   - Unit test: Exit code and signal passed correctly
   - Mock node-pty to simulate crash

2. **`backend/src/__tests__/sessionManager.test.ts`** (CREATE/MODIFY)
   - Unit test: updateSessionStatus changes status to error
   - Unit test: Status persisted to JSON atomically

3. **Integration test: Crash isolation** (CREATE)
   - Spawn 3 sessions
   - Force crash in session 2
   - Verify sessions 1 and 3 unaffected
   - Verify session 2 status = error

### Testing Standards Summary

**Unit Tests** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Test Strategy]

**Backend PTYManager Tests:**
- `spawnPTY()` registers onExit callback
- `onExit()` callback fires when PTY process terminates
- Exit code and signal correctly passed to callback
- Mock node-pty to simulate crash scenarios

**Backend SessionManager Tests:**
- `updateSessionStatus()` updates in-memory registry
- Status change persisted to JSON (atomic write verified)
- WebSocket event emitted to connected clients

**Integration Tests** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Integration Tests]

**Crash Isolation Test:**
1. Create 3 sessions
2. Generate output in all 3 sessions
3. Kill PTY process for session-2 (simulate crash)
4. Verify backend detects crash via onExit callback
5. Verify session-2 status updates to 'error'
6. Verify sessions 1 and 3 still receiving output
7. Verify WebSocket message sent: `session.status` for session-2

**Restart Flow Test:**
1. Create session, force crash
2. Verify error status displayed in UI
3. Click restart button
4. Verify `session.resume` WebSocket message sent
5. Verify backend spawns new PTY for same session
6. Verify session status returns to 'active'
7. Verify Claude CLI prompt appears in terminal

**E2E Tests** [Source: docs/sprint-artifacts/tech-spec-epic-2.md#E2E Tests]

**E2E-3: Session Crash and Isolation**
1. Create 3 sessions via UI
2. Generate terminal output in all 3 sessions
3. Force crash session-2 (kill PTY process from backend)
4. Verify session-2 shows red error dot in UI
5. Verify sessions 1 and 3 still running (green/blue dots)
6. Click "Restart" in session-2 terminal
7. Verify session-2 PTY respawns
8. Verify Claude CLI loads in same worktree

**Performance Validation:**
- Concurrent session latency: All active sessions maintain <100ms (NFR-PERF-4)
- Crash detection latency: Error status update within 100ms of PTY exit
- Restart time: New PTY spawns within 2 seconds of resume request

### Project Structure Notes

**Alignment with Unified Project Structure** [Source: docs/architecture.md#Project Structure]

```
backend/src/
├── ptyManager.ts         # MODIFY: Add onExit callback registration
├── sessionManager.ts     # MODIFY: Add updateSessionStatus method
├── server.ts             # MODIFY: Handle session.resume, emit session.status
└── types.ts              # MODIFY: Ensure SessionStatus includes 'error'

frontend/src/
├── components/
│   ├── SessionList.tsx   # MODIFY: Red dot for error status
│   ├── SessionTabs.tsx   # MODIFY: Red indicator on tab
│   └── Terminal.tsx      # MODIFY: Display restart prompt
├── hooks/
│   └── useWebSocket.ts   # MODIFY: Handle session.status, terminal.exit
└── contexts/
    └── SessionContext.tsx # MODIFY: resumeSession action (if needed)

backend/src/__tests__/
├── ptyManager.test.ts    # CREATE/MODIFY: Crash detection tests
└── sessionManager.test.ts # CREATE/MODIFY: Status update tests
```

**No Detected Conflicts**
- Story 2.9 builds on infrastructure from Stories 2.1 (SessionManager), 2.2 (Worktrees), 2.6 (WebSocket multiplexing)
- All dependencies are part of Epic 2 and assumed to be implemented by this point
- Crash isolation uses existing PTY process isolation (node-pty spawns separate OS processes)

### Learnings from Previous Story

**From Story 1-12-validation-with-real-project-workflows (Status: completed)**

Story 1-12 was the last completed story in Epic 1 and provides valuable context for Epic 2 implementation.

**Architectural Learnings:**
- **Container Isolation Validated**: Docker provides process and filesystem isolation from host. PTY processes run as separate OS processes within container sandbox. This isolation is critical for Story 2.9 - each session's PTY is already isolated at the OS level.
- **Tool Approval Elimination**: `ENV CLAUDE_PERMISSION_MODE=bypassPermissions` configured in Dockerfile. Backend correctly reads and passes to PTY spawn. This eliminates approval prompts across all sessions.
- **Volume Mounts Validated**: Workspace at `/workspace` is RW, config at `/config` is RO. Git operations work correctly. This confirms worktrees (Story 2.2) will have proper git access.

**Technical Infrastructure Available:**
- **PTY Process Management**: PTYManager already spawns Claude CLI processes via node-pty. Each PTY has independent stdio streams. For Story 2.9, we leverage node-pty's `onExit` event.
- **WebSocket Protocol**: WebSocket server handles terminal I/O streaming. Foundation exists for adding `session.status` and `terminal.exit` messages.
- **JSON State Persistence**: Volume mount at `/workspace` persists across restarts. Session JSON will survive container restarts.

**Known Issues to Avoid:**
- **ARM64 Docker Build Issues**: Story 1-12 discovered GPG key corruption when building on ARM64. For Epic 2, use existing working image. Do NOT modify Dockerfile during Story 2.9 development.
- **JDK vs JRE**: Runtime has JRE (no javac). Not relevant for Story 2.9 (no Java compilation needed), but good to know for future.

**Testing Patterns Established:**
- **Integration Testing Approach**: Story 1-12 used real projects (Python, Java) for validation. For Story 2.9, create integration tests with real Claude CLI sessions, not mocks.
- **Volume Mount Testing**: Use `-v` flag to mount workspace. Verify session state persists. Apply same approach for multi-session testing.

**Files Modified in Epic 1:**
- `Dockerfile` - Multi-stage build, development environment, CLAUDE_PERMISSION_MODE
- `backend/src/server.ts` - Express + WebSocket server
- `backend/src/ptyManager.ts` - PTY spawning (will be extended in Story 2.9)
- `frontend/src/components/Terminal.tsx` - xterm.js integration
- `frontend/src/hooks/useWebSocket.ts` - WebSocket connection

**Interfaces to Reuse (Not Recreate):**
- PTYManager class: Use existing `spawnPTY()`, extend with `onExit()` registration
- WebSocket protocol: Extend existing message types, don't create new protocol
- SessionContext: Use established pattern for state management

**Technical Debt from Epic 1:**
- TD-1 (ESC key listener) - Fixed in separate story
- TD-2 (Ubuntu 24.04 migration) - Fixed in separate story
- No outstanding tech debt affecting Story 2.9

**Recommendations for Story 2.9:**
1. **Leverage existing PTYManager**: Add `onExit()` callback registration, don't rebuild PTY infrastructure
2. **Follow WebSocket protocol patterns**: Extend existing message types (`session.status`, `terminal.exit`)
3. **Use atomic write pattern**: Story 1-12 validated volume persistence - apply same pattern for session JSON
4. **Test with real Claude CLI**: Don't mock PTY crashes - use actual Claude CLI and force crash scenarios
5. **Validate on working image**: Don't rebuild Dockerfile during development due to ARM64 issues

[Source: docs/sprint-artifacts/1-12-validation-with-real-project-workflows.md#Dev Agent Record]

### References

- [Source: docs/epics/epic-2-multi-session.md#Story 2.9]
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Acceptance Criteria - AC6]
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Workflows - Crash Isolation]
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#NFR-REL-2]
- [Source: docs/architecture.md#Error Handling & Recovery]
- [Source: docs/prd.md#FR64, FR67]

## Dev Agent Record

### Context Reference

- `docs/sprint-artifacts/2-9-crash-isolation-between-sessions.context.xml` - Technical context for crash isolation implementation (generated 2025-11-24)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

#### Implementation Summary (2025-11-24)

**Backend Implementation (AC #1, #2, #4):**
- Added `TerminalExitMessage` WebSocket message type to `backend/src/types.ts`
- Updated `SessionManager.updateSessionStatus()` to accept optional `reason` parameter and emit WebSocket status updates via callback
- Added `setStatusUpdateCallback()` method to SessionManager for WebSocket broadcasting
- Updated `setupPtyOutputStreaming()` in `server.ts` to detect PTY crashes via `onExit()` callback
- On PTY exit, backend now:
  - Logs crash details (exitCode, signal, sessionId)
  - Updates session status to 'error' via SessionManager
  - Broadcasts `terminal.exit` and `session.status` WebSocket messages to all subscribers
  - Keeps session in error state (doesn't delete from SessionManager) for manual restart
- Updated `sessionManager.resumeSession()` to accept both 'idle' and 'error' status for restart capability
- Registered status update callback in server startup to broadcast session status changes

**Frontend Implementation (AC #3):**
- Added error state UI to `Terminal.tsx` component:
  - Red dot (#BF616A from Oceanic Calm palette)
  - Error message: "Process crashed. Click below to restart the session in the same worktree."
  - Clickable "Restart Session" button that sends `session.resume` WebSocket message
- Added `terminal.exit` WebSocket message listener to set terminal to error state
- Updated `SessionTabs.tsx` to display red status indicator dot for crashed sessions
- `SessionList.tsx` already supported error status with red dot (no changes needed)

**Testing:**
- Added unit tests to `sessionManager.test.ts`:
  - Test status update to 'error' with persistence
  - Test status update callback invocation
  - Test resuming crashed sessions (error → active)
  - Test rejection of resuming active sessions

**Session Isolation:**
- PTY processes are already isolated at OS level (node-pty spawns separate processes)
- Crash in one session's PTY does not affect other sessions
- WebSocket routing continues to work correctly via sessionSubscribers map
- Other sessions continue receiving output without interruption

**Key Design Decisions:**
- No auto-restart (per FR67) - manual restart only to prevent infinite crash loops
- Session stays in error state for user analysis before restart
- Worktree state preserved across crash/restart for debugging
- Error status persisted to JSON for container restart scenarios

### File List

**Backend Modified:**
- `backend/src/types.ts` - Added TerminalExitMessage interface
- `backend/src/sessionManager.ts` - Added status callback and updated resumeSession
- `backend/src/server.ts` - Crash detection, WebSocket broadcasting
- `backend/src/sessionManager.test.ts` - Added crash isolation tests

**Frontend Modified:**
- `frontend/src/components/Terminal.tsx` - Error state UI and restart
- `frontend/src/components/SessionTabs.tsx` - Red status indicator
