# Story 4.2: Session Attention Badges and Prioritization

Status: drafted

## Story

As a developer managing multiple parallel Claude sessions,
I want visual badges indicating which sessions need attention (error/stuck/waiting),
so that I can quickly prioritize my focus without reviewing each session individually.

## Acceptance Criteria

1. **AC4.5**: Attention badges show correct priority
   - Given: Multiple sessions with different statuses (error, stuck, waiting, active, idle)
   - When: The session list or tabs are displayed
   - Then: Badge priority ordering is: error > stuck > waiting > active/idle
   - And: Higher priority badges are more visually prominent

2. **AC4.6**: Badge tooltip shows detailed status
   - Given: A session has an attention badge
   - When: The user hovers over the badge
   - Then: A tooltip appears showing detailed status text
   - And: Tooltip includes time information (e.g., "Waiting for input - 2m ago", "No output for 30+ minutes")

3. **Badge styling matches Oceanic Calm theme**
   - Given: Badges are rendered
   - When: Each badge type is displayed
   - Then: Colors follow theme palette:
     - Error: #BF616A (red)
     - Stuck: #EBCB8B (yellow)
     - Waiting: #88C0D0 (blue)
     - Active: #A3BE8C (green) - optional, only if explicitly showing
     - Idle: #4C566A (dark grey) - subtle or hidden
   - And: Badges have sufficient WCAG AA contrast

4. **Badge appears on both session tabs and session list**
   - Given: A session has error/stuck/waiting status
   - When: The session is displayed in the tab bar AND the session list
   - Then: Attention badge appears in both locations
   - And: Badge styling is consistent across both components

5. **Badge updates in real-time via WebSocket**
   - Given: A session's status changes (e.g., active → waiting)
   - When: The backend sends a `session.status` WebSocket message
   - Then: The badge updates within 100ms to reflect the new priority
   - And: Tooltip text updates to show current status

6. **Badge sorting in session list**
   - Given: Multiple sessions with different attention priorities
   - When: The session list is rendered
   - Then: Sessions are sorted by priority: error > stuck > waiting > active > idle
   - And: Within same priority, sessions are sorted by most recent activity (lastActivity descending)

7. **Frontend unit tests**: Badge component tested
   - Test: Priority calculation (error > stuck > waiting)
   - Test: Tooltip content for each status type
   - Test: Badge color mapping to Oceanic Calm palette
   - Test: Real-time updates from session status changes
   - Coverage: ≥50% for AttentionBadge component

## Tasks / Subtasks

