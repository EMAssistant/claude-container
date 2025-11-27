# Epic 5 Validation Checklist

**Validation Story:** 5.11 - Validation with End-to-End Review Flow
**Date Created:** 2025-11-27
**Purpose:** Step-by-step testing guide for all 10 acceptance criteria

## Prerequisites

Before starting validation, ensure:

- [ ] Docker container running: `docker ps | grep claude-container`
- [ ] Frontend accessible at http://localhost:3000
- [ ] All Epic 5 stories (5.1-5.10) marked "done" in sprint-status.yaml
- [ ] Git configured in container:
  ```bash
  docker exec -it claude-container git config --global user.name
  docker exec -it claude-container git config --global user.email
  ```
- [ ] Browser dev tools open (for monitoring WebSocket messages, network, console)
- [ ] Sprint Tracker visible (left sidebar → Workflow tab)

---

## Test Environment Setup

### Step 1: Create Test Session

- [ ] Navigate to http://localhost:3000
- [ ] Click "New Session" button
- [ ] Enter session details:
  - **Session name:** `validation-epic-5`
  - **Branch:** `validation-epic-5` (new branch)
- [ ] Click "Create Session"
- [ ] Wait for session creation (Claude CLI prompt appears in terminal)
- [ ] Verify git worktree created at `/workspace/.worktrees/{sessionId}`

### Step 2: Prepare Test File

- [ ] In the session terminal, create test directory:
  ```bash
  mkdir -p src/test
  ```
- [ ] Create test file `src/test/ValidationTarget.tsx`:
  ```typescript
  export function ValidationTarget() {
    const [count, setCount] = useState(0);

    return (
      <div>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
      </div>
    );
  }
  ```
- [ ] Save the file (baseline version for comparison)

### Step 3: Attach Session to Story

- [ ] Open Sprint Tracker in left sidebar
- [ ] Verify a story is marked "in-progress" in sprint-status.yaml
- [ ] Attach session to the active story (context menu or auto-detection)
- [ ] Confirm currentStory context set in backend

---

## Acceptance Criteria Testing

### AC #1: Toast Notification Appears When Claude Modifies File

**Expected Result:** Toast notification appears within 2 seconds with format: "📄 {filename} modified"

**Test Steps:**

- [ ] **Step 1.1:** Simulate Claude file modification
  - Use Claude CLI in terminal to ask: "Add a useState import to ValidationTarget.tsx"
  - Wait for Claude to modify the file
  - Alternative: Manually edit file within 5s of simulated Claude activity

- [ ] **Step 1.2:** Observe toast notification
  - **Check:** Toast appears within 2 seconds of file write
  - **Check:** Toast displays format: "📄 ValidationTarget.tsx modified"
  - **Check:** Toast shows action buttons: [View Diff] [✓ Approve] [Dismiss]
  - **Check:** Toast auto-dismisses after 10 seconds if not interacted with

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #2: Dismiss Toast Shows Artifact in Sprint Tracker

**Expected Result:** Sprint Tracker displays pending artifact with ⏳ badge

**Test Steps:**

- [ ] **Step 2.1:** Dismiss toast notification
  - Click [Dismiss] button (or wait for auto-dismiss)
  - Toast should disappear

- [ ] **Step 2.2:** Verify Sprint Tracker update
  - Open Sprint Tracker (left sidebar → Workflow tab)
  - **Check:** Artifact appears under the active story
  - **Check:** Artifact row shows ⏳ badge (pending review status)
  - **Check:** Story row header shows pending count (e.g., "1 pending")

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #3: Artifact Shows Review Action Buttons on Expand

**Expected Result:** Artifact row displays format: "📄 {filename} ⏳ [View] [✓] [✎]"

**Test Steps:**

- [ ] **Step 3.1:** Expand story row
  - If story row is collapsed, click to expand
  - Artifact list should be visible

- [ ] **Step 3.2:** Verify action buttons
  - **Check:** Artifact row shows: "📄 ValidationTarget.tsx ⏳ [View] [✓] [✎]"
  - **Check:** [View] button is clickable
  - **Check:** [✓] button is clickable
  - **Check:** [✎] button is clickable

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #4: ArtifactViewer Opens with Diff View

**Expected Result:** Diff view shows changes with green additions and red deletions

**Test Steps:**

