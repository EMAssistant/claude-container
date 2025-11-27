# Story 4-16: Session List Hydration on Page Load

## User Story

**As a** Claude Container user
**I want** to see all existing sessions when I open the app
**So that** I can continue working with sessions created earlier or in other tabs

## Background

Currently, the frontend starts with an empty sessions array (`useState<Session[]>([])`). Sessions only appear when created in the current tab via WebSocket events. This causes confusion when:
- Container has restored sessions from a previous run
- User opens a new browser tab
- User refreshes the page

The backend maintains session state in `SessionManager`, but there's no REST endpoint to fetch all sessions on initial page load.

## Acceptance Criteria

```gherkin
AC1: Backend Provides Session List Endpoint
  GIVEN the backend is running
  WHEN GET /api/sessions is called
  THEN return 200 with JSON body { sessions: Session[] }
  AND include all active sessions from SessionManager

AC2: Frontend Fetches Sessions on Mount
  GIVEN user opens the app in a browser
  WHEN the App component mounts
  THEN fetch GET /api/sessions
  AND populate the sessions state with the response

AC3: Loading State During Fetch
  GIVEN sessions are being fetched
  WHEN fetch is in progress
  THEN show loading indicator (optional: skeleton UI)
  AND do not show EmptyState prematurely

AC4: Error Handling for Failed Fetch
  GIVEN GET /api/sessions fails
  WHEN error occurs (network, server error)
  THEN show error toast "Failed to load sessions"
  AND allow manual retry via refresh or button

AC5: Empty State When No Sessions Exist
  GIVEN backend returns empty sessions array
  WHEN fetch completes
  THEN show EmptyState component as normal
```

## Technical Implementation

### Backend Changes

**File**: `backend/src/server.ts`

```typescript
// Add endpoint after existing routes
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    logger.error('Failed to get sessions', { error });
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});
```

**File**: `backend/src/sessionManager.ts` (if not exists)
- Ensure `getAllSessions()` method returns array of Session objects

### Frontend Changes

**File**: `frontend/src/App.tsx`

```typescript
// Add after existing state declarations
const [sessionsLoading, setSessionsLoading] = useState(true);

// Add useEffect for initial fetch
useEffect(() => {
  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast({
        type: 'error',
        title: 'Failed to load sessions',
        description: 'Please refresh the page to try again.',
      });
    } finally {
      setSessionsLoading(false);
    }
  };

  fetchSessions();
}, []);
```

## Files to Modify

- `backend/src/server.ts` - Add GET /api/sessions endpoint
- `frontend/src/App.tsx` - Add fetch on mount + loading state

## Estimated Effort

1-2 hours

## Dependencies

None

## Test Scenarios

1. Fresh app load with 0 sessions - shows EmptyState
2. Fresh app load with 3 sessions - shows all 3 in tabs
3. API returns error - shows error toast
4. Slow network - loading state visible briefly

---

## Code Review Notes

**Review Date:** 2025-11-27
**Reviewer:** Claude Code Review Agent
**Outcome:** REVISE

### Summary

The implementation partially fulfills the story requirements. The backend endpoint and basic frontend fetch work correctly, but critical UX concerns remain around loading state and error recovery.

### AC Validation

| AC | Status | Evidence |
|----|--------|----------|
| AC1: Backend GET /api/sessions | ✅ PASS | `backend/src/server.ts:227-245` - Endpoint returns `{ sessions: Session[] }` correctly |
| AC2: Frontend fetches on mount | ✅ PASS | `frontend/src/App.tsx:288-349` - Fetches when `isConnected` becomes true |
| AC3: Loading state during fetch | ❌ FAIL | No `sessionsLoading` state implemented. EmptyState renders prematurely before fetch completes |
| AC4: Error handling | ⚠️ PARTIAL | Toast notification works, but no retry button/mechanism exists as specified ("allow manual retry") |
| AC5: Empty state when no sessions | ⚠️ CONDITIONAL | Logic exists but depends on AC3 fix to work correctly |

### Required Changes

1. **[CRITICAL] Add loading state (AC3)**
   - Add `const [sessionsLoading, setSessionsLoading] = useState(true)` to App.tsx
   - Wrap fetch in try/finally that sets `setSessionsLoading(false)`
   - Conditionally render loading indicator OR delay EmptyState until `!sessionsLoading`
   - File: `frontend/src/App.tsx:66` (after sessions state declaration)

2. **[REQUIRED] Add retry mechanism (AC4)**
   - Add retry button to error toast OR
   - Store fetch error state and show "Retry" button in UI
   - File: `frontend/src/App.tsx:333-340` (in catch block)

3. **[RECOMMENDED] Add integration test**
   - Test `GET /api/sessions` endpoint returns sessions correctly
   - Test empty array response
   - Test 500 error response
   - File: `backend/src/server.sessions.test.ts` (new file)

### Code Quality Notes

**Positives:**
- Backend error handling is well-structured with proper logging
- Frontend uses React patterns correctly (useEffect, useCallback)
- TypeScript types are properly used throughout
- No security vulnerabilities identified

**Minor Issues:**
- `eslint-disable-next-line react-hooks/exhaustive-deps` comment in App.tsx is acceptable given the intended behavior, but should have explanatory comment

### Action Items

- [ ] Implement loading state per AC3 specification
- [ ] Add retry mechanism per AC4 specification
- [ ] Consider adding skeleton UI for better loading UX
- [ ] Add integration test for GET /api/sessions endpoint
