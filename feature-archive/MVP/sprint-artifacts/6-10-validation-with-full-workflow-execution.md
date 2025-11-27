# Story 6.10: Validation with Full Workflow Execution

Status: drafted

## Story

As a developer,
I want to validate the Sprint Tracker works end-to-end with real BMAD workflows,
So that I can confidently use it for daily development.

## Background

Epic 6 has introduced a comprehensive interactive workflow tracker that replaces the static swim lane diagram. Stories 6.1-6.9 have implemented sprint status parsing, artifact derivation, the Sprint Tracker UI, artifact display, action buttons, collapsible phases, epic navigation, default view toggling, and workflow continuation buttons.

This final validation story ensures all components work together seamlessly in real-world usage. The validation focuses on executing the complete workflow cycle through the Sprint Tracker UI: generating story context, starting development, reviewing code, and completing stories - all via one-click action buttons. Additionally, it validates epic transitions, real-time status updates, and artifact viewing during active workflows.

This is an integration validation story that exercises all Epic 6 acceptance criteria (AC6.1-AC6.52) in a cohesive end-to-end test scenario.

## Acceptance Criteria

```gherkin
AC6.49: Full workflow cycle validated
  GIVEN the Sprint Tracker is fully implemented (Stories 6.1-6.9)
  WHEN I click [▶ Context] on a "drafted" story
  THEN the terminal receives the story-context command
  AND Claude begins executing the workflow
  AND as the story progresses (status changes in sprint-status.yaml)
  AND the Sprint Tracker updates in real-time
  AND when the story moves to "ready-for-dev"
  AND I click [▶ Start] button appears
  AND the dev-story command executes
  AND when the story moves to "review"
  AND I click [▶ Review] button
  AND the code-review workflow executes
  AND when the story is complete, status shows "done"
  THEN the full Context → Start → Review → Done cycle is validated

AC6.50: Real-time status updates during workflow
  GIVEN a workflow is actively running (e.g., dev-story)
  WHEN sprint-status.yaml is updated by the BMAD workflow
  THEN the file watcher detects the change within 1 second
  AND a sprint.updated WebSocket message is broadcast
  AND the Sprint Tracker UI re-renders with new status
  AND status icons update (○ → → → ◉ → ✓)
  AND progress bar animates to new completion ratio
  AND action buttons update to reflect new status

AC6.51: Artifact view works during workflow
  GIVEN a story has generated artifacts (story file, context file)
  WHEN I click [View] on an artifact while workflow is running
  THEN the artifact opens in ArtifactViewer
  AND the content displays correctly (markdown rendering)
  AND I can read the artifact while workflow continues
  AND clicking [View] on multiple artifacts switches between them
  AND missing artifacts show "(missing)" label without crashing

AC6.52: Epic transition validated
  GIVEN all stories in current epic are "done"
  AND the epic retrospective status is "completed" or "optional"
  AND a next epic exists in sprint-status.yaml
  WHEN the Sprint Tracker is displayed
  THEN the [+ Start Epic N+1] button appears
  AND clicking the button sends epic-tech-context command
  AND the next epic tech spec generation begins
  AND sprint-status.yaml updates: epic status → "contexted"
  AND the Sprint Tracker updates to show next epic context
  AND epic selector dropdown reflects new epic status
```

## Tasks / Subtasks

