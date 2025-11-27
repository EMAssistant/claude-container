# Epic 4 Production Validation Framework

**Epic:** 4 - Production Stability & Polish
**Validation Period:** 7 consecutive days of daily use
**Created:** 2025-11-26
**Status:** TEMPLATE (not yet validated)

---

## Purpose and Scope

This document provides the framework and checklists for conducting a comprehensive 1-week production validation of Epic 4 features. This is **not** the actual validation results—this is the **framework** that will guide the validation process.

**What this framework covers:**
- Daily validation routine and tracking methodology
- Multi-project validation scenarios (3+ projects with diverse tech stacks)
- 4 concurrent sessions stress test checklist
- Issue tracking template with severity classifications
- Performance validation against NFR-PERF targets
- Reliability validation (failure recovery scenarios)
- Usability validation criteria
- Documentation validation checklist
- Epic 4 feature completeness validation
- Pass/fail criteria for production readiness

**Success Criteria:**
At the end of 7 days, this framework will have guided validation to answer:
1. Does Claude Container meet 99%+ uptime (NFR-REL-1)?
2. Do all performance targets pass (NFR-PERF 1-4)?
3. Do all Epic 4 features work as specified?
4. Are all critical issues resolved?
5. Is the system ready for production use?

---

## Executive Summary Template

**VALIDATION OUTCOME:** [ ] PASS / [ ] FAIL / [ ] CONDITIONAL PASS

**Validation Period:** [Start Date] to [End Date]
**Total Days:** 7 consecutive days
**Validator:** [Your Name]

**Key Findings (to be filled during validation):**
- [ ] Uptime: ___%  (target: 99%+)
- [ ] Performance targets: ___/4 passed  (target: 4/4)
- [ ] Epic 4 features validated: ___/10  (target: 10/10)
- [ ] Critical issues: ___ (target: 0 unresolved)
- [ ] Projects tested: ___ (target: 3+)

**Overall Assessment:** [To be filled]

**Production Readiness:** [ ] READY / [ ] NOT READY / [ ] READY WITH CAVEATS

