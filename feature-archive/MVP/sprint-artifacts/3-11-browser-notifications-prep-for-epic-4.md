# Story 3.11: Browser Notifications Prep for Epic 4

Status: done

## Story

As a developer managing multiple parallel Claude sessions,
I want the application to request browser notification permission on first load,
so that I can receive notifications when Claude asks questions (implemented in Epic 4).

## Acceptance Criteria

1. **AC3.19 (from Tech Spec)**: Notification permission requested
   - Given: User loads the application for the first time
   - When: The application checks notification permission status
   - Then: If permission is "default" (not granted/denied), show permission request banner/prompt
   - And: Store permission response to avoid repeated requests

2. **Permission Check on Load**: Application checks `Notification.permission` status on mount
   - If "granted": No UI shown, ready for Epic 4
   - If "denied": Show informational message that notifications are disabled
   - If "default": Show permission request UI

3. **Permission Request UI**: User-friendly prompt explaining notification purpose
   - Clear explanation: "Get notified when Claude needs your input"
   - Two actions: "Enable Notifications" button and "Maybe Later" dismissal
   - Non-blocking: User can continue working without granting permission
   - Dismissible: Close button hides banner (can be re-shown in Settings)

4. **Permission State Persistence**: Track permission request/response
   - Store in localStorage: whether user has seen/responded to prompt
   - Don't show banner again if user clicked "Maybe Later"
   - Re-check permission on each app load (user may change in browser settings)

5. **Settings Integration**: Notification preferences accessible in Settings dropdown
   - Show current permission status (Granted/Denied/Not Requested)
   - If denied: Provide instructions to enable in browser settings
   - If not requested: Button to trigger permission request again
   - If granted: Confirmation message + option to test notification (Epic 4)

6. **No Actual Notifications**: This story only requests permission
   - Do NOT implement notification sending logic (Epic 4 Story 4.3)
   - Only check `Notification.permission` and call `Notification.requestPermission()`
   - Prepare NotificationContext/hook for Epic 4 to consume

## Tasks / Subtasks

