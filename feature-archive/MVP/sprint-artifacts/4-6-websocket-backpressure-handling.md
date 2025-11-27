# Story 4.6: WebSocket Backpressure Handling

Status: drafted

## Story

As a developer using Claude Container,
I want WebSocket connections to handle high-volume terminal output without data loss or memory exhaustion,
so that I can run commands producing large outputs (test suites, build logs, file dumps) without crashes or missing terminal data.

## Acceptance Criteria

1. **AC4.18**: WebSocket backpressure detected at 1MB
   - Given: PTY outputs high-volume data (e.g., test runner, npm build)
   - When: WebSocket `bufferedAmount` exceeds 1MB
   - Then: Log warning: "WebSocket backpressure detected"
   - And: Set `backpressureActive = true` flag
   - And: Backend pauses PTY reading to prevent further buffering

2. **AC4.19**: PTY throttled during backpressure
   - Given: Backpressure is active (`bufferedAmount` > 1MB)
   - When: PTY attempts to send more data
   - Then: PTY `onData` listener is temporarily removed/paused
   - And: No new data is queued to WebSocket
   - And: Existing buffer continues draining to client
   - And: Backend logs throttling event with sessionId

3. **AC4.20**: Backpressure resolves at 100KB
   - Given: Backpressure was active
   - When: WebSocket `bufferedAmount` drops below 100KB (threshold cleared)
   - Then: PTY `onData` listener is restored/resumed
   - And: Log info: "WebSocket backpressure resolved"
   - And: Set `backpressureActive = false`
   - And: Terminal output resumes streaming

4. **Critical threshold protection**: Prevent memory exhaustion
   - Given: Backpressure persists for 10+ seconds with `bufferedAmount` > 10MB
   - When: Critical threshold check runs
   - Then: Log error: "WebSocket backpressure critical"
   - And: Drop oldest 50% of buffer (emergency measure)
   - And: Log: "Dropped buffer data to prevent OOM"
   - And: Continue streaming (data loss acceptable to prevent crash)

5. **Backpressure monitoring loop**: Continuous buffer checks
   - Given: WebSocket connection is active
   - When: Monitoring loop runs (every 100ms)
   - Then: Check `ws.bufferedAmount` for each active session
   - And: Trigger pause at 1MB threshold
   - And: Trigger resume at 100KB threshold
   - And: Trigger critical protection at 10MB for 10s
   - And: Loop continues until WebSocket disconnected

6. **Per-session isolation**: Backpressure per WebSocket
   - Given: Multiple sessions active with separate WebSocket connections
   - When: One session experiences backpressure
   - Then: Only that session's PTY is throttled
   - And: Other sessions continue streaming normally
   - And: Backpressure state tracked per sessionId

7. **Graceful degradation messaging**: User notification optional
   - Given: Critical backpressure triggers buffer drop
   - When: Data loss occurs
   - Then: (Optional) Send WebSocket message: `{ type: 'terminal.warning', message: 'High output volume - some data may be skipped' }`
   - And: User sees terminal output continue (with gap)
   - And: Backend logs full details for debugging

8. **Backend unit tests**: Backpressure logic tested
   - Test: `bufferedAmount` > 1MB triggers pause
   - Test: `bufferedAmount` < 100KB triggers resume
   - Test: Critical threshold drops 50% of buffer
   - Test: Per-session isolation (multiple WebSockets)
   - Coverage: ≥70% for backpressureHandler module

9. **Integration test**: High-volume PTY output
   - Test: Create session, simulate `cat large-file.txt` (10MB+)
   - Verify: Backpressure detected and logged
   - Verify: PTY paused when threshold exceeded
   - Verify: PTY resumed when buffer drained
   - Verify: No process crashes or memory leaks

10. **Performance validation**: No latency impact when under threshold
    - Given: Normal terminal usage (<1MB buffered)
    - When: PTY outputs data
    - Then: Terminal latency remains <100ms p99
    - And: Backpressure monitoring adds <5ms overhead
    - And: No unnecessary throttling occurs

## Tasks / Subtasks