**Caveats (if any):** [List any known limitations or issues that don't block production]

---

## Daily Validation Log Template

Copy this template to `validation-log-epic-4.md` and fill daily.

### Daily Activity Log

| Date | Day | Projects Worked On | Sessions Created | Issues Encountered | Performance Notes | Usability Notes | Hours Active |
|------|-----|-------------------|------------------|-------------------|-------------------|-----------------|--------------|
| [Date] | 1 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |
| [Date] | 2 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |
| [Date] | 3 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |
| [Date] | 4 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |
| [Date] | 5 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |
| [Date] | 6 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |
| [Date] | 7 | [Project names] | [Count] | [IDs or "None"] | [Latency, responsiveness] | [UX observations] | [Hours] |

**Total Sessions:** ___
**Total Projects:** ___
**Total Hours:** ___
**Downtime Events:** ___

---

## Daily Validation Focus Areas

Each day has a specific validation focus, but all days include normal development work.

### Day 1: Initial Validation & Baseline
**Focus:** Establish baseline performance and functionality

**Activities:**
- [ ] Start container with `docker run` (verify health check at http://localhost:3000/api/health)
- [ ] Work on primary project (claude-container or similar) with 2-3 sessions
- [ ] Test core workflows:
  - [ ] Create new session with git worktree isolation
  - [ ] Execute terminal commands (build, test, run)
  - [ ] Navigate file tree and view documents
  - [ ] Review workflow status (if BMAD project)
  - [ ] Switch between sessions using tabs
- [ ] Collect baseline performance metrics:
  - [ ] Sample terminal latency 5+ times (record in performance log)
  - [ ] Sample tab switch time 5+ times
  - [ ] Record session creation time for each session
- [ ] Log any issues immediately in issue tracker
- [ ] End-of-day notes: Overall impression, any surprises

### Day 2: Multi-Session Stress Test
**Focus:** Verify 4 concurrent sessions (max capacity test)

**Activities:**
- [ ] Create 4 concurrent sessions (one per session limit)
- [ ] Run different workflows in each session:
  - Session 1: Terminal-heavy (build/test with verbose output)
  - Session 2: File navigation and document review
  - Session 3: Workflow status tracking
  - Session 4: Idle (test idle detection)
- [ ] Monitor system resources:
  - [ ] Check memory usage: `docker stats claude-container` (every 30 min)
  - [ ] Target: Stay below 93% (7.5GB out of 8GB)
  - [ ] Warning should appear at 87% (7GB)
- [ ] Test tab switching performance:
  - [ ] Rapid switching between all 4 sessions (record times)
  - [ ] Target: <50ms per switch
- [ ] Test keyboard shortcuts:
  - [ ] Cmd+1, Cmd+2, Cmd+3, Cmd+4 (session switching)
  - [ ] Cmd+N (new session modal)
  - [ ] Cmd+T (toggle terminal focus)
  - [ ] ESC (close modals)
- [ ] Document any performance degradation
- [ ] End-of-day notes: System responsiveness under load

### Day 3: Multi-Project Validation
**Focus:** Validate across different tech stacks and project structures

**Activities:**
- [ ] Switch to Project 2 (different tech stack from Project 1)
- [ ] Document project characteristics:
  - [ ] Languages: [e.g., Python, Ruby, Java]
  - [ ] Frameworks: [e.g., Django, Rails, Spring]
  - [ ] Build tools: [e.g., pip, bundler, maven]
- [ ] Test typical workflows for this project:
  - [ ] Session creation with project-specific branch
  - [ ] Build/test/run commands for this tech stack
  - [ ] File tree navigation (verify structure renders correctly)
  - [ ] Document viewing (README, code files)
- [ ] Compare performance vs. Day 1 baseline:
  - [ ] Is terminal latency consistent across projects?
  - [ ] Is file tree performance affected by project size?
- [ ] Log project-specific observations
- [ ] End-of-day notes: Cross-project compatibility assessment

### Day 4: Failure Scenario Testing
**Focus:** Validate graceful recovery from expected failures

**Failure Scenarios:**

#### Scenario 1: WebSocket Disconnection
- [ ] **Trigger:** Disable network (macOS: System Settings > Network > disconnect)
- [ ] **Expected:** WebSocket disconnects, reconnection attempt starts
- [ ] **Verify:** Reconnection succeeds within 5s (check WebSocket status indicator)
- [ ] **Verify:** No data loss (terminal history intact, session state preserved)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Scenario 2: PTY Process Crash
- [ ] **Trigger:** Kill PTY process manually: `docker exec claude-container pkill -9 -f pty`
- [ ] **Expected:** PTY crash isolated to single session, other sessions unaffected
- [ ] **Verify:** Session shows error message (user-friendly, actionable)
- [ ] **Verify:** Other sessions continue working normally
- [ ] **Verify:** Can create new session after crash
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Scenario 3: High Memory Scenario
- [ ] **Trigger:** Create 4 sessions, run memory-intensive tasks in each
- [ ] **Expected:** Warning at 87% memory (7GB), new session blocked at 93% (7.5GB)
- [ ] **Verify:** Warning toast appears at 87% threshold
- [ ] **Verify:** Attempting new session at 93%+ shows error message
- [ ] **Verify:** System remains responsive (no crash)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Scenario 4: Container Restart
- [ ] **Trigger:** Graceful shutdown: `docker stop claude-container` (sends SIGTERM)
- [ ] **Expected:** Shutdown completes within 10s
- [ ] **Verify:** Session state saved to `.claude-container-sessions.json`
- [ ] **Verify:** No error messages on shutdown (check logs: `docker logs claude-container --tail 50`)
- [ ] **Restart:** `docker start claude-container`
- [ ] **Verify:** Sessions restored to 'stopped' status (manual resume required per Epic 2)
- [ ] **Verify:** Can resume sessions individually
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

**End-of-day notes:** Failure recovery confidence level

### Day 5: Epic 4 Feature Validation
**Focus:** Systematically test all Epic 4 features (see Feature Checklist below)

**Activities:**
- [ ] Complete all items in "Epic 4 Feature Validation Checklist" section
- [ ] Test each feature methodically with pass/fail result
- [ ] Document any feature gaps or partial implementations
- [ ] Verify all Epic 4 objectives from tech spec are achieved
- [ ] End-of-day notes: Feature completeness assessment

### Day 6: Multi-Project Validation Continued
**Focus:** Validate on Project 3 (different workflow from Projects 1 & 2)

**Activities:**
- [ ] Switch to Project 3 (diverse tech stack/workflow)
- [ ] Document project characteristics (as in Day 3)
- [ ] Test workflows specific to this project type
- [ ] If non-BMAD project:
  - [ ] Verify layout adapts when workflow status absent
  - [ ] File tree and terminal should still function perfectly
- [ ] Test document review with diff view:
  - [ ] Make changes to files in session
  - [ ] View diffs in artifact viewer
  - [ ] Verify syntax highlighting and diff accuracy
- [ ] Compare performance across all 3 projects
- [ ] End-of-day notes: Project diversity coverage assessment

### Day 7: Documentation Validation & Final Testing
**Focus:** Verify documentation accuracy and completeness

**Activities:**
- [ ] Use documentation for troubleshooting:
  - [ ] Trigger an issue from troubleshooting guide
  - [ ] Follow documented solution steps
  - [ ] Verify solution works as documented
- [ ] Test Quick Start guide with fresh setup:
  - [ ] Spin up new container from scratch (or use colleague's machine)
  - [ ] Follow README Quick Start step-by-step
  - [ ] Document any unclear or missing steps
- [ ] Verify API documentation accuracy:
  - [ ] Test REST endpoints: `curl http://localhost:3000/api/health`
  - [ ] Verify WebSocket message types match docs (use browser DevTools)
  - [ ] Check Epic 4 message types: `session.status`, `session.warning`, `resource.warning`
- [ ] Review entire week's activity:
  - [ ] Any recurring issues or patterns?
  - [ ] Any workflows that feel awkward?
  - [ ] Documentation gaps identified?
- [ ] End-of-day notes: Final production readiness assessment

---

## Issue Tracking Template

Copy to `validation-log-epic-4.md` and add issues as encountered.

### Issue Tracker

| ID | Date | Severity | Description | Steps to Reproduce | Expected Behavior | Actual Behavior | Workaround | Status | Resolution |
|----|------|----------|-------------|-------------------|-------------------|-----------------|------------|--------|------------|
| V4-001 | [Date] | [Critical/Major/Minor/Cosmetic] | [Brief description] | [Numbered steps] | [What should happen] | [What actually happened] | [If found] | [Open/Fixed/Deferred] | [How resolved or why deferred] |
| V4-002 | [Date] | [Severity] | [Description] | [Steps] | [Expected] | [Actual] | [Workaround] | [Status] | [Resolution] |

**Add rows as issues are discovered**

### Issue Severity Guidelines

Use these criteria to classify issue severity:

**Critical (MUST fix before validation complete):**
- Container crashes or becomes unresponsive
- Data loss (terminal history, session state, file changes lost)
- Security vulnerability
- Unrecoverable error requiring container restart
- Complete feature failure (e.g., cannot create any sessions)

**Major (Fix or defer with justification):**
- Feature significantly broken but workaround exists
- Severe UX problem affecting daily use
- Performance target missed by >50% (e.g., 200ms latency when target is <100ms)
- Error messages unhelpful or misleading
- Accessibility blocker (WCAG AA violation)

**Minor (Defer to backlog):**
- Edge case bug affecting <10% of usage scenarios
- Low-impact performance issue (target missed by <50%)
- Cosmetic inconsistency
- Non-critical keyboard shortcut issue
- Minor UX improvement opportunity

**Cosmetic (Defer to backlog):**
- Visual polish (spacing, alignment)
- Typos in UI or documentation
- Color/theme inconsistency
- Non-functional UI elements

---

## Performance Validation

### Performance Metrics Tracking

Track these metrics throughout the validation period. Sample multiple times per day.

#### Terminal Latency (NFR-PERF-1)
**Target:** p99 <100ms (PTY output to frontend render)

**Measurement Method:**
- Backend logs timestamps: `ptyOutputReceived` → `websocketSent`
- Frontend measures: `websocketReceived` → `domRendered`
- Total latency = backend + network + frontend

**Sample Collection:**
- Collect 10+ samples per day during normal terminal usage
- Note any outliers and context (high load, large output burst, etc.)

| Date | Samples (ms) | p50 | p95 | p99 | Pass/Fail | Notes |
|------|--------------|-----|-----|-----|-----------|-------|
| Day 1 | [45, 52, 48, 61, 55, 43, 58, 66, 49, 51] | 51 | 64 | 66 | [ ] | [Context] |
| Day 2 | [Sample list] | ___ | ___ | ___ | [ ] | [Context] |
| Day 3 | [Sample list] | ___ | ___ | ___ | [ ] | [Context] |
| Day 4 | [Sample list] | ___ | ___ | ___ | [ ] | [Context] |
| Day 5 | [Sample list] | ___ | ___ | ___ | [ ] | [Context] |
| Day 6 | [Sample list] | ___ | ___ | ___ | [ ] | [Context] |
| Day 7 | [Sample list] | ___ | ___ | ___ | [ ] | [Context] |

**Overall Result:** [ ] PASS (p99 <100ms) / [ ] FAIL

#### Tab Switch Latency (NFR-PERF-2)
**Target:** <50ms (click to UI update)

**Measurement Method:**
- Chrome DevTools Performance tab
- Measure: `click event` → `requestAnimationFrame` → `paint`

**Sample Collection:**
- 5+ samples per day
- Test switching between sessions with different content (terminal vs file tree vs workflow)

| Date | Samples (ms) | Average | Max | Pass/Fail | Notes |
|------|--------------|---------|-----|-----------|-------|
| Day 1 | [12, 15, 18, 22, 14] | 16 | 22 | [ ] | [Context] |
| Day 2 | [Sample list] | ___ | ___ | [ ] | [Context] |
| Day 3 | [Sample list] | ___ | ___ | [ ] | [Context] |
| Day 4 | [Sample list] | ___ | ___ | [ ] | [Context] |
| Day 5 | [Sample list] | ___ | ___ | [ ] | [Context] |
| Day 6 | [Sample list] | ___ | ___ | [ ] | [Context] |
| Day 7 | [Sample list] | ___ | ___ | [ ] | [Context] |

**Overall Result:** [ ] PASS (all <50ms) / [ ] FAIL

#### Session Creation Time (NFR-PERF-3)
**Target:** <5s (click "Create Session" to terminal ready)

**Measurement Method:**
- Measure from "Create Session" button click to first terminal prompt appears

**Sample Collection:**
- Record for every session created during validation

| Date | Session Name | Branch Name | Creation Time (s) | Pass/Fail | Notes |
|------|--------------|-------------|-------------------|-----------|-------|
| Day 1 | [Name] | [Branch] | 2.3 | [ ] | [Context] |
| Day 1 | [Name] | [Branch] | 2.8 | [ ] | [Context] |
| Day 2 | [Name] | [Branch] | ___ | [ ] | [Context] |
| ... | ... | ... | ... | [ ] | ... |

**Overall Result:** [ ] PASS (all <5s) / [ ] FAIL

#### 4 Concurrent Sessions (NFR-PERF-4)
**Target:** No performance degradation with 4 sessions active

**Validation Approach:**
- Compare Day 2 metrics (4 concurrent sessions) vs Day 1 baseline (2-3 sessions)
- Check: Terminal latency, tab switch time, memory usage

**Results:**
- [ ] Terminal latency maintained (within 10% of baseline)
- [ ] Tab switch time maintained (within 10% of baseline)
- [ ] Memory usage below 93% threshold
- [ ] No zombie processes accumulated
- [ ] All 4 sessions remain responsive

**Overall Result:** [ ] PASS / [ ] FAIL

### Performance Summary

At end of validation, fill this summary:

| NFR | Target | Result | Pass/Fail | Notes |
|-----|--------|--------|-----------|-------|
| NFR-PERF-1 | Terminal latency p99 <100ms | p99 = ___ms | [ ] | [Any outliers explained] |
| NFR-PERF-2 | Tab switch <50ms | Max = ___ms | [ ] | [Context] |
| NFR-PERF-3 | Session creation <5s | Max = ___s | [ ] | [Context] |
| NFR-PERF-4 | 4 concurrent sessions no degradation | [Yes/No] | [ ] | [Details] |

**Overall Performance:** [ ] ALL TARGETS MET / [ ] SOME TARGETS MISSED

---

## Reliability Validation

### Uptime Tracking

**Target:** NFR-REL-1: 99%+ uptime during active use

**Downtime Events Log:**

| Date | Time | Duration | Cause | Recovery Method | Data Loss | Severity |
|------|------|----------|-------|-----------------|-----------|----------|
| [Date] | [Time] | [Minutes] | [What happened] | [How recovered] | [Yes/No] | [Critical/Major] |

**Uptime Calculation:**
- Total active hours: ___
- Total downtime hours: ___
- Uptime %: ___ (target: 99%+)
- **Result:** [ ] PASS / [ ] FAIL

### Graceful Recovery Validation

Results from Day 4 failure scenario testing:

| Scenario | Expected Behavior | Actual Behavior | Pass/Fail | Notes |
|----------|------------------|-----------------|-----------|-------|
| WebSocket reconnection | Auto-reconnect <5s | [Observed] | [ ] | [Details] |
| PTY crash isolation | Only affected session fails | [Observed] | [ ] | [Details] |
| High memory handling | Warning at 87%, block at 93% | [Observed] | [ ] | [Details] |
| Container restart | State saved, <10s shutdown | [Observed] | [ ] | [Details] |

**Overall Reliability:** [ ] PASS / [ ] FAIL

---

## Epic 4 Feature Validation Checklist

Test each feature systematically on Day 5 (or throughout the week).

### Story 4.1: Session Status Tracking with Idle Detection

#### Feature 4.1.1: Idle Detection (5 minutes)
- [ ] **Test:** Leave session idle for 5+ minutes (no terminal activity)
- [ ] **Expected:** Session status changes to 'idle'
- [ ] **Verify:** Status indicator updates in session list/tab
- [ ] **Verify:** Backend logs idle detection event
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.1.2: Stuck Warning (30 minutes)
- [ ] **Test:** Leave session idle for 30+ minutes
- [ ] **Expected:** Session status changes to 'stuck', warning sent
- [ ] **Verify:** Attention badge appears on session tab
- [ ] **Verify:** User can acknowledge or dismiss warning
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.1.3: Waiting for Input Detection
- [ ] **Test:** Session outputs question or prompt (PTY shows `?` or `[y/n]`)
- [ ] **Expected:** Session status changes to 'waiting'
- [ ] **Verify:** Status detected via PTY output heuristics
- [ ] **Verify:** Status indicator shows 'waiting' state
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.2: Session Attention Badges and Prioritization

#### Feature 4.2.1: Badge Priority Ordering
- [ ] **Test:** Create sessions with different statuses (error, stuck, waiting, active)
- [ ] **Expected:** Badge priority: error > stuck > waiting > active
- [ ] **Verify:** Error badge shows highest priority (red, most prominent)
- [ ] **Verify:** Badges visually distinct for each status
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.2.2: Badge Tooltips
- [ ] **Test:** Hover over attention badge
- [ ] **Expected:** Tooltip appears with detailed status message
- [ ] **Verify:** Tooltip text is actionable and clear
- [ ] **Verify:** Tooltip includes timestamp or duration (e.g., "Idle for 5 minutes")
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.3: Browser Notifications When Claude Asks Questions

#### Feature 4.3.1: Background Session Notification
- [ ] **Test:** Background session asks question (session not in focus)
- [ ] **Expected:** Browser notification sent (permission granted)
- [ ] **Verify:** Notification appears with session name and summary
- [ ] **Verify:** Notification click focuses the session
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.3.2: Active Session No Notification
- [ ] **Test:** Active session (in focus) asks question
- [ ] **Expected:** NO browser notification (already visible)
- [ ] **Verify:** No duplicate notification
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.3.3: Permission Prompt
- [ ] **Test:** First-time notification (permission not yet granted)
- [ ] **Expected:** Browser permission prompt appears
- [ ] **Verify:** User can grant or deny permission
- [ ] **Verify:** Preference persisted for future sessions
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.4: Toast Notifications for User Feedback

#### Feature 4.4.1: Success Toast
- [ ] **Test:** Successful operation (e.g., session created, session resumed)
- [ ] **Expected:** Green success toast, 4s auto-dismiss
- [ ] **Verify:** Toast appears in top-right corner
- [ ] **Verify:** Toast message is clear and concise
- [ ] **Verify:** Auto-dismiss after 4s
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.4.2: Error Toast
- [ ] **Test:** Error operation (e.g., invalid session name, git error)
- [ ] **Expected:** Red error toast, 8s auto-dismiss
- [ ] **Verify:** Error message follows pattern: "What" + "Why" + "How to fix"
- [ ] **Verify:** Auto-dismiss after 8s
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.4.3: Warning Toast
- [ ] **Test:** Warning scenario (e.g., high memory at 87%)
- [ ] **Expected:** Yellow warning toast, 6s auto-dismiss
- [ ] **Verify:** Warning message actionable
- [ ] **Verify:** Auto-dismiss after 6s
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.4.4: Toast Stacking
- [ ] **Test:** Trigger multiple toasts rapidly (3+ toasts)
- [ ] **Expected:** Toasts stack vertically, max 3 visible
- [ ] **Verify:** Oldest toasts dismissed first
- [ ] **Verify:** No overlap or visual collision
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.4.5: Duplicate Prevention
- [ ] **Test:** Trigger same toast multiple times within 1s
- [ ] **Expected:** Only one toast appears (duplicates suppressed)
- [ ] **Verify:** Duplicate detection works correctly
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.5: Enhanced Error Messages and Logging

#### Feature 4.5.1: User-Friendly Error Messages
- [ ] **Test:** Trigger validation error (invalid session name)
- [ ] **Expected:** Error message follows pattern: "What happened" + "Why" + "How to fix"
- [ ] **Example:** "Session name 'my session' is invalid. Session names cannot contain spaces. Use dashes or underscores instead."
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.5.2: Git Error Messages
- [ ] **Test:** Trigger git error (branch already exists)
- [ ] **Expected:** Error includes suggestion (e.g., "Branch 'feature-x' already exists. Use a different name or delete the existing branch.")
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.5.3: Backend Structured Logging
- [ ] **Test:** Trigger error, check backend logs: `docker logs claude-container --tail 50`
- [ ] **Expected:** Logs include session context, structured JSON format
- [ ] **Verify:** Log includes: timestamp, level, message, sessionId, sessionName
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.6: WebSocket Backpressure Handling

#### Feature 4.6.1: High-Volume Output
- [ ] **Test:** Terminal outputs large volume of data (e.g., `npm test` with verbose logs, `cat large.json`)
- [ ] **Expected:** No data loss, no browser crash, acceptable latency
- [ ] **Verify:** All terminal output appears in UI
- [ ] **Verify:** Terminal remains responsive (scrolling, typing)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.6.2: Backpressure Logging
- [ ] **Test:** High-volume output scenario (from 4.6.1)
- [ ] **Expected:** Backend logs backpressure warnings if `ws.bufferedAmount` exceeds threshold
- [ ] **Verify:** Check logs for backpressure messages (if triggered)
- [ ] **Result:** [ ] PASS / [ ] FAIL / [ ] N/A (not triggered)
- [ ] **Notes:** [Observations]

### Story 4.7: Graceful Container Shutdown and Cleanup

#### Feature 4.7.1: Graceful Shutdown (Covered in Day 4 Scenario 4)
- [ ] **Test:** `docker stop claude-container`
- [ ] **Expected:** Shutdown completes in <10s
- [ ] **Verify:** Session state saved to `.claude-container-sessions.json`
- [ ] **Verify:** PTY processes terminated cleanly
- [ ] **Verify:** No error logs on shutdown
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.7.2: Session Persistence
- [ ] **Test:** After shutdown, restart container: `docker start claude-container`
- [ ] **Expected:** Sessions restored to 'stopped' status
- [ ] **Verify:** Session list shows all previous sessions
- [ ] **Verify:** Can resume sessions individually (manual resume per Epic 2)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.8: Resource Monitoring and Limits

#### Feature 4.8.1: Memory Warning (87% threshold)
- [ ] **Test:** Create 3-4 sessions with memory-intensive tasks
- [ ] **Expected:** Warning toast at 87% memory usage (7GB out of 8GB)
- [ ] **Verify:** Warning message actionable (e.g., "High memory usage. Consider closing idle sessions.")
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.8.2: Memory Critical (93% threshold)
- [ ] **Test:** Push memory to 93%+ (7.5GB+)
- [ ] **Expected:** New session creation blocked
- [ ] **Verify:** Error message explains memory limit reached
- [ ] **Verify:** Existing sessions remain functional
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.8.3: Zombie Process Cleanup
- [ ] **Test:** Kill PTY process: `docker exec claude-container pkill -9 -f pty`
- [ ] **Expected:** Zombie process cleaned up within 60s
- [ ] **Verify:** Check process list after 60s: `docker exec claude-container ps aux`
- [ ] **Verify:** No zombie (`<defunct>`) processes remain
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.9: Keyboard Shortcuts and Accessibility Enhancements

#### Feature 4.9.1: Session Switching (Cmd+1-4)
- [ ] **Test:** Press Cmd+1, Cmd+2, Cmd+3, Cmd+4 (macOS) or Ctrl+1-4 (Windows/Linux)
- [ ] **Expected:** Switches to corresponding session
- [ ] **Verify:** Works from any focused element
- [ ] **Verify:** Visual feedback on switch
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.9.2: New Session (Cmd+N)
- [ ] **Test:** Press Cmd+N (or Ctrl+N)
- [ ] **Expected:** Opens new session modal
- [ ] **Verify:** Modal focuses first input field
- [ ] **Verify:** Can navigate modal with Tab key
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.9.3: Toggle Focus (Cmd+T, Cmd+A, Cmd+W)
- [ ] **Test:** Cmd+T (terminal), Cmd+A (artifact viewer), Cmd+W (workflow sidebar)
- [ ] **Expected:** Toggles visibility/focus of respective panel
- [ ] **Verify:** State persists across session switches
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.9.4: Close Modal (ESC)
- [ ] **Test:** Open modal, press ESC
- [ ] **Expected:** Modal closes, focus returns to previous element
- [ ] **Verify:** Works for all modals (create session, confirmation dialogs)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.9.5: Focus Rings (Accessibility)
- [ ] **Test:** Tab through UI elements
- [ ] **Expected:** All interactive elements show visible focus ring (2px #88C0D0 per Oceanic Calm theme)
- [ ] **Verify:** Focus order is logical (top to bottom, left to right)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.9.6: Screen Reader Announcements
- [ ] **Test:** Enable screen reader (VoiceOver on macOS, NVDA on Windows)
- [ ] **Expected:** Status changes announced via ARIA live regions
- [ ] **Verify:** Session creation announced
- [ ] **Verify:** Toast notifications announced
- [ ] **Verify:** All UI elements labeled (buttons, inputs, tabs)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

#### Feature 4.9.7: Reduced Motion Support
- [ ] **Test:** Enable reduced motion (macOS: System Settings > Accessibility > Display > Reduce motion)
- [ ] **Expected:** Animations disabled or simplified
- [ ] **Verify:** Toasts appear without slide-in animation
- [ ] **Verify:** Tab switches without transition effects
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Observations]

### Story 4.10: Performance Optimization and Profiling

(Validated through Performance Metrics Tracking section above)

- [ ] All performance targets met (NFR-PERF 1-4)
- [ ] `/api/metrics` endpoint functional
- [ ] Performance monitoring tools integrated

### Story 4.11: Comprehensive Testing Suite

#### Feature 4.11.1: Backend Tests
- [ ] **Test:** Run backend tests: `cd backend && npm test`
- [ ] **Expected:** All tests pass, coverage 70%+
- [ ] **Verify:** Check coverage report
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Coverage %, any failures]

#### Feature 4.11.2: Frontend Tests
- [ ] **Test:** Run frontend tests: `cd frontend && npm test`
- [ ] **Expected:** All tests pass, coverage 50%+
- [ ] **Verify:** Check coverage report
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Coverage %, any failures]

### Story 4.12: Documentation and README

#### Feature 4.12.1: Quick Start Guide
- [ ] **Test:** Follow README Quick Start instructions from scratch
- [ ] **Expected:** Can set up and run container successfully
- [ ] **Verify:** No missing steps or unclear instructions
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Documentation gaps found]

