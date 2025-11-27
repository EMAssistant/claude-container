## Epic 2: Multi-Session Parallel Development

**Goal:** Enable developers to work on 4 features simultaneously with isolated git worktrees and seamless session switching

**User Value:** Developers can parallelize work across multiple epics without context-switching overhead - "getting more while doing less"

**FR Coverage:** FR8-FR12, FR14-FR20, FR29-FR36, FR59-FR63, FR64-FR68, FR69-FR70, FR72 (30 FRs)

### Story 2.1: Session Manager Module with State Persistence

As a developer,
I want the backend to track multiple sessions with persistent state across container restarts,
So that I can resume my parallel work after Docker stops.

**Acceptance Criteria:**

**Given** a `sessionManager.ts` backend module
**When** a new session is created with name "feature-auth"
**Then** a Session object is created with:
- `id`: UUID v4 (e.g., "a1b2c3d4...")
- `name`: "feature-auth"
- `status`: "active"
- `branch`: "feature/feature-auth"
- `worktreePath`: "/workspace/.worktrees/a1b2c3d4"
- `createdAt`: ISO 8601 UTC timestamp
- `lastActivity`: ISO 8601 UTC timestamp

**And** the session is added to `/workspace/.claude-container-sessions.json` using atomic write pattern:
1. Write to temporary file `/workspace/.claude-container-sessions.tmp`
2. Rename temp file to `/workspace/.claude-container-sessions.json`

**And** when the container restarts
**Then** the session manager reads the JSON file on startup

**And** restores all sessions to in-memory registry

**And** session metadata (name, status, timestamps) is preserved (FR11, FR62)

**And** when the JSON file is corrupted or missing
**Then** the session manager logs a warning and rebuilds state from git worktrees (FR61)

**Prerequisites:** Epic 1 complete (backend infrastructure exists)

**Technical Notes:**
- Session interface per Architecture "Data Architecture - Session State Model"
- Atomic writes prevent JSON corruption (FR60)
- Max 4 sessions tracked per design constraint (FR9)
- simple-git library used to scan `.worktrees/` directory for rebuild
- Winston logging for all session lifecycle events
- Reference: Architecture ADR-009 "Flat JSON File for Session Persistence"

---

### Story 2.2: Git Worktree Creation and Branch Management

As a developer,
I want each session to operate in an isolated git worktree on its own branch,
So that Claude's changes don't conflict with work in other sessions.

**Acceptance Criteria:**

**Given** a `worktreeManager.ts` backend module using simple-git
**When** a session is created with name "feature-auth"
**Then** the system executes:
```bash
git worktree add -b feature/feature-auth /workspace/.worktrees/<session-id>
```

**And** a new git worktree is created at `/workspace/.worktrees/<session-id>`

**And** a new branch `feature/feature-auth` is created from current HEAD

**And** the worktree directory contains a complete copy of the repository

**And** when the PTY process is spawned for this session
**Then** the working directory is set to `/workspace/.worktrees/<session-id>` (FR18)

**And** Claude operates exclusively within that worktree

**And** when the session is destroyed with cleanup option enabled
**Then** the system executes:
```bash
git worktree remove /workspace/.worktrees/<session-id>
```

**And** the worktree directory is deleted

**And** the branch remains (user can merge/delete manually per FR20)

**Prerequisites:** Story 2.1 (Session manager)

**Technical Notes:**
- simple-git library for worktree operations (Architecture ADR-008)
- Branch naming: `feature/<session-name>` convention
- Auto-generated names: `feature/2025-11-24-001` format
- User specifies branch name or accepts auto-generated (FR17)
- Worktree cleanup optional on session destroy (FR15)
- Reference: Architecture "Git Worktree Management" section

---

### Story 2.3: Session Creation REST API and Modal Dialog

As a developer,
I want to create new sessions via a UI dialog with custom names,
So that I can start working on multiple features in parallel.

**Acceptance Criteria:**

**Given** a REST endpoint `POST /api/sessions`
**When** the frontend sends:
```json
{ "name": "feature-auth", "branch": "feature/feature-auth" }
```
**Then** the backend:
1. Validates session name (alphanumeric + dashes, max 50 chars)
2. Creates git worktree via worktreeManager
3. Creates session via sessionManager
4. Spawns PTY process with cwd=worktree path
5. Returns: `{ session: { id, name, status, ... } }`

