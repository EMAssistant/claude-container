# Story 4.7: Graceful Container Shutdown and Cleanup

Status: drafted

## Story

As a developer using Claude Container,
I want the container to shut down gracefully when stopped or restarted,
so that all active sessions are saved, PTY processes are terminated cleanly, and no data is lost.

## Acceptance Criteria

1. **AC4.21**: Graceful shutdown completes in <10s
   - Given: Container running with active sessions
   - When: Docker sends SIGTERM signal (docker stop)
   - Then: Shutdown sequence completes within 10 seconds
   - And: All cleanup actions finish before process exits
   - And: No data loss occurs during shutdown

2. **AC4.22**: PTY processes receive SIGTERM first
   - Given: Active PTY processes running in sessions
   - When: Graceful shutdown initiated
   - Then: Each PTY process receives SIGTERM signal first
   - And: Wait up to 5 seconds for graceful exit
   - And: If still running after 5s, send SIGKILL
   - And: Log termination method used (SIGTERM/SIGKILL) for each PTY

3. **AC4.23**: Session state saved on shutdown
   - Given: Sessions exist with current state (active, idle, error, stopped)
   - When: Shutdown sequence runs
   - Then: All session metadata updated with final status
   - And: Session state written atomically to .claude-container-sessions.json
   - And: File write completes before shutdown
   - And: All sessions marked as 'stopped' status

4. **AC4.24**: Shutdown broadcast sent to clients
   - Given: Active WebSocket connections to frontend clients
   - When: SIGTERM received and shutdown initiated
   - Then: Broadcast message sent: `{ type: 'server.shutdown', message: 'Server shutting down', gracePeriodMs: 5000 }`
   - And: Frontend receives notification before connections close
   - And: Users see shutdown notification in UI

5. **Shutdown sequence ordering**: Correct cleanup order
   - Step 1: Stop accepting new connections (Express + WebSocket)
   - Step 2: Broadcast server.shutdown message to all clients
   - Step 3: Terminate all PTY processes (SIGTERM → 5s wait → SIGKILL)
   - Step 4: Save final session state atomically
   - Step 5: Close all WebSocket connections
   - Step 6: Stop Express server
   - Step 7: Exit process with code 0
   - Total time: <10 seconds

6. **Backend logging for shutdown**: Comprehensive shutdown logging
   - Log: "Received SIGTERM, shutting down gracefully..." (info)
   - Log: "Stopped accepting new connections" (info)
   - Log: "Broadcasting shutdown message to N clients" (info)
   - Log: "Terminating PTY for session X (SIGTERM)" (info)
   - Log: "PTY for session X exited gracefully" (info)
   - Log: "PTY for session X force-killed (SIGKILL)" (warn)
   - Log: "Saved session state to .claude-container-sessions.json" (info)
   - Log: "Graceful shutdown complete" (info)

7. **SIGTERM handler registration**: Process signal handling
   - Given: Backend server starts
   - When: Server initialization completes
   - Then: SIGTERM handler registered with `process.on('SIGTERM', handler)`
   - And: SIGINT handler also registered (for Ctrl+C in development)
   - And: Only one shutdown can run (prevent double execution)

8. **Stop accepting new connections**: Connection blocking
   - Given: Shutdown initiated
   - When: New WebSocket connection attempted
   - Then: Connection rejected with close code 1001 (Going Away)
   - When: New HTTP request received
   - Then: Return 503 Service Unavailable

9. **Backend unit tests**: Shutdown logic tested
   - Test: SIGTERM triggers shutdown sequence
   - Test: PTY processes receive SIGTERM before SIGKILL
   - Test: 5-second timeout enforced for PTY termination
   - Test: Session state saved atomically
   - Test: Shutdown broadcast sent to all WebSocket clients
   - Test: Double shutdown prevented (idempotent)
   - Coverage: ≥70% for shutdownManager module

