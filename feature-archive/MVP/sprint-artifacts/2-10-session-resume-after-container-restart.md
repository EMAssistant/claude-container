# Story 2.10: Session Resume After Container Restart

Status: done

## Story

As a developer,
I want to manually resume sessions after Docker container restarts,
So that I can continue my work without losing context (FR12, FR66).

## Acceptance Criteria

**Given** 3 sessions exist with work in progress
**When** the Docker container stops and restarts
**Then** the backend:
1. Reads `/workspace/.claude-container-sessions.json` on startup
2. Restores session metadata (id, name, branch, worktreePath, timestamps)
3. Sets all session statuses to "idle" (PTY processes not restored)
4. Does NOT automatically spawn PTY processes

**And** when the UI loads
**Then** all 3 sessions appear in the session list with "idle" status

**And** the terminals show: "Session not running. Click to resume."

**And** when the user clicks a session to resume
**Then** the backend spawns a new PTY process for that session

**And** the PTY cwd is set to the persisted worktree path

**And** Claude CLI starts in the worktree with all previous files intact

**And** the user can analyze the state (git status, check files) and decide how to continue

**And** when the user asks Claude to "analyze what's been done and continue"
**Then** Claude reads the worktree state and resumes work (manual resume per FR12, FR67)

## Tasks / Subtasks

- [ ] Task 1: Backend session restoration on startup (AC: 1-3)
  - [ ] 1.1: Add SessionManager.loadSessions() method to read JSON on startup
  - [ ] 1.2: Parse JSON and restore Session objects with status='idle'
  - [ ] 1.3: Validate worktree paths still exist on filesystem
  - [ ] 1.4: Call loadSessions() in server.ts startup sequence
  - [ ] 1.5: Handle corrupted JSON gracefully (log warning, continue startup)

- [ ] Task 2: Frontend idle session UI display (AC: 4-5)
  - [ ] 2.1: SessionList component renders sessions with status='idle' (blue dot)
  - [ ] 2.2: Terminal component detects idle session and displays placeholder message
  - [ ] 2.3: Add "Resume" button/click handler in idle terminal view
  - [ ] 2.4: Style idle state consistently with Oceanic Calm theme

- [ ] Task 3: Manual resume functionality via WebSocket (AC: 6-9)
  - [ ] 3.1: Add WebSocket message type 'session.resume' to protocol
  - [ ] 3.2: Backend handler spawns new PTY with persisted worktreePath as cwd
  - [ ] 3.3: Update session status from 'idle' → 'active'
  - [ ] 3.4: Send session.status update to frontend
  - [ ] 3.5: Frontend terminal switches from placeholder to xterm.js instance
  - [ ] 3.6: Verify Claude CLI loads with worktree files intact

- [ ] Task 4: Testing session persistence and resume (AC: All)
  - [ ] 4.1: Integration test: Create 3 sessions, stop container, start, verify sessions restored
  - [ ] 4.2: Integration test: Resume session, verify PTY spawns with correct cwd
  - [ ] 4.3: Integration test: Verify files in worktree persist across restart
  - [ ] 4.4: Unit test: loadSessions() with valid JSON
  - [ ] 4.5: Unit test: loadSessions() with corrupted JSON (graceful handling)
  - [ ] 4.6: E2E test: Create session, write file in worktree, restart, resume, verify file exists

## Dev Notes

This story completes the session persistence loop from Story 2.1. Sessions are persisted to JSON but PTY processes (which are OS process handles) cannot survive container restarts. The solution is manual resume - sessions restore in "idle" state, user clicks to spawn new PTY processes on demand.

### Architecture Context

**From Architecture - Session State Model:**
- Session interface includes all metadata needed for persistence (id, name, branch, worktreePath, timestamps)
- PTY processes are ephemeral (ptyPid field optional, not persisted)
- Session JSON at `/workspace/.claude-container-sessions.json` survives restarts via volume mount

**From Tech Spec Epic 2 - Session Lifecycle:**
- Atomic write pattern ensures JSON integrity (Story 2.1)
- SessionManager maintains Map<sessionId, Session> in-memory
- PTYManager maintains Map<sessionId, PTYProcess> separately
- On restart: SessionManager loads JSON, PTYManager map is empty