#### Feature 4.12.2: Troubleshooting Guide
- [ ] **Test:** Use docs/troubleshooting.md to solve an issue
- [ ] **Expected:** Issue covered, solution works
- [ ] **Verify:** All common issues documented
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Missing issues]

#### Feature 4.12.3: API Documentation
- [ ] **Test:** Use docs/api.md and docs/websocket-protocol.md
- [ ] **Expected:** API docs accurate, examples work
- [ ] **Verify:** Epic 4 message types documented (session.status, session.warning, etc.)
- [ ] **Result:** [ ] PASS / [ ] FAIL
- [ ] **Notes:** [Inaccuracies found]

---

## Multi-Project Validation Summary

### Project 1: [Project Name]
**Tech Stack:** [Languages, frameworks, build tools]
**Days Used:** [List days]
**Sessions Created:** [Count]
**Workflows Tested:**
- [ ] Session creation with git worktree
- [ ] Build/test/run commands
- [ ] File tree navigation
- [ ] Document viewing
- [ ] Workflow status tracking (if BMAD)
- [ ] Session switching

**Performance:** [Baseline or comparison to other projects]
**Issues Encountered:** [List issue IDs or "None"]
**Overall Assessment:** [Success/Partial/Issues]

### Project 2: [Project Name]
**Tech Stack:** [Different from Project 1]
**Days Used:** [List days]
**Sessions Created:** [Count]
**Workflows Tested:**
- [ ] Session creation
- [ ] Build/test/run (different tech stack)
- [ ] File tree navigation (different structure)
- [ ] Document viewing
- [ ] Session switching

