# Epic Technical Specification: Interactive Workflow Tracker

Date: 2025-11-26
Author: Kyle
Epic ID: 6
Status: Draft

---

## Overview

Epic 6 transforms the workflow visualization from a static swim lane diagram into an interactive project command center. Building upon the workflow status parsing infrastructure from Epic 3 and the production stability from Epic 4, this epic extends the backend to parse `sprint-status.yaml` for real-time epic/story progress, derives artifact paths automatically based on story status, and provides a new Sprint Tracker UI component that enables one-click workflow execution.

The primary value proposition is eliminating context switching and manual command typing. Developers can instantly see their current epic, story status, and all generated artifacts at each step. Action buttons on each story row execute the appropriate BMAD workflow (`story-context`, `dev-story`, `code-review`) directly from the UI. The Sprint Tracker becomes the primary workflow view, replacing the static phase diagram while keeping it accessible for historical context.

## Objectives and Scope

### In-Scope

- **Sprint Status YAML Parser**: Extend `statusParser.ts` to parse `sprint-status.yaml`, extracting epic data (epicNumber, status, retrospective) and story data (storyId, epicNumber, storyNumber, slug, status)
- **Artifact Path Derivation**: Auto-detect artifact paths based on story/epic status (story files, context files, tech specs, retrospectives) with existence verification
- **Sprint Tracker Component**: New `SprintTracker.tsx` component displaying epic/story progress with status icons (✓ done, ◉ review, → in-progress, ○ drafted, · backlog)
- **Artifact Display**: Nested artifact list under each story/step with [View] buttons that open ArtifactViewer
- **Action Buttons**: Status-aware buttons ([▶ Context], [▶ Start], [▶ Review]) that send slash commands to the terminal
- **Collapsible Phase Overview**: Historical BMAD phases (Discovery, Planning, Solutioning) as collapsible sections with artifacts
- **Epic Navigation**: Dropdown selector to switch between epics with completion status indicators
- **Default View Toggle**: Sprint Tracker as default workflow view, with [Phases] button to access swim lane diagram
- **Create Next Story Action**: Prominent button to continue workflow when all stories are done/review
- **End-to-End Validation**: Verify full workflow execution cycle through Sprint Tracker

### Out-of-Scope

- Real-time collaborative workflow editing (single user)
- Workflow step editing/creation through UI (read-only visualization)
- Mobile responsive layout (desktop-only tool)
- Custom workflow definitions (BMAD Method only)
- Session-specific workflow tracking (workspace-global view)
- Drag-and-drop story reordering

## System Architecture Alignment

This epic aligns with the architecture decisions established in `docs/architecture.md` and `docs/architecture-decisions.md`:

| Architecture Component | Epic 6 Implementation |
|------------------------|----------------------|
| **YAML Parsing (ADR-006)** | Extend `statusParser.ts` with `parseSprintStatus()` using existing js-yaml dependency |
| **File Watching (ADR-006)** | Reuse chokidar watcher for `sprint-status.yaml` changes, 500ms debounce |
| **WebSocket Protocol (ADR-013)** | New message type: `sprint.updated` for real-time status updates |
| **React Context API (ADR-005)** | New `SprintContext` or extend `WorkflowContext` for sprint state management |
| **UI Component Library** | Existing shadcn/ui components: Collapsible, DropdownMenu, Button, Tooltip |
| **REST API Pattern** | New endpoint: `GET /api/sprint/status` following existing `/api/workflow/status` pattern |
| **File System Access** | Artifact existence checks using `fs.existsSync()` with path validation |

