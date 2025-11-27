# Epic 2 Validation Checklist
## Story 2.12: Validation with 4 Parallel BMAD Workflows

**Date:** _______________
**Tester:** _______________
**Container Version/Commit:** _______________

---

## Pre-Flight Checklist

- [ ] Docker container 'claude-container' is running
- [ ] Backend server is accessible at http://localhost:3000
- [ ] Frontend UI is accessible in browser
- [ ] Test script executed successfully: `./test-epic-2-validation.sh`
- [ ] All 4 sessions created with correct names and branches

**Session IDs (fill in from test script output):**
- Session 1 (epic-auth): `_______________________`
- Session 2 (epic-payments): `_______________________`
- Session 3 (epic-ui-polish): `_______________________`
- Session 4 (epic-notifications): `_______________________`

---

## Phase 1: Session Creation (Task 2)

### AC: All 4 sessions created and visible in UI

- [ ] **2.1** Session 1 "epic-auth" created with branch "test/epic-auth"
- [ ] **2.2** Session 2 "epic-payments" created with branch "test/epic-payments"
- [ ] **2.3** Session 3 "epic-ui-polish" created with branch "test/epic-ui-polish"
- [ ] **2.4** Session 4 "epic-notifications" created with branch "test/epic-notifications"
- [ ] **2.5** All 4 sessions appear in UI with correct names
- [ ] **2.5** All 4 sessions show correct status indicators (idle/gray dot)

**Notes:**
```


```

---

## Phase 2: Workflow Initialization (Task 3)

### Workflows Started

- [ ] **3.1** Session 1: `/bmad:bmm:workflows:brainstorm-project` → PRD → architecture started
- [ ] **3.2** Session 2: `/bmad:bmm:workflows:prd` started
- [ ] **3.3** Session 3: `/bmad:bmm:workflows:create-ux-design` started
- [ ] **3.4** Session 4: `/bmad:bmm:workflows:dev-story` started
- [ ] **3.5** All 4 terminals streaming output simultaneously
- [ ] **3.6** No terminal output cross-contamination observed
- [ ] **3.7** No WebSocket message loss or ordering issues

**Notes:**
```


```

---

## Phase 3: Parallel Terminal Streaming (AC1, AC2, AC3)

### AC1: All 4 terminals show real-time output simultaneously

- [ ] Session 1 terminal shows real-time output
- [ ] Session 2 terminal shows real-time output
- [ ] Session 3 terminal shows real-time output
- [ ] Session 4 terminal shows real-time output
- [ ] All terminals update concurrently (no blocking)

**Notes:**
```


```

### AC2: Tab switching is instant (<50ms)

- [ ] **4.1** Tab switching tested between all session pairs
- [ ] **4.2** Perceived latency feels instant (no noticeable delay)
- [ ] **4.3** No terminal rendering lag or stutter during switch
- [ ] **4.4** Keyboard shortcuts work (if implemented: Cmd+1, Cmd+2, Cmd+3, Cmd+4)
- [ ] **4.5** Active tab visual highlight updates correctly

**Latency Measurement (if measured in DevTools):**
- p99 latency: _______ ms (Target: <50ms)

**Notes:**
```


```

### AC3: No terminal output cross-contamination

- [ ] **3.6** Each terminal shows ONLY its own workflow output
- [ ] Session 1 output is isolated (brainstorm/PRD/arch content only)
- [ ] Session 2 output is isolated (PRD content only)
- [ ] Session 3 output is isolated (UX design content only)
- [ ] Session 4 output is isolated (dev-story content only)
- [ ] No text appearing in wrong terminals
- [ ] Output complete with no missing lines

**Notes:**
```


```

---

## Phase 4: Git Worktree Isolation (AC4, AC7)

### AC4: Git worktrees remain isolated

- [ ] **5.1** Each session operates in its own worktree directory
- [ ] **5.2** Session 1 on branch: test/epic-auth
- [ ] **5.2** Session 2 on branch: test/epic-payments
- [ ] **5.2** Session 3 on branch: test/epic-ui-polish
- [ ] **5.2** Session 4 on branch: test/epic-notifications
- [ ] **5.5** `git status` in each session shows independent changes
- [ ] **5.6** No file conflicts between sessions

**Worktree Paths:**
- Session 1: `/workspace/.worktrees/_______________________`
- Session 2: `/workspace/.worktrees/_______________________`
- Session 3: `/workspace/.worktrees/_______________________`
- Session 4: `/workspace/.worktrees/_______________________`

**Notes:**
```


```

### AC7: Session 3 UX spec isolated to its worktree

