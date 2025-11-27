# Story 6.6: Collapsible Phase Overview

Status: drafted

## Story

As a developer,
I want the BMAD phases (Discovery, Planning, Solutioning) shown as collapsible sections with their artifacts,
So that I can see the full project history while focusing on current implementation work.

## Background

Building upon the Sprint Tracker component from Story 6.3 and artifact display from Story 6.4, this story adds collapsible sections for the completed BMAD phases (Discovery, Planning, Solutioning) above the current epic's story list. This provides full project visibility - showing all artifacts created in earlier phases - while keeping the focus on the Implementation phase where active development occurs.

The phase sections collapse/expand via click, persist their state to localStorage, and display skipped steps with strikethrough styling. Completed phases show a checkmark in the header, while the Implementation section (current epic) remains expanded by default.

## Acceptance Criteria

```gherkin
AC6.29: Phase sections collapsible
  GIVEN the Sprint Tracker view is rendered
  WHEN phases Discovery, Planning, Solutioning are displayed
  THEN each phase appears as a collapsible section with clickable header
  AND clicking a phase header toggles expand/collapse
  AND the expand/collapse animation is smooth (350ms ease-out)

AC6.30: Collapse state persists to localStorage
  GIVEN a user collapses or expands a phase section
  WHEN the page is reloaded
  THEN the collapsed/expanded state is preserved
  AND localStorage key is: claude-container-sprint-collapsed
  AND value is a JSON array of collapsed section IDs

AC6.31: Implementation section expanded by default
  GIVEN the Sprint Tracker loads for the first time
  WHEN no localStorage state exists
  THEN Discovery, Planning, Solutioning phases are collapsed
  AND Implementation section (current epic) is expanded
  AND shows the full story list for current epic

AC6.32: Skipped steps shown with strikethrough
  GIVEN a phase step has status "skipped" in bmm-workflow-status.yaml
  WHEN that step is displayed in the phase section
  THEN the step text has gray color and strikethrough
  AND a ⊘ icon appears before the step name
  AND the step is not clickable (no action)

AC6.33: Completed phases show checkmark in header
  GIVEN a phase (Discovery, Planning, or Solutioning) has all steps completed
  WHEN the phase header is rendered
  THEN a green ✓ checkmark appears in the header
  AND the header shows completion ratio: "Discovery (3/3)"
  AND the phase is visually distinct from in-progress phases
```

## Tasks / Subtasks

- [ ] **Task 1: Create PhaseOverview.tsx component** (AC6.29, AC6.31)
  - [ ] 1.1: Create component file at frontend/src/components/PhaseOverview.tsx
  - [ ] 1.2: Define props interface:
    ```typescript
    interface PhaseOverviewProps {
      phases: PhaseData[];           // Discovery, Planning, Solutioning
      currentEpic: number;           // For Implementation section
      collapsedSections: Set<string>;
      onToggleSection: (sectionId: string) => void;
    }
    ```
  - [ ] 1.3: Import shadcn/ui Collapsible component (@radix-ui/react-collapsible)
  - [ ] 1.4: Render each phase as Collapsible with header and content
  - [ ] 1.5: Implement phase header with click handler:
    ```tsx
    <CollapsibleTrigger onClick={() => onToggleSection(phase.id)}>
      {phase.completionIcon} {phase.name} ({completed}/{total})
    </CollapsibleTrigger>
    ```
  - [ ] 1.6: Set default collapsed state for Discovery/Planning/Solutioning
  - [ ] 1.7: Set default expanded state for Implementation section
  - [ ] 1.8: Add CSS transition for smooth expand/collapse (350ms ease-out)

- [ ] **Task 2: Integrate PhaseData from WorkflowContext** (AC6.29)
  - [ ] 2.1: Import WorkflowContext to access phase step data
  - [ ] 2.2: Parse bmm-workflow-status.yaml data from existing WorkflowContext.workflowStatus
  - [ ] 2.3: Extract phase sections: Discovery, Planning, Solutioning
  - [ ] 2.4: Map each phase's steps with status (completed, skipped, pending)
  - [ ] 2.5: Extract artifact paths from step values in bmm-workflow-status.yaml
  - [ ] 2.6: Calculate completion ratio per phase (completed / total steps)
  - [ ] 2.7: Determine phase completion icon: ✓ (all done), ◉ (in-progress), ○ (not started)

