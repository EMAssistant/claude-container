# Story 6.8: Replace Swim Lane with Sprint Tracker as Default

Status: drafted

## Story

As a developer,
I want the Sprint Tracker to be the default workflow view with the ability to toggle to the phase diagram,
So that I see actionable execution state immediately while retaining access to the historical workflow overview.

## Background

The current workflow visualization defaults to showing the WorkflowDiagram (swim lane view) with BMAD phases (Discovery, Planning, Solutioning, Implementation). While this provides historical context, it doesn't show the execution details that developers need most frequently. Story 6.3 introduced the Sprint Tracker component that displays real-time epic/story progress with action buttons.

This story makes Sprint Tracker the default view when opening the workflow panel, adds toggle buttons to switch between Sprint and Phases views, persists the preference to localStorage, and enhances the sidebar's compact WorkflowProgress component to show the current story summary with an action button.

## Acceptance Criteria

```gherkin
AC6.39: Sprint Tracker is default workflow view
  GIVEN the user opens the app or clicks "View" in the sidebar
  WHEN the workflow panel is displayed
  THEN the Sprint Tracker component is shown by default
  AND the WorkflowDiagram (swim lane) is not visible initially
  AND the default applies to first-time users (no localStorage preference)

AC6.40: [Phases] button switches to swim lane
  GIVEN the Sprint Tracker view is displayed
  WHEN the user clicks the [Phases] button in the header
  THEN the view switches to show WorkflowDiagram component
  AND the [Phases] button is replaced with [Sprint] button
  AND the transition occurs without page reload (<50ms)

AC6.41: [Sprint] button returns to Sprint Tracker
  GIVEN the Phases (WorkflowDiagram) view is displayed
  WHEN the user clicks the [Sprint] button in the header
  THEN the view switches to show SprintTracker component
  AND the [Sprint] button is replaced with [Phases] button
  AND the transition occurs without page reload (<50ms)

AC6.42: View preference persists to localStorage
  GIVEN the user has toggled to Phases view
  WHEN the page is reloaded
  THEN the Phases view is displayed (not Sprint Tracker)
  AND given the user toggles back to Sprint view
  WHEN the page is reloaded
  THEN the Sprint Tracker view is displayed
  AND the preference key is 'claude-container-workflow-view-mode'

AC6.43: Sidebar compact view shows current story summary
  GIVEN the Sprint Tracker is active
  WHEN the sidebar WorkflowProgress component is in compact view
  THEN it displays the current story in format: "Epic {N} · Story {id} · {status}"
  AND example: "Epic 4 · Story 4-16 · review"
  AND the current story is determined as first non-done story in current epic
  AND if all stories done, show "Epic {N} · All stories complete"

AC6.44: Sidebar action button executes workflow
  GIVEN the sidebar compact view shows current story with status "review"
  WHEN the WorkflowProgress sidebar displays the action button
  THEN it shows [▶ Review] button
  AND clicking the button sends the same command as in Sprint Tracker
  AND the command format is: /bmad:bmm:workflows:code-review {storyId}
  AND for status "drafted" → [▶ Context]
  AND for status "ready-for-dev" → [▶ Start]
  AND for status "done" or "backlog" → no button shown
```

## Tasks / Subtasks

- [ ] **Task 1: Add view mode state to LayoutContext** (AC6.39, AC6.40, AC6.41)
  - [ ] 1.1: Extend LayoutContext interface:
    ```typescript
    interface LayoutContextState {
      // existing fields...
      workflowViewMode: 'sprint' | 'phases';
    }
    interface LayoutContextActions {
      // existing methods...
      setWorkflowViewMode: (mode: 'sprint' | 'phases') => void;
    }
    ```
  - [ ] 1.2: Add state initialization in LayoutContext.tsx:
    ```typescript
    const [workflowViewMode, setWorkflowViewMode] = useState<'sprint' | 'phases'>(
      loadWorkflowViewMode() ?? 'sprint'  // Default to 'sprint'
    );
    ```
  - [ ] 1.3: Implement setWorkflowViewMode action:
    ```typescript
    const handleSetWorkflowViewMode = (mode: 'sprint' | 'phases') => {
      setWorkflowViewMode(mode);
      saveWorkflowViewMode(mode);  // Persist to localStorage
    };
    ```
  - [ ] 1.4: Export workflowViewMode and setWorkflowViewMode in context value
  - [ ] 1.5: Test context state initialization with default value 'sprint'
  - [ ] 1.6: Test context state updates when setWorkflowViewMode called

