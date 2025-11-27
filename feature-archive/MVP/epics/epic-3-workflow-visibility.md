## Epic 3: Workflow Visibility & Document Review

**Goal:** Provide real-time visibility into BMAD workflow progress and generated artifacts without leaving the browser

**User Value:** Developers can monitor multiple sessions at a glance and review generated documents (PRDs, architecture, code) in-context

**FR Coverage:** FR37-FR48 (12 FRs)

### Story 3.1: BMAD Workflow Status YAML Parser

As a developer,
I want the backend to parse BMAD workflow status files and extract current step information,
So that the UI can visualize where Claude is in the BMAD process (FR37).

**Acceptance Criteria:**

**Given** a `statusParser.ts` backend module using js-yaml library
**When** a BMAD workflow status file exists at `/workspace/.bmad/bmm/status/bmm-workflow-status.yaml` with content:
```yaml
current_phase: prd_creation
completed_steps:
  - brainstorming
  - product_brief
steps:
  - name: brainstorming
    status: completed
  - name: product_brief
    status: completed
  - name: prd_creation
    status: in_progress
  - name: architecture
    status: pending
```
**Then** the parser extracts:
- `currentStep`: "prd_creation"
- `completedSteps`: ["brainstorming", "product_brief"]
- `steps`: Array of step objects with name and status

**And** when the file doesn't exist or is invalid YAML
**Then** the parser returns null without crashing

**And** logs a warning: "BMAD status file not found or invalid"

**And** when the file changes (Claude updates workflow progress)
**Then** the chokidar file watcher detects the change

**And** the backend parses the updated file

**And** sends WebSocket message:
```json
{ "type": "workflow.updated", "sessionId": "<id>", "workflow": { currentStep, completedSteps, steps } }
```

**Prerequisites:** Epic 1 (Backend infrastructure), Epic 2 (Sessions)

**Technical Notes:**
- js-yaml library for YAML parsing (Architecture decision)
- Chokidar watches `/workspace/.bmad/bmm/status/*.yaml` for changes
- Parse on file change, debounce 500ms to batch rapid updates
- BMAD status file schema may vary - parser must be defensive
- Reference: Architecture "BMAD Workflow State" section

---

### Story 3.2: Workflow Progress Component (Compact Linear View)

As a developer,
I want to see BMAD workflow progress in a compact list showing current step,
So that I know where Claude is in the process at a glance (FR38-FR41).

**Acceptance Criteria:**

**Given** a `WorkflowProgress.tsx` component
**When** the workflow state is:
- Current step: "prd_creation"
- Completed: ["brainstorming", "product_brief"]
- Pending: ["architecture", "ux_design", "epic_planning"]

**Then** the component displays a vertical list:
```
✓ Brainstorming        (green #A3BE8C)
✓ Product Brief       (green #A3BE8C)
→ PRD Creation         (blue #88C0D0, highlighted background)
○ Architecture         (gray #4C566A)
○ UX Design            (gray #4C566A)
○ Epic Planning        (gray #4C566A)
```

