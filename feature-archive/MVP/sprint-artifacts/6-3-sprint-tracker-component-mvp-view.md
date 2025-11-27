# Story 6.3: Sprint Tracker Component (MVP View)

Status: drafted

## Story

As a developer,
I want to see my current epic and story progress in a clear list view,
So that I know exactly where I am in the development process.

## Background

Building upon the sprint status parser from Story 6.1 and artifact derivation from Story 6.2, this story creates the main Sprint Tracker UI component that displays real-time epic/story progress. The component replaces the undersized "Sprint Planning" checkmark in the workflow visualization with an interactive list showing all stories in the current epic, their statuses, and a visual progress indicator.

This enables developers to instantly see which stories are done (✓), in review (◉), in-progress (→), drafted (○), or still backlog (·) without manually parsing YAML files or checking file system state.

## Acceptance Criteria

```gherkin
AC6.13: Sprint Tracker displays epic header with progress
  GIVEN sprint status data contains Epic 4 with 15/19 stories complete
  WHEN SprintTracker component renders
  THEN display header: "Epic 4: Production Stability [15/19 stories]"
  AND show visual progress bar at 15/19 (78.9%)

AC6.14: Status icons rendered correctly
  GIVEN stories with various statuses
  WHEN rendering story rows
  THEN display:
    - ✓ (green) for status "done"
    - ◉ (yellow) for status "review"
    - → (cyan) for status "in-progress"
    - ○ (gray) for status "drafted" or "ready-for-dev"
    - · (dim gray) for status "backlog"

AC6.15: Current story highlighted
  GIVEN currentStory = "4-16" (first non-done story)
  WHEN rendering story list
  THEN highlight story 4-16 with distinct background color
  AND ensure it's visible in viewport on initial render

AC6.16: Progress bar shows completion ratio
  GIVEN 15 stories done out of 19 total
  WHEN rendering progress bar
  THEN visual bar fills 78.9% of width
  AND shows numeric label "15/19"

AC6.17: Story row click expands to show artifacts
  GIVEN story row is collapsed
  WHEN user clicks on story row
  THEN toggle expansion to show artifact list (Story 6.4 integration)
  AND preserve collapse/expand state in component state

AC6.18: Real-time updates via WebSocket
  GIVEN WebSocket connection established
  WHEN sprint.updated message received
  THEN update story list with new statuses
  AND animate status icon changes
  AND update progress bar to new completion ratio
```

## Tasks / Subtasks

- [ ] **Task 1: Create SprintTracker.tsx component** (AC6.13-6.15)
  - [ ] 1.1: Create frontend/src/components/SprintTracker.tsx with TypeScript
  - [ ] 1.2: Import SprintStatus, EpicData, StoryData types from types.ts
  - [ ] 1.3: Accept props: sprintStatus (SprintStatus | null), selectedEpicNumber (number)
  - [ ] 1.4: Filter stories to show only stories from selectedEpicNumber
  - [ ] 1.5: Render epic header with epic number, title (if available), and progress count
  - [ ] 1.6: Map story statuses to status icons (✓ ◉ → ○ ·) with appropriate colors
  - [ ] 1.7: Apply highlighted background to currentStory row
  - [ ] 1.8: Use semantic HTML (ul/li) with proper ARIA labels for accessibility

- [ ] **Task 2: Implement progress bar visualization** (AC6.16)
  - [ ] 2.1: Calculate completedCount = stories with status "done"
  - [ ] 2.2: Calculate totalCount = all stories in epic
  - [ ] 2.3: Render progress bar with percentage: (completedCount/totalCount * 100)%
  - [ ] 2.4: Use CSS width transition for smooth progress bar animation
  - [ ] 2.5: Display numeric label: "{completedCount}/{totalCount} stories"
  - [ ] 2.6: Use shadcn/ui Progress component or custom styled div with Tailwind

- [ ] **Task 3: Create SprintContext for state management** (AC6.18)
  - [ ] 3.1: Create frontend/src/context/SprintContext.tsx
  - [ ] 3.2: Define SprintContextState interface (sprintStatus, selectedEpicNumber, isLoading, error)
  - [ ] 3.3: Fetch initial data via GET /api/sprint/status on mount
  - [ ] 3.4: Subscribe to WebSocket sprint.updated messages via useWebSocket hook
  - [ ] 3.5: Update state on sprint.updated, preserving selectedEpicNumber
  - [ ] 3.6: Export useSprintContext hook for component consumption
  - [ ] 3.7: Handle loading, error, and empty states

- [ ] **Task 4: Implement story row click handling** (AC6.17)
  - [ ] 4.1: Add expandedStories state (Set<string>) to track expanded story IDs
  - [ ] 4.2: Add onClick handler to story row that toggles storyId in expandedStories set
  - [ ] 4.3: Conditionally render artifacts section when story is in expandedStories
  - [ ] 4.4: Add chevron icon (▼ expanded, ▶ collapsed) for visual feedback
  - [ ] 4.5: Use CSS transition for smooth expand/collapse animation
  - [ ] 4.6: Ensure artifacts display integration (Story 6.4 will populate this)

