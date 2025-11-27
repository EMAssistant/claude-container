# Epic Technical Specification: Git Integration & Artifact Review

Date: 2025-11-26
Author: Kyle
Epic ID: 5
Status: Draft

---

## Overview

Epic 5 delivers streamlined git operations and BMAD artifact review capabilities directly within the Claude Container UI. This epic enables developers to review Claude-modified files in context of the current story, approve or request changes with one click, and batch-commit approved files - all without typing git commands or leaving the browser.

The epic introduces a new Git sidebar tab for repository operations (status, stage, unstage, commit, push, pull) and integrates artifact review functionality into the existing Sprint Tracker's StoryRow/ArtifactList components from Epic 6. This approach avoids creating a separate "Review Panel" and instead enriches the existing artifact display with review status badges and inline approval actions.

## Objectives and Scope

**In-Scope:**
- Git status API exposing modified/staged/untracked files per session worktree
- Git operations API (stage, unstage, commit, push, pull) scoped to session worktrees
- New Git sidebar tab UI component alongside Files and Workflow tabs
- BMAD artifact detection linking Claude-modified files to active story artifacts
- Review status badges (pending/approved/changes-requested) in Sprint Tracker
- One-click approve flow with auto-staging for git commit
- Request Changes modal with feedback injection to Claude session stdin
- Quick-approve toast notifications when Claude modifies files
- Auto-generated commit messages based on staged files and story context
- Artifact review state persistence across page refresh and container restart

**Out-of-Scope:**
- Git merge/rebase conflict resolution UI (user uses terminal)
- Git branch switching (handled by session creation in Epic 2)
- Pull request creation UI (user uses gh CLI in terminal)
- Multi-repository support (single workspace repo assumption)
- External git credential management (SSH keys/credential helper must be pre-configured)

## System Architecture Alignment

**Architecture Components (per ADR-012):**

This epic extends the existing three-layer session architecture:
- **SessionManager** - Extended with `artifactReviews` state map per session
- **WorktreeManager** - Leveraged for all git operations (scoped to session worktree)
- **StatusParser** - Extended with `reviewStatus` field in `ArtifactInfo` type

**Integration Points:**

| Component | Integration | Notes |
|-----------|-------------|-------|
| Git Panel UI | New sidebar tab | Alongside Files/Workflow tabs |
| Sprint Tracker | ArtifactList extension | Review badges in existing StoryRow |
| ArtifactViewer | Diff view reuse | Existing Story 3.7 DiffView component |
| Toast System | Quick-approve | Existing Story 4.4 infrastructure |
| WebSocket | New messages | `git.status.updated`, `artifact.updated` |
| Session JSON | Extended schema | `artifactReviews` map persisted |

**Relevant ADRs:**
- ADR-008: simple-git for Git Worktree Management - Wraps native git CLI
- ADR-013: WebSocket Message Protocol - `resource.action` naming convention
- ADR-016: Diff View and Cache Management - Reusable for artifact preview

## Detailed Design

### Services and Modules

| Module | Location | Responsibility | Dependencies |
|--------|----------|----------------|--------------|
| **gitManager.ts** | `backend/src/gitManager.ts` | Git operations via simple-git (status, stage, unstage, commit, push, pull) | simple-git, worktreeManager |
| **artifactReviewManager.ts** | `backend/src/artifactReviewManager.ts` | Track review state per artifact, Claude activity detection | sessionManager, fileWatcher |
| **gitRoutes.ts** | `backend/src/routes/gitRoutes.ts` | REST endpoints for git operations | gitManager, sessionManager |
| **GitPanel.tsx** | `frontend/src/components/GitPanel.tsx` | Git sidebar tab UI (staged/modified/untracked lists, commit form) | useGitStatus hook, useWebSocket |
| **useGitStatus.ts** | `frontend/src/hooks/useGitStatus.ts` | Git status state management, WebSocket subscription | WebSocketContext |
| **ArtifactReviewBadge.tsx** | `frontend/src/components/ArtifactReviewBadge.tsx` | Review status badge (pending/approved/changes-requested) | - |
| **RequestChangesModal.tsx** | `frontend/src/components/RequestChangesModal.tsx` | Feedback capture modal with Claude injection | useWebSocket |

### Data Models and Contracts

**GitStatus (Backend Response):**
```typescript
interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileEntry[];
  modified: GitFileEntry[];
  untracked: GitFileEntry[];
}

interface GitFileEntry {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '?' | 'MM' | 'AM';  // Git status codes
  oldPath?: string;  // For renamed files
}
```

