# Story 4.14: Existing Branch Selection for Sessions

Status: drafted

## Story

As a developer working on multiple features,
I want to select an existing git branch when creating a new session,
so that I can continue work on an existing feature branch instead of always creating a new branch.

## Acceptance Criteria

1. **Branch selection UI in session modal**: Session creation modal shows dropdown/autocomplete for existing branches
   - Given: User clicks "New Session" button
   - When: Session creation modal opens
   - Then: Modal shows two options: "Create new branch" (default) OR "Select existing branch"
   - And: If "Select existing branch" is chosen, show dropdown/autocomplete of local branches
   - And: Dropdown filters out branches that already have active sessions
   - And: Dropdown shows branch name, last commit message, and last commit date
   - Validation: Session modal has branch selection UI with filtering

2. **Backend API accepts existing branch parameter**: POST /api/sessions accepts `existingBranch: boolean` and `branch: string`
   - Given: Frontend sends session create request
   - When: Request includes `{ existingBranch: true, branch: "feature/auth" }`
   - Then: Backend validates that branch exists locally
   - And: Backend creates new worktree pointing to existing branch (not creating new branch)
   - And: Backend checks out existing branch in new worktree directory
   - And: Session starts with PTY in existing branch worktree
   - Validation: API creates session with existing branch, no new branch created

3. **Worktree conflict detection**: Backend detects if existing branch already has a worktree
   - Given: User selects existing branch that has active worktree
   - When: Backend attempts to create session
   - Then: Backend returns 409 Conflict error
   - And: Error message explains: "Branch 'feature/auth' already has an active worktree in session 'session-123'"
   - And: Error suggests: "Stop the existing session first or choose a different branch"
   - Validation: Conflict detection prevents multiple worktrees on same branch

4. **Branch listing endpoint**: GET /api/git/branches returns list of local branches
   - Given: Frontend needs to populate branch dropdown
   - When: Frontend calls GET /api/git/branches
   - Then: Backend returns JSON array of branches with metadata:
     ```json
     {
       "branches": [
         {
           "name": "main",
           "fullName": "refs/heads/main",
           "hasActiveSession": false,
           "lastCommit": {
             "hash": "abc123",
             "message": "Initial commit",
             "author": "Kyle",
             "date": "2025-11-24T10:30:00.000Z"
           }
         }
       ]
     }
     ```
   - And: Response excludes branches with active sessions (hasActiveSession: true)
   - Validation: Branch listing endpoint provides complete metadata

5. **Session creation validates branch existence**: Backend validates selected branch exists
   - Given: User submits session creation with existing branch
   - When: Backend validates request
   - Then: Backend checks `git branch --list <branch-name>` returns result
   - And: If branch doesn't exist, return 400 Bad Request
   - And: Error message: "Branch 'feature/nonexistent' does not exist. Choose an existing branch or create a new one."
   - Validation: Non-existent branch rejected with helpful error

6. **Session list shows branch type indicator**: Session list distinguishes new vs. existing branches
   - Given: User has sessions created with new and existing branches
   - When: Session list renders
   - Then: Sessions show badge indicating "New branch" or "Existing branch"
   - And: Tooltip explains: "This session created a new branch" OR "This session uses an existing branch"
   - And: Visual distinction (icon or color) helps identify branch type at a glance
   - Validation: Session metadata includes branch type, UI displays it

7. **Existing branch default behavior**: Creating session on existing branch doesn't modify branch
   - Given: User selects existing branch "feature/auth" with commits
   - When: Session is created and PTY starts
   - Then: Worktree checks out existing branch at current HEAD
   - And: No new commits are created during session setup
   - And: Branch history is unchanged (user can git log to verify)
   - And: User can make commits in the session normally
   - Validation: Existing branch untouched by session creation

8. **Main/master branch protection**: Main/master branches require confirmation
   - Given: User selects "main" or "master" branch
   - When: User attempts to create session
   - Then: Modal shows warning: "You're about to work directly on 'main'. This is not recommended."
   - And: Warning suggests: "Create a feature branch instead or choose an existing feature branch."
   - And: User must check "I understand the risks" checkbox to proceed
   - And: If user cancels, session creation is aborted
   - Validation: Main/master branches require explicit confirmation