**Constraints from Architecture:**
- All file paths must validate against `/workspace/` prefix (security)
- WebSocket messages must follow `resource.action` naming convention
- Tab switching must remain <50ms (NFR-PERF-2)
- Layout transitions use CSS transitions (350ms ease-out)
- localStorage used for collapse/expand state persistence

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs |
|--------|---------------|--------|---------|
| `statusParser.ts` (extended) | Parse sprint-status.yaml, extract epic/story data, derive artifact paths | YAML file content | `SprintStatus` object with epics, stories, artifacts |
| `fileWatcher.ts` (extended) | Watch `sprint-status.yaml` for changes, trigger broadcasts | File system events | WebSocket `sprint.updated` messages |
| `SprintTracker.tsx` (new) | Main sprint visualization component with story list, progress bar | `SprintStatus` from context | Interactive UI with action buttons |
| `SprintContext.tsx` (new) | Manage sprint state, current epic selection, WebSocket updates | WebSocket messages, API responses | React context for consumers |
| `WorkflowProgress.tsx` (modified) | Show current story summary in sidebar compact view | `SprintStatus` from context | Compact status display with action button |
| `EpicSelector.tsx` (new) | Dropdown for switching between epics | Epic list from context | Selected epic ID |
| `StoryRow.tsx` (new) | Individual story display with artifacts and action button | Story data, artifacts | Expandable row with nested artifacts |
| `PhaseOverview.tsx` (new) | Collapsible historical phase sections | Workflow phase data | Collapsible sections with artifacts |

### Data Models and Contracts

**SprintStatus (Backend → Frontend)**
```typescript
interface SprintStatus {
  epics: EpicData[];
  stories: StoryData[];
  currentEpic: number;           // Highest epic with non-done stories
  currentStory: string | null;   // First non-done story ID in current epic
  lastUpdated: string;           // ISO 8601 timestamp
}

interface EpicData {
  epicNumber: number;
  epicKey: string;               // "epic-4"
  status: 'backlog' | 'contexted';
  retrospective: 'optional' | 'completed' | null;
  title?: string;                // Extracted from epic file if available
  storyCount: number;
  completedCount: number;
  artifacts: ArtifactInfo[];     // Tech spec, retrospective
}

interface StoryData {
  storyId: string;               // "4-16"
  storyKey: string;              // "4-16-session-list-hydration-on-page-load"
  epicNumber: number;
  storyNumber: number;
  slug: string;                  // "session-list-hydration-on-page-load"
  status: 'backlog' | 'drafted' | 'ready-for-dev' | 'in-progress' | 'review' | 'done';
  artifacts: ArtifactInfo[];     // Story file, context file
}

interface ArtifactInfo {
  name: string;                  // "Story", "Context", "Tech Spec"
  path: string;                  // Relative path from workspace root
  exists: boolean;               // File existence verified
  icon: '📄' | '📋' | '📊';     // .md, .xml, .yaml
}
```

**SprintContext State (Frontend)**
```typescript
interface SprintContextState {
  sprintStatus: SprintStatus | null;
  selectedEpicNumber: number;
  isLoading: boolean;
  error: string | null;
  collapsedSections: Set<string>;  // Persisted to localStorage
  workflowViewMode: 'sprint' | 'phases';
}

interface SprintContextActions {
  setSelectedEpic: (epicNumber: number) => void;
  toggleSection: (sectionId: string) => void;
  setViewMode: (mode: 'sprint' | 'phases') => void;
  refreshStatus: () => Promise<void>;
  executeWorkflow: (command: string) => void;
}
```

**Artifact Path Derivation Rules**
```typescript
// Story artifacts (based on status progression)
// drafted+ : docs/sprint-artifacts/{storyKey}.md
// ready-for-dev+ : docs/sprint-artifacts/{storyKey}.context.xml

// Epic artifacts (based on epic status)
// contexted : docs/sprint-artifacts/tech-spec-epic-{N}.md
// retrospective=completed : docs/sprint-artifacts/epic-{N}-retrospective.md

// Phase artifacts (from bmm-workflow-status.yaml)
// Step has file path as value → that path is the artifact
```

### APIs and Interfaces

**New REST Endpoint**

```typescript
// GET /api/sprint/status
// Returns complete sprint status with epics, stories, and artifacts
Response: {
  sprintStatus: SprintStatus
}

// Error Response (if sprint-status.yaml not found)
Response: {
  error: {
    type: 'not_found',
    message: 'Sprint status file not found',
    suggestion: 'Run sprint-planning workflow to initialize'
  }
}
```

