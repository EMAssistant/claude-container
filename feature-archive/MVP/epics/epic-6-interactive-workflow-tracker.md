## Epic 6: Interactive Workflow Tracker

**Goal:** Transform the workflow visualization from a static status display into an interactive project command center that shows exactly where you are in the development process and enables one-click workflow execution

**User Value:** Developers can instantly see their current epic/story/status, view all artifacts created at each step, and launch BMAD workflows directly from the UI - eliminating context switching and manual command typing

**FR Coverage:** FR37-FR42 (Workflow Visualization - enhanced), plus new interactive execution capabilities

### Background

The current workflow visualization shows the 4 BMAD phases (Discovery, Planning, Solutioning, Implementation) as a static swim lane diagram. However:

1. **Implementation is undersized** - The phase where 80% of work happens shows only "Sprint Planning" with a checkmark
2. **No execution context** - Users can't see which epic/story they're currently working on
3. **No artifact visibility** - Documents created at each step aren't shown or linked
4. **No interactivity** - Steps aren't clickable; users must manually type slash commands

This epic transforms the workflow view into an interactive tracker that:
- Parses `sprint-status.yaml` to show real-time epic/story progress
- Displays artifacts (docs, stories, context files) under each step
- Enables one-click workflow execution via action buttons

---

### Story 6.1: Sprint Status YAML Parser

As a developer,
I want the backend to parse sprint-status.yaml and expose epic/story data,
So that the UI can display my current development progress.

**Acceptance Criteria:**

**Given** the workspace contains `docs/sprint-artifacts/sprint-status.yaml`
**When** the file watcher detects the file (on startup or change)
**Then** the backend parses the `development_status` section

**And** extracts epic data with structure:
```typescript
{
  epicNumber: number,
  epicKey: string,           // "epic-4"
  status: 'backlog' | 'contexted',
  retrospective: 'optional' | 'completed' | null
}
```

**And** extracts story data with structure:
```typescript
{
  storyId: string,           // "4-16"
  epicNumber: number,
  storyNumber: number,
  slug: string,              // "session-list-hydration-on-page-load"
  status: 'backlog' | 'drafted' | 'ready-for-dev' | 'in-progress' | 'review' | 'done'
}
```

**And** determines `currentEpic` as the highest epic number with non-done stories

**And** determines `currentStory` as the first non-done story in current epic (by story number)

**And** exposes data via `GET /api/sprint/status` endpoint

**And** broadcasts `sprint.updated` WebSocket message on file changes

**Prerequisites:** Story 3.1 (Workflow status parser infrastructure)

**Technical Notes:**
- Extend `statusParser.ts` with `parseSprintStatus()` function
- Key naming pattern: `{epicNum}-{storyNum}-{slug}` for stories, `epic-{N}` for epics
- Story status progression: backlog → drafted → ready-for-dev → in-progress → review → done
- File location: `docs/sprint-artifacts/sprint-status.yaml` (from `story_location` field)

---

### Story 6.2: Artifact Path Derivation and Existence Check

As a developer,
I want the system to automatically identify artifacts associated with each workflow step,
So that I can see and access all documents created during the project.

**Acceptance Criteria:**

**Given** a workflow phase step (e.g., "prd", "create-architecture")
**When** the step has a file path as its status value in `bmm-workflow-status.yaml`
**Then** that path is included as an artifact for the step

**And given** a story with id "4-16" and slug "session-list-hydration-on-page-load"
**When** the story status is "drafted" or higher
**Then** the story artifact is: `docs/sprint-artifacts/4-16-session-list-hydration-on-page-load.md`

**And when** the story status is "ready-for-dev" or higher
**Then** the context artifact is: `docs/sprint-artifacts/4-16-session-list-hydration-on-page-load.context.xml`

**And given** an epic with number 4
**When** the epic status is "contexted"
**Then** the tech spec artifact is: `docs/sprint-artifacts/tech-spec-epic-4.md`

**And when** the epic has `retrospective: completed`
**Then** the retrospective artifact is: `docs/sprint-artifacts/epic-4-retrospective.md`

**And** for each derived artifact path
**Then** the backend verifies file existence before including it