9. **Branch autocomplete filtering**: Branch dropdown supports type-ahead search
   - Given: User opens branch dropdown with 50+ branches
   - When: User types "auth" in search box
   - Then: Dropdown filters to branches matching "auth" (case-insensitive)
   - And: Matches can be in branch name anywhere (e.g., "feature/auth", "fix/auth-bug")
   - And: Dropdown shows max 20 results, sorted by last commit date (most recent first)
   - And: If no matches, show "No branches found matching 'auth'"
   - Validation: Branch filtering works with large branch lists

10. **Session destruction behavior unchanged**: Destroying session on existing branch doesn't delete branch
    - Given: User created session on existing branch "feature/auth"
    - When: User destroys session with "Delete worktree" checkbox checked
    - Then: Worktree directory is deleted (.worktrees/<session-id>)
    - And: Branch "feature/auth" remains in git (NOT deleted)
    - And: User can create new session on same branch again
    - And: Deleting session created on NEW branch still preserves branch (existing behavior)
    - Validation: Branch persistence regardless of creation method

## Tasks / Subtasks

- [ ] Task 1: Backend - Branch listing endpoint (AC: #4)
  - [ ] Subtask 1.1: Create GET /api/git/branches endpoint
    - Use simple-git library: `git.branchLocal()` to list branches
    - For each branch, get last commit metadata: `git.log(['-1', branchName])`
    - Cross-reference with active sessions to set hasActiveSession flag
    - Return JSON array with branch name, full ref, last commit info
  - [ ] Subtask 1.2: Add branch metadata extraction
    - Extract commit hash, message (truncate to 72 chars), author, date
    - Format date as ISO 8601 UTC
    - Handle branches with no commits (edge case: empty repository)
  - [ ] Subtask 1.3: Filter out branches with active sessions
    - Query SessionManager for all active sessions
    - Compare session.branch with branch names
    - Set hasActiveSession: true if match found
  - [ ] Subtask 1.4: Add error handling for git failures
    - If git command fails, return 500 with error message
    - Log git error details for debugging
    - Handle case where .git directory doesn't exist (shouldn't happen in typical usage)
  - [ ] Subtask 1.5: Write unit tests for branch listing
    - Mock simple-git library
    - Test: Returns branch list with metadata
    - Test: Filters out branches with active sessions
    - Test: Handles git errors gracefully
    - Test: Handles empty repository (no branches)

