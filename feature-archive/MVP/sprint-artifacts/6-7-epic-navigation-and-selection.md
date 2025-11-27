# Story 6.7: Epic Navigation and Selection

Status: drafted

## Story

As a developer,
I want to navigate between epics in the Sprint Tracker using a dropdown selector,
So that I can review past epics, see upcoming work, and access epic-specific artifacts.

## Background

Building upon the Sprint Tracker component from Story 6.3 and the collapsible phase sections from Story 6.6, this story adds epic navigation capability. Currently, the Sprint Tracker shows only the current epic's stories. This story introduces an EpicSelector dropdown component that displays all epics with completion status indicators (✓ completed, ◉ in-progress, · backlog), allows switching between epics, and shows epic-level artifacts (tech spec, retrospective) under the epic header.

The epic selector appears in the Implementation section header as "Implementation - [Epic 4 ▾]" format. Selection switches the story list to show that epic's stories. The selected epic persists to localStorage, and the current epic (with incomplete stories) is visually distinct from others.

## Acceptance Criteria

```gherkin
AC6.34: Epic selector dropdown visible in header
  GIVEN the Sprint Tracker view is rendered
  WHEN the Implementation section header is displayed
  THEN an epic selector dropdown appears in the format: "Implementation - [Epic 4 ▾]"
  AND clicking the dropdown opens the epic list
  AND the dropdown shows the currently selected epic number

AC6.35: All epics listed in dropdown
  GIVEN the epic selector dropdown is opened
  WHEN the epic list is rendered
  THEN all epics from sprint-status.yaml are displayed
  AND each epic shows: "Epic {N}: {Title}  {Status Icon} {Completed}/{Total}"
  AND epics are listed in numerical order (Epic 1, Epic 2, etc.)

AC6.36: Epic selection switches story list
  GIVEN the Sprint Tracker is showing Epic 4 stories
  WHEN the user selects Epic 2 from the dropdown
  THEN the story list updates to show only Epic 2's stories
  AND the dropdown label changes to "Implementation - [Epic 2 ▾]"
  AND the story list re-renders without full page reload

AC6.37: Current epic marked distinctly
  GIVEN the epic selector dropdown is opened
  WHEN the current epic (with incomplete stories) is displayed
  THEN it shows the ◉ icon (in-progress indicator)
  AND has distinct visual styling (bold text or background highlight)
  AND completed epics show ✓ icon (green)
  AND backlog epics show · icon (gray)

AC6.38: Epic artifacts shown under epic header
  GIVEN an epic is selected in the Sprint Tracker
  WHEN the epic header is expanded (if collapsible)
  THEN epic-level artifacts are displayed:
    - Tech Spec: docs/sprint-artifacts/tech-spec-epic-{N}.md (if epic status is "contexted")
    - Retrospective: docs/sprint-artifacts/epic-{N}-retrospective.md (if retrospective is "completed")
  AND each artifact has a [View] button that opens it in ArtifactViewer
  AND artifacts with exists: false are shown grayed with "(missing)" label
```

## Tasks / Subtasks

- [ ] **Task 1: Create EpicSelector.tsx component** (AC6.34, AC6.35)
  - [ ] 1.1: Create component file at frontend/src/components/EpicSelector.tsx
  - [ ] 1.2: Define props interface:
    ```typescript
    interface EpicSelectorProps {
      epics: EpicData[];              // All epics from SprintStatus
      selectedEpicNumber: number;     // Currently selected epic
      onEpicSelect: (epicNumber: number) => void;
    }
    ```
  - [ ] 1.3: Import shadcn/ui DropdownMenu component (@radix-ui/react-dropdown-menu)
  - [ ] 1.4: Render dropdown trigger with format: "Implementation - [Epic {N} ▾]"
  - [ ] 1.5: Implement dropdown content with epic list:
    ```tsx
    <DropdownMenuContent>
      {epics.map(epic => (
        <DropdownMenuItem onClick={() => onEpicSelect(epic.epicNumber)}>
          {getEpicIcon(epic)} Epic {epic.epicNumber}: {epic.title} ({epic.completedCount}/{epic.storyCount})
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
    ```
  - [ ] 1.6: Sort epics by epicNumber in ascending order (1, 2, 3, ...)
  - [ ] 1.7: Add chevron-down icon (lucide-react: ChevronDown) to trigger button