**New WebSocket Message Types**

```typescript
// Server → Client: Sprint status update
{
  type: 'sprint.updated',
  sprintStatus: SprintStatus,
  changedStories: string[]       // Story IDs that changed
}

// Client → Server: Terminal input for workflow execution
// (Uses existing terminal.input message type)
{
  type: 'terminal.input',
  sessionId: string,
  data: '/bmad:bmm:workflows:dev-story 4-16\n'
}
```

**Action Button Command Mapping**

| Story Status | Button Label | Command |
|--------------|--------------|---------|
| `drafted` | [▶ Context] | `/bmad:bmm:workflows:story-context {storyId}` |
| `ready-for-dev` | [▶ Start] | `/bmad:bmm:workflows:dev-story {storyId}` |
| `in-progress` | [▶ Continue] | Focus terminal (no command) |
| `review` | [▶ Review] | `/bmad:bmm:workflows:code-review {storyId}` |
| `done` | ✓ Done | No button (disabled state) |
| `backlog` | - | No button (story not yet drafted) |

### Workflows and Sequencing

**Sprint Status Load Flow**

```
1. App initializes
   ↓
2. SprintContext fetches GET /api/sprint/status
   ↓
3. Backend reads sprint-status.yaml
   ├─ Parse development_status section
   ├─ Extract all epic-N entries
   ├─ Extract all N-M-slug story entries
   └─ Derive artifact paths, check existence
   ↓
4. Backend returns SprintStatus
   ↓
5. SprintContext stores state
   ↓
6. SprintTracker renders with current epic expanded
```

**Real-Time Update Flow**

```
1. sprint-status.yaml changes (BMAD workflow updates it)
   ↓
2. Chokidar detects file change (500ms debounce)
   ↓
3. Backend re-parses sprint-status.yaml
   ↓
4. Backend calculates changed stories (diff previous/current)
   ↓
5. Backend broadcasts WebSocket:
   { type: 'sprint.updated', sprintStatus, changedStories }
   ↓
6. SprintContext receives message
   ↓
7. SprintContext updates state
   ↓
8. SprintTracker re-renders
   ├─ Story status icons update
   ├─ Progress bar animates
   └─ Action buttons change per new status
```

**Workflow Execution Flow (One-Click Action)**

```
1. User clicks [▶ Start] on story 4-16
   ↓
2. SprintTracker.executeWorkflow():
   a) Get activeSessionId from SessionContext
   b) Build command: '/bmad:bmm:workflows:dev-story 4-16\n'
   c) Send WebSocket: { type: 'terminal.input', sessionId, data }
   ↓
3. Terminal receives command, Claude starts executing
   ↓
4. LayoutContext.setMainContentMode('terminal')
   ↓
5. As story progresses, sprint-status.yaml updates
   ↓
6. sprint.updated message → UI reflects new status
```

**Artifact View Flow**

```
1. User expands story row (click or hover)
   ↓
2. Artifacts list appears:
   ├─ 📄 4-16-session-list-hydration.md      [View]
   └─ 📋 4-16-session-list-hydration.context.xml  [View]
   ↓
3. User clicks [View] on story file
   ↓
4. LayoutContext.setSelectedFile('docs/sprint-artifacts/4-16-session-list-hydration.md')
   ↓
5. MainContentArea shifts to artifact view (or split)
   ↓
6. ArtifactViewer loads and renders markdown
```

**Epic Transition Flow**