**ArtifactReviewState (Extended Session Schema):**
```typescript
interface ArtifactReview {
  reviewStatus: 'pending' | 'approved' | 'changes-requested';
  revision: number;
  modifiedBy: 'claude' | 'user';
  lastModified: string;  // ISO 8601
  approvedAt?: string;   // ISO 8601, when approved
  changesRequestedAt?: string;  // ISO 8601, when changes requested
  feedback?: string;     // User feedback text
}

// Extended Session interface
interface Session {
  // ... existing fields from Epic 2
  artifactReviews: Record<string, ArtifactReview>;  // key: file path
}
```

**Extended ArtifactInfo (Sprint Tracker):**
```typescript
interface ArtifactInfo {
  name: string;
  path: string;
  exists: boolean;
  reviewStatus?: 'pending' | 'approved' | 'changes-requested' | null;
  modifiedBy?: 'claude' | 'user';
  revision?: number;
  lastModified?: string;
}
```

### APIs and Interfaces

**REST Endpoints:**

| Method | Endpoint | Request | Response | Purpose |
|--------|----------|---------|----------|---------|
| GET | `/api/sessions/:sessionId/git/status` | - | `GitStatus` | Get worktree git status |
| POST | `/api/sessions/:sessionId/git/stage` | `{ files: string[] }` | `{ success, staged }` | Stage files |
| POST | `/api/sessions/:sessionId/git/unstage` | `{ files: string[] }` | `{ success, unstaged }` | Unstage files |
| POST | `/api/sessions/:sessionId/git/commit` | `{ message: string }` | `{ success, commitHash, message }` | Commit staged |
| POST | `/api/sessions/:sessionId/git/push` | `{}` | `{ success, pushed }` | Push to remote |
| POST | `/api/sessions/:sessionId/git/pull` | `{}` | `{ success, pulled, commits }` | Pull from remote |
| POST | `/api/sessions/:sessionId/artifacts/:path/approve` | `{}` | `{ success, staged }` | Approve artifact |
| POST | `/api/sessions/:sessionId/artifacts/:path/request-changes` | `{ feedback: string }` | `{ success }` | Request changes |

**WebSocket Messages (New):**

```typescript
// Server → Client
type GitStatusUpdated = {
  type: 'git.status.updated';
  sessionId: string;
  status: GitStatus;
};

type ArtifactUpdated = {
  type: 'artifact.updated';
  sessionId: string;
  storyId: string;
  artifact: ArtifactInfo;
};

// Client → Server (via existing terminal.input for feedback injection)
// Feedback injected as: "Please revise <path>:\n<feedback>"
```

### Workflows and Sequencing

**Artifact Review Flow:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Claude modifies file                                                 │
│      ↓                                                               │
│ FileWatcher detects change (chokidar)                               │
│      ↓                                                               │
│ ArtifactReviewManager checks: Was this within 5s of Claude output?  │
│      ↓ YES                                                          │
│ Link artifact to current story, set reviewStatus: "pending"         │
│      ↓                                                               │
│ Broadcast WebSocket: artifact.updated                               │
│      ↓                                                               │
│ Frontend shows toast: "[View Diff] [✓ Approve] [Dismiss]"           │
│      ↓                                                               │
│ Sprint Tracker shows ⏳ badge on artifact row                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Approve Flow:**
```
User clicks [✓ Approve] (toast or Sprint Tracker)
      ↓
POST /api/sessions/:id/artifacts/:path/approve
      ↓
Backend: Set reviewStatus = "approved"
      ↓
Backend: git add <path> (auto-stage)
      ↓
Broadcast: artifact.updated, git.status.updated
      ↓
UI: Badge changes to ✓, file appears in Git Panel "Staged"
      ↓
Toast: "SessionList.tsx approved and staged"
```

**Request Changes Flow:**
```
User clicks [✎ Request Changes]
      ↓
RequestChangesModal opens
      ↓
User types feedback, clicks [Send to Claude →]
      ↓
POST /api/sessions/:id/artifacts/:path/request-changes
      ↓
Backend: Set reviewStatus = "changes-requested"
      ↓
Backend: Inject into PTY stdin:
  "Please revise src/components/SessionList.tsx:
   <user feedback>"
      ↓
Broadcast: artifact.updated
      ↓
UI: Badge changes to ⚠️
      ↓
Claude receives message, modifies file
      ↓
FileWatcher detects, revision++, reviewStatus → "pending"
```

