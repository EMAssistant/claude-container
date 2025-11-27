# API Documentation

**Version:** 1.0
**Last Updated:** 2025-11-26

Claude Container provides REST and WebSocket APIs for session management, terminal streaming, workflow tracking, and document serving.

## REST API

### Base URL

```
http://localhost:3000/api
```

### Session Management

#### GET /api/sessions

List all sessions.

**Request:** None

**Response:**
```typescript
{
  sessions: Session[]
}

interface Session {
  id: string;              // UUID v4
  name: string;            // User-defined or auto-generated
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  branch: string;          // Git branch name
  worktreePath: string;    // Absolute path
  ptyPid?: number;         // PTY process ID (if running)
  createdAt: string;       // ISO 8601 UTC
  lastActivity: string;    // ISO 8601 UTC
  currentPhase?: string;   // BMAD workflow phase (optional)
  metadata?: {
    epicName?: string;
    storyProgress?: { completed: number; total: number };
    stuckSince?: string;    // ISO 8601 (if stuck)
    lastWarning?: string;   // ISO 8601 (last warning sent)
  };
}
```

**Example:**
```bash
curl http://localhost:3000/api/sessions
```

**Example Response:**
```json
{
  "sessions": [
    {
      "id": "abc123-def456",
      "name": "feature-auth",
      "status": "active",
      "branch": "feature/feature-auth",
      "worktreePath": "/workspace/.worktrees/abc123-def456",
      "ptyPid": 12345,
      "createdAt": "2025-11-25T10:00:00.000Z",
      "lastActivity": "2025-11-25T10:05:00.000Z",
      "currentPhase": "prd",
      "metadata": {
        "epicName": "Epic 1: Foundation",
        "storyProgress": { "completed": 3, "total": 10 }
      }
    }
  ]
}
```

---

#### POST /api/sessions

Create a new session.

**Request Body:**
```typescript
{
  name?: string,           // Optional session name (alphanumeric + dashes, max 50 chars)
  branch?: string          // Optional branch name (defaults to feature/<session-name>)
}
```

**Response:**
```typescript
{
  session: Session
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "feature-auth", "branch": "feature/auth-implementation"}'
```

**Example Response:**
```json
{
  "session": {
    "id": "abc123-def456",
    "name": "feature-auth",
    "status": "active",
    "branch": "feature/auth-implementation",
    "worktreePath": "/workspace/.worktrees/abc123-def456",
    "ptyPid": 12345,
    "createdAt": "2025-11-25T10:00:00.000Z",
    "lastActivity": "2025-11-25T10:00:00.000Z"
  }
}
```

**Validation:**
- Session name: Alphanumeric + dashes, max 50 characters
- Max 4 concurrent sessions (returns 503 if limit exceeded)
- Branch must not already have a worktree (returns 409 if exists)

---

#### DELETE /api/sessions/:id

Destroy a session.

**Request:** None

**Query Parameters:**
- `deleteWorktree` (optional): `true` | `false` - Delete git worktree (default: false)

**Response:**
```typescript
{
  success: true
}
```

**Example:**
```bash
# Destroy session, keep worktree
curl -X DELETE http://localhost:3000/api/sessions/abc123-def456

# Destroy session and delete worktree
curl -X DELETE "http://localhost:3000/api/sessions/abc123-def456?deleteWorktree=true"
```

**Example Response:**
```json
{
  "success": true
}
```

**Behavior:**
- Sends SIGTERM to PTY process (5s timeout, then SIGKILL)
- Removes session from registry
- Optionally deletes git worktree
- Broadcasts `session.destroyed` WebSocket message

---

#### GET /api/sessions/:id/status

Get session status.

**Request:** None

**Response:**
```typescript
{
  session: Session
}
```

**Example:**
```bash
curl http://localhost:3000/api/sessions/abc123-def456/status
```

**Example Response:**
```json
{
  "session": {
    "id": "abc123-def456",
    "name": "feature-auth",
    "status": "idle",
    "lastActivity": "2025-11-25T09:55:00.000Z"
  }
}
```

---

### Workflow & Documents

#### GET /api/workflow/status

Get BMAD workflow status for active session.

**Request:** None

**Query Parameters:**
- `sessionId` (optional): Session UUID (defaults to most recently active session)

**Response:**
```typescript
{
  sessionId: string,
  workflow: {
    currentStep: string,      // e.g., "prd"
    completedSteps: string[], // e.g., ["brainstorming", "product_brief"]
    steps: Array<{
      name: string,
      status: 'completed' | 'in_progress' | 'pending',
      displayName?: string
    }>
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/workflow/status?sessionId=abc123-def456
```

