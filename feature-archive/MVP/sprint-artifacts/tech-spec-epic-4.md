# Epic Technical Specification: Production Stability & Polish

Date: 2025-11-25
Author: Kyle
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 transforms Claude Container from a functional development tool into rock-solid production infrastructure suitable for daily use. Building upon the foundation (Epic 1), multi-session support (Epic 2), and workflow visibility (Epic 3), this epic focuses on the reliability, user feedback, and polish that make a tool feel professional and trustworthy.

The core value proposition is enabling developers to trust Claude Container as THE PRIMARY WORKFLOW—it never crashes unexpectedly, always recovers gracefully from failures, provides clear feedback on all operations, and supports accessibility for all developers. When complete, users will experience "getting more while doing less" with the confidence that comes from rock-solid infrastructure.

Key themes in this epic include: proactive status monitoring (idle detection, stuck warnings, attention badges), comprehensive notification systems (browser notifications, toast feedback), graceful error handling with actionable messages, WebSocket resilience under load, proper resource management, keyboard accessibility, and validated performance meeting all PRD NFRs.

## Objectives and Scope

### In-Scope

- **Session Status Tracking**: Backend tracks activity timestamps, detects idle (5+ min) and stuck (30+ min) sessions, identifies "waiting for input" states via PTY output heuristics
- **Attention Badges**: Visual badges on session tabs/list indicating error/stuck/waiting status with priority ordering (error > stuck > waiting > active)
- **Browser Notifications**: Send notifications when background sessions need input, with click-to-focus functionality (FR49)
- **Toast Notification System**: Success/error/warning/info toasts with auto-dismiss, stacking, and duplicate prevention (Oceanic Calm themed)
- **Enhanced Error Messages**: User-friendly error messages explaining what went wrong and how to fix it, with comprehensive backend logging (FR68)
- **WebSocket Backpressure**: Handle high-throughput terminal output without data loss or memory exhaustion
- **Graceful Shutdown**: Clean container shutdown sequence saving state and terminating processes (FR58)
- **Resource Monitoring**: Memory usage tracking, warning at 87%, blocking new sessions at 93%, zombie process cleanup (FR70, FR72)
- **Keyboard Shortcuts**: Complete shortcut system (Cmd+1-4, Cmd+N, Cmd+T/A/W, ESC) with visible focus rings (NFR-USE-2)
- **Accessibility**: WCAG AA compliance with ARIA labels, live regions, reduced motion support
- **Performance Validation**: Verify all NFRs (<100ms terminal latency, <50ms tab switch, <5s session creation)
- **Comprehensive Testing**: Unit (70%+ backend, 50%+ frontend), integration, and E2E test coverage
- **Documentation**: README with setup, usage, troubleshooting; architecture docs; contribution guide (NFR-MAINT-3)
- **Production Validation**: 1-week real-world usage across multiple projects

### Out-of-Scope

- Auto-resume sessions after container restart (manual resume only, per Epic 2 Story 2.10)
- Multi-user authentication or remote access
- Cloud deployment or Kubernetes orchestration
- Mobile responsive layout
- Voice control integration
- Custom color themes beyond Oceanic Calm
- Session lifecycle management (archive/cleanup)
- Per-session resource isolation

## System Architecture Alignment

This epic aligns with the architecture decisions established in `docs/architecture.md` and `docs/architecture-decisions.md`:

| Architecture Component | Epic 4 Implementation |
|------------------------|----------------------|
| **Error Handling Strategy** | Centralized error handlers with consistent user feedback patterns (Architecture "Error Handling" section) |
| **Logging Strategy (ADR)** | Winston structured JSON logging with error/warn/info/debug levels, session context |
| **WebSocket Protocol (ADR-013)** | New message types: `session.status`, `session.warning`, `session.needsInput`, `resource.warning`, `server.shutdown` |
| **Session State Model** | Session entity extended with `lastActivity` (ISO 8601), idle/stuck detection timers |
| **Graceful Shutdown (FR58)** | SIGTERM handler with 5s PTY timeout, atomic session save, 10s total shutdown window |
| **Resource Management** | Memory thresholds (7GB warning, 7.5GB critical), zombie process cleanup every 60s |
| **Accessibility (UX Spec 8.2)** | WCAG AA contrast, keyboard navigation, ARIA live regions, reduced motion support |
| **Performance (NFRs)** | <100ms terminal latency, <50ms tab switch, <5s session creation, 4 concurrent sessions |