- [ ] **Step 4.1:** Open ArtifactViewer
  - Click [View] button on pending artifact
  - ArtifactViewer should open in main content area

- [ ] **Step 4.2:** Verify diff view
  - **Check:** Diff view toggle is enabled by default
  - **Check:** Changes are highlighted:
    - Green background for additions (e.g., `import { useState } from 'react';`)
    - Red background for deletions (if any)
  - **Check:** File content is readable with syntax highlighting
  - **Check:** Line numbers are visible

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #5: Request Changes Modal Sends Feedback to Claude

**Expected Result:** Feedback appears in Claude's terminal stdin, badge changes to ⚠️

**Test Steps:**

- [ ] **Step 5.1:** Open Request Changes modal
  - Click [✎] button on pending artifact
  - Modal dialog should open with textarea

- [ ] **Step 5.2:** Enter feedback and send
  - Type feedback: "Add error handling for network failures"
  - Click [Send to Claude →] button
  - **Check:** Modal closes

- [ ] **Step 5.3:** Verify feedback delivery
  - **Check:** Feedback appears in Claude's terminal (stdin)
  - **Check:** Claude receives message in session

- [ ] **Step 5.4:** Verify artifact status update
  - **Check:** Artifact badge changes from ⏳ to ⚠️ (changes-requested)
  - **Check:** Artifact row shows "⚠️ Changes requested" status
  - **Check:** Sprint Tracker reflects updated status

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #6: Claude Updates File Shows Revision 2

**Expected Result:** Artifact reappears with ⏳ pending status and "Revision 2" indicator

**Test Steps:**

- [ ] **Step 6.1:** Simulate Claude responding to feedback
  - Use Claude CLI to modify ValidationTarget.tsx again (add error handling)
  - Ensure edit happens after changes requested (⚠️ status)

- [ ] **Step 6.2:** Verify revision counter and status reset
  - **Check:** Artifact reappears with ⏳ pending status (reset from ⚠️)
  - **Check:** Artifact row shows "Revision 2" indicator
  - **Check:** New toast notification appears (if Story 5.8 implemented)
  - **Check:** Previous feedback stored in session.artifactReviews[path].feedback

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #7: Approve Artifact Stages File in Git Panel

**Expected Result:** Artifact badge changes to ✓, Git panel shows staged file

**Test Steps:**

- [ ] **Step 7.1:** Approve artifact
  - Click [✓ Approve] button on pending artifact
  - **Check:** Artifact badge changes to ✓ (approved, green checkmark)
  - **Check:** Success toast appears: "ValidationTarget.tsx approved and staged"

- [ ] **Step 7.2:** Verify Git panel staging
  - Open Git panel (left sidebar → Git tab)
  - **Check:** Staged section lists `src/test/ValidationTarget.tsx`
  - **Check:** File shows "M " status (modified, staged)

- [ ] **Step 7.3:** Verify git status via command line
  - Run in session terminal: `git status --porcelain`
  - **Check:** Output includes: `M  src/test/ValidationTarget.tsx`
  - Confirms file is staged in git index

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #8: Commit with Auto-Generated Message Succeeds

**Expected Result:** Commit message populates, commit succeeds, staged section clears

**Test Steps:**

- [ ] **Step 8.1:** Test auto-generated commit message
  - Open Git panel (if not already open)
  - Click [Auto-generate message] button
  - **Check:** Message format: "Implement story {storyId}: {story-title}"
  - **Check:** Message body lists staged files
  - **Check:** First line is <72 characters
  - **Check:** Story ID extracted from Sprint Tracker context

- [ ] **Step 8.2:** Commit staged files
  - Verify commit message is populated (from Step 8.1)
  - Click [Commit Staged Files] button
  - **Check:** Commit succeeds (no errors)
  - **Check:** Success toast: "Committed 1 file(s)"
  - **Check:** Git panel Staged section clears (file moves to committed)

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #9: Artifact Review Entry Cleared After Commit

**Expected Result:** Committed file no longer shows review badge in Sprint Tracker

**Test Steps:**

- [ ] **Step 9.1:** Refresh Sprint Tracker or wait for update
  - Sprint Tracker should auto-refresh via WebSocket
  - Alternatively, manually refresh browser or navigate away and back