**Git Commit Flow:**
```
User stages files (via Git Panel or artifact approval)
      ↓
User clicks [Auto-generate message] or types message
      ↓
User clicks [Commit Staged Files]
      ↓
POST /api/sessions/:id/git/commit { message }
      ↓
Backend: git commit -m "<message>" in worktree
      ↓
Backend: Clear artifactReview entries for committed files
      ↓
Broadcast: git.status.updated
      ↓
UI: Staged files clear, success toast shown
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Git status API response | <500ms | `git status --porcelain` is fast; network overhead dominates |
| Git operations (stage/unstage/commit) | <2s | Includes file I/O and git index updates |
| Artifact detection latency | <100ms after file save | Must feel instantaneous for toast notification |
| Git status WebSocket push | Debounced 500ms | Batch rapid file changes to avoid flooding UI |
| Toast notification display | <200ms after WebSocket | Quick feedback critical for review workflow |

**Optimization Notes:**
- Cache git status results for 500ms to avoid redundant `git status` calls
- Debounce file watcher events per session (500ms window)
- Use `git status --porcelain -b` for minimal parsing overhead

### Security

| Concern | Mitigation |
|---------|------------|
| Path traversal | All git operations validate paths stay within session worktree |
| Command injection | Use simple-git API (parameterized), never raw shell commands |
| Credential exposure | Git credentials stay in container; not exposed via API |
| Feedback injection | Sanitize feedback text before PTY injection (escape control chars) |
| XSS in file paths | React escapes all rendered file paths by default |

**Implementation Notes:**
- Validate `sessionId` exists before any git operation
- Validate file paths resolve within `/workspace/.worktrees/<sessionId>/`
- Sanitize commit messages: escape quotes, limit to 5000 chars
- Feedback injection: Strip ANSI codes, escape shell metacharacters

### Reliability/Availability

| Scenario | Behavior |
|----------|----------|
| Git operation fails | Return detailed error message from git stderr; toast shows error |
| Worktree doesn't exist | Return 400 error "Session worktree not found" |
| Push fails (auth/conflict) | Return git error; suggest `git push` in terminal for debugging |
| Review state corruption | Rebuild from git status on session load (approved = staged files) |
| Container restart | Review states restored from session JSON; staged files intact in git |

**Recovery Patterns:**
- Atomic writes for session JSON (temp + rename)
- Review state derivable from git status as fallback
- Graceful degradation: Git panel shows "Loading..." on errors, not crash

### Observability

| Signal | Implementation |
|--------|----------------|
| Git operation logs | Winston: `logger.info('Git stage', { sessionId, files })` |
| Git errors | Winston: `logger.error('Git push failed', { sessionId, stderr })` |
| Artifact review events | Winston: `logger.info('Artifact approved', { sessionId, path })` |
| Performance metrics | Track p99 latency for git status API calls |

**Log Format (JSON):**
```json
{
  "timestamp": "2025-11-26T10:30:00.123Z",
  "level": "info",
  "message": "Artifact approved",
  "sessionId": "538e0f06-82f5-4f6e-aa7d-231743913fd2",
  "artifactPath": "src/components/SessionList.tsx",
  "revision": 1
}
```

## Dependencies and Integrations

### Existing Dependencies (No Changes)

**Backend (`backend/package.json`):**
- `simple-git: ^3.30.0` - Already installed, used for worktree management (Epic 2)
- `chokidar: ^4.0.0` - Already installed, file watching (Epic 3)
- `ws: ^8.14.0` - Already installed, WebSocket server
- `express: ^4.18.0` - Already installed, REST API

**Frontend (`frontend/package.json`):**
- `@radix-ui/react-toast: ^1.2.15` - Already installed (Epic 4)
- `@radix-ui/react-dialog: ^1.1.15` - Already installed, for RequestChangesModal
- `diff: ^8.0.2` - Already installed (Epic 3), for artifact diff preview
- `lucide-react: ^0.554.0` - Already installed, icons for Git panel

### Internal Dependencies (Epic Prerequisites)

| Dependency | Source | Used For |
|------------|--------|----------|
| SessionManager | Epic 2 | Session state, worktree paths |
| WorktreeManager | Epic 2 | Git worktree directory access |
| FileWatcher | Epic 3 | Detect file changes for review detection |
| DiffView | Story 3.7 | Artifact preview before approval |
| ArtifactViewer | Story 3.5 | View artifact content |
| Toast system | Story 4.4 | Quick-approve notifications |
| SprintTracker | Epic 6 | StoryRow/ArtifactList integration |
| WebSocket protocol | ADR-013 | `git.status.updated`, `artifact.updated` |

### External Integrations

| Integration | Protocol | Notes |
|-------------|----------|-------|
| Git remote (GitHub/GitLab) | SSH or HTTPS | Push/pull require credentials configured in container |
| Claude CLI stdin | PTY | Feedback injection via existing terminal.input mechanism |

### New Files to Create

**Backend:**
- `backend/src/gitManager.ts` - Git operations class
- `backend/src/artifactReviewManager.ts` - Review state management
- `backend/src/routes/gitRoutes.ts` - REST endpoints

**Frontend:**
- `frontend/src/components/GitPanel.tsx` - Sidebar tab component
- `frontend/src/components/ArtifactReviewBadge.tsx` - Status badge
- `frontend/src/components/RequestChangesModal.tsx` - Feedback modal
- `frontend/src/hooks/useGitStatus.ts` - Git state hook

## Acceptance Criteria (Authoritative)

### AC-5.1: Git Status API
1. `GET /api/sessions/:sessionId/git/status` returns branch, ahead/behind, staged, modified, untracked arrays
2. Returns empty arrays when worktree has no changes
3. Returns 400 error when worktree doesn't exist
4. WebSocket `git.status.updated` broadcasts when files change (debounced 500ms)

### AC-5.2: Git Operations API
5. `POST /api/sessions/:sessionId/git/stage` stages specified files in worktree
6. `POST /api/sessions/:sessionId/git/unstage` unstages specified files
7. `POST /api/sessions/:sessionId/git/commit` commits with message, returns commit hash
8. Commit returns 400 error when nothing is staged
9. `POST /api/sessions/:sessionId/git/push` pushes to origin/current-branch
10. `POST /api/sessions/:sessionId/git/pull` pulls from origin/current-branch
11. Push/pull return git error messages on failure

### AC-5.3: Git Panel UI
12. Git tab appears in sidebar alongside Files and Workflow tabs
13. Panel shows Staged, Modified, and Untracked file sections
14. Each file has [Stage], [Unstage], and [Diff] action buttons
15. Commit message textarea with [Auto-generate message] button
16. [Commit Staged Files] button disabled when nothing staged
17. [Pull] and [Push] buttons with ahead/behind indicators
18. Real-time updates via WebSocket subscription

### AC-5.4: Artifact Detection
19. Files modified within 5 seconds of Claude PTY output are attributed to Claude
20. Claude-modified files are linked to current in-progress story
21. `artifact.updated` WebSocket event broadcasts with review status
22. Revision counter increments on subsequent modifications

### AC-5.5: Review Badges in Sprint Tracker
23. Artifacts show review status badges: ⏳ pending, ✓ approved, ⚠️ changes-requested
24. [✓] Approve and [✎] Request Changes buttons appear on hover
25. Story row header shows pending count: "(2 pending)"
26. "✓ All approved" indicator when all artifacts approved

### AC-5.6: Approve with Auto-Stage
27. Clicking [✓] Approve sets reviewStatus to "approved"
28. Approved file is automatically staged via git API
29. Toast confirms: "{filename} approved and staged"
30. [✓ Approve All] approves and stages all pending artifacts in batch

### AC-5.7: Request Changes Modal
31. [✎] opens modal with textarea for feedback
32. Preview shows exact message that will be sent to Claude
33. [Send to Claude →] injects feedback into session PTY stdin
34. Artifact reviewStatus changes to "changes-requested"
35. Cmd+Enter keyboard shortcut submits feedback

### AC-5.8: Quick-Approve Toast
36. Toast appears when Claude modifies a file: "[View Diff] [✓ Approve] [Dismiss]"
37. Toast auto-dismisses after 10 seconds
38. [✓ Approve] in toast approves and stages without navigation
39. Multiple toasts stack (max 3 visible, queue rest)

### AC-5.9: Auto-Generated Commit Messages
40. [Auto-generate message] creates message from staged files
41. Message includes story ID when available
42. First line stays under 72 characters
43. File list appears in commit body after blank line

### AC-5.10: Review State Persistence
44. Review states persist across browser refresh
45. Review states restore after container restart from session JSON
46. Committed files are cleared from artifactReviews map
47. Stale entries (deleted/committed files) cleaned up on session load

### AC-5.11: End-to-End Validation
48. Complete flow: Claude modifies → Toast → Sprint Tracker → Approve → Git commit
49. Request changes flow: Request → Claude edits → Revision 2 → Approve
50. Git panel operations: Stage/unstage, commit, push/pull all functional

## Traceability Mapping

| AC # | FR | Spec Section | Component(s) | Test Idea |
|------|-----|--------------|--------------|-----------|
| 1-4 | FR73 | APIs/Interfaces | gitManager.ts, gitRoutes.ts | Unit: parse git status output; Integration: API returns correct status |
| 5-11 | FR74-78 | APIs/Interfaces | gitManager.ts, gitRoutes.ts | Unit: stage/unstage/commit functions; Integration: API operations succeed |
| 12-18 | FR73-78 | Services/Modules | GitPanel.tsx, useGitStatus.ts | Component: render file sections; Integration: buttons trigger API calls |
| 19-22 | FR79-80 | Workflows | artifactReviewManager.ts, fileWatcher.ts | Unit: Claude activity detection; Integration: file change → artifact link |
| 23-26 | FR81 | Services/Modules | ArtifactReviewBadge.tsx, StoryRow.tsx | Component: badge renders correct icon; Visual: hover reveals buttons |
| 27-30 | FR83-84 | Workflows | approve endpoint, gitManager.ts | Integration: approve → staged; E2E: batch approve flow |
| 31-35 | FR85-86 | Workflows | RequestChangesModal.tsx, PTY stdin | Component: modal renders; Integration: feedback injected to terminal |
| 36-39 | FR88 | Services/Modules | Toast system, artifact.updated | Integration: toast appears on file change; E2E: approve from toast |
| 40-43 | - | Services/Modules | GitPanel.tsx | Unit: message generation logic |
| 44-47 | FR87 | Data Models | sessionManager.ts | Unit: JSON serialization; Integration: state survives restart |
| 48-50 | FR73-88 | All | All | E2E: complete workflow validation |

**FR to Story Mapping:**

| FR | Story | Description |
|----|-------|-------------|
| FR73 | 5.1 | Git status display |
| FR74 | 5.2 | Stage files |
| FR75 | 5.2 | Unstage files |
| FR76 | 5.2 | Commit staged |
| FR77 | 5.2 | Push to remote |
| FR78 | 5.2 | Pull from remote |
| FR79 | 5.4 | Detect BMAD artifacts |
| FR80 | 5.4 | Queue pending review |
| FR81 | 5.5 | Review status badges |
| FR82 | 5.5, 5.6 | Diff view for artifacts |
| FR83 | 5.6 | Batch approval |
| FR84 | 5.6 | Auto-stage approved |
| FR85 | 5.7 | Capture feedback |
| FR86 | 5.7 | Inject to Claude |
| FR87 | 5.10 | Revision tracking |
| FR88 | 5.8 | Quick-approve toast |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **R1:** Claude activity detection (5s window) may have false positives | Medium | Medium | Allow manual attribution override; tune threshold based on usage |
| **R2:** Git push/pull fails due to credentials | High | Medium | Document SSH key setup in container; show helpful error with terminal fallback suggestion |
| **R3:** Large worktrees slow git status | Medium | Low | Cache status results (500ms TTL); debounce file watcher events |
| **R4:** Review state drift if files committed externally | Medium | Medium | Reconcile review state with git status on session load; clear stale entries |
| **R5:** Feedback injection disrupts Claude mid-task | Medium | Low | Inject on newline; warn user if Claude appears busy (recent output) |

### Assumptions

| Assumption | Rationale | Validation |
|------------|-----------|------------|
| **A1:** Git credentials configured in container | Container setup prerequisite from Epic 1 | Document in setup guide; test push/pull in validation |
| **A2:** Single in-progress story per session | Sprint Tracker design from Epic 6 | Story 5.4 links to `currentStory` |
| **A3:** simple-git handles worktree operations | ADR-008 confirmed worktree support | Tested in Epic 2 implementation |
| **A4:** Users will review files before committing | Core value proposition of artifact review | UX enforces review visibility |
| **A5:** Claude outputs to PTY within 5s of file saves | Typical Claude CLI behavior observed | May need tuning for slow operations |

### Open Questions

| Question | Status | Resolution Path |
|----------|--------|-----------------|
| **Q1:** Should we support merge conflict resolution UI? | **Deferred** | Out of scope for MVP; user uses terminal for conflicts |
| **Q2:** How to handle files modified by both user and Claude? | **Resolved** | Track `modifiedBy` field; show both badges if mixed |
| **Q3:** Should approved files require re-approval if user edits? | **Resolved** | Yes - any edit resets to pending (user or Claude) |
| **Q4:** Toast notification settings (enable/disable)? | **Deferred** | Use existing notification preferences from Epic 4 |

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Target | Focus Areas |
|-------|-----------|-----------------|-------------|
| **Unit** | Jest (backend), Vitest (frontend) | 70%+ | gitManager functions, status parsing, message generation |
| **Integration** | Jest + Supertest | Key flows | Git API endpoints, WebSocket broadcasting |
| **Component** | Vitest + Testing Library | Core components | GitPanel, ArtifactReviewBadge, RequestChangesModal |
| **E2E** | Manual (Playwright optional) | Critical paths | Complete approval flow, request changes flow |

### Unit Test Cases (Backend)

**gitManager.ts:**
- `parseGitStatus()` - Parse `--porcelain` output correctly
- `getStatus()` - Returns correct structure for clean/dirty worktree
- `stageFiles()` - Stages single file, multiple files, glob patterns
- `unstageFiles()` - Unstages without losing modifications
- `commit()` - Creates commit with sanitized message
- Error handling: Invalid paths, non-existent worktree

**artifactReviewManager.ts:**
- `isClaudeActivity()` - Returns true within 5s of PTY output
- `linkToStory()` - Associates file with current story
- `updateReviewStatus()` - Transitions pending → approved → committed
- `cleanupStaleEntries()` - Removes committed/deleted files

### Unit Test Cases (Frontend)

**GitPanel.tsx:**
- Renders Staged, Modified, Untracked sections correctly
- [Stage] button calls API with correct file path
- [Commit] disabled when nothing staged
- Real-time updates on WebSocket `git.status.updated`

**ArtifactReviewBadge.tsx:**
- Renders ⏳ for pending, ✓ for approved, ⚠️ for changes-requested
- Hover reveals [✓] and [✎] action buttons

**RequestChangesModal.tsx:**
- Modal opens on [✎] click
- Preview updates as user types
- Cmd+Enter submits feedback
- Feedback sanitized before injection

### Integration Test Cases

**Git API Flow:**
1. Create session with worktree
2. Create test file in worktree
3. `GET /git/status` → File appears in untracked
4. `POST /git/stage` → File moves to staged
5. `POST /git/commit` → Commit created, file clears
6. Verify `git log` shows commit

**Artifact Review Flow:**
1. Set up session with file watcher
2. Simulate Claude PTY output
3. Write file within 5s window
4. Verify `artifact.updated` WebSocket message sent
5. Verify artifact linked to story with `reviewStatus: "pending"`

### E2E Test Scenarios

**Scenario 1: Happy Path Approval**
```
Given: Claude is implementing a story
When: Claude saves src/components/Test.tsx
Then: Toast appears with [✓ Approve] option
When: User clicks [✓ Approve]
Then: File is staged, badge shows ✓
When: User commits via Git panel
Then: Commit succeeds, review entry cleared
```

**Scenario 2: Request Changes Cycle**
```
Given: Artifact pending review in Sprint Tracker
When: User clicks [✎] Request Changes
And: Types "Add error handling"
And: Clicks [Send to Claude →]
Then: Feedback injected to terminal
And: Badge shows ⚠️
When: Claude modifies file again
Then: Badge resets to ⏳ with "Revision 2"
When: User approves revision 2
Then: Badge shows ✓, file staged
```

**Scenario 3: Git Panel Operations**
```
Given: Session with modified files
When: User clicks Git tab
Then: Modified files displayed
When: User clicks [Stage] on file
Then: File moves to Staged section
When: User clicks [Auto-generate message]
Then: Commit message populated
When: User clicks [Commit Staged Files]
Then: Commit created, staged cleared
When: User clicks [Push]
Then: Push succeeds (or shows credential error)
```

### Edge Cases to Test

- Rapid file changes (debounce behavior)
- Container restart mid-review (state restoration)
- Files committed externally (stale entry cleanup)
- Git operations on large repositories
- Push/pull with invalid credentials (error handling)
- Multiple sessions modifying same file (unlikely but possible)

---

_Generated by BMAD Epic Tech Context Workflow_
_Date: 2025-11-26_
_For: Kyle_
