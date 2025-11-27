# Epic Technical Specification: Workflow Visibility & Document Review

Date: 2025-11-25
Author: Kyle
Epic ID: 3
Status: Draft

---

## Overview

Epic 3 delivers real-time visibility into BMAD workflow progress and generated artifacts through the browser interface. Building upon the session management infrastructure from Epic 2, this epic adds a comprehensive document review system that allows developers to monitor Claude's progress through the BMAD workflow steps, browse workspace files in a hierarchical tree, view rendered markdown documents with syntax highlighting, and see diffs of document changes—all without leaving the browser.

The primary value proposition is enabling developers to manage 4 parallel sessions at a glance: understanding where each Claude instance is in the BMAD process (brainstorming → PRD → architecture → stories), reviewing generated artifacts immediately as they're created, and providing contextual feedback through the always-visible terminal panel.

## Objectives and Scope

### In-Scope

- **BMAD Status Parsing**: Backend module (`statusParser.ts`) using js-yaml to parse `/workspace/.bmad/bmm/status/*.yaml` files and extract workflow step information
- **Workflow Progress UI**: Compact linear view component showing completed (✓), current (→), and pending (○) steps with Oceanic Calm color scheme
- **Left Sidebar with Toggle**: Dual-view sidebar (280px default, resizable 200-400px) switching between Files and Workflow views via tabs or Cmd+W keyboard shortcut
- **File Tree Navigation**: Hierarchical tree view of workspace documents with folder expand/collapse, file selection, and real-time updates via chokidar file watcher
- **Artifact Viewer**: Markdown rendering with react-markdown, remark-gfm (GFM tables/task lists), and rehype-highlight (syntax highlighting)
- **Context-Aware Layout Shifting**: Automatic layout transition from terminal-dominant (100%) to artifact-dominant (70/30 split) when Claude writes documents
- **Diff View**: Show changes since last viewed with color-coded additions (green) and deletions (red), localStorage-based tracking
- **Resizable Panels**: Draggable panel dividers with constraints (min/max widths), size persistence to localStorage
- **Top Bar Enhancement**: Logo, "+ New Session" button, global STOP button, Settings dropdown with "Update BMAD" action
- **Empty State UI**: Welcoming first-time user experience when no sessions exist
- **Browser Notification Permission**: Prompt for notification permission on first load (notifications implemented in Epic 4)

### Out-of-Scope

- Interactive workflow diagram (Epic 3 uses compact linear list only; diagram is optional enhancement)
- Browser notification sending (permission setup only—actual notifications deferred to Epic 4 Story 4.3)
- Cloud deployment or remote access features
- Multi-user authentication or session sharing
- Mobile responsive layout (desktop-only tool)
- Real-time collaborative editing of documents

## System Architecture Alignment

This epic aligns with the architecture decisions established in `docs/architecture.md` and `docs/architecture-decisions.md`:

| Architecture Component | Epic 3 Implementation |
|------------------------|----------------------|
| **File Watching (ADR-006)** | Chokidar watches `/workspace/**/*.md` and `/workspace/.bmad/bmm/status/*.yaml` for changes, 500ms debounce |
| **Markdown Rendering (ADR-007, ADR-011)** | react-markdown with remark-gfm + rehype-highlight plugins for safe rendering |
| **WebSocket Protocol** | New message types: `workflow.updated`, `file.changed`, `layout.shift` |
| **React Context API (ADR-005)** | New contexts: WorkflowContext (workflow state), LayoutContext extended (sidebar/layout modes) |
| **Session State Model** | Session entity extended with optional `currentPhase` field for BMAD step tracking |
| **UI Component Library** | shadcn/ui components: Tabs (sidebar toggle), Resizable (panel handles), Dropdown (settings menu) |

**Constraints from Architecture:**
- Must maintain <100ms WebSocket message latency for file change events
- Tab switching must complete in <50ms
- Layout animations must use CSS transitions (350ms ease-out)
- Virtual scrolling required for file trees with 1000+ files

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs |
|--------|---------------|--------|---------|
| `statusParser.ts` | Parse BMAD YAML status files, extract workflow step info | YAML file content | `WorkflowState` object |
| `fileWatcher.ts` (extended) | Watch workspace for markdown and YAML changes | File system events | WebSocket `file.changed` messages |
| `WorkflowProgress.tsx` | Display compact linear workflow step list | `WorkflowState` from context | Rendered list with status indicators |
| `FileTree.tsx` | Hierarchical file browser with expand/collapse | File tree data from backend | Interactive tree UI |
| `ArtifactViewer.tsx` | Render markdown with syntax highlighting | File content string | Rendered React components |
| `LayoutContext.tsx` | Manage layout modes (terminal/artifact/split) | Layout change events | Layout state for consumers |