- [ ] **Task 2: Integrate EpicData from SprintContext** (AC6.35)
  - [ ] 2.1: Import SprintContext to access epic data from sprint-status.yaml
  - [ ] 2.2: Extract epic list from SprintContext.sprintStatus.epics
  - [ ] 2.3: Parse epic metadata:
    ```typescript
    interface EpicData {
      epicNumber: number;
      epicKey: string;           // "epic-4"
      status: 'backlog' | 'contexted';
      retrospective: 'optional' | 'completed' | null;
      title?: string;            // From epic file or derived
      storyCount: number;
      completedCount: number;
      artifacts: ArtifactInfo[];
    }
    ```
  - [ ] 2.4: Extract epic titles from docs/epics/epic-{N}-*.md files (if available)
  - [ ] 2.5: Calculate storyCount per epic (total stories in that epic)
  - [ ] 2.6: Calculate completedCount per epic (stories with status "done")
  - [ ] 2.7: Derive artifacts for each epic:
    - Tech spec: tech-spec-epic-{N}.md (if status is "contexted")
    - Retrospective: epic-{N}-retrospective.md (if retrospective is "completed")

- [ ] **Task 3: Implement epic selection state management** (AC6.36)
  - [ ] 3.1: Add selectedEpicNumber state to SprintContext or SprintTracker
  - [ ] 3.2: Implement onEpicSelect handler:
    ```typescript
    const handleEpicSelect = (epicNumber: number) => {
      setSelectedEpicNumber(epicNumber);
      saveSelectedEpic(epicNumber); // localStorage
    };
    ```
  - [ ] 3.3: Filter story list by selectedEpicNumber:
    ```typescript
    const filteredStories = stories.filter(s => s.epicNumber === selectedEpicNumber);
    ```
  - [ ] 3.4: Update SprintTracker to render filtered stories
  - [ ] 3.5: Ensure story list re-renders efficiently (no full page reload)
  - [ ] 3.6: Test rapid epic switching for performance

- [ ] **Task 4: Persist selected epic to localStorage** (AC6.36)
  - [ ] 4.1: Create localStorage helper in frontend/src/utils/localStorage.ts:
    ```typescript
    const SELECTED_EPIC_KEY = 'claude-container-selected-epic';
    export const loadSelectedEpic = (): number | null => { /* parse int */ };
    export const saveSelectedEpic = (epicNumber: number) => { /* store */ };
    ```
  - [ ] 4.2: Load selected epic from localStorage on SprintTracker mount
  - [ ] 4.3: Default to currentEpic if no localStorage value exists
  - [ ] 4.4: Save selected epic on every selection change
  - [ ] 4.5: Handle localStorage quota errors gracefully
  - [ ] 4.6: Test persistence: select epic → reload → verify still selected

- [ ] **Task 5: Add status indicators to epic list items** (AC6.37)
  - [ ] 5.1: Determine epic status based on story completion:
    ```typescript
    const getEpicStatus = (epic: EpicData): EpicStatus => {
      if (epic.completedCount === epic.storyCount) return 'completed';
      if (epic.completedCount > 0) return 'in-progress';
      return 'backlog';
    };
    ```
  - [ ] 5.2: Render status icons in dropdown:
    ```tsx
    {epic.status === 'completed' ? '✓' : epic.status === 'in-progress' ? '◉' : '·'}
    ```
  - [ ] 5.3: Color icons: green for ✓, yellow for ◉, gray for ·
  - [ ] 5.4: Apply conditional styling for current epic:
    ```typescript
    const itemClassName = epic.epicNumber === selectedEpicNumber
      ? 'font-bold bg-gray-100 dark:bg-gray-800'
      : '';
    ```
  - [ ] 5.5: Add visual highlight (bold text or background) for selected epic
  - [ ] 5.6: Test with mixed epic statuses (completed, in-progress, backlog)
  - [ ] 5.7: Ensure dark mode support for all icon colors

