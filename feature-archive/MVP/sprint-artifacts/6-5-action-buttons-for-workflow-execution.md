# Story 6.5: Action Buttons for Workflow Execution

Status: drafted

## Story

As a developer,
I want action buttons on stories that execute the appropriate BMAD workflow,
So that I can start working on a story with one click instead of manually typing commands.

## Background

Building upon the Sprint Tracker component from Story 6.3 and artifact display from Story 6.4, this story adds intelligent action buttons to each story row that execute the appropriate BMAD workflow based on the story's current status. When a story is "drafted", clicking [▶ Context] sends the story-context command; when "ready-for-dev", [▶ Start] launches dev-story; when "review", [▶ Review] triggers code-review.

This eliminates manual command typing and context switching, enabling developers to progress through the development workflow with single clicks while the UI automatically focuses the terminal to show Claude's execution.

## Acceptance Criteria

```gherkin
AC6.23: [▶ Context] button for drafted status
  GIVEN a story with status "drafted"
  WHEN the story row is displayed
  THEN an action button labeled [▶ Context] appears
  AND clicking the button sends command: /bmad:bmm:workflows:story-context {storyId}
  AND the command is sent to the active session's terminal

AC6.24: [▶ Start] button for ready-for-dev status
  GIVEN a story with status "ready-for-dev"
  WHEN the story row is displayed
  THEN an action button labeled [▶ Start] appears
  AND clicking the button sends command: /bmad:bmm:workflows:dev-story {storyId}
  AND the command is sent to the active session's terminal

AC6.25: [▶ Review] button for review status
  GIVEN a story with status "review"
  WHEN the story row is displayed
  THEN an action button labeled [▶ Review] appears
  AND clicking the button sends command: /bmad:bmm:workflows:code-review {storyId}
  AND the command is sent to the active session's terminal

AC6.26: No button for backlog/done status
  GIVEN a story with status "backlog"
  WHEN the story row is displayed
  THEN no action button is shown
  AND given a story with status "done"
  THEN either no button is shown OR a disabled "✓ Done" button appears

AC6.27: Command sent to active session terminal
  GIVEN an action button is clicked
  WHEN there is an active session
  THEN the command is sent via WebSocket:
    { type: "terminal.input", sessionId: "<activeSessionId>", data: "<command>\n" }
  AND if no active session exists
  THEN a toast notification appears: "No active session - create one first"

AC6.28: Terminal focused after command execution
  GIVEN an action button successfully sends a command
  WHEN the WebSocket message is sent
  THEN the layout shifts to terminal-focused view
  OR the terminal panel is scrolled into view
  AND the terminal component receives focus
```

## Tasks / Subtasks

- [ ] **Task 1: Implement action button component** (AC6.23-AC6.26)
  - [ ] 1.1: Create ActionButton.tsx component (or add to StoryRow.tsx)
  - [ ] 1.2: Accept props: story (StoryData), onExecute (command: string) => void
  - [ ] 1.3: Implement status-to-button mapping logic:
    ```typescript
    const getActionConfig = (status: StoryStatus): ActionConfig | null => {
      switch (status) {
        case 'drafted': return { label: '▶ Context', command: 'story-context', color: 'blue' };
        case 'ready-for-dev': return { label: '▶ Start', command: 'dev-story', color: 'green' };
        case 'review': return { label: '▶ Review', command: 'code-review', color: 'yellow' };
        case 'done': return { label: '✓ Done', command: null, disabled: true };
        default: return null; // backlog, in-progress
      }
    };
    ```
  - [ ] 1.4: Build full command string: `/bmad:bmm:workflows:{command} {storyId}`
  - [ ] 1.5: Call onExecute callback with command when button clicked
  - [ ] 1.6: Apply appropriate color styling per button type (blue/green/yellow)
  - [ ] 1.7: Render disabled state for "done" status
  - [ ] 1.8: Return null (no button) for backlog and in-progress statuses

