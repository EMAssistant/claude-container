# Story 2.7: Session Destruction with Cleanup Options

Status: review

## Story

As a developer,
I want to destroy sessions that are complete or errored,
so that I can reclaim resources and clean up git worktrees if desired.

## Acceptance Criteria

**AC-1: Confirmation Dialog Display**
- **Given** a session with ID `id1` exists
- **When** the user clicks the X button on the tab
- **Then** a confirmation dialog appears with:
  - Title: "Destroy Session?"
  - Message: "Session 'feature-auth' will be terminated. Git worktree and branch will remain."
  - Checkbox: "Delete git worktree" (unchecked by default)
  - Buttons: "Cancel" | "Destroy" (red/destructive style)

**AC-2: Session Destruction Without Worktree Cleanup**
- **Given** the confirmation dialog is displayed
- **When** the user clicks "Destroy" with checkbox unchecked
- **Then** the backend:
  1. Sends SIGTERM to PTY process (graceful shutdown, 5s timeout)
  2. If PTY doesn't exit, sends SIGKILL
  3. Removes session from in-memory registry
  4. Updates `/workspace/.claude-container-sessions.json` using atomic write
  5. Worktree remains at `/workspace/.worktrees/id1`
  6. Branch `feature/feature-auth` remains

**AC-3: Session Destruction With Worktree Cleanup**
- **Given** the confirmation dialog is displayed
- **When** the user clicks "Destroy" with checkbox checked
- **Then** the backend additionally executes `git worktree remove` (FR15)
- **And** the worktree directory is deleted
- **And** the branch still remains (user can merge/delete manually per FR20)

**AC-4: UI State Update After Destruction**
- **Given** session destruction succeeds
- **When** the backend confirms destruction
- **Then** the tab disappears from the UI
- **And** the UI switches to another active session (or empty state if last session)
- **And** a toast notification shows: "Session 'feature-auth' destroyed"

**AC-5: Error Handling for Worktree Cleanup Failures**
- **Given** worktree cleanup is requested
- **When** the `git worktree remove` command fails (e.g., uncommitted changes, file locks)
- **Then** the system logs the error with details
- **And** displays error message to user with manual cleanup instructions
- **And** session is still removed from registry (partial cleanup acceptable)

**AC-6: Graceful PTY Process Termination**
- **Given** a PTY process is running for a session
- **When** session destruction is initiated
- **Then** the system sends SIGTERM to the PTY process
- **And** waits 5 seconds for graceful exit
- **And** if process still running after 5s, sends SIGKILL
- **And** tracks cleanup via `ptyProcess.onExit()` callback (FR71)

## Tasks / Subtasks

- [ ] **Task 1: Backend API for Session Destruction** (AC: 2, 3, 6)
  - [ ] Implement `DELETE /api/sessions/:id` endpoint with optional `cleanup` query parameter
  - [ ] Add validation to verify session exists before destruction
  - [ ] Implement graceful PTY shutdown: SIGTERM → 5s timeout → SIGKILL
  - [ ] Add session cleanup from sessionManager in-memory registry
  - [ ] Update `/workspace/.claude-container-sessions.json` using atomic write pattern
  - [ ] Return appropriate HTTP status codes (200, 404, 500)