- [ ] **Task 2: Implement localStorage persistence** (AC6.42)
  - [ ] 2.1: Create localStorage helper in frontend/src/utils/localStorage.ts:
    ```typescript
    const WORKFLOW_VIEW_MODE_KEY = 'claude-container-workflow-view-mode';

    export const loadWorkflowViewMode = (): 'sprint' | 'phases' | null => {
      try {
        const stored = localStorage.getItem(WORKFLOW_VIEW_MODE_KEY);
        if (stored === 'sprint' || stored === 'phases') return stored;
        return null;
      } catch (error) {
        console.warn('[localStorage] Failed to load workflow view mode:', error);
        return null;
      }
    };

    export const saveWorkflowViewMode = (mode: 'sprint' | 'phases'): void => {
      try {
        localStorage.setItem(WORKFLOW_VIEW_MODE_KEY, mode);
      } catch (error) {
        console.error('[localStorage] Failed to save workflow view mode:', error);
      }
    };
    ```
  - [ ] 2.2: Import helpers in LayoutContext.tsx
  - [ ] 2.3: Call loadWorkflowViewMode() on context initialization
  - [ ] 2.4: Call saveWorkflowViewMode() in setWorkflowViewMode handler
  - [ ] 2.5: Handle localStorage quota errors gracefully (try/catch)
  - [ ] 2.6: Test persistence: set mode → reload → verify mode preserved
  - [ ] 2.7: Test default fallback when localStorage empty (first-time user)

- [ ] **Task 3: Add view toggle buttons to MainContentArea** (AC6.40, AC6.41)
  - [ ] 3.1: Import workflowViewMode and setWorkflowViewMode from LayoutContext in MainContentArea.tsx
  - [ ] 3.2: Render toggle button in header when workflow content is active:
    ```tsx
    {mainContentMode === 'artifact' && selectedFile === 'workflow' && (
      <div className="workflow-view-toggle">
        {workflowViewMode === 'sprint' ? (
          <Button onClick={() => setWorkflowViewMode('phases')}>
            [Phases]
          </Button>
        ) : (
          <Button onClick={() => setWorkflowViewMode('sprint')}>
            [Sprint]
          </Button>
        )}
      </div>
    )}
    ```
  - [ ] 3.3: Position button in top-right corner of workflow header
  - [ ] 3.4: Use shadcn/ui Button component with variant="outline"
  - [ ] 3.5: Ensure button is keyboard accessible (Tab, Enter/Space)
  - [ ] 3.6: Add hover state styling for button
  - [ ] 3.7: Test rapid toggling (should be smooth, no flash)

- [ ] **Task 4: Conditionally render Sprint Tracker or WorkflowDiagram** (AC6.39-AC6.41)
  - [ ] 4.1: Modify MainContentArea.tsx workflow rendering logic:
    ```tsx
    {selectedFile === 'workflow' && (
      workflowViewMode === 'sprint' ? (
        <SprintTracker />
      ) : (
        <WorkflowDiagram />
      )
    )}
    ```
  - [ ] 4.2: Ensure WorkflowDiagram.tsx import exists (from Story 3.x)
  - [ ] 4.3: Ensure SprintTracker.tsx import exists (from Story 6.3)
  - [ ] 4.4: Verify components unmount properly when switching views
  - [ ] 4.5: Test view transition performance (<50ms target per AC)
  - [ ] 4.6: Test that SprintTracker renders by default on first load
  - [ ] 4.7: Test that toggling switches components correctly