- [ ] **Task 1: Create validation test plan document** (AC6.49-AC6.52)
  - [ ] 1.1: Create validation checklist template:
    ```markdown
    # Epic 6 Sprint Tracker Validation Checklist

    ## Test Environment
    - Docker container running: [ ]
    - Frontend accessible at localhost:3000: [ ]
    - Active Claude session available: [ ]
    - sprint-status.yaml exists with Epic 6 stories: [ ]

    ## Full Workflow Cycle Test (AC6.49)
    - [ ] Navigate to Sprint Tracker view (default view)
    - [ ] Locate a drafted story (e.g., 6-1 or test story)
    - [ ] Click [▶ Context] button on drafted story
    - [ ] Verify terminal receives story-context command
    - [ ] Observe Claude executing workflow
    - [ ] Wait for status update to "ready-for-dev"
    - [ ] Verify [▶ Start] button appears
    - [ ] Click [▶ Start] button
    - [ ] Verify dev-story command executes
    - [ ] Wait for status update to "review"
    - [ ] Verify [▶ Review] button appears
    - [ ] Click [▶ Review] button
    - [ ] Verify code-review command executes
    - [ ] Wait for status update to "done"
    - [ ] Verify ✓ Done indicator appears
    - [ ] Verify no action button shown for done story

    ## Real-Time Updates Test (AC6.50)
    - [ ] Start a workflow that updates sprint-status.yaml
    - [ ] Watch Sprint Tracker while workflow runs
    - [ ] Verify status icon changes: ○ → → → ◉ → ✓
    - [ ] Verify progress bar updates automatically
    - [ ] Verify action buttons change per status
    - [ ] Verify updates happen within 2 seconds of file change
    - [ ] Check browser console for sprint.updated messages
    - [ ] Verify no UI flicker or layout shift during update

    ## Artifact Viewing Test (AC6.51)
    - [ ] Expand a story with artifacts
    - [ ] Click [View] on story markdown file
    - [ ] Verify ArtifactViewer opens with rendered content
    - [ ] Verify markdown formatting displays correctly
    - [ ] Click [View] on context XML file
    - [ ] Verify XML content displays
    - [ ] Click back to story file
    - [ ] Verify view switches correctly
    - [ ] Test with non-existent artifact
    - [ ] Verify "(missing)" label shows without crash
    - [ ] View artifacts while workflow is running
    - [ ] Verify no blocking or performance issues

    ## Epic Transition Test (AC6.52)
    - [ ] Complete all stories in an epic (or use test epic)
    - [ ] Set retrospective to "completed" or "optional"
    - [ ] Verify [+ Start Epic N+1] button appears
    - [ ] Note next epic number displayed
    - [ ] Click [+ Start Epic N+1] button
    - [ ] Verify epic-tech-context command with correct epic number
    - [ ] Wait for tech spec generation
    - [ ] Verify sprint-status.yaml: epic status → contexted
    - [ ] Verify Sprint Tracker shows new epic
    - [ ] Verify epic selector dropdown updates
    - [ ] Check epic artifacts (tech spec) appear

    ## Cross-Component Integration
    - [ ] Test epic selector: switch between epics
    - [ ] Verify story list updates per selected epic
    - [ ] Test [Phases] / [Sprint] view toggle
    - [ ] Verify view preference persists
    - [ ] Test collapsible phase sections
    - [ ] Verify collapse state persists
    - [ ] Test sidebar compact view shows current story
    - [ ] Test keyboard shortcuts (if implemented)

    ## Edge Cases and Error Handling
    - [ ] Test with no active session (expect error toast)
    - [ ] Test with malformed sprint-status.yaml
    - [ ] Test with missing epic files
    - [ ] Test with >50 stories (performance check)
    - [ ] Test rapid button clicks (debounce check)
    - [ ] Test WebSocket disconnection during workflow
    - [ ] Test container restart during workflow

    ## Results Summary
    - Total tests: __
    - Passed: __
    - Failed: __
    - Blocked: __
    - Notes: _______________
    ```
  - [ ] 1.2: Save checklist to `/docs/sprint-artifacts/epic-6-validation-checklist.md`
  - [ ] 1.3: Add timestamp and tester name fields to template
  - [ ] 1.4: Include "Pass/Fail/Blocked" checkbox options for each item

- [ ] **Task 2: Execute full workflow cycle validation** (AC6.49)
  - [ ] 2.1: Prepare test environment:
    - Ensure Sprint Tracker is accessible (default view)
    - Verify sprint-status.yaml has a drafted test story
    - Start active Claude session
  - [ ] 2.2: Execute Context workflow:
    - Click [▶ Context] on drafted story
    - Verify command sent to terminal: `/bmad:bmm:workflows:story-context {storyId}`
    - Observe Claude executing context generation
    - Verify terminal output shows workflow progress
  - [ ] 2.3: Wait for status update to "ready-for-dev":
    - Monitor sprint-status.yaml for update
    - Verify Sprint Tracker status icon changes: ○ → ○ (ready-for-dev)
    - Verify [▶ Start] button appears
  - [ ] 2.4: Execute Start workflow:
    - Click [▶ Start] button
    - Verify command: `/bmad:bmm:workflows:dev-story {storyId}`
    - Observe story development workflow
  - [ ] 2.5: Wait for status update to "in-progress":
    - Verify status icon: ○ → → (in-progress, cyan)
    - Verify [▶ Continue] button or terminal focus hint
  - [ ] 2.6: Wait for status update to "review":
    - Monitor for workflow completion
    - Verify status icon: → → ◉ (review, yellow)
    - Verify [▶ Review] button appears
  - [ ] 2.7: Execute Review workflow:
    - Click [▶ Review] button
    - Verify command: `/bmad:bmm:workflows:code-review {storyId}`
    - Observe code review workflow
  - [ ] 2.8: Wait for status update to "done":
    - Verify status icon: ◉ → ✓ (done, green)
    - Verify no action button (or disabled "Done" state)
    - Verify progress bar increments
  - [ ] 2.9: Document results:
    - Capture screenshots at each stage
    - Note timing for each workflow step
    - Record any errors or unexpected behavior