- [ ] **Step 9.2:** Verify artifact review entry cleared
  - **Check:** ValidationTarget.tsx no longer shows review badge (no ⏳/✓/⚠️)
  - **Check:** Artifact appears as regular artifact (if still listed)
  - **Check:** Story row no longer shows pending count

- [ ] **Step 9.3:** Inspect session JSON (optional)
  - Access session JSON file (backend): `/workspace/.sessions/{sessionId}.json`
  - **Check:** artifactReviews map no longer contains `src/test/ValidationTarget.tsx` entry
  - Confirms cleanup after commit

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### AC #10: Git Log Shows New Commit

**Expected Result:** Latest commit shows auto-generated message with correct files

**Test Steps:**

- [ ] **Step 10.1:** Verify git log
  - Run in session terminal: `git log -1 --stat`
  - **Check:** Latest commit message matches auto-generated format
  - **Check:** Commit includes `src/test/ValidationTarget.tsx` with change stats
  - **Check:** Commit author is correct (git config user.name)
  - **Check:** Commit timestamp is reasonable (within last few minutes)

- [ ] **Step 10.2:** Verify commit diff (optional)
  - Run: `git show HEAD`
  - **Check:** Diff shows actual changes made to ValidationTarget.tsx
  - **Check:** Changes match what was approved in ArtifactViewer

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

## Edge Cases Testing (Optional but Recommended)

### Edge Case 1: Multiple Files Modified Simultaneously

**Test Steps:**

- [ ] Claude modifies 2+ files within 5-second window
- [ ] **Check:** Each file shows separate toast notification
- [ ] **Check:** Sprint Tracker shows multiple pending artifacts
- [ ] **Check:** Each artifact can be approved/rejected independently
- [ ] **Check:** Story row shows correct pending count (e.g., "2 pending")

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Edge Case 2: Rapid Changes (Claude Writes Multiple Times Within 5s)

**Test Steps:**

- [ ] Claude modifies same file multiple times rapidly (<5s apart)
- [ ] **Check:** Artifact shows latest version (not stale)
- [ ] **Check:** Revision counter increments correctly (Revision 2, 3, etc.)
- [ ] **Check:** No duplicate artifacts in Sprint Tracker
- [ ] **Check:** Toast notifications don't stack excessively (auto-dismiss works)

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Edge Case 3: Container Restart Mid-Review (Persistence Test)

**Test Steps:**

- [ ] Approve an artifact (badge → ✓, file staged)
- [ ] Restart container: `docker restart claude-container`
- [ ] Wait for container to come back up
- [ ] Refresh browser, reconnect to session
- [ ] **Check:** Artifact review state persisted (still shows ✓ badge)
- [ ] **Check:** Git status still shows file staged
- [ ] **Check:** Session JSON artifactReviews map intact

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Edge Case 4: Browser Refresh During Review Flow

**Test Steps:**

- [ ] Open ArtifactViewer for pending artifact
- [ ] Refresh browser (F5 or Cmd+R)
- [ ] **Check:** Sprint Tracker reloads correctly
- [ ] **Check:** Pending artifacts still visible with ⏳ badge
- [ ] **Check:** No data loss (artifactReviews state intact)

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Edge Case 5: Concurrent Sessions with Different Review States

**Test Steps:**

- [ ] Create 2 sessions, each attached to different stories
- [ ] Modify file in Session A → approve → stage
- [ ] Modify file in Session B → request changes
- [ ] **Check:** Session A artifact shows ✓, Session B shows ⚠️ (no cross-contamination)
- [ ] **Check:** Git panel shows correct staged files per session
- [ ] **Check:** Commits in each session include only that session's files

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

## Backward Compatibility Testing

### Test 1: Old Session JSON Without artifactReviews Field

**Test Steps:**

- [ ] Create session JSON file manually (pre-Epic 5 format, no artifactReviews field)
- [ ] Restart container to load session
- [ ] **Check:** No errors in backend logs
- [ ] **Check:** Empty artifactReviews map initialized (backward compatibility)
- [ ] **Check:** Session loads normally

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Test 2: Sprint Tracker with No Review States

**Test Steps:**

- [ ] Create session without Claude modifications (no artifactReviews)
- [ ] Open Sprint Tracker
- [ ] **Check:** Regular artifacts display correctly (no review badges)
- [ ] **Check:** No ⏳/✓/⚠️ badges shown (only for reviewed artifacts)
- [ ] **Check:** Artifact list behaves normally

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Test 3: Git Panel Operations Independently