- [ ] **Task 5: Enhance WorkflowProgress.tsx with current story summary** (AC6.43)
  - [ ] 5.1: Import SprintContext (or WorkflowContext if sprint data merged)
  - [ ] 5.2: Extract currentStory from sprint status:
    ```typescript
    const { sprintStatus } = useSprintContext();
    const currentStory = sprintStatus?.currentStory;  // From Story 6.1
    const currentEpic = sprintStatus?.currentEpic;
    ```
  - [ ] 5.3: Parse currentStory to extract story ID and status:
    ```typescript
    const story = sprintStatus?.stories.find(s => s.storyId === currentStory);
    const epicNumber = story?.epicNumber ?? currentEpic;
    const storyId = story?.storyId;  // e.g., "4-16"
    const status = story?.status;  // e.g., "review"
    ```
  - [ ] 5.4: Render current story summary in compact view:
    ```tsx
    <div className="workflow-progress-compact">
      <div className="workflow-header">
        BMAD Workflow  [View]
      </div>
      {currentStory ? (
        <div className="current-story-summary">
          Epic {epicNumber} · Story {storyId} · {status}
        </div>
      ) : (
        <div className="current-story-summary">
          Epic {epicNumber} · All stories complete
        </div>
      )}
    </div>
    ```
  - [ ] 5.5: Style summary with muted text color (gray)
  - [ ] 5.6: Ensure summary fits in compact sidebar width
  - [ ] 5.7: Test with different story statuses (drafted, review, done, etc.)
  - [ ] 5.8: Test when no current story exists (all complete)

- [ ] **Task 6: Add action button to WorkflowProgress sidebar** (AC6.44)
  - [ ] 6.1: Determine action button label based on story status:
    ```typescript
    const getActionButton = (status: StoryStatus) => {
      switch (status) {
        case 'drafted': return { label: '[▶ Context]', command: 'story-context' };
        case 'ready-for-dev': return { label: '[▶ Start]', command: 'dev-story' };
        case 'review': return { label: '[▶ Review]', command: 'code-review' };
        case 'in-progress': return { label: '[▶ Continue]', command: null };  // Just focus terminal
        default: return null;  // done, backlog, or unknown
      }
    };
    ```
  - [ ] 6.2: Render action button in compact view:
    ```tsx
    {currentStory && actionButton && (
      <Button onClick={() => executeWorkflow(actionButton.command, storyId)}>
        {actionButton.label}
      </Button>
    )}
    ```
  - [ ] 6.3: Implement executeWorkflow function (reuse logic from SprintTracker Story 6.5):
    ```typescript
    const executeWorkflow = (command: string, storyId: string) => {
      const { activeSessionId } = useSessionContext();
      if (!activeSessionId) {
        toast.error('No active session');
        return;
      }
      const fullCommand = `/bmad:bmm:workflows:${command} ${storyId}\n`;
      sendMessage({ type: 'terminal.input', sessionId: activeSessionId, data: fullCommand });
      setMainContentMode('terminal');  // Focus terminal
    };
    ```
  - [ ] 6.4: Test clicking [▶ Review] sends code-review command
  - [ ] 6.5: Test clicking [▶ Start] sends dev-story command
  - [ ] 6.6: Test clicking [▶ Context] sends story-context command
  - [ ] 6.7: Test no button rendered for done/backlog status
  - [ ] 6.8: Test error handling when no active session exists

- [ ] **Task 7: Update LayoutContext initialization to default Sprint view** (AC6.39)
  - [ ] 7.1: Verify workflowViewMode defaults to 'sprint' in useState initialization
  - [ ] 7.2: Update any existing code that sets workflowViewMode to 'phases' as default
  - [ ] 7.3: Test first-time app load shows Sprint Tracker (no localStorage)
  - [ ] 7.4: Test clicking "View" in sidebar opens Sprint Tracker by default
  - [ ] 7.5: Verify WorkflowDiagram only visible after clicking [Phases]

- [ ] **Task 8: Handle SprintTracker unavailable gracefully** (Reliability)
  - [ ] 8.1: Check if sprintStatus is null/unavailable in MainContentArea
  - [ ] 8.2: If sprintStatus unavailable and workflowViewMode === 'sprint':
    ```tsx
    {!sprintStatus && workflowViewMode === 'sprint' ? (
      <div className="sprint-unavailable">
        <p>Sprint Tracker data unavailable</p>
        <Button onClick={() => setWorkflowViewMode('phases')}>
          View Phases Diagram
        </Button>
      </div>
    ) : (
      <SprintTracker />
    )}
    ```
  - [ ] 8.3: Show fallback message with option to switch to Phases view
  - [ ] 8.4: Test with missing sprint-status.yaml file
  - [ ] 8.5: Test with malformed sprint-status.yaml
  - [ ] 8.6: Ensure graceful degradation without crash