```
1. All stories in epic 4 are 'done'
   ├─ epic-4-retrospective: completed
   └─ epic-5: backlog
   ↓
2. SprintTracker shows: [+ Start Epic 5]
   ↓
3. User clicks button
   ↓
4. Command sent: '/bmad:bmm:workflows:epic-tech-context 5\n'
   ↓
5. Tech spec generation begins
   ↓
6. sprint-status.yaml updates: epic-5: contexted
   ↓
7. Sprint Tracker updates to show Epic 5 stories
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Validation | Story |
|-------------|--------|------------|-------|
| **Sprint status API response** | <200ms | Measure endpoint response time | 6.1 |
| **WebSocket update delivery** | <100ms from file change | Chokidar event → broadcast timing | 6.1 |
| **Story row expansion** | <50ms | CSS transition, no re-render blocking | 6.4 |
| **Epic selector switch** | <100ms | Data already loaded, just filter | 6.7 |
| **Artifact existence checks** | Batch <500ms for 50 files | Async parallel `fs.access()` checks | 6.2 |
| **Sprint Tracker initial render** | <200ms | Virtualize if >100 stories | 6.3 |
| **Action button click → terminal** | <50ms | Direct WebSocket send | 6.5 |
| **View mode toggle (Sprint/Phases)** | <50ms | Component swap, no data fetch | 6.8 |

**Implementation Notes:**
- Cache artifact existence results in memory (invalidate on `file.changed` events)
- Story list does not need virtualization for typical project sizes (<50 stories per epic)
- Epic selector pre-loads all epics on initial fetch (no lazy loading needed)
- Collapse/expand uses CSS `max-height` transition (350ms ease-out)

### Security

| Requirement | Implementation | Story |
|-------------|----------------|-------|
| **Path traversal prevention** | All artifact paths validated against `/workspace/` prefix | 6.2 |
| **Command injection prevention** | Story IDs validated as alphanumeric-dash pattern before building commands | 6.5 |
| **XSS in story slugs** | Story slugs sanitized/escaped when rendered in UI | 6.3 |
| **WebSocket message validation** | `sprint.updated` payload validated before state update | 6.1 |

### Reliability/Availability

| Requirement | Implementation | Story |
|-------------|----------------|-------|
| **Missing sprint-status.yaml** | Show empty state with "Run sprint-planning" suggestion | 6.1 |
| **Malformed YAML** | Graceful degradation: show error banner, retain last valid state | 6.1 |
| **Artifact file moved/deleted** | `exists: false` flag, show "(missing)" label, no crash | 6.2 |
| **WebSocket disconnection** | Sprint status preserved in context, refresh on reconnect | 6.1 |
| **Action button no active session** | Show toast "No active session - create one first" | 6.5 |
| **Phase data unavailable** | Collapse phase sections, show "Phase data unavailable" | 6.6 |

### Observability

| Signal | Purpose | Level |
|--------|---------|-------|
| `log.info('Sprint status parsed', { epicCount, storyCount })` | Track successful parses | info |
| `log.warn('Sprint status parse failed', { error })` | Debug YAML issues | warn |
| `log.info('Sprint status broadcast', { changedStories })` | Track real-time updates | info |
| `log.info('Workflow executed from Sprint Tracker', { storyId, command })` | Track UI-initiated workflows | info |
| `log.debug('Artifact existence check', { path, exists })` | Debug file access | debug |
| `log.error('Artifact path validation failed', { path })` | Security monitoring | error |

## Dependencies and Integrations

### NPM Dependencies (Backend - No New Additions)

Epic 6 uses existing backend dependencies. No new packages required.

| Package | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| `js-yaml` | ^4.1.1 | YAML parsing for sprint-status.yaml | ✓ (Epic 1) |
| `chokidar` | ^4.0.0 | File watching for sprint-status.yaml changes | ✓ (Epic 1) |
| `ws` | ^8.14.0 | WebSocket server for `sprint.updated` broadcasts | ✓ (Epic 1) |
| `express` | ^4.18.0 | REST API for `/api/sprint/status` endpoint | ✓ (Epic 1) |

### NPM Dependencies (Frontend - No New Additions)

Epic 6 uses existing frontend dependencies. No new packages required.

| Package | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| `@radix-ui/react-dropdown-menu` | ^2.1.16 | Epic selector dropdown | ✓ (Epic 3) |
| `@radix-ui/react-tooltip` | ^1.2.8 | Story status tooltips | ✓ (Epic 3) |
| `@radix-ui/react-tabs` | ^1.1.13 | View mode toggle (Sprint/Phases) | ✓ (Epic 3) |
| `lucide-react` | ^0.554.0 | Icons for status indicators and action buttons | ✓ (Epic 1) |
| `react-markdown` | ^10.1.0 | Artifact preview (if inline preview added) | ✓ (Epic 3) |

**Note:** The `@radix-ui/react-collapsible` component may be needed for phase sections. If not already installed, add it:
```bash
npm install @radix-ui/react-collapsible
```

### Integration Points

| System | Integration | Story |
|--------|-------------|-------|
| **Epic 3 statusParser.ts** | Extend with `parseSprintStatus()` function | 6.1 |
| **Epic 3 fileWatcher.ts** | Add watch for `sprint-status.yaml`, broadcast `sprint.updated` | 6.1 |
| **Epic 3 WorkflowContext** | Either extend or create separate SprintContext | 6.1-6.3 |
| **Epic 3 WorkflowProgress.tsx** | Modify sidebar view to show current story summary | 6.8 |
| **Epic 3 WorkflowDiagram.tsx** | Keep as alternate view, accessible via [Phases] button | 6.8 |
| **Epic 3 LayoutContext** | Use existing `setSelectedFile()` for artifact viewing | 6.4 |
| **Epic 3 ArtifactViewer** | Reuse for displaying story/tech-spec documents | 6.4 |
| **Epic 4 SessionContext** | Get activeSessionId for workflow execution commands | 6.5 |
| **Epic 4 useKeyboardShortcuts** | Consider adding shortcut for Sprint/Phases toggle | 6.8 |
| **Existing terminal.input** | Reuse WebSocket message type for command injection | 6.5 |

### File System Dependencies

| Path | Purpose | Read/Write |
|------|---------|------------|
| `docs/sprint-artifacts/sprint-status.yaml` | Primary sprint status source | Read |
| `docs/sprint-artifacts/*.md` | Story files, tech specs, retrospectives | Read (existence check) |
| `docs/sprint-artifacts/*.context.xml` | Story context files | Read (existence check) |
| `.bmad/bmm/status/bmm-workflow-status.yaml` | Phase step status (Discovery, Planning, etc.) | Read |
| `docs/epics/epic-*.md` | Epic titles extraction (optional) | Read |

### localStorage Keys

| Key | Purpose | Default |
|-----|---------|---------|
| `claude-container-sprint-collapsed` | Collapsed section IDs (Set serialized) | `[]` |
| `claude-container-workflow-view-mode` | `'sprint'` or `'phases'` | `'sprint'` |
| `claude-container-selected-epic` | Last selected epic number | Current epic |

## Acceptance Criteria (Authoritative)

| AC# | Criteria | Testable Condition |
|-----|----------|-------------------|
| AC6.1 | Backend parses sprint-status.yaml development_status section | Given valid YAML, parser returns epics and stories arrays |
| AC6.2 | Epic data extracted with correct structure | epicNumber, epicKey, status, retrospective fields populated |
| AC6.3 | Story data extracted with correct structure | storyId, epicNumber, storyNumber, slug, status fields populated |
| AC6.4 | currentEpic calculated as highest epic with non-done stories | Epic 4 with in-progress stories → currentEpic=4 |
| AC6.5 | currentStory calculated as first non-done story in current epic | Stories 4-1 to 4-12 done, 4-13 drafted → currentStory="4-13" |
| AC6.6 | GET /api/sprint/status returns SprintStatus | API response matches SprintStatus interface |
| AC6.7 | sprint.updated WebSocket broadcast on file change | File change → message broadcast within 1 second |
| AC6.8 | Story artifact path derived correctly | drafted+ → {storyKey}.md exists check |
| AC6.9 | Context artifact path derived correctly | ready-for-dev+ → {storyKey}.context.xml exists check |
| AC6.10 | Epic tech spec path derived correctly | contexted → tech-spec-epic-{N}.md exists check |
| AC6.11 | Retrospective path derived correctly | retrospective=completed → epic-{N}-retrospective.md exists check |
| AC6.12 | Artifact existence verified before including | exists: boolean field accurate for each artifact |
| AC6.13 | Sprint Tracker displays epic header with progress | "Epic 4: Production Stability [15/19 stories]" format |
| AC6.14 | Status icons rendered correctly | ✓=done(green), ◉=review(yellow), →=in-progress(cyan), ○=drafted(gray), ·=backlog(dim) |
| AC6.15 | Current story highlighted | First non-done story has distinct background color |
| AC6.16 | Progress bar shows completion ratio | Visual bar at completedCount/totalCount |
| AC6.17 | Story row click expands to show artifacts | Click toggles artifact list visibility |
| AC6.18 | Real-time updates via WebSocket | sprint.updated → UI re-renders with new status |
| AC6.19 | Artifacts displayed nested under story | Tree-like indentation with icons per file type |
| AC6.20 | [View] button opens artifact in ArtifactViewer | Click → setSelectedFile() → ArtifactViewer displays |
| AC6.21 | Missing artifacts shown grayed with "(missing)" | exists: false → gray text, "(missing)" label |
| AC6.22 | Phase artifacts displayed correctly | Phase steps with file paths show artifact links |
| AC6.23 | [▶ Context] button for drafted status | Button visible, sends story-context command |
| AC6.24 | [▶ Start] button for ready-for-dev status | Button visible, sends dev-story command |
| AC6.25 | [▶ Review] button for review status | Button visible, sends code-review command |
| AC6.26 | No button for backlog/done status | Backlog shows nothing, done shows "✓ Done" disabled |
| AC6.27 | Command sent to active session terminal | WebSocket terminal.input with correct command string |
| AC6.28 | Terminal focused after command execution | Layout shifts to terminal-dominant or terminal area focused |
| AC6.29 | Phase sections collapsible | Click header toggles expand/collapse |
| AC6.30 | Collapse state persists to localStorage | Reload preserves collapsed sections |
| AC6.31 | Implementation section expanded by default | Current epic's story list visible on load |
| AC6.32 | Skipped steps shown with strikethrough | ⊘ icon, gray strikethrough text |
| AC6.33 | Completed phases show checkmark | Green ✓ in collapsed phase header |
| AC6.34 | Epic selector dropdown visible in header | "Implementation - [Epic 4 ▾]" format |
| AC6.35 | All epics listed in dropdown | Epic 1-N with completion status indicators |
| AC6.36 | Epic selection switches story list | Select Epic 2 → shows Epic 2 stories |
| AC6.37 | Current epic marked with ◉ | In-progress epic distinct from completed (✓) and backlog (·) |
| AC6.38 | Epic artifacts shown under epic header | Tech spec, retrospective when expanded |
| AC6.39 | Sprint Tracker is default workflow view | First load shows Sprint Tracker, not swim lane |
| AC6.40 | [Phases] button switches to swim lane | Click shows WorkflowDiagram component |
| AC6.41 | [Sprint] button returns to Sprint Tracker | Toggle back to SprintTracker component |
| AC6.42 | View preference persists | Reload preserves 'sprint' or 'phases' choice |
| AC6.43 | Sidebar compact view shows current story | "Epic 4 · Story 4-16 · review" format |
| AC6.44 | Sidebar action button executes workflow | [▶ Review] in sidebar sends same command |
| AC6.45 | [+ Create Next Story] shown when appropriate | All stories done/review → button appears |
| AC6.46 | Create story command sent | Button sends /bmad:bmm:workflows:create-story |
| AC6.47 | [+ Start Epic N+1] shown when epic complete | All done + retrospective → shows next epic button |
| AC6.48 | Epic context command sent | Button sends /bmad:bmm:workflows:epic-tech-context {N+1} |
| AC6.49 | Full workflow cycle validated | Context → Start → Review → Done via UI |
| AC6.50 | Real-time status updates during workflow | sprint-status.yaml changes reflected live |
| AC6.51 | Artifact view works during workflow | [View] opens generated files correctly |
| AC6.52 | Epic transition validated | Complete epic → start next epic via UI |

## Traceability Mapping

| AC | Epic Story | PRD FR | Spec Section | Component(s) | Test Idea |
|----|------------|--------|--------------|--------------|-----------|
| AC6.1-6.7 | 6.1 | FR37-38 | Data Models | statusParser.ts | Unit: Parse valid/invalid sprint YAML |
| AC6.8-6.12 | 6.2 | FR37 | Data Models | statusParser.ts | Unit: Artifact path derivation, existence |
| AC6.13-6.18 | 6.3 | FR38-41 | UI Components | SprintTracker.tsx | Unit: Render, icons, highlight, progress |
| AC6.19-6.22 | 6.4 | FR43-44 | UI Components | StoryRow.tsx | Unit: Expand, artifact display, View click |
| AC6.23-6.28 | 6.5 | FR42 | Workflows | SprintTracker.tsx, WebSocket | Integration: Button → command → terminal |
| AC6.29-6.33 | 6.6 | FR38-40 | UI Components | PhaseOverview.tsx | Unit: Collapse, persist, skipped styling |
| AC6.34-6.38 | 6.7 | - | UI Components | EpicSelector.tsx | Unit: Dropdown, selection, indicators |
| AC6.39-6.44 | 6.8 | FR38 | UI Components | WorkflowProgress.tsx, LayoutContext | Integration: View toggle, sidebar summary |
| AC6.45-6.48 | 6.9 | FR42 | Workflows | SprintTracker.tsx | Integration: Next action logic, commands |
| AC6.49-6.52 | 6.10 | Sprint Validation | Validation | All components | E2E: Full workflow execution cycle |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **sprint-status.yaml schema changes** | Parser breaks, UI shows stale data | Medium | Defensive parsing, validate expected fields, log unknown fields |
| **BMAD workflow doesn't update status file** | UI out of sync with actual progress | Low | Document expected BMAD behavior, manual refresh button |
| **Too many stories to display efficiently** | Slow render, poor UX | Low | Virtualize story list if >100 items, paginate by epic |
| **Action button command injection** | Security vulnerability | Low | Validate story IDs with strict alphanumeric-dash pattern |
| **Artifact path derivation incorrect** | Wrong files displayed or missing | Medium | Unit test all derivation rules, log path calculations |
| **Phase data format differs** | Collapsible phases don't render | Medium | Graceful degradation, hide phases section if parse fails |
| **Workflow execution conflicts with user typing** | Commands interleaved with user input | Low | Queue command until terminal idle, or confirm before send |

### Assumptions

- `sprint-status.yaml` follows the documented schema with `development_status` section
- Story IDs follow `{epicNum}-{storyNum}-{slug}` pattern consistently
- BMAD workflows update `sprint-status.yaml` after each step completion
- Users want Sprint Tracker as default view (validated by Epic 3 feedback)
- Maximum ~50 stories per epic (no virtualization needed initially)
- Active session is always available when user clicks action button (or toast if not)
- `bmm-workflow-status.yaml` follows documented schema for phase data

### Open Questions

| Question | Decision Owner | Status |
|----------|---------------|--------|
| Should sprint tracker persist selected epic across sessions? | Kyle | Proposed: Yes via localStorage |
| Should action buttons show confirmation dialog? | Kyle | Proposed: No, direct execution (faster) |
| Should we show story descriptions inline or only in artifact view? | Kyle | Proposed: Inline on expand |
| Should keyboard shortcut toggle Sprint/Phases view? | Kyle | TBD: Cmd+Shift+W or similar |
| How to handle multi-session with different epics? | Kyle | Decided: Workspace-global view, not session-specific |
| Should story row show last modified timestamp? | Kyle | TBD during implementation |

## Test Strategy Summary

### Test Levels

| Level | Framework | Scope | Coverage Target |
|-------|-----------|-------|-----------------|
| **Unit (Backend)** | Jest | statusParser sprint parsing, artifact path derivation | 70%+ |
| **Unit (Frontend)** | Vitest | SprintTracker, StoryRow, EpicSelector, PhaseOverview | 50%+ |
| **Integration** | Jest/Vitest | WebSocket sprint.updated flow, action button → terminal | Key flows |
| **E2E** | Playwright | Full workflow execution cycle through Sprint Tracker | 2-3 critical paths |

### Critical Test Cases

**Backend Unit Tests (statusParser.ts):**
- `parseSprintStatus`: Valid YAML → correct SprintStatus object
- `parseSprintStatus`: Missing development_status → empty result, no crash
- `parseSprintStatus`: Malformed YAML → null, warning logged
- `extractEpicData`: Epic entries parsed with all fields
- `extractStoryData`: Story entries parsed, sorted by storyNumber
- `deriveArtifactPath`: Story file path for each status level
- `deriveArtifactPath`: Context file path for ready-for-dev+
- `deriveArtifactPath`: Epic tech spec path for contexted
- `deriveArtifactPath`: Retrospective path for completed
- `checkArtifactExists`: Existing file → exists: true
- `checkArtifactExists`: Missing file → exists: false
- `calculateCurrentEpic`: Returns highest epic with non-done stories
- `calculateCurrentStory`: Returns first non-done story in current epic

**Frontend Unit Tests:**
- `SprintTracker`: Renders epic header with progress bar
- `SprintTracker`: Renders story list with correct icons per status
- `SprintTracker`: Highlights current story
- `SprintTracker`: Handles empty epics array gracefully
- `StoryRow`: Click expands/collapses artifact list
- `StoryRow`: Renders artifacts with correct icons
- `StoryRow`: [View] button calls setSelectedFile
- `StoryRow`: Missing artifact shows "(missing)" label
- `EpicSelector`: Dropdown lists all epics
- `EpicSelector`: Selection changes filters story list
- `EpicSelector`: Shows status indicators (✓, ◉, ·)
- `PhaseOverview`: Collapse/expand toggles
- `PhaseOverview`: Collapse state persists
- `ActionButton`: Renders correct label per status
- `ActionButton`: Click sends correct command
- `ActionButton`: Disabled for backlog/done status

**Integration Tests:**
- File watcher: sprint-status.yaml change → sprint.updated broadcast
- WebSocket: sprint.updated message → SprintContext state update
- API: GET /api/sprint/status → complete SprintStatus response
- Action button: Click → terminal.input WebSocket → command in terminal
- Artifact view: Click [View] → ArtifactViewer loads correct file

**E2E Tests (Playwright):**

1. **Sprint Tracker Load and Display**
   - Navigate to app → Sprint Tracker visible as default
   - Current epic expanded with stories
   - Progress bar shows correct completion ratio
   - Status icons match sprint-status.yaml

2. **Story Workflow Execution**
   - Find drafted story → Click [▶ Context]
   - Verify command sent to terminal
   - Wait for status update → Story now ready-for-dev
   - Click [▶ Start] → dev-story command sent
   - Complete story → status shows done

3. **Epic Navigation and View Toggle**
   - Click epic selector → Change to different epic
   - Verify story list updates
   - Click [Phases] → Swim lane diagram shows
   - Click [Sprint] → Sprint Tracker returns
   - Reload → Preferences preserved

### Test Data Fixtures

```yaml
# test/fixtures/sprint-status-basic.yaml
project_name: test-project
current_sprint: 1

development_status:
  epic-1: contexted
  1-1-basic-setup: done
  1-2-terminal-component: done
  epic-2: contexted
  2-1-first-feature: in-progress
  2-2-second-feature: drafted
  2-3-third-feature: backlog
```

```yaml
# test/fixtures/sprint-status-complete.yaml
development_status:
  epic-1: contexted
  epic-1-retrospective: completed
  1-1-setup: done
  1-2-component: done
  epic-2: backlog
```
