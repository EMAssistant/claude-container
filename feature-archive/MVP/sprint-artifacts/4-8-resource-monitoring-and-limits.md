# Story 4.8: Resource Monitoring and Limits

Status: drafted

## Story

As a developer using Claude Container,
I want the system to monitor resource usage and enforce limits proactively,
so that I am warned before resource exhaustion and prevented from creating sessions that would crash the container.

## Acceptance Criteria

1. **AC4.25**: Memory warning at 87%
   - Given: Container memory usage approaches 7GB (87% of 8GB limit)
   - When: ResourceMonitor detects memoryUsagePercent >= 87%
   - Then: WebSocket message sent: `{ type: 'resource.warning', message: 'High memory usage', memoryUsagePercent: 87, isAcceptingNewSessions: true }`
   - And: Backend logs warning: "Memory usage high" with current percentage
   - And: Warning displayed in TopBar UI

2. **AC4.26**: New sessions blocked at 93%
   - Given: Container memory usage reaches 7.5GB (93% of 8GB limit)
   - When: User attempts to create new session via POST /api/sessions
   - Then: Request returns 503 Service Unavailable
   - And: Error response follows ErrorResponse format:
     ```json
     {
       "error": {
         "type": "resource",
         "message": "Maximum resource capacity reached",
         "details": "Memory usage is at 93%. Cannot create new sessions.",
         "suggestion": "Close idle sessions before creating new ones."
       }
     }
     ```
   - And: ResourceMonitor broadcasts: `{ type: 'resource.warning', ..., isAcceptingNewSessions: false }`
   - And: Frontend displays error toast with suggestion

3. **AC4.27**: Zombie processes cleaned up
   - Given: Orphaned PTY processes exist (process running but no session references it)
   - When: ZombieCleanup timer runs (every 60 seconds)
   - Then: All zombie PTY processes identified by comparing active PIDs to session PIDs
   - And: Each zombie process receives SIGKILL
   - And: Backend logs: "Zombie process cleaned" with PID and elapsed time
   - And: Cleanup completes within 5 seconds

4. **Memory monitoring cycle**: Continuous resource tracking
   - Given: Backend server is running
   - When: ResourceMonitor initializes
   - Then: Monitoring loop runs every 30 seconds
   - And: Each cycle checks `process.memoryUsage().heapUsed`
   - And: Compares to memoryLimitBytes (8GB = 8589934592 bytes)
   - And: Calculates memoryUsagePercent = (heapUsed / limit) * 100
   - And: Updates ResourceState with current values

5. **Session count tracking**: Active session limit enforcement
   - Given: ResourceMonitor tracks active sessions
   - When: Session creation requested
   - Then: Check sessionCount < maxSessions (4)
   - And: If at limit, return 409 Conflict (existing Epic 2 behavior)
   - And: ResourceState includes sessionCount and maxSessions fields

6. **Backend logging for resource events**: Comprehensive logging
   - Log: "Resource monitoring started" (info)
   - Log: "Memory usage high: 87%" (warn) with sessionCount, memoryUsagePercent
   - Log: "Memory critical: 93%, blocking new sessions" (error) with details
   - Log: "Zombie process detected: PID 12345" (warn) with sessionId
   - Log: "Zombie process cleaned: PID 12345" (info) with elapsed time
   - Log: "Resource monitoring stopped" (info)

7. **Frontend resource warning display**: UI feedback
   - Given: TopBar component receives resource.warning message
   - When: memoryUsagePercent >= 87%
   - Then: Display warning banner above TopBar:
     - Text: "High memory usage (87%). Consider closing idle sessions."
     - Background: #EBCB8B (Oceanic Calm yellow/warning)
     - Icon: AlertTriangle
     - Dismissible: Yes (X button)
   - When: isAcceptingNewSessions === false
   - Then: Banner text updates: "Memory critical (93%). Cannot create new sessions until memory is freed."
   - And: Create Session button disabled in SessionModal