- [ ] **Task 9: Write comprehensive unit tests** (All ACs)
  - [ ] 9.1: Test LayoutContext workflowViewMode default value is 'sprint'
  - [ ] 9.2: Test setWorkflowViewMode updates state
  - [ ] 9.3: Test localStorage.getItem called on context init
  - [ ] 9.4: Test localStorage.setItem called on setWorkflowViewMode
  - [ ] 9.5: Test MainContentArea renders SprintTracker when mode='sprint'
  - [ ] 9.6: Test MainContentArea renders WorkflowDiagram when mode='phases'
  - [ ] 9.7: Test toggle button switches between Sprint/Phases
  - [ ] 9.8: Test WorkflowProgress renders current story summary
  - [ ] 9.9: Test WorkflowProgress action button calls executeWorkflow
  - [ ] 9.10: Test WorkflowProgress shows correct button per status
  - [ ] 9.11: Test WorkflowProgress with no current story (all complete)
  - [ ] 9.12: Mock SprintContext for story data
  - [ ] 9.13: Mock LayoutContext for view mode state

- [ ] **Task 10: Integration testing with view persistence** (AC6.39-AC6.44)
  - [ ] 10.1: Test full flow: Open app → Sprint Tracker visible by default
  - [ ] 10.2: Test toggle to Phases → reload → Phases view persists
  - [ ] 10.3: Test toggle back to Sprint → reload → Sprint view persists
  - [ ] 10.4: Test sidebar action button click → command sent to terminal
  - [ ] 10.5: Test current story summary updates when sprint-status.yaml changes
  - [ ] 10.6: Test view mode toggle performance (<50ms)
  - [ ] 10.7: Test keyboard navigation (Tab to button, Enter/Space to activate)
  - [ ] 10.8: Test dark mode styling for all new components
  - [ ] 10.9: Test with multiple stories (drafted, review, done) in current epic
  - [ ] 10.10: Test fallback when SprintTracker unavailable

## Dev Notes

### Architecture Alignment

This story integrates view mode state into the existing LayoutContext and enhances WorkflowProgress with sprint-aware display:

**Dependencies from Previous Stories:**
- **Story 6.3 (Sprint Tracker)**: SprintTracker.tsx component to be shown as default
- **Story 6.1 (Sprint Status Parser)**: SprintContext provides currentStory and currentEpic data
- **Story 3.3 (LeftSidebar)**: WorkflowProgress.tsx compact view to be enhanced
- **Story 3.3 (LayoutContext)**: Extend with workflowViewMode state management
- **Story 3.2 (WorkflowDiagram)**: Keep as alternate view accessible via [Phases] button
- **Story 6.5 (Action Buttons)**: Reuse executeWorkflow pattern for sidebar button

**Modified Components:**
- `LayoutContext.tsx` - Add workflowViewMode state and setWorkflowViewMode action
- `MainContentArea.tsx` - Conditionally render SprintTracker or WorkflowDiagram based on mode
- `WorkflowProgress.tsx` - Add current story summary and action button in compact view
- `frontend/src/utils/localStorage.ts` - Add loadWorkflowViewMode and saveWorkflowViewMode helpers

**ADR Compliance:**
- **ADR-005 (React Context API)**: Extend existing LayoutContext for view mode state
- **ADR-013 (WebSocket Protocol)**: Reuse terminal.input message for sidebar action button
- **localStorage**: Follow existing persistence pattern (Story 3.8, 6.6, 6.7)
- **UI Components**: Use existing shadcn/ui Button component
- **Performance**: View toggle <50ms (component swap, no data fetch)

### UI Component Structure

**View Toggle Button (MainContentArea header):**
```
┌─────────────────────────────────────────────────────────┐
│ Workflow                                      [Phases]  │ [Sprint view]
└─────────────────────────────────────────────────────────┘
                    or
┌─────────────────────────────────────────────────────────┐
│ Workflow                                      [Sprint]  │ [Phases view]
└─────────────────────────────────────────────────────────┘
```

**Sidebar Compact View (WorkflowProgress):**
```
┌─────────────────────────────────────────────────────────┐
│ BMAD Workflow                                   [View]  │
│ Epic 4 · Story 4-16 · review                            │
│                                          [▶ Review]      │
└─────────────────────────────────────────────────────────┘
```