**And** when the frontend clicks "+ New Session" button (FR31)
**Then** a modal dialog opens with:
- Session name input (pre-filled: "feature-2025-11-24-001")
- Branch name input (auto-filled from session name)
- "Cancel" and "Create" buttons

**And** when the user edits the session name
**Then** the branch name auto-updates to match

**And** when the user clicks "Create"
**Then** the frontend sends POST to `/api/sessions`

**And** a loading spinner shows "Creating session..." for 3-5 seconds

**And** when creation succeeds
**Then** the modal closes and the new session appears in the UI

**And** when creation fails (e.g., branch exists, invalid name)
**Then** an error message displays in the modal (FR68)

**Prerequisites:** Story 2.1 (Session manager), Story 2.2 (Worktree manager)

**Technical Notes:**
- Modal uses shadcn/ui Dialog component
- Session name validation: `/^[a-zA-Z0-9-]{1,50}$/`
- Auto-generated names: increment counter per day
- Error messages per Architecture "User-Facing Error Messages" patterns
- Reference: UX spec "Journey 1: Creating a New Session"

---

### Story 2.4: Session List Component with Status Indicators

As a developer,
I want to see all active sessions in a right sidebar with visual status indicators,
So that I can monitor multiple Claude processes at a glance.

**Acceptance Criteria:**

**Given** a `SessionList.tsx` component in the right sidebar (260px wide, resizable)
**When** 3 sessions exist: "feature-auth", "feature-ui", "feature-api"
**Then** the sidebar displays a vertical list with each session showing:
- Status dot (8px circle):
  - Green `#A3BE8C` with pulsing animation = active
  - Yellow `#EBCB8B` = waiting for input
  - Blue `#88C0D0` = idle
  - Red `#BF616A` = error/crashed
- Session name (14px, truncated at 20 chars)
- Last activity timestamp (11px gray, "5m ago" format)
- Optional: Current BMAD phase (11px gray, e.g., "PRD Creation")

**And** when a session's status changes (backend sends `session.status` WebSocket message)
**Then** the status dot color updates in real-time (FR33)

**And** when the last activity timestamp exceeds 30 minutes
**Then** a yellow "Stuck?" warning indicator appears (FR36)

**And** when Claude is waiting for user input
**Then** a "!" badge appears on the session (FR50)

**And** when the user clicks a session
**Then** the main terminal view switches to that session (FR30)

**And** the clicked session highlights with active state background

**Prerequisites:** Story 2.1 (Sessions exist), Epic 1 Story 1.9 (Basic UI layout)

**Technical Notes:**
- Component per UX spec "Session List Component" section 6.1
- Status colors from Oceanic Calm palette (UX spec 3.1)
- Idle timer calculation: `relativeTime(lastActivity)` helper function
- SessionContext provides sessions array, activeSessionId
- Real-time updates via WebSocket `session.status` messages
- Reference: UX spec "Journey 2: Switching Between Sessions"

---

### Story 2.5: Tabbed Interface for Session Switching

As a developer,
I want tabs at the top for quick session switching via mouse or keyboard shortcuts,
So that I can navigate between parallel projects instantly (<50ms per NFR-PERF-2).

**Acceptance Criteria:**

**Given** 3 sessions exist in the system
**When** the UI loads
**Then** the top bar displays tabs for each session:
- Tab width: 120-200px (truncate long names)
- Active tab: Background `#2E3440`, bottom border `2px solid #88C0D0`
- Inactive tabs: Background `#3B4252`, color `#81A1C1`
- "+ New Session" tab always visible at the end

**And** when the user clicks an inactive tab
**Then** the terminal view switches to that session within 50ms (FR30, NFR-PERF-2)

**And** the clicked tab becomes active (highlighting changes)

**And** when the user presses `Cmd+1` (macOS) or `Ctrl+1` (Linux/Windows)
**Then** the first session activates

**And** `Cmd+2`, `Cmd+3`, `Cmd+4` activate sessions 2, 3, 4 respectively

**And** when the user hovers over a tab
**Then** a close button (X icon) appears on the right

