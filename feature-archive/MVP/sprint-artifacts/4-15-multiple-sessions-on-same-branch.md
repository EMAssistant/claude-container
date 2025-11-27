# Story 4.15: Multiple Sessions on Same Branch

Status: drafted

## Story

As a developer managing complex features,
I want to create multiple sessions working on the same git branch,
so that I can work on different aspects of a feature simultaneously without branch context switching.

## Acceptance Criteria

1. **Backend allows multiple sessions on same branch**: SessionManager allows creating multiple sessions with identical branch names
   - Given: User creates session 1 on branch "feature/auth"
   - When: User creates session 2 selecting the same branch "feature/auth"
   - Then: Backend creates second worktree pointing to same branch (different worktree path)
   - And: Both sessions can operate independently without conflicts
   - And: Each session has isolated worktree directory: `.worktrees/<session-1-id>`, `.worktrees/<session-2-id>`
   - Validation: Multiple worktrees for same branch exist, no 409 Conflict error

2. **Worktree conflict detection removed**: Backend removes worktree-per-branch restriction from Story 4.14
   - Given: Backend previously blocked multiple worktrees on same branch (Story 4.14 AC#3)
   - When: Creating session with existing branch that has active worktree
   - Then: Backend creates new worktree without throwing 409 Conflict error
   - And: `hasWorktreeForBranch()` check is bypassed or removed
   - Validation: No conflict error when creating second session on occupied branch

3. **Git worktree supports multiple instances per branch**: WorktreeManager creates separate worktrees for same branch
   - Given: Branch "feature/auth" already has worktree at `.worktrees/session-abc`
   - When: Creating second session on "feature/auth"
   - Then: WorktreeManager executes: `git worktree add /workspace/.worktrees/session-def feature/auth`
   - And: Git accepts command (git supports multiple worktrees per branch by default)
   - And: Both worktrees checkout same branch at current HEAD
   - Validation: `git worktree list` shows two worktrees for same branch

4. **Session list shows branch sharing indicator**: UI indicates when multiple sessions share a branch
   - Given: Two sessions on branch "feature/auth"
   - When: Session list renders
   - Then: Each session shows shared branch badge/icon (e.g., GitBranch with "2" count)
   - And: Tooltip explains: "2 sessions sharing branch 'feature/auth'"
   - And: Color distinction: Shared branch badge = #EBCB8B (yellow/caution)
   - Validation: Badge visible, tooltip accurate

5. **Warning message about concurrent work on same branch**: UI warns user about shared branch risks
   - Given: User selects existing branch in session creation modal
   - When: Branch already has active session(s)
   - Then: Modal shows info alert: "Branch 'feature/auth' is already being used by session 'Session 1'. Working on the same branch in multiple sessions can lead to conflicts."
   - And: Alert suggests: "Consider creating a new branch or using a different existing branch."
   - And: User can proceed without blocking (informational only, not error)
   - Validation: Warning displayed, session creation proceeds if confirmed

6. **Branch API returns session count per branch**: GET /api/git/branches includes session count
   - Given: Two active sessions on "feature/auth", one on "feature/payments"
   - When: Frontend calls GET /api/git/branches
   - Then: Response includes sessionCount per branch:
     ```json
     {
       "branches": [
         {
           "name": "feature/auth",
           "sessionCount": 2,
           "activeSessions": ["Session 1", "Session 2"],
           ...
         },
         {
           "name": "feature/payments",
           "sessionCount": 1,
           "activeSessions": ["Session 3"],
           ...
         }
       ]
     }
     ```
   - And: sessionCount = 0 for branches with no active sessions
   - Validation: API returns accurate session counts

7. **No worktree cleanup conflict**: Destroying one session doesn't affect other sessions on same branch
   - Given: Two sessions on "feature/auth": session-1 and session-2
   - When: User destroys session-1 with "Delete worktree" checked
   - Then: Only `.worktrees/session-1/` directory is deleted
   - And: `.worktrees/session-2/` remains intact and functional
   - And: session-2 terminal continues working without interruption
   - And: Branch "feature/auth" is NOT deleted (remains in git)
   - Validation: session-2 unaffected, worktree-1 deleted, worktree-2 active

8. **Git operations don't interfere between sessions**: Commits in one session visible in others after refresh
   - Given: Two sessions on "feature/auth"
   - When: User commits changes in session-1: `git commit -m "Add feature"`
   - Then: Commit is recorded on branch "feature/auth"
   - And: session-2 terminal can see new commit with `git log` (after `git fetch` or without if same repo)
   - And: session-2 working directory unchanged (doesn't auto-update)
   - And: User can `git pull` in session-2 to update worktree to latest commit
   - Validation: Commits visible across sessions, worktrees remain independent

9. **Merge conflict handling**: UI explains merge conflicts when multiple sessions modify same files
   - Given: Two sessions on "feature/auth", both modify `index.ts`
   - When: session-1 commits changes, session-2 attempts to commit
   - Then: session-2 shows git conflict error in terminal (standard git behavior)
   - And: Error message preserved (no special handling, git handles it)
   - And: User resolves conflict manually in session-2 terminal
   - Note: This is standard git behavior, no special implementation needed
   - Validation: Git merge conflicts handled normally by git itself

10. **Session metadata tracks shared branch status**: Session JSON includes shared branch indicator
    - Given: Session created on branch with existing session(s)
    - When: Session is saved to `.claude-container-sessions.json`
    - Then: Session metadata includes: `sharedBranch: true` (or false if exclusive)
    - And: Metadata includes: `branchSessionCount: 2` (number of sessions on branch)
    - And: Metadata persists across container restarts
    - Validation: Session JSON has sharedBranch field, count accurate

## Tasks / Subtasks

- [ ] Task 1: Backend - Remove worktree conflict detection (AC: #1, #2)
  - [ ] Subtask 1.1: Update sessionManager.ts createSession method
    - Remove call to `worktreeManager.hasWorktreeForBranch()` (Story 4.14 code)
    - Or modify to return info only, not throw error
    - Allow session creation regardless of existing worktrees on branch
  - [ ] Subtask 1.2: Update WorktreeManager to support multiple worktrees per branch
    - Verify `git worktree add <path> <branch>` command works multiple times for same branch
    - Test: Create two worktrees for "feature/test-branch", verify both exist
    - Ensure worktree paths remain unique (already unique by session ID)
  - [ ] Subtask 1.3: Add session count tracking to SessionManager
    - Add method: `getSessionsByBranch(branchName): Session[]`
    - Returns all sessions with matching branch name
    - Used for session count in metadata and API
  - [ ] Subtask 1.4: Update Session interface with shared branch metadata
    - Add `sharedBranch: boolean` to Session interface (backend and frontend types.ts)
    - Add `branchSessionCount: number` to Session interface
    - Compute on session creation: `sharedBranch = getSessionsByBranch(branch).length > 1`
  - [ ] Subtask 1.5: Write unit tests for multi-session same-branch
    - Test: Create two sessions on same branch, both succeed
    - Test: getSessionsByBranch returns correct sessions
    - Test: sharedBranch and branchSessionCount computed correctly
    - Test: Session creation no longer throws 409 for branch conflict

- [ ] Task 2: Backend - Extend branch listing API with session counts (AC: #6)
  - [ ] Subtask 2.1: Update GET /api/git/branches endpoint
    - For each branch, compute sessionCount: `getSessionsByBranch(branch.name).length`
    - Add sessionCount field to branch response object
    - Add activeSessions field: array of session names using that branch
  - [ ] Subtask 2.2: Update Branch interface (types.ts)
    - Add `sessionCount: number` to Branch interface
    - Add `activeSessions: string[]` to Branch interface (session names)
  - [ ] Subtask 2.3: Write unit tests for branch API session counts
    - Test: Branch with 0 sessions returns sessionCount: 0
    - Test: Branch with 2 sessions returns sessionCount: 2, activeSessions: ['S1', 'S2']
    - Test: Multiple branches with different session counts

- [ ] Task 3: Frontend - Shared branch warning in session modal (AC: #5)
  - [ ] Subtask 3.1: Detect shared branch in SessionModal
    - When user selects existing branch, check branch.sessionCount from API response
    - If sessionCount > 0, set showSharedBranchWarning = true
  - [ ] Subtask 3.2: Add shared branch warning alert component
    - Alert message: "Branch 'X' is already being used by session 'Y'. Working on the same branch in multiple sessions can lead to conflicts."
    - Suggestion: "Consider creating a new branch or using a different existing branch."
    - Alert type: info (yellow, not error red)
    - No blocking: User can still create session (informational only)
  - [ ] Subtask 3.3: Display active session names in warning
    - Show activeSessions list in warning message
    - Format: "Branch 'feature/auth' is used by: Session 1, Session 2"
    - Make session names clickable to focus that session (optional enhancement)
  - [ ] Subtask 3.4: Write tests for shared branch warning
    - Test: Warning shows when sessionCount > 0
    - Test: Warning hides when sessionCount === 0
    - Test: Active session names displayed correctly
    - Test: User can proceed with session creation despite warning

- [ ] Task 4: Frontend - Shared branch indicator in session list (AC: #4)
  - [ ] Subtask 4.1: Update SessionList component to show shared branch badge
    - For each session, check session.sharedBranch or session.branchSessionCount > 1
    - If shared, show badge next to branch name
    - Badge icon: GitBranch with numeric badge overlay (count)
    - Badge color: #EBCB8B (yellow/caution from Oceanic Calm palette)
  - [ ] Subtask 4.2: Add tooltip explaining shared branch
    - Tooltip text: "X sessions sharing branch 'branch-name'"
    - Show all session names sharing the branch
    - Format: "2 sessions sharing 'feature/auth': Session 1, Session 2"
  - [ ] Subtask 4.3: Update session tabs to show shared branch indicator
    - Similar badge on tab bar (smaller, compact)
    - Consistent styling with session list badge
  - [ ] Subtask 4.4: Write tests for shared branch indicator
    - Test: Badge shows when sharedBranch: true
    - Test: Badge count matches branchSessionCount
    - Test: Tooltip text accurate
    - Test: Badge hides when sharedBranch: false

- [ ] Task 5: Backend - Session destruction cleanup verification (AC: #7)
  - [ ] Subtask 5.1: Review WorktreeManager.delete() logic
    - Verify: Only deletes specified worktree path (already scoped by sessionId)
    - Verify: Does NOT delete branch (git worktree remove only deletes worktree dir)
    - Verify: Does NOT affect other worktrees on same branch
  - [ ] Subtask 5.2: Write integration tests for multi-session cleanup
    - Test: Create 2 sessions on "feature/test", destroy 1st, verify 2nd still works
    - Test: Destroy session with deleteWorktree=true, verify branch remains
    - Test: Destroy session with deleteWorktree=false, verify worktree removed but branch remains
    - Test: Destroy all sessions on branch, verify branch still exists in git

- [ ] Task 6: Integration testing for shared branch workflow (AC: all)
  - [ ] Subtask 6.1: E2E test - Create multiple sessions on same branch
    - Test flow: Create session 1 on "feature/test" → Create session 2 on same branch
    - Verify: Both sessions active, both worktrees exist, no conflict error
  - [ ] Subtask 6.2: E2E test - Shared branch warning displayed
    - Test flow: Create session 1 on branch → Create session 2, select same branch
    - Verify: Warning message appears with correct session names
  - [ ] Subtask 6.3: E2E test - Shared branch badge shown
    - Test flow: Create 2 sessions on same branch → Check session list
    - Verify: Both sessions show shared badge with count "2"
  - [ ] Subtask 6.4: E2E test - Git operations across sessions
    - Test flow: Session 1 commits file → Session 2 runs git log
    - Verify: Commit visible in session 2 (git log shows it)
  - [ ] Subtask 6.5: E2E test - Session cleanup doesn't affect siblings
    - Test flow: 2 sessions on branch → Destroy session 1 with deleteWorktree
    - Verify: Session 2 still functional, worktree 1 deleted, worktree 2 intact

- [ ] Task 7: Documentation updates (AC: all)
  - [ ] Subtask 7.1: Update README with shared branch usage
    - Add section: "Working with Multiple Sessions on the Same Branch"
    - Explain: When to use (complex features, parallel exploration)
    - Explain: Risks (merge conflicts, coordination needed)
    - Explain: Best practices (communicate, commit often, pull frequently)
  - [ ] Subtask 7.2: Update troubleshooting guide
    - Add issue: "Merge conflicts when working on same branch in multiple sessions"
    - Solution: Standard git conflict resolution (git status, resolve markers, git add, git commit)
    - Add issue: "Session 2 doesn't see Session 1's commits"
    - Solution: Run `git pull` in Session 2 terminal to sync worktree
  - [ ] Subtask 7.3: Update API documentation
    - Document updated GET /api/git/branches response (sessionCount, activeSessions)
    - Document Session interface changes (sharedBranch, branchSessionCount)
    - Note removal of 409 Conflict error for same-branch sessions

## Dev Notes

### Architecture Patterns and Constraints

**From Architecture (docs/architecture.md)**:

**Git Worktree Management (FR16-FR20 section)**:
- Current behavior (Story 4.14): Worktree conflict detection prevents multiple sessions per branch
- Story 4.15 change: Remove conflict detection, allow multiple worktrees per branch
- Each session still gets isolated worktree at `/workspace/.worktrees/<session-id>`
- Git natively supports multiple worktrees on same branch (no git limitation)
- Command: `git worktree add /workspace/.worktrees/<session-id> <existing-branch>`

**Session Management (FR8-FR15 section)**:
- Session state persisted to `/workspace/.claude-container-sessions.json`
- Story 4.15 extends Session interface: `sharedBranch: boolean`, `branchSessionCount: number`
- Max 4 concurrent sessions (unchanged, applies across all branches)

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

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
  metadata?: {
    branchType?: 'new' | 'existing';  // From Story 4.14
    sharedBranch?: boolean;            // NEW in Story 4.15
    branchSessionCount?: number;       // NEW in Story 4.15
  };
}
```

**Error Response Format (APIs and Interfaces section)**:
Story 4.15 removes 409 Conflict error for worktree conflicts (introduced in Story 4.14)

**ADR-008: simple-git for Git Worktree Management**:
- simple-git wraps native git CLI, supports multiple worktrees per branch
- Command: `git.raw(['worktree', 'add', path, branch])`
- No special handling needed for multiple worktrees on same branch

**ADR-012: Session Lifecycle Management Patterns**:
- Three-layer architecture: SessionManager → WorktreeManager → PTYManager
- Session creation flow unchanged, except worktree conflict check removed
- Session destruction flow unchanged (already scoped by sessionId, won't affect siblings)

### Project Structure Notes

**Files to Modify:**
```
backend/src/
├── server.ts                          # MODIFIED: Branch API endpoint returns sessionCount
├── sessionManager.ts                  # MODIFIED: Remove hasWorktreeForBranch check, add getSessionsByBranch method
├── worktreeManager.ts                 # REVIEW ONLY: Verify supports multiple worktrees (should be no changes)
└── types.ts                           # MODIFIED: Add sharedBranch, branchSessionCount to Session; sessionCount, activeSessions to Branch

frontend/src/
├── types.ts                           # MODIFIED: Add sharedBranch, branchSessionCount to Session; sessionCount, activeSessions to Branch
└── components/
    ├── SessionModal.tsx               # MODIFIED: Add shared branch warning alert
    └── SessionList.tsx                # MODIFIED: Add shared branch badge indicator
```

**No new files to create** - Story 4.15 is purely modifications to existing functionality.

**Dependencies (No new packages required)**:
- Backend: simple-git (already installed) - already supports multiple worktrees per branch
- Frontend: shadcn/ui Badge (already available) - for shared branch indicator

### Implementation Guidance

**Git Worktree Behavior (Multiple Instances per Branch):**

Create first worktree on branch:
```bash
git worktree add /workspace/.worktrees/session-abc feature/auth
# Works - creates worktree for feature/auth
```

Create second worktree on SAME branch (Story 4.15):
```bash
git worktree add /workspace/.worktrees/session-def feature/auth
# Also works! Git allows multiple worktrees per branch
# Both worktrees checkout same branch at current HEAD
```

List worktrees:
```bash
git worktree list
# Output:
# /workspace                                abc123 [main]
# /workspace/.worktrees/session-abc         def456 [feature/auth]
# /workspace/.worktrees/session-def         def456 [feature/auth]  ← Same branch!
```

Remove one worktree (doesn't affect sibling):
```bash
git worktree remove /workspace/.worktrees/session-abc
# Only removes session-abc worktree
# session-def worktree remains functional
# feature/auth branch unchanged (not deleted)
```

**Backend Session Count Logic:**

```typescript
// In SessionManager.ts
getSessionsByBranch(branchName: string): Session[] {
  return Array.from(this.sessions.values()).filter(
    session => session.branch === branchName && session.status !== 'stopped'
  );
}

// Updated createSession method (Story 4.15)
async createSession(options: {
  name?: string,
  branch?: string,
  existingBranch?: boolean
}): Promise<Session> {
  const { name, branch, existingBranch = false } = options;

  // ... (session ID, name generation - unchanged from Story 4.14)

  let branchName: string;
  let branchType: 'new' | 'existing';

  if (existingBranch) {
    // Validate branch exists (unchanged from Story 4.14)
    const branches = await this.git.branchLocal();
    if (!branches.all.includes(branch!)) {
      throw new ValidationError(`Branch '${branch}' does not exist.`);
    }

    // REMOVED in Story 4.15: Worktree conflict check
    // const { hasWorktree, sessionId } = await this.worktreeManager.hasWorktreeForBranch(branch!);
    // if (hasWorktree) {
    //   throw new ConflictError(`Branch '${branch}' already has an active worktree in session '${sessionId}'`);
    // }

    branchName = branch!;
    branchType = 'existing';
  } else {
    // Create new branch (unchanged)
    branchName = branch || `feature/${sessionName}`;
    branchType = 'new';
  }

  // Compute shared branch metadata (NEW in Story 4.15)
  const sessionsOnBranch = this.getSessionsByBranch(branchName);
  const sharedBranch = sessionsOnBranch.length > 0;  // Will be shared after this session created
  const branchSessionCount = sessionsOnBranch.length + 1;  // Include this session

  // Create worktree (unchanged from Story 4.14)
  const worktreePath = await this.worktreeManager.create({
    sessionId,
    branchName,
    createNewBranch: !existingBranch
  });

  // Spawn PTY (unchanged)
  const ptyPid = await this.ptyManager.spawn({ sessionId, cwd: worktreePath });

  // Create session object (EXTENDED in Story 4.15)
  const session: Session = {
    id: sessionId,
    name: sessionName,
    status: 'active',
    branch: branchName,
    worktreePath,
    ptyPid,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    metadata: {
      branchType,
      sharedBranch,         // NEW
      branchSessionCount    // NEW
    }
  };

  // Save session (unchanged)
  this.sessions.set(sessionId, session);
  await this.saveSessions();

  return session;
}
```

**Branch API Session Count Logic:**

```typescript
// In server.ts (or routes/git.ts)
app.get('/api/git/branches', async (req, res) => {
  try {
    const branches = await git.branchLocal();
    const sessionsData = sessionManager.getAllSessions();

    const branchesWithCounts = branches.all.map(branchName => {
      const sessionsOnBranch = sessionManager.getSessionsByBranch(branchName);
      const sessionCount = sessionsOnBranch.length;
      const activeSessions = sessionsOnBranch.map(s => s.name);

      return {
        name: branchName,
        fullName: `refs/heads/${branchName}`,
        sessionCount,           // NEW
        activeSessions,         // NEW
        lastCommit: {
          // ... (existing commit metadata from Story 4.14)
        }
      };
    });

    res.json({ branches: branchesWithCounts });
  } catch (error) {
    res.status(500).json({ error: { type: 'git', message: 'Failed to list branches' } });
  }
});
```

**Frontend Shared Branch Warning (SessionModal):**

```typescript
// In SessionModal.tsx
const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
const showSharedBranchWarning = selectedBranch && selectedBranch.sessionCount > 0;

// ... (in modal render)
{mode === 'existing' && showSharedBranchWarning && (
  <Alert variant="warning">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Branch Already in Use</AlertTitle>
    <AlertDescription>
      Branch '{selectedBranch.name}' is already being used by:{' '}
      {selectedBranch.activeSessions.join(', ')}.
      <br />
      Working on the same branch in multiple sessions can lead to merge conflicts.
      <br />
      Consider creating a new branch or using a different existing branch.
    </AlertDescription>
  </Alert>
)}
```

**Frontend Shared Branch Badge (SessionList):**

```typescript
// In SessionList.tsx
function SessionListItem({ session }: { session: Session }) {
  const isSharedBranch = session.metadata?.sharedBranch || false;
  const branchSessionCount = session.metadata?.branchSessionCount || 1;

  return (
    <div className="session-item">
      <span className="session-name">{session.name}</span>
      <div className="branch-info">
        <GitBranch className="h-4 w-4" />
        <span>{session.branch}</span>
        {isSharedBranch && (
          <Badge
            variant="warning"
            className="ml-2"
            title={`${branchSessionCount} sessions sharing branch '${session.branch}'`}
          >
            <GitBranch className="h-3 w-3" />
            <span className="ml-1">{branchSessionCount}</span>
          </Badge>
        )}
      </div>
      {/* ... rest of session item */}
    </div>
  );
}
```

**Git Merge Conflict Handling:**

Story 4.15 does NOT implement special merge conflict handling. Git's standard behavior applies:

```bash
# In session-1 terminal:
echo "change from session 1" >> file.txt
git add file.txt
git commit -m "Session 1 change"

# In session-2 terminal (same branch):
echo "change from session 2" >> file.txt
git add file.txt
git commit -m "Session 2 change"
# Error: Updates were rejected because the remote contains work...
# User must: git pull → resolve conflicts → git add → git commit

# Or if both sessions modify same lines:
# Session 1 commits first → Session 2 pulls → Git shows conflict markers
# User resolves in terminal manually (standard git workflow)
```

This is standard git behavior. No special UI or backend handling needed beyond displaying git's error messages in the terminal (already implemented).

**UI/UX Considerations:**

- Shared branch warning should be prominent but not blocking (yellow alert, not red error)
- Badge should be visually distinct from other badges (yellow color, not green/red/blue)
- Session count should be clear (numeric badge overlay on GitBranch icon)
- Warning message should explain risks clearly (merge conflicts, coordination needed)
- Documentation should guide users on when to use shared branches (complex features) vs. separate branches

**Testing Strategy:**

Unit Tests:
- Backend: getSessionsByBranch returns correct sessions, sharedBranch computed correctly
- Frontend: Shared branch warning shows/hides correctly, badge displays accurate count

Integration Tests:
- Full session creation flow with multiple sessions on same branch
- Branch API returns accurate session counts
- Session destruction doesn't affect sibling sessions

E2E Tests:
- User creates two sessions on same branch (happy path)
- User sees shared branch warning when selecting occupied branch
- User sees shared branch badge on session list
- User commits in session 1, pulls in session 2 to see changes
- User destroys session 1, session 2 continues working

### Learnings from Previous Story

**From Story 4-14-existing-branch-selection-for-sessions (Status: drafted)**

**No Implementation Learnings Yet:**
- Story 4.14 is still in "drafted" status (not implemented)
- Story 4.15 depends on Story 4.14's worktree conflict detection logic
- Story 4.15 should be implemented AFTER Story 4.14 completes

**Code Dependencies from Story 4.14:**
- Story 4.14 introduces: `hasWorktreeForBranch()` method in WorktreeManager
- Story 4.14 adds: 409 Conflict error when branch has active worktree
- Story 4.14 adds: `branchType: 'new' | 'existing'` to Session metadata
- Story 4.14 adds: GET /api/git/branches endpoint with branch listing

**Story 4.15 Changes to Story 4.14 Code:**
1. **Remove worktree conflict check**: Remove or bypass `hasWorktreeForBranch()` check that throws 409
2. **Extend Session metadata**: Add `sharedBranch`, `branchSessionCount` (alongside existing `branchType`)
3. **Extend Branch API**: Add `sessionCount`, `activeSessions` to existing endpoint
4. **Extend SessionModal**: Add warning alert to existing branch selection UI

**Architectural Continuity:**
- Story 4.14 establishes existing branch selection UI → Story 4.15 enhances it with warnings
- Story 4.14 validates branch exists → Story 4.15 keeps validation, removes conflict check
- Story 4.14 uses WorktreeManager for existing branches → Story 4.15 uses same path, multiple times

**Integration with Story 4.14:**
- Story 4.15 should NOT revert Story 4.14 code (existing branch selection remains)
- Story 4.15 should EXTEND Story 4.14 (add shared branch support on top)
- Both stories work together: Users can select existing branches (4.14) AND share branches (4.15)

### References

- [Source: docs/architecture.md#FR-Category-to-Architecture-Mapping] - Git Worktree Management (FR16-FR20), Session Management (FR8-FR15)
- [Source: docs/architecture.md#ADR-008] - simple-git for Git Worktree Management (supports multiple worktrees per branch)
- [Source: docs/architecture.md#ADR-009] - Flat JSON File for Session Persistence (metadata extended with sharedBranch)
- [Source: docs/architecture.md#ADR-012] - Session Lifecycle Management Patterns (SessionManager → WorktreeManager)
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Out-of-Scope] - Story 4.15 listed as out-of-scope for Epic 4 (backlog item)
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - Session Entity structure (extended with sharedBranch)
- [Source: docs/sprint-artifacts/4-14-existing-branch-selection-for-sessions.md#Dev-Notes] - Story 4.14 introduces worktree conflict detection (removed in 4.15)
- [Source: docs/sprint-artifacts/4-14-existing-branch-selection-for-sessions.md#Tasks] - hasWorktreeForBranch method (bypassed in 4.15)
- [Source: docs/sprint-artifacts/sprint-status.yaml] - Story 4.15 status: backlog

## Change Log

**2025-11-26**:
- Story created from Epic 4 backlog item 4-15-multiple-sessions-on-same-branch
- Status: drafted (was backlog)
- Predecessor: Story 4.14 (existing branch selection) - establishes branch selection UI and worktree conflict detection that this story removes
- Core functionality: Allow multiple sessions to work on the same git branch simultaneously
- 10 acceptance criteria defined covering backend changes, UI warnings, shared branch indicators, session cleanup
- 7 tasks with detailed subtasks for implementation
- Key changes: Remove worktree-per-branch restriction, add shared branch metadata, show warnings/badges in UI
- Backend API extended with session counts per branch
- Session metadata extended with sharedBranch and branchSessionCount fields
- Frontend adds shared branch warning in modal and badge in session list
- Documentation updates for README, troubleshooting guide, API docs
- Ready for story-context generation and implementation (after Story 4.14 completes)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