**And** the `GET /api/sprint/status` response includes artifacts array per step:
```json
{
  "artifacts": [
    { "name": "Story", "path": "docs/sprint-artifacts/4-16-session-list....md", "exists": true },
    { "name": "Context", "path": "docs/sprint-artifacts/4-16-session-list....context.xml", "exists": true }
  ]
}
```

**Prerequisites:** Story 6.1 (Sprint status parser)

**Technical Notes:**
- Use `fs.existsSync()` or async equivalent for existence checks
- Cache existence results (invalidate on file.changed events)
- Artifact naming conventions documented in sprint-status.yaml header comments

---

### Story 6.3: Sprint Tracker Component (MVP View)

As a developer,
I want to see my current epic and story progress in a clear list view,
So that I know exactly where I am in the development process.

**Acceptance Criteria:**

**Given** the workflow panel is open in the sidebar or main area
**When** sprint status data is available
**Then** the Sprint Tracker displays:

```
Epic 4: Production Stability & Polish    [15/19 stories]
════════════════════════════════════════════════════════

✓ 4-1   Session status tracking              done
✓ 4-2   Attention badges                     done
  ...
✓ 4-12  Documentation                        done
────────────────────────────────────────────────────────
○ 4-13  Production validation                drafted
◉ 4-16  Session list hydration               review
◉ 4-17  Cross-tab sync                       review
◉ 4-18  Destroy protection                   review
◉ 4-19  Reconnection sync                    review
```

**And** status icons are:
- `✓` (green) = done
- `◉` (yellow) = review
- `→` (cyan) = in-progress
- `○` (gray) = drafted/ready-for-dev
- `·` (dim) = backlog

**And** the current story (first non-done) is highlighted with background color

**And** a progress bar shows `completedStories / totalStories`

**And** clicking a story row expands it to show artifacts (Story 6.4)

**And** the component updates in real-time via `sprint.updated` WebSocket messages

**Prerequisites:** Story 6.1 (Sprint status parser), Story 6.2 (Artifact derivation)

**Technical Notes:**
- New component: `SprintTracker.tsx`
- Integrate with existing `WorkflowContext` or create `SprintContext`
- Use collapsible rows for story details
- Virtualize list if performance issues with many stories

---

### Story 6.4: Artifact Display Under Steps

As a developer,
I want to see documents created for each step displayed under that step,
So that I can quickly access any artifact without searching the file tree.

**Acceptance Criteria:**

**Given** a workflow phase step with artifacts (e.g., PRD Creation)
**When** the step row is expanded or hovered
**Then** artifacts are displayed nested under the step:
```
✓ PRD Creation
   └─ 📄 prd.md                              [View]
```

**And given** a story with multiple artifacts
**When** the story row is expanded
**Then** all artifacts are listed:
```
◉ 4-16  Session list hydration               review
   ├─ 📄 4-16-session-list-hydration.md      [View]
   └─ 📄 4-16-session-list-hydration.context.xml  [View]
```

**And** clicking `[View]` opens the artifact in ArtifactViewer

**And** artifacts that don't exist (exists: false) are shown grayed out with "(missing)" label

**And** the phase steps (Discovery, Planning, Solutioning) also show their artifacts:
```
▼ Planning (3/3)
  ├─ ✓ PRD Creation
  │    └─ 📄 prd.md                          [View]
  ├─ ⊘ Validate PRD                          skipped
  └─ ✓ UX Design
       └─ 📄 ux-design-specification.md      [View]
```

**Prerequisites:** Story 6.2 (Artifact derivation), Story 6.3 (Sprint tracker)

**Technical Notes:**
- Clicking [View] calls `setSelectedFile(artifactPath)` from LayoutContext
- Use indentation or tree lines for visual hierarchy
- Icons: 📄 for .md, 📋 for .xml, 📊 for .yaml

---

### Story 6.5: Action Buttons for Workflow Execution

As a developer,
I want action buttons on stories that execute the appropriate BMAD workflow,
So that I can start working on a story with one click.

**Acceptance Criteria:**

**Given** a story with status "drafted"
**When** the story row is displayed
**Then** an action button `[▶ Context]` appears

**And** clicking `[▶ Context]` sends to terminal:
```
/bmad:bmm:workflows:story-context {storyId}
```