- [ ] **Task 3: Implement collapse state persistence** (AC6.30)
  - [ ] 3.1: Create localStorage helper functions in frontend/src/utils/localStorage.ts:
    ```typescript
    const COLLAPSED_KEY = 'claude-container-sprint-collapsed';
    const loadCollapsed = (): Set<string> => { /* parse JSON array */ };
    const saveCollapsed = (collapsed: Set<string>) => { /* stringify to JSON */ };
    ```
  - [ ] 3.2: Load collapsed sections from localStorage on component mount
  - [ ] 3.3: Save collapsed sections to localStorage on toggle
  - [ ] 3.4: Use Set<string> for efficient collapsed state management
  - [ ] 3.5: Handle localStorage quota errors gracefully (fallback to memory-only)
  - [ ] 3.6: Test persistence across page reloads
  - [ ] 3.7: Default to Discovery/Planning/Solutioning collapsed if no localStorage

- [ ] **Task 4: Render phase steps with artifacts** (AC6.29, AC6.32)
  - [ ] 4.1: Map phase steps to StepRow components (reuse pattern from Story 6.4)
  - [ ] 4.2: For each step, display:
    ```tsx
    <div className="step-row">
      {statusIcon} {stepName}
      {artifacts.map(artifact => <ArtifactLink {...artifact} />)}
    </div>
    ```
  - [ ] 4.3: Use status icons from existing pattern: ✓ (done), ⊘ (skipped), ○ (pending)
  - [ ] 4.4: Show artifact paths nested under each step (align with Story 6.4 pattern)
  - [ ] 4.5: Render [View] buttons for each artifact (reuse from Story 6.4)
  - [ ] 4.6: Apply tree indentation for artifact list (├─ └─ visual hierarchy)
  - [ ] 4.7: Handle missing artifacts with "(missing)" label (exists: false)

- [ ] **Task 5: Implement skipped step styling** (AC6.32)
  - [ ] 5.1: Check step status in bmm-workflow-status.yaml data
  - [ ] 5.2: Apply conditional className for skipped steps:
    ```typescript
    const stepClassName = step.status === 'skipped'
      ? 'text-gray-400 line-through'
      : 'text-gray-900 dark:text-gray-100';
    ```
  - [ ] 5.3: Add ⊘ icon before skipped step names (lucide-react: Slash icon or custom)
  - [ ] 5.4: Disable click/interaction for skipped steps (no expand, no [View] buttons)
  - [ ] 5.5: Test visual distinction between skipped and completed steps
  - [ ] 5.6: Ensure dark mode support for gray strikethrough text

- [ ] **Task 6: Add completion indicators to phase headers** (AC6.33)
  - [ ] 6.1: Calculate completion ratio: completedSteps / totalSteps
  - [ ] 6.2: Determine phase status:
    ```typescript
    const getPhaseStatus = (phase: PhaseData): PhaseStatus => {
      if (phase.completed === phase.total) return 'completed';
      if (phase.completed > 0) return 'in-progress';
      return 'not-started';
    };
    ```
  - [ ] 6.3: Render completion indicator in header:
    ```tsx
    {phase.status === 'completed' ? '✓' : phase.status === 'in-progress' ? '◉' : '○'}
    ```
  - [ ] 6.4: Color checkmark green for completed phases (text-green-600)
  - [ ] 6.5: Display completion ratio in header: "Discovery (3/3)"
  - [ ] 6.6: Apply distinct styling for completed phases (bold text or background)
  - [ ] 6.7: Test with all phases completed vs. mixed states