**Performance:** [Comparison to Project 1]
**Issues Encountered:** [List issue IDs or "None"]
**Overall Assessment:** [Success/Partial/Issues]

### Project 3: [Project Name]
**Tech Stack:** [Different from Projects 1 & 2]
**Days Used:** [List days]
**Sessions Created:** [Count]
**Workflows Tested:**
- [ ] Session creation
- [ ] Build/test/run (different workflow)
- [ ] File tree navigation
- [ ] Document viewing
- [ ] Diff view (document changes)
- [ ] Non-BMAD project (if applicable)

**Performance:** [Comparison to Projects 1 & 2]
**Issues Encountered:** [List issue IDs or "None"]
**Overall Assessment:** [Success/Partial/Issues]

### Multi-Project Conclusion
**Total Projects:** ___  (target: 3+)
**Tech Stack Diversity:** [ ] PASS (3+ different stacks) / [ ] FAIL
**Cross-Project Consistency:** [ ] PASS (performance consistent) / [ ] FAIL
**Overall Multi-Project Validation:** [ ] PASS / [ ] FAIL

---

## Usability Validation

### Developer Experience Assessment

Rate each aspect on a scale of 1-5 (1 = Poor, 5 = Excellent):

| Aspect | Rating | Notes |
|--------|--------|-------|
| Session creation flow | ___/5 | [Observations] |
| Session switching (tabs, keyboard) | ___/5 | [Observations] |
| Terminal responsiveness | ___/5 | [Observations] |
| File tree navigation | ___/5 | [Observations] |
| Workflow status visibility | ___/5 | [Observations] |
| Error messages clarity | ___/5 | [Observations] |
| Notification usefulness | ___/5 | [Observations] |
| Keyboard shortcuts discoverability | ___/5 | [Observations] |
| Overall UI intuitiveness | ___/5 | [Observations] |
| Developer productivity impact | ___/5 | [Enhanced/Neutral/Hindered] |