- [ ] **Task 5: Integrate SprintTracker into main layout** (AC6.13-6.18)
  - [ ] 5.1: Wrap App.tsx (or MainContentArea.tsx) with SprintContextProvider
  - [ ] 5.2: Add SprintTracker component to WorkflowProgress or MainContentArea
  - [ ] 5.3: Connect selectedEpicNumber to context state (default to currentEpic)
  - [ ] 5.4: Ensure component renders when workflow panel is visible
  - [ ] 5.5: Test with existing sprint-status.yaml data

- [ ] **Task 6: Write comprehensive unit tests** (All ACs)
  - [ ] 6.1: Test SprintTracker renders epic header with correct progress count
  - [ ] 6.2: Test status icons render correctly for each status value
  - [ ] 6.3: Test currentStory receives highlighted class
  - [ ] 6.4: Test progress bar calculates correct percentage
  - [ ] 6.5: Test story row click toggles expansion state
  - [ ] 6.6: Test SprintContext fetches data on mount
  - [ ] 6.7: Test SprintContext updates state on sprint.updated message
  - [ ] 6.8: Test empty state when sprintStatus is null
  - [ ] 6.9: Test error state handling
  - [ ] 6.10: Target: 50%+ frontend code coverage for new components

## Dev Notes

### Architecture Alignment

This story integrates with Epic 3's workflow visualization infrastructure and Epic 6's data parsing:

**Dependencies from Previous Stories:**
- **Story 6.1 (Sprint Status Parser)**: Provides SprintStatus, EpicData, StoryData interfaces and GET /api/sprint/status endpoint
- **Story 6.2 (Artifact Derivation)**: Provides artifacts array in StoryData (used in Story 6.4, structure prepared here)
- **Epic 3 WorkflowContext**: Pattern for context API usage (replicate for SprintContext)
- **Epic 3 useWebSocket hook**: Reuse for sprint.updated message subscription

**New Components:**
- `SprintTracker.tsx` - Main visualization component
- `SprintContext.tsx` - State management with WebSocket integration
- Extended types in `types.ts` for frontend SprintStatus consumption

**ADR Compliance:**
- **ADR-005 (React Context API)**: Use Context for sprint state, follow WorkflowContext patterns
- **ADR-013 (WebSocket Protocol)**: Subscribe to `sprint.updated` messages from Story 6.1
- **ADR (Performance)**: Tab switching must remain <50ms (don't re-fetch data on every render)
- **ADR (UI Components)**: Use existing shadcn/ui components (Progress, Icons) for consistency

### UI Component Structure

**SprintTracker Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Epic 4: Production Stability & Polish    [15/19]   │
│ ████████████████████░░░░░ 78.9%                     │
├─────────────────────────────────────────────────────┤
│ ✓ 4-1   Session status tracking              done  │
│ ✓ 4-2   Attention badges                     done  │
│   ... (collapsed done stories)                      │
│ ✓ 4-12  Documentation                        done  │
│ ○ 4-13  Production validation              drafted │
│ ◉ 4-16  Session list hydration (current)    review │ ← highlighted
│ ◉ 4-17  Cross-tab sync                      review │
│ ◉ 4-18  Destroy protection                  review │
│ ◉ 4-19  Reconnection sync                   review │
└─────────────────────────────────────────────────────┘
```

**Status Icon Colors (Tailwind classes):**
- ✓ done: `text-green-500`
- ◉ review: `text-yellow-500`
- → in-progress: `text-cyan-500`
- ○ drafted/ready-for-dev: `text-gray-400`
- · backlog: `text-gray-600 opacity-50`

**Current Story Highlight:**
- Background: `bg-blue-50 dark:bg-blue-900/20` (subtle highlight)
- Border-left: `border-l-4 border-blue-500` (accent bar)

### Data Flow

```
App Mount
  ↓
SprintContext.useEffect() → GET /api/sprint/status
  ↓
setState({ sprintStatus: {...}, selectedEpicNumber: currentEpic })
  ↓
SprintTracker renders with data
  ├─ Filter stories by selectedEpicNumber
  ├─ Calculate completedCount/totalCount
  ├─ Map stories to rows with icons
  └─ Highlight currentStory

User interaction (future stories):
  - Click story row → toggle expandedStories (Task 4)
  - Epic selector dropdown → update selectedEpicNumber (Story 6.7)

WebSocket sprint.updated message:
  ↓
SprintContext.handleSprintUpdated()
  ↓
setState({ sprintStatus: newStatus })
  ↓
SprintTracker re-renders with new data
  ├─ Status icons update
  ├─ Progress bar animates to new percentage
  └─ currentStory highlight shifts if changed
```

### Context API Pattern

**SprintContext Structure (following WorkflowContext pattern):**
```typescript
// frontend/src/context/SprintContext.tsx
interface SprintContextState {
  sprintStatus: SprintStatus | null;
  selectedEpicNumber: number;
  isLoading: boolean;
  error: string | null;
}

interface SprintContextValue extends SprintContextState {
  setSelectedEpic: (epicNumber: number) => void;
  refreshStatus: () => Promise<void>;
}

export const SprintContext = createContext<SprintContextValue | null>(null);

export function SprintProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SprintContextState>({
    sprintStatus: null,
    selectedEpicNumber: 0,
    isLoading: true,
    error: null
  });

  // Fetch initial data on mount
  useEffect(() => {
    fetch('/api/sprint/status')
      .then(res => res.json())
      .then(data => setState({
        sprintStatus: data.sprintStatus,
        selectedEpicNumber: data.sprintStatus?.currentEpic || 0,
        isLoading: false,
        error: null
      }))
      .catch(error => setState(prev => ({ ...prev, isLoading: false, error: error.message })));
  }, []);

  // Subscribe to WebSocket updates
  const { subscribe } = useWebSocket();
  useEffect(() => {
    const unsubscribe = subscribe('sprint.updated', (message) => {
      setState(prev => ({
        ...prev,
        sprintStatus: message.sprintStatus
      }));
    });
    return unsubscribe;
  }, [subscribe]);

  return (
    <SprintContext.Provider value={{ ...state, setSelectedEpic, refreshStatus }}>
      {children}
    </SprintContext.Provider>
  );
}