**And** clicking the X triggers session destroy with confirmation dialog

**And** when >4 tabs exist (edge case)
**Then** tabs scroll horizontally with scroll indicators on edges

**Prerequisites:** Story 2.4 (Session list exists), Story 2.3 (Session creation)

**Technical Notes:**
- shadcn/ui Tabs component customized with Oceanic Calm theme
- Tab switching: Update SessionContext activeSessionId only (no remount)
- Keyboard shortcuts: Global keyboard event listener in App.tsx
- Close confirmation: "Destroy session? Worktree will remain." dialog
- Reference: UX spec "Navigation & Interaction Patterns" section 7.5

---

### Story 2.6: Multiple WebSocket Connections per Client

As a developer,
I want each session to stream terminal output independently via WebSocket,
So that all 4 sessions can run concurrently without interference.

**Acceptance Criteria:**

**Given** 3 sessions are created with IDs: `id1`, `id2`, `id3`
**When** the frontend connects to the WebSocket server
**Then** a single WebSocket connection is established

**And** when the frontend sends `session.attach` messages:
```json
{ "type": "session.attach", "sessionId": "id1" }
{ "type": "session.attach", "sessionId": "id2" }
{ "type": "session.attach", "sessionId": "id3" }
```
**Then** the backend subscribes this WebSocket to all 3 PTY processes

**And** when PTY for `id1` outputs "Hello from session 1"
**Then** the backend sends:
```json
{ "type": "terminal.output", "sessionId": "id1", "data": "Hello from session 1" }
```

**And** only the Terminal component for `id1` receives and displays the output

**And** terminals for `id2` and `id3` remain unchanged

**And** when all 4 sessions are outputting simultaneously
**Then** each terminal receives its own output stream without cross-contamination (FR57)

**And** terminal latency remains <100ms for all sessions (NFR-PERF-4)

**Prerequisites:** Story 2.1 (Multiple sessions), Epic 1 Story 1.5 (WebSocket protocol)

**Technical Notes:**
- Single WebSocket connection per client (not per session per FR56 clarification)
- Backend maintains Map<sessionId, PTYProcess> and Map<WebSocket, Set<sessionId>>
- Session attach/detach messages control subscriptions
- Concurrent streaming: Each PTY's `onData` callback filters by subscribed WebSockets
- Reference: Architecture "API Contracts - WebSocket Protocol"

---

### Story 2.7: Session Destruction with Cleanup Options

As a developer,
I want to destroy sessions that are complete or errored,
So that I can reclaim resources and clean up git worktrees if desired.

**Acceptance Criteria:**

**Given** a session with ID `id1` exists
**When** the user clicks the X button on the tab
**Then** a confirmation dialog appears:
- Title: "Destroy Session?"
- Message: "Session 'feature-auth' will be terminated. Git worktree and branch will remain."
- Checkbox: "Delete git worktree" (unchecked by default)
- Buttons: "Cancel" | "Destroy" (red/destructive style)

**And** when the user clicks "Destroy" with checkbox unchecked
**Then** the backend:
1. Sends SIGTERM to PTY process (graceful shutdown, 5s timeout)
2. If PTY doesn't exit, sends SIGKILL
3. Removes session from in-memory registry
4. Updates `/workspace/.claude-container-sessions.json`
5. Worktree remains at `/workspace/.worktrees/id1`
6. Branch `feature/feature-auth` remains

**And** when the checkbox is checked
**Then** the backend additionally executes `git worktree remove` (FR15)

**And** the worktree directory is deleted (branch still remains)

**And** when destruction succeeds
**Then** the tab disappears and UI switches to another session

**And** a toast notification shows: "Session 'feature-auth' destroyed"

**Prerequisites:** Story 2.3 (Sessions exist), Story 2.2 (Worktree management)

**Technical Notes:**
- DELETE `/api/sessions/:id?cleanup=<boolean>` REST endpoint
- Graceful PTY shutdown: SIGTERM → wait 5s → SIGKILL if needed
- Process cleanup tracked via `ptyProcess.onExit()` callback (FR71)
- Error handling: Log if worktree removal fails (may have uncommitted changes)
- Reference: UX spec "Button Patterns - Destructive Actions" section 7.1