- [ ] **Task 2: Integrate SessionContext for active session** (AC6.27)
  - [ ] 2.1: Import SessionContext from frontend/src/context/SessionContext.tsx
  - [ ] 2.2: Get activeSessionId from SessionContext.activeSession?.id
  - [ ] 2.3: Import useWebSocket hook or WebSocket connection from context
  - [ ] 2.4: Implement executeWorkflow function:
    ```typescript
    const executeWorkflow = (command: string) => {
      if (!activeSessionId) {
        toast.error('No active session - create one first');
        return;
      }
      sendMessage({
        type: 'terminal.input',
        sessionId: activeSessionId,
        data: command + '\n'
      });
      focusTerminal();
    };
    ```
  - [ ] 2.5: Handle no active session case with toast notification (use toast from Story 4.4)
  - [ ] 2.6: Verify WebSocket connection is active before sending
  - [ ] 2.7: Add error handling for WebSocket send failures

- [ ] **Task 3: Implement terminal focus logic** (AC6.28)
  - [ ] 3.1: Import LayoutContext from frontend/src/context/LayoutContext.tsx
  - [ ] 3.2: Get setMainContentMode or setSelectedTab from LayoutContext
  - [ ] 3.3: After sending command, call setMainContentMode('terminal') or equivalent
  - [ ] 3.4: Alternative approach: If using split view, ensure terminal panel is visible
  - [ ] 3.5: Consider scrolling terminal into view if not using mode switching
  - [ ] 3.6: Test focus behavior with different layout configurations (sidebar open/closed)
  - [ ] 3.7: Ensure terminal component can receive programmatic focus (may need ref)

- [ ] **Task 4: Integrate action button into StoryRow** (AC6.23-AC6.28)
  - [ ] 4.1: Import or define ActionButton component in StoryRow.tsx
  - [ ] 4.2: Add action button to story row layout:
    ```tsx
    <div className="story-row">
      <span>{statusIcon} {storyId} {slug}</span>
      <span>{status}</span>
      <ActionButton story={story} onExecute={executeWorkflow} />
    </div>
    ```
  - [ ] 4.3: Position button at end of row (flex layout, justify-between)
  - [ ] 4.4: Ensure button doesn't interfere with row expansion click area
  - [ ] 4.5: Add onClick stopPropagation to button to prevent row toggle when clicked
  - [ ] 4.6: Test button rendering for all story statuses (backlog, drafted, ready-for-dev, in-progress, review, done)
  - [ ] 4.7: Verify visual alignment with existing story row elements

- [ ] **Task 5: Add command validation and security** (AC6.27)
  - [ ] 5.1: Validate storyId format before building command (alphanumeric-dash pattern)
  - [ ] 5.2: Sanitize storyId to prevent command injection:
    ```typescript
    const isValidStoryId = (id: string) => /^[0-9]+-[0-9]+-[a-z0-9-]+$/.test(id);
    ```
  - [ ] 5.3: Reject invalid story IDs with error toast
  - [ ] 5.4: Log workflow execution attempts for debugging:
    ```typescript
    console.log('[Sprint Tracker] Executing workflow:', { storyId, command, sessionId });
    ```
  - [ ] 5.5: Test with edge case story IDs (special chars, long slugs)
  - [ ] 5.6: Ensure command string always ends with \n newline

- [ ] **Task 6: Write comprehensive unit tests** (All ACs)
  - [ ] 6.1: Test ActionButton renders correct label for each status
  - [ ] 6.2: Test ActionButton builds correct command string
  - [ ] 6.3: Test ActionButton calls onExecute with correct command
  - [ ] 6.4: Test ActionButton returns null for backlog status
  - [ ] 6.5: Test ActionButton disabled for done status
  - [ ] 6.6: Test executeWorkflow sends WebSocket message with correct payload
  - [ ] 6.7: Test executeWorkflow shows toast when no active session
  - [ ] 6.8: Test terminal focus function called after command sent
  - [ ] 6.9: Test StoryRow includes ActionButton in layout
  - [ ] 6.10: Test button click doesn't trigger row expansion
  - [ ] 6.11: Target: 50%+ frontend code coverage for action button logic
  - [ ] 6.12: Mock SessionContext, LayoutContext, useWebSocket for tests