10. **Integration test**: Full shutdown sequence
    - Test: Start server with 2 active sessions
    - Send SIGTERM signal to process
    - Verify: server.shutdown WebSocket message sent
    - Verify: PTYs terminated within 5s
    - Verify: Session JSON updated with 'stopped' status
    - Verify: Process exits with code 0
    - Verify: Total time <10s

## Tasks / Subtasks

- [ ] Task 1: Create ShutdownManager module (AC: #1, #2, #3, #4, #5)
  - [ ] Create `backend/src/shutdownManager.ts`
  - [ ] Implement `ShutdownManager` class:
    - Constructor accepts server, wss, sessionManager references
    - Track shutdown state (isShuttingDown: boolean)
    - Track shutdown start time (for timeout)
  - [ ] Implement `initiate()` method:
    - Set isShuttingDown = true
    - Log: "Received SIGTERM, shutting down gracefully..."
    - Execute shutdown sequence in order (Steps 1-7 from AC #5)
    - Measure total time, log if >10s warning
  - [ ] Implement `stopAcceptingConnections()` method:
    - Set flag to reject new WebSocket connections
    - Set flag to reject new HTTP requests
    - Log: "Stopped accepting new connections"
  - [ ] Implement `broadcastShutdown()` method:
    - Get all active WebSocket clients from wss.clients
    - Send message: `{ type: 'server.shutdown', message: 'Server shutting down', gracePeriodMs: 5000 }`
    - Log: "Broadcasting shutdown message to N clients"
  - [ ] Implement `terminatePTYs()` method:
    - Get all active sessions from sessionManager
    - For each session with PTY:
      - Send SIGTERM to PTY process
      - Log: "Terminating PTY for session X (SIGTERM)"
      - Start 5-second timeout timer
      - Wait for PTY exit event
      - If timeout expires, send SIGKILL
      - Log outcome: "PTY exited gracefully" or "force-killed (SIGKILL)"
    - Wait for all PTYs to terminate (Promise.all with timeout)
  - [ ] Implement `saveFinalState()` method:
    - Update all session statuses to 'stopped'
    - Call sessionManager.saveToFile() (atomic write)
    - Log: "Saved session state to .claude-container-sessions.json"
  - [ ] Implement `cleanup()` method:
    - Close all WebSocket connections (wss.clients.forEach(ws => ws.close()))
    - Stop Express server (server.close())
    - Log: "Graceful shutdown complete"
    - Exit process with code 0 (process.exit(0))
  - [ ] Export singleton `shutdownManager` instance

- [ ] Task 2: Register SIGTERM/SIGINT handlers in server.ts (AC: #7, #8)
  - [ ] Update `backend/src/server.ts`:
    - Import `shutdownManager` from `shutdownManager.ts`
    - After server starts, initialize shutdownManager with (server, wss, sessionManager)
    - Register SIGTERM handler: `process.on('SIGTERM', () => shutdownManager.initiate())`
    - Register SIGINT handler: `process.on('SIGINT', () => shutdownManager.initiate())` (for Ctrl+C)
  - [ ] Add connection rejection logic:
    - In WebSocket connection handler, check shutdownManager.isShuttingDown
    - If true, send close code 1001 (Going Away) and reject
    - In Express middleware, check shutdownManager.isShuttingDown
    - If true, return 503 Service Unavailable
  - [ ] Test signal handlers don't execute twice (idempotent shutdown)

- [ ] Task 3: Extend SessionManager for shutdown support (AC: #3)
  - [ ] Update `backend/src/sessionManager.ts`:
    - Add `updateAllStatuses(status: string)` method:
      - Iterate all sessions
      - Set session.status = status
      - Update session.lastActivity = now()
    - Ensure `saveToFile()` is atomic (write temp file, rename)
    - Add `getAllActiveSessions()` method:
      - Return sessions with status !== 'stopped'
    - Add `terminatePTY(sessionId: string, signal: NodeJS.Signals)` method:
      - Get session PTY reference
      - Send signal to PTY process (pty.kill(signal))
      - Return Promise that resolves on PTY exit or timeout
  - [ ] Verify atomic file write (use fs.writeFileSync to temp, fs.renameSync)

- [ ] Task 4: Add WebSocket message type for shutdown (AC: #4)
  - [ ] Update `backend/src/types.ts`:
    - Add `ServerShutdownMessage` interface:
      ```typescript
      interface ServerShutdownMessage {
        type: 'server.shutdown';
        message: string;
        gracePeriodMs: number;
      }
      ```
    - Add to `WebSocketMessage` union type
  - [ ] Update `frontend/src/types.ts`:
    - Add matching `ServerShutdownMessage` interface
    - Add to `WebSocketMessage` union type

- [ ] Task 5: Handle shutdown message in frontend (AC: #4)
  - [ ] Update `frontend/src/hooks/useWebSocket.ts`:
    - Add case for `message.type === 'server.shutdown'`
    - Display toast notification: "Server shutting down, please wait..."
    - Store shutdown state in context (optional)
  - [ ] Optional: Add visual indicator in TopBar when server shutting down

- [ ] Task 6: Add comprehensive shutdown logging (AC: #6)
  - [ ] Use existing Winston logger from Story 4.5 (`backend/src/utils/logger.ts`)
  - [ ] Log all shutdown events with appropriate levels:
    - SIGTERM received (info)
    - Stopped accepting connections (info)
    - Broadcasting shutdown (info)
    - Each PTY termination attempt (info)
    - Each PTY exit outcome (info/warn)
    - Session state saved (info)
    - Shutdown complete (info)
  - [ ] Include metadata: sessionId, signal used, elapsed time
  - [ ] Format example:
    ```json
    {
      "level": "info",
      "message": "Graceful shutdown initiated",
      "trigger": "SIGTERM",
      "activeSessions": 3,
      "timestamp": "2025-11-25T10:30:00.000Z"
    }
    ```

- [ ] Task 7: Write comprehensive unit tests (AC: #9)
  - [ ] Create `backend/src/shutdownManager.test.ts`
  - [ ] Test cases:
    - Mock server, wss, sessionManager
    - Test SIGTERM triggers initiate()
    - Test shutdown sequence order (verify method call order)
    - Test PTY SIGTERM → 5s wait → SIGKILL escalation
    - Test session state updated to 'stopped'
    - Test session file saved atomically
    - Test WebSocket broadcast sent to all clients
    - Test double shutdown prevented (idempotent)
    - Test new connections rejected during shutdown
  - [ ] Mock timers (Jest fake timers) for 5s timeout
  - [ ] Verify ≥70% coverage for `shutdownManager.ts`

- [ ] Task 8: Write integration test for full shutdown (AC: #10)
  - [ ] Create `backend/src/__tests__/shutdown.integration.test.ts`
  - [ ] Test scenario:
    - Start real server with Express + WebSocket
    - Create 2 sessions with PTY processes
    - Send SIGTERM signal to process (process.emit('SIGTERM'))
    - Mock WebSocket send to capture server.shutdown message
    - Verify PTYs terminated within 5 seconds
    - Verify session JSON updated (read file)
    - Verify process.exit(0) called (mock process.exit)
    - Measure total shutdown time (<10s)
  - [ ] Use real file I/O to test atomic session save
  - [ ] Clean up test artifacts (session JSON) after test

- [ ] Task 9: Update documentation (AC: all)
  - [ ] Update `CLAUDE.md` (or README.md):
    - Document graceful shutdown behavior
    - Explain SIGTERM → SIGKILL escalation
    - Note 10-second shutdown window
    - Example: `docker stop claude-container` waits for graceful shutdown
  - [ ] Update `docs/architecture.md`:
    - Add "Graceful Shutdown" section
    - Document shutdown sequence (7 steps)
    - Note Docker SIGTERM → SIGKILL timeout (default 10s)
  - [ ] Add troubleshooting section:
    - "If sessions don't restore after restart, check logs for shutdown errors"
    - "SIGKILL used only if PTY doesn't respond to SIGTERM within 5s"

- [ ] Task 10: Manual validation with docker stop (AC: #1)
  - [ ] Start container with `docker run`
  - [ ] Create 2-3 active sessions
  - [ ] Run command in one session (e.g., `tail -f /var/log/syslog`)
  - [ ] Run `docker stop claude-container` (sends SIGTERM)
  - [ ] Verify shutdown completes within 10 seconds
  - [ ] Check logs for shutdown sequence
  - [ ] Restart container, verify sessions restored as 'stopped'
  - [ ] Document findings in story completion notes

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Graceful Shutdown Flow (Workflows Section)**:
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

**ShutdownManager Module (Services and Modules)**:
```typescript
// Module: shutdownManager.ts (new)
// Responsibility: Orchestrate graceful container shutdown
// Inputs: SIGTERM signal
// Outputs: Ordered shutdown sequence
```

**Timing Constraints**:
- **Total shutdown window**: 10 seconds (Docker default SIGTERM → SIGKILL timeout)
- **PTY termination grace period**: 5 seconds per process
- **Session save**: Must complete before exit (atomic write)
- **WebSocket broadcast**: Send immediately at shutdown start

**From Architecture (docs/architecture.md)**:

**Error Handling Strategy**:
- Graceful degradation: If PTY won't exit with SIGTERM, use SIGKILL (data loss acceptable to ensure shutdown)
- Log all termination methods for debugging
- Atomic session save prevents partial state corruption

**Session State Model (ADR-008)**:
- All sessions set to 'stopped' status on shutdown
- Session metadata preserved for resume after restart
- Atomic file write prevents partial corruption

**WebSocket Protocol Extension**:
- New message type: `server.shutdown`
- Sent at shutdown initiation (before PTY termination)
- Frontend can display notification to user

### Project Structure Notes

**Files to Create:**
```
backend/src/
├── shutdownManager.ts              # ShutdownManager class, singleton
└── __tests__/
    ├── shutdownManager.test.ts     # Unit tests
    └── shutdown.integration.test.ts # Integration test
```

**Files to Modify:**
```
backend/src/
├── server.ts                        # SIGTERM/SIGINT handler registration
├── sessionManager.ts                # Add updateAllStatuses, terminatePTY methods
└── types.ts                         # ServerShutdownMessage interface

frontend/src/
├── types.ts                         # ServerShutdownMessage interface (matching backend)
└── hooks/useWebSocket.ts            # Handle server.shutdown message

docs/
├── CLAUDE.md                        # Document shutdown behavior
└── architecture.md                  # Add Graceful Shutdown section
```

**New Dependencies:**
None - uses existing Node.js process signals and fs module

### Implementation Guidance

**ShutdownManager Pattern**:
```typescript
// backend/src/shutdownManager.ts
import { logger } from './utils/logger';
import type { Server } from 'http';
import type { WebSocketServer } from 'ws';
import type { SessionManager } from './sessionManager';

class ShutdownManager {
  private isShuttingDown: boolean = false;
  private shutdownStartTime?: number;

  constructor(
    private server: Server,
    private wss: WebSocketServer,
    private sessionManager: SessionManager
  ) {}

  async initiate(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();

    logger.info('Graceful shutdown initiated', {
      trigger: 'SIGTERM',
      activeSessions: this.sessionManager.getAllActiveSessions().length
    });

    try {
      // Step 1: Stop accepting new connections
      this.stopAcceptingConnections();

      // Step 2: Broadcast shutdown to clients
      await this.broadcastShutdown();

      // Step 3: Terminate PTYs
      await this.terminatePTYs();

      // Step 4: Save final session state
      await this.saveFinalState();

      // Step 5-7: Cleanup and exit
      this.cleanup();
    } catch (error) {
      logger.error('Shutdown sequence failed', { error });
      // Force exit anyway to prevent hang
      process.exit(1);
    }
  }

  private stopAcceptingConnections(): void {
    // Set flag checked by connection handlers
    logger.info('Stopped accepting new connections');
  }

  private async broadcastShutdown(): Promise<void> {
    const message = {
      type: 'server.shutdown' as const,
      message: 'Server shutting down',
      gracePeriodMs: 5000
    };

    const clientCount = this.wss.clients.size;
    logger.info('Broadcasting shutdown message', { clientCount });

    this.wss.clients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });

    // Give clients brief moment to receive message
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async terminatePTYs(): Promise<void> {
    const sessions = this.sessionManager.getAllActiveSessions();
    logger.info('Terminating PTY processes', { count: sessions.length });

    const terminationPromises = sessions.map(async session => {
      if (!session.ptyPid) return;

      logger.info('Terminating PTY', { sessionId: session.id, signal: 'SIGTERM' });

      try {
        // Send SIGTERM and wait up to 5 seconds
        await this.sessionManager.terminatePTY(session.id, 'SIGTERM');
        logger.info('PTY exited gracefully', { sessionId: session.id });
      } catch (error) {
        // Timeout or error - force kill
        logger.warn('PTY force-killed', { sessionId: session.id, signal: 'SIGKILL' });
        await this.sessionManager.terminatePTY(session.id, 'SIGKILL');
      }
    });

    await Promise.all(terminationPromises);
  }

  private async saveFinalState(): Promise<void> {
    this.sessionManager.updateAllStatuses('stopped');
    await this.sessionManager.saveToFile();
    logger.info('Saved final session state');
  }

  private cleanup(): void {
    // Close WebSocket server
    this.wss.clients.forEach(ws => ws.close(1001, 'Server shutting down'));
    this.wss.close();

    // Close HTTP server
    this.server.close(() => {
      const elapsedMs = Date.now() - (this.shutdownStartTime || Date.now());
      logger.info('Graceful shutdown complete', { elapsedMs });

      if (elapsedMs > 10000) {
        logger.warn('Shutdown exceeded 10s target', { elapsedMs });
      }

      process.exit(0);
    });

    // Force exit after 1s if server.close doesn't finish
    setTimeout(() => {
      logger.warn('Forcing exit after server.close timeout');
      process.exit(0);
    }, 1000);
  }
}

export const createShutdownManager = (
  server: Server,
  wss: WebSocketServer,
  sessionManager: SessionManager
): ShutdownManager => {
  return new ShutdownManager(server, wss, sessionManager);
};
```

**SessionManager Extensions**:
```typescript
// backend/src/sessionManager.ts
class SessionManager {
  updateAllStatuses(status: 'stopped' | 'active' | 'idle' | 'error'): void {
    this.sessions.forEach(session => {
      session.status = status;
      session.lastActivity = new Date().toISOString();
    });
  }

  getAllActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status !== 'stopped' && s.ptyPid
    );
  }

  async terminatePTY(sessionId: string, signal: NodeJS.Signals): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) {
      throw new Error(`Session ${sessionId} has no PTY`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PTY termination timeout'));
      }, 5000);

      session.pty.onExit(() => {
        clearTimeout(timeout);
        resolve();
      });

      session.pty.kill(signal);
    });
  }

  async saveToFile(): Promise<void> {
    const data = JSON.stringify(Array.from(this.sessions.values()), null, 2);
    const tempPath = `${this.sessionFilePath}.tmp`;

    // Atomic write: temp file + rename
    fs.writeFileSync(tempPath, data, 'utf-8');
    fs.renameSync(tempPath, this.sessionFilePath);
  }
}
```

**Server.ts Signal Handler Registration**:
```typescript
// backend/src/server.ts
import { createShutdownManager } from './shutdownManager';

// After server starts
const shutdownManager = createShutdownManager(server, wss, sessionManager);

process.on('SIGTERM', () => shutdownManager.initiate());
process.on('SIGINT', () => shutdownManager.initiate());

// Reject connections during shutdown
wss.on('connection', (ws) => {
  if (shutdownManager.isShuttingDown) {
    ws.close(1001, 'Server shutting down');
    return;
  }
  // ... normal connection handling
});

app.use((req, res, next) => {
  if (shutdownManager.isShuttingDown) {
    res.status(503).json({ error: 'Server shutting down' });
    return;
  }
  next();
});
```

**Frontend Shutdown Handling**:
```typescript
// frontend/src/hooks/useWebSocket.ts
useEffect(() => {
  // ... existing WebSocket setup

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'server.shutdown') {
      // Show toast notification
      toast({
        type: 'warning',
        message: 'Server shutting down, please wait...',
        autoDismiss: false
      });
      // Optional: set shutdown state in context
    }

    // ... other message handlers
  };
}, []);
```

**Testing Considerations:**
- Mock `process.on()` to capture signal handlers
- Mock `process.exit()` to verify exit code 0
- Use Jest fake timers for 5s PTY timeout
- Mock fs operations for atomic file save test
- Integration test uses real file I/O (test directory)
- Test idempotent shutdown (second SIGTERM ignored)

**Docker Considerations:**
- Docker default SIGTERM → SIGKILL timeout: 10 seconds
- `docker stop` sends SIGTERM, waits, then SIGKILL
- Can override with `docker stop -t 30` for 30s timeout
- This implementation targets <10s to work with defaults

### Learnings from Previous Story

**From Story 4-6-websocket-backpressure-handling (Status: drafted)**

**Integration Points for This Story:**
- **Winston Logger** will be used for all shutdown logging
  - File: `backend/src/utils/logger.ts` (created in Story 4.5)
  - This story uses Winston JSON format with structured metadata
  - Log levels: `info` (shutdown events), `warn` (SIGKILL escalation), `error` (shutdown failures)

**Patterns to Follow:**
- **Singleton service pattern**: ShutdownManager follows same pattern as backpressureMonitor (Story 4.6)
- **Per-session state tracking**: Use Map-based tracking like backpressureHandler
- **Cleanup on destroy**: Similar to `stopMonitoring()` cleanup in backpressure handler
- **Structured logging**: Include sessionId, signal, elapsed time in all log entries

**Dependencies:**
- Story 4.5 creates Winston logger singleton (not yet implemented)
- This story assumes `logger` from `utils/logger.ts` will be available
- If Story 4.5 incomplete, use `console.log` temporarily

**Files Created in Story 4.5 (to be used here):**
- `backend/src/utils/logger.ts` - Winston logger singleton

**Logging Pattern from Story 4.5:**
```typescript
import { logger } from './utils/logger';

// Shutdown initiated
logger.info('Graceful shutdown initiated', {
  trigger: 'SIGTERM',
  activeSessions: 3,
  timestamp: new Date().toISOString()
});

// PTY terminated
logger.info('PTY exited gracefully', {
  sessionId: 'abc123',
  signal: 'SIGTERM'
});

// Force kill
logger.warn('PTY force-killed', {
  sessionId: 'abc123',
  signal: 'SIGKILL',
  reason: 'Timeout after 5s'
});
```

**Enhancements for This Story:**
- Use Winston logger for all shutdown events
- Include elapsed time in shutdown complete log
- Follow structured JSON logging format from Story 4.5
- Log all PTY termination outcomes for debugging

**No Direct Code Reuse from Story 4.6:**
- Story 4.6 (backpressure) is independent of shutdown logic
- Both stories use similar singleton service pattern
- Both integrate with sessionManager (different methods)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Workflows-and-Sequencing] - Graceful shutdown flow diagram
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Services-and-Modules] - shutdownManager module specification
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.21-AC4.24 shutdown requirements
- [Source: docs/architecture.md#Session-State-Model] - ADR-008 session persistence
- [Source: docs/sprint-artifacts/4-6-websocket-backpressure-handling.md#Dev-Notes] - Winston logger integration pattern

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-6 (Winston logger pattern, singleton service pattern)
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