- [ ] Task 2: Backend - Existing branch session creation (AC: #2, #3, #5, #7)
  - [ ] Subtask 2.1: Extend POST /api/sessions to accept existingBranch parameter
    - Update request schema: `{ name?: string, branch?: string, existingBranch?: boolean }`
    - If existingBranch: true, validate branch parameter is provided
    - If existingBranch: true, skip branch name validation (allow slashes, etc.)
  - [ ] Subtask 2.2: Validate existing branch exists
    - Use simple-git: `git.branchLocal()` to check branch exists
    - If branch doesn't exist, return 400 Bad Request with error message
    - Error format: { error: { type: 'git', message: '...', suggestion: '...' } }
  - [ ] Subtask 2.3: Check for worktree conflict
    - Query WorktreeManager for all worktrees: `git worktree list`
    - Check if any worktree is on the same branch
    - If conflict found, return 409 Conflict with session ID and error message
    - Error message: "Branch 'X' already has an active worktree in session 'Y'"
  - [ ] Subtask 2.4: Create worktree for existing branch (no new branch)
    - Use git worktree add WITHOUT -b flag: `git worktree add <path> <existing-branch>`
    - Verify checkout succeeds (worktree directory created, HEAD points to branch)
    - Store session metadata: { ...session, branchType: 'existing' }
  - [ ] Subtask 2.5: Update session metadata to track branch type
    - Add branchType field to Session interface: 'new' | 'existing'
    - Set branchType: 'new' for sessions created with new branch
    - Set branchType: 'existing' for sessions using existing branch
    - Persist branchType in session JSON
  - [ ] Subtask 2.6: Write integration tests for existing branch flow
    - Test: Create session on existing branch succeeds
    - Test: Create session on non-existent branch fails (400)
    - Test: Create session on branch with active worktree fails (409)
    - Test: Session worktree points to correct branch
    - Test: Branch history unchanged after session creation

- [ ] Task 3: Frontend - Branch selection UI in session modal (AC: #1, #9)
  - [ ] Subtask 3.1: Add branch selection mode toggle to SessionModal
    - Add radio buttons: "Create new branch" (default) OR "Use existing branch"
    - State: `const [mode, setMode] = useState<'new' | 'existing'>('new')`
    - Show branch name input (text) when mode === 'new'
    - Show branch dropdown (autocomplete) when mode === 'existing'
  - [ ] Subtask 3.2: Fetch branch list from backend on modal open
    - Call GET /api/git/branches when modal opens
    - Store branches in state: `const [branches, setBranches] = useState<Branch[]>([])`
    - Show loading spinner while fetching
    - Handle fetch errors (show error message, fall back to manual input)
  - [ ] Subtask 3.3: Implement branch autocomplete dropdown
    - Use shadcn/ui Combobox or Select component
    - Filter branches by user input (case-insensitive substring match)
    - Show max 20 results, sorted by last commit date (most recent first)
    - Display: branch name, last commit message (truncated), last commit date (relative time)
    - If no matches, show "No branches found matching '...'"
  - [ ] Subtask 3.4: Handle branch selection
    - When user selects branch, set form.branch = selectedBranch.name
    - Disable branch name editing when existing branch selected (read-only display)
    - Show selected branch metadata below dropdown (commit message, author, date)
  - [ ] Subtask 3.5: Update session creation request payload
    - If mode === 'existing', include { existingBranch: true, branch: form.branch }
    - If mode === 'new', include { existingBranch: false, branch: form.branch } (or omit)
  - [ ] Subtask 3.6: Handle error responses
    - 400 Bad Request (branch doesn't exist): Show error toast, keep modal open
    - 409 Conflict (worktree exists): Show error toast with session ID, suggest stopping session
    - 500 Internal Server Error: Show generic error, allow retry
  - [ ] Subtask 3.7: Write component tests for branch selection UI
    - Test: Mode toggle switches between new/existing branch UI
    - Test: Branch list fetched on modal open
    - Test: Autocomplete filters branches correctly
    - Test: Selected branch populates form correctly
    - Test: Error responses handled gracefully

- [ ] Task 4: Frontend - Main/master branch protection (AC: #8)
  - [ ] Subtask 4.1: Detect main/master branch selection
    - When user selects branch in dropdown, check if branch.name === 'main' || branch.name === 'master'
    - If true, show warning alert component in modal
  - [ ] Subtask 4.2: Add warning alert component
    - Alert message: "You're about to work directly on 'main'. This is not recommended."
    - Suggestion: "Create a feature branch instead or choose an existing feature branch."
    - Checkbox: "I understand the risks"
    - State: `const [mainBranchConfirmed, setMainBranchConfirmed] = useState(false)`
  - [ ] Subtask 4.3: Disable submit button until confirmed
    - If main/master selected AND !mainBranchConfirmed, disable "Create Session" button
    - Show tooltip on disabled button: "Check the confirmation box to proceed"
  - [ ] Subtask 4.4: Reset confirmation on branch change
    - When user changes branch selection, reset mainBranchConfirmed = false
    - If new branch is not main/master, hide warning alert
  - [ ] Subtask 4.5: Write tests for main/master protection
    - Test: Warning shows when main/master selected
    - Test: Submit button disabled until confirmation
    - Test: Confirmation resets when branch changed
    - Test: Warning hides for non-main/master branches

- [ ] Task 5: Frontend - Session list branch type indicator (AC: #6)
  - [ ] Subtask 5.1: Update Session type to include branchType field
    - Extend frontend Session interface: `branchType?: 'new' | 'existing'`
    - Default to 'new' for backward compatibility (sessions without field)
  - [ ] Subtask 5.2: Add branch type badge to SessionList component
    - For each session, show badge next to branch name
    - If branchType === 'new': Show badge with icon (e.g., GitBranch + Plus) and text "New"
    - If branchType === 'existing': Show badge with icon (e.g., GitBranch) and text "Existing"
    - Badge color: New = #88C0D0 (blue), Existing = #A3BE8C (green)
  - [ ] Subtask 5.3: Add tooltip explaining branch type
    - Tooltip for "New": "This session created a new branch"
    - Tooltip for "Existing": "This session uses an existing branch"
  - [ ] Subtask 5.4: Write tests for branch type indicator
    - Test: "New" badge shown for branchType: 'new'
    - Test: "Existing" badge shown for branchType: 'existing'
    - Test: Default to "New" badge if branchType missing (backward compatibility)

- [ ] Task 6: Backend - Session destruction preserves branch (AC: #10)
  - [ ] Subtask 6.1: Verify current behavior doesn't delete branches
    - Review WorktreeManager.delete() logic
    - Confirm: git worktree remove only deletes worktree directory, not branch
    - Confirm: Session metadata deletion doesn't affect git branches
  - [ ] Subtask 6.2: Add test for branch preservation on session destruction
    - Test: Create session on existing branch, destroy session with deleteWorktree: true
    - Verify: Worktree deleted, branch still exists in git
    - Test: Create session on new branch, destroy session with deleteWorktree: true
    - Verify: Worktree deleted, branch still exists in git (existing behavior confirmed)
  - [ ] Subtask 6.3: Update documentation if behavior differs
    - If branch deletion behavior is inconsistent, document expected behavior
    - Update troubleshooting guide with branch cleanup instructions

- [ ] Task 7: Integration testing for existing branch workflow (AC: all)
  - [ ] Subtask 7.1: E2E test - Create session on existing branch
    - Test flow: Open modal → Select "Use existing branch" → Pick branch → Create session
    - Verify: Session created successfully, terminal opens, worktree points to branch
  - [ ] Subtask 7.2: E2E test - Conflict detection for active worktree
    - Test flow: Create session on branch A → Try to create second session on same branch
    - Verify: Error toast shows conflict message with first session ID
  - [ ] Subtask 7.3: E2E test - Main branch protection
    - Test flow: Select main branch → Warning shows → Checkbox required → Session created after confirmation
    - Verify: Warning UI works, confirmation required, session created on main
  - [ ] Subtask 7.4: E2E test - Branch autocomplete filtering
    - Test flow: Open branch dropdown → Type filter text → Verify filtered results
    - Verify: Autocomplete filters correctly, shows max 20 results
  - [ ] Subtask 7.5: E2E test - Session destruction preserves branch
    - Test flow: Create session on existing branch → Make commits → Destroy session with deleteWorktree
    - Verify: Worktree deleted, branch and commits preserved in git

- [ ] Task 8: Documentation updates (AC: all)
  - [ ] Subtask 8.1: Update README with existing branch instructions
    - Add section: "Using Existing Branches"
    - Explain: When to create new vs. use existing branch
    - Explain: Worktree conflict detection
  - [ ] Subtask 8.2: Update troubleshooting guide
    - Add issue: "Can't create session on existing branch (409 conflict)"
    - Solution: Stop active session or choose different branch
    - Add issue: "Branch not showing in dropdown"
    - Solution: Ensure branch exists locally (git fetch if needed)
  - [ ] Subtask 8.3: Update API documentation
    - Document GET /api/git/branches endpoint
    - Document existingBranch parameter for POST /api/sessions
    - Document 409 Conflict error for worktree conflicts

## Dev Notes

### Architecture Patterns and Constraints

**From Architecture (docs/architecture.md)**:

**Session Management (FR8-FR15 section)**:
- Current behavior: Auto-generated names (`feature-YYYY-MM-DD-NNN`), always create NEW branch
- Story 4.14 extends: Allow selecting EXISTING branch, skip new branch creation
- Session state persisted to `/workspace/.claude-container-sessions.json`

**Git Worktree Management (FR16-FR20 section)**:
- Each session gets isolated worktree at `/workspace/.worktrees/<session-id>`
- Current: New branch created with `git worktree add -b <branch> <path>`
- Story 4.14 change: Use `git worktree add <path> <existing-branch>` (no -b flag)
- Worktree conflict detection required: git worktree list shows active worktrees

**WebSocket Protocol (ADR-013)**:
- Message format: `resource.action`
- No new WebSocket messages needed for this story (REST API only)
- Session creation still uses existing session.created message

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Story 4.14 is in Out-of-Scope for Epic 4**:
- "Existing branch selection for sessions" listed as backlog item (4-14)
- This story is a post-Epic 4 enhancement
- No direct Epic 4 dependencies (can be implemented independently)

**Session Entity (Data Models section)**:
```typescript
interface Session {
  id: string;
  name: string;
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  branch: string;
  worktreePath: string;
  ptyPid?: number;
  createdAt: string;
  lastActivity: string;
  currentPhase?: string;
  metadata?: object;
}
```
- Story 4.14 extends: Add `branchType: 'new' | 'existing'` to metadata or top-level field

**Error Response Format (APIs and Interfaces section)**:
```typescript
interface ErrorResponse {
  error: {
    type: 'validation' | 'git' | 'pty' | 'resource' | 'internal';
    message: string;
    details?: string;
    suggestion?: string;
    code?: string;
  }
}
```
- Story 4.14 uses: 400 Bad Request for non-existent branch, 409 Conflict for worktree conflict

### Project Structure Notes

**Files to Create:**
```
backend/src/
└── routes/
    └── git.ts                         # New: GET /api/git/branches endpoint

frontend/src/
└── components/
    ├── SessionModal.tsx               # MODIFIED: Add branch selection UI
    ├── SessionList.tsx                # MODIFIED: Add branch type badge
    └── BranchSelector.tsx             # New: Branch autocomplete component (optional, can inline)
```

**Files to Modify:**
```
backend/src/
├── server.ts                          # MODIFIED: Add /api/git routes
├── sessionManager.ts                  # MODIFIED: Accept existingBranch param, add branchType field
├── worktreeManager.ts                 # MODIFIED: Support existing branch worktree creation
└── types.ts                           # MODIFIED: Add branchType to Session interface

frontend/src/
├── types.ts                           # MODIFIED: Add branchType to Session interface
└── components/
    └── SessionModal.tsx               # MODIFIED: Branch selection mode toggle, autocomplete
```

**Dependencies (No new packages required)**:
- Backend: simple-git (already installed) - used for git branch listing
- Frontend: shadcn/ui Combobox or Select (already available) - for branch autocomplete

### Implementation Guidance

**Git Worktree Commands:**

Create worktree with NEW branch (existing behavior):
```bash
git worktree add -b feature/new-branch /workspace/.worktrees/session-123
```

Create worktree with EXISTING branch (Story 4.14):
```bash
git worktree add /workspace/.worktrees/session-123 feature/existing-branch
```

List worktrees to detect conflicts:
```bash
git worktree list
# Output:
# /workspace                           abc123 [main]
# /workspace/.worktrees/session-123    def456 [feature/existing-branch]
```

List local branches with last commit:
```bash
git branch --format='%(refname:short)|%(objectname:short)|%(subject)|%(authorname)|%(committerdate:iso8601)'
# Output:
# main|abc123|Initial commit|Kyle|2025-11-24 10:30:00 -0800
# feature/auth|def456|Add auth service|Kyle|2025-11-25 09:15:00 -0800
```

**simple-git API:**

List branches:
```typescript
const branches = await git.branchLocal();
// Returns: { all: string[], branches: { [name: string]: BranchSummary }, current: string }
```

Get last commit for branch:
```typescript
const log = await git.log(['-1', branchName]);
// Returns: { latest: CommitSummary, total: number, all: CommitSummary[] }
```

**Worktree Conflict Detection Logic:**

```typescript
// In WorktreeManager.ts
async hasWorktreeForBranch(branchName: string): Promise<{ hasWorktree: boolean, sessionId?: string }> {
  const worktrees = await this.git.raw(['worktree', 'list', '--porcelain']);
  const lines = worktrees.split('\n');

  // Parse porcelain output for branch references
  let currentWorktree = { path: '', branch: '' };
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentWorktree.path = line.replace('worktree ', '');
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.replace('branch refs/heads/', '');

      if (currentWorktree.branch === branchName) {
        // Extract session ID from worktree path
        const sessionId = path.basename(currentWorktree.path);
        return { hasWorktree: true, sessionId };
      }
    }
  }

  return { hasWorktree: false };
}
```

**Branch Filtering Logic (Frontend):**

```typescript
// In BranchSelector component or SessionModal
function filterBranches(branches: Branch[], query: string): Branch[] {
  const lowerQuery = query.toLowerCase();

  return branches
    .filter(branch => branch.name.toLowerCase().includes(lowerQuery))
    .filter(branch => !branch.hasActiveSession)  // Exclude active sessions
    .sort((a, b) => {
      // Sort by last commit date, most recent first
      return new Date(b.lastCommit.date).getTime() - new Date(a.lastCommit.date).getTime();
    })
    .slice(0, 20);  // Max 20 results
}
```

**Session Modal State Management:**

```typescript
// In SessionModal.tsx
const [mode, setMode] = useState<'new' | 'existing'>('new');
const [branches, setBranches] = useState<Branch[]>([]);
const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
const [mainBranchConfirmed, setMainBranchConfirmed] = useState(false);

// Fetch branches on modal open
useEffect(() => {
  if (isOpen && mode === 'existing') {
    fetchBranches();
  }
}, [isOpen, mode]);

async function fetchBranches() {
  const response = await fetch('/api/git/branches');
  const data = await response.json();
  setBranches(data.branches);
}

// Handle branch selection
function handleBranchSelect(branch: Branch) {
  setSelectedBranch(branch);
  formik.setFieldValue('branch', branch.name);

  // Reset main branch confirmation if switching away from main
  if (!['main', 'master'].includes(branch.name)) {
    setMainBranchConfirmed(false);
  }
}

// Submit handler
async function handleSubmit(values: FormValues) {
  const payload = {
    name: values.name,
    branch: values.branch,
    existingBranch: mode === 'existing'
  };

  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    // Handle 400 (branch doesn't exist) or 409 (worktree conflict)
    showErrorToast(error.error.message);
    return;
  }

  // Success - close modal, refresh session list
}
```

**Backend Session Creation Logic Update:**

```typescript
// In sessionManager.ts
async createSession(options: {
  name?: string,
  branch?: string,
  existingBranch?: boolean
}): Promise<Session> {
  const { name, branch, existingBranch = false } = options;

  // Generate session ID and name
  const sessionId = uuid();
  const sessionName = name || this.generateSessionName();

  // Determine branch name
  let branchName: string;
  let branchType: 'new' | 'existing';

  if (existingBranch) {
    // Validate branch exists
    const branches = await this.git.branchLocal();
    if (!branches.all.includes(branch!)) {
      throw new ValidationError(`Branch '${branch}' does not exist. Choose an existing branch or create a new one.`);
    }

    // Check for worktree conflict
    const { hasWorktree, sessionId: conflictSessionId } = await this.worktreeManager.hasWorktreeForBranch(branch!);
    if (hasWorktree) {
      throw new ConflictError(`Branch '${branch}' already has an active worktree in session '${conflictSessionId}'`);
    }

    branchName = branch!;
    branchType = 'existing';
  } else {
    // Create new branch (existing behavior)
    branchName = branch || `feature/${sessionName}`;
    branchType = 'new';
  }

  // Create worktree (new or existing branch)
  const worktreePath = await this.worktreeManager.create({
    sessionId,
    branchName,
    createNewBranch: !existingBranch
  });

  // Spawn PTY process
  const ptyPid = await this.ptyManager.spawn({ sessionId, cwd: worktreePath });

  // Create session object
  const session: Session = {
    id: sessionId,
    name: sessionName,
    status: 'active',
    branch: branchName,
    worktreePath,
    ptyPid,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    metadata: { branchType }
  };

  // Save session
  this.sessions.set(sessionId, session);
  await this.saveSessions();

  return session;
}
```

**Error Handling Examples:**

400 Bad Request (branch doesn't exist):
```json
{
  "error": {
    "type": "validation",
    "message": "Branch 'feature/nonexistent' does not exist.",
    "suggestion": "Choose an existing branch from the dropdown or create a new branch."
  }
}
```

409 Conflict (worktree exists):
```json
{
  "error": {
    "type": "git",
    "message": "Branch 'feature/auth' already has an active worktree in session 'session-abc123'.",
    "suggestion": "Stop the existing session first or choose a different branch.",
    "code": "WORKTREE_CONFLICT",
    "details": {
      "branch": "feature/auth",
      "conflictingSessionId": "session-abc123"
    }
  }
}
```

**UI/UX Considerations:**

- Branch selection mode should be prominent (radio buttons at top of modal)
- Autocomplete dropdown should show rich metadata (branch name, last commit message, relative time)
- Main/master warning should be visually distinct (yellow alert banner)
- Error messages should be actionable (suggest stopping conflicting session with link/button)
- Loading state while fetching branches (spinner in dropdown)
- Empty state if no branches exist (suggest creating new branch)

**Testing Strategy:**

Unit Tests:
- Backend: Branch listing logic, worktree conflict detection, existing branch validation
- Frontend: Branch filtering, mode toggle, main branch confirmation

Integration Tests:
- Full session creation flow with existing branch
- Conflict detection when branch has active worktree
- Branch listing endpoint with active session filtering

E2E Tests:
- User creates session on existing branch (happy path)
- User encounters conflict (active worktree), gets helpful error
- User selects main branch, sees warning, confirms, session created
- Branch autocomplete filters correctly with large branch list

### Learnings from Previous Story

**From Story 4-13-production-validation-with-daily-use (Status: drafted)**

**No Implementation Learnings Yet:**
- Story 4.13 is still in "drafted" status (not implemented)
- This is a validation-only story with no code changes
- Story 4.14 can proceed independently as new feature

**Documentation Available (from Story 4.12):**
- README.md: Quick Start guide for container setup
- docs/troubleshooting.md: Common issues and solutions
- docs/api.md: REST and WebSocket API documentation
- docs/websocket-protocol.md: WebSocket message types

**Integration with Story 4.14:**
- Story 4.14 should update API documentation (docs/api.md) with new endpoint
- Story 4.14 should update troubleshooting guide with branch conflict resolution
- Story 4.14 should update README with existing branch usage instructions

**No Code Dependencies:**
- Story 4.13 is validation-only (no new features)
- Story 4.14 is independent feature (existing branch selection)
- No conflicts or blocking dependencies

### References

- [Source: docs/architecture.md#FR-Category-to-Architecture-Mapping] - Session Management (FR8-FR15), Git Worktree Management (FR16-FR20)
- [Source: docs/architecture.md#ADR-008] - simple-git for Git Worktree Management
- [Source: docs/architecture.md#ADR-009] - Flat JSON File for Session Persistence
- [Source: docs/architecture.md#ADR-012] - Session Lifecycle Management Patterns (SessionManager → WorktreeManager)
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Out-of-Scope] - Story 4.14 listed as out-of-scope for Epic 4
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - Session Entity structure
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#APIs-and-Interfaces] - Error Response Format
- [Source: docs/sprint-artifacts/4-13-production-validation-with-daily-use.md#Dev-Notes] - Documentation suite available for updates
- [Source: docs/sprint-artifacts/sprint-status.yaml] - Story 4.14 status: backlog

## Change Log

**2025-11-25**:
- Story created from Epic 4 backlog item 4-14-existing-branch-selection-for-sessions
- Status: drafted
- Previous story learnings: Story 4.13 is validation-only, no code dependencies
- Core functionality: Allow selecting existing git branches for session creation
- 10 acceptance criteria defined covering UI, backend API, conflict detection, branch protection
- 8 tasks with detailed subtasks for implementation
- Branch selection UI with autocomplete, main/master protection, worktree conflict detection
- Backend API extended with GET /api/git/branches and existingBranch parameter
- Session metadata extended with branchType field ('new' | 'existing')
- Documentation updates for README, troubleshooting guide, API docs
- Ready for story-context generation and implementation

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