- [ ] **Task 6: Display epic artifacts under epic header** (AC6.38)
  - [ ] 6.1: Render epic artifacts section in SprintTracker:
    ```tsx
    <div className="epic-artifacts">
      {selectedEpic.artifacts.map(artifact => (
        <div className="artifact-row">
          {artifact.icon} {artifact.name}
          <button onClick={() => handleViewArtifact(artifact.path)}>
            [View]
          </button>
        </div>
      ))}
    </div>
    ```
  - [ ] 6.2: Position epic artifacts section under epic header, above story list
  - [ ] 6.3: Reuse artifact display pattern from Story 6.4 (nested tree with [View] buttons)
  - [ ] 6.4: Include tech spec artifact if epic status is "contexted":
    - Path: docs/sprint-artifacts/tech-spec-epic-{N}.md
    - Name: "Epic Tech Spec"
    - Icon: 📊
  - [ ] 6.5: Include retrospective artifact if retrospective is "completed":
    - Path: docs/sprint-artifacts/epic-{N}-retrospective.md
    - Name: "Retrospective"
    - Icon: 📄
  - [ ] 6.6: Show "(missing)" label for artifacts with exists: false
  - [ ] 6.7: Wire [View] button to LayoutContext.setSelectedFile()
  - [ ] 6.8: Test clicking [View] opens artifact in ArtifactViewer

- [ ] **Task 7: Extract epic titles from epic files** (AC6.35)
  - [ ] 7.1: Implement epic title extraction in backend (statusParser.ts or new epicParser.ts):
    ```typescript
    const extractEpicTitle = (epicNumber: number): string | null => {
      const epicPath = glob.sync(`docs/epics/epic-${epicNumber}-*.md`)[0];
      if (!epicPath) return null;
      const content = fs.readFileSync(epicPath, 'utf-8');
      const match = content.match(/^##\s+Epic\s+\d+:\s+(.+)$/m);
      return match ? match[1] : `Epic ${epicNumber}`;
    };
    ```
  - [ ] 7.2: Fallback to "Epic {N}" if title not found in file
  - [ ] 7.3: Cache extracted titles (invalidate on epic file changes)
  - [ ] 7.4: Include titles in GET /api/sprint/status response
  - [ ] 7.5: Display titles in epic selector dropdown
  - [ ] 7.6: Test with epics that have titles vs. epics without files

- [ ] **Task 8: Integrate EpicSelector into SprintTracker** (AC6.34)
  - [ ] 8.1: Import EpicSelector component into SprintTracker.tsx
  - [ ] 8.2: Position EpicSelector in Implementation section header:
    ```tsx
    <div className="implementation-header">
      Implementation - <EpicSelector epics={epics} selectedEpicNumber={selectedEpicNumber} onEpicSelect={handleEpicSelect} />
    </div>
    ```
  - [ ] 8.3: Pass epic data, selected epic, and selection handler as props
  - [ ] 8.4: Ensure epic selector renders only if multiple epics exist
  - [ ] 8.5: Test layout spacing and alignment with existing header elements
  - [ ] 8.6: Verify epic selector is keyboard accessible (Enter/Space to open, Arrow keys to navigate)

- [ ] **Task 9: Handle epic data unavailability** (Reliability)
  - [ ] 9.1: Check if SprintContext.sprintStatus.epics is available
  - [ ] 9.2: If epics array is empty or null:
    ```tsx
    return <div className="text-gray-500">Epic data unavailable</div>;
    ```
  - [ ] 9.3: Show placeholder message: "Epic data unavailable - selector hidden"
  - [ ] 9.4: Gracefully hide epic selector if parsing fails
  - [ ] 9.5: Log warning to console for debugging
  - [ ] 9.6: Test with missing sprint-status.yaml file
  - [ ] 9.7: Ensure story list still renders if epic selector is unavailable