**From Tech Spec Epic 2 - Workflow 5 (Session Resume After Container Restart):**
```
Container stops → Sessions JSON persisted → PTY processes terminate
Container starts → SessionManager.loadSessions():
  1. Read /workspace/.claude-container-sessions.json
  2. Parse JSON into Session objects
  3. Set all sessions status='idle'
  4. Restore to in-memory registry (no PTY spawned)
Frontend connects → Backend sends session.list → Frontend displays idle sessions
User clicks Resume → Backend spawns PTY with worktreePath → Status → 'active'
```

### Technical Decisions

**Manual Resume (Not Auto-Resume):**
- PRD FR12 explicitly scopes auto-resume to Sprint 4 (Future enhancement)
- Manual resume gives user control to decide when/if to resume each session
- Auto-resume deferred until user feedback validates need (Sprint 4 consideration)

**Status Transition:**
- All sessions restored with status='idle' regardless of pre-restart status
- Rationale: PTY processes are gone, "active" would be misleading
- User action required to transition 'idle' → 'active' (spawn PTY)

**Worktree Validation:**
- loadSessions() should verify worktree paths exist on filesystem
- If worktree missing (user deleted), log warning but keep session (user can recreate or destroy)
- Don't auto-delete sessions with missing worktrees (data preservation)

**Error Handling:**
- Corrupted JSON: Log warning, continue startup with empty session list
- Story 2.1 atomic writes minimize corruption risk, but handle gracefully
- Alternative recovery: Scan `/workspace/.worktrees/` directory and rebuild sessions (advanced, optional)

### Project Structure Notes

**Backend Files to Modify:**
- `backend/src/sessionManager.ts` - Add loadSessions() method, call during construction
- `backend/src/server.ts` - Ensure sessionManager initialized before WebSocket server starts
- `backend/src/types.ts` - Confirm Session interface matches (already defined in Story 2.1)

**Frontend Files to Modify:**
- `frontend/src/components/Terminal.tsx` - Detect status='idle', show Resume button
- `frontend/src/components/SessionList.tsx` - Render idle status with blue dot
- `frontend/src/hooks/useWebSocket.ts` - Add session.resume message sender

**New WebSocket Protocol Extension:**
```typescript
// Client → Server
{ type: 'session.resume', sessionId: string }

// Server → Client (already defined in Story 2.1)
{ type: 'session.status', sessionId: string, status: SessionStatus }
```

### Testing Strategy

**Integration Tests (Critical Path):**
1. Container restart recovery:
   - Create 3 sessions with different worktrees
   - Stop backend server (docker stop)
   - Start backend server (docker start)
   - Verify all 3 sessions restored with status='idle'
   - Verify session metadata preserved (names, branches, timestamps)

2. Manual resume flow:
   - Resume session-1
   - Verify PTY spawns with correct cwd
   - Verify Claude CLI loads in worktree
   - Verify session status updates to 'active'
   - Verify terminal streaming works

3. Worktree persistence:
   - Create session, write test file in worktree
   - Restart container
   - Resume session
   - Verify test file still exists and readable

**Unit Tests:**
- SessionManager.loadSessions() with valid JSON
- SessionManager.loadSessions() with empty file
- SessionManager.loadSessions() with corrupted JSON
- SessionManager.loadSessions() with missing worktree paths

**E2E Test (Playwright):**
- Full cycle: Create session → write file → stop container → start container → UI shows idle session → click Resume → verify terminal loads → cat test file in terminal

### References

- [Source: docs/epics/epic-2-multi-session.md#Story-2.10]
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Workflow-5-Session-Resume-After-Container-Restart]
- [Source: docs/architecture.md#Data-Architecture-Session-State-Model]
- [Source: docs/prd.md#FR11-FR12-FR62-FR66-FR67]

### Learnings from Previous Story

This is the first story in Epic 2 being drafted, so no previous story context to apply. Session persistence foundation from Story 2.1 is prerequisite.

## Dev Agent Record

### Context Reference

- Story Context: `docs/sprint-artifacts/2-10-session-resume-after-container-restart.context.xml`

### Agent Model Used

<!-- Will be populated by dev agent during execution -->

### Debug Log References

<!-- Will be populated by dev agent during execution -->

### Completion Notes List

<!-- Will be populated by dev agent during execution -->

### File List

<!-- Will be populated by dev agent during execution -->
