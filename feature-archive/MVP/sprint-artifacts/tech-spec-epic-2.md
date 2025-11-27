# Epic Technical Specification: Multi-Session Parallel Development

Date: 2025-11-24
Author: Kyle
Epic ID: 2
Status: Draft

---

## Overview

Epic 2 implements multi-session parallel development capabilities, enabling developers to work on up to 4 features simultaneously in isolated git worktrees. This epic transforms Claude Container from a single-session terminal interface into a true parallel development platform where multiple Claude CLI instances can run concurrently without interfering with each other.

The core technical challenge is managing state across multiple PTY processes, WebSocket streams, and git worktrees while maintaining isolation between sessions and ensuring graceful recovery from crashes or container restarts. Each session operates independently with its own git branch, worktree directory, PTY process, and WebSocket subscription, allowing Claude to work autonomously on different epics in parallel.

## Objectives and Scope

**In Scope:**
- Session lifecycle management (create, track, destroy) with persistent state across container restarts
- Git worktree creation and management for isolated file system operations per session
- Multi-session UI with tabbed interface and visual status indicators
- WebSocket protocol extension for concurrent PTY streaming to multiple sessions
- Crash isolation ensuring failures in one session don't affect others
- Manual session resume after container restarts
- Resource management optimized for 4 concurrent Claude CLI processes
- Session destruction with optional worktree cleanup