- [ ] Task 1: Create backpressureHandler module (AC: #1, #2, #3, #4, #5)
  - [ ] Create `backend/src/backpressureHandler.ts`
  - [ ] Implement `BackpressureMonitor` class:
    - Constructor accepts sessionManager reference
    - Track backpressure state per sessionId (`Map<string, BackpressureState>`)
    - `BackpressureState` includes: active (boolean), bufferedAmount (number), lastCheck (timestamp)
  - [ ] Implement `startMonitoring(sessionId, ws, pty)` method:
    - Start 100ms interval loop checking `ws.bufferedAmount`
    - Pause PTY at 1MB threshold (remove `onData` listener)
    - Resume PTY at 100KB threshold (re-add `onData` listener)
    - Log warnings/info at state transitions
  - [ ] Implement `checkCriticalThreshold(sessionId, ws)` method:
    - Detect `bufferedAmount` > 10MB persisting for 10s
    - Drop oldest 50% of buffer (emergency measure)
    - Log error with sessionId and buffer size
  - [ ] Implement `stopMonitoring(sessionId)` method:
    - Clear interval for session
    - Remove backpressure state entry
  - [ ] Export singleton `backpressureMonitor` instance

- [ ] Task 2: Integrate backpressure monitoring into WebSocket handlers (AC: #6)
  - [ ] Update `backend/src/server.ts` WebSocket connection handler:
    - Import `backpressureMonitor` from `backpressureHandler`
    - On session attach (session.attach message):
      - Call `backpressureMonitor.startMonitoring(sessionId, ws, pty)`
    - On session detach or WebSocket close:
      - Call `backpressureMonitor.stopMonitoring(sessionId)`
  - [ ] Ensure per-session isolation (each WebSocket tracked separately)
  - [ ] Test with multiple concurrent sessions

- [ ] Task 3: Implement PTY pause/resume mechanism (AC: #2, #3)
  - [ ] Update `backend/src/sessionManager.ts` or PTY wrapper:
    - Add `pausePTY(sessionId)` method:
      - Store current `onData` listener reference
      - Remove listener from PTY instance
      - Log: "PTY paused for session {{sessionId}}"
    - Add `resumePTY(sessionId)` method:
      - Restore original `onData` listener
      - Log: "PTY resumed for session {{sessionId}}"
  - [ ] Call pause/resume from `backpressureHandler` when thresholds crossed
  - [ ] Verify PTY continues running (only output buffering is paused)

- [ ] Task 4: Add buffer drop logic for critical threshold (AC: #4)
  - [ ] Implement emergency buffer drop in `backpressureHandler`:
    - Track when `bufferedAmount` > 10MB first detected
    - If persists for 10 seconds:
      - Calculate 50% of current buffer (cannot directly drop from ws.bufferedAmount, but stop accepting new data)
      - Alternative: Close and reconnect WebSocket (forces buffer flush)
      - Log error: "WebSocket backpressure critical - data loss may occur"
  - [ ] Note: WebSocket API doesn't allow direct buffer manipulation
    - Strategy: Pause PTY permanently until buffer drains below 10MB
    - Or: Send WebSocket close frame and force reconnect (drastic)
  - [ ] Choose conservative approach: Log critical warning, pause PTY, wait for drain

- [ ] Task 5: Add Winston logging for backpressure events (AC: #1, #2, #3, #4)
  - [ ] Use existing Winston logger from Story 4.5 (`backend/src/utils/logger.ts`)
  - [ ] Log events with sessionId context:
    - Backpressure detected (warn level)
    - Backpressure resolved (info level)
    - Critical threshold (error level)
    - PTY paused/resumed (info level)
  - [ ] Include buffer size in log metadata
  - [ ] Format example:
    ```json
    {
      "level": "warn",
      "message": "WebSocket backpressure detected",
      "sessionId": "abc123",
      "bufferedAmount": 1048576,
      "timestamp": "2025-11-25T10:30:00.000Z"
    }
    ```

- [ ] Task 6: Write comprehensive unit tests (AC: #8)
  - [ ] Create `backend/src/backpressureHandler.test.ts`
  - [ ] Test cases:
    - Mock WebSocket with controllable `bufferedAmount`
    - Mock PTY with `onData` listener tracking
    - Test pause triggered at 1MB threshold
    - Test resume triggered at 100KB threshold
    - Test critical threshold detection (10MB for 10s)
    - Test per-session isolation (multiple sessions, only one throttled)
    - Test cleanup on session destroy
  - [ ] Verify ≥70% coverage for `backpressureHandler.ts`

- [ ] Task 7: Write integration test for high-volume output (AC: #9)
  - [ ] Create `backend/src/__tests__/backpressure.integration.test.ts`
  - [ ] Test scenario:
    - Create session
    - Simulate PTY outputting 10MB+ data rapidly (mock `onData` events)
    - Mock WebSocket `bufferedAmount` increasing
    - Verify backpressure detected and PTY paused
    - Simulate buffer draining (decrease `bufferedAmount`)
    - Verify PTY resumed
  - [ ] Mock timer functions for 100ms interval and 10s critical check
  - [ ] Verify no memory leaks (backpressure state cleaned up)

- [ ] Task 8: Performance validation (AC: #10)
  - [ ] Test backpressure monitoring overhead:
    - Measure time for one backpressure check loop (should be <5ms)
    - Verify no impact on terminal latency when buffer under threshold
  - [ ] Run performance test from Story 4.10 (if available) to verify <100ms latency maintained
  - [ ] Document findings in story completion notes

- [ ] Task 9: Optional frontend notification (AC: #7)
  - [ ] (Optional) Add WebSocket message type `terminal.warning`:
    - Sent when critical threshold triggers
    - Frontend displays banner: "High output volume - some data may be missing"
  - [ ] If implemented, update `frontend/src/types.ts` and `useWebSocket.ts`
  - [ ] If skipped, note as future enhancement

- [ ] Task 10: Update documentation (AC: all)
  - [ ] Update `docs/websocket-protocol.md` with backpressure behavior
  - [ ] Add troubleshooting section in README:
    - "If terminal output freezes during large operations, check backend logs for backpressure warnings"
    - "Backpressure is normal for high-volume commands (test suites, large file outputs)"
  - [ ] Document thresholds (1MB pause, 100KB resume, 10MB critical)

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**WebSocket Backpressure Flow (Workflows Section)**:
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

**BackpressureHandler Module (Services and Modules)**:
```typescript
// Module: backpressureHandler.ts (new)
// Responsibility: Manage WebSocket buffer overflow
// Inputs: ws.bufferedAmount
// Outputs: PTY throttling, buffer management
```

**Thresholds**:
- **Pause threshold**: 1MB (`bufferedAmount` > 1,048,576 bytes)
- **Resume threshold**: 100KB (`bufferedAmount` < 102,400 bytes)
- **Critical threshold**: 10MB persisting for 10 seconds
- **Monitoring interval**: 100ms

**Logging (Observability Section)**:
```json
// Example log entry
{
  "level": "warn",
  "message": "WebSocket backpressure detected",
  "sessionId": "abc123",
  "bufferedAmount": 1048576,
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

**From Architecture (docs/architecture.md)**:

**WebSocket Protocol (ADR-013 extension)**:
- New monitoring loop per session (100ms interval)
- PTY pause/resume mechanism required
- Per-session backpressure isolation (no cross-contamination)

**Error Handling Strategy**:
- Critical threshold is emergency measure (data loss acceptable to prevent crash)
- Log all state transitions for debugging
- Graceful degradation preferred over hard failures

### Project Structure Notes

**Files to Create:**
```
backend/src/
├── backpressureHandler.ts              # BackpressureMonitor class, singleton
└── __tests__/
    ├── backpressureHandler.test.ts     # Unit tests
    └── backpressure.integration.test.ts # Integration test
```

**Files to Modify:**
```
backend/src/
├── server.ts                            # WebSocket handler integration (attach/detach)
├── sessionManager.ts                    # Add pausePTY/resumePTY methods
└── types.ts                             # BackpressureState interface

docs/
└── websocket-protocol.md                # Document backpressure behavior
```

**New Dependencies:**
None - uses existing WebSocket (`ws` package) and node-pty

### Implementation Guidance

**BackpressureHandler Pattern**:
```typescript
// backend/src/backpressureHandler.ts
import { logger } from './utils/logger';
import type { WebSocket } from 'ws';
import type { IPty } from 'node-pty';

interface BackpressureState {
  active: boolean;
  bufferedAmount: number;
  lastCheck: number;
  criticalSince?: number;  // Timestamp when 10MB first exceeded
}

class BackpressureMonitor {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private states: Map<string, BackpressureState> = new Map();
  private ptyRefs: Map<string, { pty: IPty; originalListener?: any }> = new Map();

  private readonly PAUSE_THRESHOLD = 1024 * 1024;      // 1MB
  private readonly RESUME_THRESHOLD = 100 * 1024;      // 100KB
  private readonly CRITICAL_THRESHOLD = 10 * 1024 * 1024; // 10MB
  private readonly CRITICAL_DURATION = 10000;          // 10 seconds
  private readonly CHECK_INTERVAL = 100;               // 100ms

  startMonitoring(sessionId: string, ws: WebSocket, pty: IPty): void {
    if (this.intervals.has(sessionId)) {
      logger.warn('Backpressure monitoring already active', { sessionId });
      return;
    }

    this.states.set(sessionId, {
      active: false,
      bufferedAmount: 0,
      lastCheck: Date.now()
    });

    this.ptyRefs.set(sessionId, { pty });

    const interval = setInterval(() => {
      this.checkBackpressure(sessionId, ws);
    }, this.CHECK_INTERVAL);

    this.intervals.set(sessionId, interval);
    logger.info('Backpressure monitoring started', { sessionId });
  }

  private checkBackpressure(sessionId: string, ws: WebSocket): void {
    const state = this.states.get(sessionId);
    if (!state) return;

    const bufferedAmount = ws.bufferedAmount;
    state.bufferedAmount = bufferedAmount;
    state.lastCheck = Date.now();

    // Check critical threshold
    if (bufferedAmount > this.CRITICAL_THRESHOLD) {
      if (!state.criticalSince) {
        state.criticalSince = Date.now();
      } else if (Date.now() - state.criticalSince > this.CRITICAL_DURATION) {
        logger.error('WebSocket backpressure critical', {
          sessionId,
          bufferedAmount,
          duration: Date.now() - state.criticalSince
        });
        // Cannot directly drop buffer - WebSocket API limitation
        // Keep PTY paused until buffer drains
      }
    } else {
      state.criticalSince = undefined;
    }

    // Pause at 1MB
    if (!state.active && bufferedAmount > this.PAUSE_THRESHOLD) {
      this.pausePTY(sessionId);
      state.active = true;
      logger.warn('WebSocket backpressure detected', { sessionId, bufferedAmount });
    }

    // Resume at 100KB
    if (state.active && bufferedAmount < this.RESUME_THRESHOLD) {
      this.resumePTY(sessionId);
      state.active = false;
      logger.info('WebSocket backpressure resolved', { sessionId, bufferedAmount });
    }
  }

  private pausePTY(sessionId: string): void {
    const ref = this.ptyRefs.get(sessionId);
    if (!ref) return;

    // Store current listener and remove it
    // Note: node-pty IPty interface uses 'onData' method, not EventEmitter pattern
    // This is a conceptual example - actual implementation depends on sessionManager design
    // May need to call sessionManager.pausePTY(sessionId) instead
    logger.info('PTY paused', { sessionId });
  }

  private resumePTY(sessionId: string): void {
    const ref = this.ptyRefs.get(sessionId);
    if (!ref) return;

    // Restore original listener
    logger.info('PTY resumed', { sessionId });
  }

  stopMonitoring(sessionId: string): void {
    const interval = this.intervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionId);
    }

    this.states.delete(sessionId);
    this.ptyRefs.delete(sessionId);
    logger.info('Backpressure monitoring stopped', { sessionId });
  }
}

export const backpressureMonitor = new BackpressureMonitor();
```

**Integration into WebSocket Handler**:
```typescript
// backend/src/server.ts
import { backpressureMonitor } from './backpressureHandler';

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (data: string) => {
    const message = JSON.parse(data);

    if (message.type === 'session.attach') {
      const { sessionId } = message;
      const session = sessionManager.getSession(sessionId);
      const pty = session.pty; // Assuming PTY is accessible

      // Start backpressure monitoring
      backpressureMonitor.startMonitoring(sessionId, ws, pty);

      // ... existing attach logic
    }

    if (message.type === 'session.detach') {
      const { sessionId } = message;
      backpressureMonitor.stopMonitoring(sessionId);
      // ... existing detach logic
    }
  });

  ws.on('close', () => {
    // Stop monitoring for all sessions on this WebSocket
    // (May need to track sessionId per WebSocket)
    backpressureMonitor.stopMonitoring(currentSessionId);
  });
});
```

**SessionManager PTY Pause/Resume**:
```typescript
// backend/src/sessionManager.ts
class SessionManager {
  private ptyListeners: Map<string, (data: string) => void> = new Map();

  pausePTY(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return;

    // Remove onData listener (implementation depends on how PTY is wired)
    const listener = this.ptyListeners.get(sessionId);
    if (listener) {
      session.pty.off('data', listener); // Conceptual - actual API may differ
    }
  }

  resumePTY(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return;

    // Restore onData listener
    const listener = this.ptyListeners.get(sessionId);
    if (listener) {
      session.pty.on('data', listener); // Conceptual
    }
  }
}
```

**Testing Considerations:**
- Mock `ws.bufferedAmount` with controllable getter
- Mock `setInterval`/`clearInterval` with Jest fake timers
- Test state transitions: idle → paused → resumed
- Test critical threshold detection (10s persistence)
- Verify per-session isolation (multiple WebSockets)
- Integration test with actual PTY output (use small data to simulate high volume)

**Performance Notes:**
- 100ms check interval adds minimal overhead (~10 iterations/second)
- State map lookups are O(1)
- No blocking operations in monitoring loop
- Monitoring stops when WebSocket closes (no memory leaks)

### Learnings from Previous Story

**From Story 4-5-enhanced-error-messages-and-logging (Status: drafted)**

**Integration Points for This Story:**
- **Winston Logger** will be used for all backpressure logging
  - File: `backend/src/utils/logger.ts` (created in Story 4.5)
  - This story uses Winston JSON format with sessionId context
  - Log levels: `warn` (backpressure detected), `info` (resolved), `error` (critical)

**Patterns to Follow:**
- **Structured logging**: All log entries include sessionId, timestamp, and metadata (bufferedAmount)
- **Log levels**: Use `warn` for backpressure detection, `info` for resolution, `error` for critical threshold
- **Session context**: Include sessionId in all log entries for debugging
- **Error handling**: Follow ErrorResponse pattern if exposing backpressure status via API

**Dependencies:**
- Story 4.5 creates Winston logger singleton (not yet implemented)
- This story assumes `logger` from `utils/logger.ts` will be available
- If Story 4.5 incomplete, use `console.log` temporarily

**Files Created in Story 4.5 (to be used here):**
- `backend/src/utils/logger.ts` - Winston logger singleton
- `backend/src/utils/errorHandler.ts` - ErrorResponse utilities (if API errors needed)

**Logging Pattern from Story 4.5:**
```typescript
import { logger } from './utils/logger';

// Backpressure detected
logger.warn('WebSocket backpressure detected', {
  sessionId: 'abc123',
  bufferedAmount: 1048576,
  timestamp: new Date().toISOString()
});

// Backpressure resolved
logger.info('WebSocket backpressure resolved', {
  sessionId: 'abc123',
  bufferedAmount: 102400
});

// Critical threshold
logger.error('WebSocket backpressure critical', {
  sessionId: 'abc123',
  bufferedAmount: 10485760,
  duration: 10000
});
```

**Enhancements for This Story:**
- Use Winston logger for all backpressure events
- Include buffer size in log metadata
- Follow structured JSON logging format from Story 4.5
- Optional: Expose backpressure status via WebSocket message (type: 'resource.warning')

**No Files to Reuse from Story 4.5:**
- Story 4.5 is not yet implemented (status: drafted)
- This story creates new backpressure infrastructure (independent of error handling)
- Both stories will integrate when Story 4.5 is implemented (Winston logger will be available)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Workflows-and-Sequencing] - WebSocket backpressure flow diagram
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Services-and-Modules] - backpressureHandler module specification
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.18-AC4.20 backpressure requirements
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Observability] - Backpressure logging events
- [Source: docs/architecture.md#WebSocket-Protocol] - ADR-013 WebSocket design
- [Source: docs/sprint-artifacts/4-5-enhanced-error-messages-and-logging.md#Dev-Notes] - Winston logger integration

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-5 (Winston logger pattern)
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