- [ ] **Task 10: Write comprehensive unit tests** (All ACs)
  - [ ] 10.1: Test EpicSelector renders with epic data
  - [ ] 10.2: Test clicking dropdown trigger opens epic list
  - [ ] 10.3: Test clicking epic item calls onEpicSelect
  - [ ] 10.4: Test status icons rendered correctly (✓, ◉, ·)
  - [ ] 10.5: Test selected epic highlighted in dropdown
  - [ ] 10.6: Test epic selection updates localStorage
  - [ ] 10.7: Test localStorage load on mount
  - [ ] 10.8: Test story list filters by selected epic
  - [ ] 10.9: Test epic artifacts displayed under header
  - [ ] 10.10: Test [View] button calls setSelectedFile
  - [ ] 10.11: Mock SprintContext for epic data
  - [ ] 10.12: Target: 50%+ frontend code coverage for EpicSelector

- [ ] **Task 11: Integration testing with SprintTracker** (AC6.34-AC6.38)
  - [ ] 11.1: Test full SprintTracker with EpicSelector + story list
  - [ ] 11.2: Test selecting different epics updates story list
  - [ ] 11.3: Test persistence: select epic → reload → verify still selected
  - [ ] 11.4: Test clicking artifact [View] button in epic artifacts section
  - [ ] 11.5: Test with real sprint-status.yaml data (if available)
  - [ ] 11.6: Test with mixed epic statuses (completed, in-progress, backlog)
  - [ ] 11.7: Test dropdown closes after selection
  - [ ] 11.8: Test keyboard navigation in dropdown (Arrow keys, Enter)
  - [ ] 11.9: Test dark mode styling for all epic selector elements
  - [ ] 11.10: Test with single epic (selector should still work)

## Dev Notes

### Architecture Alignment

This story integrates with Epic 6's sprint status parsing and existing SprintTracker component:

**Dependencies from Previous Stories:**
- **Story 6.1 (Sprint Status Parser)**: SprintContext provides epic data from sprint-status.yaml
- **Story 6.3 (Sprint Tracker)**: EpicSelector integrates into SprintTracker header
- **Story 6.4 (Artifact Display)**: Reuse artifact rendering pattern for epic artifacts
- **Story 6.6 (Collapsible Phase Overview)**: Follow localStorage persistence pattern

**New Components:**
- `EpicSelector.tsx` - Dropdown component for epic navigation
- Epic title extraction logic (backend or frontend utility)

**ADR Compliance:**
- **ADR-005 (React Context API)**: Use existing SprintContext for epic data
- **ADR-006 (YAML Parsing)**: Reuse parsed sprint-status.yaml from statusParser
- **UI Components**: Use shadcn/ui DropdownMenu from @radix-ui/react-dropdown-menu
- **localStorage**: Follow existing persistence pattern (Story 3.8, 6.6)
- **Accessibility**: Keyboard navigation (Arrow keys, Enter/Space)

### UI Component Structure

**EpicSelector Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Implementation - [Epic 4 ▾]                             │ [collapsed]
└─────────────────────────────────────────────────────────┘
                    ↓ click