- [ ] Task 1: Create AttentionBadge component (AC: #1, #3, #5)
  - [ ] Create `frontend/src/components/AttentionBadge.tsx`
  - [ ] Define AttentionBadgeProps interface with `status`, `lastActivity`, `isStuck` fields
  - [ ] Implement priority calculation function: `calculatePriority(status, isStuck)`
  - [ ] Map priorities to Oceanic Calm colors (error: #BF616A, stuck: #EBCB8B, waiting: #88C0D0)
  - [ ] Add conditional rendering: only show badge for error/stuck/waiting states
  - [ ] Create unit tests: `frontend/src/components/AttentionBadge.test.tsx`

- [ ] Task 2: Add badge tooltip with detailed status (AC: #2, #6)
  - [ ] Install or verify `@radix-ui/react-tooltip` is available (already in project)
  - [ ] Wrap AttentionBadge with Radix Tooltip component
  - [ ] Implement tooltip content generation:
    - Error: "Session crashed - {{timestamp}}"
    - Stuck: "No output for 30+ minutes - last activity {{relativeTime}}"
    - Waiting: "Waiting for input - {{relativeTime}}"
  - [ ] Add relative time formatting utility (e.g., "2m ago", "45s ago")
  - [ ] Add unit tests for tooltip content generation

- [ ] Task 3: Integrate badge into SessionList component (AC: #4, #6)
  - [ ] Modify `frontend/src/components/SessionList.tsx`
  - [ ] Import AttentionBadge component
  - [ ] Add badge rendering next to session name in list items
  - [ ] Implement session sorting by priority:
    - Primary sort: badge priority (error > stuck > waiting > active > idle)
    - Secondary sort: lastActivity descending (most recent first)
  - [ ] Update SessionList unit tests to verify badge rendering and sorting

- [ ] Task 4: Integrate badge into session tabs (AC: #4)
  - [ ] Locate tab rendering code (likely in `frontend/src/App.tsx` or tabs component from Epic 2)
  - [ ] Add AttentionBadge component to each tab
  - [ ] Position badge next to or above session name in tab
  - [ ] Ensure consistent styling with SessionList badge
  - [ ] Add unit tests for tab badge rendering

- [ ] Task 5: Connect badge to WebSocket status updates (AC: #5)
  - [ ] Verify `useWebSocket.ts` already handles `session.status` messages (added in Story 4.1)
  - [ ] Ensure SessionContext state includes `status`, `lastActivity`, `metadata.stuckSince`
  - [ ] Verify AttentionBadge re-renders when session state changes
  - [ ] Add integration test: Simulate `session.status` message → verify badge updates

- [ ] Task 6: Extend Session type with computed priority field (optional optimization)
  - [ ] Add `computedPriority?: 'error' | 'stuck' | 'waiting' | 'active' | 'idle'` to Session type in `frontend/src/types.ts`
  - [ ] Compute priority in SessionContext when status changes
  - [ ] Use computed priority in AttentionBadge (avoid recalculation on every render)

- [ ] Task 7: Write comprehensive unit tests (AC: #7)
  - [ ] AttentionBadge.test.tsx: Priority calculation, color mapping, tooltip content
  - [ ] SessionList.test.tsx: Badge rendering, session sorting by priority
  - [ ] Tabs component tests: Badge rendering in tabs
  - [ ] Verify ≥50% frontend coverage for AttentionBadge

- [ ] Task 8: Verify WCAG AA contrast for badge colors
  - [ ] Use contrast checker tool (WebAIM or browser DevTools)
  - [ ] Verify error badge (#BF616A) meets AA contrast against background (#2E3440)
  - [ ] Verify stuck badge (#EBCB8B) meets AA contrast
  - [ ] Verify waiting badge (#88C0D0) meets AA contrast
  - [ ] Document contrast ratios in accessibility section

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Attention Badge State:**
```typescript
interface AttentionBadgeProps {
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  isStuck: boolean;            // 30+ min idle
  priority: 'error' | 'stuck' | 'waiting' | 'active' | 'idle';
}

// Priority calculation: error > stuck > waiting > active/idle
function calculatePriority(status: string, isStuck: boolean): string {
  if (status === 'error') return 'error';
  if (isStuck) return 'stuck';
  if (status === 'waiting') return 'waiting';
  return status;
}
```

**Oceanic Calm Color Palette (from Tech Spec):**
- Error: #BF616A (Nord11 - red)
- Stuck: #EBCB8B (Nord13 - yellow)
- Waiting: #88C0D0 (Nord8 - blue)
- Active: #A3BE8C (Nord14 - green)
- Idle: #4C566A (Nord2 - dark grey)

**From Architecture (docs/architecture.md)**:

**UX Design Principles:**
- WCAG AA contrast compliance required
- Tooltips use Radix UI (@radix-ui/react-tooltip)
- Real-time updates via WebSocket (no polling)

**Session State Model:**
- Session interface extended in Story 4.1 with `lastActivity`, `status`, `metadata.stuckSince`
- Status transitions: active → idle (5 min) → stuck (30 min)
- "Waiting" status triggered by PTY output ending with "?"

### Project Structure Notes

**New Files to Create:**
```
frontend/src/components/
├── AttentionBadge.tsx          # Badge component with priority logic
└── AttentionBadge.test.tsx     # Unit tests for badge
```

**Files to Modify:**
```
frontend/src/
├── components/SessionList.tsx  # Add badge to session list, implement sorting
├── components/SessionList.test.tsx  # Update tests for badge + sorting
├── App.tsx (or tab component)  # Add badge to session tabs
├── types.ts                    # Optional: Add computedPriority field
```

**No New Dependencies:**
- `@radix-ui/react-tooltip` already installed (confirmed in Epic 3)
- No new npm packages required for this story

### Implementation Guidance

**AttentionBadge Component Pattern:**
```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';

interface AttentionBadgeProps {
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  lastActivity: string;  // ISO 8601
  isStuck: boolean;
}

export function AttentionBadge({ status, lastActivity, isStuck }: AttentionBadgeProps) {
  const priority = calculatePriority(status, isStuck);

  // Only show badge for error, stuck, or waiting
  if (!['error', 'stuck', 'waiting'].includes(priority)) {
    return null;
  }

  const colorMap = {
    error: '#BF616A',
    stuck: '#EBCB8B',
    waiting: '#88C0D0',
  };

  const tooltipMap = {
    error: 'Session crashed',
    stuck: `No output for 30+ minutes - last activity ${formatRelativeTime(lastActivity)}`,
    waiting: `Waiting for input - ${formatRelativeTime(lastActivity)}`,
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: colorMap[priority] }}
            aria-label={tooltipMap[priority]}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipMap[priority]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function calculatePriority(status: string, isStuck: boolean): string {
  if (status === 'error') return 'error';
  if (isStuck) return 'stuck';
  if (status === 'waiting') return 'waiting';
  return status;
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
```

**Session List Sorting Pattern:**
```typescript
// In SessionList.tsx
const sortedSessions = useMemo(() => {
  return [...sessions].sort((a, b) => {
    const priorityA = calculatePriority(a.status, isStuck(a));
    const priorityB = calculatePriority(b.status, isStuck(b));

    const priorityOrder = { error: 0, stuck: 1, waiting: 2, active: 3, idle: 4 };

    // Primary sort: priority
    if (priorityOrder[priorityA] !== priorityOrder[priorityB]) {
      return priorityOrder[priorityA] - priorityOrder[priorityB];
    }

    // Secondary sort: lastActivity descending (most recent first)
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}, [sessions]);

function isStuck(session: Session): boolean {
  if (!session.lastActivity) return false;
  const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();
  return timeSinceActivity > 30 * 60 * 1000; // 30 minutes
}
```

**Testing Considerations:**
- Mock `Date.now()` for deterministic relative time formatting
- Test all badge visibility conditions (only error/stuck/waiting)
- Verify sorting edge cases: all same priority, empty session list, single session
- Test tooltip accessibility with screen readers (aria-label attribute)

### Learnings from Previous Story

**From Story 4-1 (Session Status Tracking with Idle Detection)**

**Status**: drafted

**New Infrastructure Created:**
- **Session interface extended** in `backend/src/types.ts` and `frontend/src/types.ts`:
  - `lastActivity: string` (ISO 8601 UTC timestamp)
  - `metadata.stuckSince?: string`, `metadata.lastWarning?: string`
  - Status enum: 'active' | 'waiting' | 'idle' | 'error' | 'stopped'
- **WebSocket message types** (defined in types.ts, documented in websocket-protocol.md):
  - `session.status`: { type, sessionId, status, lastActivity, isStuck }
  - `session.warning`: { type, sessionId, message, severity }
  - `session.needsInput`: { type, sessionId, message }
- **StatusChecker service** (`backend/src/statusChecker.ts`):
  - Idle detection: 5 minutes threshold
  - Stuck detection: 30 minutes threshold
  - Runs interval timer every 60 seconds
- **Waiting detection pattern** (in `backend/src/ptyManager.ts`):
  - Detects PTY output ending with "?"
  - 10-second timeout triggers 'waiting' status
- **Frontend WebSocket handling** (`frontend/src/hooks/useWebSocket.ts`):
  - Handlers for new message types added in Story 4.1
  - SessionContext state updates on status changes

**Patterns to Follow:**
- **ISO 8601 UTC timestamps**: Always use `new Date().toISOString()` for dates
- **Status state management**: SessionContext already tracks status, lastActivity, metadata
- **Real-time updates**: WebSocket message → SessionContext update → component re-render (no polling)
- **TypeScript strict mode**: Maintain strict null checks for optional fields

**Integration Points for This Story:**
- **AttentionBadge** will consume Session state from SessionContext (status, lastActivity, metadata.stuckSince)
- **Priority calculation** uses status field + computed isStuck boolean (lastActivity > 30 min)
- **WebSocket updates** from Story 4.1 will automatically trigger badge re-renders
- No additional backend changes needed - Story 4.1 provides all required data

**Technical Debt Items:**
- None that affect this story directly
- Story 4.1 may still be in development - ensure all WebSocket message types are implemented

**Decisions Made in Previous Story:**
1. Status field extended to include 'waiting' and 'idle' states
2. Stuck detection uses 30-minute threshold (hardcoded, not configurable)
3. WebSocket message types use flat structure (not nested)
4. lastActivity field uses ISO 8601 UTC (not Unix timestamps)

**Files to Be Aware Of:**
- `frontend/src/types.ts` - Session interface with status, lastActivity fields
- `frontend/src/hooks/useWebSocket.ts` - WebSocket message handlers
- `frontend/src/context/SessionContext.tsx` (if exists) - Session state management
- `docs/websocket-protocol.md` - WebSocket message type documentation

[Source: docs/sprint-artifacts/4-1-session-status-tracking-with-idle-detection.md#Dev-Notes]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - Attention Badge State interface, priority calculation
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.5-AC4.6 badge requirements
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Detailed-Design] - Services and Modules section
- [Source: docs/architecture.md] - UX design principles, WCAG AA compliance
- [Source: docs/sprint-artifacts/4-1-session-status-tracking-with-idle-detection.md] - Session interface extension, WebSocket message types

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-1
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