8. **Resource state broadcast**: Real-time updates
   - Given: ResourceMonitor detects state change
   - When: Memory crosses 87% threshold (up or down)
   - Then: Broadcast resource.warning to all WebSocket clients
   - When: Memory crosses 93% threshold (up or down)
   - Then: Broadcast resource.warning with updated isAcceptingNewSessions
   - And: Frontend updates UI immediately

9. **Backend unit tests**: Resource monitor logic
   - Test: Memory percentage calculation (various heap sizes)
   - Test: 87% threshold triggers warning (not before)
   - Test: 93% threshold blocks new sessions
   - Test: Zombie process detection (PID not in active sessions)
   - Test: Zombie cleanup sends SIGKILL
   - Test: Monitoring loop runs every 30s
   - Test: Resource state broadcast on threshold change
   - Coverage: ≥70% for resourceMonitor module

10. **Integration test**: Full resource monitoring flow
    - Test: Start server, create 3 sessions
    - Mock process.memoryUsage() to return 7.3GB (90%)
    - Wait for monitoring cycle
    - Verify: resource.warning WebSocket sent with memoryUsagePercent: 90
    - Mock memory increase to 7.6GB (94%)
    - Attempt session creation
    - Verify: 503 response with ErrorResponse format
    - Verify: Frontend receives isAcceptingNewSessions: false

## Tasks / Subtasks