- [ ] **Task 7: Integrate PhaseOverview into SprintTracker** (AC6.29, AC6.31)
  - [ ] 7.1: Import PhaseOverview component into SprintTracker.tsx
  - [ ] 7.2: Add phase overview section above epic story list:
    ```tsx
    <div className="sprint-tracker">
      <PhaseOverview phases={phases} currentEpic={currentEpic} ... />
      <EpicStoryList epic={currentEpic} stories={stories} />
    </div>
    ```
  - [ ] 7.3: Pass collapsed state and toggle handler from SprintTracker state
  - [ ] 7.4: Manage collapsed state in SprintContext or local SprintTracker state
  - [ ] 7.5: Ensure Implementation section always renders expanded by default
  - [ ] 7.6: Test layout spacing between phases and epic story list
  - [ ] 7.7: Verify phase data loads correctly from WorkflowContext

- [ ] **Task 8: Handle phase data unavailability** (Reliability)
  - [ ] 8.1: Check if bmm-workflow-status.yaml data is available
  - [ ] 8.2: If WorkflowContext.workflowStatus is null/empty:
    ```tsx
    return <div className="text-gray-500">Phase data unavailable</div>;
    ```
  - [ ] 8.3: Show placeholder message: "Phase data unavailable - phases hidden"
  - [ ] 8.4: Gracefully hide phase sections if parsing fails
  - [ ] 8.5: Log warning to console for debugging
  - [ ] 8.6: Test with missing bmm-workflow-status.yaml file
  - [ ] 8.7: Ensure Implementation section still renders if phases missing

- [ ] **Task 9: Write comprehensive unit tests** (All ACs)
  - [ ] 9.1: Test PhaseOverview renders with phase data
  - [ ] 9.2: Test clicking phase header toggles collapse/expand
  - [ ] 9.3: Test collapsed state persists to localStorage
  - [ ] 9.4: Test default collapsed state for Discovery/Planning/Solutioning
  - [ ] 9.5: Test default expanded state for Implementation
  - [ ] 9.6: Test skipped step styling (strikethrough, gray, ⊘ icon)
  - [ ] 9.7: Test completed phase checkmark in header (✓ green)
  - [ ] 9.8: Test completion ratio display: "(3/3)"
  - [ ] 9.9: Test phase data unavailable graceful fallback
  - [ ] 9.10: Test artifact display nested under steps
  - [ ] 9.11: Mock WorkflowContext for phase data
  - [ ] 9.12: Target: 50%+ frontend code coverage for PhaseOverview

- [ ] **Task 10: Integration testing with SprintTracker** (AC6.29-AC6.33)
  - [ ] 10.1: Test full SprintTracker with PhaseOverview + EpicStoryList
  - [ ] 10.2: Test collapse/expand all phases sequentially
  - [ ] 10.3: Test persistence: collapse phase → reload → verify still collapsed
  - [ ] 10.4: Test clicking artifact [View] button in phase section
  - [ ] 10.5: Test with real bmm-workflow-status.yaml data (if available)
  - [ ] 10.6: Test with mixed phase statuses (completed, in-progress, skipped)
  - [ ] 10.7: Verify smooth transitions (350ms) don't cause layout jank
  - [ ] 10.8: Test dark mode styling for all phase elements

## Dev Notes

### Architecture Alignment

This story integrates with Epic 3's workflow status parsing and Epic 6's sprint tracking:

**Dependencies from Previous Stories:**
- **Story 6.4 (Artifact Display)**: Reuse artifact rendering pattern with [View] buttons
- **Story 6.3 (Sprint Tracker)**: Integrate PhaseOverview above epic story list
- **Story 3.2 (Workflow Progress)**: WorkflowContext provides bmm-workflow-status.yaml data
- **Story 3.1 (Workflow Status Parser)**: statusParser.ts provides phase step data structure

**New Components:**
- `PhaseOverview.tsx` - Main component rendering collapsible phase sections
- `localStorage.ts` utils - Helpers for collapse state persistence (if not already exists)

**ADR Compliance:**
- **ADR-005 (React Context API)**: Use existing WorkflowContext for phase data
- **ADR-006 (YAML Parsing)**: Reuse parsed bmm-workflow-status.yaml from statusParser
- **UI Components**: Use shadcn/ui Collapsible from @radix-ui/react-collapsible
- **Performance**: CSS transitions (350ms ease-out) for smooth UX
- **Accessibility**: Collapsible components keyboard-accessible (Enter/Space to toggle)

### UI Component Structure

