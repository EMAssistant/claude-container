# Story 3.10: Empty State UI for First-Time Users

Status: ready-for-review

## Story

As a new user launching Claude Container for the first time,
I want to see a welcoming empty state with clear next steps,
so that I understand how to create my first session and get started quickly.

## Acceptance Criteria

1. **AC3.18** - Empty state component displays when no sessions exist (from Epic 3 Tech Spec)
2. Empty state shows welcoming message explaining Claude Container's purpose
3. Empty state includes prominent "Create New Session" call-to-action button
4. Empty state displays quick start guide or feature highlights
5. Component is visually aligned with Oceanic Calm theme
6. Empty state is responsive and centers in available space
7. Clicking "Create New Session" button opens SessionModal
8. Empty state is conditionally rendered only when `sessions.length === 0`
9. Notification permission banner appears on first load if not granted (AC3.19 from tech spec)

## Tasks / Subtasks

- [x] Task 1: Create EmptyState component (AC: 1, 2, 4, 5, 6, 8)
  - [x] Create `frontend/src/components/EmptyState.tsx` file
  - [x] Design component layout with centered container and vertical stack
  - [x] Add welcoming headline (e.g., "Start your first project with Claude")
  - [x] Add descriptive text explaining parallel session management
  - [x] Include feature highlights (Parallel Development, BMAD Integration, Document Viewer)
  - [x] Apply Oceanic Calm theme colors and typography
  - [x] Make component responsive with proper spacing and constraints
  - [x] Implement conditional rendering based on session count

- [x] Task 2: Integrate "Create New Session" button (AC: 3, 7)
  - [x] Import SessionModal component or trigger function
  - [x] Add prominent CTA button with shadcn/ui Button component
  - [x] Wire onClick handler to open SessionModal
  - [x] Style button with primary variant and appropriate size (lg)
  - [x] Add visual emphasis with full-width button