---

### Story 2.8: WebSocket Reconnection with Exponential Backoff

As a developer,
I want the frontend to automatically reconnect to the WebSocket when the connection drops,
So that temporary network issues don't require manual page refresh (FR65).

**Acceptance Criteria:**

**Given** the WebSocket connection is active
**When** the connection drops unexpectedly (network hiccup, backend restart)
**Then** the frontend:
1. Detects disconnect via `ws.onclose` or `ws.onerror` event
2. Displays "Connection lost. Reconnecting..." banner (yellow warning)
3. Waits 1 second
4. Attempts reconnection

**And** when the first reconnection attempt fails
**Then** the frontend waits 2 seconds and retries

**And** on subsequent failures, doubles the wait time: 4s, 8s, 16s, max 30s

**And** when reconnection succeeds
**Then** the banner changes to "Connected" (green, auto-dismisses after 2s)

**And** the frontend re-sends `session.attach` messages for all active sessions

**And** terminal output resumes streaming

**And** when reconnection fails for 5 minutes continuously
**Then** the frontend shows "Connection lost. Please refresh page." with a "Retry" button

**And** clicking Retry resets the backoff and attempts immediate reconnection

**Prerequisites:** Epic 1 Story 1.5 (WebSocket established)

**Technical Notes:**
- Exponential backoff pattern per Architecture "Communication Patterns"
- Reconnection logic in `useWebSocket` custom hook
- Backend queues output during disconnect (up to 1MB buffer per session)
- On reconnect, backend flushes queued output to catch up
- Reference: Architecture "Error Handling & Recovery" and NFR-REL-3

---

### Story 2.9: Crash Isolation Between Sessions

As a developer,
I want Claude crashes in one session to not affect other running sessions,
So that I can continue working on other features while debugging the crashed session (FR64).

**Acceptance Criteria:**

**Given** 3 sessions are active: `session-1`, `session-2`, `session-3`
**When** the PTY process for `session-2` crashes (e.g., Claude CLI segfault)
**Then** the `ptyProcess.onExit()` callback fires for `session-2`

**And** the backend:
1. Logs error: "PTY crashed for session-2: exitCode=1, signal=SIGSEGV"
2. Updates `session-2` status to "error"
3. Sends WebSocket message: `{ type: 'session.status', sessionId: 'session-2', status: 'error' }`
4. Does NOT affect `session-1` or `session-3` PTY processes

**And** in the UI:
- `session-2` tab shows red error dot
- `session-2` terminal displays: "Process exited with code 1. Click to restart."
- `session-1` and `session-3` continue running normally

**And** when the user clicks the "restart" message in `session-2` terminal
**Then** a new PTY process spawns for `session-2`

**And** Claude CLI loads in the same worktree

**And** the session resumes (user can analyze state and continue per FR67)

**Prerequisites:** Story 2.1 (Multiple sessions), Story 2.4 (Session list)

**Technical Notes:**
- Each PTY process runs independently (separate OS process via node-pty)
- Process crash handling: `ptyProcess.onExit({ exitCode, signal })` per session
- Restart mechanism: Create new PTY with same session ID and worktree path
- No auto-restart (user decides when to resume per FR67)
- Reference: Architecture "Error Handling & Recovery" and NFR-REL-2

---

### Story 2.10: Session Resume After Container Restart

As a developer,
I want to manually resume sessions after Docker container restarts,
So that I can continue my work without losing context (FR12, FR66).

**Acceptance Criteria:**

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

**Prerequisites:** Story 2.1 (Session persistence), Story 2.8 (Reconnection logic)