**PhaseOverview Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ ▶ Discovery (3/3)                                        ✓   │ [collapsed]
├──────────────────────────────────────────────────────────────┤
│ ▶ Planning (3/3)                                         ✓   │ [collapsed]
├──────────────────────────────────────────────────────────────┤
│ ▼ Solutioning (4/5)                                      ◉   │ [expanded]
│    ✓ Create Architecture                                     │
│       └─ 📄 architecture.md                          [View]  │
│    ⊘ Validate Architecture                             skipped│
│    ✓ Design Database Schema                                  │
│       └─ 📄 database-schema.md                       [View]  │
│    ○ Epic Tech Spec                                  pending │
├──────────────────────────────────────────────────────────────┤
│ ▼ Implementation - Epic 6 (5/10)                        ◉   │ [always expanded]
│    ✓ 6-1  Sprint status parser                         done │
│    ✓ 6-2  Artifact path derivation                     done │
│    ...                                                       │
└──────────────────────────────────────────────────────────────┘
```

**Phase Status Icons:**
- `✓` (green) = All steps completed
- `◉` (yellow) = Some steps completed (in-progress)
- `○` (gray) = No steps started (pending)

**Step Status Icons:**
- `✓` (green) = Completed step
- `⊘` (gray strikethrough) = Skipped step
- `○` (gray) = Pending step

**Collapse State:**
- Default: Discovery ▶, Planning ▶, Solutioning ▶ (collapsed)
- Implementation: Always ▼ (expanded, shows current work)
- Persisted to localStorage: `claude-container-sprint-collapsed: ["discovery", "planning"]`

### Data Flow

```
WorkflowContext.workflowStatus (from bmm-workflow-status.yaml)
  ↓
Parse phase sections: Discovery, Planning, Solutioning
  ↓
Extract steps per phase:
  - stepName: string
  - status: 'completed' | 'skipped' | 'pending'
  - artifactPath: string | null (from step value in YAML)
  ↓
Calculate completion ratio: (completedSteps / totalSteps)
  ↓
Determine phase status: completed | in-progress | not-started
  ↓
Render PhaseOverview with Collapsible sections
  ├─ Phase Header (click toggles collapse)
  ├─ Step Rows (status icon + name)
  └─ Artifact Links ([View] buttons)
  ↓
On header click:
  ├─ Toggle collapsed state in React state (Set<string>)
  ├─ Save to localStorage (JSON.stringify(Array.from(collapsedSet)))
  └─ Trigger re-render with updated collapse state
  ↓
On page reload:
  ├─ Load from localStorage: JSON.parse() → Set<string>
  └─ Apply collapsed state to Collapsible components
```

### Phase Data Structure

```typescript
// Derived from WorkflowContext.workflowStatus
interface PhaseData {
  id: string;                    // 'discovery' | 'planning' | 'solutioning'
  name: string;                  // 'Discovery' | 'Planning' | 'Solutioning'
  steps: StepData[];
  completed: number;             // Count of completed steps
  total: number;                 // Total steps in phase
  status: 'completed' | 'in-progress' | 'not-started';
}

interface StepData {
  name: string;                  // e.g., "Create Architecture"
  status: 'completed' | 'skipped' | 'pending';
  artifacts: ArtifactInfo[];     // From step value in YAML
}

// Example phase data:
{
  id: 'discovery',
  name: 'Discovery',
  steps: [
    { name: 'Product Brief', status: 'completed', artifacts: [{ path: 'docs/product-brief.md', exists: true }] },
    { name: 'Research', status: 'skipped', artifacts: [] },
    { name: 'Brainstorming', status: 'completed', artifacts: [{ path: 'docs/brainstorm-notes.md', exists: true }] }
  ],
  completed: 2,
  total: 3,
  status: 'completed'
}
```

### localStorage Implementation

```typescript
// frontend/src/utils/localStorage.ts (or inline in PhaseOverview)
const COLLAPSED_KEY = 'claude-container-sprint-collapsed';

export const loadCollapsedSections = (): Set<string> => {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (!stored) return new Set(['discovery', 'planning', 'solutioning']); // Default collapsed
    return new Set(JSON.parse(stored));
  } catch (error) {
    console.warn('[PhaseOverview] Failed to load collapsed state:', error);
    return new Set(['discovery', 'planning', 'solutioning']);
  }
};