- [ ] **Task 7: Integration testing with SprintTracker** (AC6.27-AC6.28)
  - [ ] 7.1: Test full flow: Click [▶ Start] → WebSocket message sent → terminal focused
  - [ ] 7.2: Test with real SprintStatus data containing multiple statuses
  - [ ] 7.3: Test error case: Click button with no active session → toast appears
  - [ ] 7.4: Test different layout modes (sidebar open/closed, split view)
  - [ ] 7.5: Verify commands reach Claude CLI in active session (manual validation)
  - [ ] 7.6: Test rapid consecutive button clicks (debounce if needed)
  - [ ] 7.7: Test WebSocket reconnection scenario (button should still work after reconnect)

## Dev Notes

### Architecture Alignment

This story integrates with Epic 4's session management, Epic 3's layout system, and Epic 6's sprint tracking:

**Dependencies from Previous Stories:**
- **Story 6.4 (Artifact Display)**: StoryRow.tsx component exists, will add action button to layout
- **Story 6.3 (Sprint Tracker)**: SprintTracker manages story list rendering, provides StoryData
- **Story 6.1 (Sprint Status Parser)**: Provides StoryData.status for button mapping
- **Epic 4 SessionContext**: Provides activeSession.id for WebSocket routing
- **Epic 4 useWebSocket**: Provides sendMessage() for terminal.input
- **Epic 3 LayoutContext**: Provides setMainContentMode() for terminal focus
- **Story 4.4 Toast Notifications**: Provides toast.error() for no-session case

**New Components:**
- `ActionButton.tsx` - Status-aware workflow execution button (may be inline in StoryRow)
- Extended `StoryRow.tsx` - Adds action button to existing layout

**ADR Compliance:**
- **ADR-005 (React Context API)**: Use SessionContext for activeSessionId, LayoutContext for terminal focus
- **ADR-013 (WebSocket Protocol)**: Reuse existing terminal.input message type
- **UI Components**: Use existing shadcn/ui Button component for consistency
- **Security**: Validate story IDs before building commands (prevent injection)

### UI Component Structure

**StoryRow Layout (with Action Button):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ▼ ○ 6-5  action-buttons-for-workflow-execution  drafted  [▶ Context]│
│    ├─ 📄 6-5-action-buttons-for-workflow-execution.md       [View]  │
│    └─ 📋 6-5-action-buttons-for-workflow-execution.context.xml (missing) │
└─────────────────────────────────────────────────────────────────────┘
```

**Button Style Mapping:**
- `drafted` → [▶ Context] - Blue button (bg-blue-600 hover:bg-blue-700)
- `ready-for-dev` → [▶ Start] - Green button (bg-green-600 hover:bg-green-700)
- `review` → [▶ Review] - Yellow/amber button (bg-amber-500 hover:bg-amber-600)
- `done` → [✓ Done] - Gray disabled (bg-gray-300 cursor-not-allowed)
- `backlog`, `in-progress` → No button rendered

**Button Placement:**
- Position: End of story row (right side)
- Size: Compact (size="sm" or custom padding)
- Spacing: ml-auto to push to right edge
- Click isolation: stopPropagation to prevent row expansion toggle

### Data Flow

```
User clicks [▶ Start] on story 6-5
  ↓
ActionButton.onClick()
  ↓
Validate storyId format (6-5 or 6-5-action-buttons...)
  ↓
Build command: /bmad:bmm:workflows:dev-story 6-5
  ↓
Check activeSessionId from SessionContext
  ├─ If null → toast.error("No active session")
  └─ If valid → continue
  ↓
Send WebSocket message:
  { type: "terminal.input", sessionId: "abc123", data: "/bmad:bmm:workflows:dev-story 6-5\n" }
  ↓
Terminal receives command → Claude starts executing
  ↓
Call LayoutContext.setMainContentMode('terminal')
  ↓
Terminal panel focused and visible
  ↓
[Optional] Auto-scroll terminal to show command output
```

### Command Mapping Reference

```typescript
// Story status → Workflow command mapping
const WORKFLOW_COMMANDS = {
  'drafted': 'story-context',       // Generate story context XML
  'ready-for-dev': 'dev-story',     // Start story implementation
  'review': 'code-review',          // Trigger code review workflow
  'in-progress': null,              // No button (developer already working)
  'done': null,                     // No button (story complete)
  'backlog': null                   // No button (story not yet drafted)
} as const;