- [x] Task 3: Implement notification permission banner (AC: 9)
  - [x] NotificationBanner component already exists at `frontend/src/components/NotificationBanner.tsx`
  - [x] Uses NotificationContext for permission state management
  - [x] Check browser Notification API permission status via hook
  - [x] Display banner if permission is "default" (not asked yet)
  - [x] "Enable Notifications" button calls `Notification.requestPermission()`
  - [x] "Maybe Later" and close button dismiss banner
  - [x] Style banner with Oceanic Calm blue (#88C0D0)
  - [x] Positioned fixed at top of viewport
  - [x] Dismissal state persisted via NotificationContext and localStorage

- [x] Task 4: Integrate EmptyState into App layout (AC: 8)
  - [x] Import EmptyState component in `frontend/src/App.tsx`
  - [x] Add conditional rendering: `{sessions.length === 0 ? <EmptyState /> : <MainLayout />}`
  - [x] Ensure EmptyState uses full viewport height for proper centering
  - [x] Test transition from empty state to main layout after session creation
  - [x] Added NotificationProvider wrapper for NotificationBanner
  - [x] Updated sessions initialization to empty array instead of default session

- [x] Task 5: Write frontend tests (AC: All)
  - [x] Unit test: EmptyState renders when sessions array is empty
  - [x] Unit test: EmptyState does not render when sessions exist
  - [x] Unit test: Clicking "Create New Session" calls modal open handler
  - [x] Unit test: NotificationBanner already has comprehensive tests (17 tests)
  - [x] Unit test: Verified EmptyState content, styling, and button click handlers
  - [x] Integration test: App.tsx conditional rendering verified (10 tests passing)

## Dev Notes

### Empty State Design Guidance

From Epic 3 Tech Spec (AC3.18): "Empty state shows on first load - No sessions → welcoming empty state with Create button"

**Purpose**: First-time user experience that eliminates confusion and provides clear path to productivity.

**Key Elements**:
1. **Welcoming Message**: Brief explanation of Claude Container's value proposition
2. **Feature Highlights**: Quick bullets showcasing key capabilities (parallel sessions, BMAD integration, document viewer)
3. **Clear CTA**: Prominent button to create first session
4. **Visual Hierarchy**: Use Oceanic Calm theme to create calm, professional appearance

**Example Content** (adjust as needed):
```
Welcome to Claude Container

Manage up to 4 parallel Claude sessions with isolated git worktrees,
real-time workflow tracking, and integrated document review.

✓ Parallel Development - Work on multiple epics simultaneously
✓ BMAD Integration - Track workflow progress in real-time
✓ Document Viewer - Review artifacts without leaving the terminal

[Create Your First Session →]
```

### Notification Permission

From Epic 3 Tech Spec (AC3.19): "Notification permission requested - First load shows permission banner if not granted"

**Implementation**:
- Use browser's native `Notification.requestPermission()` API
- Only show banner if permission is `"default"` (not yet asked)
- Don't re-prompt if user previously denied
- Banner should be dismissible and store dismissal in localStorage
- Actual notification sending happens in Epic 4 Story 4.3 (this story only handles permission setup)

### Architecture Alignment

**Oceanic Calm Theme** (from ADR-007 and architecture):
- Background: #2E3440 (dark nord)
- Text: #D8DEE9 (light nord)
- Accent: #88C0D0 (blue) or #A3BE8C (green) for CTA
- Typography: Clean, readable fonts with proper contrast

**Component Location**: `frontend/src/components/EmptyState.tsx` (flat structure per architecture)

**shadcn/ui Components to Use**:
- `Button` - For "Create New Session" CTA
- `Card` (optional) - To contain welcome content

### Testing Strategy

**Frontend Unit Tests** (Vitest):
- Test conditional rendering logic
- Test button click handlers
- Test Notification API integration
- Test localStorage persistence for banner dismissal

**Visual Regression** (optional):
- Screenshot test of EmptyState component
- Verify Oceanic Calm theme colors applied correctly

### Project Structure Notes

New files created:
- `frontend/src/components/EmptyState.tsx` - Main empty state component
- `frontend/src/components/NotificationBanner.tsx` - Notification permission banner

Modified files:
- `frontend/src/App.tsx` - Add conditional rendering for empty state vs main layout

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#acceptance-criteria] - AC3.18, AC3.19
- [Source: docs/architecture.md#technology-stack-details] - Oceanic Calm theme, shadcn/ui components
- [Source: docs/architecture-decisions.md#ADR-006] - React + xterm.js decision
- [Source: docs/architecture.md#consistency-rules] - Component naming, file structure

### Learnings from Previous Story

No previous story in Epic 3 has been implemented yet (3-10 is the first story to be drafted). Story 3-1 through 3-9 are still in backlog status.

**Epic Context**: This is the first story in Epic 3 being drafted. Epic 3 focuses on workflow visibility and document review, but the empty state is a foundational UX element needed before users can interact with any sessions or workflows.

## Dev Agent Record

### Context Reference

- [Story Context XML](./3-10-empty-state-ui-for-first-time-users.context.xml)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

None - implementation completed without issues

### Completion Notes List

1. **EmptyState Component Created**: Created new `frontend/src/components/EmptyState.tsx` component with welcoming content, feature highlights, and CTA button
2. **NotificationBanner Already Existed**: NotificationBanner component and NotificationContext were already implemented in previous stories, so Task 3 was verified rather than created
3. **App.tsx Modified for Empty State**:
   - Changed sessions initialization from default session to empty array `[]`
   - Changed activeSessionId type from `string` to `string | null`
   - Added conditional rendering: EmptyState when `sessions.length === 0`, otherwise main layout
   - Added NotificationProvider wrapper
   - Added SessionModal to empty state view
   - Added conditional rendering for Terminal (only when activeSessionId exists)
4. **TypeScript Fixes**:
   - Updated SessionList props to accept `activeSessionId: string | null`
   - Added null check for Terminal rendering
   - Removed unused `defaultSessionId` variable
5. **Tests Written**: Created comprehensive EmptyState tests (7 tests) and updated App.test.tsx with empty state integration tests (10 tests total)
6. **Build Successful**: All tests passing, build completes without errors

### File List

**Created:**
- `frontend/src/components/EmptyState.tsx` - Empty state component with welcoming UI
- `frontend/src/components/EmptyState.test.tsx` - Unit tests for EmptyState component

**Modified:**
- `frontend/src/App.tsx` - Added conditional rendering, NotificationProvider, empty sessions initialization
- `frontend/src/components/SessionList.tsx` - Updated props to accept null activeSessionId
- `frontend/src/App.test.tsx` - Added empty state integration tests, updated mocks

**Verified (Already Existed):**
- `frontend/src/components/NotificationBanner.tsx` - Already implemented with full functionality
- `frontend/src/components/NotificationBanner.test.tsx` - Already has 17 comprehensive tests
- `frontend/src/context/NotificationContext.tsx` - Already provides permission state management

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-11-25 | 1.0 | Kyle (SM) | Initial story creation from Epic 3 tech spec |
| 2025-11-25 | 2.0 | Claude (Dev Agent) | Story implementation completed - all tasks done, tests passing, build successful |
