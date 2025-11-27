# Story 2.3: Session Creation REST API and Modal Dialog

Status: done

## Story

As a developer,
I want to create new sessions via a UI dialog with custom names,
So that I can start working on multiple features in parallel.

## Acceptance Criteria

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

## Tasks / Subtasks

### Backend Tasks

- [ ] **Task 1: Create REST endpoint POST /api/sessions** (AC: #1-5)
  - [ ] Subtask 1.1: Add Express route handler in `backend/src/server.ts`
  - [ ] Subtask 1.2: Validate request body schema (name, branch optional)
  - [ ] Subtask 1.3: Implement session name validation regex: `/^[a-zA-Z0-9-]{1,50}$/`
  - [ ] Subtask 1.4: Call `sessionManager.createSession(name, branch)` to create session
  - [ ] Subtask 1.5: Handle errors and return appropriate HTTP status codes (400, 409, 500)
  - [ ] Subtask 1.6: Return JSON response with created session object

- [ ] **Task 2: Integrate worktreeManager and sessionManager** (AC: #2-4)
  - [ ] Subtask 2.1: Ensure `sessionManager.createSession()` calls `worktreeManager.createWorktree(sessionId, branchName)`
  - [ ] Subtask 2.2: After worktree creation, call `ptyManager.spawnPTY(sessionId, worktreePath)`
  - [ ] Subtask 2.3: Handle worktree creation failures (branch exists, git errors)
  - [ ] Subtask 2.4: Atomic session creation: rollback on failure (cleanup worktree if PTY spawn fails)
  - [ ] Subtask 2.5: Save session to JSON persistence file using atomic write pattern

- [ ] **Task 3: Implement error handling and user-facing error messages** (AC: #9)
  - [ ] Subtask 3.1: Map git errors to user-friendly messages (e.g., "Branch already exists")
  - [ ] Subtask 3.2: Validation errors return 400 with clear message (e.g., "Invalid session name format")
  - [ ] Subtask 3.3: Max sessions error (4 limit) returns 400 with message: "Maximum 4 sessions supported"
  - [ ] Subtask 3.4: Log all errors with structured logging (winston)

### Frontend Tasks

- [ ] **Task 4: Create SessionModal component with shadcn/ui Dialog** (AC: #6-9)
  - [ ] Subtask 4.1: Create `frontend/src/components/SessionModal.tsx` using shadcn Dialog component
  - [ ] Subtask 4.2: Add session name input field with pre-filled auto-generated name (`feature-YYYY-MM-DD-NNN`)
  - [ ] Subtask 4.3: Add branch name input field (auto-filled from session name with `feature/` prefix)
  - [ ] Subtask 4.4: Implement auto-update logic: when session name changes, update branch name
  - [ ] Subtask 4.5: Add "Cancel" button (closes modal without action)
  - [ ] Subtask 4.6: Add "Create" button (sends POST request)
  - [ ] Subtask 4.7: Display loading spinner during session creation (3-5 seconds)
  - [ ] Subtask 4.8: Display error message in modal if creation fails (red text below inputs)

- [ ] **Task 5: Integrate SessionModal with UI layout** (AC: #6)
  - [ ] Subtask 5.1: Add "+ New Session" button to UI (location per UX spec - likely top bar or session list)
  - [ ] Subtask 5.2: Connect button click to open SessionModal
  - [ ] Subtask 5.3: Pass modal state to SessionContext for session creation
  - [ ] Subtask 5.4: Close modal on successful creation
  - [ ] Subtask 5.5: Update SessionContext to add new session to sessions array

- [ ] **Task 6: Implement session creation API call** (AC: #7-9)
  - [ ] Subtask 6.1: Create API client function `createSession(name, branch)` in frontend
  - [ ] Subtask 6.2: Send POST request to `/api/sessions` with JSON body
  - [ ] Subtask 6.3: Handle success response (200) - parse session object and add to context
  - [ ] Subtask 6.4: Handle error responses (400, 409, 500) - display error message in modal
  - [ ] Subtask 6.5: Implement loading state management (disable Create button during request)

### Testing Tasks

- [ ] **Task 7: Backend unit tests for session creation endpoint** (AC: All)
  - [ ] Subtask 7.1: Test valid session creation (200 response, session object returned)
  - [ ] Subtask 7.2: Test invalid session name (400 response, validation error)
  - [ ] Subtask 7.3: Test max sessions limit (400 response, error message)
  - [ ] Subtask 7.4: Test worktree creation failure (500 response, git error)
  - [ ] Subtask 7.5: Test duplicate branch name (409 response, conflict error)

- [ ] **Task 8: Frontend component tests for SessionModal** (AC: #6-9)
  - [ ] Subtask 8.1: Test modal opens on "+ New Session" button click
  - [ ] Subtask 8.2: Test auto-generated name pre-filled in input
  - [ ] Subtask 8.3: Test branch name auto-updates when session name changes
  - [ ] Subtask 8.4: Test Create button triggers API call
  - [ ] Subtask 8.5: Test error message displays on creation failure
  - [ ] Subtask 8.6: Test modal closes on successful creation

- [ ] **Task 9: Integration test for full session creation flow** (AC: All)
  - [ ] Subtask 9.1: E2E test: Open modal → Enter name → Click Create → Verify new session tab appears
  - [ ] Subtask 9.2: E2E test: Create session → Verify worktree exists on filesystem
  - [ ] Subtask 9.3: E2E test: Create session → Verify PTY process spawned
  - [ ] Subtask 9.4: E2E test: Create session with duplicate name → Verify error handling

## Dev Notes

### Architecture Patterns and Constraints

**Backend Session Creation Flow:**
1. REST endpoint validates input
2. SessionManager coordinates worktree + PTY creation
3. WorktreeManager creates git worktree (via simple-git)
4. PTYManager spawns Claude CLI process
5. SessionManager persists to JSON file (atomic write)
6. Return session object to frontend

**Frontend Modal Component:**
- Use shadcn/ui Dialog component for consistent UI
- Pre-fill session name with auto-generated format: `feature-YYYY-MM-DD-NNN`
- Auto-update branch name when session name changes (reactive binding)
- Loading spinner during creation (3-5 seconds expected per NFR-PERF-3)
- Error display inline in modal (red text below inputs per UX spec)

**Error Handling Strategy:**
- Input validation errors (400): "Session name must be alphanumeric with dashes, max 50 chars"
- Max sessions error (400): "Maximum 4 sessions supported. Destroy a session to create a new one."
- Duplicate branch error (409): "Branch already exists. Choose a different branch name."
- Git worktree errors (500): Show git stderr output for debugging

**Session Name Validation:**
- Regex: `/^[a-zA-Z0-9-]{1,50}$/`
- Examples valid: "feature-auth", "epic-2-story-3", "ui-polish-2025"
- Examples invalid: "feature_auth" (underscore), "feature auth" (space), "a".repeat(51) (too long)

**Auto-Generated Name Format:**
- Pattern: `feature-YYYY-MM-DD-NNN`
- Example: `feature-2025-11-24-001`, `feature-2025-11-24-002`
- Counter increments per day (reset daily)
- Implementation: Backend generates default name if not provided by frontend

### Project Structure Notes

**New Files to Create:**
- `backend/src/routes/sessions.ts` - Session REST API routes (optional, can add to server.ts)
- `frontend/src/components/SessionModal.tsx` - Session creation modal component
- `frontend/src/api/sessions.ts` - Session API client functions (optional, can add to hooks)

**Modified Files:**
- `backend/src/server.ts` - Add POST /api/sessions route
- `backend/src/sessionManager.ts` - Add createSession() method if not already exists
- `frontend/src/App.tsx` or layout component - Add "+ New Session" button and modal state
- `frontend/src/context/SessionContext.tsx` - Add createSession action

**Dependencies Already Available:**
- Backend: express, simple-git, node-pty, uuid, winston
- Frontend: shadcn/ui Dialog, React hooks, Tailwind CSS

### Testing Standards Summary

**Backend Testing:**
- Unit tests with Jest for sessionManager, route handlers
- Mock worktreeManager and ptyManager for isolation
- Integration tests with real git worktree creation (cleanup after test)

**Frontend Testing:**
- Component tests with Vitest + Testing Library
- Mock API calls with MSW or fetch mock
- E2E tests with Playwright for full flow

**Coverage Targets:**
- Backend session creation: 80%+ (critical path)
- Frontend SessionModal: 60%+ (UI component)

### References

**Architecture:**
- [Source: docs/architecture.md#API-Contracts] - REST endpoint definitions
- [Source: docs/architecture.md#Implementation-Patterns] - Communication patterns, error handling
- [Source: docs/architecture.md#Data-Architecture] - Session entity model

**Tech Spec:**
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Detailed-Design] - SessionManager, WorktreeManager APIs
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Workflows-and-Sequencing] - Session creation workflow (lines 313-358)
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Data-Models-and-Contracts] - Session interface, REST API contracts

**PRD:**
- [Source: docs/prd.md#Functional-Requirements] - FR8 (session creation), FR31 (+ New Session button), FR68 (error messages)
- [Source: docs/prd.md#Non-Functional-Requirements] - NFR-PERF-3 (session creation <5s), NFR-USE-3 (clear error messages)

**Epic:**
- [Source: docs/epics/epic-2-multi-session.md#Story-2.3] - Full acceptance criteria and technical notes

### Learnings from Previous Story

**From Epic 1 Stories (Last completed: 1-12-validation-with-real-project-workflows):**

Epic 1 established the foundational infrastructure that this story builds upon:

- **Backend Server Structure**: Express + WebSocket server already configured in `backend/src/server.ts`
  - Use existing server instance to add POST /api/sessions route
  - Follow established error handling patterns (asyncHandler wrapper)
  - Winston logger already configured for structured logging

- **Frontend Component Patterns**: shadcn/ui components already integrated
  - Dialog component available from shadcn/ui installation
  - Tailwind CSS configured with Oceanic Calm theme
  - Component structure: separate concerns, hooks for state, context for global state

- **SessionContext Pattern**: Epic 1 established React Context for state management
  - SessionContext likely stubbed or partially implemented
  - Add createSession() action to context
  - Follow existing context patterns (useContext hook, provider in App.tsx)

- **WebSocket Integration**: WebSocket protocol for terminal streaming already implemented
  - Session creation will need to integrate with existing WebSocket for PTY attachment
  - After session created, frontend should send session.attach message

- **Docker Environment**: Complete dev environment in container
  - Git already available for worktree operations
  - Node.js + npm available for backend
  - All CLI tools configured as safe (no approval prompts)

**Technical Debt to Be Aware Of:**
- TD-1 (ESC key listener scope) - FIXED in Epic 1
- TD-2 (Ubuntu 24.04 migration) - FIXED in Epic 1
- No pending tech debt affecting this story

**Key Files Created in Epic 1 to Reuse:**
- `backend/src/server.ts` - Express app and WebSocket server
- `backend/src/ptyManager.ts` - PTY process management (spawn, kill, I/O)
- `frontend/src/components/Terminal.tsx` - Terminal component with xterm.js
- `frontend/src/hooks/useWebSocket.ts` - WebSocket connection hook
- `frontend/src/context/SessionContext.tsx` - Session state management (likely stubbed)

**Patterns to Follow from Epic 1:**
- Error handling: Try-catch with structured logging, user-friendly error messages
- Async operations: Use async/await consistently
- Type safety: TypeScript strict mode, define interfaces for all data models
- Testing: Co-located tests with `.test.` suffix, Jest for backend, Vitest for frontend

[Source: docs/sprint-artifacts/sprint-status.yaml - Epic 1 stories all marked "done", retrospective completed]

## Dev Agent Record

### Context Reference

- Story Context: [2-3-session-creation-rest-api-and-modal-dialog.context.xml](2-3-session-creation-rest-api-and-modal-dialog.context.xml)

### Agent Model Used

<!-- Agent model information will be added during development -->

### Debug Log References

<!-- Debug log paths will be added during development -->

### Completion Notes List

<!-- Development completion notes will be added here -->

### File List

<!-- Files created/modified/deleted will be listed here -->
