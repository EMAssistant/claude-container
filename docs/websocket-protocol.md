# WebSocket Protocol Documentation

**Version:** 1.0
**Last Updated:** 2025-11-25
**Tech Debt Item:** TD-3 (from Epic 2 Retrospective)

## Overview

Claude Container uses WebSocket for real-time bidirectional communication between the frontend React application and the Node.js backend. This document specifies all message types, state transitions, and error handling procedures.

## Connection Lifecycle

```
┌─────────────────┐
│   CONNECTING    │
└────────┬────────┘
         │ WebSocket opens
         ▼
┌─────────────────┐
│   CONNECTED     │◀──────────────────┐
└────────┬────────┘                   │
         │                            │
         ├───── heartbeat ────────────┤ (every 30s)
         │                            │
         │ network error              │ reconnect success
         ▼                            │
┌─────────────────┐                   │
│  DISCONNECTED   │───────────────────┘
└────────┬────────┘ exponential backoff
         │           (1s → 2s → 4s → ... → 30s max)
         │ max retries exceeded
         ▼
┌─────────────────┐
│     FAILED      │
└─────────────────┘
```

## Message Format

All messages are JSON-encoded with a required `type` field:

```typescript
interface BaseMessage {
  type: string;
  sessionId?: string;  // Optional, required for session-specific messages
}
```

### Type Naming Convention

Message types follow the pattern: `resource.action`

- **Resources:** `terminal`, `session`, `workflow`, `file`, `layout`
- **Actions:** `input`, `output`, `attach`, `detach`, `updated`, `changed`, etc.

---

## Client → Server Messages

### `terminal.input`

Sends terminal input data to the PTY process.

```typescript
{
  type: 'terminal.input',
  sessionId: string,  // Target session UUID
  data: string        // Raw input data (keystrokes, paste content)
}
```

**When sent:** User types in the terminal, pastes content, or sends special keys.

**Server response:** None (output flows via `terminal.output`)

---

### `terminal.interrupt`

Sends SIGINT (Ctrl+C) to interrupt the running process.

```typescript
{
  type: 'terminal.interrupt',
  sessionId: string  // Target session UUID
}
```

**When sent:** User presses Ctrl+C, ESC key, or clicks STOP button.

**Server response:** PTY process receives SIGINT. Output may include `^C` echo.

---

### `session.attach`

Subscribes the WebSocket connection to a session's output stream.

```typescript
{
  type: 'session.attach',
  sessionId: string  // Session UUID to attach to
}
```

**When sent:** User switches to a session tab or opens a session.

**Server response:** `session.attached` confirmation, then `terminal.output` stream begins.

---

### `session.detach`

Unsubscribes the WebSocket connection from a session's output stream.

```typescript
{
  type: 'session.detach',
  sessionId: string  // Session UUID to detach from
}
```

**When sent:** User switches away from a session tab.

**Server response:** Stops streaming `terminal.output` for that session.

---

### `session.resume`

Resumes an idle session after container restart.

```typescript
{
  type: 'session.resume',
  sessionId: string  // Session UUID to resume
}
```

**When sent:** User clicks "Resume" button on an idle session.

**Server response:** `session.status` with status `active`, then PTY process restarts.

---

### `heartbeat`

Keeps the connection alive and measures latency.

```typescript
{
  type: 'heartbeat',
  timestamp: number  // Unix timestamp (ms)
}
```

**When sent:** Every 30 seconds by both client and server.

**Server response:** Echoes back with server timestamp.

---

## Server → Client Messages

### `terminal.output`

Streams terminal output from the PTY process.

```typescript
{
  type: 'terminal.output',
  sessionId: string,  // Source session UUID
  data: string        // Raw output data (may contain ANSI escape codes)
}
```

**When sent:** PTY process produces output. Batched every 16ms to reduce overhead.

---

### `session.attached`

Confirms successful attachment to a session.

```typescript
{
  type: 'session.attached',
  sessionId: string  // Session UUID
}
```

**When sent:** After processing `session.attach` request.

---

### `session.status`

Notifies of session status changes.

```typescript
{
  type: 'session.status',
  sessionId: string,
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped',
  reason?: string  // Optional explanation for status change
}
```

**Status meanings:**
- `active`: PTY process running, ready for input
- `waiting`: Waiting for Claude response (user input needed)
- `idle`: Session metadata exists but no PTY process (after container restart)
- `error`: PTY process crashed or failed
- `stopped`: Session explicitly stopped by user

---

### `terminal.exit`

Notifies when PTY process terminates.