┌─────────────────────────────────────────────────────────┐
│ Epic 1: Foundation                         ✓ 12/12      │
│ Epic 2: Multi-Session                      ✓ 12/12      │
│ Epic 3: Workflow Visibility                ✓ 12/12      │
│ Epic 4: Production Stability               ◉ 15/19  ←   │ [selected]
│ Epic 5: Git Integration                    · 0/11       │
│ Epic 6: Interactive Workflow Tracker       ◉ 6/10       │
└─────────────────────────────────────────────────────────┘
```

**Epic Artifacts Section:**
```
┌─────────────────────────────────────────────────────────┐
│ Implementation - [Epic 4 ▾]                             │
├─────────────────────────────────────────────────────────┤
│ Epic 4 Artifacts:                                       │
│   📊 Epic Tech Spec                             [View]  │
│   📄 Retrospective                              [View]  │
├─────────────────────────────────────────────────────────┤
│ Stories:                                                │
│   ✓ 4-1  Session status tracking              done     │
│   ...                                                    │
└─────────────────────────────────────────────────────────┘
```

**Status Icons:**
- `✓` (green) = All stories completed (completedCount === storyCount)
- `◉` (yellow) = Some stories completed (in-progress epic)
- `·` (gray) = No stories completed (backlog epic)

**Selected Epic Styling:**
- Bold text for current selection
- Background highlight (bg-gray-100 dark:bg-gray-800)
- Distinct from non-selected epics

### Data Flow

```
SprintContext.sprintStatus.epics (from sprint-status.yaml)
  ↓
Parse epic metadata:
  - epicNumber, epicKey, status, retrospective
  - storyCount, completedCount
  - artifacts (tech spec, retrospective)
  ↓
Extract epic titles from docs/epics/epic-{N}-*.md
  ↓
Render EpicSelector dropdown with epic list
  ↓
User selects epic → onEpicSelect(epicNumber)
  ├─ setSelectedEpicNumber(epicNumber)
  ├─ saveSelectedEpic(epicNumber) → localStorage
  └─ Filter stories by epicNumber
  ↓
Story list re-renders with filtered stories
  ↓
Epic artifacts displayed under epic header
  ├─ Tech Spec (if epic status is "contexted")
  └─ Retrospective (if retrospective is "completed")
  ↓
On page reload:
  ├─ Load from localStorage: loadSelectedEpic()
  └─ Default to currentEpic if no localStorage value
```

### Epic Data Structure

```typescript
// Derived from SprintContext.sprintStatus
interface EpicData {
  epicNumber: number;            // 4
  epicKey: string;               // "epic-4"
  status: 'backlog' | 'contexted';
  retrospective: 'optional' | 'completed' | null;
  title: string;                 // "Production Stability & Polish" (from epic file)
  storyCount: number;            // Total stories in epic
  completedCount: number;        // Stories with status "done"
  artifacts: ArtifactInfo[];     // Tech spec, retrospective
}

interface ArtifactInfo {
  name: string;                  // "Epic Tech Spec", "Retrospective"
  path: string;                  // "docs/sprint-artifacts/tech-spec-epic-4.md"
  exists: boolean;               // File existence verified
  icon: '📄' | '📋' | '📊';     // .md, .xml, .yaml
}

// Example epic data:
{
  epicNumber: 4,
  epicKey: 'epic-4',
  status: 'contexted',
  retrospective: 'optional',
  title: 'Production Stability & Polish',
  storyCount: 19,
  completedCount: 15,
  artifacts: [
    { name: 'Epic Tech Spec', path: 'docs/sprint-artifacts/tech-spec-epic-4.md', exists: true, icon: '📊' },
    { name: 'Retrospective', path: 'docs/sprint-artifacts/epic-4-retrospective.md', exists: false, icon: '📄' }
  ]
}
```

### localStorage Implementation

```typescript
// frontend/src/utils/localStorage.ts (extend existing)
const SELECTED_EPIC_KEY = 'claude-container-selected-epic';

export const loadSelectedEpic = (): number | null => {
  try {
    const stored = localStorage.getItem(SELECTED_EPIC_KEY);
    if (!stored) return null;
    return parseInt(stored, 10);
  } catch (error) {
    console.warn('[EpicSelector] Failed to load selected epic:', error);
    return null;
  }
};

export const saveSelectedEpic = (epicNumber: number): void => {
  try {
    localStorage.setItem(SELECTED_EPIC_KEY, epicNumber.toString());
  } catch (error) {
    console.error('[EpicSelector] Failed to save selected epic:', error);
    // Graceful degradation: continue without persistence
  }
};