### Data Models and Contracts

**WorkflowState (Backend → Frontend)**
```typescript
interface WorkflowState {
  currentStep: string;                    // e.g., "prd_creation"
  completedSteps: string[];               // ["brainstorming", "product_brief"]
  steps: WorkflowStep[];                  // Full step list with status
}

interface WorkflowStep {
  name: string;                           // Step identifier
  status: 'completed' | 'in_progress' | 'pending';
  displayName?: string;                   // Human-readable name
}
```

**FileTreeNode (Backend → Frontend)**
```typescript
interface FileTreeNode {
  name: string;                           // File/folder name
  path: string;                           // Absolute path
  type: 'file' | 'directory';
  children?: FileTreeNode[];              // Only for directories
  lastModified: string;                   // ISO 8601 timestamp
}
```

**LayoutState (Frontend Context)**
```typescript
interface LayoutState {
  leftSidebarView: 'files' | 'workflow';
  leftSidebarWidth: number;               // 200-400px
  rightSidebarWidth: number;              // 200-400px
  mainContentMode: 'terminal' | 'artifact' | 'split';
  splitRatio: number;                     // 0.3-0.7 (artifact/terminal)
  isLeftCollapsed: boolean;
  isRightCollapsed: boolean;
}
```

**DiffCache (localStorage)**
```typescript
interface DiffCacheEntry {
  filePath: string;
  lastViewedContent: string;
  lastViewedAt: string;                   // ISO 8601 timestamp
}
```

### APIs and Interfaces

**New WebSocket Message Types (Server → Client)**

```typescript
// Workflow status update
{
  type: 'workflow.updated',
  sessionId: string,
  workflow: WorkflowState
}

// File system change notification
{
  type: 'file.changed',
  path: string,
  event: 'add' | 'change' | 'unlink',
  timestamp: string
}

// Layout shift suggestion (auto-triggered on document write)
{
  type: 'layout.shift',
  mode: 'terminal' | 'artifact' | 'split',
  trigger: 'file_write' | 'user_input'
}
```

**New REST Endpoints**

```typescript
// GET /api/workflow/status?sessionId=<id>
// Returns workflow state for specific session
Response: { workflow: WorkflowState }

// GET /api/documents/tree
// Returns file tree structure for workspace
Response: { tree: FileTreeNode[] }

// GET /api/documents/:path
// Returns file content
Response: string (text/plain for markdown)

// POST /api/bmad/update
// Triggers npx bmad-method install
Response: { success: boolean, message: string }
```

### Workflows and Sequencing

**Document Review Flow (Journey 4 from UX Spec)**

```
1. Claude writes document (e.g., prd.md)
   ↓
2. Chokidar detects file write event
   ↓
3. Backend sends WebSocket messages:
   - file.changed { path: '/workspace/docs/prd.md', event: 'add' }
   - layout.shift { mode: 'artifact' }
   ↓
4. Frontend updates:
   - FileTree re-renders with new file
   - Layout animates to artifact-dominant (70/30)
   - ArtifactViewer auto-opens with prd.md
   ↓
5. User reviews rendered markdown
   ↓
6. User types feedback in terminal (30% bottom)
   ↓
7. Claude updates document
   ↓
8. file.changed { event: 'change' } triggers diff indicator
   ↓
9. User clicks "Show Diff" to see changes
```

**Workflow Progress Update Flow**