- [ ] **5.3** Session 3 generated UX spec file
- [ ] **5.4** UX spec exists in Session 3's worktree: `/workspace/.worktrees/<session-3-id>/docs/ux-design.md`
- [ ] **5.4** UX spec NOT present in Session 1's worktree
- [ ] **5.4** UX spec NOT present in Session 2's worktree
- [ ] **5.4** UX spec NOT present in Session 4's worktree
- [ ] **7.5** Session 3 status updates to 'idle' after workflow completion

**Generated Files:**
```
Session 3 UX artifacts:
-


```

**Notes:**
```


```

---

## Phase 5: Status Indicators & Session Autonomy (AC5, AC6)

### AC5: Status badge when Claude asks question

- [ ] **6.1** Session 2 reached user input prompt (Claude asked question)
- [ ] **6.2** Session 2 tab shows "!" badge indicator
- [ ] **6.3** Session 2 status indicator changes to "waiting" (yellow/orange dot)
- [ ] **6.5** After answering, "!" badge disappears

**Question asked by Claude in Session 2:**
```


```

**Notes:**
```


```

### AC6: Other sessions continue autonomously

- [ ] **6.4** Session 1 continued working while Session 2 waiting (green "active" dot)
- [ ] **6.4** Session 3 continued working while Session 2 waiting (green "active" dot)
- [ ] **6.4** Session 4 continued working while Session 2 waiting (green "active" dot)
- [ ] Sessions 1, 3, 4 terminal output continued streaming

**Notes:**
```


```

---

## Phase 6: Resource Usage Monitoring (Task 9)

### NFR-SCALE-2: Memory usage 4-8GB for 4 sessions

- [ ] **9.1** Docker stats monitored during parallel execution
- [ ] **9.2** Total memory usage within 4-8GB bounds
- [ ] **9.3** CPU usage distributes across cores
- [ ] **9.4** No memory leaks (stable memory over 15+ minute period)
- [ ] **9.5** No zombie PTY processes found

**Resource Measurements:**
- Peak Memory Usage: _______ GB/MB
- Average Memory Usage: _______ GB/MB
- CPU Usage Pattern: _______________________
- Duration Monitored: _______ minutes
- Zombie Processes: Yes / No

**Docker Stats Output:**
```


```

**Notes:**
```


```

---

## Phase 7: Error Handling & Crash Isolation (AC6, Task 10)

### Crash Isolation Testing

- [ ] **10.1** Session 2 PTY process identified (PID: _______)
- [ ] **10.1** Session 2 PTY force-killed with `kill -9`
- [ ] **10.2** Session 2 status changed to "error" (red dot)
- [ ] **10.3** Session 1 continued running normally
- [ ] **10.3** Session 3 continued running normally
- [ ] **10.3** Session 4 continued running normally
- [ ] **10.4** Session 2 restarted via UI successfully
- [ ] **10.5** Restarted Session 2 resumed in correct worktree
- [ ] **10.5** Restarted Session 2 on correct branch (test/epic-payments)

**Notes:**
```


```

---

## Phase 8: Container Restart & Session Resume (AC8, Task 8)

### Container Restart Recovery

- [ ] **8.1** Container stopped while sessions running: `docker stop claude-container`
- [ ] **8.2** Session persistence file verified: `/workspace/.claude-container-sessions.json`
- [ ] **8.2** Container started: `docker start claude-container`
- [ ] **8.3** All 4 sessions restored from JSON
- [ ] **8.3** All sessions initially show status='idle'
- [ ] **8.4** Session 1 manually resumed successfully
- [ ] **8.4** Session 2 manually resumed successfully
- [ ] **8.4** Session 3 manually resumed successfully
- [ ] **8.4** Session 4 manually resumed successfully
- [ ] **8.5** Each session's worktree intact after restart
- [ ] **8.5** Each session's branch intact after restart
- [ ] **8.6** Generated files persist (UX spec, PRD, etc.)

**Persistence Verification:**
```
Files that persisted after restart:
-
-
-
```

**Notes:**
```


```

---

## Phase 9: Workflow Completion Verification (Task 7)

### Session 1 (epic-auth) - Brainstorm → PRD → Architecture

- [ ] **7.1** Workflow completed successfully
- [ ] **7.2** Generated files in correct worktree only:
  - [ ] `docs/brainstorm.md` or similar
  - [ ] `docs/prd.md` or similar
  - [ ] `docs/architecture.md` or similar
- [ ] **7.5** Session status updated to 'idle' after completion

**Generated Files:**
```


```

### Session 2 (epic-payments) - PRD

- [ ] **7.1** Workflow completed successfully
- [ ] **7.2** Generated files in correct worktree only:
  - [ ] `docs/prd.md` or similar