export const saveCollapsedSections = (collapsed: Set<string>): void => {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(collapsed)));
  } catch (error) {
    console.error('[PhaseOverview] Failed to save collapsed state:', error);
    // Graceful degradation: continue without persistence
  }
};

// Usage in PhaseOverview:
const [collapsedSections, setCollapsedSections] = useState<Set<string>>(loadCollapsedSections);

const toggleSection = (sectionId: string) => {
  setCollapsedSections(prev => {
    const updated = new Set(prev);
    if (updated.has(sectionId)) {
      updated.delete(sectionId);
    } else {
      updated.add(sectionId);
    }
    saveCollapsedSections(updated);
    return updated;
  });
};
```

### Collapsible Component Usage

```tsx
import * as Collapsible from '@radix-ui/react-collapsible';

const PhaseOverview = ({ phases, collapsedSections, onToggleSection }) => {
  return (
    <div className="phase-overview">
      {phases.map(phase => (
        <Collapsible.Root
          key={phase.id}
          open={!collapsedSections.has(phase.id)}
          onOpenChange={() => onToggleSection(phase.id)}
        >
          <Collapsible.Trigger className="phase-header">
            <span className="phase-icon">
              {collapsedSections.has(phase.id) ? '▶' : '▼'}
            </span>
            <span className="phase-status">
              {phase.status === 'completed' ? '✓' : phase.status === 'in-progress' ? '◉' : '○'}
            </span>
            <span className="phase-name">{phase.name}</span>
            <span className="phase-ratio">({phase.completed}/{phase.total})</span>
          </Collapsible.Trigger>

          <Collapsible.Content className="phase-content">
            {phase.steps.map(step => (
              <div key={step.name} className={getStepClassName(step)}>
                {getStepIcon(step.status)} {step.name}
                {step.artifacts.map(artifact => (
                  <ArtifactLink key={artifact.path} {...artifact} />
                ))}
              </div>
            ))}
          </Collapsible.Content>
        </Collapsible.Root>
      ))}
    </div>
  );
};

const getStepClassName = (step: StepData): string => {
  if (step.status === 'skipped') {
    return 'step-row text-gray-400 dark:text-gray-500 line-through';
  }
  return 'step-row';
};

const getStepIcon = (status: StepStatus): string => {
  switch (status) {
    case 'completed': return '✓';
    case 'skipped': return '⊘';
    case 'pending': return '○';
  }
};
```

### CSS Transitions

```css
/* Add to global styles or PhaseOverview.module.css */
.phase-content {
  transition: max-height 350ms ease-out, opacity 350ms ease-out;
  overflow: hidden;
}

.phase-content[data-state='open'] {
  animation: slideDown 350ms ease-out;
}

.phase-content[data-state='closed'] {
  animation: slideUp 350ms ease-out;
}