- [ ] Task 1: Create ResourceMonitor module (AC: #1, #2, #4, #5, #8)
  - [ ] Create `backend/src/resourceMonitor.ts`
  - [ ] Implement `ResourceMonitor` class:
    - Constructor accepts wss (WebSocketServer), sessionManager references
    - Track state: memoryLimitBytes = 8GB, thresholds (87%, 93%)
    - Track monitoring interval (30s default)
  - [ ] Implement `startMonitoring()` method:
    - Start 30-second interval timer
    - Log: "Resource monitoring started"
    - Set isMonitoring flag
  - [ ] Implement `checkResources()` method (runs every 30s):
    - Get heapUsed from `process.memoryUsage().heapUsed`
    - Calculate memoryUsagePercent = (heapUsed / memoryLimitBytes) * 100
    - Get sessionCount from sessionManager.getSessionCount()
    - Update ResourceState object
    - Check thresholds and trigger warnings
  - [ ] Implement `checkMemoryThresholds(state: ResourceState)` method:
    - If memoryUsagePercent >= 93%:
      - Set isAcceptingNewSessions = false
      - Log error: "Memory critical: X%, blocking new sessions"
      - Broadcast resource.warning with isAcceptingNewSessions: false
    - Else if memoryUsagePercent >= 87%:
      - Log warn: "Memory usage high: X%"
      - Broadcast resource.warning with isAcceptingNewSessions: true
    - Else if memoryUsagePercent < 87% (recovered):
      - Set isAcceptingNewSessions = true
      - Broadcast resource.warning with recovery message
  - [ ] Implement `broadcastResourceWarning(state: ResourceState)` method:
    - Create message: `{ type: 'resource.warning', message, memoryUsagePercent, isAcceptingNewSessions }`
    - Send to all WebSocket clients
  - [ ] Implement `stopMonitoring()` method:
    - Clear interval timer
    - Log: "Resource monitoring stopped"
  - [ ] Export singleton `resourceMonitor` instance

- [ ] Task 2: Create ZombieCleanup module (AC: #3, #6)
  - [ ] Create `backend/src/zombieCleanup.ts`
  - [ ] Implement `ZombieCleanup` class:
    - Constructor accepts sessionManager reference
    - Track cleanup interval (60s default)
  - [ ] Implement `startCleanup()` method:
    - Start 60-second interval timer
    - Log: "Zombie cleanup started"
  - [ ] Implement `detectAndCleanZombies()` method:
    - Get all active session PIDs from sessionManager
    - Use `ps` command or process listing to find all PTY processes
    - Compare to identify zombie PIDs (PTY running but not in sessions)
    - For each zombie:
      - Log warn: "Zombie process detected: PID X"
      - Send SIGKILL to process
      - Log info: "Zombie process cleaned: PID X"
    - Complete within 5 seconds timeout
  - [ ] Implement `stopCleanup()` method:
    - Clear interval timer
  - [ ] Export singleton `zombieCleanup` instance

- [ ] Task 3: Integrate ResourceMonitor into server.ts (AC: #1, #2, #8)
  - [ ] Update `backend/src/server.ts`:
    - Import `resourceMonitor` from `resourceMonitor.ts`
    - After server starts, initialize: `resourceMonitor.init(wss, sessionManager)`
    - Call `resourceMonitor.startMonitoring()`
    - On shutdown (SIGTERM), call `resourceMonitor.stopMonitoring()`
  - [ ] Add session creation gate:
    - In POST /api/sessions handler, check `resourceMonitor.isAcceptingNewSessions`
    - If false, return 503 with ErrorResponse format (AC #2)
  - [ ] Import and start ZombieCleanup:
    - Import `zombieCleanup` from `zombieCleanup.ts`
    - Call `zombieCleanup.init(sessionManager)` and `zombieCleanup.startCleanup()`
    - On shutdown, call `zombieCleanup.stopCleanup()`

- [ ] Task 4: Add WebSocket message type for resource warnings (AC: #8)
  - [ ] Update `backend/src/types.ts`:
    - Add `ResourceWarningMessage` interface:
      ```typescript
      interface ResourceWarningMessage {
        type: 'resource.warning';
        message: string;
        memoryUsagePercent: number;
        isAcceptingNewSessions: boolean;
      }
      ```
    - Add to `WebSocketMessage` union type
  - [ ] Update `frontend/src/types.ts`:
    - Add matching `ResourceWarningMessage` interface
    - Add to `WebSocketMessage` union type

- [ ] Task 5: Handle resource warnings in frontend (AC: #7)
  - [ ] Update `frontend/src/hooks/useWebSocket.ts`:
    - Add case for `message.type === 'resource.warning'`
    - Store resource state in context or local state
    - Display toast notification for warnings
  - [ ] Update `frontend/src/components/TopBar.tsx`:
    - Add warning banner component above TopBar
    - Display when memoryUsagePercent >= 87%
    - Show different text for 87% vs 93% (AC #7)
    - Make banner dismissible (X button)
    - Style with Oceanic Calm yellow (#EBCB8B) background
  - [ ] Update `frontend/src/components/SessionList.tsx` or `SessionModal`:
    - Disable "Create Session" button when isAcceptingNewSessions === false
    - Show tooltip: "Memory critical - cannot create new sessions"

- [ ] Task 6: Add comprehensive resource logging (AC: #6)
  - [ ] Use existing Winston logger from Story 4.5 (`backend/src/utils/logger.ts`)
  - [ ] Log all resource events with appropriate levels:
    - Monitoring started/stopped (info)
    - Memory high (warn) with metadata: sessionCount, memoryUsagePercent
    - Memory critical (error) with details
    - Zombie detected (warn) with PID, sessionId
    - Zombie cleaned (info) with PID, elapsed time
  - [ ] Include metadata: memoryUsagePercent, sessionCount, PID, timestamp
  - [ ] Format example:
    ```json
    {
      "level": "warn",
      "message": "Memory usage high",
      "memoryUsagePercent": 87.5,
      "sessionCount": 3,
      "memoryUsedBytes": 7516192768,
      "timestamp": "2025-11-25T10:30:00.000Z"
    }
    ```

- [ ] Task 7: Write comprehensive unit tests (AC: #9)
  - [ ] Create `backend/src/resourceMonitor.test.ts`
  - [ ] Test cases:
    - Mock process.memoryUsage()
    - Test memory percentage calculation (various heap sizes)
    - Test 87% threshold triggers warning (86% does not)
    - Test 93% threshold sets isAcceptingNewSessions = false
    - Test WebSocket broadcast sent on threshold change
    - Test monitoring interval runs every 30s (Jest fake timers)
    - Test stopMonitoring clears interval
  - [ ] Create `backend/src/zombieCleanup.test.ts`
  - [ ] Test cases:
    - Mock sessionManager.getActivePIDs()
    - Mock process listing (ps command or equivalent)
    - Test zombie detection (PID in ps but not in sessions)
    - Test SIGKILL sent to zombie processes
    - Test cleanup runs every 60s
    - Test cleanup completes within 5s
  - [ ] Verify ≥70% coverage for both modules

- [ ] Task 8: Write integration test for resource flow (AC: #10)
  - [ ] Create `backend/src/__tests__/resource.integration.test.ts`
  - [ ] Test scenario:
    - Start real server with Express + WebSocket
    - Create 3 sessions
    - Mock process.memoryUsage() to return 7.3GB (90%)
    - Wait for monitoring cycle (use Jest fake timers)
    - Mock WebSocket send to capture resource.warning message
    - Verify message sent with correct memoryUsagePercent
    - Mock memory increase to 7.6GB (94%)
    - Attempt POST /api/sessions
    - Verify 503 response with ErrorResponse format
    - Verify WebSocket broadcast: isAcceptingNewSessions: false
  - [ ] Clean up test artifacts after test

- [ ] Task 9: Update frontend tests for resource UI (AC: #7)
  - [ ] Create `frontend/src/components/TopBar.test.tsx` (or update existing)
  - [ ] Test cases:
    - Resource warning banner appears when memoryUsagePercent >= 87%
    - Banner text changes for 93% (critical) vs 87% (warning)
    - Banner dismissible with X button
    - Banner uses correct styling (Oceanic Calm yellow)
  - [ ] Update SessionList or SessionModal tests:
    - "Create Session" button disabled when isAcceptingNewSessions === false
    - Tooltip shows correct message

- [ ] Task 10: Update documentation (AC: all)
  - [ ] Update `CLAUDE.md` (or README.md):
    - Document resource monitoring behavior
    - Explain memory thresholds (87% warning, 93% critical)
    - Note zombie process cleanup (every 60s)
    - Recommended container memory limit: 8GB
    - Example: `docker run -m 8g ...` to set memory limit
  - [ ] Update `docs/architecture.md`:
    - Add "Resource Management" section
    - Document ResourceMonitor and ZombieCleanup modules
    - Note monitoring intervals (30s resource check, 60s zombie cleanup)
  - [ ] Add troubleshooting section:
    - "If session creation fails with 503, check memory usage and close idle sessions"
    - "Zombie processes are cleaned automatically every 60 seconds"
    - "To increase memory limit, use `docker run -m <size>` flag"

- [ ] Task 11: Manual validation with resource exhaustion (AC: #1, #2, #3)
  - [ ] Start container with `docker run -m 8g` (8GB memory limit)
  - [ ] Create multiple sessions to approach memory limit
  - [ ] Run memory-intensive commands (e.g., large file operations, builds)
  - [ ] Monitor TopBar for warning banner at 87%
  - [ ] Verify session creation blocked at 93%
  - [ ] Verify error message format and suggestion
  - [ ] Crash a PTY process manually (kill -9) to create zombie
  - [ ] Verify zombie cleaned within 60 seconds
  - [ ] Check logs for resource events
  - [ ] Document findings in story completion notes

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**ResourceMonitor Module (Services and Modules)**:
```
| Module | Responsibility | Inputs | Outputs |
| resourceMonitor.ts (new) | Monitor memory usage, cleanup zombie processes | process.memoryUsage(), PTY process list | Resource warnings, cleanup actions |
```

**Resource State Model (Data Models section)**:
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

**Memory Thresholds**:
- **87% (7GB)**: Warning threshold - log warning, notify frontend, still accepting sessions
- **93% (7.5GB)**: Critical threshold - block new sessions, error logs, frontend shows critical banner
- **Docker memory limit**: 8GB recommended (8589934592 bytes)

**Timing Constraints**:
- **Resource monitoring cycle**: Every 30 seconds
- **Zombie cleanup cycle**: Every 60 seconds
- **Zombie cleanup timeout**: Must complete within 5 seconds
- **WebSocket broadcast**: Immediate on threshold change

**From Architecture (docs/architecture.md)**:

**Error Handling Strategy**:
- 503 Service Unavailable when resources exhausted
- ErrorResponse format: type, message, details, suggestion
- User-friendly messages with actionable suggestions

**Logging Strategy (ADR)**:
- Winston structured JSON logging
- Levels: info (monitoring events), warn (87% threshold), error (93% threshold)
- Include metadata: memoryUsagePercent, sessionCount, PID, timestamp

**WebSocket Protocol Extension**:
- New message type: `resource.warning`
- Broadcast to all clients on state change
- Frontend updates UI immediately (TopBar banner, session button state)

**Session Limit Enforcement (Epic 2)**:
- MAX_SESSIONS = 4 (existing constraint from Story 2.11)
- ResourceMonitor tracks sessionCount
- Session creation already checks session count limit (409 Conflict)
- This story adds memory-based blocking (503 Service Unavailable)

### Project Structure Notes

**Files to Create:**
```
backend/src/
├── resourceMonitor.ts              # ResourceMonitor class, singleton
├── zombieCleanup.ts                # ZombieCleanup class, singleton
└── __tests__/
    ├── resourceMonitor.test.ts     # Unit tests
    ├── zombieCleanup.test.ts       # Unit tests
    └── resource.integration.test.ts # Integration test
```

**Files to Modify:**
```
backend/src/
├── server.ts                        # Initialize ResourceMonitor + ZombieCleanup, gate session creation
└── types.ts                         # ResourceWarningMessage interface

frontend/src/
├── types.ts                         # ResourceWarningMessage interface (matching backend)
├── hooks/useWebSocket.ts            # Handle resource.warning message
├── components/TopBar.tsx            # Warning banner display
└── components/SessionList.tsx       # Disable create button when critical

docs/
├── CLAUDE.md                        # Document resource monitoring
└── architecture.md                  # Add Resource Management section
```

**New Dependencies:**
None - uses existing Node.js `process.memoryUsage()` and Winston logger

### Implementation Guidance

**ResourceMonitor Pattern**:
```typescript
// backend/src/resourceMonitor.ts
import { logger } from './utils/logger';
import type { WebSocketServer } from 'ws';
import type { SessionManager } from './sessionManager';

interface ResourceState {
  memoryUsedBytes: number;
  memoryLimitBytes: number;
  memoryUsagePercent: number;
  sessionCount: number;
  maxSessions: number;
  isAcceptingNewSessions: boolean;
  zombieProcessCount: number;
}

class ResourceMonitor {
  private static readonly MEMORY_LIMIT_BYTES = 8 * 1024 * 1024 * 1024; // 8GB
  private static readonly WARNING_THRESHOLD = 87; // %
  private static readonly CRITICAL_THRESHOLD = 93; // %
  private static readonly CHECK_INTERVAL_MS = 30000; // 30s

  private monitoringInterval?: NodeJS.Timeout;
  private currentState: ResourceState;

  constructor(
    private wss: WebSocketServer,
    private sessionManager: SessionManager
  ) {
    this.currentState = {
      memoryUsedBytes: 0,
      memoryLimitBytes: ResourceMonitor.MEMORY_LIMIT_BYTES,
      memoryUsagePercent: 0,
      sessionCount: 0,
      maxSessions: 4,
      isAcceptingNewSessions: true,
      zombieProcessCount: 0
    };
  }

  startMonitoring(): void {
    logger.info('Resource monitoring started', {
      checkIntervalMs: ResourceMonitor.CHECK_INTERVAL_MS,
      memoryLimitBytes: ResourceMonitor.MEMORY_LIMIT_BYTES
    });

    this.monitoringInterval = setInterval(() => {
      this.checkResources();
    }, ResourceMonitor.CHECK_INTERVAL_MS);

    // Initial check
    this.checkResources();
  }

  private checkResources(): void {
    const heapUsed = process.memoryUsage().heapUsed;
    const memoryUsagePercent = (heapUsed / ResourceMonitor.MEMORY_LIMIT_BYTES) * 100;
    const sessionCount = this.sessionManager.getSessionCount();

    // Update state
    const previousState = { ...this.currentState };
    this.currentState = {
      memoryUsedBytes: heapUsed,
      memoryLimitBytes: ResourceMonitor.MEMORY_LIMIT_BYTES,
      memoryUsagePercent,
      sessionCount,
      maxSessions: 4,
      isAcceptingNewSessions: this.currentState.isAcceptingNewSessions,
      zombieProcessCount: 0 // Updated by ZombieCleanup
    };

    // Check thresholds
    this.checkMemoryThresholds(previousState);
  }

  private checkMemoryThresholds(previousState: ResourceState): void {
    const percent = this.currentState.memoryUsagePercent;

    // Critical threshold (93%)
    if (percent >= ResourceMonitor.CRITICAL_THRESHOLD) {
      if (this.currentState.isAcceptingNewSessions) {
        this.currentState.isAcceptingNewSessions = false;
        logger.error('Memory critical, blocking new sessions', {
          memoryUsagePercent: percent,
          sessionCount: this.currentState.sessionCount,
          memoryUsedBytes: this.currentState.memoryUsedBytes
        });
        this.broadcastResourceWarning();
      }
    }
    // Warning threshold (87%)
    else if (percent >= ResourceMonitor.WARNING_THRESHOLD) {
      if (!this.currentState.isAcceptingNewSessions) {
        // Recovered from critical, now just warning
        this.currentState.isAcceptingNewSessions = true;
        this.broadcastResourceWarning();
      }

      logger.warn('Memory usage high', {
        memoryUsagePercent: percent,
        sessionCount: this.currentState.sessionCount,
        memoryUsedBytes: this.currentState.memoryUsedBytes
      });
    }
    // Recovered
    else if (previousState.memoryUsagePercent >= ResourceMonitor.WARNING_THRESHOLD) {
      if (!this.currentState.isAcceptingNewSessions) {
        this.currentState.isAcceptingNewSessions = true;
        logger.info('Memory usage recovered', { memoryUsagePercent: percent });
        this.broadcastResourceWarning();
      }
    }
  }

  private broadcastResourceWarning(): void {
    const message = {
      type: 'resource.warning' as const,
      message: this.getWarningMessage(),
      memoryUsagePercent: this.currentState.memoryUsagePercent,
      isAcceptingNewSessions: this.currentState.isAcceptingNewSessions
    };

    this.wss.clients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private getWarningMessage(): string {
    const percent = Math.round(this.currentState.memoryUsagePercent);
    if (!this.currentState.isAcceptingNewSessions) {
      return `Memory critical (${percent}%). Cannot create new sessions until memory is freed.`;
    }
    return `High memory usage (${percent}%). Consider closing idle sessions.`;
  }

  get isAcceptingNewSessions(): boolean {
    return this.currentState.isAcceptingNewSessions;
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      logger.info('Resource monitoring stopped');
    }
  }
}

export const createResourceMonitor = (
  wss: WebSocketServer,
  sessionManager: SessionManager
): ResourceMonitor => {
  return new ResourceMonitor(wss, sessionManager);
};
```

**ZombieCleanup Pattern**:
```typescript
// backend/src/zombieCleanup.ts
import { logger } from './utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SessionManager } from './sessionManager';

const execAsync = promisify(exec);

class ZombieCleanup {
  private static readonly CLEANUP_INTERVAL_MS = 60000; // 60s
  private static readonly CLEANUP_TIMEOUT_MS = 5000; // 5s

  private cleanupInterval?: NodeJS.Timeout;

  constructor(private sessionManager: SessionManager) {}

  startCleanup(): void {
    logger.info('Zombie cleanup started', {
      cleanupIntervalMs: ZombieCleanup.CLEANUP_INTERVAL_MS
    });

    this.cleanupInterval = setInterval(() => {
      this.detectAndCleanZombies().catch(err => {
        logger.error('Zombie cleanup failed', { error: err });
      });
    }, ZombieCleanup.CLEANUP_INTERVAL_MS);
  }

  private async detectAndCleanZombies(): Promise<void> {
    const timeout = setTimeout(() => {
      logger.warn('Zombie cleanup timeout exceeded', {
        timeoutMs: ZombieCleanup.CLEANUP_TIMEOUT_MS
      });
    }, ZombieCleanup.CLEANUP_TIMEOUT_MS);

    try {
      // Get active session PIDs
      const activePIDs = this.sessionManager.getActivePIDs();

      // Find all PTY processes (platform-specific)
      const { stdout } = await execAsync('ps -eo pid,comm | grep pty || true');
      const runningPTYs = this.parsePTYProcesses(stdout);

      // Identify zombies (running but not in active sessions)
      const zombiePIDs = runningPTYs.filter(pid => !activePIDs.includes(pid));

      // Clean zombies
      for (const pid of zombiePIDs) {
        logger.warn('Zombie process detected', { pid });
        try {
          process.kill(pid, 'SIGKILL');
          logger.info('Zombie process cleaned', { pid });
        } catch (err) {
          logger.error('Failed to kill zombie process', { pid, error: err });
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private parsePTYProcesses(psOutput: string): number[] {
    const lines = psOutput.trim().split('\n');
    return lines
      .map(line => {
        const match = line.trim().match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((pid): pid is number => pid !== null);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Zombie cleanup stopped');
    }
  }
}

export const createZombieCleanup = (
  sessionManager: SessionManager
): ZombieCleanup => {
  return new ZombieCleanup(sessionManager);
};
```

**Server Integration**:
```typescript
// backend/src/server.ts
import { createResourceMonitor } from './resourceMonitor';
import { createZombieCleanup } from './zombieCleanup';

// After server starts
const resourceMonitor = createResourceMonitor(wss, sessionManager);
resourceMonitor.startMonitoring();

const zombieCleanup = createZombieCleanup(sessionManager);
zombieCleanup.startCleanup();

// Session creation gate
app.post('/api/sessions', async (req, res) => {
  // Check resource availability
  if (!resourceMonitor.isAcceptingNewSessions) {
    return res.status(503).json({
      error: {
        type: 'resource',
        message: 'Maximum resource capacity reached',
        details: 'Memory usage is at 93%. Cannot create new sessions.',
        suggestion: 'Close idle sessions before creating new ones.'
      }
    });
  }

  // ... existing session creation logic
});

// Shutdown cleanup
process.on('SIGTERM', () => {
  resourceMonitor.stopMonitoring();
  zombieCleanup.stopCleanup();
  shutdownManager.initiate();
});
```

**Frontend Resource Warning Banner**:
```typescript
// frontend/src/components/TopBar.tsx
import { AlertTriangle, X } from 'lucide-react';

interface ResourceWarningProps {
  memoryUsagePercent: number;
  isAcceptingNewSessions: boolean;
  onDismiss: () => void;
}

function ResourceWarningBanner({ memoryUsagePercent, isAcceptingNewSessions, onDismiss }: ResourceWarningProps) {
  const percent = Math.round(memoryUsagePercent);
  const isCritical = !isAcceptingNewSessions;

  return (
    <div className="bg-[#EBCB8B] text-[#2E3440] px-4 py-2 flex items-center gap-2 text-sm">
      <AlertTriangle className="w-4 h-4" />
      <span className="flex-1">
        {isCritical
          ? `Memory critical (${percent}%). Cannot create new sessions until memory is freed.`
          : `High memory usage (${percent}%). Consider closing idle sessions.`}
      </span>
      <button onClick={onDismiss} className="hover:bg-[#D08770]/20 p-1 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

**Testing Considerations:**
- Mock `process.memoryUsage()` to return specific heap values
- Use Jest fake timers for 30s/60s intervals
- Mock WebSocket clients for broadcast testing
- Mock `exec` for zombie process detection
- Test threshold edge cases (86%, 87%, 93%, 94%)
- Integration test with real memory monitoring (no mocks)

**Docker Memory Limit:**
- Recommended: `docker run -m 8g` to set 8GB hard limit
- Container will be OOM-killed by Docker if exceeds 8GB
- 87%/93% thresholds provide buffer before OOM
- Users can adjust thresholds via environment variables (future enhancement)

### Learnings from Previous Story

**From Story 4-7-graceful-container-shutdown-and-cleanup (Status: drafted)**

**Integration Points for This Story:**
- **Winston Logger** will be used for all resource monitoring logs
  - File: `backend/src/utils/logger.ts` (created in Story 4.5)
  - This story uses Winston JSON format with structured metadata
  - Log levels: `info` (monitoring events), `warn` (87% threshold), `error` (93% threshold)

**Patterns to Follow:**
- **Singleton service pattern**: ResourceMonitor follows same pattern as ShutdownManager (Story 4.7)
- **Monitoring interval pattern**: Use `setInterval()` for periodic checks, clear on shutdown
- **WebSocket broadcast pattern**: Iterate `wss.clients` and send JSON messages
- **Cleanup on destroy**: `stopMonitoring()` and `stopCleanup()` methods called on SIGTERM
- **Structured logging**: Include memoryUsagePercent, sessionCount, PID in all log entries

**Dependencies:**
- Story 4.5 creates Winston logger singleton (shared across Epic 4 stories)
- Story 4.7 establishes shutdown sequence pattern (this story integrates into it)
- Story 4.2 creates TopBar component (this story extends with warning banner)

**SessionManager Extensions Needed:**
- **New method**: `getSessionCount()` - return active session count
  - Similar to `getAllActiveSessions()` from Story 4.7
  - Returns integer count instead of array
- **New method**: `getActivePIDs()` - return array of active PTY PIDs
  - Used by ZombieCleanup to identify zombies
  - Returns `number[]` of PIDs

**Files Created in Previous Stories (to be used here):**
- `backend/src/utils/logger.ts` - Winston logger singleton (Story 4.5)
- `backend/src/sessionManager.ts` - Session management (Epic 2, extended in Epic 4)
- `backend/src/shutdownManager.ts` - Graceful shutdown (Story 4.7)

**Shutdown Integration:**
- ResourceMonitor and ZombieCleanup must stop on SIGTERM
- Add `resourceMonitor.stopMonitoring()` to shutdown sequence
- Add `zombieCleanup.stopCleanup()` to shutdown sequence
- Shutdown order: Stop accepting → Stop monitoring → Terminate PTYs → Save state

**Logging Pattern from Story 4.7:**
```typescript
import { logger } from './utils/logger';

// Resource monitoring started
logger.info('Resource monitoring started', {
  checkIntervalMs: 30000,
  memoryLimitBytes: 8589934592
});

// Memory warning
logger.warn('Memory usage high', {
  memoryUsagePercent: 87.5,
  sessionCount: 3,
  memoryUsedBytes: 7516192768
});

// Memory critical
logger.error('Memory critical, blocking new sessions', {
  memoryUsagePercent: 93.2,
  sessionCount: 4,
  memoryUsedBytes: 8005632000
});

// Zombie cleaned
logger.info('Zombie process cleaned', {
  pid: 12345,
  elapsedMs: 234
});
```

**No Direct Code Reuse from Story 4.7:**
- Story 4.7 (shutdown) is complementary, not overlapping
- Both stories integrate into server startup/shutdown lifecycle
- Both use Winston logger with consistent format
- Both follow singleton service pattern

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Services-and-Modules] - resourceMonitor module specification
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - ResourceState interface
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.25-AC4.27 resource requirements
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Non-Functional-Requirements] - NFR-REL-4, NFR-SCALE-2
- [Source: docs/architecture.md#Error-Handling-Strategy] - ErrorResponse format for 503 errors
- [Source: docs/sprint-artifacts/4-7-graceful-container-shutdown-and-cleanup.md#Dev-Notes] - Winston logger integration, singleton pattern

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-7 (Winston logger, singleton pattern, shutdown integration)
- SessionManager extensions identified: `getSessionCount()`, `getActivePIDs()` methods needed
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