**Example Response:**
```json
{
  "sessionId": "abc123-def456",
  "workflow": {
    "currentStep": "prd",
    "completedSteps": ["brainstorming", "product_brief"],
    "steps": [
      { "name": "brainstorming", "status": "completed", "displayName": "Brainstorming" },
      { "name": "product_brief", "status": "completed", "displayName": "Product Brief" },
      { "name": "prd", "status": "in_progress", "displayName": "PRD" },
      { "name": "architecture", "status": "pending", "displayName": "Architecture" }
    ]
  }
}
```

---

#### POST /api/bmad/update

Trigger BMAD workflow status refresh (force re-parse YAML files).

**Request:** None

**Response:**
```typescript
{
  success: true,
  message: string
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/bmad/update
```

**Example Response:**
```json
{
  "success": true,
  "message": "BMAD workflow status updated"
}
```

**Behavior:**
- Re-parses `.bmad/bmm/status/*.yaml` files
- Broadcasts `workflow.updated` WebSocket message to all clients

---

#### GET /api/documents/:path

Serve workspace file.

**Request:** None

**Path Parameters:**
- `:path` - Relative path to file within workspace (e.g., `docs/prd.md`)

**Response:** File content (Content-Type based on file extension)

**Example:**
```bash
curl http://localhost:3000/api/documents/docs/prd.md
```

**Example Response:**
```markdown
# Product Requirements Document

## Overview
...
```

**Security:**
- Path traversal validation: All paths must resolve within `/workspace/`
- Returns 404 if file not found
- Returns 403 if path traversal attempt detected

---

#### GET /api/documents/tree

Get file tree structure for workspace.

**Request:** None

**Response:**
```typescript
{
  tree: FileNode[]
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];  // Only for directories
}
```

**Example:**
```bash
curl http://localhost:3000/api/documents/tree
```

**Example Response:**
```json
{
  "tree": [
    {
      "name": "docs",
      "path": "/workspace/docs",
      "type": "directory",
      "children": [
        { "name": "prd.md", "path": "/workspace/docs/prd.md", "type": "file" },
        { "name": "architecture.md", "path": "/workspace/docs/architecture.md", "type": "file" }
      ]
    },
    {
      "name": "README.md",
      "path": "/workspace/README.md",
      "type": "file"
    }
  ]
}
```

**Ignored paths:**
- `node_modules/`
- `.git/`
- `.worktrees/`
- `.bmad/` (except YAML status files)

---

### Health & Metrics

#### GET /api/health

Health check endpoint.

**Request:** None