- [ ] **Task 3: Validate real-time status updates** (AC6.50)
  - [ ] 3.1: Monitor WebSocket messages during workflow:
    - Open browser DevTools → Network → WS
    - Filter for `sprint.updated` messages
    - Verify messages broadcast on sprint-status.yaml changes
  - [ ] 3.2: Verify UI responsiveness:
    - Start a workflow (any story)
    - Watch Sprint Tracker UI without refreshing page
    - Verify status icons update automatically
    - Measure update latency (file change → UI update)
    - Target: <2 seconds from file save to UI render
  - [ ] 3.3: Test progress bar animation:
    - Note initial progress ratio (e.g., 15/19)
    - Complete a story (draft → done)
    - Verify progress bar animates to new ratio (16/19)
    - Verify smooth CSS transition (no jump)
  - [ ] 3.4: Verify action button updates:
    - Track button label changes per status
    - drafted → [▶ Context]
    - ready-for-dev → [▶ Start]
    - in-progress → [▶ Continue] or focus hint
    - review → [▶ Review]
    - done → no button (✓ Done)
  - [ ] 3.5: Test multiple rapid status changes:
    - Edit sprint-status.yaml manually with multiple changes
    - Save file
    - Verify Sprint Tracker processes all updates
    - Verify no race conditions or stale data

- [ ] **Task 4: Validate artifact viewing during workflows** (AC6.51)
  - [ ] 4.1: Test artifact list display:
    - Expand story row (drafted+ status)
    - Verify story file shows: `📄 {storyKey}.md [View]`
    - For ready-for-dev+: verify context file: `📋 {storyKey}.context.xml [View]`
    - Verify artifact existence indicators accurate
  - [ ] 4.2: Test [View] button functionality:
    - Click [View] on story markdown file
    - Verify LayoutContext.setSelectedFile() called
    - Verify ArtifactViewer opens with file content
    - Verify markdown rendering: headings, lists, code blocks
  - [ ] 4.3: Test artifact switching:
    - While viewing story file, click [View] on context XML
    - Verify view switches to XML file
    - Verify syntax highlighting for XML
    - Switch back to story file
    - Verify no data loss or UI glitches
  - [ ] 4.4: Test missing artifact handling:
    - Create test story entry with artifacts marked exists: false
    - Verify artifact shows grayed text: `📄 file.md (missing)`
    - Click [View] on missing artifact
    - Verify graceful error (toast or inline message)
    - Verify no application crash
  - [ ] 4.5: Test viewing during active workflow:
    - Start dev-story workflow
    - While Claude is working, expand story
    - Click [View] on story file
    - Verify artifact loads without blocking workflow
    - Click [View] on context file
    - Verify workflow continues in parallel
    - Verify no WebSocket disconnection or slowdown

