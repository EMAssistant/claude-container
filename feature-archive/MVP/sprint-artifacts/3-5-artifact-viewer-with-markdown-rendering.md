# Story 3.5: Artifact Viewer with Markdown Rendering

Status: ready-for-review

## Story

As a developer,
I want to view markdown documents rendered in the browser with syntax highlighting,
So that I can review PRDs, architecture docs, and code snippets without leaving the UI (FR45).

## Acceptance Criteria

1. **Given** an `ArtifactViewer.tsx` component
   **When** the user clicks "prd.md" in the file tree
   **Then** the main content area displays the rendered markdown:
   - GitHub Flavored Markdown support (tables, task lists, strikethrough via remark-gfm)
   - Code blocks with syntax highlighting (rehype-highlight)
   - Headings, lists, links, images all rendered correctly
   - Oceanic Calm code theme (background `#2E3440`, syntax colors match terminal)

2. **And** when the markdown contains a table
   **Then** the table renders with proper borders and cell padding

3. **And** when the markdown contains code blocks:
   ```python
   def hello():
       print("Hello")
   ```
   **Then** the code is syntax highlighted based on language (python, typescript, bash, etc.)

4. **And** when the file updates (Claude modifies it)
   **Then** the chokidar watcher detects the change

5. **And** the artifact viewer auto-refreshes to show updated content

6. **And** the scroll position is preserved (unless user manually scrolled away)

7. **And** when the user clicks "Close" or selects a different file
   **Then** the artifact viewer closes or switches to the new file

## Tasks / Subtasks