**Average Usability Score:** ___/5
**Target:** 4+/5
**Result:** [ ] PASS / [ ] FAIL

### Usability Issues Identified

List any UX friction points, confusing workflows, or improvement opportunities:

1. [Issue or opportunity]
2. [Issue or opportunity]
3. [Issue or opportunity]

### Usability Recommendations

Prioritized list of UX improvements for future epics:

1. [High priority improvement]
2. [Medium priority improvement]
3. [Low priority improvement]

---

## Documentation Validation

### Documentation Coverage Checklist

| Document | Exists | Accurate | Complete | Pass/Fail | Gaps Identified |
|----------|--------|----------|----------|-----------|-----------------|
| README.md (Quick Start) | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/troubleshooting.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/api.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/websocket-protocol.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/architecture.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/testing.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/performance-testing.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| docs/accessibility-testing-checklist.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |
| CONTRIBUTING.md | [ ] | [ ] | [ ] | [ ] | [List gaps] |

**Overall Documentation:** [ ] PASS (all complete and accurate) / [ ] FAIL

### Documentation Recommendations

List any documentation updates needed based on validation findings:

1. [Documentation update or addition]
2. [Documentation update or addition]
3. [Documentation update or addition]

---

## Production Readiness Assessment

### Epic 4 Objectives Validation

