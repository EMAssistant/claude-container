# Story 3.12: Validation with Document Review Flow

Status: ready-for-dev

## Story

As a developer managing multiple parallel Claude sessions,
I want to validate the complete document review workflow with real BMAD artifacts,
so that I'm confident I can monitor sessions and review generated documents at a glance.

## Acceptance Criteria

1. **AC3.20 (from Tech Spec)**: 4 sessions monitored at a glance
   - Given: 2 or more sessions are active with different BMAD workflows
   - When: User switches between sessions
   - Then: Can view workflow progress, file trees, and artifacts for each session independently
   - And: PRD Sprint 3 success criteria met: "Can monitor 4 sessions at a glance and view all generated artifacts"

2. **Complete Document Review Flow**: Validate full user journey (UX Journey 4)
   - Given: Session 1 "epic-auth" running PRD creation workflow
   - When: Claude completes the PRD document
   - Then: File tree shows "prd.md" in the docs folder
   - And: Layout auto-shifts to artifact-dominant mode (70/30 split)
   - And: Artifact viewer displays rendered PRD markdown with tables and formatting
   - And: Code blocks have syntax highlighting
   - And: Terminal remains visible at 30% height for feedback

3. **Multi-Session Context Switching**: Verify session isolation
   - Given: Session 2 "epic-payments" running architecture workflow
   - When: User switches from Session 1 to Session 2
   - Then: Terminal shows Session 2's architecture workflow output
   - And: File tree updates to show Session 2's worktree files
   - And: Workflow progress shows Session 2's current step (e.g., "Architecture")
   - And: Session 1's state preserved (can switch back and see PRD still open)