```typescript
{
  type: 'terminal.exit',
  sessionId: string,
  exitCode: number,   // Process exit code (0 = success)
  signal?: number     // Signal number if killed (e.g., 9 for SIGKILL)
}
```

**When sent:** PTY process exits (normally, crash, or killed).

---

### `session.destroyed`

Confirms session destruction.

```typescript
{
  type: 'session.destroyed',
  sessionId: string
}
```

**When sent:** After session is fully cleaned up (PTY terminated, optional worktree deleted).

---

### `workflow.updated`

Notifies of BMAD workflow state changes.

```typescript
{
  type: 'workflow.updated',
  sessionId: string,
  workflow: {
    currentStep: string,      // e.g., "prd_creation"
    completedSteps: string[], // e.g., ["brainstorming", "product_brief"]
    steps: Array<{
      name: string,
      status: 'completed' | 'in_progress' | 'pending',
      displayName?: string
    }>
  }
}
```

**When sent:** Chokidar detects changes to `.bmad/bmm/status/*.yaml` files.

**Debounce:** 500ms to batch rapid workflow updates.

---

### `file.changed`

Notifies of file system changes in the workspace.

```typescript
{
  type: 'file.changed',
  path: string,                    // Absolute file path
  event: 'add' | 'change' | 'unlink',
  timestamp: string                // ISO 8601 timestamp
}
```

**When sent:** Chokidar detects file creation, modification, or deletion.

**Ignored patterns:** `node_modules`, `.git`, `.worktrees`

**Debounce:** 500ms to batch rapid file writes.

---

### `layout.shift`

Suggests layout mode change based on context.

```typescript
{
  type: 'layout.shift',
  mode: 'terminal' | 'artifact' | 'split',
  trigger: 'file_write' | 'user_input'
}
```

**When sent:** Backend detects markdown file writes in `/docs/` directory.

**Client behavior:** Auto-shift is optional; user can override with Cmd+T/Cmd+A.

---

### `heartbeat`

Server heartbeat response.

```typescript
{
  type: 'heartbeat',
  timestamp: number  // Server Unix timestamp (ms)
}
```

---

### `error`

Reports errors processing client messages.

```typescript
{
  type: 'error',
  message: string,    // Human-readable error message
  code?: string,      // Error code (e.g., 'SESSION_NOT_FOUND')
  sessionId?: string  // Related session, if applicable
}
```

**Error codes:**
- `SESSION_NOT_FOUND`: Session ID does not exist
- `SESSION_LIMIT_REACHED`: Maximum 4 sessions already exist
- `PTY_SPAWN_FAILED`: Failed to create PTY process
- `PERMISSION_DENIED`: Operation not allowed
- `INVALID_MESSAGE`: Malformed message format

---

## Session State Machine

```
┌──────────┐
│ (create) │
└────┬─────┘
     │ POST /api/sessions
     ▼
┌──────────┐  session.status   ┌──────────┐
│  active  │◀─────────────────▶│ waiting  │
└────┬─────┘                   └──────────┘
     │                              │
     │ PTY crash                    │ Claude asks question
     ▼                              │
┌──────────┐                        │
│  error   │                        │
└────┬─────┘                        │
     │ restart                      │
     └──────────────────────────────┘
            │
            │ container restart
            ▼
       ┌──────────┐
       │   idle   │
       └────┬─────┘
            │ session.resume
            ▼
       ┌──────────┐
       │  active  │
       └────┬─────┘
            │ DELETE /api/sessions/:id
            ▼
       ┌──────────┐
       │ stopped  │ → session.destroyed
       └──────────┘
```

---

## Reconnection Protocol

When WebSocket disconnects:

1. **Immediate:** Show "Reconnecting..." banner
2. **Backoff:** Retry with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
3. **Buffer:** Queue up to 1MB of output during disconnect
4. **Re-attach:** After reconnect, re-send `session.attach` for active sessions
5. **Timeout:** After 5 minutes of failed reconnects, show "Connection failed" state

---

## Performance Requirements

| Metric | Target | Notes |
|--------|--------|-------|
| Message latency | <100ms | From send to receive |
| Terminal output batching | 16ms | Batches output chunks |
| File change notification | <200ms | End-to-end from write to UI update |
| Heartbeat interval | 30s | Both directions |
| Reconnect backoff max | 30s | Exponential with jitter |
| Disconnect buffer | 1MB | Prevents data loss |

---

## Security Considerations

1. **No sensitive data in messages:** Session IDs are UUIDs, not secrets
2. **Input validation:** All message types are validated server-side
3. **Rate limiting:** Implicit via PTY process rate
4. **Origin checking:** WebSocket only accepts connections from same origin
5. **No authentication in protocol:** Relies on container isolation

---

---