// Full command template
const buildCommand = (workflow: string, storyId: string) =>
  `/bmad:bmm:workflows:${workflow} ${storyId}`;

// Example outputs:
// /bmad:bmm:workflows:story-context 6-5
// /bmad:bmm:workflows:dev-story 6-5
// /bmad:bmm:workflows:code-review 6-5
```

### WebSocket Integration

**Message Format (Existing Protocol):**
```typescript
// Client → Server: Terminal input
interface TerminalInputMessage {
  type: 'terminal.input';
  sessionId: string;
  data: string;  // Command with trailing \n
}

// Example:
{
  type: 'terminal.input',
  sessionId: 'session-abc123',
  data: '/bmad:bmm:workflows:dev-story 6-5\n'
}
```

**Implementation Pattern:**
```typescript
// In StoryRow or SprintTracker component
const { activeSession } = useContext(SessionContext);
const { sendMessage } = useWebSocket();
const { setMainContentMode } = useContext(LayoutContext);

const executeWorkflow = (command: string, storyId: string) => {
  // Validate inputs
  if (!isValidStoryId(storyId)) {
    toast.error('Invalid story ID format');
    return;
  }

  if (!activeSession) {
    toast.error('No active session - create one first');
    return;
  }

  // Build and send command
  const fullCommand = `/bmad:bmm:workflows:${command} ${storyId}`;
  sendMessage({
    type: 'terminal.input',
    sessionId: activeSession.id,
    data: fullCommand + '\n'
  });

  // Focus terminal
  setMainContentMode('terminal');
};
```

### Terminal Focus Strategies

**Option 1: Layout Mode Switch (Recommended)**
```typescript
// Use existing layout mode system
setMainContentMode('terminal');
// This makes terminal the primary content area
```

**Option 2: Split View with Scroll**
```typescript
// If in split view, scroll terminal panel into view
const terminalElement = document.querySelector('[data-terminal-panel]');
terminalElement?.scrollIntoView({ behavior: 'smooth' });
```

**Option 3: Programmatic Focus**
```typescript
// Focus the xterm.js instance directly
// Requires ref to Terminal component and exposing focus method
terminalRef.current?.focus();
```

**Chosen Approach:** Option 1 (setMainContentMode) is recommended as it aligns with existing layout system from Story 3.6 and provides clear visual feedback.

### Security Considerations

**Command Injection Prevention:**
- Story IDs must match pattern: `^\d+-\d+-[a-z0-9-]+$`
- Reject any story IDs with special characters (;, |, &, $, etc.)
- Commands are hardcoded workflows (story-context, dev-story, code-review)
- No user-provided command strings allowed

**Validation Example:**
```typescript
const STORY_ID_PATTERN = /^[0-9]+-[0-9]+-[a-z0-9-]+$/;

const isValidStoryId = (id: string): boolean => {
  if (!STORY_ID_PATTERN.test(id)) {
    console.warn('[Security] Invalid story ID rejected:', id);
    return false;
  }
  return true;
};

const ALLOWED_WORKFLOWS = ['story-context', 'dev-story', 'code-review'] as const;