From tech spec: "Session status tracking works, attention badges prioritize correctly, browser notifications alert for background sessions, toast notifications provide feedback, error messages are user-friendly, WebSocket backpressure handled, graceful shutdown preserves state, resource monitoring prevents exhaustion, keyboard shortcuts improve efficiency, accessibility features work."

| Objective | Validated | Pass/Fail | Notes |
|-----------|-----------|-----------|-------|
| Session status tracking (idle, stuck, waiting) | [ ] | [ ] | [Details] |
| Attention badges prioritize correctly | [ ] | [ ] | [Details] |
| Browser notifications for background sessions | [ ] | [ ] | [Details] |
| Toast notifications provide feedback | [ ] | [ ] | [Details] |
| Error messages user-friendly | [ ] | [ ] | [Details] |
| WebSocket backpressure handled | [ ] | [ ] | [Details] |
| Graceful shutdown preserves state | [ ] | [ ] | [Details] |
| Resource monitoring prevents exhaustion | [ ] | [ ] | [Details] |
| Keyboard shortcuts improve efficiency | [ ] | [ ] | [Details] |
| Accessibility features work (WCAG AA) | [ ] | [ ] | [Details] |

**All Epic 4 Objectives Met:** [ ] YES / [ ] NO

### Final Production Readiness Checklist