@keyframes slideDown {
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: 1000px; /* Adjust based on content */
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    max-height: 1000px;
    opacity: 1;
  }
  to {
    max-height: 0;
    opacity: 0;
  }
}
```

### Testing Strategy

**Component Tests (Vitest):**
- Render PhaseOverview with mock phase data → verify headers rendered
- Click phase header → verify collapse state toggles
- Verify localStorage.getItem called on mount
- Verify localStorage.setItem called on toggle
- Render with skipped step → verify strikethrough + gray text
- Render with completed phase → verify green ✓ in header
- Render with no phase data → verify graceful fallback message
- Mock WorkflowContext with phase data

**Integration Tests:**
- Render full SprintTracker → verify PhaseOverview + EpicStoryList
- Toggle phase collapse → verify smooth animation
- Reload page → verify collapsed state persisted
- Click artifact [View] → verify ArtifactViewer opens

**Manual Testing Checklist:**
- Click each phase header → verify expand/collapse works
- Reload page → verify collapsed phases remain collapsed
- Verify skipped steps have ⊘ icon and strikethrough
- Verify completed phases have green ✓ checkmark
- Verify completion ratio "(3/3)" displayed correctly
- Test with empty phase data (no bmm-workflow-status.yaml)
- Test dark mode styling

### Learnings from Previous Story

**From Story 6.5 (Action Buttons for Workflow Execution)**

Story 6.5 added action buttons to story rows for workflow execution. Key learnings to apply:

- **Context Integration**: Story 6.5 used SessionContext and LayoutContext successfully. This story will use WorkflowContext for phase data - follow same pattern of extracting context at component top level.

- **Component Reusability**: Story 6.5 showed inline components can be effective (ActionButton in StoryRow). PhaseOverview can similarly inline step rendering logic initially, extract later if reused.

- **Dark Mode Support**: Story 6.5 ensured all styling supports dark mode. PhaseOverview will use semantic color classes: text-gray-400 dark:text-gray-500 for skipped steps, text-green-600 dark:text-green-500 for checkmarks.

- **Empty State Handling**: Story 6.5 handled missing active session with toast. This story handles missing phase data with graceful fallback message: "Phase data unavailable".

- **Testing with Mocks**: Story 6.5 demonstrated mocking contexts for tests. This story will mock WorkflowContext with sample phase data.

- **User Feedback**: Story 6.5 used toast notifications. This story uses visual indicators (icons, strikethrough) for status feedback.

**Implementation Recommendations:**

1. **Reuse Artifact Display Pattern**: Story 6.4 created artifact rendering with [View] buttons. Reuse this exact pattern for phase step artifacts.

2. **Collapse State Management**: Use localStorage pattern similar to Story 3.8 (resizable panels). Store Set<string> as JSON array.

3. **Default Collapsed State**: Initialize with Discovery/Planning/Solutioning collapsed, Implementation expanded. This focuses user on current work while preserving historical access.

4. **Smooth Transitions**: Use CSS transitions (350ms ease-out) consistent with Story 3.6 layout shifting.

5. **Phase Data Parsing**: WorkflowContext already has bmm-workflow-status.yaml parsed. Extract phase sections (Discovery, Planning, Solutioning) by filtering steps.

6. **Skipped Step Styling**: Clear visual distinction critical. Use ⊘ icon (Unicode U+2298 or lucide-react Slash), gray text, strikethrough.

**New Patterns to Establish:**

- **Collapsible Sections with Persistence**: First use of @radix-ui/react-collapsible with localStorage. Pattern will be reusable for other collapsible UI elements.
- **Phase Status Calculation**: Logic to determine completed/in-progress/not-started based on step statuses. Reusable for epic/sprint status indicators.
- **Historical Context Display**: Showing completed work alongside current work. Pattern applicable to retrospectives, past sprints.

[Source: docs/sprint-artifacts/6-5-action-buttons-for-workflow-execution.md#Learnings from Previous Story]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#Data Models - PhaseData structure]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.6]
- [Story 6.5 (Action Buttons): docs/sprint-artifacts/6-5-action-buttons-for-workflow-execution.md]
- [Story 6.4 (Artifact Display): docs/sprint-artifacts/6-4-artifact-display-under-steps.md]
- [Story 6.3 (Sprint Tracker): docs/sprint-artifacts/6-3-sprint-tracker-component-mvp-view.md]
- [Story 3.2 (Workflow Progress): docs/sprint-artifacts/3-2-workflow-progress-component-compact-linear-view.md]
- [Story 3.1 (Workflow Status Parser): docs/sprint-artifacts/3-1-bmad-workflow-status-yaml-parser.md]
- [@radix-ui/react-collapsible docs: https://www.radix-ui.com/primitives/docs/components/collapsible]

## Estimated Effort

3-4 hours

## Dependencies

- Story 6.3 (Sprint Tracker) - provides SprintTracker.tsx component for integration
- Story 6.4 (Artifact Display) - provides artifact rendering pattern with [View] buttons
- Story 3.2 (Workflow Progress) - provides WorkflowContext with bmm-workflow-status.yaml data
- Story 3.1 (Workflow Status Parser) - provides statusParser.ts with phase step parsing
- Epic 3 LayoutContext - provides setSelectedFile() for artifact viewing
- shadcn/ui Collapsible component (@radix-ui/react-collapsible) - UI component library

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