**Technical Notes:**
- NO auto-resume in Sprint 2 (manual only per PRD scope)
- Session JSON persists: id, name, branch, worktreePath, createdAt, lastActivity
- PTY processes NOT persisted (process handles can't survive restart)
- Manual resume: User clicks session → backend spawns PTY → Claude analyzes state
- Auto-resume deferred to Sprint 4 (Future enhancement per PRD)
- Reference: PRD "Session Management" FR11-FR12 and "Vision (Future)"

---

### Story 2.11: Resource Management for 4 Concurrent Sessions

As a developer,
I want the system to handle 4 concurrent sessions without performance degradation,
So that I can maximize parallel development (FR69, NFR-SCALE-1).

**Acceptance Criteria:**

**Given** 4 sessions are active and all running Claude CLI commands
**When** all 4 terminals are streaming output simultaneously
**Then** each terminal maintains <100ms latency (NFR-PERF-1)

**And** tab switching remains <50ms responsive (NFR-PERF-2)

**And** when memory usage is checked via `docker stats`
**Then** total container memory is 4-8GB for 4 sessions (~1-2GB per session per NFR-SCALE-2)

**And** CPU usage distributes across 4 cores (if available)

**And** when a 5th session is attempted (beyond design limit)
**Then** the frontend shows error: "Maximum 4 sessions supported. Destroy a session to create a new one."

**And** session creation is blocked

**And** when a PTY process becomes zombie (crash without cleanup)
**Then** the backend detects it and cleans up (FR71)

**And** logs a warning: "Cleaned up zombie process for session X"

**Prerequisites:** Story 2.1-2.9 (Multi-session infrastructure complete)

**Technical Notes:**
- Design constraint: MAX_SESSIONS = 4 (hardcoded per PRD)
- Resource monitoring: Optional via `docker stats` or process.memoryUsage() (FR70)
- Zombie cleanup: Periodic check every 60s for PTY processes with no active socket
- Performance validated with real concurrent Claude workloads
- Reference: PRD NFR-SCALE-1, NFR-SCALE-2, NFR-PERF-4

---

### Story 2.12: Validation with 4 Parallel BMAD Workflows

As a developer,
I want to validate that 4 sessions can run complete BMAD workflows simultaneously,
So that I'm confident the multi-session architecture meets the PRD success criteria.

**Acceptance Criteria:**

**Given** the container with 4 sessions created:
- Session 1: "epic-auth" - Running brainstorming → PRD → architecture workflow
- Session 2: "epic-payments" - Running PRD creation workflow
- Session 3: "epic-ui-polish" - Running UX design workflow
- Session 4: "epic-notifications" - Running development workflow (implementing stories)

**When** all 4 Claude sessions are actively working (no waiting for user input)
**Then** all 4 terminals show real-time output

**And** switching between sessions is instant (<50ms)

**And** no terminal output is lost or cross-contaminated

**And** git worktrees remain isolated (changes in one don't affect others)

**And** when Claude asks a question in Session 2
**Then** Session 2 tab shows "!" badge (FR50)

**And** Sessions 1, 3, 4 continue working autonomously

**And** when Session 3 completes its UX design workflow
**Then** the generated UX spec is in Session 3's worktree only

**And** when the container restarts
**Then** all 4 sessions restore from JSON and can be manually resumed

**Prerequisites:** All stories in Epic 2 (complete multi-session system)

**Technical Notes:**
- Test with REAL BMAD workflows, not mock commands
- Validation success criteria from PRD Sprint 2: "Can develop 4 features simultaneously"
- Monitor for: memory leaks, WebSocket message loss, terminal rendering lag
- Stress test: All 4 sessions generating high terminal output (e.g., test runs)
- Reference: PRD "Success Criteria" Sprint 2

---

## **Epic 2 Complete - Review**

**Epic 2: Multi-Session Parallel Development**

**Stories:** 12 total
- Story 2.1: Session manager with persistence
- Story 2.2: Git worktree creation
- Story 2.3: Session creation API and modal
- Story 2.4: Session list with status indicators
- Story 2.5: Tabbed interface for switching
- Story 2.6: Multiple WebSocket connections
- Story 2.7: Session destruction with cleanup
- Story 2.8: WebSocket reconnection logic
- Story 2.9: Crash isolation between sessions
- Story 2.10: Session resume after restart
- Story 2.11: Resource management for 4 sessions
- Story 2.12: Validation with parallel workflows

**FRs Covered:** FR8-FR12, FR14-FR20, FR29-FR36, FR59-FR63, FR64-FR68, FR69-FR70, FR72 (30 FRs)

**User Value Delivered:** Developers can work on 4 features simultaneously in isolated git worktrees with seamless session switching

**Ready for Epic 3:** Yes - multi-session infrastructure complete, ready for workflow visibility and document viewing

---