**And given** a story with status "ready-for-dev"
**When** the story row is displayed
**Then** an action button `[▶ Start]` appears

**And** clicking `[▶ Start]` sends to terminal:
```
/bmad:bmm:workflows:dev-story {storyId}
```

**And given** a story with status "review"
**When** the story row is displayed
**Then** an action button `[▶ Review]` appears

**And** clicking `[▶ Review]` sends to terminal:
```
/bmad:bmm:workflows:code-review {storyId}
```

**And given** a story with status "done"
**Then** no action button is displayed (or shows disabled "Done")

**And** the action button sends the command via WebSocket:
```json
{ "type": "terminal.input", "sessionId": "<activeSession>", "data": "/bmad:bmm:workflows:dev-story 4-16\n" }
```

**And** after sending, the terminal panel is focused/expanded

**Prerequisites:** Story 6.3 (Sprint tracker), WebSocket terminal input (existing)

**Technical Notes:**
- Map status to command: drafted→story-context, ready-for-dev→dev-story, review→code-review
- Use active session from SessionContext
- Focus terminal after command: `setMainContentMode('terminal')` or scroll to terminal
- Button styling: Green for Start, Blue for Context, Yellow for Review

---

### Story 6.6: Collapsible Phase Overview

As a developer,
I want the BMAD phases (Discovery, Planning, Solutioning) shown as collapsible sections,
So that I can see the full project history with artifacts while focusing on implementation.

**Acceptance Criteria:**

**Given** the Sprint Tracker view
**When** rendered
**Then** phases are displayed as collapsible sections above the current epic:

```
▶ Discovery (3/3)                           [collapsed]
▶ Planning (3/3)                            [collapsed]
▶ Solutioning (5/5)                         [collapsed]
▼ Implementation - Epic 4 (15/19)           [expanded]
   ✓ 4-1  Session status tracking           done
   ...
```

**And** clicking a phase header toggles expansion

**And** when expanded, phase shows all steps with status and artifacts (per Story 6.4)

**And** "skipped" steps are shown with `⊘` icon and strikethrough text in gray

**And** completed phases show green checkmark in header

**And** the Implementation section shows the current epic and is expanded by default

**And** collapse/expand state persists to localStorage

**Prerequisites:** Story 6.3 (Sprint tracker), Story 6.4 (Artifact display)

**Technical Notes:**
- Reuse workflow phase data from existing WorkflowContext
- Combine phase data (bmm-workflow-status.yaml) with sprint data (sprint-status.yaml)
- localStorage key: `sprintTrackerCollapsedSections`

---

### Story 6.7: Epic Navigation and Selection

As a developer,
I want to navigate between epics in the Sprint Tracker,
So that I can review past epics or see upcoming work.

**Acceptance Criteria:**

**Given** multiple epics exist in sprint-status.yaml
**When** the Sprint Tracker is displayed
**Then** an epic selector dropdown appears in the Implementation section header:
```
▼ Implementation - [Epic 4 ▾] (15/19)
```

**And** clicking the dropdown shows all epics:
```
Epic 1: Foundation             ✓ 12/12
Epic 2: Multi-Session          ✓ 12/12
Epic 3: Workflow Visibility    ✓ 12/12
Epic 4: Production Stability   ◉ 15/19  ← current
Epic 5: Git Integration        · 0/11
```

**And** selecting an epic switches the story list to that epic

**And** the current epic (with incomplete stories) is marked with `◉`

**And** completed epics show `✓`

**And** future epics (backlog status) show `·`

**And** epic tech-spec and retrospective artifacts are shown under epic header when expanded

**Prerequisites:** Story 6.3 (Sprint tracker), Story 6.1 (Multi-epic parsing)

**Technical Notes:**
- Epic metadata from sprint-status.yaml: `epic-{N}: contexted|backlog`
- Epic names may need mapping or extraction from epic files
- Consider epic file parsing: `docs/epics/epic-{N}-*.md` for names

---

### Story 6.8: Replace Swim Lane with Sprint Tracker as Default

As a developer,
I want the Sprint Tracker to be the default workflow view,
So that I see actionable execution state instead of static phase diagrams.

**Acceptance Criteria:**

**Given** the user clicks "View" in the sidebar workflow panel
**When** the main content area opens
**Then** the Sprint Tracker (Story 6.3) is displayed by default