- [ ] **Task 2: Git Worktree Cleanup Integration** (AC: 3, 5)
  - [ ] Add `removeWorktree()` method to WorktreeManager class
  - [ ] Execute `git worktree remove /workspace/.worktrees/<session-id>` via simple-git
  - [ ] Handle git worktree removal errors (uncommitted changes, file locks)
  - [ ] Log error details including git stderr output
  - [ ] Verify worktree directory is deleted after successful removal
  - [ ] Ensure branch remains after worktree cleanup (don't delete branch)

- [ ] **Task 3: Frontend Confirmation Dialog Component** (AC: 1)
  - [ ] Create `SessionDestroyDialog.tsx` using shadcn/ui Dialog component
  - [ ] Add dialog title: "Destroy Session?"
  - [ ] Display session name in message: "Session '{name}' will be terminated..."
  - [ ] Add checkbox control: "Delete git worktree" (unchecked by default)
  - [ ] Style "Destroy" button as destructive (red theme from Oceanic Calm palette)
  - [ ] Add "Cancel" button to dismiss dialog without action
  - [ ] Wire up dialog to session destroy API call

- [ ] **Task 4: Session Tab Close Button Integration** (AC: 1, 4)
  - [ ] Add X close button to session tabs (visible on hover)
  - [ ] Trigger SessionDestroyDialog when X is clicked
  - [ ] Pass session name and ID to dialog component
  - [ ] Handle dialog result (cancel vs confirm)
  - [ ] Update UI state after successful destruction

- [ ] **Task 5: Frontend State Management for Destruction** (AC: 4)
  - [ ] Remove destroyed session from SessionContext sessions array
  - [ ] Switch active session to another session if current was destroyed
  - [ ] Handle case when last session is destroyed (show empty state)
  - [ ] Display toast notification: "Session '{name}' destroyed"
  - [ ] Use shadcn/ui Toast component for notification

- [ ] **Task 6: Error Handling and User Feedback** (AC: 5)
  - [ ] Handle 404 errors (session not found) with error toast
  - [ ] Handle 500 errors (worktree cleanup failed) with detailed message
  - [ ] Display error message with manual cleanup instructions
  - [ ] Log all errors to browser console for debugging
  - [ ] Keep dialog open on error to allow retry

- [ ] **Task 7: Testing** (All ACs)
  - [ ] Unit test: SessionManager.destroySession() removes session
  - [ ] Unit test: WorktreeManager.removeWorktree() executes git command
  - [ ] Unit test: Graceful PTY shutdown (SIGTERM → SIGKILL after timeout)
  - [ ] Integration test: DELETE /api/sessions/:id without cleanup
  - [ ] Integration test: DELETE /api/sessions/:id with cleanup=true
  - [ ] Integration test: Worktree removal error handling
  - [ ] E2E test: Full destroy flow from UI (click X → confirm → verify tab removed)
  - [ ] E2E test: Destroy with worktree cleanup verified via filesystem check

## Dev Notes

### Architecture Alignment

**Session Manager Integration:**
- Session destruction must call `SessionManager.destroySession(sessionId, cleanup)` method
- Session registry update must use atomic write pattern for JSON persistence
- Reference: Tech Spec "SessionManager Public API" section

**PTY Manager Integration:**
- Use `PTYManager.killPTY(sessionId)` for graceful process termination
- Implement timeout mechanism: SIGTERM → wait 5s → SIGKILL if needed
- Register cleanup via `ptyProcess.onExit()` callback per FR71
- Reference: Tech Spec "PTYManager Public API" section

**Worktree Manager Integration:**
- Use `WorktreeManager.removeWorktree(sessionId)` method
- Method executes `git worktree remove` via simple-git library
- Error handling critical: worktree removal can fail with uncommitted changes
- Reference: Architecture ADR-008 (simple-git for worktree operations)

**WebSocket Protocol:**
- Backend sends `{ type: 'session.destroyed', sessionId }` after successful destruction
- Frontend listens for this event to update UI state
- No need to send session.detach before destruction (backend handles cleanup)
- Reference: Tech Spec "WebSocket Protocol Extensions for Multi-Session"

### UI/UX Patterns

**Destructive Action Pattern:**
- Destroy button uses red/destructive styling from Oceanic Calm palette (`#BF616A`)
- Confirmation dialog required (no accidental destroys)
- Checkbox defaults to unchecked (preserve worktree unless user explicitly opts in)
- Reference: UX spec "Button Patterns - Destructive Actions" section 7.1

**Toast Notification:**
- Success: "Session '{name}' destroyed" (auto-dismiss after 3s)
- Error: "Failed to destroy session: {error}" (manual dismiss)
- Use shadcn/ui Toast component with Oceanic Calm theme

**Tab Switching Logic:**
- After destruction, select first remaining session in array
- If no sessions remain, show empty state with "+ New Session" prompt
- Tab switch must be instant (<50ms per NFR-PERF-2)

### Error Handling Patterns

**Worktree Cleanup Failures:**
- Common case: User has uncommitted changes in worktree
- Git error message: "fatal: 'remove' cannot be used with uncomitted changes"
- User-facing message: "Could not delete worktree: uncommitted changes detected. Remove manually: `git worktree remove /workspace/.worktrees/{id}`"
- Log full git stderr for debugging

**PTY Process Stuck:**
- If SIGTERM doesn't terminate in 5s, SIGKILL is sent
- Log warning: "PTY process did not exit gracefully, forced kill"
- No user-facing error (transparent to user)

**Session Not Found:**
- Race condition: Session deleted by another client or backend restart
- Return 404 with message: "Session not found"
- Frontend shows error toast, removes session from UI state

### Testing Strategy

**Unit Tests:**
- Mock PTY spawn/kill operations (don't spawn real processes)
- Mock git worktree commands (use stub functions)
- Verify session removal from registry
- Verify atomic JSON write pattern used

**Integration Tests:**
- Real PTY processes spawned and killed
- Real git worktree operations in test workspace
- Verify worktree directory deletion on filesystem
- Test error paths (uncommitted changes scenario)

**E2E Tests:**
- Playwright automation: create session → click X → confirm → verify tab gone
- Check session count decreased
- Verify worktree deleted when cleanup=true
- Verify branch still exists after cleanup

### Project Structure Notes

**Backend Files to Modify:**
- `/backend/src/sessionManager.ts` - Add `destroySession(sessionId, cleanup)` method
- `/backend/src/worktreeManager.ts` - Add `removeWorktree(sessionId)` method
- `/backend/src/ptyManager.ts` - Add `killPTY(sessionId)` method with graceful shutdown
- `/backend/src/server.ts` - Add `DELETE /api/sessions/:id` REST endpoint

**Frontend Files to Create:**
- `/frontend/src/components/SessionDestroyDialog.tsx` - Confirmation dialog component
- `/frontend/src/components/ui/toast.tsx` - Toast notification component (if not exists from shadcn)

**Frontend Files to Modify:**
- `/frontend/src/components/SessionTabs.tsx` - Add close button (X) to tabs, trigger dialog
- `/frontend/src/contexts/SessionContext.tsx` - Add `destroySession()` action
- `/frontend/src/hooks/useWebSocket.ts` - Handle `session.destroyed` WebSocket event

### References

- **Epic Source:** [Epic 2: Multi-Session Parallel Development, Story 2.7](docs/epics/epic-2-multi-session.md#story-27-session-destruction-with-cleanup-options)
- **Tech Spec:** [Epic Technical Specification: Multi-Session Parallel Development](docs/sprint-artifacts/tech-spec-epic-2.md)
- **Architecture:** [System Architecture - Session Management](docs/architecture.md)
- **PRD FR Coverage:** FR14 (Session destruction), FR15 (Worktree cleanup), FR20 (Branch preservation), FR71 (Process cleanup)

### Prerequisites

- Story 2.1 (Session Manager) must be complete - provides session registry
- Story 2.2 (Worktree Manager) must be complete - provides worktree operations
- Story 2.3 (Session Creation) must be complete - sessions exist to destroy
- Story 2.5 (Tabbed Interface) must be complete - provides tabs with close buttons

### Learnings from Previous Story

**First story in epic being drafted - no predecessor context**

Previous stories (2-1 through 2-6) are still in backlog status and have not been implemented yet.

## Dev Agent Record

### Context Reference

- [Story Context XML](2-7-session-destruction-with-cleanup-options.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

**Backend Implementation:**
- Enhanced `PTYManager.killGracefully()` with SIGTERM → 5s timeout → SIGKILL logic
- Updated `SessionManager.destroySession()` to support optional worktree cleanup
- Added `DELETE /api/sessions/:id` REST endpoint with `cleanup` query parameter
- Added `broadcastSessionDestroyed()` function to notify all clients via WebSocket
- Integrated with `WorktreeManager.removeWorktree()` for cleanup when requested

**Frontend Implementation:**
- Created `SessionDestroyDialog.tsx` with checkbox for worktree cleanup (unchecked by default)
- Added toast notification components (toast.tsx, use-toast.ts, toaster.tsx)
- Added checkbox component for UI consistency
- Integrated dialog into `App.tsx` with API call and WebSocket listener
- Wired close button (X) in `SessionTabs.tsx` to trigger destroy dialog
- Added session.destroyed WebSocket message handling with automatic UI update

**Type Definitions:**
- Added `SessionDestroyedMessage` interface to types.ts
- Updated `ServerMessage` union type to include session.destroyed

**Error Handling:**
- Graceful handling of PTY termination failures (continues with destruction)
- Partial cleanup support (session removed even if worktree cleanup fails)
- User-friendly error messages with manual cleanup instructions
- Toast notifications for success and error states

**Testing:**
- Unit tests for `SessionManager.destroySession()` covering all ACs
- Unit tests for `PTYManager.killGracefully()` with timeout logic
- Integration tests for `DELETE /api/sessions/:id` endpoint
- Tests cover both cleanup=true and cleanup=false scenarios

### File List

**Backend Files Created:**
- `/backend/src/ptyManager.killGracefully.test.ts` - Unit tests for graceful PTY shutdown
- `/backend/src/sessionManager.destroy.test.ts` - Unit tests for session destruction
- `/backend/src/server.destroy.test.ts` - Integration tests for DELETE endpoint

**Backend Files Modified:**
- `/backend/src/types.ts` - Added SessionDestroyedMessage type
- `/backend/src/ptyManager.ts` - Added killGracefully() method with timeout
- `/backend/src/sessionManager.ts` - Enhanced destroySession() with cleanup parameter
- `/backend/src/server.ts` - Added DELETE /api/sessions/:id endpoint and broadcastSessionDestroyed()

**Frontend Files Created:**
- `/frontend/src/components/SessionDestroyDialog.tsx` - Confirmation dialog component
- `/frontend/src/components/ui/toast.tsx` - Toast notification component
- `/frontend/src/components/ui/use-toast.ts` - Toast hook
- `/frontend/src/components/ui/toaster.tsx` - Toast container component
- `/frontend/src/components/ui/checkbox.tsx` - Checkbox component

**Frontend Files Modified:**
- `/frontend/src/App.tsx` - Integrated destroy dialog, API calls, and WebSocket listener
