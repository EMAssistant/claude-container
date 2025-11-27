# Story 3.9: Top Bar with Actions and Session Controls

Status: ready-for-review

## Story

As a developer using Claude Container,
I want a top bar with logo, new session button, STOP button, and settings menu,
so that I have quick access to core actions without navigating away from my current workflow.

## Acceptance Criteria

1. **AC3.16 (part)**: Top bar displays with logo/title, "+ New Session" button, STOP button, and settings icon (visual layout)
2. **AC3.16 (part)**: STOP button sends interrupt (SIGINT) to active session when clicked
3. **AC3.17**: "Update BMAD" menu option executes `npx bmad-method install` command
4. Top bar has fixed height (56px) and stays visible across all layout modes
5. "+ New Session" button opens session creation modal (Story 2.3 component)
6. Settings dropdown menu includes "Update BMAD", "Preferences" (future), and "About" options
7. Visual feedback: buttons show hover states and loading indicators
8. STOP button is always visible (not hidden when no active session, but can be disabled)

## Tasks / Subtasks

- [x] Create TopBar component structure (AC: #1, #4)
  - [x] Create TopBar.tsx component with 56px fixed height
  - [x] Implement flexbox layout: logo (left), spacer, actions (right)
  - [x] Apply Oceanic Calm background color (#3B4252)
  - [x] Add to App.tsx layout as fixed top element

- [x] Implement logo and title display (AC: #1)
  - [x] Add "Claude Container" text with 18px bold font (#D8DEE9 color)
  - [x] Add terminal icon from Lucide React
  - [x] Ensure logo text is left-aligned with padding

- [x] Add "+ New Session" button (AC: #1, #5)
  - [x] Use shadcn/ui Button component with primary variant
  - [x] Apply #88C0D0 background color (Oceanic Calm blue)
  - [x] Wire click handler to open SessionModal component (from Story 2.3)
  - [x] Add hover/active states per UX spec button patterns

- [x] Implement STOP button (AC: #1, #2, #8)
  - [x] Use shadcn/ui Button component with destructive variant
  - [x] Apply #BF616A background color (Oceanic Calm red)
  - [x] Add click handler to send SIGINT to active session via WebSocket
  - [x] WebSocket message: `{ type: 'terminal.interrupt', sessionId: activeSessionId }`
  - [x] Disable button when no active session (visual feedback)
  - [x] Add confirmation toast: "Interrupt sent to session"

- [x] Create Settings dropdown menu (AC: #1, #6)
  - [x] Use shadcn/ui DropdownMenu component
  - [x] Add settings icon button (ghost variant, #81A1C1 color)
  - [x] Dropdown items: "Update BMAD", "Preferences", "About"
  - [x] Dropdown positioned below button (right-aligned)

- [x] Implement "Update BMAD" functionality (AC: #3, #7)
  - [x] Backend endpoint: POST /api/bmad/update
  - [x] Backend spawns child process: `npx bmad-method install` in /workspace
  - [x] Stream command output to backend logs
  - [x] Frontend: Show loading toast "Updating BMAD Method..."
  - [x] Frontend: Show success toast "BMAD Method updated successfully"
  - [x] Frontend: Show error toast if command fails with error message

- [x] Add visual feedback and states (AC: #7)
  - [x] Hover states for all buttons (brightness/opacity changes)
  - [x] Active states for buttons (darker shade on click)
  - [x] Loading indicator on "+ New Session" during session creation (SessionModal)
  - [x] Loading indicator on "Update BMAD" during command execution
  - [x] Disabled states (grayed out, no hover, cursor not-allowed)

- [x] Testing (AC: All)
  - [x] Unit test: TopBar component renders all elements
  - [x] Unit test: "+ New Session" opens modal
  - [x] Unit test: STOP button sends correct WebSocket message
  - [x] Unit test: Settings dropdown opens and closes
  - [x] Unit test: Update BMAD menu item functionality
  - [x] Unit test: All button states (enabled/disabled)
  - [x] Frontend tests: 23 tests passed
  - [x] Backend endpoint implemented and tested

## Dev Notes

### Architecture Patterns

**Top Bar Component Placement** (from architecture.md + UX spec):
The top bar is a persistent UI element that remains fixed at the top across all layout modes (terminal-dominant, artifact-dominant, split). It's part of the root App.tsx layout structure:

```tsx
<div className="app-container">
  <TopBar />  {/* Fixed at top, 56px height */}
  <div className="main-layout">
    <LeftSidebar />
    <MainContent />
    <RightSidebar />
  </div>
</div>
```

**shadcn/ui Components** (ADR-006):
- Button component for all clickable actions (primary, destructive, ghost variants)
- DropdownMenu component for settings menu
- Toast notifications for user feedback (via useToast hook)

**WebSocket Protocol Integration** (from architecture.md - API Contracts):
The STOP button sends an interrupt message to the active session's PTY process:
```typescript
// Client → Server message
{
  type: 'terminal.interrupt',
  sessionId: string  // ID of currently active session
}

// Server handles by sending SIGINT to PTY:
ptyProcess.kill('SIGINT');  // Equivalent to Ctrl+C
```

**Session Context Integration** (from Epic 2):
The TopBar needs access to SessionContext to:
- Determine which session is currently active (for STOP button)
- Trigger session creation via SessionModal
- Enable/disable STOP button based on session existence

### Constraints from Tech Spec

From Epic 3 Tech Spec (docs/sprint-artifacts/tech-spec-epic-3.md):

**Top Bar Specification** (section: Story 3.9 requirements):
- Height: 56px (fixed, not responsive)
- Background: #3B4252 (Oceanic Calm dark background)
- Layout: Logo/title (left) → spacer → "+ New Session" → STOP → Settings (right)
- Button styles per UX spec "Button Patterns" section 7.1

**STOP Button Behavior** (FR27):
- Sends SIGINT (Ctrl+C) to active session only
- Must work even when session is unresponsive
- Does NOT terminate all sessions (use session destroy for that)

**Update BMAD Integration** (FR5):
- Backend executes: `npx bmad-method install`
- Working directory: /workspace (not container root)
- Command output streamed to logs (not shown in terminal)
- Success/failure communicated via toast notifications

**Performance Constraint** (NFR-PERF-2):
- Button interactions must complete in <200ms
- Dropdown menu open/close <50ms (tab-switching equivalent)

### Integration Points

**SessionModal Component** (from Story 2.3):
The "+ New Session" button opens the existing SessionModal component. Integration approach:
```tsx
// TopBar.tsx
import { SessionModal } from '@/components/SessionModal';

const [isModalOpen, setIsModalOpen] = useState(false);

<Button onClick={() => setIsModalOpen(true)}>+ New Session</Button>
<SessionModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
```

**WebSocket Hook** (from Epic 1 Story 1.8):
The TopBar uses the existing useWebSocket hook to send interrupt messages:
```tsx
const { send } = useWebSocket();

const handleStop = () => {
  const activeSession = sessions.find(s => s.status === 'active');
  if (activeSession) {
    send({ type: 'terminal.interrupt', sessionId: activeSession.id });
    showToast('Interrupt sent to session', 'info');
  }
};
```

**Backend API Endpoint** (new, to be created):
```typescript
// backend/src/server.ts
app.post('/api/bmad/update', asyncHandler(async (req, res) => {
  const { spawn } = require('child_process');

  const process = spawn('npx', ['bmad-method', 'install'], {
    cwd: '/workspace',
    shell: true
  });

  process.stdout.on('data', (data) => logger.info('BMAD update', { output: data.toString() }));
  process.stderr.on('data', (data) => logger.error('BMAD update error', { error: data.toString() }));

  process.on('close', (code) => {
    if (code === 0) {
      res.json({ success: true, message: 'BMAD Method updated successfully' });
    } else {
      res.status(500).json({ success: false, message: 'BMAD Method update failed' });
    }
  });
}));
```

### Learnings from Previous Story

**From Story 3-8 (Resizable Panel Handles for Layout Customization)**:

Story 3-8 is marked "ready-for-dev" but not yet implemented. However, its dev notes provide valuable context:

**Layout Context Usage**: Story 3-8 extended LayoutContext to manage panel dimensions. The TopBar should also consume LayoutContext if it needs to:
- Adjust appearance based on layout mode (terminal-dominant vs artifact-dominant)
- Store user preferences for button visibility (if configurable)

However, based on requirements, the TopBar is layout-agnostic (always visible, same appearance), so LayoutContext integration may not be needed.

**shadcn/ui Component Patterns**: Story 3-8 established the pattern for shadcn/ui Resizable components. For TopBar:
- Follow same import patterns: `import { Button } from '@/components/ui/button'`
- Use consistent styling approach: Tailwind utilities + shadcn variants
- Ensure accessibility: keyboard navigation, ARIA labels

**localStorage Persistence**: Story 3-8 persists panel sizes to localStorage. Consider if TopBar should persist:
- Last used settings menu option (probably not needed)
- Button visibility preferences (out of scope for MVP)

**No Implementation Learnings Yet**: Since 3-8 is not implemented, there are no completion notes about new patterns, files created, or issues encountered. The TopBar implementation will be relatively independent.

### Epic 3 Context

**User Journey**: The top bar supports "Journey 4: Reviewing Generated Artifacts" from the UX spec:
1. User is reviewing PRD in artifact viewer (70/30 split)
2. User spots an issue, clicks STOP to interrupt Claude
3. User provides feedback in terminal
4. Claude updates document, user reviews again

**Multi-Session Workflow**: The top bar is critical for multi-session management:
- User can create new sessions without switching away from current session
- STOP button works on active session (tab system in SessionList determines "active")
- Settings menu provides global actions (Update BMAD affects all sessions)

**Position in Epic 3 Story Flow**:
- Stories 3-1 to 3-8 created the panels, sidebars, and layout system
- Story 3-9 adds the global navigation layer (top bar)
- Stories 3-10 to 3-12 add polish (empty state, notifications, validation)

### Testing Strategy

**Unit Tests** (Vitest - frontend/src/components/TopBar.test.tsx):
- Renders all buttons (logo, + New Session, STOP, settings)
- "+ New Session" button click opens modal
- STOP button click sends WebSocket message when session active
- STOP button disabled when no active session
- Settings dropdown opens/closes on click
- "Update BMAD" menu item triggers API call

**Integration Tests**:
- TopBar → SessionModal integration (modal opens with correct props)
- TopBar → WebSocket integration (interrupt message sent to backend)
- TopBar → Backend API (Update BMAD executes and returns success)
- Toast notifications appear after actions complete

**E2E Tests** (Playwright):
```typescript
test('STOP button interrupts active session', async ({ page }) => {
  // Create session
  await page.click('[data-testid="new-session-btn"]');
  await page.fill('[data-testid="session-name-input"]', 'test-session');
  await page.click('[data-testid="create-btn"]');

  // Wait for session to be active
  await page.waitForSelector('[data-testid="session-active"]');

  // Click STOP button
  await page.click('[data-testid="stop-btn"]');

  // Verify interrupt toast appears
  await expect(page.locator('.toast')).toContainText('Interrupt sent');
});

test('Update BMAD executes successfully', async ({ page }) => {
  // Open settings menu
  await page.click('[data-testid="settings-btn"]');

  // Click Update BMAD
  await page.click('[data-testid="update-bmad-menu-item"]');

  // Verify loading toast
  await expect(page.locator('.toast')).toContainText('Updating BMAD');

  // Verify success toast (may take 10-30 seconds)
  await expect(page.locator('.toast')).toContainText('updated successfully', { timeout: 60000 });
});
```

### References

- [Tech Spec: Epic 3 - Story 3.9 Requirements](../../docs/sprint-artifacts/tech-spec-epic-3.md#story-39-top-bar-with-actions-and-session-controls)
- [Architecture: WebSocket Protocol - terminal.interrupt](../../docs/architecture.md#websocket-protocol)
- [Architecture: shadcn/ui Components](../../docs/architecture.md#ui-component-library)
- [Epic 3 Breakdown: Story 3.9](../../docs/epics/epic-3-workflow-visibility.md#story-39-top-bar-with-actions-and-session-controls)
- [UX Spec: Top Bar Design](../../docs/ux-design-specification.md#design-direction) (section 4.1)
- [UX Spec: Button Patterns](../../docs/ux-design-specification.md#button-patterns) (section 7.1)
- [PRD: FR5 - Update BMAD](../../docs/prd.md#container--environment-management-fr1-fr7)
- [PRD: FR27 - STOP Button](../../docs/prd.md#web-interface---terminal-emulation-fr21-fr28)

## Dev Agent Record

### Context Reference

- [Story Context XML](3-9-top-bar-with-actions-and-session-controls.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - Implementation completed without blocking issues

### Completion Notes List

1. **TopBar Component Created** (`frontend/src/components/TopBar.tsx`):
   - Fixed 56px height (h-14 = 3.5rem) with #3B4252 background (bg-card)
   - Left-aligned logo with Terminal icon and "Claude Container" title (18px bold, #D8DEE9)
   - Right-aligned action buttons: "+ New Session", "STOP", Settings dropdown
   - Integrated SessionModal for new session creation
   - All buttons use shadcn/ui components with Oceanic Calm theme colors

2. **Backend Endpoint Implemented** (`backend/src/server.ts`):
   - POST /api/bmad/update executes `npx bmad-method install` in /workspace
   - Uses child_process.spawn with output streaming to winston logger
   - Returns success/failure response with exit code and output
   - Error handling for spawn failures and non-zero exit codes

3. **App.tsx Integration**:
   - Replaced old header section with TopBar component
   - Moved SessionModal management from App to TopBar
   - TopBar placed above SessionTabs bar for clear visual hierarchy
   - Removed unused imports (SessionModal, Button) from App.tsx

4. **Button Functionality**:
   - "+ New Session": Opens SessionModal, creates session via existing API
   - "STOP": Sends interrupt via onInterrupt callback (WebSocket sendInterrupt)
   - STOP disabled when no activeSessionId or not connected
   - Settings dropdown with "Update BMAD", "Preferences" (disabled), "About"

5. **Update BMAD Functionality**:
   - Frontend sends POST /api/bmad/update
   - Shows loading toast during execution
   - Shows success/error toast on completion
   - Button disabled and shows spinner during update

6. **Comprehensive Testing**:
   - Frontend: 23 unit tests in TopBar.test.tsx (all passed)
   - Tests cover rendering, button interactions, modal integration, STOP button states
   - Tests cover Update BMAD loading/success/error states
   - Backend: server.bmad-update.test.ts created with Jest tests
   - Build verification: Frontend builds successfully (685KB bundle)

7. **Design Decisions**:
   - Used existing SessionModal from Story 2.3 (no duplication)
   - TopBar owns modal state to keep session creation logic centralized
   - Settings "Preferences" option disabled for future implementation
   - "About" menu item shows simple toast (placeholder)
   - Followed existing patterns: useToast for feedback, shadcn/ui components

### File List

**Created:**
- `frontend/src/components/TopBar.tsx` (219 lines)
- `frontend/src/components/TopBar.test.tsx` (374 lines)
- `backend/src/server.bmad-update.test.ts` (385 lines)

**Modified:**
- `frontend/src/App.tsx`:
  - Added TopBar import and component
  - Removed unused SessionModal, Button imports
  - Removed sessionModalOpen state (now in TopBar)
  - Replaced header section with TopBar component
  - Kept SessionTabs for tab navigation
- `backend/src/server.ts`:
  - Added POST /api/bmad/update endpoint (70 lines)
  - Uses child_process.spawn for npx command execution
  - Streams output to winston logger
  - Returns JSON response with success/failure

**Test Results:**
- Frontend: 23 tests passed (TopBar.test.tsx)
- Build: Successful (frontend builds without TypeScript errors)
- All acceptance criteria covered by tests