- [ ] **Task 5: Validate epic transition workflow** (AC6.52)
  - [ ] 5.1: Prepare epic completion state:
    - Either complete all stories in a test epic
    - Or manually edit sprint-status.yaml to simulate completion:
      - Set all epic stories to "done"
      - Set retrospective: "completed" or "optional"
      - Ensure next epic exists (e.g., epic-7: backlog)
  - [ ] 5.2: Verify [+ Start Epic N+1] button logic:
    - Open Sprint Tracker
    - Scroll to bottom of story list
    - Verify [+ Start Epic N+1] button appears
    - Verify button shows correct next epic number
    - Verify button style (blue, prominent)
  - [ ] 5.3: Test epic context generation:
    - Click [+ Start Epic 7] button (or next epic number)
    - Verify command sent: `/bmad:bmm:workflows:epic-tech-context 7`
    - Verify terminal shows workflow execution
    - Verify toast notification: "Starting Epic 7 context generation..."
    - Verify terminal panel focused
  - [ ] 5.4: Monitor epic status update:
    - Wait for epic-tech-context workflow to complete
    - Verify sprint-status.yaml updates: `epic-7: contexted`
    - Verify tech spec file created: `docs/sprint-artifacts/tech-spec-epic-7.md`
  - [ ] 5.5: Verify UI updates for new epic:
    - Verify Sprint Tracker reflects epic-7: contexted
    - Verify epic selector dropdown shows Epic 7 with ◉ indicator
    - Verify story list now shows Epic 7 stories (if switch epic)
    - Verify epic artifacts (tech spec) appear under epic header
  - [ ] 5.6: Test edge case - no next epic:
    - Simulate last epic completion (no epic-N+1 entry)
    - Verify [+ Start Epic N+1] button does NOT appear
    - Verify Sprint Tracker shows epic complete state
    - Verify no crash or error

- [ ] **Task 6: Cross-component integration validation** (All ACs)
  - [ ] 6.1: Test epic selector integration (Story 6.7):
    - Click epic selector dropdown in Sprint Tracker header
    - Verify all epics listed: Epic 1-N
    - Verify status indicators: ✓ (done), ◉ (current), · (backlog)
    - Select different epic (e.g., Epic 4)
    - Verify story list updates to show Epic 4 stories
    - Verify progress bar updates: "15/19 stories"
    - Verify current story highlight shifts to Epic 4 current
  - [ ] 6.2: Test view mode toggle (Story 6.8):
    - Verify Sprint Tracker is default view on load
    - Click [Phases] button in header/toolbar
    - Verify WorkflowDiagram (swim lane) displays
    - Verify phase sections visible (Discovery, Planning, etc.)
    - Click [Sprint] button
    - Verify Sprint Tracker returns
    - Reload page → verify view preference persists via localStorage
  - [ ] 6.3: Test collapsible phase sections (Story 6.6):
    - Expand Sprint Tracker to show phase sections above epic
    - Click Discovery section header
    - Verify section expands to show steps and artifacts
    - Click header again → verify collapse
    - Reload page → verify collapse state persists
    - Test all phases: Discovery, Planning, Solutioning
  - [ ] 6.4: Test sidebar compact view (Story 6.8):
    - Check WorkflowProgress sidebar panel
    - Verify current story summary: "Epic 6 · Story 6-10 · drafted"
    - Verify action button appears in sidebar
    - Click sidebar action button (e.g., [▶ Context])
    - Verify same behavior as Sprint Tracker button
    - Verify terminal receives command
  - [ ] 6.5: Test workflow continuation button (Story 6.9):
    - Complete all stories except one in an epic
    - Verify no continuation button yet
    - Complete last story → all done/review
    - Verify [+ Create Next Story] button appears
    - Click button
    - Verify command: `/bmad:bmm:workflows:create-story`
    - Verify next backlog story gets drafted

- [ ] **Task 7: Edge case and error handling validation** (Reliability)
  - [ ] 7.1: Test no active session error:
    - Destroy all Claude sessions
    - Click any action button ([▶ Start], etc.)
    - Verify toast error: "No active session - create one first"
    - Verify no command sent to terminal (no crash)
    - Create new session → verify buttons work again
  - [ ] 7.2: Test malformed sprint-status.yaml:
    - Backup sprint-status.yaml
    - Introduce YAML syntax error (broken indentation)
    - Save file → trigger file watcher
    - Verify backend logs warning
    - Verify Sprint Tracker shows error banner or empty state
    - Verify no application crash
    - Restore valid YAML → verify recovery
  - [ ] 7.3: Test missing epic files:
    - Remove or rename an epic markdown file (e.g., epic-6.md)
    - Open Sprint Tracker
    - Verify epic title shows as "Epic 6" (generic, no crash)
    - Verify story list still renders
    - Restore epic file → verify title updates
  - [ ] 7.4: Test performance with many stories:
    - If possible, create test epic with 50+ stories
    - Open Sprint Tracker
    - Verify initial render <500ms
    - Verify scroll performance smooth (60fps)
    - Verify no virtualization errors
    - If slow, document performance bottleneck
  - [ ] 7.5: Test rapid button clicks (debounce):
    - Click [▶ Start] button 5 times rapidly
    - Verify only one command sent
    - Verify no duplicate workflow executions
    - Verify toast doesn't spam (shows once)
  - [ ] 7.6: Test WebSocket disconnection during workflow:
    - Start a workflow
    - Manually disconnect WebSocket (DevTools → Network → close connection)
    - Verify ConnectionBanner appears
    - Wait for reconnection
    - Verify sprint-status.yaml updates still reflected
    - Verify no data corruption
  - [ ] 7.7: Test container restart during workflow:
    - Start a workflow
    - Restart Docker container: `docker restart claude-container`
    - Wait for container to come back online
    - Refresh browser page
    - Verify Sprint Tracker loads
    - Verify workflow progress preserved (if session resume works)

