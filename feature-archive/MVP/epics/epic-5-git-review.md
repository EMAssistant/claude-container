## Epic 5: Git Integration & Artifact Review

**Goal:** Enable streamlined git operations and BMAD artifact approval directly in the UI, leveraging the existing Sprint Tracker artifact infrastructure from Epic 6

**User Value:** Developers can review BMAD-generated files, approve or request changes with one click, and commit batched changes - all without leaving the browser or typing git commands

**FR Coverage:** NEW FRs (FR73-FR88) - 16 new functional requirements

**Architecture Note:** This epic integrates with Epic 6's Sprint Tracker. BMAD artifact review is embedded INTO the existing artifact display under stories (StoryRow/ArtifactList components), rather than creating a separate "Review Panel." Git operations get a dedicated sidebar tab.

---

### New Functional Requirements (FR73-FR88)

**Git Operations (FR73-FR78):**
- FR73: Display git status (modified, staged, untracked files) per session/worktree
- FR74: Stage individual files or all files via UI
- FR75: Unstage files via UI
- FR76: Commit staged files with user-provided or auto-generated message
- FR77: Push commits to remote repository
- FR78: Pull changes from remote repository

**BMAD Artifact Review (FR79-FR84):**
- FR79: Detect BMAD-generated files and link them to active story artifacts
- FR80: Track review status (pending/approved/changes-requested) per artifact
- FR81: Display review status badges in Sprint Tracker artifact list
- FR82: Show diff view for pending artifacts (via existing ArtifactViewer)
- FR83: Support batch approval ("Approve All" in story row)
- FR84: Auto-stage approved files for git commit

**Request Changes Flow (FR85-FR88):**
- FR85: Capture user feedback text when requesting changes
- FR86: Inject feedback message into originating Claude session
- FR87: Track revision count for files that cycle through review multiple times
- FR88: Display toast notification when Claude creates files for quick-approve

---

### Story 5.1: Git Status API Endpoints

As a developer,
I want the backend to expose git status information via API,
So that the UI can display the current state of the worktree (FR73).

**Acceptance Criteria:**

**Given** a backend API endpoint `GET /api/sessions/:sessionId/git/status`
**When** the session has a worktree at `/workspace/.worktrees/<sessionId>`
**Then** the API executes `git status --porcelain` in that directory

**And** returns JSON:
```json
{
  "branch": "feature-auth",
  "ahead": 2,
  "behind": 0,
  "staged": [
    { "path": "src/auth/login.ts", "status": "M" }
  ],
  "modified": [
    { "path": "src/components/Header.tsx", "status": "M" }
  ],
  "untracked": [
    { "path": "src/utils/helpers.ts", "status": "?" }
  ]
}
```

**And** when the worktree has no changes
**Then** the API returns empty arrays for staged, modified, and untracked

**And** when git is not initialized or worktree doesn't exist
**Then** the API returns `{ "error": "Not a git repository" }` with 400 status

**And** the endpoint supports WebSocket push via `git.status.updated` message when files change

**Prerequisites:** Epic 2 (Sessions with worktrees)

**Technical Notes:**
- Parse `git status --porcelain -b` output for branch info and ahead/behind
- Status codes: M (modified), A (added), D (deleted), R (renamed), ? (untracked)
- Chokidar watches worktree for file changes, triggers status refresh
- Debounce status updates by 500ms to batch rapid changes
- Git commands executed via `child_process.execSync` with worktree cwd

---

### Story 5.2: Git Operations API Endpoints

As a developer,
I want backend endpoints for staging, committing, pushing, and pulling,
So that I can perform git operations from the UI (FR74-FR78).

**Acceptance Criteria:**

**Given** API endpoints for git operations:

**POST /api/sessions/:sessionId/git/stage**
**When** called with `{ "files": ["src/auth/login.ts"] }`
**Then** executes `git add src/auth/login.ts` in session worktree
**And** returns `{ "success": true, "staged": ["src/auth/login.ts"] }`