- [x] Task 1: Create ArtifactViewer.tsx component (AC: #1, #7)
  - [x] Subtask 1.1: Set up react-markdown with remark-gfm and rehype-highlight plugins
  - [x] Subtask 1.2: Implement file content loading from backend API
  - [x] Subtask 1.3: Add close/switch file functionality
  - [x] Subtask 1.4: Style with Oceanic Calm theme matching terminal

- [x] Task 2: Implement markdown rendering with GFM support (AC: #2)
  - [x] Subtask 2.1: Configure remark-gfm plugin for tables, task lists, strikethrough
  - [x] Subtask 2.2: Add proper CSS for table borders and cell padding
  - [x] Subtask 2.3: Test rendering with sample markdown containing all GFM features

- [x] Task 3: Add syntax highlighting for code blocks (AC: #3)
  - [x] Subtask 3.1: Configure rehype-highlight plugin with language detection
  - [x] Subtask 3.2: Import and apply Oceanic Calm highlight.js theme (or create custom CSS)
  - [x] Subtask 3.3: Test highlighting with python, typescript, bash, json, yaml code blocks

- [x] Task 4: Implement file change detection and auto-refresh (AC: #4, #5, #6)
  - [x] Subtask 4.1: Subscribe to WebSocket `file.changed` events for current file
  - [x] Subtask 4.2: Store current scroll position before refresh
  - [x] Subtask 4.3: Reload file content and restore scroll position
  - [x] Subtask 4.4: Add visual indicator during refresh (optional)

- [x] Task 5: Write unit tests for ArtifactViewer component
  - [x] Subtask 5.1: Test markdown rendering with various content types
  - [x] Subtask 5.2: Test file change event handling
  - [x] Subtask 5.3: Test scroll position preservation logic
  - [x] Subtask 5.4: Test file switching functionality

## Dev Notes

### Architecture Context

**From Architecture.md:**
- **ADR-007:** Use react-markdown for safe markdown rendering (no XSS vulnerabilities)
- **ADR-011:** Markdown plugins: remark-gfm + rehype-highlight for GFM and syntax highlighting
- **Frontend Stack:** React 19, TypeScript 5.x, Vite 6.x, Tailwind CSS 4.0
- **File Watching:** Chokidar watches `/workspace/**/*.md` for changes, 500ms debounce

**Component Location:**
- Path: `frontend/src/components/ArtifactViewer.tsx`
- Dependencies: react-markdown, remark-gfm, rehype-highlight, highlight.js
- Integration: Used by main layout when file selected from FileTree component

**WebSocket Protocol:**
```typescript
// File change notification (Server → Client)
{
  type: 'file.changed',
  path: string,
  event: 'add' | 'change' | 'unlink',
  timestamp: string
}
```

**REST API:**
```typescript
// GET /api/documents/:path
// Returns file content
Response: string (text/plain for markdown)
Error: { error: 'File not found' }
```

### Technical Specifications

**From Tech Spec Epic 3:**
- **Module Responsibility:** Render markdown with syntax highlighting
- **Inputs:** File content string from backend
- **Outputs:** Rendered React components (HTML)
- **Performance Target:** <500ms rendering for 100KB file

**Markdown Rendering Stack:**
- react-markdown: Safe markdown rendering (no dangerouslySetInnerHTML)
- remark-gfm: GitHub Flavored Markdown (tables, task lists, strikethrough)
- rehype-highlight: Syntax highlighting for code blocks
- highlight.js: Syntax highlighting engine with Oceanic Calm theme

**Oceanic Calm Code Theme:**
- Background: `#2E3440` (Nord 0)
- Foreground: `#D8DEE9` (Nord 4)
- Keywords: `#81A1C1` (Nord 9)
- Strings: `#A3BE8C` (Nord 14)
- Comments: `#616E88` (Nord 3 Bright)
- Functions: `#88C0D0` (Nord 8)

### Integration Points

**Prerequisites:**
- Story 3.4 (File tree) must provide file selection callback
- Story 3.1 (File watching) backend infrastructure must be in place

**Workflow:**
```
1. User clicks file in FileTree → FileTree calls onFileSelect(filePath)
2. ArtifactViewer receives filePath prop
3. ArtifactViewer fetches content: GET /api/documents/:path
4. react-markdown renders content with plugins
5. highlight.js applies syntax highlighting to code blocks
6. Component subscribes to WebSocket for file.changed events
7. On file change event (if path matches) → refetch and re-render
8. Store scrollTop before re-render, restore after
```

### Testing Strategy

**Unit Tests (Vitest):**
- Render markdown with headings, lists, links, images
- Render GFM tables with borders
- Render code blocks with syntax highlighting
- Handle file change events
- Preserve scroll position on refresh
- Handle file not found error

**Integration Tests:**
- FileTree click → ArtifactViewer loads content
- File write → Chokidar event → ArtifactViewer refresh
- Switch between multiple files

**Manual Testing:**
- Load large markdown files (500KB+) - should render in <500ms
- Test with all supported languages (python, typescript, bash, json, yaml)
- Verify Oceanic Calm colors match terminal
- Test scroll preservation during auto-refresh

### Project Structure Notes

**File Organization:**
```
frontend/src/components/
├── ArtifactViewer.tsx       # Main component (create this)
├── FileTree.tsx             # File selection component (from Story 3.4)
└── ui/                      # shadcn/ui components
```

**Dependencies to Add:**
```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0",
    "highlight.js": "^11.0.0"
  }
}
```

**Custom CSS (Oceanic Calm theme):**
Create `frontend/src/styles/highlight-oceanic-calm.css` based on Nord color palette.

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Services and Modules]
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Data Models and Contracts]
- [Source: docs/epics/epic-3-workflow-visibility.md#Story 3.5]
- [Source: docs/architecture.md#ADR-007]
- [Source: docs/architecture.md#ADR-011]
- [Source: docs/ux-design-specification.md#Artifact Viewer Component] (if exists)

### Learnings from Previous Story

**No previous Epic 3 stories completed yet.** This is the first story being drafted in Epic 3. However, relevant patterns from Epic 2:

- **Component Testing:** Epic 2 stories achieved 96%+ test coverage - maintain this standard
- **WebSocket Integration:** Use established pattern from SessionList and Terminal components
- **Error Handling:** Follow comprehensive error handling from previous stories
- **UI Performance:** Epic 2 validated tab switching <50ms - apply same rigor to file switching

## Dev Agent Record

### Context Reference

- [Story 3.5 Context XML](docs/sprint-artifacts/3-5-artifact-viewer-with-markdown-rendering.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - No issues encountered during implementation

### Completion Notes List

1. **Dependencies Installed**: Successfully installed react-markdown v9.0.0, remark-gfm v4.0.0, rehype-highlight v7.0.0, and highlight.js v11.0.0 without conflicts
2. **Backend API Endpoint**: Created GET /api/documents/:path endpoint in backend/src/server.ts with proper path traversal protection and error handling
3. **Oceanic Calm Theme**: Created custom CSS file matching Terminal component's color scheme (background #2E3440, keywords #81A1C1, strings #A3BE8C, etc.)
4. **Component Implementation**: ArtifactViewer.tsx fully implements all acceptance criteria:
   - GitHub Flavored Markdown rendering with tables, task lists, strikethrough
   - Syntax highlighting for code blocks with language detection
   - Auto-refresh on file.changed WebSocket events
   - Scroll position preservation using refs and requestAnimationFrame
   - File switching and close functionality
5. **Test Coverage**: Comprehensive test suite with 20 tests covering:
   - Empty, loading, and error states
   - Markdown rendering (headings, lists, links, inline code)
   - GFM tables with proper borders
   - Code blocks with syntax highlighting
   - WebSocket file change events
   - Scroll preservation and file switching
   - All tests passing with 100% success rate
6. **Build Verification**: Frontend builds successfully with no TypeScript errors or warnings
7. **TypeScript Fixes**: Minor type adjustments for WebSocket message types and react-markdown component props

### File List

**Frontend Files Created:**
- frontend/src/components/ArtifactViewer.tsx (284 lines)
- frontend/src/components/ArtifactViewer.test.tsx (467 lines)
- frontend/src/styles/highlight-oceanic-calm.css (121 lines)

**Backend Files Modified:**
- backend/src/server.ts (added GET /api/documents/:path endpoint, lines 325-383)

**Configuration Files Modified:**
- frontend/package.json (added 4 dependencies)

**Documentation Files Modified:**
- docs/sprint-artifacts/3-5-artifact-viewer-with-markdown-rendering.md (status updated to ready-for-review)