**Current Story Summary Format:**
- With current story: `Epic {epicNumber} · Story {storyId} · {status}`
- All stories complete: `Epic {epicNumber} · All stories complete`
- Example: `Epic 4 · Story 4-16 · review`

**Action Button Labels (sidebar):**
- `drafted` → `[▶ Context]`
- `ready-for-dev` → `[▶ Start]`
- `review` → `[▶ Review]`
- `in-progress` → `[▶ Continue]` (or just focus terminal)
- `done` / `backlog` → No button

### Data Flow

```
LayoutContext.workflowViewMode ('sprint' | 'phases')
  ↓
Load from localStorage: loadWorkflowViewMode()
  ├─ If stored: use stored value ('sprint' or 'phases')
  └─ If not stored: default to 'sprint'
  ↓
MainContentArea renders based on workflowViewMode:
  ├─ mode='sprint' → <SprintTracker />
  └─ mode='phases' → <WorkflowDiagram />
  ↓
Toggle button in header:
  ├─ Sprint view → [Phases] button → setWorkflowViewMode('phases')
  └─ Phases view → [Sprint] button → setWorkflowViewMode('sprint')
  ↓
On setWorkflowViewMode(mode):
  ├─ Update state: setWorkflowViewMode(mode)
  └─ Save to localStorage: saveWorkflowViewMode(mode)
  ↓
Component re-renders with new view

Sidebar WorkflowProgress (compact view):
  ↓
SprintContext.sprintStatus (from Story 6.1)
  ├─ currentEpic: number
  ├─ currentStory: string | null
  └─ stories: StoryData[]
  ↓
Extract current story details:
  ├─ epicNumber from story.epicNumber
  ├─ storyId from story.storyId (e.g., "4-16")
  └─ status from story.status (e.g., "review")
  ↓
Render current story summary:
  "Epic {epicNumber} · Story {storyId} · {status}"
  ↓
Determine action button based on status:
  ├─ drafted → [▶ Context]
  ├─ ready-for-dev → [▶ Start]
  ├─ review → [▶ Review]
  └─ done/backlog → no button
  ↓
Click action button → executeWorkflow():
  ├─ Get activeSessionId from SessionContext
  ├─ Build command: `/bmad:bmm:workflows:{command} {storyId}\n`
  ├─ Send WebSocket: { type: 'terminal.input', sessionId, data }
  └─ Focus terminal: setMainContentMode('terminal')
```

### localStorage Implementation

```typescript
// frontend/src/utils/localStorage.ts (extend existing)
const WORKFLOW_VIEW_MODE_KEY = 'claude-container-workflow-view-mode';

export const loadWorkflowViewMode = (): 'sprint' | 'phases' | null => {
  try {
    const stored = localStorage.getItem(WORKFLOW_VIEW_MODE_KEY);
    if (stored === 'sprint' || stored === 'phases') return stored;
    return null;  // Invalid or missing → use default
  } catch (error) {
    console.warn('[localStorage] Failed to load workflow view mode:', error);
    return null;
  }
};

export const saveWorkflowViewMode = (mode: 'sprint' | 'phases'): void => {
  try {
    localStorage.setItem(WORKFLOW_VIEW_MODE_KEY, mode);
  } catch (error) {
    console.error('[localStorage] Failed to save workflow view mode:', error);
    // Graceful degradation: continue without persistence
  }
};

// Usage in LayoutContext:
const [workflowViewMode, setWorkflowViewMode] = useState<'sprint' | 'phases'>(
  loadWorkflowViewMode() ?? 'sprint'  // Default to 'sprint'
);

const handleSetWorkflowViewMode = (mode: 'sprint' | 'phases') => {
  setWorkflowViewMode(mode);
  saveWorkflowViewMode(mode);
};
```

### WorkflowProgress Enhancement