- [ ] **7.5** Session status updated to 'idle' after completion

**Generated Files:**
```


```

### Session 3 (epic-ui-polish) - UX Design

- [ ] **7.1** Workflow completed successfully
- [ ] **7.2** Generated files in correct worktree only:
  - [ ] `docs/ux-design.md` or similar
  - [ ] `docs/*.excalidraw` files
- [ ] **7.5** Session status updated to 'idle' after completion

**Generated Files:**
```


```

### Session 4 (epic-notifications) - Dev Story

- [ ] **7.1** Workflow completed successfully
- [ ] **7.2** Generated files in correct worktree only:
  - [ ] Code changes in `backend/` or `frontend/`
  - [ ] Test files created (if applicable)
- [ ] **7.5** Session status updated to 'idle' after completion

**Generated Files:**
```


```

**Notes:**
```


```

---

## Overall Validation Results

### All Acceptance Criteria Summary

- [ ] **AC1**: All 4 terminals show real-time output simultaneously ✓
- [ ] **AC2**: Tab switching <50ms ✓
- [ ] **AC3**: No terminal output cross-contamination ✓
- [ ] **AC4**: Git worktrees remain isolated ✓
- [ ] **AC5**: Session 2 shows "!" badge when waiting ✓
- [ ] **AC6**: Sessions 1, 3, 4 continue autonomously ✓
- [ ] **AC7**: Session 3 UX spec in its worktree only ✓
- [ ] **AC8**: All 4 sessions restore after container restart ✓

### Success Metrics (from Tech Spec)

- [ ] All 4 workflows completed successfully ✓
- [ ] No terminal output cross-contamination observed ✓
- [ ] Tab switching <50ms consistently ✓
- [ ] Resource usage within 4-8GB bounds ✓
- [ ] Sessions isolated (files only in respective worktrees) ✓
- [ ] Container restart recovery works correctly ✓

---

## Issues & Anomalies Discovered

**Issue 1:**
```
Description:
Severity: Critical / Major / Minor / Cosmetic
Affects AC:
Steps to Reproduce:


```

**Issue 2:**
```
Description:
Severity: Critical / Major / Minor / Cosmetic
Affects AC:
Steps to Reproduce:


```

**Issue 3:**
```
Description:
Severity: Critical / Major / Minor / Cosmetic
Affects AC:
Steps to Reproduce:


```

---

## Recommendations

### Passed with No Issues
- [ ] All acceptance criteria met
- [ ] No critical or major issues found
- [ ] Recommend moving story to DONE

### Passed with Minor Issues
- [ ] All acceptance criteria met
- [ ] Minor issues logged (see above)
- [ ] Issues can be addressed in Epic 4 (Testing & Polish)
- [ ] Recommend moving story to DONE with issues logged

### Failed
- [ ] One or more acceptance criteria NOT met
- [ ] Critical issues found
- [ ] Recommend keeping story in IN PROGRESS
- [ ] Fixes required before proceeding

---

## Screenshots & Evidence

**Screenshot 1: All 4 sessions running concurrently**
- File: `_______________________`
- Description: UI showing all 4 session tabs with active terminals

**Screenshot 2: Status indicators**
- File: `_______________________`
- Description: Session 2 with "!" badge, others with active status

**Screenshot 3: Git worktree isolation**
- File: `_______________________`
- Description: Terminal showing git status in different worktrees

**Screenshot 4: Resource usage**
- File: `_______________________`
- Description: Docker stats showing memory/CPU usage

**Screenshot 5: Container restart recovery**
- File: `_______________________`
- Description: UI showing all sessions restored after restart

---

## Sign-Off

**Validation Completed:** Yes / No
**Date:** _______________
**Tester Signature:** _______________

**Next Steps:**
1. [ ] Update Story 2.12 Dev Agent Record with results
2. [ ] Attach screenshots to story documentation
3. [ ] Log any issues in issue tracker or Epic 4 backlog
4. [ ] Move story to 'review' or 'done' status
5. [ ] Clean up test sessions and worktrees

---

## Cleanup Commands

```bash
# Delete all test sessions (with worktree cleanup)
curl -X DELETE "http://localhost:3000/api/sessions/<session-1-id>?cleanup=true"
curl -X DELETE "http://localhost:3000/api/sessions/<session-2-id>?cleanup=true"
curl -X DELETE "http://localhost:3000/api/sessions/<session-3-id>?cleanup=true"
curl -X DELETE "http://localhost:3000/api/sessions/<session-4-id>?cleanup=true"

# Or use UI to delete each session with cleanup checkbox
```