- [ ] **Task 8: Document validation results** (AC6.49-AC6.52)
  - [ ] 8.1: Fill out validation checklist completely:
    - Mark each test item as Pass/Fail/Blocked
    - Add notes for any failures or unexpected behavior
    - Include screenshots for key validation points
    - Record performance metrics (latency, render times)
  - [ ] 8.2: Create validation report summary:
    ```markdown
    # Epic 6 Sprint Tracker Validation Report

    **Date:** YYYY-MM-DD
    **Tester:** Kyle
    **Environment:** Docker on [macOS/Linux], Chrome/Firefox
    **Epic 6 Status:** All stories drafted (6.1-6.9)

    ## Summary

    - **Total Tests:** __ (from checklist)
    - **Passed:** __
    - **Failed:** __
    - **Blocked:** __
    - **Pass Rate:** __%

    ## Critical Path Tests (AC6.49-AC6.52)

    ### AC6.49: Full Workflow Cycle
    - **Result:** Pass/Fail
    - **Notes:** Context → Start → Review → Done cycle completed. Timing: __ minutes total.

    ### AC6.50: Real-Time Status Updates
    - **Result:** Pass/Fail
    - **Latency:** File change → UI update in __ seconds (target <2s)
    - **Notes:** WebSocket sprint.updated messages observed, UI responsive.

    ### AC6.51: Artifact Viewing
    - **Result:** Pass/Fail
    - **Notes:** Markdown rendering correct, XML display works, missing artifacts handled gracefully.

    ### AC6.52: Epic Transition
    - **Result:** Pass/Fail
    - **Notes:** [+ Start Epic N+1] button logic correct, epic-tech-context executed successfully.

    ## Edge Cases and Errors

    - No active session: Pass/Fail - Error toast displayed, no crash
    - Malformed YAML: Pass/Fail - Graceful degradation
    - WebSocket disconnect: Pass/Fail - Reconnection successful
    - Performance (50+ stories): Pass/Fail - Render time __ ms

    ## Issues Found

    1. [Issue description] - Severity: Critical/Major/Minor
    2. [Issue description] - Severity: Critical/Major/Minor

    ## Recommendations

    - [Any improvements or follow-up tasks]

    ## Conclusion

    Epic 6 Sprint Tracker is READY/NOT READY for production use.
    [Summary paragraph]
    ```
  - [ ] 8.3: Save validation report to `/docs/sprint-artifacts/epic-6-validation-report.md`
  - [ ] 8.4: Update this story's Dev Agent Record → Completion Notes:
    - Add link to validation checklist
    - Add link to validation report
    - Note any critical issues discovered
    - Confirm all ACs validated (or note exceptions)
  - [ ] 8.5: If issues found, create follow-up stories or tech debt items

- [ ] **Task 9: Update sprint-status.yaml after validation** (Story completion)
  - [ ] 9.1: Load `/docs/sprint-artifacts/sprint-status.yaml`
  - [ ] 9.2: Find story key: `6-10-validation-with-full-workflow-execution`
  - [ ] 9.3: Update status: `backlog` → `drafted` (after creating validation plan)
  - [ ] 9.4: After executing validation: update status to `in-progress`
  - [ ] 9.5: After completing validation: update status to `review`
  - [ ] 9.6: Save file, preserving all comments and structure

- [ ] **Task 10: Final checklist and acceptance review** (All ACs)
  - [ ] 10.1: Verify all AC6.49-AC6.52 tested and documented
  - [ ] 10.2: Verify validation checklist 100% complete
  - [ ] 10.3: Verify validation report written with clear Pass/Fail results
  - [ ] 10.4: Verify no critical blockers discovered (or documented if found)
  - [ ] 10.5: Verify Epic 6 is ready for retrospective (all stories validated)
  - [ ] 10.6: Recommend next action:
    - If all Pass → Run epic-6-retrospective workflow
    - If failures → Create follow-up stories to address issues
    - If blockers → Escalate to PM/architect for resolution