**POST /api/sessions/:sessionId/git/unstage**
**When** called with `{ "files": ["src/auth/login.ts"] }`
**Then** executes `git reset HEAD src/auth/login.ts`
**And** returns `{ "success": true, "unstaged": ["src/auth/login.ts"] }`

**POST /api/sessions/:sessionId/git/commit**
**When** called with `{ "message": "Add authentication flow" }`
**Then** executes `git commit -m "Add authentication flow"`
**And** returns `{ "success": true, "commitHash": "abc1234", "message": "Add authentication flow" }`

**And** when no files are staged
**Then** returns `{ "error": "Nothing to commit" }` with 400 status

**POST /api/sessions/:sessionId/git/push**
**When** called with `{}`
**Then** executes `git push origin <current-branch>`
**And** returns `{ "success": true, "pushed": true }`

**And** when push fails (auth, conflicts)
**Then** returns `{ "error": "<git error message>" }` with 500 status

**POST /api/sessions/:sessionId/git/pull**
**When** called with `{}`
**Then** executes `git pull origin <current-branch>`
**And** returns `{ "success": true, "pulled": true, "commits": 3 }`

**Prerequisites:** Story 5.1 (Git status API)

**Technical Notes:**
- All operations scoped to session's worktree directory
- Stage/unstage support glob patterns: `{ "files": ["*.ts"] }`
- Commit message sanitization: escape quotes, limit length to 72 chars first line
- Push/pull require git credentials configured in container (SSH keys or credential helper)
- Return detailed error messages from git stderr for debugging

---

### Story 5.3: Git Panel UI Component

As a developer,
I want a Git tab in the sidebar showing staged/modified/untracked files with action buttons,
So that I can see and manage git state visually (FR73-FR78).

**Acceptance Criteria:**

**Given** a new "Git" tab in the left sidebar (alongside Files, Workflow)
**When** the user clicks the Git tab
**Then** the panel displays:
```
🔀 Git                                    branch: feature-auth
─────────────────────────────────────────────────────────────
[↓ Pull] [↑ Push]                         ↑ 2 ahead, ↓ 0 behind

📦 Staged (2)
─────────────────────────────────────────────────────────────
│ ☑ .bmad/docs/architecture.md                     [Unstage] │
│ ☑ src/auth/login.ts                              [Unstage] │

📝 Modified (1)
─────────────────────────────────────────────────────────────
│ ☐ src/components/Header.tsx              [Diff] [Stage]    │

❓ Untracked (1)
─────────────────────────────────────────────────────────────
│ ☐ src/utils/helpers.ts                   [Diff] [Stage]    │

═══════════════════════════════════════════════════════════════
Commit Message:
┌───────────────────────────────────────────────────────────┐
│ Add authentication flow                                    │
└───────────────────────────────────────────────────────────┘
[Auto-generate message]

                                          [Commit Staged Files]
```

**And** when the user clicks [Stage] on a file
**Then** the file moves from Modified/Untracked to Staged section

**And** when the user clicks [Unstage] on a staged file
**Then** the file moves back to Modified section

**And** when the user clicks [Diff] on a file
**Then** opens the file in ArtifactViewer with diff view enabled

**And** when the user clicks [Commit Staged Files]
**Then** the commit API is called with the message
**And** staged files clear, success toast shown

**And** when the user clicks [Auto-generate message]
**Then** a commit message is generated from staged file names/paths (Story 5.9)

**And** when git status changes (file saved, external git command)
**Then** WebSocket `git.status.updated` triggers UI refresh

**Prerequisites:** Story 5.1, Story 5.2 (Git APIs)