**Constraints from Architecture:**
- All error messages must follow the pattern: "What happened" + "Why" + "How to fix" (Architecture "User-Facing Error Messages")
- Notifications only sent for background sessions (active session is already visible)
- Toast auto-dismiss timing: success 4s, error 8s, warning 6s, info 5s (UX spec 7.4)
- Keyboard shortcuts use platform-aware modifiers (Cmd on macOS, Ctrl on Windows/Linux)

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs |
|--------|---------------|--------|---------|
| `sessionManager.ts` (extended) | Track lastActivity, detect idle/stuck/waiting states | PTY output events, timers | Status change events, warning messages |
| `resourceMonitor.ts` (new) | Monitor memory usage, cleanup zombie processes | `process.memoryUsage()`, PTY process list | Resource warnings, cleanup actions |
| `shutdownManager.ts` (new) | Orchestrate graceful container shutdown | SIGTERM signal | Ordered shutdown sequence |
| `backpressureHandler.ts` (new) | Manage WebSocket buffer overflow | `ws.bufferedAmount` | PTY throttling, buffer management |
| `ToastProvider.tsx` (new) | Toast notification system with stacking | Toast events | Rendered toast UI |
| `AttentionBadge.tsx` (new) | Status badges with priority ordering | Session status | Badge icon/color/tooltip |
| `useNotifications.ts` (extended) | Send browser notifications | Session status changes | Browser Notification API calls |
| `useKeyboardShortcuts.ts` (new) | Global keyboard shortcut handler | Key events | Session switches, modal triggers, layout changes |
| `useAccessibility.ts` (new) | ARIA live region announcements | Status changes | Screen reader announcements |

### Data Models and Contracts

**Extended Session Entity (Backend)**
```typescript
interface Session {
  id: string;
  name: string;
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  branch: string;
  worktreePath: string;
  ptyPid?: number;
  createdAt: string;           // ISO 8601 UTC
  lastActivity: string;        // ISO 8601 UTC - updated on every PTY output
  currentPhase?: string;       // BMAD workflow phase (from Epic 3)
  metadata?: {
    epicName?: string;
    storyProgress?: { completed: number; total: number };
    stuckSince?: string;       // ISO 8601 - when stuck detection triggered
    lastWarning?: string;      // ISO 8601 - when last warning was sent
  };
}
```

**Resource State (Backend)**
```typescript
interface ResourceState {
  memoryUsedBytes: number;
  memoryLimitBytes: number;    // 8GB = 8 * 1024 * 1024 * 1024
  memoryUsagePercent: number;
  sessionCount: number;
  maxSessions: number;         // 4
  isAcceptingNewSessions: boolean;
  zombieProcessCount: number;
}
```

**Toast Notification (Frontend)**
```typescript
interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  autoDismiss: boolean;
  dismissDelay: number;        // ms: 4000, 8000, 6000, 5000
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: string;
}
```

**Attention Badge State (Frontend)**
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

**Keyboard Shortcut Registry (Frontend)**
```typescript
interface KeyboardShortcut {
  key: string;                 // 'n', '1', 't', etc.
  modifiers: ('meta' | 'ctrl' | 'alt' | 'shift')[];
  action: string;              // 'newSession', 'switchSession1', 'focusTerminal'
  description: string;         // 'Create new session'
  enabled: boolean;
}
```

### APIs and Interfaces

**New WebSocket Message Types (Server → Client)**

