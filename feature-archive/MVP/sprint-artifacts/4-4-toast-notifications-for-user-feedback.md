# Story 4.4: Toast Notifications for User Feedback

Status: drafted

## Story

As a developer using Claude Container,
I want toast notifications for important system events (session creation, errors, reconnections, warnings),
so that I receive immediate visual feedback without disrupting my workflow or requiring background tab monitoring.

## Acceptance Criteria

1. **AC4.10**: Toast success shows green border
   - Given: A successful operation completes (session created, BMAD update successful)
   - When: Success toast is displayed
   - Then: Toast has #A3BE8C green left border (4px solid)
   - And: Background is #2E3440 with subtle green tint
   - And: Auto-dismisses after 4 seconds

2. **AC4.11**: Toast error shows red border and persists longer
   - Given: An error occurs (session creation failed, API error)
   - When: Error toast is displayed
   - Then: Toast has #BF616A red left border (4px solid)
   - And: Background is #2E3440 with subtle red tint
   - And: Auto-dismisses after 8 seconds (longer than success)

3. **AC4.12**: Toast warning persists until resolved
   - Given: A recoverable warning occurs (WebSocket disconnected, reconnecting...)
   - When: Warning toast is displayed
   - Then: Toast has #EBCB8B yellow left border (4px solid)
   - And: Toast does NOT auto-dismiss (autoDismiss: false)
   - And: Toast can be manually dismissed with close button
   - And: When condition resolves (reconnected), toast updates or dismisses

4. **AC4.13**: Toasts stack vertically (max 3)
   - Given: Multiple toast events occur rapidly
   - When: More than 3 toasts are shown
   - Then: Only 3 toasts are visible on screen at once
   - And: Additional toasts are queued and shown as earlier toasts dismiss
   - And: Toasts stack from top-right corner, newest on top

5. **AC4.14**: Duplicate toasts prevented
   - Given: Same message is triggered within 1 second
   - When: Duplicate toast is attempted
   - Then: Duplicate is ignored (not added to queue)
   - And: Only first toast is shown
   - And: Deduplication matches on message text (case-insensitive)

6. **Toast info type (bonus)**
   - Given: Informational event occurs (session resumed, file saved)
   - When: Info toast is displayed
   - Then: Toast has #88C0D0 blue left border (4px solid)
   - And: Auto-dismisses after 5 seconds

7. **Toast animations (smooth)**
   - Given: Toast appears or dismisses
   - When: Animation plays
   - Then: Slide-in from right with 300ms ease-out
   - And: Slide-out to right with 200ms ease-in
   - And: Fade in/out combined with slide (opacity 0→1→0)
   - And: Respects `prefers-reduced-motion` (instant show/hide if enabled)

8. **Toast action button (optional)**
   - Given: Toast has actionable content (e.g., "Retry" on error)
   - When: Toast is displayed with action prop
   - Then: Action button appears inline
   - And: Button click executes action.onClick callback
   - And: Toast dismisses after action execution

9. **Frontend unit tests**: Toast system tested
   - Test: ToastProvider renders toasts with correct styling
   - Test: Auto-dismiss timing (success 4s, error 8s, warning manual, info 5s)
   - Test: Max 3 visible toasts, queue overflow
   - Test: Duplicate prevention within 1s window
   - Test: Manual dismiss via close button
   - Test: Action button onClick triggers callback
   - Coverage: ≥50% for toast-related components

## Tasks / Subtasks