**And** a `[Phases]` button in the header allows switching to the swim lane diagram

**And** clicking `[Phases]` shows the existing swim lane visualization (WorkflowDiagram.tsx)

**And** a `[Sprint]` button allows switching back to Sprint Tracker

**And** the user's view preference persists to localStorage

**And** the sidebar compact view shows:
```
BMAD Workflow              [View]
Epic 4 · Story 4-16 · review
[▶ Review]
```

**And** clicking the sidebar `[▶ Review]` button executes the action (same as Story 6.5)

**Prerequisites:** Story 6.3-6.7 (Sprint tracker complete), existing WorkflowDiagram.tsx

**Technical Notes:**
- Add view toggle state to LayoutContext: `workflowViewMode: 'sprint' | 'phases'`
- Update WorkflowProgress.tsx (sidebar) to show current story summary
- Keep WorkflowDiagram.tsx as legacy/alternative view

---

### Story 6.9: Create Next Story Action

As a developer,
I want an action button to create the next story when all current stories are done or in review,
So that I can continue the workflow without manually running commands.

**Acceptance Criteria:**

**Given** all stories in the current epic are "done" or "review"
**When** the Sprint Tracker is displayed
**Then** a prominent action appears: `[+ Create Next Story]`

**And** clicking the button sends to terminal:
```
/bmad:bmm:workflows:create-story
```

**And given** the current epic is complete (all stories done, retrospective optional/completed)
**When** the Sprint Tracker is displayed
**Then** the action shows: `[+ Start Epic {N+1}]`

**And** clicking sends to terminal:
```
/bmad:bmm:workflows:epic-tech-context {nextEpicNumber}
```

**Prerequisites:** Story 6.5 (Action buttons), Story 6.7 (Epic navigation)

**Technical Notes:**
- Logic: if (allStoriesDoneOrReview && currentEpic.retrospective !== 'optional') → show create story
- Logic: if (epicComplete && nextEpicExists) → show start next epic
- Button placement: Below story list or in sticky footer

---

### Story 6.10: Validation with Full Workflow Execution

As a developer,
I want to validate the Sprint Tracker works end-to-end with real BMAD workflows,
So that I can confidently use it for daily development.

**Acceptance Criteria:**

**Given** the Sprint Tracker is fully implemented
**When** I click `[▶ Start]` on a "ready-for-dev" story
**Then** the terminal receives the dev-story command

**And** Claude begins executing the story

**And** as the story progresses (status changes in sprint-status.yaml)
**Then** the Sprint Tracker updates in real-time

**And** when the story moves to "review"
**Then** the action button changes to `[▶ Review]`

**And** clicking `[View]` on an artifact opens it in ArtifactViewer

**And** the full flow works: Context → Start → Review → Done

**And** epic transitions work: complete epic → start next epic

**Prerequisites:** Stories 6.1-6.9 complete

**Technical Notes:**
- Create validation checklist document
- Test with actual BMAD workflow execution
- Document any edge cases discovered

---

## Technical Architecture Summary

### Data Flow
```
bmm-workflow-status.yaml ─┐
                          ├─→ Combined Parser ─→ UnifiedWorkflowState
sprint-status.yaml ───────┘                              │
                                                         ▼
                                              SprintTracker.tsx
                                                         │
                          ┌──────────────────────────────┼──────────────────────────────┐
                          ▼                              ▼                              ▼
                   [View Artifact]              [Action Button]               [Phase Toggle]
                          │                              │                              │
                          ▼                              ▼                              ▼
                   ArtifactViewer              terminal.input WS            WorkflowDiagram
```

### New/Modified Files
- `backend/src/sprintParser.ts` - New: Parse sprint-status.yaml
- `backend/src/statusParser.ts` - Modified: Add artifact derivation
- `frontend/src/components/SprintTracker.tsx` - New: Main component
- `frontend/src/components/WorkflowProgress.tsx` - Modified: Show current story summary
- `frontend/src/context/SprintContext.tsx` - New: Sprint state management
- `frontend/src/types.ts` - Modified: Add SprintState types

### API Changes
- `GET /api/sprint/status` - New endpoint for sprint data
- `sprint.updated` - New WebSocket message type