```typescript
// Session activity update (sent on status change)
{
  type: 'session.status',
  sessionId: string,
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped',
  lastActivity: string,        // ISO 8601
  isStuck: boolean
}

// Session warning (30+ min stuck)
{
  type: 'session.warning',
  sessionId: string,
  message: string,             // "No output for 30+ minutes"
  severity: 'warning' | 'error'
}

// Background session needs input
{
  type: 'session.needsInput',
  sessionId: string,
  message: string              // "Claude is asking a question"
}

// Resource warning
{
  type: 'resource.warning',
  message: string,             // "High memory usage"
  memoryUsagePercent: number,
  isAcceptingNewSessions: boolean
}

// Server shutdown notification
{
  type: 'server.shutdown',
  message: string,             // "Server shutting down"
  gracePeriodMs: number        // 5000
}
```

**Updated REST Error Responses**

```typescript
// All error responses follow this structure
interface ErrorResponse {
  error: {
    type: 'validation' | 'git' | 'pty' | 'resource' | 'internal';
    message: string;           // User-friendly message
    details?: string;          // Technical details
    suggestion?: string;       // How to fix
    code?: string;             // Machine-readable code (e.g., 'BRANCH_EXISTS')
  }
}

// Examples:
// 400 Bad Request - Validation error
{
  "error": {
    "type": "validation",
    "message": "Invalid session name",
    "details": "Session names must be alphanumeric with dashes only (max 50 characters).",
    "suggestion": "Example: 'feature-auth'"
  }
}

// 409 Conflict - Branch exists
{
  "error": {
    "type": "git",
    "message": "Branch already exists",
    "details": "A worktree already exists for branch 'feature/feature-auth'.",
    "suggestion": "Choose a different branch name or delete the existing worktree.",
    "code": "BRANCH_EXISTS"
  }
}

// 503 Service Unavailable - Resource exhaustion
{
  "error": {
    "type": "resource",
    "message": "Maximum resource capacity reached",
    "details": "Memory usage is at 93%. Cannot create new sessions.",
    "suggestion": "Close idle sessions before creating new ones."
  }
}
```

### Workflows and Sequencing

**Idle/Stuck Detection Flow**

```
1. PTY outputs data for session
   ↓
2. SessionManager updates session.lastActivity = now()
   ↓
3. StatusChecker runs every 60s:
   For each session:
   ├─ If lastActivity > 5 min ago AND status === 'active'
   │   └─ Set status = 'idle', notify frontend
   ├─ If lastActivity > 30 min ago AND status in ['active', 'idle']
   │   └─ Set metadata.stuckSince = now(), send session.warning
   └─ If PTY output ends with "?" and no output for 10s
       └─ Set status = 'waiting', send session.needsInput (if not active)
```

**Browser Notification Flow**

```
1. Session status changes to 'waiting' (detected question)
   ↓
2. Backend sends: { type: 'session.needsInput', sessionId, message }
   ↓
3. Frontend checks:
   ├─ Is this session currently active? → Skip notification
   └─ Is Notification.permission === 'granted'?
       ├─ No → Show badge only
       └─ Yes → new Notification('Session X needs input', { body, icon, tag: sessionId })
   ↓
4. User clicks notification
   ↓
5. notification.onclick:
   ├─ window.focus()
   ├─ switchSession(sessionId)
   └─ scrollTerminalToBottom()
```

**Graceful Shutdown Flow**

```
1. Container receives SIGTERM
   ↓
2. ShutdownManager.initiate():
   a) Log: "Received SIGTERM, shutting down gracefully..."
   b) Stop accepting new WebSocket connections
   c) Broadcast: { type: 'server.shutdown', gracePeriodMs: 5000 }
   ↓
3. For each active PTY process:
   a) Send SIGTERM
   b) Wait up to 5 seconds for exit
   c) If still running, send SIGKILL
   d) Log: "PTY for session X terminated (SIGTERM/SIGKILL)"
   ↓
4. Save final session state:
   a) Update all session statuses to 'stopped'
   b) Atomic write to .claude-container-sessions.json
   ↓
5. Cleanup:
   a) Close all WebSocket connections
   b) Stop Express server
   c) Exit process with code 0
   ↓
Total time: <10 seconds (Docker's SIGKILL timeout)
```