- [ ] Task 1: Create ToastProvider component with Radix UI Toast (AC: #10, #11, #12, #13)
  - [ ] Install @radix-ui/react-toast if not already present
  - [ ] Create `frontend/src/components/ToastProvider.tsx`
  - [ ] Implement ToastProvider with React Context API
  - [ ] Define toast types: success, error, warning, info
  - [ ] Set up auto-dismiss timing per type (success 4s, error 8s, warning false, info 5s)
  - [ ] Implement toast stacking with max 3 visible
  - [ ] Add queue system for overflow toasts
  - [ ] Wrap App.tsx with ToastProvider

- [ ] Task 2: Style toasts with Oceanic Calm theme (AC: #10, #11, #12, #6)
  - [ ] Apply Oceanic Calm colors to toast borders:
    - Success: #A3BE8C (green)
    - Error: #BF616A (red)
    - Warning: #EBCB8B (yellow)
    - Info: #88C0D0 (blue)
  - [ ] Set background to #2E3440 with subtle type-specific tint
  - [ ] Add 4px solid left border for type indication
  - [ ] Use Lucide icons: CheckCircle (success), XCircle (error), AlertCircle (warning), Info (info)
  - [ ] Add close button (X icon) for manual dismiss
  - [ ] Ensure WCAG AA contrast (white text on dark background)

- [ ] Task 3: Implement toast animations (AC: #7)
  - [ ] Create CSS keyframes for slide-in from right (300ms ease-out)
  - [ ] Create CSS keyframes for slide-out to right (200ms ease-in)
  - [ ] Combine with opacity fade (0→1 on enter, 1→0 on exit)
  - [ ] Add `@media (prefers-reduced-motion: reduce)` query
  - [ ] Disable animations if prefers-reduced-motion is enabled
  - [ ] Test animations in browser DevTools

- [ ] Task 4: Implement duplicate prevention (AC: #14)
  - [ ] Track recent toast messages in state (with timestamps)
  - [ ] Check if same message exists within 1 second
  - [ ] Ignore duplicate if found (don't add to queue)
  - [ ] Clean up old entries from deduplication cache (after 2s)
  - [ ] Add unit test for duplicate prevention

- [ ] Task 5: Add toast action button support (AC: #8)
  - [ ] Extend ToastNotification interface with optional action prop:
    - `action?: { label: string; onClick: () => void }`
  - [ ] Render action button if action prop present
  - [ ] Call action.onClick on button click
  - [ ] Dismiss toast after action execution
  - [ ] Style action button with Oceanic Calm accent color
  - [ ] Add unit test for action button click

- [ ] Task 6: Integrate toast system with existing app events (AC: #10, #11, #12)
  - [ ] Session creation success → Success toast: "Session created: [name]"
  - [ ] Session creation error → Error toast with error message
  - [ ] WebSocket disconnect → Warning toast: "Connection lost. Reconnecting..."
  - [ ] WebSocket reconnect → Dismiss warning toast or show success toast
  - [ ] Session destroy success → Success toast: "Session destroyed"
  - [ ] BMAD update success → Success toast: "Workflow updated"
  - [ ] BMAD update error → Error toast with error message
  - [ ] Add toast calls in relevant components (SessionModal, useWebSocket, TopBar, etc.)

- [ ] Task 7: Write comprehensive unit tests (AC: #9)
  - [ ] `ToastProvider.test.tsx`: Toast rendering, stacking, queue
  - [ ] Test auto-dismiss timing with fake timers (jest.useFakeTimers())
  - [ ] Test max 3 visible toasts (4th toast queued)
  - [ ] Test duplicate prevention within 1s window
  - [ ] Test manual dismiss via close button
  - [ ] Test action button onClick callback
  - [ ] Test toast types (success, error, warning, info) render correct styles
  - [ ] Verify ≥50% frontend coverage for toast code

- [ ] Task 8: Integration testing with WebSocket reconnection (AC: #12)
  - [ ] Simulate WebSocket disconnect in test
  - [ ] Verify warning toast appears
  - [ ] Simulate reconnection
  - [ ] Verify toast dismisses or updates
  - [ ] Add test in `useWebSocket.test.ts`

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Toast Notification Data Model (AC4.10-AC4.14)**:
```typescript
interface ToastNotification {
  id: string;                      // UUID for unique identification
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;                 // Main toast message
  autoDismiss: boolean;            // false for warnings, true for others
  dismissDelay: number;            // ms: success 4000, error 8000, info 5000
  action?: {
    label: string;                 // Button text (e.g., "Retry")
    onClick: () => void;           // Action callback
  };
  timestamp: string;               // ISO 8601 UTC
}
```

**Toast Auto-Dismiss Timing (UX Spec 7.4)**:
- Success: 4 seconds (quick confirmation)
- Error: 8 seconds (user needs time to read error details)
- Warning: Manual dismiss only (requires user acknowledgment)
- Info: 5 seconds (moderate reading time)

**Toast Stacking Behavior (AC4.13)**:
```
┌─────────────────────────────┐
│ Toast 1 (newest)            │ ← Top-right corner
└─────────────────────────────┘
┌─────────────────────────────┐
│ Toast 2                     │ ← 10px gap
└─────────────────────────────┘
┌─────────────────────────────┐
│ Toast 3 (oldest visible)    │ ← 10px gap
└─────────────────────────────┘
  [Toast 4 queued - not visible]
  [Toast 5 queued - not visible]
```

**Duplicate Prevention Algorithm (AC4.14)**:
```typescript
// Deduplication window: 1 second
const isDuplicate = (newMessage: string): boolean => {
  const now = Date.now();
  const recentToasts = toastHistory.filter(t => now - t.timestamp < 1000);
  return recentToasts.some(t => t.message.toLowerCase() === newMessage.toLowerCase());
};
```

**From Architecture (docs/architecture.md)**:

**Radix UI Toast Component**:
- Already installed as `@radix-ui/react-toast` (Epic 3, Story 3.11)
- Provides accessible toast primitives (ARIA live regions)
- Handles viewport positioning, stacking, animations
- This story wraps Radix with custom ToastProvider + Oceanic Calm styling

**Oceanic Calm Toast Color Mapping**:
```typescript
const toastColors = {
  success: {
    border: '#A3BE8C',      // Green
    background: '#2E3440',  // Dark gray (base)
    tint: 'rgba(163, 190, 140, 0.1)', // Subtle green overlay
    icon: 'CheckCircle'
  },
  error: {
    border: '#BF616A',      // Red
    background: '#2E3440',
    tint: 'rgba(191, 97, 106, 0.1)',
    icon: 'XCircle'
  },
  warning: {
    border: '#EBCB8B',      // Yellow
    background: '#2E3440',
    tint: 'rgba(235, 203, 139, 0.1)',
    icon: 'AlertCircle'
  },
  info: {
    border: '#88C0D0',      // Blue
    background: '#2E3440',
    tint: 'rgba(136, 192, 208, 0.1)',
    icon: 'Info'
  }
};
```

**Animation Timing (Respects Reduced Motion)**:
```css
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none !important;
    transition: none !important;
  }
}
```

### Project Structure Notes

**Files to Create:**
```
frontend/src/
├── components/ToastProvider.tsx          # Toast context + Radix integration
├── components/ToastProvider.test.tsx     # Unit tests for toast system
└── types.ts                              # Add ToastNotification interface
```

**Files to Modify:**
```
frontend/src/
├── App.tsx                               # Wrap with ToastProvider
├── components/SessionModal.tsx           # Add success/error toasts on session create
├── hooks/useWebSocket.ts                 # Add warning/success toasts on disconnect/reconnect
├── components/TopBar.tsx                 # Add toasts for BMAD update success/error
└── styles/globals.css                    # Add toast animation keyframes
```

**No New Dependencies:**
- `@radix-ui/react-toast` already installed (Epic 3)
- `lucide-react` already installed for icons

### Implementation Guidance

**ToastProvider Component Pattern:**
```typescript
// frontend/src/components/ToastProvider.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import type { ToastNotification } from '@/types';

interface ToastContextValue {
  showToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [queue, setQueue] = useState<ToastNotification[]>([]);
  const [history, setHistory] = useState<{ message: string; timestamp: number }[]>([]);

  const MAX_VISIBLE = 3;
  const DEDUP_WINDOW_MS = 1000;

  const showToast = useCallback((toast: Omit<ToastNotification, 'id' | 'timestamp'>) => {
    const now = Date.now();

    // Duplicate prevention
    const isDuplicate = history.some(
      h => h.message.toLowerCase() === toast.message.toLowerCase() &&
           now - h.timestamp < DEDUP_WINDOW_MS
    );
    if (isDuplicate) return;

    // Add to history
    setHistory(prev => [...prev, { message: toast.message, timestamp: now }]);

    // Create toast
    const newToast: ToastNotification = {
      ...toast,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    // Add to visible or queue
    setToasts(prev => {
      if (prev.length < MAX_VISIBLE) {
        return [newToast, ...prev];
      } else {
        setQueue(q => [...q, newToast]);
        return prev;
      }
    });
  }, [history]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));

    // Dequeue next toast if available
    setQueue(q => {
      if (q.length > 0) {
        const [next, ...rest] = q;
        setToasts(prev => [next, ...prev]);
        return rest;
      }
      return q;
    });
  }, []);

  // Auto-dismiss logic
  useEffect(() => {
    toasts.forEach(toast => {
      if (toast.autoDismiss) {
        const timer = setTimeout(() => dismissToast(toast.id), toast.dismissDelay);
        return () => clearTimeout(timer);
      }
    });
  }, [toasts, dismissToast]);

  // Clean up history
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setHistory(prev => prev.filter(h => now - h.timestamp < DEDUP_WINDOW_MS * 2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      <Toast.Provider>
        {children}
        {toasts.map(toast => (
          <Toast.Root key={toast.id} className={`toast toast--${toast.type}`}>
            <Toast.Title>{toast.message}</Toast.Title>
            {toast.action && (
              <Toast.Action asChild altText={toast.action.label}>
                <button onClick={toast.action.onClick}>{toast.action.label}</button>
              </Toast.Action>
            )}
            <Toast.Close asChild>
              <button aria-label="Close"><X size={16} /></button>
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="toast-viewport" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
```

**Usage Example in SessionModal:**
```typescript
// frontend/src/components/SessionModal.tsx
import { useToast } from '@/components/ToastProvider';

function SessionModal() {
  const { showToast } = useToast();

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/sessions', { method: 'POST', body: JSON.stringify({ name }) });
      const { session } = await response.json();

      showToast({
        type: 'success',
        message: `Session created: ${session.name}`,
        autoDismiss: true,
        dismissDelay: 4000
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: `Failed to create session: ${error.message}`,
        autoDismiss: true,
        dismissDelay: 8000
      });
    }
  };
}
```

**WebSocket Reconnection Toast Example:**
```typescript
// frontend/src/hooks/useWebSocket.ts
import { useToast } from '@/components/ToastProvider';

function useWebSocket(url: string) {
  const { showToast, dismissToast } = useToast();
  const [disconnectToastId, setDisconnectToastId] = useState<string | null>(null);

  ws.onclose = () => {
    const id = showToast({
      type: 'warning',
      message: 'Connection lost. Reconnecting...',
      autoDismiss: false
    });
    setDisconnectToastId(id);
  };

  ws.onopen = () => {
    if (disconnectToastId) {
      dismissToast(disconnectToastId);
      setDisconnectToastId(null);
    }
    showToast({
      type: 'success',
      message: 'Connected to server',
      autoDismiss: true,
      dismissDelay: 4000
    });
  };
}
```

**Testing Considerations:**
- Mock setTimeout/clearTimeout with `jest.useFakeTimers()` for auto-dismiss tests
- Test toast stacking by adding 5 toasts, verify only 3 visible
- Test duplicate prevention by adding same message twice within 500ms
- Mock Radix UI Toast primitives if needed
- Use `@testing-library/react` for component tests
- Verify ARIA live region announcements (screen reader accessibility)

### Learnings from Previous Story

**From Story 4-3 (Browser Notifications When Claude Asks Questions)**

**Status**: drafted

**Integration Points for This Story:**
- **NotificationContext** already exists from Epic 3 Story 3.11
  - File: `frontend/src/context/NotificationContext.tsx`
  - Provides `permissionGranted` boolean for browser notifications
  - This story extends context ecosystem with **ToastProvider** (separate concern)
  - ToastProvider is independent from NotificationContext (different UI layer)

**Patterns to Follow:**
- **Context API pattern**: Create ToastProvider similar to NotificationProvider
- **useToast hook**: Export custom hook for consuming toast context (like useNotificationPermission)
- **Permission-less feedback**: Toasts don't require user permission (unlike browser notifications)
- **Accessibility**: Radix UI Toast handles ARIA live regions automatically

**Differences from Previous Story:**
- Story 4.3 focuses on **browser notifications** (system-level, requires permission, for background sessions)
- Story 4.4 focuses on **toast notifications** (in-app UI, no permission required, for active session feedback)
- Both stories use different notification layers:
  - Browser notifications: Desktop notifications outside app window
  - Toast notifications: In-app overlays within UI viewport

**No Files to Reuse from Story 4.3:**
- Story 4.3 is not yet implemented (status: drafted)
- ToastProvider is independent from NotificationContext
- Both providers will coexist in App.tsx provider stack

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - ToastNotification interface schema
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Workflows-and-Sequencing] - Toast notification lifecycle
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.10-AC4.14 toast requirements
- [Source: docs/architecture.md#ADR-005] - React Context API pattern for state management
- [Source: docs/architecture.md#Testing-Strategy] - Vitest testing patterns for frontend
- [Source: docs/sprint-artifacts/4-3-browser-notifications-when-claude-asks-questions.md#Dev-Notes] - NotificationContext structure (separate provider)

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-3 (NotificationContext pattern)
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