**Response:**
```typescript
{
  status: 'ok' | 'degraded' | 'error',
  uptime: number,              // Seconds since container start
  sessions: number,            // Number of active sessions
  memory: string,              // Memory usage percentage (e.g., "45%")
  timestamp: string            // ISO 8601
}
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

**Example Response:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "sessions": 2,
  "memory": "45%",
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

**Status meanings:**
- `ok` - All systems operational, memory <87%
- `degraded` - Memory >87%, still accepting sessions
- `error` - Memory >93%, not accepting new sessions

---

#### GET /api/metrics

Performance metrics (from Story 4.10).

**Request:** None

**Response:**
```typescript
{
  terminalLatency: {
    p50: number,    // ms
    p95: number,    // ms
    p99: number     // ms
  },
  sessionCreationTime: {
    p50: number,    // ms
    p95: number,    // ms
    p99: number     // ms
  },
  tabSwitchTime: {
    p50: number,    // ms
    p95: number,    // ms
    p99: number     // ms
  },
  bundleSize: number,    // bytes (gzipped)
  timestamp: string      // ISO 8601
}
```

**Example:**
```bash
curl http://localhost:3000/api/metrics
```

**Example Response:**
```json
{
  "terminalLatency": {
    "p50": 35,
    "p95": 78,
    "p99": 95
  },
  "sessionCreationTime": {
    "p50": 2100,
    "p95": 3500,
    "p99": 4800
  },
  "tabSwitchTime": {
    "p50": 28,
    "p95": 42,
    "p99": 48
  },
  "bundleSize": 412345,
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

---

## Error Response Format

All endpoints return errors in this standardized format (from Story 4.5):

```typescript
{
  error: {
    type: 'validation' | 'git' | 'pty' | 'resource' | 'internal',
    message: string,           // User-friendly error message
    details?: string,          // Technical details (optional)
    suggestion?: string,       // How to fix (optional)
    code?: string              // Machine-readable error code (optional)
  }
}
```

### Error Types

#### Validation Errors (400 Bad Request)

**Example: Invalid session name**
```json
{
  "error": {
    "type": "validation",
    "message": "Invalid session name",
    "details": "Session names must be alphanumeric with dashes only (max 50 characters).",
    "suggestion": "Example: 'feature-auth'"
  }
}
```

**Example: Missing required field**
```json
{
  "error": {
    "type": "validation",
    "message": "Missing required field: name",
    "suggestion": "Provide a session name in the request body"
  }
}
```

---

#### Git Errors (409 Conflict)

**Example: Branch already exists**
```json
{
  "error": {
    "type": "git",
    "message": "Branch already exists",
    "details": "A worktree already exists for branch 'feature/feature-auth'.",
    "suggestion": "Choose a different branch name or delete the existing worktree.",
    "code": "BRANCH_EXISTS"
  }
}
```

**Example: Worktree creation failed**
```json
{
  "error": {
    "type": "git",
    "message": "Failed to create git worktree",
    "details": "Git command failed: fatal: 'feature/auth' is already checked out at '/workspace/.worktrees/abc123'",
    "suggestion": "Ensure the branch name is unique and not already checked out"
  }
}
```

---

#### PTY Errors (500 Internal Server Error)

**Example: PTY spawn failure**
```json
{
  "error": {
    "type": "pty",
    "message": "Failed to start Claude CLI",
    "details": "PTY spawn error: ENOENT (command not found)",
    "suggestion": "Ensure Claude CLI is installed and in PATH",
    "code": "PTY_SPAWN_FAILED"
  }
}
```

---

#### Resource Errors (503 Service Unavailable)

**Example: Session limit reached**
```json
{
  "error": {
    "type": "resource",
    "message": "Maximum session capacity reached",
    "details": "Cannot create new session. 4 sessions are already active (design limit).",
    "suggestion": "Close or destroy existing sessions before creating new ones.",
    "code": "SESSION_LIMIT_REACHED"
  }
}
```

**Example: High memory usage**
```json
{
  "error": {
    "type": "resource",
    "message": "Maximum resource capacity reached",
    "details": "Memory usage is at 93%. Cannot create new sessions.",
    "suggestion": "Close idle sessions before creating new ones.",
    "code": "MEMORY_CRITICAL"
  }
}
```

---

#### Internal Errors (500 Internal Server Error)

**Example: Generic server error**
```json
{
  "error": {
    "type": "internal",
    "message": "Internal server error",
    "details": "Unexpected error occurred while processing request",
    "suggestion": "Check container logs: docker logs claude-container"
  }
}
```

---

## WebSocket API

For real-time terminal streaming and status updates, Claude Container uses WebSocket protocol.

**WebSocket URL:** `ws://localhost:3000`

See **[WebSocket Protocol Documentation](./websocket-protocol.md)** for complete protocol specification, including:
- Connection lifecycle
- Client → Server messages (terminal.input, session.attach, etc.)
- Server → Client messages (terminal.output, session.status, workflow.updated, etc.)
- Epic 4 message types (session.warning, session.needsInput, resource.warning, server.shutdown)
- Message ordering and reliability guarantees
- Reconnection patterns

---

## Rate Limiting

Claude Container does not implement explicit rate limiting for REST endpoints. Rate limiting is implicit via:
- Max 4 concurrent sessions (enforced by resource monitoring)
- PTY output rate (limited by Claude CLI and terminal buffer)
- File watcher debouncing (500ms batch window)

WebSocket messages are not rate-limited, but backpressure handling prevents buffer overflow.

---

## Authentication

Claude Container does not require authentication for API access. Security is provided by:
- **Container isolation** - Docker container sandbox
- **Localhost binding** - Server binds to `0.0.0.0:3000` in container, exposed as `127.0.0.1:3000` on host
- **Single-user assumption** - Designed for local development (not multi-tenant)

For production deployment with remote access, add authentication layer (OAuth, JWT, etc.) - out of scope for current implementation.

---

## CORS Policy

Claude Container serves frontend static assets and API from the same origin (http://localhost:3000), so CORS is not required.

If accessing API from a different origin (e.g., separate frontend dev server), CORS headers must be added:

```typescript
// backend/src/server.ts
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');  // Vite dev server
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```

---

## API Versioning

Current API version: **v1.0**

API versioning strategy:
- No version prefix in URL (current implementation)
- Breaking changes will add `/v2/` prefix to affected endpoints
- Backward compatibility maintained for existing endpoints when possible

---

## Related Documentation

- **[WebSocket Protocol](./websocket-protocol.md)** - Real-time messaging protocol
- **[Architecture](./architecture.md)** - System architecture and backend design
- **[Troubleshooting](./troubleshooting.md)** - Common API errors and solutions
- **[Testing Guide](./testing.md)** - API testing examples

---

**Last Updated:** 2025-11-26
**Story:** 4.12 - Documentation and README