**WebSocket Backpressure Flow**

```
1. PTY outputs high-volume data (e.g., test runner)
   ↓
2. WebSocket send queues data
   ↓
3. Backpressure check (every 100ms):
   If ws.bufferedAmount > 1MB:
   ├─ Pause PTY reading (remove onData listener)
   ├─ Log warning: "WebSocket backpressure detected"
   └─ Set backpressureActive = true
   ↓
4. Buffer drain check:
   If ws.bufferedAmount < 100KB AND backpressureActive:
   ├─ Resume PTY reading (re-add onData listener)
   ├─ Log info: "WebSocket backpressure resolved"
   └─ Set backpressureActive = false
   ↓
5. Critical threshold (ws.bufferedAmount > 10MB for 10s):
   ├─ Log error: "WebSocket backpressure critical"
   └─ Drop oldest 50% of buffer (prevent OOM)
```

**Toast Notification Lifecycle**

```
1. Event occurs (session created, error, reconnection)
   ↓
2. ToastProvider.show({ type, message, ... })
   ↓
3. Check duplicate prevention:
   If same message exists within 1s → Skip
   ↓
4. Check stack limit:
   If toasts.length >= 3 → Queue for later
   ↓
5. Render toast with slide-in animation
   ↓
6. Start auto-dismiss timer (if autoDismiss: true)
   ↓
7. On dismiss (auto or manual):
   a) Slide-out animation
   b) Remove from stack
   c) Dequeue next toast if pending
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Validation | Story |
|-------------|--------|------------|-------|
| **NFR-PERF-1** | Terminal latency p99 <100ms | Measure PTY output → WebSocket → xterm render | 4.10 |
| **NFR-PERF-2** | Tab switch <50ms | Measure click → session displayed | 4.10 |
| **NFR-PERF-3** | Session creation <5s | Measure create click → terminal ready | 4.10 |
| **NFR-PERF-4** | 4 concurrent sessions, no degradation | Each session maintains <100ms latency | 4.10 |
| **Toast rendering** | <50ms from event to visible | CSS animation, no JS delays | 4.4 |
| **Keyboard shortcut response** | <20ms | Direct state update, no async | 4.9 |
| **Bundle size** | <500KB gzipped initial load | Code splitting for non-critical components | 4.10 |

**Implementation Notes:**
- Latency measurement uses `performance.now()` timestamps in backend and frontend
- Tab switch uses React concurrent rendering to avoid blocking
- Toast uses CSS `@keyframes` for animation (not JS timers)
- WorkflowDiagram and non-essential components lazy-loaded with `React.lazy()`

### Security

| Requirement | Implementation | Story |
|-------------|----------------|-------|
| **No sensitive data in logs** | Filter API keys, tokens, credentials from log output | 4.5 |
| **Path traversal prevention** | All file operations validate paths start with `/workspace/` | (Epic 3) |
| **XSS prevention** | react-markdown is safe by default; error messages sanitized | 4.5 |
| **Notification content** | No sensitive data in browser notifications (session name only, no terminal output) | 4.3 |
| **Graceful error exposure** | Error messages show user-friendly text, not stack traces | 4.5 |

### Reliability/Availability

| Requirement | Implementation | Story |
|-------------|----------------|-------|
| **NFR-REL-1** | 99%+ uptime during active use (no crashes in daily workflow) | 4.13 |
| **NFR-REL-2** | Automatic WebSocket reconnection within 5s | (Epic 1) |
| **NFR-REL-3** | Session state persists across container restarts | (Epic 2) |
| **NFR-REL-4** | Graceful degradation on component failures | 4.5, 4.7 |
| **Graceful shutdown** | Container shutdown completes <10s without data loss | 4.7 |
| **Zombie cleanup** | Crashed PTY processes cleaned up within 60s | 4.8 |
| **Backpressure handling** | High-volume output doesn't crash system | 4.6 |
| **Resource exhaustion prevention** | Memory limits enforced, new sessions blocked at 93% | 4.8 |

### Observability

| Signal | Purpose | Level | Story |
|--------|---------|-------|-------|
| `Session status changed` | Track idle/waiting/stuck transitions | info | 4.1 |
| `Session warning sent` | Track stuck session notifications | warn | 4.1 |
| `Browser notification sent` | Track user engagement | info | 4.3 |
| `WebSocket backpressure detected/resolved` | Performance debugging | warn/info | 4.6 |
| `Resource warning: high memory` | Capacity planning | warn | 4.8 |
| `Graceful shutdown initiated` | Container lifecycle | info | 4.7 |
| `PTY terminated (SIGTERM/SIGKILL)` | Shutdown debugging | info | 4.7 |
| `Zombie process cleaned` | Resource management | warn | 4.8 |
| `Error: [type] - [message]` | All errors with context | error | 4.5 |

**Log Format (Winston JSON):**
```json
{
  "level": "info",
  "message": "Session status changed",
  "sessionId": "abc123",
  "from": "active",
  "to": "waiting",
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

## Dependencies and Integrations

### NPM Dependencies (Backend - no new additions)

Epic 4 uses the existing backend dependencies from Epics 1-3. No new packages required.

| Package | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| `winston` | ^3.11.0 | Structured logging | ✓ (Epic 1) |
| `ws` | ^8.14.0 | WebSocket server | ✓ (Epic 1) |
| `node-pty` | ^1.0.0 | PTY process management | ✓ (Epic 1) |
| `uuid` | ^9.0.0 | ID generation | ✓ (Epic 1) |

### NPM Dependencies (Frontend - potential additions)

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@radix-ui/react-toast` | ^1.2.15 | Toast notifications | ✓ Already installed |
| `@radix-ui/react-tooltip` | ^1.2.8 | Badge tooltips | ✓ Already installed |
| `sonner` | ^1.x | Alternative toast library (optional) | Consider if Radix insufficient |

**Note:** The existing Radix UI Toast component should be sufficient for Story 4.4. If stacking behavior or animation needs prove complex, `sonner` is a lightweight alternative (~5KB gzipped).

### Integration Points

| System | Integration | Story |
|--------|-------------|-------|
| **Epic 1 Backend** | Extended sessionManager with lastActivity tracking | 4.1 |
| **Epic 1 WebSocket** | New message types (session.status, session.warning, etc.) | 4.1-4.3 |
| **Epic 2 Sessions** | Status field extended with 'waiting', 'idle' states | 4.1 |
| **Epic 2 Persistence** | Session JSON includes lastActivity, status fields | 4.7 |
| **Epic 3 NotificationBanner** | Permission check reused for browser notifications | 4.3 |
| **Epic 3 TopBar** | Enhanced with resource warning banner | 4.8 |
| **Epic 3 LayoutContext** | Extended for keyboard shortcut integration | 4.9 |
| **Browser Notification API** | `new Notification()` for background session alerts | 4.3 |
| **Docker** | SIGTERM handling, memory limits | 4.7, 4.8 |

### Browser APIs Used

| API | Purpose | Fallback |
|-----|---------|----------|
| `Notification` | Browser notifications for background sessions | Badge-only (no notification) |
| `navigator.permissions` | Query notification permission | Check `Notification.permission` |
| `performance.now()` | High-resolution timestamps for latency measurement | `Date.now()` |
| `window.matchMedia('(prefers-reduced-motion)')` | Detect reduced motion preference | Assume full motion |
| `localStorage` | Panel sizes, diff cache, layout preferences | In-memory fallback |

### External Service Dependencies

Epic 4 has no external service dependencies. All functionality runs locally within the Docker container.

## Acceptance Criteria (Authoritative)

| AC# | Criteria | Testable Condition |
|-----|----------|-------------------|
| AC4.1 | Backend tracks session lastActivity timestamp | PTY output updates lastActivity within 100ms |
| AC4.2 | Idle detection triggers at 5 minutes | Session status changes to 'idle' after 5 min no output |
| AC4.3 | Stuck warning triggers at 30 minutes | session.warning WebSocket sent after 30 min idle |
| AC4.4 | "Waiting" status detected from PTY output | Output ending with "?" triggers 'waiting' status |
| AC4.5 | Attention badges show correct priority | error > stuck > waiting > active ordering |
| AC4.6 | Badge tooltip shows detailed status | Hover reveals "Waiting for input - 2m ago" |
| AC4.7 | Browser notification sent for background sessions | Notification appears when inactive session needs input |
| AC4.8 | Notification click focuses correct session | Click → window.focus() + switchSession() |
| AC4.9 | No notification for active session | Active session question doesn't trigger notification |
| AC4.10 | Toast success shows green border | Session creation shows success toast with #A3BE8C |
| AC4.11 | Toast error shows red border and persists longer | Error toast uses #BF616A, 8s auto-dismiss |
| AC4.12 | Toast warning persists until resolved | WebSocket disconnect toast stays until reconnect |
| AC4.13 | Toasts stack vertically (max 3) | Multiple toasts queue, max 3 visible |
| AC4.14 | Duplicate toasts prevented | Same message within 1s ignored |
| AC4.15 | Error messages include suggestion | Validation errors show "Example: feature-auth" |
| AC4.16 | Backend logs include session context | All logs have sessionId, timestamp fields |
| AC4.17 | PTY crash logged with last 100 lines | Crash logs include recent terminal output |
| AC4.18 | WebSocket backpressure detected at 1MB | Log warning when bufferedAmount > 1MB |
| AC4.19 | PTY throttled during backpressure | PTY reading pauses when backpressure active |
| AC4.20 | Backpressure resolves at 100KB | PTY reading resumes when buffer drains |
| AC4.21 | Graceful shutdown completes in <10s | SIGTERM → clean exit within 10 seconds |
| AC4.22 | PTY processes receive SIGTERM first | SIGTERM sent, SIGKILL only after 5s timeout |
| AC4.23 | Session state saved on shutdown | .claude-container-sessions.json updated atomically |
| AC4.24 | Shutdown broadcast sent to clients | server.shutdown WebSocket message sent |
| AC4.25 | Memory warning at 87% | resource.warning sent when memory > 7GB |
| AC4.26 | New sessions blocked at 93% | Session creation returns 503 when memory > 7.5GB |
| AC4.27 | Zombie processes cleaned up | Orphaned PTY processes killed within 60s |
| AC4.28 | Cmd+1-4 switches sessions | Keyboard shortcut activates correct session |
| AC4.29 | Cmd+N opens new session modal | Shortcut works globally (except in terminal focus) |
| AC4.30 | Cmd+T/A/W changes layout | Terminal/Artifact/Sidebar toggle shortcuts work |
| AC4.31 | ESC closes modals | Escape key dismisses non-destructive modals |
| AC4.32 | Focus ring visible on all interactive elements | 2px #88C0D0 outline on :focus-visible |
| AC4.33 | Screen reader announces status changes | ARIA live region updates on session status |
| AC4.34 | Reduced motion preference respected | Animations disabled when prefers-reduced-motion |
| AC4.35 | Terminal latency p99 <100ms | Performance measurement confirms NFR-PERF-1 |
| AC4.36 | Tab switch <50ms | Performance measurement confirms NFR-PERF-2 |
| AC4.37 | Session creation <5s | Performance measurement confirms NFR-PERF-3 |
| AC4.38 | 4 concurrent sessions no degradation | All 4 maintain <100ms latency |
| AC4.39 | Bundle size <500KB gzipped | Build output analysis confirms |
| AC4.40 | Backend unit test coverage ≥70% | Jest coverage report |
| AC4.41 | Frontend unit test coverage ≥50% | Vitest coverage report |
| AC4.42 | E2E critical paths pass | Playwright tests for 5 key journeys |
| AC4.43 | README has Quick Start section | Documentation complete |
| AC4.44 | Troubleshooting section exists | Common issues documented |
| AC4.45 | 1 week daily use without crashes | Production validation complete |

## Traceability Mapping

| AC | PRD FR/NFR | Spec Section | Component(s) | Test Idea |
|----|------------|--------------|--------------|-----------|
| AC4.1-4.4 | FR34, FR35, FR36, FR51 | Data Models | sessionManager.ts | Unit: timestamp updates, status transitions |
| AC4.5-4.6 | FR50, FR52 | UI Components | AttentionBadge.tsx | Unit: priority calculation, tooltip content |
| AC4.7-4.9 | FR49 | Workflows | useNotifications.ts | Integration: status change → notification |
| AC4.10-4.14 | UX 7.4 | UI Components | ToastProvider.tsx | Unit: toast types, stacking, duplicates |
| AC4.15-4.17 | FR68 | APIs | Error handlers, logger | Unit: error format, log structure |
| AC4.18-4.20 | - | Workflows | backpressureHandler.ts | Integration: high-volume output handling |
| AC4.21-4.24 | FR58 | Workflows | shutdownManager.ts | Integration: SIGTERM → clean exit |
| AC4.25-4.27 | FR70, FR72, NFR-SCALE-2 | Services | resourceMonitor.ts | Unit: threshold detection, cleanup |
| AC4.28-4.31 | NFR-USE-2 | UI Components | useKeyboardShortcuts.ts | E2E: shortcut triggers correct action |
| AC4.32-4.34 | WCAG AA | UI Components | Global styles, useAccessibility.ts | Manual: focus ring, screen reader |
| AC4.35-4.38 | NFR-PERF-1 to 4 | Validation | Performance profiling | E2E: latency measurements |
| AC4.39 | - | Build | Vite config | Build: analyze bundle |
| AC4.40-4.42 | NFR-REL-1 | Test Strategy | Test suites | CI: coverage reports |
| AC4.43-4.44 | NFR-MAINT-3 | Documentation | README.md, docs/ | Review: documentation complete |
| AC4.45 | Success Criteria | Validation | All | Manual: 1 week usage diary |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Question detection heuristic fails** | "Waiting" status missed or false positives | Medium | Start conservative (ends with "?"), tune based on real usage; log detection events |
| **Browser notification permission denied** | Users miss background session alerts | Medium | Graceful degradation to badge-only; clear explanation why permission is useful |
| **WebSocket backpressure drops data** | Terminal output lost during high-volume scenarios | Low | Conservative thresholds, log when dropping, user can restart session |
| **Memory monitoring inaccurate** | Container OOM despite limits | Low | Use conservative 87%/93% thresholds; Docker memory limits as hard backstop |
| **Graceful shutdown timeout exceeded** | Docker SIGKILL leaves dirty state | Low | 5s PTY timeout + 5s buffer = 10s total (Docker default); atomic session save |
| **Keyboard shortcuts conflict with browser** | Browser intercepts Cmd+N, Cmd+W | Medium | Use less common modifiers; document conflicts; allow customization in future |
| **Toast notification fatigue** | Too many toasts annoy users | Medium | Duplicate prevention, max 3 visible, appropriate auto-dismiss timing |
| **Accessibility testing gaps** | WCAG compliance missed | Medium | Manual screen reader testing; use axe-core for automated checks |

### Assumptions

- Users have granted or will grant notification permissions (degradation acceptable otherwise)
- Docker container memory limits are set appropriately (8GB recommended)
- Browser supports Notification API (modern Chrome, Firefox, Safari, Edge)
- Users prefer keyboard shortcuts similar to VS Code/standard macOS patterns
- Winston logger performance is acceptable for structured logging volume
- 1 week production validation is sufficient to catch stability issues
- Test coverage targets (70% backend, 50% frontend) are achievable within epic scope

### Open Questions

| Question | Decision Owner | Status |
|----------|---------------|--------|
| Should stuck threshold (30 min) be configurable? | Kyle | Decided: Hardcoded for now, can add config later |
| Which keyboard shortcuts should be customizable? | Kyle | Decided: None initially; standard set only |
| Should toast library be custom or use `sonner`? | Kyle | TBD: Start with Radix Toast, evaluate during implementation |
| How to handle notification permission prompt timing? | Kyle | Decided: Epic 3 handles permission; Epic 4 just uses it |
| Should E2E tests run in CI or manual-only? | Kyle | TBD: Start manual, add CI if feasible |

## Test Strategy Summary

### Test Levels

| Level | Framework | Scope | Coverage Target |
|-------|-----------|-------|-----------------|
| **Unit (Backend)** | Jest | sessionManager status logic, resourceMonitor thresholds, shutdownManager sequence, error message formatting | 70%+ |
| **Unit (Frontend)** | Vitest | ToastProvider, AttentionBadge, useKeyboardShortcuts, useNotifications, useAccessibility | 50%+ |
| **Integration** | Jest/Vitest | WebSocket message flow for new types, graceful shutdown sequence, backpressure handling |
| **E2E** | Playwright | 5 critical paths (listed below) |
| **Performance** | Chrome DevTools, custom | Latency measurements, bundle analysis |
| **Accessibility** | axe-core, manual | WCAG AA compliance, screen reader testing |

### Critical Test Cases

**Backend Unit Tests:**
- sessionManager: lastActivity updates on PTY output
- sessionManager: status transitions (active → idle → stuck)
- sessionManager: "waiting" detection from PTY output patterns
- resourceMonitor: memory threshold detection (87%, 93%)
- resourceMonitor: zombie process detection and cleanup
- shutdownManager: SIGTERM → SIGKILL escalation
- shutdownManager: atomic session file save
- backpressureHandler: pause/resume PTY at thresholds
- Error handlers: correct error response format

**Frontend Unit Tests:**
- ToastProvider: type-specific styling (success green, error red)
- ToastProvider: auto-dismiss timing (4s, 8s, 6s, 5s)
- ToastProvider: max 3 visible, queue additional
- ToastProvider: duplicate prevention within 1s
- AttentionBadge: priority calculation (error > stuck > waiting)
- AttentionBadge: tooltip content formatting
- useKeyboardShortcuts: Cmd+1-4 session switching
- useKeyboardShortcuts: Cmd+N, Cmd+T, Cmd+A, Cmd+W, ESC
- useNotifications: notification only for background sessions
- useAccessibility: ARIA live region updates

**Integration Tests:**
- Full WebSocket flow: session.status, session.warning, session.needsInput
- Graceful shutdown: SIGTERM → broadcast → PTY termination → session save → exit
- Backpressure: high-volume PTY → throttle → drain → resume
- Browser notification: status change → notification → click → focus session

**E2E Tests (Playwright):**

1. **Session status lifecycle**: Create session → simulate idle (5 min) → verify badge change → simulate stuck (30 min) → verify warning banner
2. **Toast notification flow**: Create session → success toast → simulate error → error toast with longer dismiss
3. **Keyboard shortcuts**: Navigate with Cmd+1-4 → open modal with Cmd+N → close with ESC
4. **Browser notification** (if permissions): Background session question → notification appears → click focuses session
5. **Graceful container restart**: 3 sessions active → docker stop → docker start → sessions restore from JSON

### Performance Test Plan

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Terminal latency p99 | <100ms | `performance.now()` timestamps in backend (PTY data) and frontend (render complete) |
| Tab switch time | <50ms | `performance.now()` on click → render complete |
| Session creation time | <5s | `performance.now()` from create click to terminal ready |
| Bundle size | <500KB gzipped | `npm run build` output analysis, vite-bundle-visualizer |
| React render perf | No unnecessary re-renders | React DevTools Profiler during terminal streaming |

### Accessibility Testing

| Test Type | Tool | Criteria |
|-----------|------|----------|
| Automated | axe-core | Zero critical/serious violations |
| Manual | VoiceOver (macOS) | Status changes announced, navigation works |
| Visual | Manual inspection | Focus rings visible, contrast passes |
| Reduced motion | System preference toggle | Animations disabled |