## Dev Notes

### Architecture Alignment

This validation story does not introduce new code but exercises all Epic 6 components in integration. Key validation focus areas:

**Backend Components (Stories 6.1-6.2):**
- `statusParser.ts`: Sprint status YAML parsing, epic/story data extraction
- `fileWatcher.ts`: Chokidar watching sprint-status.yaml for changes
- `server.ts`: GET /api/sprint/status endpoint, sprint.updated WebSocket broadcasts
- Artifact path derivation logic: story files, context files, tech specs, retrospectives

**Frontend Components (Stories 6.3-6.9):**
- `SprintTracker.tsx`: Main UI component with epic/story progress display
- `SprintContext.tsx`: Sprint state management, WebSocket message handling
- `StoryRow.tsx`: Individual story display with artifacts and action buttons
- `EpicSelector.tsx`: Epic navigation dropdown
- `PhaseOverview.tsx`: Collapsible historical phase sections
- `WorkflowProgress.tsx`: Sidebar compact view with current story summary
- `LayoutContext`: View mode toggle (sprint vs phases)

**Integration Points:**
- WebSocket protocol: sprint.updated messages triggering UI re-renders
- Action buttons: terminal.input message injection for workflow execution
- ArtifactViewer: Reuse for document display during workflows
- SessionContext: activeSessionId for command execution

**ADR Compliance:**
- **ADR-013 (WebSocket Protocol)**: Validate sprint.updated message format and timing
- **ADR-006 (YAML Parsing)**: Validate robust parsing with edge cases
- **ADR-005 (React Context)**: Validate SprintContext state management and updates

### Validation Strategy

Unlike typical stories that implement features, this story validates Epic 6 as a whole. The validation approach:

**1. Functional Validation (AC6.49, AC6.51, AC6.52):**
- Execute real BMAD workflows through Sprint Tracker UI
- Verify end-to-end flow: button click → command → workflow execution → status update → UI refresh
- Test all action buttons (Context, Start, Review) with actual Claude workflows
- Validate epic transition with tech spec generation

**2. Real-Time Update Validation (AC6.50):**
- Monitor WebSocket messages during workflow execution
- Measure latency from file change to UI update (target <2s)
- Verify no race conditions or stale data during rapid updates
- Test file watcher debounce (500ms) effectiveness

**3. Integration Validation:**
- Test cross-component interactions: epic selector + story list + action buttons
- Verify view mode toggle doesn't break state
- Validate collapsible sections + localStorage persistence
- Test sidebar compact view consistency with main view

**4. Edge Case and Error Validation:**
- No active session → error toast, no crash
- Malformed YAML → graceful degradation
- Missing artifacts → "(missing)" label, no crash
- WebSocket disconnect → reconnection, state preservation
- Performance with many stories (50+)

**5. Documentation:**
- Validation checklist: comprehensive test cases covering all ACs
- Validation report: Pass/Fail results with screenshots and metrics
- Issue tracking: any problems discovered during validation

### Testing Notes

This is a **validation story**, not a unit/integration testing story. Approach:

**Manual Validation (Primary):**
- Execute validation checklist manually using running Docker container
- Interact with real Claude workflows (not mocked)
- Observe browser DevTools for WebSocket messages, console errors
- Capture screenshots and performance metrics

**Automated Testing (Optional Enhancement):**
- If time permits, create Playwright E2E test script for critical path
- Script would automate: navigate → click button → verify command → wait for status update
- Focus on AC6.49 (full workflow cycle) automation

**Artifacts to Create:**
1. `epic-6-validation-checklist.md` - Comprehensive test checklist
2. `epic-6-validation-report.md` - Results summary with Pass/Fail
3. Screenshots folder (optional): `docs/sprint-artifacts/epic-6-validation-screenshots/`
4. Performance metrics: latency measurements, render times

**Validation Scope:**
- All AC6.1-AC6.52 from tech spec must be covered
- Focus on integration, not re-testing individual components (Stories 6.1-6.9 already tested)
- Validate user experience: does the Sprint Tracker feel responsive and reliable?