4. **Workflow Progress Visibility**: Real-time BMAD step tracking
   - Given: Multiple sessions at different workflow stages
   - When: User views workflow progress in left sidebar
   - Then: Completed steps show ✓ (green #A3BE8C)
   - And: Current step shows → (blue #88C0D0) with highlighted background
   - And: Pending steps show ○ (gray #4C566A)
   - And: Workflow updates automatically when Claude advances steps

5. **Artifact Rendering Quality**: Validate markdown rendering
   - Given: Claude-generated documents (PRD, architecture, UX spec, epics, stories)
   - When: User opens any markdown file from file tree
   - Then: Document renders correctly with:
     - GitHub Flavored Markdown (tables, task lists, strikethrough)
     - Syntax-highlighted code blocks (Python, TypeScript, Bash, etc.)
     - Proper headings, lists, links, and formatting
     - Oceanic Calm code theme matching terminal

6. **Diff View Functionality**: Track document changes
   - Given: User has viewed "prd.md" artifact
   - When: Claude updates the PRD and saves changes
   - Then: Artifact viewer shows "Document updated" indicator (blue badge)
   - And: "Show Diff" button appears
   - When: User clicks "Show Diff"
   - Then: Diff view displays:
     - Added lines with green background (#A3BE8C 20% opacity)
     - Deleted lines with red background (#BF616A 20% opacity) and strikethrough
     - Unchanged lines as context
   - When: User clicks "Hide Diff"
   - Then: View returns to full rendered markdown

7. **Layout Customization**: Resizable panels persist
   - Given: User drags left sidebar resize handle to widen file tree
   - When: User refreshes the page
   - Then: Left sidebar width persists from localStorage
   - And: All panel sizes remain customized
   - When: User drags horizontal split handle between terminal and artifacts
   - Then: Split ratio adjusts smoothly (constrained to 30-70% range)
   - And: Custom ratio persists across layout mode changes

8. **File Tree Real-Time Updates**: Chokidar integration validation
   - Given: User viewing file tree in Session 1
   - When: Claude creates a new file (e.g., "architecture.md")
   - Then: File appears in tree within 1 second (500ms debounce + render)
   - When: Claude modifies an existing file
   - Then: File tree updates last modified indicator
   - When: User expands/collapses folders
   - Then: Folder state persists during session

9. **Interactive Feedback Loop**: Terminal + Artifact Viewing
   - Given: User viewing PRD in artifact viewer (70% height)
   - And: Terminal visible at bottom (30% height)
   - When: Claude asks "What do you think about this PRD structure?"
   - Then: User can see the question in terminal
   - And: User types feedback while viewing the artifact
   - When: Claude receives feedback and updates PRD
   - Then: File change triggers diff indicator
   - And: User can review changes via diff view

10. **Performance Validation**: Response times meet NFRs
    - File tree rendering: <100ms for 500 files (use virtual scrolling if needed)
    - Markdown rendering: <500ms for 100KB file
    - Layout animation: 350ms CSS transition (no jank)
    - File change notification: <200ms end-to-end (chokidar event → UI update)
    - Sidebar toggle: <50ms (per NFR-PERF-2)

11. **Stress Testing**: Large documents and file counts
    - Given: Workspace with 100+ markdown files
    - When: User browses file tree
    - Then: Scrolling is smooth (60fps), no lag
    - Given: Large markdown file (500KB PRD with many sections)
    - When: User opens in artifact viewer
    - Then: Renders within 500ms, scrolling smooth
    - Given: Rapid file changes (Claude writing multiple docs quickly)
    - When: Chokidar detects events
    - Then: Updates batched (500ms debounce), UI remains responsive

12. **End-to-End Validation Script**: Automated test for core flows
    - Create validation script in `docs/sprint-artifacts/epic-3-validation-script.md`
    - Document test scenarios for manual or automated execution
    - Include checklist of all acceptance criteria
    - Provide sample BMAD workflows to run for validation
    - Report template for validation results

## Tasks / Subtasks

- [ ] Task 1: Prepare validation environment (AC: #1-#12)
  - [ ] Ensure 2+ sessions can be created (Epic 2 functionality verified)
  - [ ] Identify or create real BMAD workflows to run (PRD, Architecture, Epic Planning)
  - [ ] Set up workspace with mix of documents (small, medium, large)
  - [ ] Prepare 100+ file scenario for stress testing
  - [ ] Document pre-validation checklist

- [ ] Task 2: Validate document review flow end-to-end (AC: #2, #9)
  - [ ] Start Session 1 with BMAD PRD creation workflow
  - [ ] Verify file tree updates when PRD created
  - [ ] Verify layout auto-shifts to artifact-dominant (70/30)
  - [ ] Verify artifact viewer renders PRD correctly
  - [ ] Test interactive feedback loop (view artifact + type in terminal)
  - [ ] Verify Claude updates PRD based on feedback
  - [ ] Verify diff view shows changes
  - [ ] Document results with screenshots

- [ ] Task 3: Validate multi-session monitoring (AC: #1, #3)
  - [ ] Start Session 2 with BMAD architecture workflow
  - [ ] Switch between Session 1 and Session 2
  - [ ] Verify terminal updates to correct session output
  - [ ] Verify file tree updates to correct worktree
  - [ ] Verify workflow progress shows correct current step
  - [ ] Verify session state preserved when switching
  - [ ] Test with 3-4 sessions active simultaneously
  - [ ] Document session isolation verification

- [ ] Task 4: Validate workflow progress component (AC: #4)
  - [ ] Start session at brainstorming phase
  - [ ] Verify indicators: ✓ (completed), → (current), ○ (pending)
  - [ ] Verify colors: green, blue, gray per Oceanic Calm
  - [ ] Verify current step has highlighted background
  - [ ] Watch Claude advance through steps
  - [ ] Verify workflow updates in real-time (YAML file change detected)
  - [ ] Verify auto-scroll keeps current step visible
  - [ ] Document workflow visualization accuracy

- [ ] Task 5: Validate artifact rendering quality (AC: #5)
  - [ ] Test with various document types: PRD, architecture, UX spec, epics, stories
  - [ ] Verify GFM features: tables, task lists, strikethrough
  - [ ] Verify code syntax highlighting for multiple languages
  - [ ] Verify headings, lists, links render correctly
  - [ ] Verify Oceanic Calm code theme matches terminal
  - [ ] Test edge cases: very long code blocks, nested lists, complex tables
  - [ ] Document rendering quality assessment

- [ ] Task 6: Validate diff view functionality (AC: #6)
  - [ ] Open artifact, note "last viewed" timestamp
  - [ ] Have Claude modify the document
  - [ ] Verify "Document updated" badge appears
  - [ ] Click "Show Diff" button
  - [ ] Verify added lines show green background
  - [ ] Verify deleted lines show red background + strikethrough
  - [ ] Verify unchanged lines provide context
  - [ ] Click "Hide Diff", verify return to normal view
  - [ ] Close and reopen file, verify timestamp updates
  - [ ] Document diff accuracy

- [ ] Task 7: Validate layout customization (AC: #7)
  - [ ] Drag left sidebar resize handle to various widths (200-400px)
  - [ ] Verify constraints enforced (min/max)
  - [ ] Refresh page, verify width persisted
  - [ ] Drag horizontal split handle (terminal/artifacts)
  - [ ] Verify 30-70% constraints
  - [ ] Verify smooth dragging (no lag)
  - [ ] Test double-click reset to defaults
  - [ ] Document resizing behavior

- [ ] Task 8: Validate file tree real-time updates (AC: #8)
  - [ ] Start session with empty docs folder
  - [ ] Watch Claude create new files
  - [ ] Verify files appear in tree within 1 second
  - [ ] Verify chokidar 500ms debounce working (rapid changes batched)
  - [ ] Test folder expand/collapse state persistence
  - [ ] Test file selection highlighting
  - [ ] Document file watcher reliability

- [ ] Task 9: Validate performance (AC: #10)
  - [ ] Measure file tree rendering time with 500 files
  - [ ] Measure markdown rendering time for 100KB file
  - [ ] Measure layout animation duration (should be 350ms)
  - [ ] Measure file change notification end-to-end latency
  - [ ] Measure sidebar toggle time (should be <50ms)
  - [ ] Document all measurements with DevTools Performance tab
  - [ ] Flag any NFR violations for optimization

- [ ] Task 10: Stress testing (AC: #11)
  - [ ] Create workspace with 100+ markdown files
  - [ ] Test file tree scrolling performance (should be 60fps)
  - [ ] Create 500KB markdown file with complex formatting
  - [ ] Test artifact viewer rendering and scrolling
  - [ ] Trigger rapid file changes (multiple docs written quickly)
  - [ ] Verify debounce batching and UI responsiveness
  - [ ] Document stress test results and any issues

- [ ] Task 11: Create validation script and report template (AC: #12)
  - [ ] Create `docs/sprint-artifacts/epic-3-validation-script.md`
  - [ ] Document step-by-step validation scenarios
  - [ ] Create checklist covering all ACs
  - [ ] Provide sample BMAD workflows for testers
  - [ ] Create `docs/sprint-artifacts/epic-3-validation-report-template.md`
  - [ ] Define expected vs actual results format
  - [ ] Include sections for screenshots and performance metrics

- [ ] Task 12: Execute validation and document results
  - [ ] Run through all validation scenarios
  - [ ] Fill out validation report template
  - [ ] Take screenshots of key functionality
  - [ ] Record any issues, bugs, or NFR violations
  - [ ] Assess overall Epic 3 readiness
  - [ ] Present findings to team (or document for review)

## Dev Notes

### Architecture Patterns and Constraints

**From Architecture (docs/architecture.md)**:
- **NFR-PERF-2 (PRD)**: Tab switching <50ms - Must validate sidebar toggle performance
- **File tree rendering**: <100ms for 500 files - Requires virtual scrolling for large trees
- **Markdown rendering**: <500ms for 100KB file - Validate with real BMAD documents
- **Layout animation**: 350ms CSS transition - Verify smooth artifact/terminal shifting
- **File change notification**: <200ms end-to-end - Chokidar event through WebSocket to UI update

**From Tech Spec Epic 3 (docs/sprint-artifacts/tech-spec-epic-3.md)**:
- **WorkflowState**: Parse BMAD YAML status files for workflow step tracking
- **FileTreeNode**: Hierarchical workspace file structure from backend
- **LayoutState**: Track sidebar views, widths, content modes, collapse states
- **DiffCache**: localStorage tracking of last viewed content for diff calculation

**Integration Points**:
- Epic 1: Terminal component remains visible during artifact viewing
- Epic 2: Session management provides isolation for multi-session workflows
- BMAD Method: Reads workflow status from `.bmad/bmm/status/bmm-workflow-status.yaml`
- shadcn/ui: Tabs (sidebar toggle), Resizable (panel handles), DropdownMenu (settings)

### Project Structure Notes

**Validation Artifacts to Create**:
```
docs/sprint-artifacts/
├── epic-3-validation-script.md       # Step-by-step test scenarios
├── epic-3-validation-report-template.md  # Results documentation format
└── epic-3-validation-results.md      # Actual validation findings
```

**Key Components to Validate**:
```
Backend:
├── src/statusParser.ts               # YAML parsing accuracy
├── src/fileWatcher.ts                # Chokidar event handling and debounce
└── WebSocket messages                # workflow.updated, file.changed, layout.shift

Frontend:
├── src/components/WorkflowProgress.tsx    # Step indicators and real-time updates
├── src/components/FileTree.tsx            # Hierarchy display and real-time updates
├── src/components/ArtifactViewer.tsx      # Markdown rendering quality
├── src/components/DiffView.tsx            # Change tracking and display
├── src/context/LayoutContext.tsx          # Layout mode management
└── Panel resize handlers                  # Smooth dragging and persistence
```

### Validation Approach

**Test Strategy**:
1. **Functional Validation**: Verify each AC with real BMAD workflows
2. **Performance Validation**: Measure timing with DevTools, compare to NFRs
3. **Stress Testing**: Push boundaries (100+ files, 500KB docs, rapid changes)
4. **Integration Testing**: Multi-session scenarios, end-to-end workflows
5. **Documentation**: Capture results, screenshots, metrics in validation report

**Sample BMAD Workflows for Testing**:
- **Session 1 "epic-auth"**: Run PRD creation workflow (generates prd.md)
- **Session 2 "epic-payments"**: Run architecture workflow (generates architecture.md)
- **Session 3 "epic-ui"**: Run UX design workflow (generates ux-design-specification.md)
- **Session 4 "epic-backend"**: Run epic planning workflow (generates epics.md)

**Success Criteria**:
- All 12 acceptance criteria passed
- All performance NFRs met or documented exceptions
- No critical bugs blocking Epic 3 completion
- Validation report approved by team
- Confident Epic 3 is production-ready for daily use

### Implementation Guidance

**Validation Execution Order**:
1. **Setup** (Task 1): Prepare environment, create test workflows
2. **Core Flow** (Task 2): Document review journey end-to-end
3. **Multi-Session** (Task 3): Session switching and isolation
4. **Components** (Tasks 4-8): Individual feature validation
5. **Performance** (Tasks 9-10): NFR validation and stress testing
6. **Documentation** (Tasks 11-12): Create artifacts and report results

**Performance Measurement Tools**:
- Chrome DevTools Performance tab: Record timeline, analyze frame rate
- React DevTools Profiler: Component render times
- Network tab: WebSocket message timing
- Console.time/timeEnd: Custom timing for specific operations

**Edge Cases to Test**:
- Empty workspace (no documents)
- Workspace with only one file
- File tree with deeply nested folders (10+ levels)
- Markdown files with malformed syntax (parser resilience)
- Rapid session switching (state consistency)
- Container restart during document viewing (recovery)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Acceptance-Criteria] - AC3.20: 4 sessions monitored at a glance
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Test-Strategy-Summary] - Critical test cases and E2E flows
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Non-Functional-Requirements] - Performance targets and validation methods
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Workflows-and-Sequencing] - Document review flow and workflow update flow
- [Source: docs/epics/epic-3-workflow-visibility.md#Story-3.12] - Story details and prerequisites
- [Source: docs/architecture.md#Performance-Considerations] - NFR-PERF-1, NFR-PERF-2, NFR-PERF-3, NFR-PERF-4
- [Source: docs/prd.md] - Sprint 3 Success Criteria: "Can monitor 4 sessions at a glance and view all generated artifacts"

### Learnings from Previous Story

**From Story 3-11 (Browser Notifications Prep)**:

Story 3-11 was a preparatory story focusing on permission setup. No implementation completed yet (status: ready-for-dev), so no specific code patterns or deviations to note.

**Relevant Patterns from Epic 2 Retrospective**:
- **Lesson**: "Comprehensive test coverage (96%+) prevented regressions" - Apply to validation: thorough AC coverage prevents missing edge cases
- **Lesson**: "TypeScript strict mode caught edge cases early" - Validation should verify type safety in all components
- **Success**: "Session isolation verified through testing" - Epic 3 validation must verify file tree and workflow isolation across sessions
- **Technical Debt**: TD-3 (WebSocket protocol documentation) identified - Validation should note any protocol inconsistencies

**Epic 3-Specific Considerations**:
- **New Integrations**: First epic to integrate BMAD YAML parsing - Validate parser handles edge cases (missing fields, malformed YAML)
- **New UI Patterns**: Context-aware layout shifting is novel - Validate auto-shift timing and manual override consistency
- **Performance-Critical**: File watching and markdown rendering must meet NFRs - Performance validation is critical
- **Multi-Component Integration**: Workflow progress + file tree + artifact viewer + diff view work together - End-to-end flow validation essential

**Key Validation Focus Areas**:
1. **BMAD Integration**: statusParser accuracy, real-time YAML change detection
2. **Layout Shifting**: Auto-shift triggers, manual overrides, persistence
3. **Markdown Rendering**: GFM features, syntax highlighting, large file handling
4. **Diff View**: Accurate change tracking, localStorage cache, visual clarity
5. **Multi-Session**: Session isolation, state preservation, context switching

## Change Log

**2025-11-25**:
- Story created from Epic 3 tech spec
- Story context generated (3-12-validation-with-document-review-flow.context.xml)
- Status: drafted → ready-for-dev
- Next: Run dev-story to execute validation

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/3-12-validation-with-document-review-flow.context.xml

### Agent Model Used

<!-- Will be filled during implementation -->

### Debug Log References

<!-- Will be added during implementation -->

### Completion Notes List

<!-- Will be added during implementation -->

### File List

<!-- Will be added during implementation -->
