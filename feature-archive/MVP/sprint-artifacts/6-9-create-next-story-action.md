# Story 6.9: Create Next Story Action

Status: drafted

## Story

As a developer,
I want action buttons to create the next story or start the next epic when appropriate,
So that I can continue the workflow without manually running commands.

## Background

The Sprint Tracker shows epic/story progress with action buttons for individual stories (Context, Start, Review from Story 6.5). However, when all stories in an epic reach completion states (done/review), there's no clear next action to continue the workflow. Developers must manually determine whether to create the next story or start the next epic, then type the appropriate command.

This story adds workflow continuation logic that determines when to show:
1. [+ Create Next Story] button - when all stories are done or in review (epic still active)
2. [+ Start Epic N+1] button - when epic is complete (all done + retrospective completed)

The buttons send the appropriate BMAD workflow commands to the terminal, maintaining the one-click execution pattern established in Story 6.5.

## Acceptance Criteria

```gherkin
AC6.45: [+ Create Next Story] shown when appropriate
  GIVEN all stories in current epic are "done" or "review"
  AND the epic retrospective is not "completed"
  WHEN the Sprint Tracker is displayed
  THEN a prominent action button appears: [+ Create Next Story]
  AND the button is positioned at the bottom of the story list
  AND the button has a distinct visual style (green accent, larger size)

AC6.46: Create story command sent
  GIVEN the [+ Create Next Story] button is visible
  WHEN the user clicks the button
  THEN the command is sent to terminal: "/bmad:bmm:workflows:create-story\n"
  AND the terminal panel is focused/expanded after sending
  AND a toast notification confirms: "Creating next story..."

AC6.47: [+ Start Epic N+1] shown when epic complete
  GIVEN all stories in current epic are "done"
  AND the epic retrospective status is "completed" or "optional"
  AND the next epic exists in sprint-status.yaml
  WHEN the Sprint Tracker is displayed
  THEN the action button shows: [+ Start Epic {N+1}]
  AND the button is positioned at the bottom of the epic section
  AND the button includes the next epic number (e.g., "Start Epic 7")

AC6.48: Epic context command sent
  GIVEN the [+ Start Epic N+1] button is visible for Epic 7
  WHEN the user clicks the button
  THEN the command is sent to terminal: "/bmad:bmm:workflows:epic-tech-context 7\n"
  AND the terminal panel is focused/expanded after sending
  AND a toast notification confirms: "Starting Epic 7 context generation..."
```

## Tasks / Subtasks