## Epic 4 Message Types (Production Stability & Polish)

### `session.warning`

Notifies when a session has been stuck (no output) for 30+ minutes.

```typescript
{
  type: 'session.warning',
  sessionId: string,
  message: string,             // "No output for 30+ minutes"
  severity: 'warning' | 'error'
}
```

**When sent:** Backend status checker detects session idle for >30 minutes.

**Example payload:**
```json
{
  "type": "session.warning",
  "sessionId": "abc123-def456",
  "message": "No output for 30+ minutes. Session may be stuck.",
  "severity": "warning"
}
```

---

### `session.needsInput`

Notifies when a background session needs user input (Claude asking a question).

```typescript
{
  type: 'session.needsInput',
  sessionId: string,
  message: string              // "Claude is asking a question"
}
```

**When sent:** Backend detects PTY output ending with "?" pattern (heuristic for questions).

**Client behavior:** If session is not active (background), send browser notification (if permission granted).

**Example payload:**
```json
{
  "type": "session.needsInput",
  "sessionId": "abc123-def456",
  "message": "Claude is asking a question in session 'feature-auth'"
}
```

---

### `resource.warning`

Notifies when container memory usage exceeds thresholds.

```typescript
{
  type: 'resource.warning',
  message: string,                  // "High memory usage: 87%"
  memoryUsagePercent: number,
  isAcceptingNewSessions: boolean   // false if >93%
}
```

**When sent:**
- Memory usage >87%: Warning (still accepting new sessions)
- Memory usage >93%: Critical (blocking new sessions)

**Client behavior:** Show resource warning banner at top of UI.

**Example payload (warning):**
```json
{
  "type": "resource.warning",
  "message": "High memory usage: 87%. Consider closing idle sessions.",
  "memoryUsagePercent": 87.3,
  "isAcceptingNewSessions": true
}
```

**Example payload (critical):**
```json
{
  "type": "resource.warning",
  "message": "Memory critical: 93%. New sessions blocked.",
  "memoryUsagePercent": 93.1,
  "isAcceptingNewSessions": false
}
```

---

### `server.shutdown`

Notifies clients that container is shutting down gracefully.

```typescript
{
  type: 'server.shutdown',
  message: string,              // "Server shutting down in 5 seconds"
  gracePeriodMs: number         // 5000
}
```

**When sent:** Container receives SIGTERM signal (e.g., `docker stop`).

**Client behavior:** Show shutdown banner, disable all actions, auto-reconnect after shutdown completes.

**Example payload:**
```json
{
  "type": "server.shutdown",
  "message": "Server shutting down in 5 seconds. Sessions will be saved.",
  "gracePeriodMs": 5000
}
```

---

## Updated Session Status Values

**Epic 4 adds extended session status tracking:**

```typescript
type SessionStatus = 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
```

**Status meanings:**
- `active` - PTY running, producing output (last activity <5 min ago)
- `waiting` - Claude waiting for user input (detected via "?" pattern)
- `idle` - No output for 5-30 minutes (session alive but inactive)
- `error` - PTY crashed or failed (requires manual intervention)
- `stopped` - Session explicitly stopped by user or shutdown

**Status transitions:**

```
active → idle (5 min no output)
active → waiting (Claude asks question)
active → error (PTY crash)
idle → active (new output received)
waiting → active (user provides input)
error → stopped (session destroyed)
any → stopped (user destroys session or container shutdown)
```

---

## Updated Connection Lifecycle (Epic 4)

```
┌─────────────────┐
│   CONNECTING    │
└────────┬────────┘
         │ WebSocket opens
         ▼
┌─────────────────┐
│   CONNECTED     │◀──────────────────┐
└────────┬────────┘                   │
         │                            │
         ├───── heartbeat ────────────┤ (every 30s)
         │                            │
         │ network error or           │ reconnect success
         │ server.shutdown received   │ (after shutdown completes)
         ▼                            │
┌─────────────────┐                   │
│  DISCONNECTED   │───────────────────┘
└────────┬────────┘ exponential backoff
         │           (1s → 2s → 4s → ... → 30s max)
         │ max retries exceeded (5 min)
         ▼
┌─────────────────┐
│     FAILED      │
└─────────────────┘
```

**Epic 4 changes:**
- `server.shutdown` message triggers graceful disconnect
- Client waits for shutdown to complete before reconnecting
- Reconnect delay includes jitter to avoid thundering herd

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-25 | Initial documentation covering Epic 1-3 message types |
| 1.1 | 2025-11-26 | Added Epic 4 message types: session.warning, session.needsInput, resource.warning, server.shutdown. Updated session status values and connection lifecycle. |