```
1. Claude advances BMAD workflow step
   ↓
2. BMAD updates /workspace/.bmad/bmm/status/bmm-workflow-status.yaml
   ↓
3. Chokidar detects YAML change (500ms debounce)
   ↓
4. statusParser.ts parses new YAML content
   ↓
5. Backend sends workflow.updated WebSocket message
   ↓
6. WorkflowContext updates state
   ↓
7. WorkflowProgress.tsx re-renders with new current step
   ↓
8. Previous step changes from → to ✓
   ↓
9. Current step auto-scrolls into view
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Validation |
|-------------|--------|------------|
| **NFR-PERF-2 (from PRD)** | Tab switching <50ms | Measure sidebar toggle latency |
| **File tree rendering** | <100ms for 500 files | Virtual scrolling for large trees |
| **Markdown rendering** | <500ms for 100KB file | Lazy loading for large documents |
| **Layout animation** | 350ms CSS transition | No JavaScript-based animation |
| **File change notification** | <200ms end-to-end | Chokidar event to UI update |

**Implementation Notes:**
- Virtual scrolling for file trees using react-window or similar
- Debounce file watcher events (500ms) to batch rapid updates
- Lazy load ArtifactViewer and WorkflowDiagram components with React.lazy()

### Security

| Requirement | Implementation |
|-------------|----------------|
| **XSS Prevention (NFR-SEC)** | react-markdown is safe by default; no dangerouslySetInnerHTML |
| **Path Traversal Prevention** | All file operations validate paths start with `/workspace/` |
| **File Content Security** | Backend validates file type before serving; reject non-text files for document viewer |

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| **Graceful Degradation (NFR-REL-4)** | If workflow parsing fails, show "Status unavailable" instead of crashing |
| **File Watcher Recovery** | If chokidar errors, log warning and continue (non-critical feature) |
| **Diff Cache Resilience** | If localStorage corrupted, reset cache silently |

### Observability

| Signal | Purpose |
|--------|---------|
| `log.info('Workflow step changed', { sessionId, from, to })` | Track BMAD progress |
| `log.info('File changed', { path, event })` | Track artifact generation |
| `log.warn('BMAD status file invalid', { error })` | Debug parsing issues |
| `log.info('Layout shifted', { mode, trigger })` | Track UX pattern usage |

## Dependencies and Integrations

### NPM Dependencies (Backend - additions to Epic 1/2)

| Package | Version | Purpose |
|---------|---------|---------|
| `js-yaml` | ^4.x | YAML parsing for BMAD status files (already in architecture spec) |
| `chokidar` | ^4.x | File system watching (already in architecture spec) |

### NPM Dependencies (Frontend - additions)

| Package | Version | Purpose |
|---------|---------|---------|
| `react-markdown` | ^9.x | Safe markdown rendering |
| `remark-gfm` | ^4.x | GitHub Flavored Markdown support |
| `rehype-highlight` | ^7.x | Syntax highlighting for code blocks |
| `highlight.js` | ^11.x | Syntax highlighting themes (Oceanic Calm custom CSS) |
| `diff` | ^5.x | Line-by-line diff calculation for diff view |
| `react-window` | ^1.x | Virtual scrolling for large file trees (optional) |

### Integration Points

| System | Integration |
|--------|-------------|
| **BMAD Method** | Reads workflow status from `.bmad/bmm/status/bmm-workflow-status.yaml` |
| **Epic 2 Sessions** | Each session may have independent workflow state and worktree files |
| **Epic 1 Terminal** | Terminal remains visible at 30% in artifact-dominant mode |
| **shadcn/ui** | New components: Tabs, Resizable, DropdownMenu |

## Acceptance Criteria (Authoritative)

| AC# | Criteria | Testable Condition |
|-----|----------|-------------------|
| AC3.1 | BMAD YAML parser extracts workflow state | Given valid YAML, parser returns currentStep, completedSteps, steps array |
| AC3.2 | Invalid YAML handled gracefully | Given malformed YAML, parser returns null without throwing |
| AC3.3 | Workflow progress shows correct indicators | Completed=✓ (green), Current=→ (blue), Pending=○ (gray) |
| AC3.4 | Workflow updates in real-time | When YAML changes, UI updates within 1 second |
| AC3.5 | Sidebar toggles between Files/Workflow | Click or Cmd+W switches views <50ms |
| AC3.6 | File tree displays workspace hierarchy | Folders expand/collapse, files selectable |
| AC3.7 | File tree updates on new files | Chokidar event triggers tree re-render |
| AC3.8 | Artifact viewer renders markdown | Tables, code blocks, headings rendered correctly |
| AC3.9 | Code syntax highlighting works | Language-specific highlighting for code blocks |
| AC3.10 | Layout auto-shifts on document write | File write triggers 70/30 split animation |
| AC3.11 | Manual layout override works | Cmd+T for terminal-dominant, Cmd+A for artifact |
| AC3.12 | Diff view shows additions/deletions | Green for added, red for deleted lines |
| AC3.13 | Diff tracks "last viewed" timestamp | Reopening file updates timestamp, new diffs calculated |
| AC3.14 | Panels resizable with constraints | Left sidebar: 200-400px, right: 200-400px |
| AC3.15 | Panel sizes persist | Reload preserves sizes from localStorage |
| AC3.16 | Top bar STOP button sends interrupt | Click triggers SIGINT to active session |
| AC3.17 | "Update BMAD" executes npm command | POST /api/bmad/update runs `npx bmad-method install` |
| AC3.18 | Empty state shows on first load | No sessions → welcoming empty state with Create button |
| AC3.19 | Notification permission requested | First load shows permission banner if not granted |
| AC3.20 | 4 sessions monitored at a glance | PRD Sprint 3 success criteria met |

## Traceability Mapping

| AC | PRD FR/NFR | Spec Section | Component(s) | Test Idea |
|----|------------|--------------|--------------|-----------|
| AC3.1 | FR37 | Data Models | statusParser.ts | Unit: Parse valid YAML |
| AC3.2 | FR37 | Data Models | statusParser.ts | Unit: Parse invalid YAML returns null |
| AC3.3 | FR39-41 | UI Components | WorkflowProgress.tsx | Visual: Check indicator symbols/colors |
| AC3.4 | FR37-38 | Workflows | statusParser + WebSocket | Integration: File change → UI update |
| AC3.5 | - | UI Components | LeftSidebar.tsx | Unit: Toggle state, keyboard shortcut |
| AC3.6 | FR43-44 | UI Components | FileTree.tsx | Unit: Expand/collapse, click handler |
| AC3.7 | FR43 | Workflows | fileWatcher + FileTree | Integration: Create file → tree updates |
| AC3.8 | FR45 | UI Components | ArtifactViewer.tsx | Visual: Render sample markdown |
| AC3.9 | FR45 | UI Components | ArtifactViewer.tsx | Visual: Code block highlighting |
| AC3.10 | - | Workflows | LayoutContext + fileWatcher | Integration: File write → layout shift |
| AC3.11 | - | UI Components | LayoutContext | Unit: Keyboard shortcuts change mode |
| AC3.12 | FR46-47 | UI Components | DiffView.tsx | Unit: Diff calculation correct |
| AC3.13 | FR47 | Data Models | localStorage cache | Unit: Timestamp updates on view |
| AC3.14 | - | UI Components | ResizablePanels | E2E: Drag handles, respect min/max |
| AC3.15 | - | State | localStorage | Unit: Save/restore panel sizes |
| AC3.16 | FR27 | APIs | TopBar + WebSocket | Integration: Click → SIGINT sent |
| AC3.17 | FR5 | APIs | POST /api/bmad/update | Integration: Command executes |
| AC3.18 | - | UI Components | EmptyState.tsx | Visual: No sessions shows empty state |
| AC3.19 | FR49 (prep) | UI Components | NotificationBanner | Unit: Permission check + request |
| AC3.20 | Sprint 3 Success | Validation | All components | E2E: Multi-session workflow |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **BMAD YAML schema changes** | Parser breaks | Medium | Defensive parsing, log warnings on unknown fields |
| **Large markdown files (>500KB)** | Slow rendering | Low | Lazy loading, chunked rendering if needed |
| **File watcher misses events** | UI out of sync | Low | Periodic polling fallback (every 30s) |
| **Layout shift UX confusion** | User frustration | Medium | Clear manual override controls (Cmd+T/A) |

### Assumptions

- BMAD status files follow a consistent schema (steps array, current_phase field)
- Workspace markdown files are reasonable size (<500KB typically)
- Users have modern browsers (Chrome/Firefox/Safari/Edge latest 2 versions)
- Desktop resolution minimum 1280x720 (per PRD)

### Open Questions

| Question | Decision Owner | Resolution Date |
|----------|---------------|-----------------|
| Should workflow diagram be interactive SVG or just compact list? | Kyle | Decided: Compact list for Epic 3, diagram optional |
| Should diff view use unified or side-by-side format? | Kyle | TBD during implementation |
| Should file tree show all files or filter to .md only? | Kyle | TBD during implementation |

## Test Strategy Summary

### Test Levels

| Level | Framework | Scope | Coverage Target |
|-------|-----------|-------|-----------------|
| **Unit (Backend)** | Jest | statusParser, fileWatcher extensions | 70%+ |
| **Unit (Frontend)** | Vitest | WorkflowProgress, FileTree, ArtifactViewer, DiffView | 50%+ |
| **Integration** | Jest/Vitest | WebSocket message flow, file → UI updates | Key flows |
| **E2E** | Playwright | Document review journey, multi-session monitoring | 3-5 critical flows |

### Critical Test Cases

**Backend Unit Tests:**
- statusParser: Valid YAML → correct WorkflowState
- statusParser: Invalid YAML → null without crash
- statusParser: Missing fields → partial state with defaults
- fileWatcher: Debounce batches rapid events

**Frontend Unit Tests:**
- WorkflowProgress: Renders correct indicators per status
- FileTree: Expand/collapse folder state
- FileTree: Click file triggers callback
- ArtifactViewer: Markdown renders tables correctly
- ArtifactViewer: Code blocks have syntax highlighting
- DiffView: Calculates additions/deletions correctly

**Integration Tests:**
- File write → file.changed WebSocket → FileTree update
- YAML change → workflow.updated WebSocket → WorkflowProgress update
- Click file in tree → ArtifactViewer loads content

**E2E Tests (Playwright):**
1. **Document review flow**: Session runs → creates PRD → layout shifts → user views artifact
2. **Multi-session monitoring**: 2 sessions active → switch between them → each shows correct files
3. **Diff view workflow**: Claude updates document → user clicks diff → sees changes