const isAllowedWorkflow = (workflow: string): workflow is typeof ALLOWED_WORKFLOWS[number] => {
  return ALLOWED_WORKFLOWS.includes(workflow as any);
};
```

### Testing Strategy

**Component Tests (Vitest):**
- Render ActionButton with each story status → verify correct label/color
- Click ActionButton → verify onExecute called with correct command
- Render ActionButton with done status → verify button disabled
- Render ActionButton with backlog status → verify no button rendered
- executeWorkflow with no active session → verify toast displayed
- executeWorkflow with valid session → verify WebSocket message sent
- Mock SessionContext, LayoutContext, useWebSocket hook

**Integration Tests:**
- Render SprintTracker with full sprint data → verify buttons on all stories
- Click [▶ Start] button → verify WebSocket message sent with correct payload
- Click button with no active session → verify toast notification
- Click button → verify setMainContentMode('terminal') called
- Test button click doesn't trigger row expansion

**Manual Testing Checklist:**
- Click [▶ Context] on drafted story → verify command appears in terminal
- Click [▶ Start] on ready-for-dev story → verify dev-story workflow starts
- Click [▶ Review] on review story → verify code-review workflow starts
- Click button with no session → verify toast appears
- Verify terminal panel becomes visible after button click
- Test with different layout configurations (sidebar, split view)

### Learnings from Previous Story

**From Story 6.4 (Artifact Display Under Steps)**

Story 6.4 created the StoryRow component with expandable artifact lists and [View] button integration. Key learnings to apply to this story:

- **Component Props Pattern**: StoryRow receives story data and callback functions as props. This story will add onExecuteWorkflow callback alongside existing onToggle callback.

- **Context Integration**: Story 6.4 used LayoutContext.setSelectedFile() for artifact viewing. This story will use SessionContext for activeSessionId and LayoutContext for terminal focus - follow same pattern of extracting context at component top level.

- **Button Click Isolation**: Story 6.4 learned that buttons within expandable rows need stopPropagation to prevent triggering row expansion. Apply same pattern to action buttons.

- **Empty State Handling**: Story 6.4 handles missing artifacts gracefully (exists: false). Similarly, this story handles missing active session gracefully with toast notification.

- **Testing with Mocks**: Story 6.4 demonstrated mocking LayoutContext for tests. This story will mock SessionContext, LayoutContext, and useWebSocket for comprehensive testing.

- **Dark Mode Support**: Story 6.4 ensures all styling supports dark mode. Action buttons will use semantic color classes that adapt to dark mode (bg-blue-600 dark:bg-blue-500).

**Implementation Recommendations:**

1. **Add Button to StoryRow**: Story 6.4 already created StoryRow.tsx. Add ActionButton as a new prop/component rather than creating separate file initially (can extract later if reused).

2. **Reuse Context Patterns**: Story 6.4 showed successful context hook usage. Import and use SessionContext the same way LayoutContext was used for setSelectedFile.

3. **Status Icon Consistency**: Story 6.4 uses status icon colors (✓ green, ◉ yellow, → cyan). Action button colors should align: drafted→blue (new), ready→green, review→yellow.

4. **No Action for In-Progress**: Based on Story 6.4 learnings, in-progress stories shouldn't have action buttons (developer is already working). Only drafted, ready-for-dev, and review get buttons.

5. **Toast Integration**: Use existing toast system from Story 4.4 (already used for session errors). No new notification system needed.

6. **Layout Shift Testing**: Story 6.4 tested artifact viewer opening. This story must test terminal focus shift - verify layout changes when button clicked.

**New Patterns to Establish:**

- **Workflow Command Builder**: Create reusable function to build `/bmad:bmm:workflows:{command} {storyId}` strings
- **Active Session Check**: Reusable pattern for checking activeSession before WebSocket operations
- **Terminal Focus Utility**: May become reusable for other features (e.g., Story 6.9 create next story action)

[Source: docs/sprint-artifacts/6-4-artifact-display-under-steps.md]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#APIs and Interfaces - Action Button Command Mapping]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.5]
- [Story 6.4 (Artifact Display): docs/sprint-artifacts/6-4-artifact-display-under-steps.md]
- [Story 6.3 (Sprint Tracker): docs/sprint-artifacts/6-3-sprint-tracker-component-mvp-view.md]
- [Epic 4 SessionContext: frontend/src/context/SessionContext.tsx]
- [Epic 3 LayoutContext: frontend/src/context/LayoutContext.tsx]
- [Story 4.4 Toast Notifications: docs/sprint-artifacts/4-4-toast-notifications-for-user-feedback.md]
- [WebSocket Protocol: docs/websocket-protocol.md]

## Estimated Effort

3-4 hours

## Dependencies

- Story 6.4 (Artifact Display) - provides StoryRow.tsx component
- Story 6.3 (Sprint Tracker) - provides SprintTracker component and story rendering
- Story 6.1 (Sprint Status Parser) - provides StoryData.status field
- Epic 4 SessionContext - provides activeSession.id for WebSocket routing
- Epic 4 useWebSocket - provides sendMessage() function
- Epic 3 LayoutContext - provides setMainContentMode() for terminal focus
- Story 4.4 Toast Notifications - provides toast.error() for error feedback
- shadcn/ui Button component - UI consistency

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