- [x] Task 1: Implement notification permission check module (AC: #1, #2)
  - [x] Create `src/hooks/useNotificationPermission.ts` hook
  - [x] Check `Notification.permission` on hook mount
  - [x] Implement `requestPermission()` wrapper function
  - [x] Handle permission state changes (granted/denied/default)
  - [x] Add localStorage key for "hasSeenPermissionPrompt" tracking

- [x] Task 2: Create notification permission banner component (AC: #3)
  - [x] Create `src/components/NotificationBanner.tsx`
  - [x] Design banner UI matching Oceanic Calm theme
  - [x] Add explanatory text: "Get notified when Claude needs input"
  - [x] Implement "Enable Notifications" button (calls requestPermission)
  - [x] Implement "Maybe Later" button (stores dismissal in localStorage)
  - [x] Add close/dismiss icon button
  - [x] Make banner non-blocking (positioned at top, doesn't block interaction)

- [x] Task 3: Integrate banner into app layout (AC: #2, #4)
  - [x] Add NotificationBanner to App.tsx layout (above top bar)
  - [x] Conditionally render based on permission status and dismissal state
  - [x] Show only when permission is "default" AND not dismissed
  - [x] Hide banner after permission granted/denied
  - [x] NotificationProvider wraps entire app

- [x] Task 4: Add notification settings to Settings dropdown (AC: #5)
  - [x] Extend Settings dropdown menu with "Notifications" section
  - [x] Display current permission status with icon indicator
  - [x] If denied: Show browser instructions link/text
  - [x] If default: Show "Request Permission" button
  - [x] If granted: Show "Notifications Enabled" confirmation
  - [x] Add "Show Banner Again" button to reset dismissal

- [x] Task 5: Create NotificationContext for Epic 4 preparation (AC: #6)
  - [x] Create `src/context/NotificationContext.tsx`
  - [x] Provide permission state to consuming components
  - [x] Provide `requestPermission` function
  - [x] Document context API for Epic 4 Story 4.3 (notification sending)
  - [x] Export useNotification hook for consumers

- [x] Task 6: Write unit tests (AC: all)
  - [x] Test useNotificationPermission hook states (granted/denied/default)
  - [x] Test NotificationBanner conditional rendering
  - [x] Test localStorage persistence (dismissal state)
  - [ ] Test Settings dropdown notification section (deferred)
  - [x] Test permission request flow (mock Notification API)

- [x] Task 7: Update documentation
  - [x] Add notification permission flow to architecture docs (inline code documentation)
  - [x] Document localStorage keys used (in NotificationContext)
  - [x] Note Epic 4 integration points for future stories (in component/context comments)

## Dev Notes

### Architecture Patterns and Constraints

**Browser Notification API Requirements**:
- **Secure Context Only**: Notification API requires HTTPS or localhost (already satisfied)
- **User Gesture Required**: `requestPermission()` must be called from user interaction (button click)
- **Permission States**: "granted" / "denied" / "default" (not yet asked)
- **Persistent Permission**: Browser remembers user's choice across sessions

**From Architecture (docs/architecture.md)**:
- Use React Context API for notification state management (ADR-005)
- Custom hook pattern: `useNotificationPermission` for permission logic
- shadcn/ui components for banner UI (Alert component recommended)
- localStorage for non-critical state (permission prompt dismissal)

**From Tech Spec Epic 3**:
- AC3.19: "Notification permission requested on first load"
- Out of scope for Epic 3: Actual notification sending (Epic 4 Story 4.3)
- Banner should be non-blocking and dismissible
- Settings dropdown integration required

### Project Structure Notes

**New Files to Create**:
```
frontend/src/
├── hooks/
│   └── useNotificationPermission.ts    # Permission state + request logic
├── components/
│   └── NotificationBanner.tsx          # Permission request UI banner
├── context/
│   └── NotificationContext.tsx         # Global notification state
└── lib/
    └── notifications.ts                # Helper functions (optional)
```

**Files to Modify**:
```
frontend/src/
├── App.tsx                             # Add NotificationBanner to layout
└── components/
    └── [Settings dropdown component]  # Add notification section
```

**localStorage Keys**:
- `notification-permission-dismissed`: Boolean, true if user clicked "Maybe Later"
- `notification-permission-last-check`: ISO timestamp of last permission check

### Implementation Guidance

**Notification Permission Flow**:
```
1. App loads → useNotificationPermission hook initializes
2. Check Notification.permission:
   - "granted" → Set state, no UI
   - "denied" → Set state, show info in Settings
   - "default" + not dismissed → Show banner
3. User clicks "Enable Notifications":
   → Call Notification.requestPermission()
   → Update state with result
   → Hide banner
4. User clicks "Maybe Later":
   → Set localStorage dismissed flag
   → Hide banner
```

**Epic 4 Integration Points**:
- Story 4.3 will consume NotificationContext for sending notifications
- Context should provide:
  - `permissionGranted: boolean` - Quick check for notification capability
  - `permissionState: string` - Full state (granted/denied/default)
  - `requestPermission: () => Promise<string>` - Request function
  - Future: `sendNotification(title, body, options)` - Added in Epic 4

**Testing Considerations**:
- Mock `window.Notification` API in tests (not available in jsdom)
- Test all three permission states independently
- Test localStorage persistence and cleanup
- Test user gesture requirement (permission request from button click)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Acceptance-Criteria] - AC3.19 Notification permission requested
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#In-Scope] - "Browser Notification Permission: Prompt for notification permission on first load (notifications implemented in Epic 4)"
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Out-of-Scope] - "Browser notification sending (permission setup only—actual notifications deferred to Epic 4 Story 4.3)"
- [Source: docs/architecture.md#ADR-005] - React Context API for state management
- [Source: docs/architecture.md#Technology-Stack-Details] - shadcn/ui component library

### Learnings from Previous Story

**No Previous Story in Epic 3**: This is the first story in Epic 3. Previous epic completed successfully.

**Relevant Epic 2 Patterns to Follow**:
- Context pattern established in Epic 2 (SessionContext, WebSocketContext)
- localStorage usage patterns from session state persistence
- shadcn/ui component integration (Dialogs, Buttons, etc.)
- Testing patterns for React hooks and components

**From Epic 2 Retrospective (docs/sprint-artifacts/epic-2-retrospective.md)**:
- **Lesson**: "TypeScript strict mode caught edge cases early" - Enable strict null checks for permission state
- **Lesson**: "Context splitting prevents re-renders" - Keep NotificationContext focused, don't mix with other state
- **Success**: "Comprehensive test coverage (96%+) prevented regressions" - Aim for similar coverage

## Change Log

**2025-11-25**:
- Story created from Epic 3 tech spec
- Status: drafted
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/3-11-browser-notifications-prep-for-epic-4.context.xml

### Agent Model Used

- Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

- All tests passed: 42/42 tests for notification components (10 + 15 + 17)
- Pre-existing App.test.tsx failure unrelated to this story (missing `on` method mock in useWebSocket mock)

### Completion Notes List

**ALL TASKS COMPLETE**

**Completed:**
1. Created `useNotificationPermission.ts` hook with full permission state management
   - Checks permission on mount
   - Provides `requestPermission()` function
   - Handles all three states: granted/denied/default
   - Gracefully handles missing Notification API

2. Created `NotificationContext.tsx` context provider
   - Wraps useNotificationPermission hook
   - Tracks banner dismissal state in localStorage (key: `notification-permission-dismissed`)
   - Tracks last check timestamp (key: `notification-permission-last-check`)
   - Provides convenience boolean `permissionGranted`
   - Auto-dismisses banner after permission request
   - Exports `useNotification()` hook for consumers

3. Created `NotificationBanner.tsx` component
   - Oceanic Calm theme (#88C0D0 blue background)
   - Fixed positioning at top, z-index 1000
   - Only shows when permission is "default" AND not dismissed
   - Two buttons: "Enable Notifications" and "Maybe Later"
   - Close button (X icon)
   - Fully accessible with ARIA labels

4. App.tsx integration (Task 3)
   - NotificationProvider wraps entire app
   - NotificationBanner rendered above ConnectionBanner
   - Conditional visibility handled by banner component

5. TopBar Settings dropdown integration (Task 4)
   - "Notifications" section in Settings dropdown menu
   - Permission state indicator with icons (BellRing/BellOff/Bell)
   - "Notifications Enabled" when granted (green icon)
   - "Notifications Blocked" + "How to Enable" when denied (red icon, help toast)
   - "Not Requested" + "Request Permission" + "Show Banner Again" when default
   - 7 new tests added to TopBar.test.tsx (29 total tests now pass)

6. Comprehensive test coverage: 49+ tests
   - useNotificationPermission: 10 tests
   - NotificationContext: 15 tests
   - NotificationBanner: 17 tests
   - TopBar notification settings: 7 tests

**Epic 4 Integration Points:**
- NotificationContext provides `permissionGranted` boolean for quick checks
- Context ready to extend with `sendNotification()` function in Epic 4 Story 4.3
- localStorage keys documented for future reference

**Decisions Made:**
1. Used lucide-react Bell icon for banner visual consistency
2. Auto-dismiss banner after permission request (regardless of result) per UX best practice
3. Separate context file instead of extending existing context (ADR-005: context splitting)
4. Fixed positioning with high z-index to ensure banner always visible above content
5. Used `notification-permission-dismissed` key instead of original `notification-permission-last-check` for dismissal tracking
6. Added DropdownMenuLabel for "Notifications" section header in Settings
7. Three-state conditional rendering in Settings: granted/denied/default

**localStorage Keys Used:**
- `notification-permission-dismissed`: Boolean (true when user clicks "Maybe Later" or close)
- `notification-permission-last-check`: ISO timestamp (updated when permission changes from default)

### File List

**Created:**
- `frontend/src/hooks/useNotificationPermission.ts` (59 lines)
- `frontend/src/hooks/useNotificationPermission.test.ts` (178 lines)
- `frontend/src/context/NotificationContext.tsx` (105 lines)
- `frontend/src/context/NotificationContext.test.tsx` (247 lines)
- `frontend/src/components/NotificationBanner.tsx` (73 lines)
- `frontend/src/components/NotificationBanner.test.tsx` (229 lines)

**Modified:**
- `frontend/src/App.tsx` (NotificationProvider wrapper, NotificationBanner in layout)
- `frontend/src/components/TopBar.tsx` (Notification settings in Settings dropdown)
- `frontend/src/components/TopBar.test.tsx` (7 new tests for notification settings)
- `docs/sprint-artifacts/3-11-browser-notifications-prep-for-epic-4.md` (this file)