// Usage in SprintTracker:
const [selectedEpicNumber, setSelectedEpicNumber] = useState<number>(
  loadSelectedEpic() ?? currentEpic
);

const handleEpicSelect = (epicNumber: number) => {
  setSelectedEpicNumber(epicNumber);
  saveSelectedEpic(epicNumber);
};
```

### DropdownMenu Component Usage

```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

const EpicSelector = ({ epics, selectedEpicNumber, onEpicSelect }) => {
  const selectedEpic = epics.find(e => e.epicNumber === selectedEpicNumber);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="epic-selector-trigger">
        Epic {selectedEpicNumber} <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {epics
          .sort((a, b) => a.epicNumber - b.epicNumber)
          .map(epic => (
            <DropdownMenuItem
              key={epic.epicNumber}
              onClick={() => onEpicSelect(epic.epicNumber)}
              className={epic.epicNumber === selectedEpicNumber ? 'font-bold bg-gray-100 dark:bg-gray-800' : ''}
            >
              <span className="epic-status-icon">
                {getEpicStatusIcon(epic)}
              </span>
              Epic {epic.epicNumber}: {epic.title}
              <span className="epic-progress">
                ({epic.completedCount}/{epic.storyCount})
              </span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const getEpicStatusIcon = (epic: EpicData): string => {
  if (epic.completedCount === epic.storyCount) return '✓';
  if (epic.completedCount > 0) return '◉';
  return '·';
};
```

### Epic Title Extraction

**Backend Implementation (statusParser.ts or epicParser.ts):**
```typescript
import { glob } from 'glob';
import * as fs from 'fs';

const extractEpicTitle = (epicNumber: number): string | null => {
  // Find epic file: docs/epics/epic-{N}-*.md
  const epicFiles = glob.sync(`docs/epics/epic-${epicNumber}-*.md`);
  if (epicFiles.length === 0) return null;

  const epicPath = epicFiles[0];
  const content = fs.readFileSync(epicPath, 'utf-8');

  // Extract title from "## Epic N: Title" pattern
  const match = content.match(/^##\s+Epic\s+\d+:\s+(.+)$/m);
  return match ? match[1] : `Epic ${epicNumber}`;
};

// Usage in parseSprintStatus:
const epicTitle = extractEpicTitle(epic.epicNumber) ?? `Epic ${epic.epicNumber}`;
epic.title = epicTitle;
```

**Frontend Fallback (if backend doesn't provide):**
```typescript
// Use epic file name pattern to extract title
const deriveEpicTitle = (epicKey: string): string => {
  // If title not provided by backend, derive from epic key
  return epicKey.replace(/^epic-(\d+)-/, 'Epic $1: ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
```

### Testing Strategy

**Component Tests (Vitest):**
- Render EpicSelector with mock epic data → verify dropdown trigger rendered
- Click dropdown trigger → verify epic list opens
- Click epic item → verify onEpicSelect called with correct epicNumber
- Verify localStorage.getItem called on mount
- Verify localStorage.setItem called on selection
- Render with selected epic → verify highlighted in dropdown
- Render with completed epic → verify green ✓ icon
- Render with in-progress epic → verify yellow ◉ icon
- Render with backlog epic → verify gray · icon
- Render with no epic data → verify graceful fallback message
- Mock SprintContext with epic data

**Integration Tests:**
- Render full SprintTracker → verify EpicSelector + story list
- Select different epic → verify story list filters correctly
- Reload page → verify selected epic persisted
- Click artifact [View] → verify ArtifactViewer opens
- Test with multiple epics (1-6) → verify all listed
- Test keyboard navigation (Arrow keys, Enter)

**Manual Testing Checklist:**
- Click epic selector → verify dropdown opens smoothly
- Select each epic → verify story list updates correctly
- Reload page → verify selected epic persists
- Verify status icons match epic completion status
- Verify current epic highlighted in dropdown
- Test with empty epic data (no sprint-status.yaml)
- Test dark mode styling for dropdown and icons
- Test keyboard accessibility (Tab, Enter, Arrow keys)

### Learnings from Previous Story

**From Story 6.6 (Collapsible Phase Overview)**

Story 6.6 created the PhaseOverview component with collapsible sections. Key learnings to apply:

- **Context Integration**: Successfully used WorkflowContext for phase data. This story will use SprintContext for epic data - follow same pattern of extracting context at component top level.

- **localStorage Persistence**: Story 6.6 implemented collapse state persistence using Set<string> → JSON array. This story will use similar pattern for selected epic (single number, not set).

- **Component Reusability**: Story 6.6 showed inline components can be effective initially. EpicSelector can similarly inline epic item rendering logic, extract later if reused.

- **Dark Mode Support**: Story 6.6 ensured all styling supports dark mode with semantic color classes. This story will use same approach: text-green-600 dark:text-green-500 for checkmarks, etc.

- **Empty State Handling**: Story 6.6 handled missing phase data with graceful fallback message. This story handles missing epic data with "Epic data unavailable".

- **Testing with Mocks**: Story 6.6 demonstrated mocking WorkflowContext for tests. This story will mock SprintContext with sample epic data.

- **Status Icons**: Story 6.6 established status icon pattern (✓, ◉, ○, ⊘). This story reuses same icons for epic status (✓ completed, ◉ in-progress, · backlog).

**Implementation Recommendations:**

1. **Reuse Artifact Display Pattern**: Story 6.4 created artifact rendering with [View] buttons. Reuse this exact pattern for epic artifacts (tech spec, retrospective).

2. **localStorage Pattern**: Follow Story 3.8 and 6.6 pattern. Store selected epic as simple number string, load on mount, save on change.

3. **Dropdown Component**: Use @radix-ui/react-dropdown-menu (already installed). Follow shadcn/ui patterns from existing components.

4. **Epic Status Calculation**: Similar to phase status in Story 6.6. Calculate based on completedCount / storyCount ratio.

5. **Epic Title Extraction**: Backend should provide epic titles in GET /api/sprint/status response. Frontend fallback to "Epic {N}" if missing.

6. **Integration with SprintTracker**: EpicSelector integrates into existing SprintTracker header. Position above story list, below phase sections.

**New Patterns to Establish:**

- **Epic Navigation State**: First component with multi-entity selection (epic selector). Pattern reusable for future multi-view components.
- **Epic-Scoped Filtering**: Story list filtering by epicNumber. Pattern applicable to other filtered lists.
- **Epic Metadata Display**: Showing epic-level artifacts and metadata. Pattern reusable for epic summary cards.

[Source: docs/sprint-artifacts/6-6-collapsible-phase-overview.md#Learnings from Previous Story]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#Data Models - EpicData structure]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.7]
- [Story 6.6 (Collapsible Phase Overview): docs/sprint-artifacts/6-6-collapsible-phase-overview.md]
- [Story 6.4 (Artifact Display): docs/sprint-artifacts/6-4-artifact-display-under-steps.md]
- [Story 6.3 (Sprint Tracker): docs/sprint-artifacts/6-3-sprint-tracker-component-mvp-view.md]
- [Story 6.1 (Sprint Status Parser): docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md]
- [@radix-ui/react-dropdown-menu docs: https://www.radix-ui.com/primitives/docs/components/dropdown-menu]

## Estimated Effort

3-4 hours

## Dependencies

- Story 6.1 (Sprint Status Parser) - provides SprintContext with epic data
- Story 6.3 (Sprint Tracker) - provides SprintTracker.tsx component for integration
- Story 6.4 (Artifact Display) - provides artifact rendering pattern with [View] buttons
- Story 6.6 (Collapsible Phase Overview) - provides localStorage persistence pattern
- Epic 3 LayoutContext - provides setSelectedFile() for artifact viewing
- shadcn/ui DropdownMenu component (@radix-ui/react-dropdown-menu) - UI component library

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