- [ ] **Task 1: Add workflow continuation logic to SprintTracker** (AC6.45, AC6.47)
  - [ ] 1.1: Import sprintStatus from SprintContext in SprintTracker.tsx
  - [ ] 1.2: Implement `shouldShowCreateNextStory()` logic:
    ```typescript
    const shouldShowCreateNextStory = (): boolean => {
      if (!sprintStatus) return false;

      const currentEpicStories = sprintStatus.stories.filter(
        s => s.epicNumber === sprintStatus.currentEpic
      );

      // All stories must be done or review
      const allStoriesCompleted = currentEpicStories.every(
        s => s.status === 'done' || s.status === 'review'
      );

      // Epic retrospective must not be completed (still active)
      const currentEpic = sprintStatus.epics.find(
        e => e.epicNumber === sprintStatus.currentEpic
      );
      const epicStillActive = currentEpic?.retrospective !== 'completed';

      return allStoriesCompleted && epicStillActive;
    };
    ```
  - [ ] 1.3: Implement `shouldShowStartNextEpic()` logic:
    ```typescript
    const shouldShowStartNextEpic = (): boolean => {
      if (!sprintStatus) return false;

      const currentEpicStories = sprintStatus.stories.filter(
        s => s.epicNumber === sprintStatus.currentEpic
      );

      // All stories must be done
      const allStoriesDone = currentEpicStories.every(
        s => s.status === 'done'
      );

      // Epic retrospective completed or optional
      const currentEpic = sprintStatus.epics.find(
        e => e.epicNumber === sprintStatus.currentEpic
      );
      const epicComplete =
        currentEpic?.retrospective === 'completed' ||
        currentEpic?.retrospective === 'optional';

      // Next epic exists
      const nextEpicNumber = sprintStatus.currentEpic + 1;
      const nextEpicExists = sprintStatus.epics.some(
        e => e.epicNumber === nextEpicNumber
      );

      return allStoriesDone && epicComplete && nextEpicExists;
    };
    ```
  - [ ] 1.4: Calculate next epic number:
    ```typescript
    const nextEpicNumber = sprintStatus?.currentEpic
      ? sprintStatus.currentEpic + 1
      : null;
    ```
  - [ ] 1.5: Test logic with various epic/story completion states
  - [ ] 1.6: Test edge case: no next epic exists (don't show button)
  - [ ] 1.7: Test edge case: retrospective status "optional" treated as complete

- [ ] **Task 2: Render workflow continuation buttons** (AC6.45, AC6.47)
  - [ ] 2.1: Add button rendering after story list in SprintTracker.tsx:
    ```tsx
    {/* Workflow continuation actions */}
    <div className="workflow-continuation-actions">
      {shouldShowCreateNextStory() && (
        <Button
          onClick={() => executeCreateNextStory()}
          variant="default"
          size="lg"
          className="create-next-story-button"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Next Story
        </Button>
      )}

      {shouldShowStartNextEpic() && nextEpicNumber && (
        <Button
          onClick={() => executeStartNextEpic(nextEpicNumber)}
          variant="default"
          size="lg"
          className="start-next-epic-button"
        >
          <Rocket className="h-5 w-5 mr-2" />
          Start Epic {nextEpicNumber}
        </Button>
      )}
    </div>
    ```
  - [ ] 2.2: Import Plus and Rocket icons from lucide-react
  - [ ] 2.3: Style buttons with distinct appearance (green accent, larger)
  - [ ] 2.4: Position buttons at bottom of story list with margin/padding
  - [ ] 2.5: Ensure buttons are keyboard accessible (Tab, Enter/Space)
  - [ ] 2.6: Add hover/focus states for visual feedback
  - [ ] 2.7: Test button visibility with different completion states

- [ ] **Task 3: Implement workflow execution functions** (AC6.46, AC6.48)
  - [ ] 3.1: Import required hooks and contexts:
    ```typescript
    import { useSessionContext } from '@/context/SessionContext';
    import { useLayoutContext } from '@/context/LayoutContext';
    import { useWebSocket } from '@/hooks/useWebSocket';
    import { toast } from '@/components/ui/toast';
    ```
  - [ ] 3.2: Implement `executeCreateNextStory()`:
    ```typescript
    const executeCreateNextStory = () => {
      const { activeSessionId } = useSessionContext();
      const { setMainContentMode } = useLayoutContext();
      const { sendMessage } = useWebSocket();

      if (!activeSessionId) {
        toast.error('No active session', {
          description: 'Create a session before running workflows'
        });
        return;
      }

      const command = '/bmad:bmm:workflows:create-story\n';
      sendMessage({
        type: 'terminal.input',
        sessionId: activeSessionId,
        data: command
      });

      toast.success('Creating next story...', {
        description: 'Check terminal for progress'
      });

      setMainContentMode('terminal');
    };
    ```
  - [ ] 3.3: Implement `executeStartNextEpic()`:
    ```typescript
    const executeStartNextEpic = (epicNumber: number) => {
      const { activeSessionId } = useSessionContext();
      const { setMainContentMode } = useLayoutContext();
      const { sendMessage } = useWebSocket();

      if (!activeSessionId) {
        toast.error('No active session', {
          description: 'Create a session before running workflows'
        });
        return;
      }

      const command = `/bmad:bmm:workflows:epic-tech-context ${epicNumber}\n`;
      sendMessage({
        type: 'terminal.input',
        sessionId: activeSessionId,
        data: command
      });

      toast.success(`Starting Epic ${epicNumber} context generation...`, {
        description: 'Check terminal for progress'
      });

      setMainContentMode('terminal');
    };
    ```
  - [ ] 3.4: Reuse executeWorkflow pattern from Story 6.5 (WebSocket terminal.input)
  - [ ] 3.5: Test command format matches BMAD workflow expectations
  - [ ] 3.6: Test terminal focus after command execution
  - [ ] 3.7: Test error handling when no active session exists

- [ ] **Task 4: Add toast notifications for user feedback** (AC6.46, AC6.48)
  - [ ] 4.1: Import toast component from shadcn/ui
  - [ ] 4.2: Show success toast on Create Next Story:
    - Title: "Creating next story..."
    - Description: "Check terminal for progress"
  - [ ] 4.3: Show success toast on Start Epic N+1:
    - Title: "Starting Epic {N} context generation..."
    - Description: "Check terminal for progress"
  - [ ] 4.4: Show error toast if no active session:
    - Title: "No active session"
    - Description: "Create a session before running workflows"
  - [ ] 4.5: Ensure toast auto-dismisses after 5 seconds
  - [ ] 4.6: Test toast appearance and timing
  - [ ] 4.7: Test multiple rapid clicks don't queue duplicate toasts

- [ ] **Task 5: Style workflow continuation buttons** (AC6.45, AC6.47)
  - [ ] 5.1: Create CSS class `workflow-continuation-actions`:
    ```css
    .workflow-continuation-actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
      padding: 1.5rem;
      border-top: 1px solid var(--border);
      justify-content: center;
    }
    ```
  - [ ] 5.2: Style `create-next-story-button`:
    ```css
    .create-next-story-button {
      background-color: var(--success);
      color: white;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
    }

    .create-next-story-button:hover {
      background-color: var(--success-hover);
    }
    ```
  - [ ] 5.3: Style `start-next-epic-button`:
    ```css
    .start-next-epic-button {
      background-color: var(--primary);
      color: white;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
    }

    .start-next-epic-button:hover {
      background-color: var(--primary-hover);
    }
    ```
  - [ ] 5.4: Use Oceanic Calm theme colors (green accent for create, blue for epic)
  - [ ] 5.5: Ensure buttons meet WCAG AA contrast requirements
  - [ ] 5.6: Add focus ring for keyboard navigation
  - [ ] 5.7: Test dark mode styling

- [ ] **Task 6: Handle edge cases and validation** (Reliability)
  - [ ] 6.1: Test when all stories done but retrospective not complete:
    - Should show: [+ Create Next Story]
    - Should NOT show: [+ Start Epic N+1]
  - [ ] 6.2: Test when all stories done AND retrospective complete:
    - Should show: [+ Start Epic N+1]
    - Should NOT show: [+ Create Next Story]
  - [ ] 6.3: Test when some stories in-progress:
    - Should NOT show either button
  - [ ] 6.4: Test when no next epic exists (last epic):
    - Should NOT show [+ Start Epic N+1]
    - May show [+ Create Next Story] if retrospective incomplete
  - [ ] 6.5: Test with retrospective: "optional" status:
    - Should treat as epic complete for button logic
  - [ ] 6.6: Test rapid button clicks (debounce or disable after click):
    ```typescript
    const [isExecuting, setIsExecuting] = useState(false);

    const executeCreateNextStory = async () => {
      if (isExecuting) return;
      setIsExecuting(true);
      // ... execution logic
      setTimeout(() => setIsExecuting(false), 2000);
    };
    ```
  - [ ] 6.7: Test button state when sprintStatus is null/loading
  - [ ] 6.8: Test button behavior across epic switches (selector from Story 6.7)

- [ ] **Task 7: Integration with existing action button patterns** (AC6.46, AC6.48)
  - [ ] 7.1: Verify consistency with Story 6.5 action buttons:
    - Same WebSocket message format (terminal.input)
    - Same terminal focus pattern (setMainContentMode)
    - Same error handling (toast on no active session)
  - [ ] 7.2: Reuse executeWorkflow logic from Story 6.5 if extracted to util
  - [ ] 7.3: Ensure button styling matches action button theme
  - [ ] 7.4: Test alongside existing story action buttons ([▶ Start], etc.)
  - [ ] 7.5: Verify commands execute in correct active session
  - [ ] 7.6: Test terminal output appears correctly after command sent
  - [ ] 7.7: Verify no conflicts with sidebar action button (Story 6.8)

- [ ] **Task 8: Update SprintContext if needed** (Data dependency)
  - [ ] 8.1: Check if SprintContext provides retrospective status:
    ```typescript
    interface EpicData {
      epicNumber: number;
      status: 'backlog' | 'contexted';
      retrospective: 'optional' | 'completed' | null;  // ✓ Already in spec
    }
    ```
  - [ ] 8.2: Verify sprintStatus.epics includes retrospective field
  - [ ] 8.3: If missing, extend backend parseSprintStatus() to extract retrospective
  - [ ] 8.4: Test retrospective status parsing from sprint-status.yaml:
    - `epic-6-retrospective: optional` → retrospective: 'optional'
    - `epic-6-retrospective: completed` → retrospective: 'completed'
    - No entry → retrospective: null
  - [ ] 8.5: Ensure WebSocket sprint.updated includes retrospective changes
  - [ ] 8.6: Test real-time update when retrospective marked complete

- [ ] **Task 9: Write comprehensive unit tests** (All ACs)
  - [ ] 9.1: Test shouldShowCreateNextStory() logic:
    - All stories done → true (if retro incomplete)
    - All stories review → true (if retro incomplete)
    - Mixed done/review → true
    - Some in-progress → false
    - Retro completed → false
  - [ ] 9.2: Test shouldShowStartNextEpic() logic:
    - All done + retro completed → true
    - All done + retro optional → true
    - All done + retro incomplete → false
    - Some review → false
    - No next epic → false
  - [ ] 9.3: Test button rendering conditions:
    - Create Next Story button visible when appropriate
    - Start Epic N+1 button visible when appropriate
    - Both hidden when neither condition met
    - Only one shows at a time (mutually exclusive)
  - [ ] 9.4: Test executeCreateNextStory():
    - Sends correct command format
    - Calls setMainContentMode('terminal')
    - Shows toast notification
    - Handles no active session error
  - [ ] 9.5: Test executeStartNextEpic():
    - Sends correct command with epic number
    - Calls setMainContentMode('terminal')
    - Shows toast with epic number
    - Handles no active session error
  - [ ] 9.6: Mock SprintContext for various completion states
  - [ ] 9.7: Mock SessionContext for active session presence
  - [ ] 9.8: Mock WebSocket sendMessage function
  - [ ] 9.9: Verify button click triggers correct execution function
  - [ ] 9.10: Test button disabled state during execution

- [ ] **Task 10: Integration testing with Sprint Tracker** (AC6.45-AC6.48)
  - [ ] 10.1: Test full flow: All stories done → [+ Create Next Story] appears
  - [ ] 10.2: Test click [+ Create Next Story] → command in terminal
  - [ ] 10.3: Test full flow: Retro complete → [+ Start Epic 7] appears
  - [ ] 10.4: Test click [+ Start Epic 7] → epic-tech-context command in terminal
  - [ ] 10.5: Test real-time update: story status change → button visibility updates
  - [ ] 10.6: Test real-time update: retrospective complete → button switches
  - [ ] 10.7: Test with multiple epics: button shows correct next epic number
  - [ ] 10.8: Test epic selector interaction: switch epic → button state updates
  - [ ] 10.9: Test alongside existing action buttons (no conflicts)
  - [ ] 10.10: Test keyboard navigation: Tab to button, Enter/Space activates

## Dev Notes

### Architecture Alignment

This story extends the Sprint Tracker workflow execution capabilities from Story 6.5. Key integration points:

**Dependencies from Previous Stories:**
- **Story 6.5 (Action Buttons)**: Reuse executeWorkflow pattern (WebSocket terminal.input, focus terminal, toast notifications)
- **Story 6.3 (Sprint Tracker)**: SprintTracker.tsx component to extend with continuation buttons
- **Story 6.1 (Sprint Status Parser)**: SprintContext provides epic/story completion states
- **Story 6.7 (Epic Navigation)**: Epic selector data for next epic number
- **Story 6.8 (Default View)**: No conflicts with sidebar action button

**Modified Components:**
- `SprintTracker.tsx` - Add workflow continuation logic and button rendering
- `SprintContext.tsx` - Verify retrospective status included in epic data (may need backend update)
- `statusParser.ts` (backend) - Ensure retrospective parsing from sprint-status.yaml

**ADR Compliance:**
- **ADR-013 (WebSocket Protocol)**: Reuse terminal.input message type for commands
- **ADR-005 (React Context API)**: Use SprintContext for epic/story state, SessionContext for activeSessionId
- **UI Components**: Use existing shadcn/ui Button component with custom styling
- **Performance**: Button logic <10ms (simple array operations), no data fetching

### UI Component Structure

**Workflow Continuation Buttons (bottom of story list):**
```
┌─────────────────────────────────────────────────────────┐
│ Epic 6: Interactive Workflow Tracker    [15/19 stories] │
├─────────────────────────────────────────────────────────┤
│ ✓ 6-1   Sprint Status YAML Parser              done     │
│ ✓ 6-2   Artifact Path Derivation               done     │
│ ...                                                      │
│ ◉ 6-8   Replace Swim Lane with Sprint Tracker  review   │
│ ◉ 6-9   Create Next Story Action               review   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│         [+ Create Next Story]                            │ ← Green button
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Or when epic complete:**
```
┌─────────────────────────────────────────────────────────┐
│ Epic 6: Interactive Workflow Tracker    [19/19 stories] │
├─────────────────────────────────────────────────────────┤
│ ✓ 6-1   Sprint Status YAML Parser              done     │
│ ...                                                      │
│ ✓ 6-10  Validation with Full Workflow          done     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│         [+ Start Epic 7]                                 │ ← Blue button
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Button Decision Logic:**
1. Check all stories in current epic
2. If all done/review AND retrospective incomplete → [+ Create Next Story]
3. If all done AND retrospective complete/optional AND next epic exists → [+ Start Epic N+1]
4. Otherwise → no button (workflow in progress)

### Data Flow

```
SprintContext.sprintStatus
  ├─ currentEpic: number
  ├─ epics: EpicData[]
  │   ├─ epicNumber
  │   ├─ status
  │   └─ retrospective: 'optional' | 'completed' | null
  └─ stories: StoryData[]
      ├─ epicNumber
      ├─ storyId
      └─ status
  ↓
SprintTracker workflow continuation logic:
  ├─ shouldShowCreateNextStory()
  │   ├─ Filter stories by currentEpic
  │   ├─ Check all done/review
  │   └─ Check retrospective !== 'completed'
  ├─ shouldShowStartNextEpic()
  │   ├─ Filter stories by currentEpic
  │   ├─ Check all done
  │   ├─ Check retrospective complete/optional
  │   └─ Check next epic exists
  └─ Render appropriate button
  ↓
Button click:
  ├─ executeCreateNextStory()
  │   ├─ Build command: "/bmad:bmm:workflows:create-story\n"
  │   ├─ Send WebSocket: terminal.input
  │   ├─ Focus terminal: setMainContentMode('terminal')
  │   └─ Toast: "Creating next story..."
  └─ executeStartNextEpic(epicNumber)
      ├─ Build command: "/bmad:bmm:workflows:epic-tech-context {N}\n"
      ├─ Send WebSocket: terminal.input
      ├─ Focus terminal: setMainContentMode('terminal')
      └─ Toast: "Starting Epic {N}..."
```

### Command Formats

**Create Next Story:**
```bash
/bmad:bmm:workflows:create-story
```
- No arguments needed - workflow auto-discovers next backlog story
- BMAD workflow reads sprint-status.yaml to find first backlog story
- Updates status from backlog → drafted

**Start Next Epic:**
```bash
/bmad:bmm:workflows:epic-tech-context 7
```
- Argument: next epic number
- BMAD workflow generates tech spec for specified epic
- Updates epic status from backlog → contexted

### Edge Cases and Validation

**Epic Completion States:**
- All done + retro incomplete → Show Create Next Story
- All done + retro completed → Show Start Epic N+1
- All done + retro optional → Show Start Epic N+1 (optional treated as complete)
- Mixed done/review → Show Create Next Story (some stories need work)
- Some in-progress → Show nothing (workflow in progress)

**Epic Boundary Conditions:**
- Last epic, all done, retro complete → No Start Epic button (no next epic)
- First epic, all done, retro incomplete → Show Create Next Story only
- Epic switch via selector → Recalculate button state for selected epic

**Session Handling:**
- No active session → Toast error, don't send command
- Active session → Send command, focus terminal, show toast
- Multiple rapid clicks → Debounce or disable button temporarily

### Testing Strategy

**Component Tests (Vitest):**
- shouldShowCreateNextStory() with various story/retro states
- shouldShowStartNextEpic() with various completion states
- Button rendering conditions (create, start, none)
- executeCreateNextStory() sends correct command
- executeStartNextEpic() sends correct command with epic number
- Error handling when no active session
- Button disabled during execution

**Integration Tests:**
- Full flow: All stories done → button appears → click → command in terminal
- Real-time update: status change → button visibility updates
- Epic selector interaction: switch epic → button state recalculates
- Toast notifications appear with correct messages
- Terminal focus after command execution

**Manual Testing Checklist:**
- Complete all stories in Epic 6 (done/review) → [+ Create Next Story] appears
- Click button → create-story command sent to terminal
- Mark retrospective complete → [+ Start Epic 7] appears
- Click button → epic-tech-context 7 command sent to terminal
- Test with Epic 4 (has next epic) vs Epic 6 (may be last)
- Test keyboard navigation (Tab to button, Enter/Space activates)
- Test dark mode styling for buttons

### Learnings from Previous Story

**From Story 6.8 (Replace Swim Lane with Sprint Tracker as Default)**

Story 6.8 created view toggle and sidebar enhancements. Key learnings to apply:

- **Context Integration**: Story 6.8 integrated LayoutContext for view mode state. This story will similarly use SprintContext for epic/story completion state.

- **localStorage Persistence**: Story 6.8 implemented view preference persistence. This story doesn't need persistence (button state is dynamic), but pattern is good reference.

- **Action Button Pattern**: Story 6.8 added sidebar action button reusing Story 6.5 pattern. This story will reuse the same executeWorkflow pattern (WebSocket terminal.input, focus terminal, toast).

- **Conditional Rendering**: Story 6.8 used conditional rendering based on workflowViewMode. This story uses similar conditional logic based on epic/story completion states.

- **Component Reusability**: Story 6.8 showed inline rendering is effective for buttons. This story will use inline Button components with custom styling.

- **Empty State Handling**: Story 6.8 handled missing sprint status gracefully. This story will handle edge cases (no next epic, no active session) with appropriate fallbacks.

**Implementation Recommendations:**

1. **Reuse Action Button Pattern**: Follow Story 6.5/6.8 pattern. Build command string, send via WebSocket terminal.input, focus terminal, show toast.

2. **Completion Logic**: Implement clear boolean functions (shouldShowCreateNextStory, shouldShowStartNextEpic) for maintainability and testability.

3. **Button Styling**: Use shadcn/ui Button component with custom classes. Green accent for create (success action), blue for epic (primary action).

4. **Error Handling**: Reuse no-active-session pattern from Story 6.8 sidebar button. Show toast error, don't send command.

5. **Real-Time Updates**: Sprint Tracker already updates via sprint.updated WebSocket (Story 6.3). Button visibility will automatically update when epic/story status changes.

6. **Epic Boundary**: Check for next epic existence before showing Start Epic button. Don't assume infinite epics.

**New Patterns to Establish:**

- **Workflow Continuation Logic**: First component with epic completion detection. Pattern reusable for other workflow automation features.
- **Dynamic Command Arguments**: First action button with dynamic argument (epic number). Pattern reusable for parameterized workflow commands.
- **Mutually Exclusive Actions**: Create vs Start epic logic establishes pattern for context-aware action selection.

[Source: docs/sprint-artifacts/6-8-replace-swim-lane-with-sprint-tracker-as-default.md#Learnings from Previous Story]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#AC6.45-AC6.48]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.9]
- [Story 6.8 (View Toggle): docs/sprint-artifacts/6-8-replace-swim-lane-with-sprint-tracker-as-default.md]
- [Story 6.5 (Action Buttons): docs/sprint-artifacts/6-5-action-buttons-for-workflow-execution.md]
- [Story 6.3 (Sprint Tracker): docs/sprint-artifacts/6-3-sprint-tracker-component-mvp-view.md]
- [Story 6.1 (Sprint Parser): docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md]
- [SprintContext implementation: frontend/src/context/SprintContext.tsx]

## Estimated Effort

2-3 hours

## Dependencies

- Story 6.5 (Action Buttons) - provides executeWorkflow pattern and WebSocket command injection
- Story 6.3 (Sprint Tracker) - provides SprintTracker.tsx component to extend
- Story 6.1 (Sprint Status Parser) - provides SprintContext with epic/story completion states
- Story 6.7 (Epic Navigation) - provides epic selector data for next epic number
- shadcn/ui Button component - UI component for action buttons
- lucide-react Plus and Rocket icons - icons for buttons

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