export function useSprintContext() {
  const context = useContext(SprintContext);
  if (!context) throw new Error('useSprintContext must be used within SprintProvider');
  return context;
}
```

### Story List Rendering

**Grouping and Sorting:**
- Filter stories where `story.epicNumber === selectedEpicNumber`
- Sort by `story.storyNumber` ascending
- Optionally group: done stories (collapsed by default), then active stories (expanded)

**Performance:**
- No virtualization needed for MVP (typical epic has <20 stories)
- If epic exceeds 100 stories, add react-window virtualization
- Memoize filtered/sorted story list with useMemo

### Testing Strategy

**Component Tests (Vitest):**
- Render SprintTracker with mock sprintStatus data
- Verify epic header, progress bar, story rows render correctly
- Test status icon mapping (each status value)
- Test highlighted current story class application
- Test story row click toggles expansion
- Mock SprintContext for isolated component tests

**Context Tests (Vitest):**
- Test initial fetch on mount
- Test WebSocket message handling
- Test error state handling
- Mock fetch and useWebSocket hook

**Integration Tests:**
- Test full App with SprintProvider
- Verify real GET /api/sprint/status call
- Verify WebSocket subscription (may require test utils)

### Learnings from Previous Story

**From Story 6.2 (Artifact Path Derivation and Existence Check)**

Story 6.2 extended the backend statusParser to derive artifact paths and check existence. Key learnings to apply to this story:

- **Defensive Rendering**: Story 6.2 demonstrated graceful handling of missing artifacts (exists: false). Apply same pattern for missing epic data or empty story lists - render empty state, don't crash.

- **File System Integration**: Story 6.2 verified artifact existence with fs.existsSync(). This story will display those artifacts (via artifacts array in StoryData) when rows expand in Task 4.

- **Type Safety**: Story 6.2 defined ArtifactInfo interface with name, path, exists, icon fields. This story will consume those artifacts in story rows (preparation for Story 6.4).

- **Performance Patterns**: Story 6.2 noted synchronous fs.existsSync() is acceptable for <50 artifacts. Similarly, rendering <20 stories per epic doesn't need virtualization - keep it simple.

- **Status-Based Logic**: Story 6.2 derived artifacts based on story status progression (drafted→story file, ready-for-dev→context file). This story displays status visually with icons - maintain consistency with those status definitions.

- **Data Model Continuity**: Story 6.2 extended StoryData with artifacts: ArtifactInfo[]. This story will render StoryData with that field present (even if empty for now, populated by Story 6.4).

**Implementation Recommendations:**

1. **Reuse Status Definitions**: Story 6.2 uses status values from sprint-status.yaml comments. Map those exact values to icons here.
2. **Empty State Handling**: If sprintStatus is null (file not found), show empty state message (similar to Story 6.2's missing artifact handling).
3. **Context Pattern**: Follow WorkflowContext pattern from Epic 3 - Story 6.2's backend work feeds into this frontend visualization.
4. **Testing Coverage**: Story 6.2 achieved 70%+ backend coverage - target 50%+ for frontend components.

[Source: docs/sprint-artifacts/6-2-artifact-path-derivation-and-existence-check.md#Learnings from Previous Story]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#UI Components - SprintTracker]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.3]
- [Story 6.1 (Sprint Status Parser): docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md]
- [Story 6.2 (Artifact Derivation): docs/sprint-artifacts/6-2-artifact-path-derivation-and-existence-check.md]
- [Architecture: docs/architecture.md#Frontend Stack]
- [ADR-005 (React Context): docs/architecture-decisions.md#ADR-005]

## Estimated Effort

4-6 hours

## Dependencies

- Story 6.1 (Sprint Status YAML Parser) - provides GET /api/sprint/status endpoint and SprintStatus interface
- Story 6.2 (Artifact Derivation) - provides artifacts array structure in StoryData
- Epic 3 WorkflowContext - pattern for context API usage
- Epic 3 useWebSocket hook - WebSocket subscription infrastructure
- shadcn/ui Progress component - visual progress bar

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