**Out of Scope:**
- Auto-resume on container start (deferred to Epic 4)
- Session merging/conflict resolution (user's responsibility)
- More than 4 concurrent sessions (design constraint per PRD)
- Session history/archiving (not needed for MVP)
- Cross-session communication or shared state

## System Architecture Alignment

Epic 2 extends the foundational architecture from Epic 1 by adding session orchestration layers:

**Backend Components:**
- `sessionManager.ts` - Tracks up to 4 concurrent sessions with metadata (ID, name, status, timestamps, worktree path)
- `worktreeManager.ts` - Creates isolated git worktrees using simple-git library, one per session at `/workspace/.worktrees/<session-id>`
- `ptyManager.ts` (enhanced) - Spawns multiple Claude CLI processes via node-pty, one per session with independent stdio streams
- Session persistence at `/workspace/.claude-container-sessions.json` using atomic write pattern (temp + rename)

**Frontend Components:**
- `SessionList.tsx` - Right sidebar component displaying all sessions with real-time status indicators
- Tabbed interface in top bar for quick session switching (<50ms per NFR-PERF-2)
- Session creation modal with name/branch customization
- Enhanced `useWebSocket` hook supporting session attach/detach protocol

**Architecture Constraints:**
- Design limit: 4 concurrent sessions (per PRD NFR-SCALE-1)
- Each session consumes ~1-2GB RAM (total 4-8GB for full capacity)
- Single WebSocket connection per client with session-multiplexed messages
- Git worktrees stored in `/workspace/.worktrees/` to survive container restarts
- Session state persists in flat JSON file (no database, per Architecture ADR-009)

**Alignment with Architecture Decisions:**
- ADR-004 (ws over Socket.io): Low-level WebSocket control needed for multi-session PTY streaming
- ADR-005 (React Context): SessionContext manages up to 4 sessions without Redux overhead
- ADR-008 (simple-git): Worktree operations via native git CLI wrapper
- ADR-009 (Flat JSON): Session persistence optimized for small session count (4 max)

## Detailed Design

### Services and Modules

| Module | Responsibilities | Inputs | Outputs | Owner/Location |
|--------|------------------|--------|---------|----------------|
| **sessionManager.ts** | Tracks up to 4 sessions, manages session lifecycle (create/destroy), persists state to JSON, validates session names, generates session IDs | Session creation requests (name, branch), session ID for lookups | Session objects, session list, success/error responses | Backend `/backend/src/sessionManager.ts` |
| **worktreeManager.ts** | Creates/removes git worktrees using simple-git, validates branch names, manages worktree directory structure | Session ID, branch name, cleanup flags | Worktree path, git command results, errors | Backend `/backend/src/worktreeManager.ts` |
| **ptyManager.ts** (enhanced) | Spawns Claude CLI PTY processes per session, streams stdin/stdout/stderr, handles process lifecycle, sends SIGINT for interrupts | Session ID, worktree path, terminal input, interrupt signals | PTY output streams, exit codes, process status | Backend `/backend/src/ptyManager.ts` |
| **WebSocket Handler** | Routes messages by session ID, manages session attach/detach subscriptions, multiplexes PTY streams over single connection | Client messages (attach, input, interrupt), PTY output from all sessions | Session-specific terminal output, status updates, errors | Backend `/backend/src/server.ts` |
| **Session Persistence** | Atomic writes to JSON file, reads state on startup, rebuilds from worktrees if corrupted, validates JSON schema | Session state changes, container startup | Persisted session JSON, restored sessions | Backend utility in `sessionManager.ts` |
| **SessionList.tsx** | Displays all sessions with real-time status, handles session selection, shows last activity timestamps, renders attention badges | Sessions array from context, status updates via WebSocket | User session selection events, UI render | Frontend `/frontend/src/components/SessionList.tsx` |
| **SessionTabs.tsx** | Tabbed interface for switching, keyboard shortcuts (Cmd+1-4), close buttons, "+ New Session" tab | Active sessions, selected session ID | Session switch events, create events, destroy confirmation | Frontend `/frontend/src/components/SessionTabs.tsx` |
| **SessionModal.tsx** | Session creation dialog, name/branch input validation, auto-generated name suggestion, error display | User input (name, branch), validation results | Session creation request with validated data | Frontend `/frontend/src/components/SessionModal.tsx` |
| **useWebSocket hook** (enhanced) | Single connection with session multiplexing, handles attach/detach protocol, implements exponential backoff reconnection, message routing | Session IDs to attach, terminal input, connection state | WebSocket connection, send function, connection status | Frontend `/frontend/src/hooks/useWebSocket.ts` |

### Data Models and Contracts

**Session Entity (Authoritative Model)**

```typescript
interface Session {
  id: string;                    // UUID v4, generated by backend
  name: string;                  // User-provided or auto-generated (e.g., "feature-auth", "feature-2025-11-24-001")
  status: SessionStatus;         // Enum: 'active' | 'waiting' | 'idle' | 'error' | 'stopped'
  branch: string;                // Git branch name (e.g., "feature/feature-auth")
  worktreePath: string;          // Absolute path: /workspace/.worktrees/<session-id>
  ptyPid?: number;               // Claude CLI process ID (only if running)
  createdAt: string;             // ISO 8601 UTC timestamp
  lastActivity: string;          // ISO 8601 UTC timestamp (updated on any PTY output)
  currentPhase?: string;         // Optional BMAD phase (e.g., "PRD Creation", "Story Development")
  metadata?: {
    epicName?: string;
    storyId?: string;
  };
}

type SessionStatus = 'active' | 'waiting' | 'idle' | 'error' | 'stopped';

// Status definitions:
// - active: Claude is actively processing (outputting to terminal)
// - waiting: Claude is waiting for user input (prompt detected)
// - idle: Session exists but PTY not running (post-restart, pre-resume)
// - error: PTY process crashed or exited with error
// - stopped: Session terminated by user
```

**Session Persistence JSON Schema**

```json
{
  "version": "1.0",
  "sessions": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "feature-auth",
      "status": "active",
      "branch": "feature/feature-auth",
      "worktreePath": "/workspace/.worktrees/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "ptyPid": 12345,
      "createdAt": "2025-11-24T10:30:00.000Z",
      "lastActivity": "2025-11-24T10:45:00.000Z",
      "currentPhase": "Story Development",
      "metadata": {
        "epicName": "Authentication System"
      }
    }
  ]
}
```

**WebSocket Protocol Extensions for Multi-Session**

```typescript
// Client → Server: Session Management
type ClientSessionMessage =
  | { type: 'session.create', name?: string, branch?: string }
  | { type: 'session.destroy', sessionId: string, cleanup?: boolean }
  | { type: 'session.attach', sessionId: string }       // Subscribe to PTY output
  | { type: 'session.detach', sessionId: string }       // Unsubscribe from PTY output
  | { type: 'session.resume', sessionId: string };      // Spawn PTY for idle session

// Client → Server: Terminal I/O (per session)
type ClientTerminalMessage =
  | { type: 'terminal.input', sessionId: string, data: string }
  | { type: 'terminal.interrupt', sessionId: string }   // Send SIGINT
  | { type: 'terminal.resize', sessionId: string, cols: number, rows: number };

// Server → Client: Session Events
type ServerSessionMessage =
  | { type: 'session.created', session: Session }
  | { type: 'session.destroyed', sessionId: string }
  | { type: 'session.status', sessionId: string, status: SessionStatus, reason?: string }
  | { type: 'session.list', sessions: Session[] };      // Full session list on connect

// Server → Client: Terminal Output (per session)
type ServerTerminalMessage =
  | { type: 'terminal.output', sessionId: string, data: string }
  | { type: 'terminal.exit', sessionId: string, exitCode: number, signal?: string };
```

**REST API Contracts**

```typescript
// POST /api/sessions - Create new session
Request: {
  name?: string;     // Optional, auto-generated if omitted
  branch?: string;   // Optional, derived from name if omitted
}
Response: {
  session: Session;
}
Errors: {
  400: { error: 'Invalid session name', code: 'INVALID_NAME' }
  400: { error: 'Maximum 4 sessions supported', code: 'MAX_SESSIONS' }
  500: { error: 'Git worktree creation failed', code: 'GIT_ERROR', details: string }
}

// DELETE /api/sessions/:id - Destroy session
Query: { cleanup?: 'true' }  // Optional: delete worktree
Response: { success: true }
Errors: {
  404: { error: 'Session not found', code: 'NOT_FOUND' }
  500: { error: 'Worktree cleanup failed', code: 'CLEANUP_ERROR', details: string }
}

// GET /api/sessions - List all sessions
Response: { sessions: Session[] }

// GET /api/sessions/:id - Get single session
Response: { session: Session }
Errors: {
  404: { error: 'Session not found', code: 'NOT_FOUND' }
}
```

### APIs and Interfaces

**SessionManager Public API**

```typescript
class SessionManager {
  constructor(options: { workspaceRoot: string, maxSessions: number });

  // Create new session with optional name/branch
  async createSession(name?: string, branch?: string): Promise<Session>;

  // Destroy session and optionally cleanup worktree
  async destroySession(sessionId: string, cleanup?: boolean): Promise<void>;

  // Get session by ID
  getSession(sessionId: string): Session | undefined;

  // Get all sessions
  getAllSessions(): Session[];

  // Update session status
  updateSessionStatus(sessionId: string, status: SessionStatus): void;

  // Update last activity timestamp
  updateLastActivity(sessionId: string): void;

  // Load sessions from JSON on startup
  async loadSessions(): Promise<void>;

  // Save sessions to JSON (atomic write)
  async saveSessions(): Promise<void>;

  // Rebuild sessions from git worktrees (recovery)
  async rebuildFromWorktrees(): Promise<Session[]>;
}
```

**WorktreeManager Public API**

```typescript
class WorktreeManager {
  constructor(options: { workspaceRoot: string });

  // Create new git worktree on specified branch
  async createWorktree(sessionId: string, branchName: string): Promise<string>;

  // Remove git worktree (cleanup on session destroy)
  async removeWorktree(sessionId: string): Promise<void>;

  // List all worktrees (for recovery)
  async listWorktrees(): Promise<Array<{ path: string, branch: string }>>;

  // Validate branch name (no invalid characters)
  validateBranchName(name: string): boolean;

  // Generate unique branch name from session name
  generateBranchName(sessionName: string): string;
}
```

**PTYManager Public API (Enhanced for Multi-Session)**

```typescript
class PTYManager {
  // Spawn Claude CLI PTY for session
  async spawnPTY(sessionId: string, worktreePath: string): Promise<PTYProcess>;

  // Kill PTY process (graceful SIGTERM, then SIGKILL after 5s)
  async killPTY(sessionId: string): Promise<void>;

  // Send input to PTY stdin
  writeToPTY(sessionId: string, data: string): void;

  // Send SIGINT (Ctrl+C) to PTY
  interruptPTY(sessionId: string): void;

  // Resize PTY terminal
  resizePTY(sessionId: string, cols: number, rows: number): void;

  // Get PTY process by session ID
  getPTY(sessionId: string): PTYProcess | undefined;

  // Register callback for PTY output
  onPTYData(sessionId: string, callback: (data: string) => void): void;

  // Register callback for PTY exit
  onPTYExit(sessionId: string, callback: (exitCode: number, signal?: string) => void): void;
}
```

**Frontend SessionContext API**

```typescript
interface SessionContextValue {
  sessions: Session[];
  activeSessionId: string | null;

  // Actions
  createSession: (name?: string, branch?: string) => Promise<void>;
  destroySession: (sessionId: string, cleanup?: boolean) => Promise<void>;
  selectSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => Promise<void>;

  // Connection status
  isConnected: boolean;
  reconnecting: boolean;
}

// Usage in components
const { sessions, activeSessionId, createSession, selectSession } = useContext(SessionContext);
```

### Workflows and Sequencing

**Workflow 1: Session Creation**

```
User clicks "+ New Session" button
  ↓
SessionModal opens with pre-filled name: "feature-2025-11-24-001"
  ↓
User edits name to "feature-auth" OR accepts default
  ↓
Frontend validates name (alphanumeric + dashes, max 50 chars)
  ↓
Frontend sends: POST /api/sessions { name: "feature-auth" }
  ↓
Backend SessionManager:
  1. Check session count < 4 (MAX_SESSIONS)
  2. Generate session ID (UUID v4)
  3. Derive branch name: "feature/feature-auth"
  ↓
Backend WorktreeManager:
  4. Execute: git worktree add -b feature/feature-auth /workspace/.worktrees/<session-id>
  5. Verify worktree created successfully
  ↓
Backend PTYManager:
  6. Spawn Claude CLI: pty.spawn('claude', [], { cwd: worktreePath })
  7. Register onData and onExit callbacks
  ↓
Backend SessionManager:
  8. Create Session object with status='active'
  9. Add to in-memory registry
  10. Save to /workspace/.claude-container-sessions.json (atomic write)
  ↓
Backend responds: { session: { id, name, status, branch, worktreePath, ... } }
  ↓
Frontend SessionContext updates sessions array
  ↓
Frontend switches to new session tab (selectSession)
  ↓
Frontend sends: { type: 'session.attach', sessionId }
  ↓
Backend routes PTY output to this WebSocket
  ↓
Terminal component displays Claude CLI prompt
  ↓
User types epic assignment, Claude begins work
```

**Workflow 2: Session Switching**

```
User clicks different session tab OR presses Cmd+2
  ↓
Frontend SessionContext.selectSession(sessionId)
  ↓
Active tab UI updates (<50ms, no remount)
  ↓
Terminal component detects activeSessionId change
  ↓
Terminal already attached to session (no re-attach needed)
  ↓
xterm.js instance for that session becomes visible
  ↓
PTY output streams continue uninterrupted
```

**Workflow 3: Session Destruction**

```
User clicks X button on session tab
  ↓
Confirmation dialog appears:
  Title: "Destroy Session?"
  Message: "Session 'feature-auth' will be terminated. Git worktree and branch will remain."
  Checkbox: [x] Delete git worktree
  Buttons: [Cancel] [Destroy]
  ↓
User clicks "Destroy" with checkbox checked
  ↓
Frontend sends: DELETE /api/sessions/:id?cleanup=true
  ↓
Backend PTYManager:
  1. Send SIGTERM to PTY process
  2. Wait 5 seconds for graceful exit
  3. If still running, send SIGKILL
  4. Wait for process.onExit callback
  ↓
Backend SessionManager:
  5. Remove session from in-memory registry
  6. Save updated sessions to JSON (atomic write)
  ↓
Backend WorktreeManager (if cleanup=true):
  7. Execute: git worktree remove /workspace/.worktrees/<session-id>
  8. Verify worktree directory deleted
  9. Branch remains (user responsibility to merge/delete)
  ↓
Backend responds: { success: true }
  ↓
Frontend SessionContext removes session from array
  ↓
Frontend switches to another session (or empty state if last session)
  ↓
Toast notification: "Session 'feature-auth' destroyed"
```

**Workflow 4: WebSocket Reconnection**

```
WebSocket connection drops (network hiccup, backend restart)
  ↓
Frontend useWebSocket detects: ws.onclose event
  ↓
Frontend displays banner: "Connection lost. Reconnecting..."
  ↓
Exponential backoff loop:
  Attempt 1: Wait 1s → try reconnect
  Attempt 2: Wait 2s → try reconnect
  Attempt 3: Wait 4s → try reconnect
  Attempt 4: Wait 8s → try reconnect
  Attempt N: Wait min(2^N, 30)s → try reconnect
  ↓
Reconnection succeeds: ws.onopen event
  ↓
Frontend resets backoff delay to 1s
  ↓
Frontend re-sends session.attach for all active sessions:
  For each session in SessionContext:
    Send: { type: 'session.attach', sessionId }
  ↓
Backend re-subscribes this WebSocket to all PTY streams
  ↓
Frontend updates banner: "Connected" (green, auto-dismiss after 2s)
  ↓
Terminal output resumes streaming
  ↓
If reconnection fails for 5 minutes continuously:
  Frontend shows: "Connection lost. Please refresh page." with [Retry] button
  User clicks Retry → reset backoff, attempt immediate reconnection
```

**Workflow 5: Session Resume After Container Restart**

```
Container stops (docker stop, system reboot, etc.)
  ↓
Sessions JSON persisted at /workspace/.claude-container-sessions.json
PTY processes terminate (process handles lost)
  ↓
Container starts (docker start or new docker run)
  ↓
Backend SessionManager.loadSessions() on startup:
  1. Read /workspace/.claude-container-sessions.json
  2. Parse JSON into Session objects
  3. Set all sessions status='idle' (PTY not running)
  4. Restore to in-memory registry (no PTY processes spawned)
  ↓
Frontend loads, connects via WebSocket
  ↓
Backend sends: { type: 'session.list', sessions: [...] }
  ↓
Frontend SessionContext populates sessions array (all status='idle')
  ↓
Frontend displays sessions in sidebar with "idle" status (blue dot)
  ↓
User clicks session to resume
  ↓
Terminal shows: "Session not running. Click to resume."
  ↓
User clicks "Resume" button
  ↓
Frontend sends: { type: 'session.resume', sessionId }
  ↓
Backend PTYManager.spawnPTY(sessionId, session.worktreePath):
  1. Spawn new Claude CLI process with cwd=worktree
  2. Register output callbacks
  ↓
Backend SessionManager.updateSessionStatus(sessionId, 'active')
  ↓
Backend sends: { type: 'session.status', sessionId, status: 'active' }
  ↓
Frontend updates session status in context
  ↓
Terminal displays Claude CLI prompt in worktree
  ↓
User types: "Analyze what's been done and continue"
  ↓
Claude reads worktree state (git status, file contents) and resumes work
```

**Workflow 6: Crash Isolation**

```
Session 2's PTY process crashes (Claude CLI segfault)
  ↓
Backend PTYManager detects: ptyProcess.onExit({ exitCode: 1, signal: 'SIGSEGV' })
  ↓
Backend logs: "PTY crashed for session-2: exitCode=1, signal=SIGSEGV"
  ↓
Backend SessionManager.updateSessionStatus('session-2', 'error')
  ↓
Backend sends: { type: 'session.status', sessionId: 'session-2', status: 'error', reason: 'Process crashed' }
  ↓
Frontend updates session-2 status in context
  ↓
Frontend displays:
  - Session 2 tab: red error dot
  - Session 2 terminal: "Process exited with code 1. Click to restart."
  ↓
Sessions 1, 3, 4 continue running normally (no impact)
  ↓
User clicks "Restart" in session-2 terminal
  ↓
Frontend sends: { type: 'session.resume', sessionId: 'session-2' }
  ↓
Backend spawns new PTY for session-2 (same worktree)
  ↓
Session 2 resumes, user analyzes state and decides next steps
```

## Non-Functional Requirements

### Performance

**NFR-PERF-2: UI Tab Switching (<50ms)**
- Session tab switching must complete within 50ms from click to visual update
- Implementation: Update activeSessionId in SessionContext only, no component remounting
- Terminal components remain mounted but hidden (display: none) when inactive
- Measured from user click event to tab highlight change

**NFR-PERF-4: Concurrent Session Performance**
- System shall handle 4 concurrent Claude CLI sessions without degradation
- Each session maintains independent terminal latency <100ms
- Terminal output streaming for 4 simultaneous sessions: <100ms latency per session
- No cross-session interference (PTY output correctly routed by sessionId)
- CPU usage distributes across available cores
- Memory target: 1-2GB RAM per session, 4-8GB total for 4 sessions

**NFR-PERF-5: Session Creation (<5 seconds)**
- Session creation (worktree + PTY spawn) completes within 5 seconds
- Breakdown: Git worktree add ~2s, PTY spawn ~1s, JSON write ~100ms
- Loading spinner displayed during creation
- User perceives progress, not blocking

**WebSocket Reconnection Performance**
- Reconnection attempts use exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- Successful reconnection re-attaches all sessions within 1 second
- No terminal output lost during brief disconnects (backend queues up to 1MB per session)

### Security

**NFR-SEC-1: Container Isolation (unchanged from Epic 1)**
- All sessions run within same Docker container sandbox
- Host system protected from destructive commands
- Workspace volume mount intentionally read-write (Claude needs to modify code)

**Session Isolation**
- PTY processes isolated at OS process level (not container level)
- Each session has independent stdio streams
- No shared state between sessions except git repository
- Process crash in one session does not affect others

**Input Validation**
- Session name validation: `/^[a-zA-Z0-9-]{1,50}$/` regex
- Branch name validation: Git-compatible characters only, max 255 chars
- WebSocket message validation: Reject malformed JSON, unknown message types
- Path validation: Worktree paths must be within `/workspace/.worktrees/`

**WebSocket Security**
- Single-user local tool: No authentication required
- Localhost binding only (`ws://localhost:3000`)
- No remote access (not exposed outside host machine)
- Message size limits: Max 1MB per WebSocket message (prevent DOS)

### Reliability/Availability

**NFR-REL-2: Crash Isolation**
- Claude CLI crash in one session shall not affect other sessions
- PTY process crash detected via onExit callback
- Session status updated to 'error', user notified
- Other sessions continue running normally
- Manual restart mechanism provided (user clicks "Restart" button)

**NFR-REL-3: WebSocket Resilience**
- Automatic reconnection with exponential backoff (1s to 30s max)
- Frontend displays "Reconnecting..." banner during disconnection
- On reconnect, frontend re-sends session.attach for all active sessions
- Backend queues output during disconnect (up to 1MB buffer per session)
- After 5 minutes failed reconnection, prompt user to refresh page

**NFR-REL-4: Session State Persistence**
- Session metadata persists across container restarts
- Atomic write pattern (temp file + rename) prevents JSON corruption
- Corrupted JSON triggers rebuild from git worktrees (recovery mechanism)
- All sessions restored on container startup with status='idle'
- PTY processes not persisted (manual resume required)

**NFR-REL-5: Graceful Degradation**
- Session creation failure: Display error, allow retry, other sessions unaffected
- Git worktree creation failure: Show git error message, rollback session creation
- PTY spawn failure: Mark session as error, log details, allow manual retry
- WebSocket disconnect: Auto-reconnect, display status banner, terminal freezes until reconnected
- JSON write failure: Log error, keep in-memory state, retry on next change

**Resource Cleanup**
- PTY processes killed on session destroy (SIGTERM, then SIGKILL after 5s timeout)
- Git worktrees optionally removed (user checkbox in destroy dialog)
- Zombie process detection: Periodic check every 60s, cleanup orphaned PTY processes
- WebSocket connections closed on session destroy

### Observability

**Logging Requirements**

All session lifecycle events logged with winston structured logging:

```typescript
// Session creation
logger.info('Session created', {
  sessionId, name, branch, worktreePath,
  createdAt, timestamp: Date.now()
});

// Session destruction
logger.info('Session destroyed', {
  sessionId, name, cleanup: boolean,
  exitCode?, signal?, timestamp: Date.now()
});

// PTY crash
logger.error('PTY process crashed', {
  sessionId, name, exitCode, signal,
  lastActivity, timestamp: Date.now(), stack: err.stack
});

// Worktree errors
logger.error('Git worktree operation failed', {
  operation: 'create' | 'remove', sessionId, branch,
  error: err.message, gitOutput: stderr
});

// WebSocket events
logger.debug('WebSocket client connected', { clientId, timestamp });
logger.debug('Session attached', { sessionId, clientId });
logger.debug('Session detached', { sessionId, clientId });
logger.warn('WebSocket reconnection attempt', { clientId, attempt: number, delay: ms });
```

**Metrics to Track**

- Active session count (current: 0-4)
- Session creation success/failure rate
- PTY crash count per session
- WebSocket reconnection frequency
- Average session lifetime (created → destroyed)
- Terminal output latency (p50, p95, p99) - future enhancement
- Memory usage per session - future enhancement

**Error Tracking**

- Session creation failures logged with full error details
- Git worktree errors include stderr output from git command
- PTY spawn failures include exit code, signal, and error message
- WebSocket errors include connection ID and error type
- JSON corruption events trigger rebuild and log original corrupted data

**Health Checks**

- Backend startup logs: Session count restored, worktrees scanned
- Periodic zombie process check (every 60s): Log cleaned up orphaned PTYs
- WebSocket connection count: Log when client connects/disconnects
- Session status distribution: Log count by status (active/idle/error/stopped)

## Dependencies and Integrations

### Backend Dependencies

**Production Dependencies:**

```json
{
  "express": "^4.18.0",           // HTTP server and static file serving
  "ws": "^8.14.0",                // WebSocket library for real-time communication
  "node-pty": "^1.0.0",           // PTY process spawning for Claude CLI
  "uuid": "^9.0.0",               // Session ID generation (UUID v4)
  "winston": "^3.11.0"            // Structured logging (JSON format)
}
```

**New Dependencies Required for Epic 2:**

```json
{
  "simple-git": "^3.25.0",        // Git worktree management (wraps git CLI)
  "chokidar": "^4.0.0"            // File system watching (optional for future)
}
```

**Development Dependencies:**

```json
{
  "@types/express": "^4.17.0",
  "@types/node": "^20.10.0",
  "@types/uuid": "^9.0.0",
  "@types/ws": "^8.5.0",
  "typescript": "^5.3.0",
  "ts-node": "^10.9.0",
  "nodemon": "^3.0.0"
}
```

### Frontend Dependencies

**Production Dependencies (already installed from Epic 1):**

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "@xterm/xterm": "^5.5.0",
  "@xterm/addon-fit": "^0.10.0",
  "@xterm/addon-web-links": "^0.11.0",
  "@radix-ui/react-tabs": "^1.1.13",
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-tooltip": "^1.2.8",
  "lucide-react": "^0.554.0",
  "tailwindcss": "^4.1.17",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.4.0"
}
```

**No New Frontend Dependencies Required:**
All necessary components for Epic 2 (tabs, dialogs, tooltips) already included from Epic 1 setup.

### System Dependencies (Docker Container)

**Required in Container (already in Epic 1 Dockerfile):**
- Git (version 2.x+) - For worktree commands (`git worktree add/remove`)
- Node.js 22 LTS - Backend runtime
- build-essential - For native module compilation (node-pty)

**No New System Dependencies Required for Epic 2**

### Integration Points

**Backend ↔ simple-git Library:**
- Interface: simple-git wraps native git CLI commands
- Worktree operations: `git.raw(['worktree', 'add', ...])`
- Error handling: Captures git stderr for user-facing error messages
- Performance: Synchronous blocking calls acceptable (worktree creation ~2s)

**Backend ↔ File System:**
- Session persistence: `/workspace/.claude-container-sessions.json` (atomic writes)
- Worktree location: `/workspace/.worktrees/<session-id>/` (one per session)
- Git repository: `/workspace/.git` (shared across all worktrees)

**Frontend ↔ Backend WebSocket Protocol:**
- Connection: Single persistent WebSocket per client
- Message format: JSON for control messages, sessionId routing
- Protocol extensions: session.create, session.destroy, session.attach, session.detach, session.resume
- Reconnection: Frontend implements exponential backoff, backend queues output

**PTY Processes ↔ Git Worktrees:**
- Each PTY spawned with `cwd` set to its worktree path
- Claude CLI operates exclusively within assigned worktree
- Git operations (commit, push, etc.) scoped to worktree branch
- Isolation: Changes in one worktree don't affect others

**Session Manager ↔ PTY Manager ↔ Worktree Manager:**
- Session creation flow: SessionManager → WorktreeManager → PTYManager
- Session destruction flow: SessionManager → PTYManager → WorktreeManager (optional cleanup)
- Status updates: PTYManager notifies SessionManager of crashes/exits
- Dependency: Session can only be created after successful worktree creation

### Version Constraints

- **Node.js**: 20.x+ LTS (for native fs.promises, top-level await)
- **Git**: 2.5+ (for git worktree command support)
- **TypeScript**: 5.3+ (for modern type inference, satisfies operator)
- **React**: 19.x (for concurrent rendering, automatic batching)
- **simple-git**: 3.25+ (for stable worktree API)

## Acceptance Criteria (Authoritative)

These acceptance criteria are derived from all 12 stories in Epic 2 and define when the epic is complete:

**AC-1: Session Management**
- GIVEN the backend is running
- WHEN a user creates a new session with name "feature-auth"
- THEN a Session object is created with UUID, status='active', branch='feature/feature-auth', worktree path, and timestamps
- AND the session is persisted to `/workspace/.claude-container-sessions.json` using atomic write
- AND when the container restarts, all sessions are restored with status='idle'

**AC-2: Git Worktree Isolation**
- GIVEN a session is created
- WHEN the backend executes `git worktree add -b feature/feature-auth /workspace/.worktrees/<session-id>`
- THEN a new worktree directory is created with complete repository copy
- AND the PTY process spawns with `cwd` set to the worktree path
- AND Claude operates exclusively within that worktree (verified by `pwd` output)

**AC-3: Multi-Session UI**
- GIVEN 3 sessions exist
- WHEN the UI loads
- THEN the top bar displays tabs for each session with names and status indicators
- AND the right sidebar displays session list with last activity timestamps
- AND clicking a tab switches the terminal view within 50ms (NFR-PERF-2)
- AND the active tab shows visual highlight (bottom border)

**AC-4: Session Creation Flow**
- GIVEN the user clicks "+ New Session" button
- WHEN the modal opens with pre-filled name "feature-2025-11-24-001"
- AND the user edits to "feature-auth" and clicks "Create"
- THEN the backend creates worktree, spawns PTY, and returns session within 5 seconds
- AND the new tab appears in UI
- AND the terminal displays Claude CLI prompt

**AC-5: Session Destruction**
- GIVEN a session exists with name "feature-auth"
- WHEN the user clicks X on the tab
- THEN a confirmation dialog appears with "Delete git worktree" checkbox
- AND when user clicks "Destroy" with checkbox checked
- THEN the PTY receives SIGTERM, worktree is removed, session disappears from UI
- AND the branch remains (user can merge manually)

**AC-6: Concurrent Session Isolation**
- GIVEN 4 sessions are running simultaneously
- WHEN Session 2's PTY crashes
- THEN Session 2 status updates to 'error' and displays "Process exited. Click to restart."
- AND Sessions 1, 3, 4 continue running without interruption
- AND terminal output for each session routes correctly (no cross-contamination)

**AC-7: WebSocket Multiplexing**
- GIVEN a single WebSocket connection
- WHEN the frontend sends `session.attach` for sessions 1, 2, 3
- THEN the backend subscribes this WebSocket to all 3 PTY streams
- AND when PTY 1 outputs "Hello", only Terminal 1 receives the data
- AND all 4 concurrent sessions maintain <100ms terminal latency (NFR-PERF-4)

**AC-8: WebSocket Reconnection**
- GIVEN the WebSocket connection drops
- WHEN the frontend detects disconnect
- THEN a "Reconnecting..." banner displays
- AND exponential backoff retries occur (1s, 2s, 4s, 8s, max 30s)
- AND when reconnected, the frontend re-attaches all sessions
- AND terminal output resumes without data loss

**AC-9: Session Resume**
- GIVEN 3 sessions exist and the container restarts
- WHEN the backend loads `/workspace/.claude-container-sessions.json`
- THEN all 3 sessions restore with status='idle' (PTY not running)
- AND the UI displays sessions with blue "idle" dot
- AND when the user clicks "Resume" on session-2
- THEN a new PTY spawns in session-2's worktree
- AND Claude CLI loads with previous files intact

**AC-10: Resource Management**
- GIVEN 4 sessions are active
- WHEN all 4 are streaming terminal output simultaneously
- THEN each terminal maintains <100ms latency
- AND total container memory is 4-8GB (1-2GB per session)
- AND when a 5th session is attempted
- THEN the frontend shows error: "Maximum 4 sessions supported"

**AC-11: Validation with Parallel BMAD Workflows**
- GIVEN 4 sessions running different BMAD workflows concurrently
- WHEN Session 1 runs brainstorming, Session 2 runs PRD, Session 3 runs UX design, Session 4 runs development
- THEN all 4 terminals show real-time output
- AND switching between sessions is instant (<50ms)
- AND git worktrees remain isolated (files in one don't appear in others)
- AND when Session 2 asks a question, only Session 2 shows "!" badge

**AC-12: Session Persistence Integrity**
- GIVEN 3 sessions with work in progress
- WHEN the container stops unexpectedly (kill -9, power loss)
- THEN `/workspace/.claude-container-sessions.json` remains uncorrupted (atomic writes)
- AND on restart, all 3 sessions restore from JSON
- AND if JSON is corrupted, the backend rebuilds sessions from git worktrees

## Traceability Mapping

| Acceptance Criteria | Epic Story | Component/API | Test Plan | FR Coverage |
|---------------------|-----------|---------------|-----------|-------------|
| AC-1: Session Management | Story 2.1 | sessionManager.ts, POST /api/sessions | Unit: SessionManager.createSession()<br>Integration: Session creation API | FR8, FR10, FR11, FR62 |
| AC-2: Git Worktree Isolation | Story 2.2 | worktreeManager.ts, simple-git | Unit: WorktreeManager.createWorktree()<br>Integration: PTY spawn with cwd | FR16, FR17, FR18, FR19 |
| AC-3: Multi-Session UI | Story 2.4, 2.5 | SessionList.tsx, SessionTabs.tsx | E2E: Create 3 sessions, verify tabs<br>Unit: Tab switching <50ms | FR29, FR30, FR31, FR32, FR33 |
| AC-4: Session Creation Flow | Story 2.3 | SessionModal.tsx, POST /api/sessions | E2E: Modal → Create → Tab appears<br>Integration: Worktree + PTY + JSON | FR8, FR9, FR13 |
| AC-5: Session Destruction | Story 2.7 | DELETE /api/sessions/:id, WorktreeManager | Integration: SIGTERM → worktree cleanup<br>Unit: Graceful PTY shutdown | FR14, FR15, FR20, FR71 |
| AC-6: Concurrent Session Isolation | Story 2.9 | PTYManager.onExit, Session status updates | Integration: Crash 1 session, verify others OK<br>E2E: 4 parallel sessions | FR57, FR64, FR67 |
| AC-7: WebSocket Multiplexing | Story 2.6 | WebSocket handler, session.attach protocol | Integration: Single WS, 3 sessions attached<br>Unit: Message routing by sessionId | FR56, FR57 |
| AC-8: WebSocket Reconnection | Story 2.8 | useWebSocket hook, exponential backoff | Integration: Disconnect → reconnect → resume<br>Unit: Backoff timing (1s, 2s, 4s, 8s) | FR65, NFR-REL-3 |
| AC-9: Session Resume | Story 2.10 | sessionManager.loadSessions(), session.resume | Integration: Restart container → restore sessions<br>E2E: Resume session, verify worktree intact | FR11, FR12, FR66, FR67 |
| AC-10: Resource Management | Story 2.11 | MAX_SESSIONS=4, session count check | E2E: 4 concurrent sessions, verify latency<br>Integration: 5th session blocked | FR69, FR72, NFR-SCALE-1 |
| AC-11: Validation | Story 2.12 | Full system integration | E2E: 4 parallel BMAD workflows<br>Stress test: Concurrent terminal output | FR57, FR64, NFR-PERF-4 |
| AC-12: Persistence Integrity | Story 2.1 | Atomic write (temp + rename), JSON validation | Integration: Kill container, verify JSON intact<br>Unit: Corrupted JSON → rebuild from worktrees | FR60, FR61, FR62, NFR-REL-4 |

## Risks, Assumptions, Open Questions

### Risks

**RISK-1: Concurrent Git Operations on Shared .git**
- **Description:** Multiple sessions (worktrees) share `.git` directory. Simultaneous git operations could cause race conditions or index lock conflicts.
- **Likelihood:** Medium (git uses lockfiles, but edge cases exist)
- **Impact:** High (corrupted repository would affect all sessions)
- **Mitigation:**
  - Test concurrent git operations thoroughly (4 sessions committing simultaneously)
  - Git's internal locking should prevent corruption
  - If issues arise, implement queue for git write operations
  - Document recommended workflow: avoid simultaneous commits across sessions

**RISK-2: WebSocket Buffer Overflow**
- **Description:** Claude generates massive terminal output (e.g., `npm install` with 10,000 packages), faster than WebSocket can transmit.
- **Likelihood:** Low (Claude output typically moderate)
- **Impact:** Medium (terminal freezes, user must restart session)
- **Mitigation:**
  - Implement backpressure: Pause PTY reads if WebSocket send buffer >1MB
  - Queue mechanism: Buffer up to 1MB per session, drop oldest data if exceeded
  - Add terminal output throttling option (user configurable)
  - Log warning if buffer approaches limit

**RISK-3: Worktree Cleanup Failures**
- **Description:** User destroys session with cleanup=true, but worktree removal fails (uncommitted changes, file locks).
- **Likelihood:** Medium (common edge case)
- **Impact:** Low (orphaned worktree, user can cleanup manually)
- **Mitigation:**
  - Catch git worktree remove errors, log details, notify user
  - Provide manual cleanup command in error message
  - Document worktree cleanup in troubleshooting guide
  - Optional: UI button to list/cleanup orphaned worktrees

**RISK-4: Session Limit Frustration**
- **Description:** 4-session limit too restrictive for some users, blocks workflow.
- **Likelihood:** Low (4 validated as cognitive limit)
- **Impact:** Medium (user complaints, feature requests)
- **Mitigation:**
  - Document 4-session limit clearly in UI and docs
  - Error message suggests destroying idle sessions
  - Monitor user feedback post-launch
  - If needed, make limit configurable in future (not MVP)

**RISK-5: PTY Zombie Processes**
- **Description:** PTY process crashes without cleanup, leaks memory/CPU.
- **Likelihood:** Low (onExit callbacks should catch all cases)
- **Impact:** Medium (resource exhaustion over time)
- **Mitigation:**
  - Periodic zombie process check (every 60s)
  - Log and kill orphaned PTY processes
  - Track PTY PIDs, cross-reference with session registry
  - Validate cleanup in integration tests

### Assumptions

**ASSUME-1: Single WebSocket Connection Sufficient**
- **Assumption:** One WebSocket connection per client can handle 4 concurrent session streams without performance degradation.
- **Basis:** Each session outputs ~10KB/s terminal data max, total 40KB/s well within WebSocket bandwidth (~1MB/s+).
- **Validation:** Stress test with 4 sessions generating high-volume output simultaneously.
- **If Wrong:** Switch to 1 WebSocket per session (protocol change required).

**ASSUME-2: Manual Resume Acceptable for MVP**
- **Assumption:** Users accept manual session resume after container restart (no auto-resume in Sprint 2).
- **Basis:** PRD explicitly scopes auto-resume to Sprint 4 ("Future enhancement").
- **Validation:** User feedback after Sprint 2 deployment.
- **If Wrong:** Prioritize auto-resume in Sprint 3 (before Sprint 4).

**ASSUME-3: 5-Second Session Creation Acceptable**
- **Assumption:** 5-second delay for session creation (worktree + PTY spawn) is acceptable UX.
- **Basis:** User expects delay for "heavy" operation, loading spinner provides feedback.
- **Validation:** Monitor user feedback, measure actual creation times.
- **If Wrong:** Optimize worktree creation (shallow clone alternatives), pre-spawn PTY pool.

**ASSUME-4: JSON File Scales to 100 Sessions**
- **Assumption:** Flat JSON file performs adequately even if session count exceeds 4 (future growth).
- **Basis:** JSON parse/stringify for 100 sessions <10ms, acceptable for non-critical path.
- **Validation:** Benchmark JSON operations with 100 mock sessions.
- **If Wrong:** Migrate to SQLite in future (architecture supports this).

**ASSUME-5: Git Worktrees Don't Leak Disk Space**
- **Assumption:** Users will cleanup old worktrees (manually or via destroy dialog), preventing disk bloat.
- **Basis:** Worktree cleanup optional but encouraged, user responsible for disk management.
- **Validation:** Monitor worktree directory size in testing.
- **If Wrong:** Implement auto-cleanup for stale worktrees (>7 days unused).

### Open Questions

**Q-1: Session Naming Collisions**
- **Question:** What happens if user creates "feature-auth" twice (e.g., destroys session, then recreates with same name)?
- **Options:**
  - A) Allow duplicate names (sessionId still unique)
  - B) Block duplicate names (validation error)
  - C) Auto-increment name ("feature-auth-2")
- **Decision Needed:** Sprint 2 Story 2.3 (Session Creation Modal)
- **Recommendation:** Option A (allow duplicates, sessionId is unique identifier). Name is display-only.

**Q-2: WebSocket Message Ordering Guarantees**
- **Question:** Does terminal output need strict ordering across sessions?
- **Answer:** Yes within a session, no across sessions. WebSocket guarantees order per connection.
- **Implications:** Current design (single WebSocket) maintains per-session ordering automatically.
- **No Action Required:** Architecture already correct.

**Q-3: Session Resume Error Handling**
- **Question:** What if PTY spawn fails during resume (Claude CLI not found, permissions issue)?
- **Options:**
  - A) Mark session as 'error', display error message, allow retry
  - B) Delete session from registry (assume unrecoverable)
  - C) Prompt user to fix issue (reinstall Claude, fix permissions)
- **Decision Needed:** Sprint 2 Story 2.10 (Session Resume)
- **Recommendation:** Option A (error state + retry). Don't delete session data.

**Q-4: Container Restart During Active Work**
- **Question:** If container crashes mid-commit, can git worktrees become corrupted?
- **Answer:** Git's internal fsync guarantees prevent corruption. Worst case: uncommitted changes lost, but repository intact.
- **Implications:** No special handling needed. Git already handles this.
- **Action:** Document in troubleshooting guide.

**Q-5: Cross-Session Git Conflicts**
- **Question:** If two sessions modify the same file on different branches, can merging later cause data loss?
- **Answer:** Standard git merge conflict resolution applies. User responsibility to resolve.
- **Implications:** Not a system issue, user workflow issue. Document best practices.
- **Action:** Add to README: "Worktrees should work on different features to minimize conflicts."

## Test Strategy Summary

### Unit Tests (Backend)

**sessionManager.ts:**
- `createSession()` with valid name → returns Session object
- `createSession()` with invalid name → throws validation error
- `createSession()` when count=4 → throws MAX_SESSIONS error
- `destroySession()` removes session from registry
- `saveSessions()` uses atomic write (temp + rename)
- `loadSessions()` reads JSON and restores sessions
- `loadSessions()` with corrupted JSON → rebuilds from worktrees

**worktreeManager.ts:**
- `createWorktree()` executes `git worktree add` with correct args
- `createWorktree()` with existing branch → handles git error gracefully
- `removeWorktree()` executes `git worktree remove`
- `removeWorktree()` with uncommitted changes → catches and logs error
- `validateBranchName()` accepts valid git branch names
- `validateBranchName()` rejects invalid characters

**ptyManager.ts:**
- `spawnPTY()` creates PTY process with correct cwd
- `killPTY()` sends SIGTERM, then SIGKILL after 5s timeout
- `onPTYExit()` callback fires when PTY crashes
- `writeToPTY()` sends data to PTY stdin
- `interruptPTY()` sends SIGINT signal

### Unit Tests (Frontend)

**SessionList.tsx:**
- Renders all sessions from SessionContext
- Displays status dots with correct colors (active=green, error=red, etc.)
- Shows last activity timestamp in "5m ago" format
- Clicking session triggers selectSession() callback

**SessionTabs.tsx:**
- Renders tabs for all sessions
- Active tab shows highlight (bottom border)
- Clicking tab calls selectSession()
- Keyboard shortcuts Cmd+1-4 select sessions 1-4
- Close button (X) triggers destroy confirmation dialog

**useWebSocket.ts hook:**
- Connects to WebSocket on mount
- Implements exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Reconnection success resets backoff delay
- send() function sends JSON messages
- Receives messages and routes by sessionId

### Integration Tests

**Session Creation End-to-End:**
1. POST /api/sessions { name: "test-session" }
2. Verify worktree created at /workspace/.worktrees/<id>
3. Verify PTY spawned with cwd=worktree
4. Verify session saved to JSON
5. Verify WebSocket receives session.created message

**Session Destruction End-to-End:**
1. Create session
2. DELETE /api/sessions/:id?cleanup=true
3. Verify PTY receives SIGTERM
4. Verify worktree removed
5. Verify session removed from JSON

**WebSocket Protocol:**
1. Connect WebSocket
2. Send session.attach for 3 sessions
3. Verify backend routes PTY output correctly
4. Send terminal.input, verify PTY receives
5. Disconnect WebSocket, verify reconnection with backoff

**Container Restart:**
1. Create 3 sessions
2. Stop container (docker stop)
3. Start container (docker start)
4. Verify sessions restored with status='idle'
5. Resume session, verify PTY spawns in correct worktree

### End-to-End Tests (Playwright)

**E2E-1: Multi-Session Creation and Switching**
1. Open UI in browser
2. Click "+ New Session" → create "session-1"
3. Click "+ New Session" → create "session-2"
4. Click "+ New Session" → create "session-3"
5. Verify 3 tabs visible
6. Click session-2 tab → verify terminal switches <50ms
7. Press Cmd+1 → verify session-1 activates

**E2E-2: Concurrent Terminal Output**
1. Create 4 sessions
2. Type `echo "Session 1"` in session-1
3. Type `echo "Session 2"` in session-2
4. Type `echo "Session 3"` in session-3
5. Type `echo "Session 4"` in session-4
6. Verify each terminal shows correct output
7. Verify no cross-contamination

**E2E-3: Session Crash and Isolation**
1. Create 3 sessions
2. Force crash session-2 (kill PTY process)
3. Verify session-2 shows red error dot
4. Verify sessions 1 and 3 still running
5. Click "Restart" in session-2
6. Verify session-2 PTY respawns

**E2E-4: Session Resume After Restart**
1. Create 2 sessions, write files in worktrees
2. Stop container
3. Start container
4. Verify 2 sessions show status='idle'
5. Click session-1 → click "Resume"
6. Verify PTY spawns, files still present in worktree

**E2E-5: Session Destruction with Cleanup**
1. Create session "test-cleanup"
2. Verify worktree exists
3. Click X on tab → check "Delete git worktree" → click "Destroy"
4. Verify tab disappears
5. Verify worktree directory deleted
6. Verify branch still exists (git branch -a)

### Performance Tests

**PERF-1: Tab Switching Latency**
- Create 4 sessions
- Measure time from click event to tab highlight change
- Assert: p99 latency <50ms (NFR-PERF-2)

**PERF-2: Concurrent Session Streaming**
- Create 4 sessions
- Generate high-volume output in all 4 simultaneously (cat large file)
- Measure terminal latency for each session
- Assert: All sessions maintain <100ms latency (NFR-PERF-4)

**PERF-3: Session Creation Time**
- Create session with timer
- Measure total time from API call to PTY ready
- Assert: p95 creation time <5 seconds (NFR-PERF-5)

### Test Coverage Targets

- Backend critical paths (SessionManager, WorktreeManager, PTYManager): 70%+
- Frontend components (SessionList, SessionTabs, useWebSocket): 50%+
- Integration tests: Cover all 6 workflows documented in "Workflows and Sequencing"
- E2E tests: 5 critical flows (creation, switching, crash, resume, destroy)