### Learnings from Previous Story

**From Story 6.9 (Create Next Story Action)**

Story 6.9 implemented workflow continuation buttons that automatically show [+ Create Next Story] or [+ Start Epic N+1] based on epic completion state. Key learnings:

- **Workflow Continuation Logic**: Story 6.9 established shouldShowCreateNextStory() and shouldShowStartNextEpic() patterns. This validation story will test these functions in real scenarios (completing all stories, retrospective states).

- **Dynamic Command Execution**: Story 6.9 was the first to use dynamic command arguments (epic number in epic-tech-context). This validation story will verify that epic transitions work correctly with proper epic number substitution.

- **Context Integration**: Story 6.9 integrated SprintContext for epic/story completion state. This validation story will stress-test the context updates during actual workflow execution (real-time updates during dev-story, code-review).

- **Action Button Reusability**: Story 6.9 reused the executeWorkflow pattern from Stories 6.5 and 6.8. This validation will confirm all action buttons (Context, Start, Review, Create Next Story, Start Epic) share the same reliable execution pattern.

- **Error Handling**: Story 6.9 implemented no-active-session error handling. This validation will test error scenarios systematically (no session, malformed data, missing files).

**Implementation Recommendations:**

1. **Start with Happy Path**: Execute AC6.49 first (full workflow cycle) to validate the core value proposition of Epic 6. If this fails, other validations are less meaningful.

2. **Monitor WebSocket Traffic**: Keep browser DevTools open during all validation to observe sprint.updated messages and verify timing (AC6.50).

3. **Use Real Workflows**: Don't mock workflows - execute actual story-context, dev-story, code-review commands. This is the only way to validate real-time updates and artifact generation.

4. **Document Everything**: Capture screenshots at each workflow stage. Record exact timing (file save timestamp → UI update timestamp). Note any unexpected behavior immediately.

5. **Test Edge Cases Last**: Save error scenarios (malformed YAML, no session, missing files) for after happy path validation. These are important but shouldn't block initial validation.

6. **Prepare Test Epic**: Consider creating a "test-epic" in sprint-status.yaml with 3-5 simple stories specifically for validation. This allows repeatable testing without polluting production epic data.

**Validation Sequencing:**

- **Phase 1 (30 min)**: Execute AC6.49 full workflow cycle on one test story
- **Phase 2 (20 min)**: Validate AC6.50 real-time updates during Phase 1
- **Phase 3 (15 min)**: Test AC6.51 artifact viewing during active workflow
- **Phase 4 (20 min)**: Execute AC6.52 epic transition (complete epic → start next)
- **Phase 5 (30 min)**: Cross-component integration (epic selector, view toggle, phases)
- **Phase 6 (30 min)**: Edge cases and error handling
- **Phase 7 (30 min)**: Document results, write validation report

Total estimated validation time: **2.5-3 hours** of manual testing.

**New Patterns to Establish:**

- **Validation Story Template**: This is the first comprehensive validation story in the project. The checklist + report pattern can be reused for future epic validations.
- **Real-Time Update Testing**: Methodology for testing WebSocket-driven UI updates with file watcher integration.
- **End-to-End Workflow Testing**: Approach for testing Claude workflow execution through UI (not just API/backend testing).

[Source: docs/sprint-artifacts/6-9-create-next-story-action.md#Learnings from Previous Story]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#AC6.49-AC6.52]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.10]
- [Story 6.9 (Create Next Story): docs/sprint-artifacts/6-9-create-next-story-action.md]
- [Story 6.8 (View Toggle): docs/sprint-artifacts/6-8-replace-swim-lane-with-sprint-tracker-as-default.md]
- [Story 6.5 (Action Buttons): docs/sprint-artifacts/6-5-action-buttons-for-workflow-execution.md]
- [Story 6.3 (Sprint Tracker): docs/sprint-artifacts/6-3-sprint-tracker-component-mvp-view.md]
- [Story 6.1 (Sprint Parser): docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md]
- [WebSocket Protocol: docs/websocket-protocol.md]

## Estimated Effort

2.5-3 hours (manual validation execution)

## Dependencies

- Stories 6.1-6.9 must be complete and integrated
- Sprint Tracker fully functional in Docker container
- Active Claude session available for workflow execution
- sprint-status.yaml with Epic 6 stories

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-26 | Claude | Initial draft |