**Technical Notes:**
- New sidebar tab alongside Files and Workflow
- Colors: Staged (green #A3BE8C), Modified (yellow #EBCB8B), Untracked (gray #81A1C1)
- Pull/Push buttons disabled with tooltip if nothing to push/pull
- Commit button disabled if no staged files
- Real-time updates via WebSocket subscription to `git.status.updated`

---

### Story 5.4: BMAD Artifact Detection with Story Linking

As a developer,
I want the backend to detect when Claude modifies files and link them to the active story's artifact list,
So that I can review AI-generated content in context (FR79-FR80).

**Acceptance Criteria:**

**Given** Claude modifies a file during story execution (e.g., `src/components/SessionList.tsx`)
**When** the file is saved
**Then** the backend detects the change via existing file watcher

**And** determines if the change was made by Claude (within 5 seconds of Claude stdout activity)

**And** links the changed file to the current in-progress story's artifacts:
```typescript
{
  storyId: "4-16",
  artifacts: [
    { name: "Story", path: "docs/sprint-artifacts/4-16-session-list-hydration.md",
      exists: true, reviewStatus: null }, // BMAD docs - no review needed
    { name: "Context", path: "docs/sprint-artifacts/4-16-session-list-hydration.context.xml",
      exists: true, reviewStatus: null },
    // NEW: Claude-modified code files
    { name: "SessionList.tsx", path: "src/components/SessionList.tsx",
      exists: true, reviewStatus: "pending", modifiedBy: "claude",
      lastModified: "2025-11-26T10:30:00Z" }
  ]
}
```

**And** broadcasts `artifact.updated` WebSocket event with the updated story data

**And** the Sprint Tracker UI updates to show the new pending artifact under the story

**And given** the same file is modified again after Request Changes
**Then** the revision counter increments and `reviewStatus` resets to "pending"

**And given** a file is modified in paths matching BMAD patterns (`.bmad/`, `docs/`, `stories/`)
**Then** these are also linked to the story with `reviewStatus: "pending"`

**Prerequisites:** Epic 6 (Sprint Tracker), Epic 2 (Sessions)

**Technical Notes:**
- Extend `statusParser.ts` to include `reviewStatus` field in `ArtifactInfo`
- Claude activity detection: Track last stdout timestamp per session
- Use existing chokidar file watcher infrastructure from Epic 3
- Artifact linking: Associate file changes with `currentStory` from sprint status
- Store review state in session JSON alongside existing session metadata

---

### Story 5.5: Artifact Review Badges in Sprint Tracker

As a developer,
I want to see review status badges on artifacts in the Sprint Tracker,
So that I can quickly identify which files need my attention (FR81).

**Acceptance Criteria:**

**Given** a story has artifacts with `reviewStatus` property
**When** the story row is expanded in Sprint Tracker
**Then** each artifact shows its review status badge:

```
◉ 4-16  session-list-hydration   in-progress   [▶ Start]
   ├─ 📄 Story                                  [View]
   ├─ 📋 Context                                [View]
   ├─ 📄 SessionList.tsx  ⏳                    [View] [✓] [✎]
   └─ 📄 useWebSocket.ts  ⏳                    [View] [✓] [✎]
```

**And** status icons are:
- `✓` (green) = approved
- `⏳` (yellow) = pending review
- `⚠️` (orange) = changes requested
- No icon = not a Claude-modified file (Story/Context docs always trusted)

**And** for artifacts with `reviewStatus: "pending"` or `"changes-requested"`
**Then** `[✓]` (Approve) and `[✎]` (Request Changes) buttons appear on hover

**And** the story row header shows pending count: `4-16 session-list-hydration (2 pending)`

**And** clicking `[✓]` triggers approval flow (Story 5.6)

**And** clicking `[✎]` opens Request Changes modal (Story 5.7)

**And** when all artifacts are approved
**Then** story row shows `✓ All approved` indicator

**Prerequisites:** Story 5.4 (Artifact detection), Epic 6 Story 6.4 (Artifact display)

**Technical Notes:**
- Extend existing `ArtifactList` component in `StoryRow.tsx`
- Add `reviewStatus` to `ArtifactInfo` type in `types.ts`
- Approve/Request buttons use same hover-reveal pattern as existing [View] button
- Badge colors match existing Sprint Tracker status colors
- Batch approve option: `[✓ Approve All]` in story row header when multiple pending

---

### Story 5.6: Approve Artifact with Auto-Stage

As a developer,
I want to approve artifacts with one click and have them auto-staged for git,
So that the approval workflow is fast and seamless (FR83-FR84).

**Acceptance Criteria:**

**Given** an artifact with `reviewStatus: "pending"`
**When** user clicks the `[✓]` (Approve) button in the artifact row
**Then** the artifact's `reviewStatus` changes to `"approved"`

**And** the file is automatically staged via `POST /api/sessions/:sessionId/git/stage`

**And** a toast notification confirms: "SessionList.tsx approved and staged"

**And** the artifact row updates to show `✓` (green check) instead of `⏳`

**And given** user wants to see changes before approving
**When** they click `[View]`
**Then** the existing `ArtifactViewer` opens with diff view toggle (reuse Story 3.7 DiffView)

**And given** multiple artifacts are pending in a story
**When** user clicks `[✓ Approve All]` in the story row header
**Then** all pending artifacts are approved and staged in batch
**And** toast: "3 files approved and staged"

**And given** an artifact with `reviewStatus: "changes-requested"` gets updated by Claude
**When** the file is modified
**Then** `reviewStatus` resets to `"pending"` with incremented revision counter

**Prerequisites:** Story 5.4 (Artifact linking), Story 5.5 (Review badges), Story 5.2 (Git stage API)

**Technical Notes:**
- Approve calls `POST /api/sessions/:sessionId/git/stage` then updates artifact state
- Batch approve uses single API call with array of files
- Reuse existing `DiffView` component from Story 3.7 for preview
- Revision counter stored in artifact: `{ revision: 2, previousContent: "..." }`

---

### Story 5.7: Request Changes Modal with Claude Injection

As a developer,
I want to provide feedback when an artifact needs changes and have it sent to Claude,
So that Claude can revise it without me manually typing instructions (FR85-FR86).

**Acceptance Criteria:**

**Given** an artifact with `reviewStatus: "pending"` or `"changes-requested"`
**When** user clicks `[✎]` (Request Changes) button
**Then** a modal opens with:
```
┌─────────────────────────────────────────────────────────────────────┐
│  ✎ Request Changes                                             [✕]  │
│     SessionList.tsx                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  What needs to be changed?                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ The loading state should show a spinner, not just "Loading"   │  │
│  │ text. Also add error boundary handling.                       │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Preview (will be sent to Claude):                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Please revise src/components/SessionList.tsx:                 │  │
│  │ The loading state should show a spinner, not just "Loading"   │  │
│  │ text. Also add error boundary handling.                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                      [Cancel] [Send to Claude →]    │
└─────────────────────────────────────────────────────────────────────┘
```

**And** when the user types feedback and clicks [Send to Claude →]
**Then** the modal closes
**And** the feedback is injected into the session's Claude stdin:
```
Please revise src/components/SessionList.tsx:
The loading state should show a spinner, not just "Loading" text. Also add error boundary handling.
```

**And** the artifact's `reviewStatus` changes to `"changes-requested"`
**And** the artifact row shows `⚠️` (orange) status

**And** when Claude updates the file
**Then** the artifact reappears with `reviewStatus: "pending"` and `revision: 2`

**Prerequisites:** Story 5.5 (Review badges), Epic 1 (stdin injection via WebSocket)

**Technical Notes:**
- Inject via existing WebSocket `terminal.input` message to session
- Preview shows exactly what will be sent (WYSIWYG)
- Track `changesRequestedAt` timestamp for revision tracking
- Textarea auto-focuses on modal open, supports Cmd+Enter to submit
- Store previousContent when changes requested for diff on next revision

---

### Story 5.8: Quick-Approve Toast Notification

As a developer,
I want to see a toast notification when Claude creates/modifies files,
So that I can approve trusted output without navigating to Sprint Tracker (FR88).

**Acceptance Criteria:**

**Given** Claude creates or modifies a file that gets linked to the current story
**When** the `artifact.updated` WebSocket event is received
**Then** a toast notification appears:
```
┌─────────────────────────────────────┐
│ 📄 SessionList.tsx modified         │
│ [View Diff] [✓ Approve] [Dismiss]  │
└─────────────────────────────────────┘
```

**And** clicking `[✓ Approve]` approves and stages without opening Sprint Tracker
**And** toast updates to: "✓ SessionList.tsx approved and staged"

**And** clicking `[View Diff]` opens ArtifactViewer with the file in diff mode

**And** clicking `[Dismiss]` or auto-timeout (10 seconds) leaves file in pending state

**And** multiple file changes stack as separate toasts (max 3 visible, queue rest)

**And** toast appears in the notification area (bottom-right, same as existing toasts)

**Prerequisites:** Story 5.4 (Artifact detection), Story 5.6 (Approve flow), Story 4.4 (Toast system)

**Technical Notes:**
- Use existing toast infrastructure from Story 4.4
- Toast auto-dismisses after 10 seconds if not interacted with
- Approve action uses same endpoint as Sprint Tracker approve
- Queue toasts if more than 3 files change rapidly (show "and 5 more...")
- Don't show toast for Story/Context docs (only Claude-modified code files)

---

### Story 5.9: Auto-Generated Commit Messages

As a developer,
I want commit messages to be auto-generated from approved/staged files,
So that I don't have to type repetitive commit messages (enhancement).

**Acceptance Criteria:**

**Given** the Git panel with staged files
**When** the user clicks [Auto-generate message]
**Then** a commit message is generated based on staged files:

**For story implementation (code files):**
```
Implement story 4-16: session list hydration

Files:
- src/components/SessionList.tsx
- src/hooks/useWebSocket.ts
```

**For BMAD artifacts:**
```
Add epic-3 stories and architecture update

Files:
- docs/stories/epic-3-story-2.md
- docs/architecture.md
```

**For mixed files:**
```
Implement story 4-16 with documentation updates

Code:
- src/components/SessionList.tsx

Docs:
- docs/sprint-artifacts/4-16-session-list-hydration.md
```

**And** the generated message appears in the commit message input
**And** the user can edit before committing

**And** when there's only 1 file staged
**Then** the message is simpler: "Update SessionList.tsx"

**And** the message extracts story ID from current story context when available

**Prerequisites:** Story 5.3 (Git panel)

**Technical Notes:**
- Group files by type (code vs docs) and path patterns
- Extract story ID from sprint context (`currentStory`)
- Keep first line under 72 characters (git best practice)
- Detailed file list in body (after blank line)
- Use simple heuristics: "Add" for new, "Update" for modified, "Remove" for deleted

---

### Story 5.10: Artifact Review State Persistence

As a developer,
I want artifact review states to persist across page refreshes and container restarts,
So that I don't lose track of what needs review (enhancement).

**Acceptance Criteria:**

**Given** artifacts with review states (pending/approved/changes-requested)
**When** the user refreshes the browser page
**Then** all review states are preserved in the Sprint Tracker

**And** when the container restarts
**Then** review states are restored from persisted session state

**And** the persistence extends existing session JSON:
```json
{
  "sessionId": "538e0f06-82f5-4f6e-aa7d-231743913fd2",
  "name": "test-status-badge",
  "artifactReviews": {
    "src/components/SessionList.tsx": {
      "reviewStatus": "pending",
      "revision": 1,
      "modifiedBy": "claude",
      "lastModified": "2025-11-26T10:30:00Z"
    },
    "src/hooks/useWebSocket.ts": {
      "reviewStatus": "approved",
      "revision": 1,
      "approvedAt": "2025-11-26T10:35:00Z"
    }
  }
}
```

**And** approved files remain staged in git (git handles this persistence)

**And** when a file is committed
**Then** its review entry is cleared from the session state

**And** stale entries (file deleted or committed externally) are cleaned up on load

**Prerequisites:** Story 5.4 (Artifact detection), Epic 2 (Session persistence)

**Technical Notes:**
- Extend existing session JSON schema with `artifactReviews` map
- Key by file path for fast lookup
- Cleanup on load: Check if files still exist, check git status for committed files
- Merge review state into artifact data when building Sprint Tracker response

---

### Story 5.11: Validation with End-to-End Review Flow

As a developer,
I want to validate the complete review workflow with real Claude file modifications,
So that I'm confident the review system works end-to-end.

**Acceptance Criteria:**

**Given** a session with a story in "in-progress" status
**When** Claude modifies a file (e.g., `src/components/SessionList.tsx`)
**Then** the toast notification appears with approve/dismiss options

**And** when the user dismisses the toast
**Then** the Sprint Tracker shows the pending artifact under the story

**And** when the user expands the story row
**Then** the artifact shows `⏳` badge with `[View] [✓] [✎]` buttons

**And** when the user clicks `[View]`
**Then** the ArtifactViewer opens with diff view showing the changes

**And** when the user clicks `[✎]` with feedback:
"Add error handling for network failures"
**Then** Claude receives the feedback in the terminal
**And** the artifact shows `⚠️` changes-requested status

**And** when Claude updates the file
**Then** the artifact reappears with `⏳` pending and "Revision 2" indicator

**And** when the user approves the revised file via `[✓]`
**Then** it shows `✓` approved status
**And** the Git panel shows the file in Staged section

**And** when the user commits with auto-generated message
**Then** the commit succeeds
**And** the artifact review entry is cleared

**And** git log shows the new commit

**Prerequisites:** All stories in Epic 5

**Technical Notes:**
- Test with REAL Claude file modifications during story execution
- Verify full flow: Detection → Toast → Sprint Tracker → Approve/Request → Git commit
- Test revision flow: Request changes → Claude edits → Review again
- Test edge cases: Multiple files, rapid changes, container restart mid-review
- Test Git tab: Stage/unstage, commit, push/pull operations

---

## **Epic 5 Complete - Summary**

**Epic 5: Git Integration & Artifact Review**

**Stories:** 11 total
- Story 5.1: Git Status API endpoints
- Story 5.2: Git Operations API endpoints
- Story 5.3: Git Panel UI component (new sidebar tab)
- Story 5.4: BMAD Artifact Detection with Story Linking
- Story 5.5: Artifact Review Badges in Sprint Tracker
- Story 5.6: Approve Artifact with Auto-Stage
- Story 5.7: Request Changes Modal with Claude Injection
- Story 5.8: Quick-Approve Toast Notification
- Story 5.9: Auto-generated Commit Messages
- Story 5.10: Artifact Review State Persistence
- Story 5.11: Validation with End-to-End Review Flow

**FRs Covered:** FR73-FR88 (16 FRs)

**Key Architecture Decisions:**
1. **Git operations** get a dedicated sidebar tab (Files | Workflow | Git)
2. **Artifact review** integrates INTO the Sprint Tracker's existing artifact display (StoryRow/ArtifactList)
3. **Review state** is stored per-session and linked to story artifacts
4. **Quick-approve toasts** provide fast approval path without navigation
5. **Reuse existing components**: ArtifactViewer, DiffView, Toast system

**Dependencies:**
- Epic 6 (Sprint Tracker with artifact display)
- Epic 4 (Toast notifications)
- Epic 3 (DiffView, ArtifactViewer)
- Epic 2 (Sessions with worktrees)

**User Value Delivered:** Developers can review Claude-modified files in context of the current story, approve or request changes with one click, and batch-commit approved files - all without typing git commands or leaving the Sprint Tracker workflow.

---