```tsx
// frontend/src/components/WorkflowProgress.tsx (modify compact view)
import { useSprintContext } from '@/context/SprintContext';
import { useSessionContext } from '@/context/SessionContext';
import { useLayoutContext } from '@/context/LayoutContext';

const WorkflowProgress = ({ isCompact }: { isCompact: boolean }) => {
  const { sprintStatus } = useSprintContext();
  const { activeSessionId } = useSessionContext();
  const { setMainContentMode } = useLayoutContext();
  const { sendMessage } = useWebSocket();

  const currentStory = sprintStatus?.stories.find(s => s.storyId === sprintStatus?.currentStory);
  const currentEpic = currentStory?.epicNumber ?? sprintStatus?.currentEpic;

  const getActionButton = (status: string) => {
    switch (status) {
      case 'drafted': return { label: '[▶ Context]', command: 'story-context' };
      case 'ready-for-dev': return { label: '[▶ Start]', command: 'dev-story' };
      case 'review': return { label: '[▶ Review]', command: 'code-review' };
      case 'in-progress': return { label: '[▶ Continue]', command: null };
      default: return null;
    }
  };

  const executeWorkflow = (command: string | null, storyId: string) => {
    if (!activeSessionId) {
      toast.error('No active session');
      return;
    }
    if (command) {
      const fullCommand = `/bmad:bmm:workflows:${command} ${storyId}\n`;
      sendMessage({ type: 'terminal.input', sessionId: activeSessionId, data: fullCommand });
    }
    setMainContentMode('terminal');
  };

  if (isCompact) {
    return (
      <div className="workflow-progress-compact">
        <div className="workflow-header">
          BMAD Workflow  <button onClick={() => setSelectedFile('workflow')}>[View]</button>
        </div>
        {currentStory ? (
          <>
            <div className="current-story-summary text-sm text-gray-600 dark:text-gray-400">
              Epic {currentEpic} · Story {currentStory.storyId} · {currentStory.status}
            </div>
            {getActionButton(currentStory.status) && (
              <Button onClick={() => executeWorkflow(getActionButton(currentStory.status).command, currentStory.storyId)}>
                {getActionButton(currentStory.status).label}
              </Button>
            )}
          </>
        ) : (
          <div className="current-story-summary text-sm text-gray-600 dark:text-gray-400">
            Epic {currentEpic} · All stories complete
          </div>
        )}
      </div>
    );
  }

  // ... expanded view (existing)
};
```

### MainContentArea View Toggle

```tsx
// frontend/src/components/MainContentArea.tsx (modify workflow rendering)
import { useLayoutContext } from '@/context/LayoutContext';
import { SprintTracker } from '@/components/SprintTracker';
import { WorkflowDiagram } from '@/components/WorkflowDiagram';

const MainContentArea = () => {
  const { workflowViewMode, setWorkflowViewMode, selectedFile } = useLayoutContext();

  return (
    <div className="main-content-area">
      {selectedFile === 'workflow' && (
        <>
          {/* View toggle button in header */}
          <div className="workflow-header">
            <h2>Workflow</h2>
            <Button
              variant="outline"
              onClick={() => setWorkflowViewMode(workflowViewMode === 'sprint' ? 'phases' : 'sprint')}
            >
              {workflowViewMode === 'sprint' ? '[Phases]' : '[Sprint]'}
            </Button>
          </div>

          {/* Conditionally render view */}
          {workflowViewMode === 'sprint' ? (
            <SprintTracker />
          ) : (
            <WorkflowDiagram />
          )}
        </>
      )}
      {/* ... other content modes */}
    </div>
  );
};
```

### Testing Strategy

**Component Tests (Vitest):**
- LayoutContext workflowViewMode initialization → default 'sprint'
- LayoutContext setWorkflowViewMode → state updates, localStorage called
- MainContentArea renders SprintTracker when mode='sprint'
- MainContentArea renders WorkflowDiagram when mode='phases'
- Toggle button click → setWorkflowViewMode called with opposite mode
- WorkflowProgress renders current story summary with correct format
- WorkflowProgress action button label matches story status
- WorkflowProgress executeWorkflow sends correct command
- localStorage helpers return expected values (valid/invalid/missing)

**Integration Tests:**
- Full flow: Load app → Sprint Tracker visible by default
- Toggle to Phases → reload → Phases view persists
- Toggle back to Sprint → reload → Sprint view persists
- Sidebar action button click → terminal receives command
- Current story summary updates when sprint-status.yaml changes
- View mode toggle performance (<50ms)

**Manual Testing Checklist:**
- First-time user sees Sprint Tracker by default (no localStorage)
- Click [Phases] → WorkflowDiagram appears, button changes to [Sprint]
- Click [Sprint] → SprintTracker appears, button changes to [Phases]
- Reload after each toggle → preference persists
- Sidebar shows "Epic {N} · Story {id} · {status}" format
- Sidebar action button ([▶ Review], etc.) sends command to terminal
- Test with all story statuses (drafted, ready-for-dev, review, done, backlog)
- Test dark mode styling for new components
- Test keyboard navigation (Tab, Enter/Space)