**Test Steps:**

- [ ] Manually stage file via terminal: `git add src/test/ManualFile.tsx`
- [ ] **Check:** Git panel reflects manual staging (not via approve flow)
- [ ] Commit manually via Git panel (without artifact review)
- [ ] **Check:** Git operations work normally (no dependency on artifact review)

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

## Security Validation

### Security Test 1: Feedback Injection (Shell Command Escape)

**Test Steps:**

- [ ] In Request Changes modal, type malicious feedback: `; rm -rf /`
- [ ] Send to Claude
- [ ] **Check:** Feedback is escaped/sanitized (no shell command injection)
- [ ] **Check:** Claude receives literal string (not executed as command)
- [ ] **Check:** No file system damage

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Security Test 2: Path Traversal (File Outside Worktree)

**Test Steps:**

- [ ] Attempt to review file outside worktree: `/etc/passwd`
- [ ] **Check:** ArtifactViewer refuses to open (path validation)
- [ ] **Check:** Error message: "File outside worktree"
- [ ] **Check:** No sensitive file contents exposed

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Security Test 3: XSS (Filename with Script Tag)

**Test Steps:**

- [ ] Create file with malicious name: `<script>alert('XSS')</script>.tsx`
- [ ] Claude modifies this file
- [ ] **Check:** Filename is escaped in toast notification (no alert popup)
- [ ] **Check:** Filename is escaped in Sprint Tracker (no XSS)
- [ ] **Check:** ArtifactViewer renders filename safely

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

## Performance Validation

### Performance Test 1: Toast Notification Latency

**Test Steps:**

- [ ] Note timestamp when Claude writes file (check backend logs)
- [ ] Note timestamp when toast appears (check browser console or visual observation)
- [ ] **Check:** Latency <2 seconds (AC requirement)
- [ ] **Measurement:** _________ ms

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Performance Test 2: ArtifactViewer Open Time

**Test Steps:**

- [ ] Click [View] button, measure time to diff view render
- [ ] **Check:** ArtifactViewer opens <500ms (NFR requirement)
- [ ] **Measurement:** _________ ms

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Performance Test 3: Approve → Stage Latency

**Test Steps:**

- [ ] Click [✓ Approve], measure time to Git panel update
- [ ] **Check:** Approve → stage <1 second (NFR requirement)
- [ ] **Measurement:** _________ ms

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

### Performance Test 4: Commit Latency

**Test Steps:**

- [ ] Click [Commit Staged Files], measure time to success toast
- [ ] **Check:** Commit <2 seconds (NFR requirement)
- [ ] **Measurement:** _________ ms

**Result:** ☐ PASS ☐ FAIL
**Notes:**
______________________________________________________________________

---

## Summary

**Total Acceptance Criteria:** 10
**Passed:** ______ / 10
**Failed:** ______ / 10

**Total Edge Cases:** 5
**Passed:** ______ / 5
**Failed:** ______ / 5

**Total Backward Compatibility:** 3
**Passed:** ______ / 3
**Failed:** ______ / 3

**Total Security Tests:** 3
**Passed:** ______ / 3
**Failed:** ______ / 3

**Total Performance Tests:** 4
**Passed:** ______ / 4
**Failed:** ______ / 4

**Overall Result:** ☐ ALL PASS (Production Ready) ☐ ISSUES FOUND (See validation-report-epic-5.md)

**Validation Completed By:** __________________
**Date:** __________________
**Signature:** __________________

---

## Notes

- Document all failures in validation-report-epic-5.md with detailed steps to reproduce
- Capture screenshots or screen recordings for visual evidence
- Log WebSocket messages and backend logs for debugging
- Report HIGH/MEDIUM severity issues immediately
- LOW severity issues can be deferred to future epics or tech debt

**Next Steps After Validation:**

1. Fill out validation-report-epic-5.md with detailed results
2. Attach screenshots to validation-screenshots/ folder (optional)
3. Mark Story 5.11 as "review" in sprint-status.yaml
4. Run Epic 5 retrospective workflow if validation passes
5. Address any HIGH/MEDIUM severity issues before marking Epic 5 "done"