**And** the current step has:
- Arrow indicator (→)
- Blue color (#88C0D0)
- Subtle highlighted background (#434C5E)
- Auto-scroll to keep visible

**And** when the workflow step changes (WebSocket `workflow.updated` message)
**Then** the list updates in real-time

**And** the previous step changes to checkmark (✓)

**And** the new current step shows arrow (→) and highlighting

**And** when the user hovers over a step
**Then** a tooltip shows step description (optional enhancement)

**Prerequisites:** Story 3.1 (Parser), Epic 2 (Sessions)

**Technical Notes:**
- Component per UX spec "Workflow Progress Component" section 6.1
- Status indicators: ✓ (completed), → (current), ○ (pending) per FR39-FR41
- Colors from Oceanic Calm palette (UX spec 3.1)
- WorkflowContext provides workflow state, updates trigger re-render
- Auto-scroll: `scrollIntoView({ behavior: 'smooth' })` on current step
- Reference: UX spec "Journey 5: Development Phase with Story Progress"

---

### Story 3.3: Left Sidebar with Files/Workflow Toggle

As a developer,
I want a left sidebar that toggles between file tree and workflow diagram views,
So that I can access both generated artifacts and process visualization (UX spec requirement).

**Acceptance Criteria:**

**Given** a left sidebar component (280px wide, resizable 200-400px)
**When** the UI loads
**Then** the sidebar displays:
- Tab bar at top with two buttons: "Files" | "Workflow"
- Default view: "Files" tab active
- Toggle via click or keyboard shortcut Cmd+W

**And** when "Files" tab is active
**Then** the sidebar shows a file tree of workspace documents (Story 3.4)

**And** when "Workflow" tab is active
**Then** the sidebar shows the BMAD workflow diagram (Story 3.5)

**And** when the user clicks "Files"
**Then** the view switches to file tree within 50ms

**And** when the user presses Cmd+W (macOS) or Ctrl+W (Windows/Linux)
**Then** the sidebar toggles between Files and Workflow views

**And** the last active view is remembered per session (localStorage)

**And** when the sidebar is collapsed (via collapse button)
**Then** it shows a 40px wide bar with rotate icon/text

**And** clicking the collapsed bar expands it back to previous width

**Prerequisites:** Epic 1 (Frontend setup), Epic 2 (Sessions)

**Technical Notes:**
- Toggle buttons using shadcn/ui tabs with Oceanic Calm styling
- Two separate components: FileTree and WorkflowDiagram (lazy loaded)
- State: LayoutContext tracks `leftSidebarView: 'files' | 'workflow'`
- Keyboard shortcut: Global event listener, check active element not input
- Collapse/expand: CSS transition 300ms, state persisted to localStorage
- Reference: UX spec "Left Sidebar Views" section 4.1

---

### Story 3.4: File Tree Component with Workspace Navigation

As a developer,
I want to browse generated documents in a hierarchical tree view,
So that I can find and open PRDs, architecture docs, epics, and stories (FR43-FR44).

**Acceptance Criteria:**

**Given** a `FileTree.tsx` component in the left sidebar
**When** the workspace contains:
```
/workspace/
  docs/
    prd.md
    architecture.md
    ux-design-specification.md
    epics.md
  stories/
    story-1.1.md
    story-1.2.md
  src/
    index.ts
```
**Then** the file tree displays:
```
📁 docs
  📄 prd.md
  📄 architecture.md
  📄 ux-design-specification.md
  📄 epics.md
📁 stories
  📄 story-1.1.md
  📄 story-1.2.md
📁 src
  📄 index.ts
```

**And** folders start collapsed, click to expand/collapse

**And** when a new file is created in the workspace
**Then** the chokidar file watcher detects it (backend sends `file.changed` WebSocket message)

**And** the file tree updates automatically to show the new file

**And** when the user clicks a markdown file (e.g., "prd.md")
**Then** the artifact viewer opens (Story 3.5) displaying the rendered markdown

**And** the clicked file highlights in the tree (active state)

**And** when the user types in a search box (optional enhancement)
**Then** the tree filters to show only matching files

**Prerequisites:** Story 3.3 (Left sidebar), Epic 2 (Sessions)

**Technical Notes:**
- File tree uses recursive component pattern for nested folders
- Icons: Lucide React icons (folder, file-text) per UX spec
- File watching: Chokidar on backend watches `/workspace/**/*.md` (Architecture decision)
- Lazy loading: Only load visible nodes, virtual scrolling for 1000+ files
- Click handler: Sets `activeFile` state, triggers artifact viewer
- Reference: UX spec "File Tree Component" section 6.1 and "Journey 4: Reviewing Generated Artifacts"

---

### Story 3.5: Artifact Viewer with Markdown Rendering

As a developer,
I want to view markdown documents rendered in the browser with syntax highlighting,
So that I can review PRDs, architecture docs, and code snippets without leaving the UI (FR45).

**Acceptance Criteria:**

**Given** an `ArtifactViewer.tsx` component
**When** the user clicks "prd.md" in the file tree
**Then** the main content area displays the rendered markdown:
- GitHub Flavored Markdown support (tables, task lists, strikethrough via remark-gfm)
- Code blocks with syntax highlighting (rehype-highlight)
- Headings, lists, links, images all rendered correctly
- Oceanic Calm code theme (background `#2E3440`, syntax colors match terminal)

**And** when the markdown contains a table
**Then** the table renders with proper borders and cell padding

**And** when the markdown contains code blocks:
```python
def hello():
    print("Hello")
```
**Then** the code is syntax highlighted based on language (python, typescript, bash, etc.)

**And** when the file updates (Claude modifies it)
**Then** the chokidar watcher detects the change

**And** the artifact viewer auto-refreshes to show updated content

**And** the scroll position is preserved (unless user manually scrolled away)

**And** when the user clicks "Close" or selects a different file
**Then** the artifact viewer closes or switches to the new file

**Prerequisites:** Story 3.4 (File tree), Story 3.1 (File watching)

**Technical Notes:**
- react-markdown for rendering (Architecture ADR-007)
- Plugins: remark-gfm (GFM support), rehype-highlight (syntax highlighting)
- Code theme: highlight.js Oceanic Calm CSS (custom or closest match)
- Auto-refresh: File change event triggers content reload
- Scroll position: Track `scrollTop` in state, restore after re-render
- Reference: UX spec "Artifact Viewer Component" section 6.1 and Architecture ADR-011

---

### Story 3.6: Context-Aware Layout Shifting (Terminal ↔ Artifacts)

As a developer,
I want the layout to automatically shift focus between terminal and artifacts based on workflow phase,
So that I see the right content at the right time (UX spec novel pattern).

**Acceptance Criteria:**

**Given** the main content area with flexible layout
**When** Claude is in a conversational phase (brainstorming, asking questions)
**Then** the layout is "terminal-dominant":
- Terminal: 100% of main area
- Artifacts: Hidden or minimized

**And** when Claude writes a document (e.g., prd.md)
**Then** the backend detects file write event

**And** sends layout shift signal: `{ type: 'layout.shift', mode: 'artifact-dominant' }`

**And** the layout animates to "artifact-dominant" over 350ms:
- Terminal: 30% of height (bottom, still visible)
- Artifacts: 70% of height (top, rendered markdown)

**And** when the user types in the terminal (providing feedback)
**Then** the layout remains artifact-dominant (terminal still usable)

**And** when the user clicks "Focus Terminal" button (Cmd+T)
**Then** the layout manually shifts to terminal-dominant (100% terminal)

**And** the auto-shift is paused until next file write

**And** when the user clicks "Focus Artifacts" button (Cmd+A)
**Then** the layout shifts to artifact-dominant (70/30 split)

**And** when the user drags the resize handle
**Then** the layout uses custom split (e.g., 50/50)

**And** the custom size is persisted until next auto-shift

**Prerequisites:** Story 3.5 (Artifact viewer), Epic 1 Story 1.8 (Terminal)

**Technical Notes:**
- UX pattern per "Context-Aware Focus Shifting" section 2.3
- Layout modes: 'terminal', 'artifact', 'split' (stored in LayoutContext)
- Auto-detect: File write events for *.md in docs/ folder trigger shift
- Manual override: Quick-access buttons in content header
- Animation: CSS transition `height 350ms ease-out` on flex containers
- Resize handle: shadcn/ui Resizable component
- Reference: UX spec sections 2.3, 4.1, and "Journey 4"

---

### Story 3.7: Diff View for Document Changes

As a developer,
I want to see what changed in a document since I last viewed it,
So that I can quickly review Claude's updates without reading the entire file (FR46-FR47).

**Acceptance Criteria:**

**Given** the artifact viewer is displaying "prd.md"
**When** Claude modifies the PRD and saves it
**Then** the artifact viewer shows an indicator: "Document updated" (blue badge)

**And** a toggle button appears: "Show Diff"

**And** when the user clicks "Show Diff"
**Then** the view switches to diff mode showing:
- Deleted lines: Red background (#BF616A with 20% opacity), strikethrough text
- Added lines: Green background (#A3BE8C with 20% opacity)
- Unchanged lines: Normal rendering (context)
- Line numbers on the left (optional)

**And** when the user clicks "Hide Diff" or "Show Current"
**Then** the view switches back to full rendered markdown

**And** when the user closes the file and reopens it later
**Then** the "last viewed" timestamp updates

**And** subsequent diffs show changes since this new timestamp

**And** the diff data is stored in localStorage per file path and session

**Prerequisites:** Story 3.5 (Artifact viewer), Story 3.1 (File watching)

**Technical Notes:**
- Diff calculation: Compare current file content with cached "last viewed" version
- Algorithm: Use `diff` library (e.g., `diff` npm package) for line-by-line comparison
- Cache: localStorage stores `{ filePath: { lastViewedContent, timestamp } }`
- UI: Toggle button in artifact viewer header
- Diff rendering: Custom React component overlays on markdown renderer
- Colors: Oceanic Calm error (red) and success (green) per UX spec
- Reference: PRD FR46-FR47 and UX spec "Journey 4: Reviewing Generated Artifacts"

---

### Story 3.8: Resizable Panel Handles for Layout Customization

As a developer,
I want to resize panels (sidebar, terminal, artifacts) by dragging handles,
So that I can customize the layout to my preference (UX spec requirement).

**Acceptance Criteria:**

**Given** the three-panel layout (left sidebar, main content, right sidebar)
**When** the user hovers over the panel divider (4px wide vertical bar)
**Then** the cursor changes to resize cursor (↔)

**And** the divider highlights with blue color (#88C0D0)

**And** when the user drags the divider left/right
**Then** the panels resize in real-time (smooth, no lag)

**And** the new sizes are constrained:
- Left sidebar: Min 200px, max 400px
- Right sidebar: Min 200px, max 400px
- Main content: Always flexible, gets remaining space

**And** when the user releases the mouse
**Then** the panel sizes are persisted to localStorage per session

**And** when the user double-clicks the resize handle
**Then** the panels reset to default sizes (280px left, 260px right)

**And** when the main content is in split mode (terminal + artifacts)
**Then** a horizontal resize handle allows adjusting the 70/30 split

**And** the split ratio is constrained: Min 30% each panel

**Prerequisites:** Story 3.3 (Sidebars exist), Story 3.6 (Split layout)

**Technical Notes:**
- shadcn/ui Resizable component for resize handles
- Drag interaction: Track mouse position, calculate delta, update CSS flex-basis
- Constraints enforced in drag handler: `Math.max(minWidth, Math.min(maxWidth, newWidth))`
- Persistence: localStorage `{ sessionId: { leftSidebarWidth, rightSidebarWidth, splitRatio } }`
- Keyboard resize: Ctrl+Arrow keys move 10px increments (accessibility)
- Reference: UX spec "Panel Resize Handle Component" section 6.1 and "Navigation Patterns" 7.5

---

### Story 3.9: Top Bar with Actions and Session Controls

As a developer,
I want a top bar with logo, new session button, STOP button, and settings,
So that I have quick access to core actions (UX spec requirement).

**Acceptance Criteria:**

**Given** the top bar component (56px height, background #3B4252)
**When** the UI loads
**Then** the top bar displays (left to right):
- Logo/title: "Claude Container" (18px, bold, #D8DEE9)
- Spacer (flex-grow)
- "+ New Session" button (primary style, #88C0D0 background)
- "STOP" button (destructive style, #BF616A background, always visible)
- Settings icon button (ghost style, #81A1C1 color)

**And** when the user clicks "+ New Session"
**Then** the session creation modal opens (Story 2.3)

**And** when the user clicks "STOP"
**Then** an interrupt is sent to the active session (FR27)

**And** when the user clicks the settings icon
**Then** a dropdown menu opens with options:
- "Update BMAD" (triggers `npx bmad-method install`)
- "Preferences" (future)
- "About"

**And** when the user clicks "Update BMAD"
**Then** the backend executes `npx bmad-method install` in the workspace

**And** a toast notification shows progress: "Updating BMAD Method..."

**And** on completion: "BMAD Method updated successfully" (FR5)

**Prerequisites:** Epic 1 Story 1.9 (Basic UI), Story 2.3 (Session creation)

**Technical Notes:**
- Top bar per UX spec "Design Direction" section 4.1
- Button styles per UX spec "Button Patterns" section 7.1
- STOP button sends interrupt to active session only (not all sessions)
- BMAD update: Backend spawns child process, streams output to logs
- Settings dropdown: shadcn/ui Dropdown component
- Reference: UX spec sections 4.1, 7.1, and PRD FR5

---

### Story 3.10: Empty State UI for First-Time Users

As a developer,
I want a helpful empty state when no sessions exist,
So that I know what to do when I first open Claude Container (UX spec requirement).

**Acceptance Criteria:**

**Given** the container is running with no existing sessions
**When** the user opens `http://localhost:3000` for the first time
**Then** the UI displays an empty state:
- Center of screen: Large "+ New Session" card (300x200px)
- Icon: Terminal icon (Lucide `Terminal`, 48px, #88C0D0)
- Heading: "Start your first project with Claude" (18px, bold)
- Subtext: "Create a session to begin autonomous development" (14px, #81A1C1)
- Primary button: "Create Session"

**And** when the user clicks "Create Session"
**Then** the session creation modal opens (Story 2.3)

**And** after the first session is created
**Then** the empty state disappears and the normal UI loads (terminal + sidebars)

**And** when all sessions are destroyed
**Then** the empty state reappears

**Prerequisites:** Story 2.3 (Session creation modal)

**Technical Notes:**
- Empty state component per UX spec "Empty State Component" section 6.1
- Conditional rendering: `sessions.length === 0 ? <EmptyState /> : <MainLayout />`
- Friendly, encouraging copy (not confusing or technical)
- Card style: Background #3B4252, border-radius 8px, subtle shadow
- Reference: UX spec "Journey 6: First-Time Empty State"

---

### Story 3.11: Browser Notifications (Prep for Epic 4)

As a developer,
I want the frontend to request notification permissions on load,
So that browser notifications work when Claude asks questions in Epic 4 (FR49 prep).

**Acceptance Criteria:**

**Given** the frontend loads for the first time
**When** the app initializes
**Then** the frontend checks `Notification.permission`

**And** if permission is "default" (not granted or denied)
**Then** a subtle banner appears: "Enable notifications to know when Claude needs input"

**And** a "Enable" button is shown

**And** when the user clicks "Enable"
**Then** the frontend calls `Notification.requestPermission()`

**And** the browser shows its native permission prompt

**And** if the user grants permission
**Then** the banner dismisses with toast: "Notifications enabled"

**And** if the user denies permission
**Then** the banner dismisses silently (user choice respected)

**And** when permission is already granted
**Then** no banner is shown (silent initialization)

**Prerequisites:** Epic 1 (Frontend setup)

**Technical Notes:**
- Browser Notification API: `Notification.requestPermission()` returns Promise<'granted'|'denied'|'default'>
- Permission stored by browser (persists across page loads)
- Banner: Non-intrusive, dismissible, appears once per session
- Notification send deferred to Epic 4 Story 4.3
- Reference: PRD FR49 and UX spec "Notification & Feedback Patterns" section 7.4

---

### Story 3.12: Validation with Document Review Flow

As a developer,
I want to validate the complete document review workflow with real BMAD artifacts,
So that I'm confident users can monitor sessions and review generated documents at a glance.

**Acceptance Criteria:**

**Given** 2 sessions are active:
- Session 1: "epic-auth" - Running PRD creation workflow
- Session 2: "epic-payments" - Running architecture workflow

**When** Session 1 completes the PRD
**Then** the file tree shows "prd.md" in the docs folder

**And** the layout auto-shifts to artifact-dominant (70/30 split)

**And** the artifact viewer displays the rendered PRD markdown with tables and formatting

**And** when the user switches to Session 2
**Then** the terminal shows architecture workflow output

**And** the left sidebar file tree updates to show Session 2's worktree files

**And** when the user clicks "Workflow" tab in the left sidebar
**Then** the workflow diagram loads showing Session 2's progress (current step: "Architecture")

**And** when the user resizes the left sidebar wider to see more details
**Then** the resize is smooth and panel sizes persist

**And** when Session 1 asks for feedback on the PRD
**Then** the user can view the artifact, then type feedback in the terminal (still visible at 30% height)

**And** Claude receives the feedback and updates the PRD

**And** the diff view shows what changed since the last review

**Prerequisites:** All stories in Epic 3 (complete visibility system)

**Technical Notes:**
- Test with REAL BMAD workflows generating actual documents
- Validation success criteria from PRD Sprint 3: "Can monitor 4 sessions at a glance and view all generated artifacts"
- Verify: File tree updates, artifact rendering, diff view, layout shifting, workflow progress
- Stress test: Large markdown files (500KB+), many files in tree (100+)
- Reference: PRD "Success Criteria" Sprint 3 and UX spec "Journey 4"

---

## **Epic 3 Complete - Review**

**Epic 3: Workflow Visibility & Document Review**

**Stories:** 12 total
- Story 3.1: BMAD workflow YAML parser
- Story 3.2: Workflow progress component
- Story 3.3: Left sidebar Files/Workflow toggle
- Story 3.4: File tree with workspace navigation
- Story 3.5: Artifact viewer with markdown rendering
- Story 3.6: Context-aware layout shifting
- Story 3.7: Diff view for document changes
- Story 3.8: Resizable panel handles
- Story 3.9: Top bar with actions
- Story 3.10: Empty state for first-time users
- Story 3.11: Browser notifications prep
- Story 3.12: Validation with document review

**FRs Covered:** FR37-FR48 (12 FRs)

**User Value Delivered:** Developers can monitor BMAD workflow progress and review generated artifacts without leaving the browser

**Ready for Epic 4:** Yes - all visibility and document viewing complete, ready for stability and polish

---