### Learnings from Previous Story

**From Story 6.7 (Epic Navigation and Selection)**

Story 6.7 created the EpicSelector dropdown component for switching between epics. Key learnings to apply:

- **Context Integration**: Successfully integrated SprintContext for epic data. This story will similarly use LayoutContext for view mode state - follow same pattern of extracting context at component top level.

- **localStorage Persistence**: Story 6.7 implemented epic selection persistence using simple number storage. This story will use similar pattern for view mode (single string 'sprint' | 'phases').

- **Component Reusability**: Story 6.7 showed that inline rendering is effective for toggles. The view toggle button can be a simple inline Button component.

- **Dark Mode Support**: Story 6.7 ensured all styling supports dark mode with semantic color classes. This story will use same approach for button and summary text.

- **Empty State Handling**: Story 6.7 handled missing epic data with graceful fallback. This story handles missing sprint status with fallback to Phases view.

- **Testing with Mocks**: Story 6.7 demonstrated mocking SprintContext for tests. This story will mock both SprintContext (for sidebar summary) and LayoutContext (for view mode).

- **State Management Pattern**: Story 6.7 established selection state management with localStorage sync. This story reuses exact same pattern: useState + load on mount + save on change.

**Implementation Recommendations:**

1. **Reuse localStorage Pattern**: Follow Story 3.8, 6.6, 6.7 pattern. Store view mode as simple string, load on mount, save on change.

2. **Context Extension**: Extend LayoutContext (already has selectedFile, mainContentMode) with workflowViewMode. Maintain consistency with existing context patterns.

3. **View Toggle Button**: Use shadcn/ui Button component with variant="outline". Position in workflow header, similar to other action buttons.

4. **Sidebar Enhancement**: WorkflowProgress already has compact/expanded modes (Story 3.3). Add current story summary and action button to compact mode only.

5. **Action Button Reuse**: Story 6.5 established executeWorkflow pattern. Reuse exact same logic for sidebar button (WebSocket terminal.input, focus terminal).

6. **Performance Optimization**: View toggle is just component swap (no data fetch). Use React's built-in re-rendering, no optimization needed.

**New Patterns to Establish:**

- **View Mode Toggle**: First component with persistent view preferences. Pattern reusable for other multi-view components (e.g., terminal split modes).
- **Sidebar Action Button**: First sidebar component with workflow execution capability. Pattern reusable for quick actions from sidebar.
- **Default View Preference**: Establishing Sprint Tracker as default aligns with execution-focused workflow (not just documentation).

[Source: docs/sprint-artifacts/6-7-epic-navigation-and-selection.md#Learnings from Previous Story]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#AC6.39-AC6.44]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.8]
- [Story 6.7 (Epic Navigation): docs/sprint-artifacts/6-7-epic-navigation-and-selection.md]
- [Story 6.5 (Action Buttons): docs/sprint-artifacts/6-5-action-buttons-for-workflow-execution.md]
- [Story 6.3 (Sprint Tracker): docs/sprint-artifacts/6-3-sprint-tracker-component-mvp-view.md]
- [Story 3.3 (LeftSidebar): docs/sprint-artifacts/3-3-left-sidebar-with-files-workflow-toggle.md]
- [Story 3.8 (Resizable Panels): docs/sprint-artifacts/3-8-resizable-panel-handles-for-layout-customization.md]
- [LayoutContext implementation: frontend/src/context/LayoutContext.tsx]

## Estimated Effort

2-3 hours

## Dependencies

- Story 6.3 (Sprint Tracker) - provides SprintTracker.tsx component to be shown as default
- Story 6.1 (Sprint Status Parser) - provides SprintContext with currentStory and currentEpic
- Story 3.3 (LeftSidebar) - provides WorkflowProgress.tsx to be enhanced with summary
- Story 3.3 (LayoutContext) - provides context to extend with workflowViewMode state
- Story 3.2 (WorkflowDiagram) - provides alternate view accessible via [Phases] button
- Story 6.5 (Action Buttons) - provides executeWorkflow pattern for sidebar button
- shadcn/ui Button component - UI component for toggle button

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