- [ ] **Uptime:** 99%+ uptime achieved (NFR-REL-1)
- [ ] **Performance:** All 4 performance targets met (NFR-PERF 1-4)
- [ ] **Features:** All 10 Epic 4 features validated and working
- [ ] **Critical Issues:** Zero unresolved critical issues
- [ ] **Major Issues:** All major issues fixed or deferred with justification
- [ ] **Multi-Project:** 3+ projects tested with diverse tech stacks
- [ ] **Stress Test:** 4 concurrent sessions validated
- [ ] **Failure Recovery:** All failure scenarios pass
- [ ] **Usability:** Average score 4+/5, no major UX blockers
- [ ] **Documentation:** All docs exist, accurate, and complete
- [ ] **Test Coverage:** Backend 70%+, frontend 50%+ (from Story 4.11)
- [ ] **Accessibility:** WCAG AA compliance validated

**Total Checklist Items Passed:** ___/12
**Production Readiness Threshold:** 11/12 (92%+)

### Final Recommendation

Based on the validation results above:

**Production Readiness:** [ ] READY / [ ] NOT READY / [ ] READY WITH CAVEATS

**Caveats (if applicable):**
- [Known limitation or minor issue that doesn't block production]
- [Deferred improvement for future epic]

**Critical Blockers (if NOT READY):**
- [Critical issue preventing production use]
- [Unmet NFR requirement]

---

## Recommendations for Future Work

### Backlog Items from Validation

List issues deferred to backlog during validation:

1. **[Issue ID]** - [Brief description] - Severity: [Major/Minor/Cosmetic]
2. **[Issue ID]** - [Brief description] - Severity: [Major/Minor/Cosmetic]
3. **[Issue ID]** - [Brief description] - Severity: [Major/Minor/Cosmetic]

### Epic 5 Considerations

Based on validation experience, recommend focus areas for Epic 5:

1. [Feature or improvement area]
2. [Feature or improvement area]
3. [Feature or improvement area]

### Monitoring and Observability

Recommend production monitoring additions based on validation learnings:

1. [Metric or alert to add]
2. [Metric or alert to add]
3. [Metric or alert to add]

---

## Appendix: Validation Methodology

### Validation Principles

1. **Real-world usage:** Use Claude Container for actual development work, not synthetic testing
2. **Document everything:** Log issues, performance, usability observations immediately
3. **Fix critical issues:** Don't complete validation with unresolved crashes or data loss
4. **Defer wisely:** Not everything needs fixing in Epic 4; triage to backlog appropriately
5. **Be thorough:** Test all Epic 4 features systematically
6. **Be honest:** If targets not met, document why and what needs improvement

### Performance Measurement Techniques

**Terminal Latency:**
- Backend: `performance.now()` from PTY output received → WebSocket sent
- Frontend: `performance.now()` from WebSocket message received → DOM rendered
- Total latency = backend + network + frontend

**Tab Switch Time:**
- Chrome DevTools Performance tab
- Record interaction: click session tab → UI updates
- Measure: event handler → requestAnimationFrame → paint

**Session Creation Time:**
- Measure from "Create Session" button click to first terminal prompt visible
- Use `performance.now()` in browser console

**Memory Usage:**
- `docker stats claude-container` (sample every 30-60 minutes)
- Note: RSS (Resident Set Size) is actual memory used

### Issue Reproduction Guidelines

When documenting issues in tracker:

1. **Describe the issue:** What happened? One sentence.
2. **Reproduction steps:** Numbered list, start from known state
3. **Expected behavior:** What should happen?
4. **Actual behavior:** What actually happened?
5. **Environment:** Browser, OS, container version
6. **Frequency:** Always, sometimes (X%), once
7. **Workaround:** If found, how to avoid issue

**Example:**
```
ID: V4-042
Severity: Major
Description: Session tab doesn't update status when session goes idle
Steps to Reproduce:
  1. Create new session named "test-session"
  2. Leave session idle for 6 minutes (no terminal activity)
  3. Observe session tab in session list
Expected: Tab shows "idle" status indicator
Actual: Tab remains showing "active" status
Environment: Chrome 131, macOS 15, container v0.4.0
Frequency: Always (tested 3 times)
Workaround: Refresh browser page, status updates correctly
Status: Fixed (backend idle timer not emitting WebSocket event)
```

---

## Validation Completion Criteria

This validation is COMPLETE when:

1. [ ] **7 consecutive days of daily usage logged** (Daily Activity Log filled)
2. [ ] **All critical issues resolved** (no Critical issues with Status=Open in tracker)
3. [ ] **All performance targets validated** (NFR-PERF 1-4 results recorded)
4. [ ] **All Epic 4 features tested** (Feature Checklist completed)
5. [ ] **Multi-project validation complete** (3+ projects documented)
6. [ ] **4 concurrent sessions stress test complete** (Day 2 metrics logged)
7. [ ] **Failure scenarios tested** (Day 4 recovery validation complete)
8. [ ] **Documentation validated** (Documentation Coverage Checklist complete)
9. [ ] **Production readiness assessed** (Final checklist 11/12+ passed)
10. [ ] **Recommendations documented** (Future work and backlog items listed)

**When all 10 criteria are met, fill the Executive Summary and publish final validation outcome.**

---

**End of Validation Framework**

This framework will guide the 1-week validation process. Update this document throughout the validation period, then create a final summary report for stakeholders.
