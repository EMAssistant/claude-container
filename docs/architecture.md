# Architecture

## Executive Summary

Claude Container's architecture separates concerns into three isolated layers: a Docker container providing the sandboxed development environment, a Node.js/Express backend managing PTY processes and WebSocket streaming, and a React/Vite frontend delivering the browser-based terminal interface. The architecture prioritizes real-time responsiveness (<100ms terminal latency), crash isolation between concurrent sessions, and rock-solid stability for daily infrastructure use.

## Project Initialization

### Frontend Setup
```bash
npm create vite@latest claude-container-ui -- --template react-ts
cd claude-container-ui

# Install Tailwind CSS
npm install tailwindcss @tailwindcss/vite

# Install shadcn/ui
npx shadcn-ui@latest init

# Install core dependencies
npm install xterm xterm-addon-fit xterm-addon-web-links \
  react-markdown remark-gfm rehype-highlight \
  lucide-react clsx tailwind-merge

# Install development dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event eslint @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin prettier
```

**Rationale:** Vite provides instant HMR and optimized builds for React 19 + TypeScript + Tailwind CSS. shadcn/ui delivers accessible component primitives that align with the terminal-centric design requirements.

### Backend Setup (Manual Configuration)
```bash
mkdir claude-container-backend
cd claude-container-backend
npm init -y

# Production dependencies
npm install express ws node-pty simple-git chokidar winston js-yaml uuid

# Development dependencies
npm install -D typescript @types/node @types/express @types/ws @types/uuid \
  jest @types/jest ts-jest ts-node nodemon eslint @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin prettier

# Initialize TypeScript
npx tsc --init
```

**Rationale:** No suitable boilerplate exists for Express + WebSocket + node-pty integration. Manual setup provides clean, minimal backend tailored to PTY streaming requirements without unnecessary REST patterns.

## Decision Summary

| Category | Decision | Version | Affects FR Categories | Rationale |
| -------- | -------- | ------- | --------------------- | --------- |
| Frontend Framework | Vite + React 19 + TypeScript | Vite 6.x, React 19.x | Web Interface (FR21-FR52) | Fast HMR, optimized builds, TypeScript safety, React 19 concurrent features |
| UI Component Library | shadcn/ui + Tailwind CSS | shadcn latest, Tailwind 4.0 | Web Interface (FR21-FR52) | Accessible primitives, full customization, Oceanic Calm theme implementation |
| Backend Framework | Express.js + TypeScript | Express 4.x, TS 5.x | Backend Architecture (FR53-FR58) | Minimal, proven, excellent middleware ecosystem |
| WebSocket Library | ws (WebSocket) | ws 8.x | Terminal Emulation (FR21-FR28) | Lightweight, low-level control, optimal for PTY streaming |
| PTY Process Management | node-pty | node-pty 1.x | Session Management (FR8-FR15) | Industry standard for TTY emulation in Node.js |
| Terminal Emulator | xterm.js | xterm.js 5.x | Terminal Emulation (FR21-FR28) | Feature-complete, excellent performance, accessibility support |
| Container Base | Ubuntu 22.04 LTS | 22.04 | Container Management (FR1-FR7) | Stable, long-term support, broad package compatibility |
| State Management | React Context API + Hooks | React 19 built-in | Web Interface (FR21-FR52) | Zero dependencies, sufficient for 4-session scope, separate contexts avoid re-render issues |
| File System Watching | Chokidar | 4.x | Document Viewing (FR43-FR48) | Cross-platform reliability, event normalization, production-ready error handling |
| Markdown Rendering | react-markdown | Latest | Document Viewing (FR43-FR48) | Safe by default (no XSS), native React integration, remark plugin ecosystem |
| Git Worktree Management | simple-git | Latest | Git Worktree (FR16-FR20) | Worktree support, wraps native git CLI, actively maintained |
| Session Persistence | Flat JSON file | N/A | State & Persistence (FR59-FR63) | Simple, human-readable, atomic writes, no database overhead for 4 sessions |

## Project Structure

```
claude-container/
├── Dockerfile                      # Container definition with dev environment
├── docker-compose.yml              # Container orchestration (optional)
├── .dockerignore
├── README.md
│
├── backend/                        # Node.js/Express backend
│   ├── src/
│   │   ├── server.ts              # Express app + WebSocket server
│   │   ├── sessionManager.ts      # Session lifecycle management
│   │   ├── ptyManager.ts          # node-pty process spawning
│   │   ├── worktreeManager.ts     # Git worktree operations
│   │   ├── statusParser.ts        # BMAD workflow YAML parsing
│   │   ├── fileWatcher.ts         # Workspace file system monitoring
│   │   └── types.ts               # Shared TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                       # React/Vite UI
│   ├── src/
│   │   ├── main.tsx               # React entry point
│   │   ├── App.tsx                # Root component with layout
│   │   ├── components/
│   │   │   ├── ui/                # shadcn/ui components (copied)
│   │   │   ├── Terminal.tsx       # xterm.js wrapper
│   │   │   ├── SessionList.tsx    # Right sidebar session list
│   │   │   ├── FileTree.tsx       # Left sidebar file browser
│   │   │   ├── ArtifactViewer.tsx # Markdown renderer
│   │   │   ├── WorkflowProgress.tsx # BMAD step visualization
│   │   │   └── WorkflowDiagram.tsx # Interactive SVG workflow
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts    # WebSocket connection management
│   │   │   ├── useSession.ts      # Session state management
│   │   │   └── useLayout.ts       # Context-aware layout shifting
│   │   ├── context/
│   │   │   ├── SessionContext.tsx # Global session state
│   │   │   └── LayoutContext.tsx  # Layout mode state
│   │   ├── lib/
│   │   │   └── utils.ts           # Helper functions
│   │   └── styles/
│   │       └── globals.css        # Tailwind directives
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
└── workspace/                      # Mounted project volume (external)
    ├── .claude-container-sessions.json  # Session state persistence
    └── [user project files]
```

## FR Category to Architecture Mapping

This maps each functional requirement category from the PRD to specific architectural components:

| FR Category | FR Range | Architecture Components | Implementation Notes |
|-------------|----------|------------------------|---------------------|
| **Container & Environment Management** | FR1-FR7 | Dockerfile, Docker Compose | Ubuntu 22.04 + Python 3.13 + Java 21 + Node.js + git + build-essential. BMAD installed in workspace (not separate mount). All CLI tools marked safe (no approval prompts). |
| **Session Management** | FR8-FR15 | `sessionManager.ts`, `Session` interface, session persistence JSON | Max 4 concurrent sessions. Auto-generated names (`feature-YYYY-MM-DD-NNN`). State persisted to `/workspace/.claude-container-sessions.json`. Manual resume after container restart. |
| **Git Worktree Management** | FR16-FR20 | `worktreeManager.ts`, simple-git library | Each session gets isolated worktree at `/workspace/.worktrees/<session-id>` on branch `feature/<session-name>`. User responsible for merging. |
| **Web Interface - Terminal Emulation** | FR21-FR28 | `Terminal.tsx`, xterm.js, `ptyManager.ts`, WebSocket streaming | Full TTY emulation with xterm.js canvas renderer. Real-time streaming via WebSocket (`terminal.output` messages). ESC key + STOP button send SIGINT to PTY. |
| **Web Interface - Session Navigation** | FR29-FR36 | `SessionList.tsx`, `SessionContext`, tabs UI, status badges | Tabbed interface (up to 4 tabs). Status indicators: active (green), waiting (yellow), idle (blue), error (red). Last activity timestamps. Prominent input-needed banner. Stuck detection (30min no output). |
| **Web Interface - Workflow Visualization** | FR37-FR42 | `WorkflowProgress.tsx`, `WorkflowDiagram.tsx`, `statusParser.ts` | Parse BMAD YAML status files. Visual indicators: ✓ completed, → current (highlighted), ○ upcoming. Clickable steps for navigation (optional). |
| **Web Interface - Document Viewing** | FR43-FR48 | `ArtifactViewer.tsx`, `FileTree.tsx`, `fileWatcher.ts`, react-markdown | File tree navigation with chokidar file watching. Markdown rendering with syntax highlighting. Diff toggle (show changes since last view). |
| **Web Interface - Notifications & Status** | FR49-FR52 | Toast notifications, browser Notification API, tab badges | Browser notifications for user input requests. Tab badges for attention needed. Idle timer display. Prioritized status: stuck > input request > current step. |
| **Backend Architecture** | FR53-FR58 | `server.ts`, Express, ws library, node-pty | Express HTTP server + WebSocket server. One PTY process per session (node-pty). Separate WebSocket connection per session. Graceful shutdown on SIGTERM. |
| **State & Persistence** | FR59-FR63 | Session JSON file, atomic writes, BMAD YAML files | Atomic write pattern (temp + rename). Graceful handling of corrupted JSON (rebuild from worktrees). BMAD state persisted in workspace YAML (not container responsibility). |
| **Error Handling & Recovery** | FR64-FR68 | Error boundaries, Winston logging, WebSocket reconnection | Crash isolation between sessions. WebSocket auto-reconnect with exponential backoff. Container restart recovery via session JSON. Manual resume after crashes. |
| **Resource Management** | FR69-FR72 | Docker resource limits, process cleanup, memory monitoring | Optimized for 4 concurrent sessions. PTY process cleanup on session destroy. Optional per-session memory/CPU monitoring. Graceful degradation on resource limits. |

## Technology Stack Details

### Core Technologies

**Frontend Stack:**
- **React 19** - Component framework with concurrent rendering for smooth UI updates
- **TypeScript 5.x** - Type safety across frontend codebase
- **Vite 6.x** - Build tool with instant HMR and optimized production builds
- **Tailwind CSS 4.0** - Utility-first CSS for Oceanic Calm theme implementation
- **shadcn/ui** - Accessible component primitives (Button, Dialog, Tabs, Resizable, etc.)
- **xterm.js 5.x** - Terminal emulator with full TTY support and accessibility add-ons
- **xterm-addon-fit** - Terminal sizing addon
- **xterm-addon-web-links** - Clickable URLs in terminal
- **react-markdown** - Safe markdown rendering
- **remark-gfm** - GitHub Flavored Markdown support
- **rehype-highlight** - Syntax highlighting for code blocks
- **Lucide React** - Icon library matching shadcn/ui ecosystem
- **clsx** / **tailwind-merge** - Utility class management

**Backend Stack:**
- **Node.js 20+ LTS** - Runtime for backend services
- **Express 4.x** - HTTP server for static file serving and REST endpoints
- **ws 8.x** - WebSocket library for bidirectional real-time communication
- **node-pty 1.x** - Pseudo-terminal (PTY) interface for spawning Claude CLI processes
- **TypeScript 5.x** - Type safety across backend codebase
- **simple-git** - Git worktree management wrapper
- **chokidar 4.x** - File system watching library
- **winston** - Structured JSON logging
- **js-yaml** - YAML parsing for BMAD workflow status
- **uuid** - Session ID generation

**Development Environment (Docker Container):**
- **Ubuntu 22.04 LTS** - Base OS for container
- **Python 3.13** - Required for emassistant project validation
- **Amazon Corretto 21 (OpenJDK)** - Required for work projects
- **Node.js 20 LTS** - Backend runtime
- **Git** - Version control and worktree management
- **jq** - JSON parsing utility
- **build-essential** - C/C++ compilers for native npm modules

### Integration Points

**Frontend ↔ Backend:**
- **WebSocket Protocol:** One persistent connection per session for terminal I/O streaming
- **REST API:** Session management endpoints (create, list, destroy)
- **File Serving:** Backend serves frontend static assets and workspace documents

**Backend ↔ Claude CLI:**
- **node-pty:** Spawns Claude CLI as child process with proper TTY emulation
- **stdin/stdout/stderr:** Piped through PTY for terminal control sequences

**Backend ↔ File System:**
- **Session State:** JSON persistence at `/workspace/.claude-container-sessions.json`
- **File Watching:** Monitor workspace for new/modified files (trigger artifact viewer updates)
- **BMAD Status:** Parse `.bmad/bmm/status/bmm-workflow-status.yaml` for workflow visualization

**Container ↔ Host:**
- **Volume Mount (RW):** Host project → `/workspace` (Claude modifies code)
- **Volume Mount (RO):** Host `~/.config/claude-code` → `/config/.claude-code` (API keys)
- **Port Mapping:** Container port 3000 → Host localhost:3000

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents working on Claude Container.

### Pattern Category: Naming Patterns

**When Needed:** All files, variables, functions, API endpoints, WebSocket messages

**What to Define:** Exact naming conventions for every type of entity

**Why Critical:** Agents will create different names for the same concept without explicit rules

**Enforcement:** See "Naming Conventions" section above. ESLint + Prettier enforce file/variable naming. TypeScript interfaces define exact message type strings.

---

### Pattern Category: Structure Patterns

**When Needed:** All code organization decisions

**What to Define:** Where files go, how imports are ordered, component/module structure

**Why Critical:** Agents will put things in different places without explicit rules

**Enforcement:** See "Code Organization" section above. Path aliases (`@/`) prevent relative import inconsistency. One-concern-per-file principle.

**Examples:**
- React components: Flat in `components/`, alphabetical
- Backend modules: Flat in `src/`, one manager per file
- Tests: Co-located with `.test.` suffix
- Configs: Root of respective project (frontend/ or backend/)

---

### Pattern Category: Format Patterns

**When Needed:** Data exchange between components (WebSocket, REST, Session JSON)

**What to Define:** Exact message/data formats

**Why Critical:** Agents will use incompatible formats for the same data

**Enforcement:** TypeScript interfaces strictly define message formats. See "API Contracts" section for exact schemas.

**Examples:**

**WebSocket Message Format:**
```typescript
// ALWAYS use this structure - no variations
type ClientMessage = {
  type: string;  // Required: 'resource.action' format
  [key: string]: any;  // Additional fields vary by type
};

// Example: terminal input
{ type: 'terminal.input', sessionId: string, data: string }

// Example: session create
{ type: 'session.create', name?: string, branch?: string }
```

**Session JSON Format:**
```typescript
// ALWAYS include these fields - no omissions
interface Session {
  id: string;              // UUID v4, generated by backend
  name: string;            // User-provided or auto-generated
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  branch: string;          // Git branch name
  worktreePath: string;    // Absolute path
  ptyPid?: number;         // Only if process running
  createdAt: string;       // ISO 8601 UTC
  lastActivity: string;    // ISO 8601 UTC
  currentPhase?: string;   // Optional BMAD phase
  metadata?: object;       // Optional additional data
}
```

**Error Response Format:**
```typescript
// ALWAYS use this structure for errors
{
  type: 'error',
  message: string,        // Human-readable error message
  code?: string          // Optional machine-readable error code
}
```

---

### Pattern Category: Communication Patterns

**When Needed:** WebSocket, REST API, PTY I/O

**What to Define:** How components communicate

**Why Critical:** Agents will use different communication methods without explicit rules

**Enforcement:** See "API Contracts" section for complete protocol specification.

**WebSocket Communication Pattern:**
```typescript
// Client → Server: JSON messages
ws.send(JSON.stringify({ type: 'terminal.input', sessionId, data }));

// Server → Client: JSON messages (control) + raw text (terminal output)
ws.send(JSON.stringify({ type: 'terminal.output', sessionId, data: rawPtyOutput }));

// Heartbeat pattern (every 30s)
setInterval(() => {
  ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
}, 30000);

// Reconnection pattern (exponential backoff)
let reconnectDelay = 1000; // Start at 1s
function reconnect() {
  setTimeout(() => {
    ws = new WebSocket(url);
    ws.onopen = () => { reconnectDelay = 1000; }; // Reset on success
    ws.onerror = () => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Max 30s
      reconnect();
    };
  }, reconnectDelay);
}
```

**PTY Process Communication Pattern:**
```typescript
// ALWAYS use node-pty for terminal emulation
import * as pty from 'node-pty';

const ptyProcess = pty.spawn('claude', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: worktreePath,
  env: process.env
});

// ALWAYS stream PTY output to WebSocket
ptyProcess.onData((data) => {
  ws.send(JSON.stringify({ type: 'terminal.output', sessionId, data }));
});

// ALWAYS handle PTY exit
ptyProcess.onExit(({ exitCode, signal }) => {
  logger.error('PTY exited', { sessionId, exitCode, signal });
  ws.send(JSON.stringify({ type: 'session.status', sessionId, status: 'error' }));
});
```

---

### Pattern Category: Lifecycle Patterns

**When Needed:** State management, session lifecycle, connection handling

**What to Define:** How state changes and flows work

**Why Critical:** Agents will handle state transitions differently

**Enforcement:** State machines explicitly defined in code. Session status enum enforced by TypeScript.

**Session Lifecycle:**
```
[created] → active → waiting → active → ... → stopped
            ↓
           error (recoverable) → active
           error (fatal) → stopped
```

**WebSocket Connection Lifecycle:**
```
[connecting] → connected → attached (per session) → streaming
               ↓
              disconnected → reconnecting → connected
```

**File Watcher Lifecycle:**
```
[initialized] → watching → event detected → debounce (500ms) → batch notify
                ↓
               stopped (on backend shutdown)
```

---

### Pattern Category: Location Patterns

**When Needed:** File paths, URLs, storage locations

**What to Define:** Where things go

**Why Critical:** Agents will put things in different locations

**Enforcement:** Path constants defined in code. Validation functions reject invalid paths.

**Path Constants (Backend):**
```typescript
const WORKSPACE_ROOT = '/workspace';
const WORKTREE_DIR = '/workspace/.worktrees';
const SESSION_STATE_FILE = '/workspace/.claude-container-sessions.json';
const BMAD_STATUS_DIR = '/workspace/.bmad/bmm/status';
const CLAUDE_CONFIG_DIR = '/config/.claude-code';
const LOG_DIR = '/workspace/logs';

// ALWAYS validate paths start with WORKSPACE_ROOT (except config)
function validatePath(path: string): boolean {
  const resolved = fs.realpathSync(path);
  return resolved.startsWith(WORKSPACE_ROOT);
}
```

**URL Patterns:**
```typescript
// REST API - ALWAYS use /api prefix
const API_BASE = '/api';
const ENDPOINTS = {
  sessions: `${API_BASE}/sessions`,
  workflow: `${API_BASE}/workflow/status`,
  documents: `${API_BASE}/documents/:path`
};

// WebSocket - ALWAYS use root path
const WS_URL = 'ws://localhost:3000';
```

**Git Branch Locations:**
```typescript
// ALWAYS create worktrees in .worktrees directory
function createWorktree(sessionId: string, branchName: string) {
  const worktreePath = path.join(WORKTREE_DIR, sessionId);
  await git.raw(['worktree', 'add', '-b', branchName, worktreePath]);
}
```

---

### Pattern Category: Consistency Patterns

**When Needed:** Always - cross-cutting concerns

**What to Define:** Dates, errors, logs, user-facing text

**Why Critical:** Every agent will do these differently without explicit rules

**Enforcement:** Utility functions for common operations. Winston logger configuration.

**Date Handling (ALWAYS use UTC internally):**
```typescript
// ALWAYS store as ISO 8601 UTC string
const timestamp = new Date().toISOString(); // "2025-11-24T10:30:00.000Z"

// ALWAYS display in user's local timezone
const displayTime = new Date(timestamp).toLocaleString();

// Relative time helper (standardized format)
function relativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}
```

**Error Logging (ALWAYS include context):**
```typescript
// ALWAYS use winston logger with structured data
logger.error('PTY process crashed', {
  sessionId,
  errorCode: err.code,
  errorMessage: err.message,
  stack: err.stack,
  ptyPid,
  exitCode
});

// NEVER log sensitive data
// Bad: logger.info('API key', { key: process.env.CLAUDE_API_KEY });
// Good: logger.info('Using API key from environment');
```

**User-Facing Error Messages (ALWAYS be helpful):**
```typescript
// ALWAYS explain what happened + suggest remediation
const errorMessages = {
  sessionNameInvalid: 'Session name must be alphanumeric with dashes, max 50 chars. Example: "feature-auth"',
  gitWorktreeExists: 'A worktree already exists for this branch. Choose a different branch name or delete the existing worktree.',
  ptySpawnFailed: 'Failed to start Claude CLI. Check that Claude Code is installed and configured.',
  websocketDisconnected: 'Connection lost. Reconnecting automatically...'
};
```

**Session Status Display (ALWAYS consistent):**
```typescript
// Status badge color mapping (enforced by TypeScript enum + UI component)
const statusColors = {
  active: '#A3BE8C',    // Green
  waiting: '#EBCB8B',   // Yellow
  idle: '#88C0D0',      // Blue
  error: '#BF616A',     // Red
  stopped: '#4C566A'    // Gray
};

// Status icon mapping
const statusIcons = {
  active: '●',   // Filled circle
  waiting: '⏸',  // Pause
  idle: '○',     // Empty circle
  error: '●',    // Filled circle (red)
  stopped: '○'   // Empty circle (gray)
};
```

## Consistency Rules

### Naming Conventions

**Files and Directories:**
- **React components:** PascalCase - `Terminal.tsx`, `SessionList.tsx`, `ArtifactViewer.tsx`
- **React hooks:** camelCase with `use` prefix - `useWebSocket.ts`, `useSession.ts`, `useLayout.ts`
- **Backend modules:** camelCase - `sessionManager.ts`, `ptyManager.ts`, `worktreeManager.ts`
- **Types/Interfaces:** PascalCase - `Session`, `ClientMessage`, `ServerMessage` in `types.ts`
- **Test files:** Same name as source with `.test.` suffix - `sessionManager.test.ts`, `Terminal.test.tsx`
- **Directories:** kebab-case - `components/ui/`, `hooks/`, `context/`

**Variables and Functions:**
- **Variables:** camelCase - `sessionId`, `ptyPid`, `worktreePath`
- **Constants:** UPPER_SNAKE_CASE - `MAX_SESSIONS = 4`, `HEARTBEAT_INTERVAL = 30000`
- **Functions:** camelCase - `createSession()`, `spawnPTY()`, `attachToSession()`
- **Event handlers:** `on` prefix - `onSessionCreate`, `onTerminalInput`, `onWebSocketError`
- **Boolean variables:** `is`/`has`/`should` prefix - `isActive`, `hasError`, `shouldReconnect`

**API Endpoints:**
- REST: `/api/resource` format - `/api/sessions`, `/api/documents/:path`, `/api/workflow/status`
- Plural nouns for collections - `/api/sessions` (list), `/api/sessions/:id` (single)
- Verbs avoided in path (use HTTP methods) - POST `/api/sessions` not `/api/create-session`

**WebSocket Message Types:**
- Format: `resource.action` - `session.create`, `terminal.input`, `file.changed`
- Lowercase with dot separator - `session.attached`, `workflow.updated`, `heartbeat`

**Git Branches:**
- Session branches: `feature/<session-name>` - `feature/auth-implementation`, `feature/ui-polish`
- Auto-generated: `feature/<date>-<counter>` - `feature/2025-11-24-001`

**CSS Classes (Tailwind):**
- Utility-first approach (avoid custom classes when possible)
- Component-specific classes: `session-list`, `terminal-wrapper`, `artifact-viewer`
- State modifiers: `session-list--active`, `terminal--disconnected`

### Code Organization

**Import Order (Enforced by ESLint):**
```typescript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import { Terminal } from 'xterm';

// 2. Internal modules (absolute imports)
import { SessionContext } from '@/context/SessionContext';
import { useWebSocket } from '@/hooks/useWebSocket';

// 3. Types
import type { Session, ClientMessage } from '@/types';

// 4. Styles (if any)
import './Terminal.css';
```

**Component Structure (Frontend):**
```typescript
// 1. Imports
import ...

// 2. Types/Interfaces
interface TerminalProps {
  sessionId: string;
  websocketUrl: string;
}

// 3. Component definition
export function Terminal({ sessionId, websocketUrl }: TerminalProps) {
  // 4. Hooks (in order: context, state, effects, custom hooks)
  const { sessions } = useContext(SessionContext);
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => { ... });
  const { send, on } = useWebSocket(websocketUrl);

  // 5. Event handlers
  const handleInput = (data: string) => { ... };
  const handleInterrupt = () => { ... };

  // 6. Render
  return (...);
}

// 7. Exports (if multiple)
export { Terminal, type TerminalProps };
```

**Backend Module Structure:**
```typescript
// 1. Imports
import ...

// 2. Types
interface SessionManagerOptions { ... }

// 3. Class or module exports
export class SessionManager {
  // 4. Private fields
  private sessions: Map<string, Session>;
  private ptyProcesses: Map<string, PTYProcess>;

  // 5. Constructor
  constructor(options: SessionManagerOptions) { ... }

  // 6. Public methods (alphabetical)
  public async createSession(name: string): Promise<Session> { ... }
  public async destroySession(id: string): Promise<void> { ... }
  public getSession(id: string): Session | undefined { ... }

  // 7. Private methods (alphabetical)
  private generateSessionId(): string { ... }
  private validateSessionName(name: string): boolean { ... }
}
```

**Test Organization:**
```typescript
describe('SessionManager', () => {
  // Setup
  let manager: SessionManager;
  beforeEach(() => {
    manager = new SessionManager({...});
  });

  // Test suites grouped by method
  describe('createSession', () => {
    it('should create session with valid name', async () => { ... });
    it('should reject invalid session name', async () => { ... });
    it('should generate unique session IDs', async () => { ... });
  });

  describe('destroySession', () => {
    it('should remove session from registry', async () => { ... });
    it('should kill PTY process', async () => { ... });
    it('should handle non-existent session', async () => { ... });
  });
});
```

**Directory Structure Patterns:**
```
backend/src/
├── server.ts           # Entry point (Express app setup)
├── types.ts            # Shared TypeScript interfaces
├── sessionManager.ts   # One concern per file
├── ptyManager.ts
├── worktreeManager.ts
├── statusParser.ts
├── fileWatcher.ts
└── utils/             # Shared utilities
    ├── logger.ts
    ├── validation.ts
    └── atomicWrite.ts

frontend/src/
├── main.tsx           # Entry point
├── App.tsx            # Root component
├── components/
│   ├── ui/            # shadcn components (flat structure)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── tabs.tsx
│   ├── Terminal.tsx   # Custom components (flat, alphabetical)
│   ├── SessionList.tsx
│   ├── FileTree.tsx
│   └── ArtifactViewer.tsx
├── hooks/             # Custom React hooks
│   ├── useWebSocket.ts
│   ├── useSession.ts
│   └── useLayout.ts
├── context/           # React contexts
│   ├── SessionContext.tsx
│   ├── LayoutContext.tsx
│   └── WebSocketContext.tsx
├── lib/               # Utilities
│   └── utils.ts
└── types.ts           # Frontend-specific types
```

**Configuration Files Location:**
```
Root/
├── frontend/
│   ├── vite.config.ts      # Vite configuration
│   ├── tailwind.config.js  # Tailwind configuration
│   ├── tsconfig.json       # Frontend TypeScript config
│   └── vitest.config.ts    # Frontend test config
├── backend/
│   ├── tsconfig.json       # Backend TypeScript config
│   └── jest.config.js      # Backend test config
├── Dockerfile              # Container definition
├── docker-compose.yml      # Optional orchestration
└── .github/
    └── workflows/
        └── ci.yml          # CI/CD pipeline
```

### Error Handling

**Strategy:** Centralized error handlers with consistent user feedback

**Backend Error Handling:**
```typescript
// Express error middleware (last middleware)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ type: 'error', message: 'Internal server error', code: err.name });
});

// Async route wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

**Frontend Error Handling:**
```typescript
// React Error Boundary for component errors
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React component error', { error, errorInfo });
    // Show user-friendly error UI
  }
}

// WebSocket error handling
ws.onerror = (error) => {
  logger.error('WebSocket error', { error });
  showToast('Connection error', 'error');
  attemptReconnect();
};
```

**Error Categories:**
- **Fatal errors:** PTY spawn failure, container startup failure → Show error screen, require manual intervention
- **Recoverable errors:** WebSocket disconnect, file read failure → Log + show toast + auto-retry
- **User errors:** Invalid session name, git worktree conflict → Show validation message, allow correction

**Logging Strategy:**

**Library:** winston (structured JSON logging)

**Log Levels:**
- **error:** Failures requiring attention (PTY crash, WebSocket disconnect, file I/O errors)
- **warn:** Degraded state (session stuck >30min, high memory usage, slow terminal output)
- **info:** Important state changes (session created, workflow phase transition, artifact generated)
- **debug:** Detailed execution info (WebSocket messages, git commands, file watcher events) - disabled in production

**Log Format:**
```json
{
  "timestamp": "2025-11-24T10:30:00.123Z",
  "level": "error",
  "message": "PTY process crashed",
  "sessionId": "feature-auth-001",
  "errorCode": "ECONNRESET",
  "stack": "Error: ...",
  "context": { "pid": 12345, "exitCode": 1 }
}
```

**Log Destinations:**
- **Console (stdout/stderr):** All levels, Docker logs capture automatically
- **File (optional):** `/workspace/logs/claude-container.log` - Rotated daily, keep 7 days
- **Production:** Consider structured log aggregation (if deployed to cloud) - out of scope for MVP

**Log Conventions:**
- Include sessionId in all session-related logs
- Include file paths in file operation logs
- Include WebSocket connection ID in network logs
- No sensitive data (API keys, auth tokens) in logs

### Date/Time Handling

**Strategy:** UTC internally, local display for users

**Backend:**
- Store all timestamps as ISO 8601 strings in UTC: `new Date().toISOString()` → `"2025-11-24T10:30:00.000Z"`
- Session state JSON: `{ "id": "...", "createdAt": "2025-11-24T10:30:00.000Z", "lastActivity": "..." }`
- Logs: ISO timestamps in UTC (winston default)

**Frontend:**
- Receive ISO strings from backend
- Display in user's local timezone: `new Date(isoString).toLocaleString()`
- "Last activity" formatting: Custom relative time ("5m ago", "2h ago", "Yesterday")
- No date library needed (native Date sufficient)

**Rationale:** Container may run in different timezones than user's browser. UTC eliminates ambiguity.

### Testing Strategy

**Framework Choices:**
- **Frontend Unit/Integration:** Vitest (matches Vite ecosystem, faster than Jest)
- **Backend Unit/Integration:** Jest (Node.js standard, excellent TypeScript support)
- **E2E:** Playwright (modern, reliable, supports WebSocket testing)

**Test Coverage Targets:**
- Backend critical paths: 70%+ (sessionManager, ptyManager, worktreeManager)
- Frontend components: 50%+ (focus on complex components: Terminal, SessionList)
- E2E: 5-10 critical flows (not comprehensive, just smoke tests)

**Test Pyramid:**
```
         E2E (5-10 tests)          ← Critical user flows
       /                  \
      /  Integration (30)  \        ← Component interactions, API flows
     /                      \
    /  Unit Tests (100+)     \      ← Pure functions, utilities
   /________________________\
```

**Critical Test Cases:**

**Backend Unit Tests:**
- Session creation with valid/invalid names
- PTY process spawning and error handling
- Git worktree creation/deletion
- WebSocket message parsing
- Atomic JSON file writes
- File watcher event handling

**Frontend Unit Tests:**
- Terminal component WebSocket connection
- Session status badge color mapping
- Markdown rendering with XSS prevention
- Context-aware layout shifting logic
- Error boundary error handling

**Integration Tests:**
- Full WebSocket protocol (connect → create session → terminal I/O → disconnect)
- PTY stdout/stderr streaming through WebSocket
- File watcher → artifact viewer update flow
- Session persistence across backend restarts

**E2E Tests (Playwright):**
1. New user: Empty state → Create session → Terminal ready
2. Multi-session: Create 3 sessions → Switch between them → Verify isolation
3. Interrupt: Claude running → Press ESC → Terminal returns to prompt
4. Artifact viewing: Claude writes document → Artifact viewer auto-opens
5. Container restart: Stop container → Start → Sessions restored from JSON

**CI/CD Integration:**
- Unit tests run on every commit (fast feedback)
- Integration tests run on PR (protect main branch)
- E2E tests run nightly (catch infrastructure regressions)

## Data Architecture

### Session State Model

**Session Entity:**
```typescript
interface Session {
  id: string;                    // UUID v4
  name: string;                  // User-defined or auto-generated
  status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped';
  branch: string;                // Git branch name
  worktreePath: string;          // Absolute path: /workspace/.worktrees/<session-id>
  ptyPid?: number;               // Claude CLI process ID (if running)
  createdAt: string;             // ISO 8601 timestamp
  lastActivity: string;          // ISO 8601 timestamp
  currentPhase?: string;         // BMAD workflow phase (brainstorming, prd, architecture, etc.)
  metadata?: {
    epicName?: string;
    storyProgress?: { completed: number, total: number };
  };
}
```

**Persistence:**
- File: `/workspace/.claude-container-sessions.json`
- Format: JSON array of Session objects
- Atomic writes: Temp file + rename pattern
- Read on backend startup to restore sessions

**In-Memory State:**
- Backend: Map<sessionId, Session> for O(1) lookups
- Also track: Map<sessionId, PTYProcess> for active processes
- Also track: Map<sessionId, WebSocket> for client connections

### BMAD Workflow State

**Source:** `.bmad/bmm/status/bmm-workflow-status.yaml` (created by BMAD Method)

**Backend Parsing:**
- Use `js-yaml` library to parse YAML
- Extract current workflow step and completed steps
- Send to frontend via WebSocket when file changes (chokidar watch)

**Frontend State:**
- WorkflowContext stores: `{ currentStep: string, completedSteps: string[], steps: WorkflowStep[] }`
- UI components subscribe to context for visualization

### File System State

**Watched Paths:**
- `/workspace/**/*.md` - Markdown documents (PRD, architecture, UX, epics, stories)
- `/workspace/.bmad/bmm/status/*.yaml` - BMAD workflow status files

**File Watcher Events:**
- `add` - New file created → Notify frontend (update file tree)
- `change` - File modified → Notify frontend (refresh artifact viewer if open)
- `unlink` - File deleted → Notify frontend (remove from file tree)

**Event Debouncing:**
- Batch file events within 500ms window (avoid rapid-fire updates during Claude writes)
- Send single WebSocket message with all changes

## API Contracts

### REST Endpoints

**Base URL:** `http://localhost:3000/api`

**Session Management:**

```typescript
// GET /api/sessions - List all sessions
Response: { sessions: Session[] }

// POST /api/sessions - Create new session
Request: { name?: string, branch?: string }
Response: { session: Session }
Error: { error: string, code: 'INVALID_NAME' | 'GIT_ERROR' | ... }

// DELETE /api/sessions/:id - Destroy session
Response: { success: true }
Error: { error: string }

// GET /api/sessions/:id/status - Get session status
Response: { session: Session }
```

**Workflow & Documents:**

```typescript
// GET /api/workflow/status - Get BMAD workflow status
Response: { currentStep: string, completedSteps: string[], steps: WorkflowStep[] }

// GET /api/documents/:path - Serve workspace file
// Example: /api/documents/prd.md
Response: File content (text/plain or application/octet-stream)
Error: { error: 'File not found' }

// GET /api/documents/tree - Get file tree structure
Response: { tree: FileNode[] }
```

### WebSocket Protocol

**Connection:** `ws://localhost:3000`

**Client → Server Messages:**

```typescript
type ClientMessage =
  | { type: 'session.create', name?: string, branch?: string }
  | { type: 'session.destroy', sessionId: string }
  | { type: 'session.attach', sessionId: string }       // Attach to existing session
  | { type: 'terminal.input', sessionId: string, data: string }
  | { type: 'terminal.interrupt', sessionId: string }   // Send SIGINT (Ctrl+C)
  | { type: 'heartbeat', timestamp: number };
```

**Server → Client Messages:**

```typescript
type ServerMessage =
  | { type: 'session.created', session: Session }
  | { type: 'session.destroyed', sessionId: string }
  | { type: 'session.attached', sessionId: string }
  | { type: 'session.status', sessionId: string, status: Session['status'] }
  | { type: 'terminal.output', sessionId: string, data: string }  // Raw PTY output
  | { type: 'file.changed', path: string, event: 'add' | 'change' | 'unlink' }
  | { type: 'workflow.updated', workflow: WorkflowState }
  | { type: 'error', message: string, code?: string }
  | { type: 'heartbeat', timestamp: number };
```

**Connection Lifecycle:**

1. **Connect:** Client opens WebSocket to `ws://localhost:3000`
2. **Attach:** Client sends `session.attach` for each session to subscribe to terminal output
3. **Streaming:** Server streams PTY output via `terminal.output` messages
4. **Input:** Client sends `terminal.input` for user keystrokes
5. **Heartbeat:** Client/server exchange heartbeat every 30s to detect disconnects
6. **Reconnect:** If connection drops, client attempts reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
7. **Reattach:** After reconnect, client re-sends `session.attach` for all active sessions

**Message Ordering:**
- Terminal output guaranteed in order per session (single PTY stdout stream)
- Control messages processed in order received
- No message acknowledgment (fire-and-forget, acceptable for terminal streaming)

## Security Architecture

### Threat Model

**In-Scope Threats:**
- **Container escape:** Malicious code in Claude-generated projects attempting to break out of Docker sandbox
- **Path traversal:** File operations accessing files outside `/workspace`
- **XSS attacks:** Malicious markdown in documents attempting to inject scripts
- **Resource exhaustion:** Runaway Claude processes consuming all container resources

**Out-of-Scope Threats:**
- Network attacks (single-user local tool, no remote access)
- Multi-user authentication/authorization (not multi-tenant)
- Supply chain attacks on npm dependencies (mitigated by npm audit, Dependabot)

### Security Measures

**Container Isolation:**
- Docker container provides process and filesystem isolation from host
- Claude CLI runs with limited privileges (non-root user in container)
- Volume mounts: Workspace (RW), Claude config (RO)
- Network: Localhost binding only (`0.0.0.0:3000` → `127.0.0.1:3000` on host)
- Resource limits: Docker memory/CPU limits prevent denial-of-service

**File System Security:**
- Path validation: All file operations validate path starts with `/workspace/`
- Symlink resolution: Resolve symlinks before validation (prevent escape via links)
- Atomic writes: Prevent partial writes and race conditions
- Read-only config mount: Claude config immutable from container

**Frontend Security:**
- XSS prevention: react-markdown safe by default (no dangerouslySetInnerHTML)
- Input sanitization: Session names validated (alphanumeric + dashes, max 50 chars)
- CSP headers: Content-Security-Policy restricts inline scripts (future enhancement)

**Backend Security:**
- No authentication required (single-user local tool, localhost-only access)
- PTY process isolation: Each session runs in separate process with independent stdio
- Error messages: No stack traces or internal paths exposed to frontend
- Dependency auditing: `npm audit` in CI/CD pipeline

**Audit Logging:**
- All destructive commands logged with sessionId and user context
- PTY output optionally logged for debugging (disabled by default for performance)
- Session creation/destruction logged with timestamps

## Performance Considerations

### Critical Performance Requirements

**From PRD NFRs:**
- **NFR-PERF-1:** Terminal output streaming <100ms latency
- **NFR-PERF-2:** UI responsiveness - tab switching <50ms, interactions <200ms
- **NFR-PERF-3:** Session startup <5 seconds (worktree + Claude spawn)
- **NFR-PERF-4:** 4 concurrent sessions without degradation

### Performance Optimizations

**Terminal Streaming:**
- **WebSocket binary frames:** Use binary messages for terminal output (faster than JSON encoding)
- **Buffering:** Accumulate PTY output in 16ms chunks before sending (60fps equivalent, balances latency vs. message overhead)
- **Backpressure:** Throttle PTY reads if WebSocket buffer full (prevent memory exhaustion)
- **xterm.js optimization:** Use canvas renderer (faster than DOM), enable hardware acceleration

**Frontend Rendering:**
- **React concurrent features:** Use React 19 transitions for non-urgent updates (layout shifts)
- **Context splitting:** Separate contexts prevent unnecessary re-renders (SessionContext changes don't re-render LayoutContext consumers)
- **Virtual scrolling:** File tree uses virtual scrolling for 1000+ files (react-window or similar)
- **Debounced updates:** File watcher batches events (500ms), layout shift debounced (300ms)
- **Code splitting:** Lazy load heavy components (WorkflowDiagram, ArtifactViewer) with React.lazy()

**Backend Efficiency:**
- **Connection pooling:** Reuse WebSocket connections (one per client, not per session)
- **In-memory caching:** Session state cached in Map (no JSON parse on every lookup)
- **File watcher optimization:** Chokidar ignores node_modules, .git (reduce watcher overhead)
- **Async I/O:** All file operations use async APIs (fs.promises, not blocking fs)

**Resource Management:**
- **PTY process cleanup:** Kill zombie processes on session destroy
- **WebSocket cleanup:** Close stale connections after 5min inactivity
- **Log rotation:** Rotate log files daily, delete after 7 days
- **Memory monitoring:** Track session count, warn if >4 (design limit)

**Docker Container Optimization:**
- **Layer caching:** Dockerfile ordered for maximum cache hits (apt-get first, npm install mid, COPY source last)
- **Multi-stage build:** Separate build stage for npm dependencies (smaller final image)
- **Base image:** Ubuntu 22.04 LTS (balance between size and compatibility)

### Performance Monitoring

**Metrics to Track (Future Enhancement):**
- WebSocket message latency (p50, p95, p99)
- Terminal output throughput (messages/sec)
- Session startup time
- Memory usage per session
- CPU usage per PTY process

**Tooling (Out of Scope for MVP):**
- Node.js native profiling (`--inspect`)
- Chrome DevTools for frontend performance
- Docker stats for container resource usage

## Deployment Architecture

### Local Development Deployment

**Target:** Developer workstation (macOS, Linux, Windows with WSL2)

**Architecture:**
```
┌─────────────────────────────────────────────┐
│  Host Machine (macOS/Linux/Windows+WSL2)   │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Docker Container (Ubuntu 22.04)     │  │
│  │                                      │  │
│  │  ┌────────────────────────────────┐ │  │
│  │  │  Backend (Node.js + Express)   │ │  │
│  │  │  - Port 3000                   │ │  │
│  │  │  - WebSocket server            │ │  │
│  │  │  - Serves frontend static      │ │  │
│  │  │  - Spawns Claude CLI (PTY)     │ │  │
│  │  └────────────────────────────────┘ │  │
│  │                                      │  │
│  │  Volume Mounts:                      │  │
│  │  - /workspace ← Host project dir    │  │
│  │  - /config/.claude-code ← Host cfg  │  │
│  └──────────────────────────────────────┘  │
│           ↑                                 │
│           │ Port 3000 exposed               │
│           ↓                                 │
│  ┌──────────────────────────────────────┐  │
│  │  Browser (localhost:3000)            │  │
│  │  - React UI                          │  │
│  │  - WebSocket client                  │  │
│  │  - xterm.js terminal                 │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Deployment Steps:**

1. **Build Docker image:**
```bash
docker build -t claude-container:latest .
```

2. **Run container:**
```bash
docker run -d \
  --name claude-container \
  -p 3000:3000 \
  -v $(pwd):/workspace \
  -v ~/.config/claude-code:/config/.claude-code:ro \
  --restart unless-stopped \
  claude-container:latest
```

3. **Access UI:**
```bash
open http://localhost:3000
```

**Container Lifecycle:**
- **Startup:** Backend starts → Loads sessions from JSON → Spawns WebSocket server → Serves frontend
- **Restart:** Sessions restored from JSON, PTY processes not restored (user resumes manually)
- **Shutdown:** Graceful shutdown sends SIGTERM to PTY processes → Saves session state → Closes WebSocket connections

**Volume Mount Strategy:**
- **Workspace (RW):** Entire host project directory mounted to `/workspace` (Claude modifies code)
- **Claude config (RO):** API keys and settings mounted read-only (prevent accidental corruption)
- **Persistence:** Session JSON and logs stored in `/workspace` (survive container restarts)

### Production Deployment (Future)

**Out of Scope for MVP** - Local-only tool for now.

**Potential Future Options:**
- **Cloud deployment:** Run container on AWS ECS/Fargate, access via SSH tunnel
- **Multi-user:** Add authentication (OAuth), isolate workspaces per user
- **Remote access:** Expose UI over HTTPS with authentication
- **Kubernetes:** Deploy as StatefulSet for session persistence across pod restarts

**Blockers for Production:**
- No authentication/authorization (single-user assumption)
- Localhost-only WebSocket (no TLS/WSS)
- No data encryption at rest
- No backup/disaster recovery strategy

## Development Environment

### Prerequisites

- **Docker Desktop** (macOS) or Docker Engine (Linux) - Container runtime
- **Git** - Version control
- **Node.js 20+ LTS** - For local frontend/backend development outside container
- **Modern browser** - Chrome, Firefox, Safari, or Edge (latest 2 versions)

### Setup Commands

```bash
# Clone repository
git clone <repository-url>
cd claude-container

# Build Docker image
docker build -t claude-container .

# Run container with volume mounts
docker run -d \
  -p 3000:3000 \
  -v $(pwd):/workspace \
  -v ~/.config/claude-code:/config/.claude-code:ro \
  --name claude-container \
  claude-container

# Access UI
open http://localhost:3000
```

## Architecture Decision Records (ADRs)

### ADR-001: Separate Frontend and Backend Directories

**Decision:** Use separate `frontend/` and `backend/` directories instead of monorepo structure.

**Rationale:**
- Clear separation of concerns (UI vs. server logic)
- Independent dependency management (frontend doesn't need node-pty, backend doesn't need React)
- Simpler Docker build (backend runs in container, frontend builds to static assets)
- No monorepo tooling complexity (nx, turborepo, etc.) for 2-package project

**Consequences:**
- Backend serves frontend static assets after build
- Shared TypeScript types need explicit import/export between projects
- Docker image copies both directories but only runs backend

---

### ADR-002: Use Vite Instead of Next.js for Frontend

**Decision:** Use Vite + React instead of Next.js.

**Rationale:**
- Claude Container is a single-page app, no SSR/SSG benefits from Next.js
- Vite provides faster HMR (instant refresh during development)
- Simpler deployment model (static files served by Express)
- No API routes needed (backend is separate Express server)
- Lighter bundle size (no Next.js framework overhead)

**Consequences:**
- Manual client-side routing setup (React Router if needed - likely not, single-page UI)
- No automatic code splitting by route (acceptable, entire UI loads upfront)
- Must manually configure Tailwind and TypeScript (Vite starter handles this)

---

### ADR-003: Manual Backend Setup Instead of Boilerplate

**Decision:** Manually configure Express + TypeScript + WebSocket + node-pty backend instead of using boilerplate.

**Rationale:**
- No boilerplate exists combining these exact technologies
- Boilerplates add unnecessary REST patterns and middleware (auth, validation, ORM, etc.)
- PTY streaming requires custom WebSocket protocol design
- Clean minimal backend (< 10 files) doesn't justify boilerplate complexity

**Consequences:**
- More upfront setup work (TypeScript config, Express initialization)
- Full control over architecture (no fighting boilerplate opinions)
- Easier to maintain (no unnecessary dependencies or patterns)

---

### ADR-004: WebSocket Library (ws) Over Socket.io

**Decision:** Use `ws` library instead of Socket.io for WebSocket communication.

**Rationale:**
- Lower-level control for PTY streaming (raw binary data)
- Smaller bundle size (Socket.io adds 60KB+ client library)
- No unnecessary features (rooms, namespaces, automatic reconnection handled manually)
- Better performance for high-frequency terminal output streaming

**Consequences:**
- Must implement reconnection logic manually
- No built-in message acknowledgment (acceptable for terminal streaming)
- Simpler protocol design (JSON for control messages, raw text for terminal I/O)

---

### ADR-005: React Context API Over Zustand/Redux

**Decision:** Use React Context API + Hooks for state management instead of Zustand or Redux Toolkit.

**Rationale:**
- Application has 3-4 distinct state domains (sessions, layout, WebSocket connections, BMAD workflow)
- Scope is limited (4 concurrent sessions max, single user, local tool)
- Context API sufficient when using separate contexts per domain (avoids re-render issues)
- Zero additional dependencies (built into React 19)
- Zustand/Redux would be premature optimization for this scope

**Consequences:**
- Create separate contexts: SessionContext, LayoutContext, WebSocketContext, WorkflowContext
- Each context manages independent slice of state
- Custom hooks (useSession, useLayout, etc.) provide clean API
- If app grows beyond 10+ sessions, can migrate to Zustand incrementally

---

### ADR-006: Chokidar for File System Watching

**Decision:** Use Chokidar library instead of native fs.watch for workspace file monitoring.

**Rationale:**
- Production infrastructure tool requires rock-solid reliability
- Chokidar normalizes events across macOS/Linux/Windows (fs.watch is inconsistent)
- Handles edge cases fs.watch misses (non-existent paths, EMFILE errors)
- v4 reduced dependencies from 13→1 (minimal footprint)
- Proven in production (used by Vite, webpack, etc.)

**Consequences:**
- Adds Chokidar dependency (~100KB)
- Consistent behavior across all Docker host platforms
- Event normalization simplifies artifact viewer update logic
- Reliable detection of document writes (PRD, architecture, etc.)

---

### ADR-007: react-markdown for Markdown Rendering

**Decision:** Use react-markdown instead of marked + dangerouslySetInnerHTML.

**Rationale:**
- Security: Safe by default, no XSS vulnerabilities
- React integration: Renders to React components, not raw HTML
- Plugin ecosystem: remark plugins for syntax highlighting, frontmatter parsing
- UX spec documents are medium-sized (<1MB), performance difference negligible
- Developer infrastructure tool doesn't need micro-optimized parsing speed

**Consequences:**
- Slightly slower than marked for very large documents (not your use case)
- Can extend with remark plugins (syntax highlighting for code blocks)
- No manual XSS sanitization required
- Clean integration with React component tree

---

### ADR-008: simple-git for Git Worktree Management

**Decision:** Use simple-git library instead of dedicated git-worktree package or isomorphic-git.

**Rationale:**
- Git binary already required in container (Claude uses it)
- simple-git wraps native git CLI, supports worktree commands via `.raw()`
- Actively maintained (git-worktree last updated 4 years ago)
- isomorphic-git incomplete worktree support and larger dependency
- Straightforward API: `git.raw(['worktree', 'add', path, branch])`

**Consequences:**
- Requires git binary in container (already a requirement)
- Worktree operations call native git commands (proven reliability)
- Error handling via git exit codes and stderr parsing
- Can leverage full git CLI features if needed (branch management, etc.)

---

### ADR-009: Flat JSON File for Session Persistence

**Decision:** Use flat JSON file at `/workspace/.claude-container-sessions.json` instead of SQLite or other database.

**Rationale:**
- Simple key-value storage for 4 sessions max
- Human-readable (developers can inspect/debug manually)
- Survives container restarts (stored in mounted volume)
- No database overhead (no schema migrations, query engine, etc.)
- Atomic writes (temp file + rename) prevent corruption
- Single backend process (no concurrent write concerns from multiple processes)

**Consequences:**
- Session state persisted as JSON array
- Atomic write pattern: `fs.writeFileSync('/tmp/sessions.tmp', JSON.stringify(sessions)); fs.renameSync('/tmp/sessions.tmp', '/workspace/.claude-container-sessions.json')`
- No relational queries needed (load all sessions, filter in-memory)
- If scaling beyond 50+ sessions, revisit database decision (not expected use case)

---

### ADR-010: Testing Frameworks - Vitest for Frontend, Jest for Backend

**Decision:** Use Vitest for frontend tests and Jest for backend tests instead of a single testing framework.

**Rationale:**
- **Vitest** matches Vite ecosystem (same config format, instant HMR)
- **Vitest** is faster than Jest for frontend tests (native ESM support)
- **Jest** is Node.js standard for backend, excellent TypeScript support
- Different concerns: Frontend tests need DOM/React testing, backend tests need async/mock patterns
- Marginal overhead of two frameworks outweighed by ecosystem benefits

**Consequences:**
- Frontend: `vitest.config.ts` alongside `vite.config.ts`
- Backend: `jest.config.js` with ts-jest transformer
- Shared testing patterns: Both use describe/it/expect syntax
- E2E tests (Playwright) separate from unit/integration tests

---

### ADR-011: Markdown Plugins for Code Highlighting

**Decision:** Use remark-gfm + rehype-highlight for markdown rendering instead of plain react-markdown.

**Rationale:**
- **remark-gfm:** GitHub Flavored Markdown support (tables, task lists, strikethrough)
- **rehype-highlight:** Syntax highlighting for code blocks (PRD/Architecture contain code examples)
- UX spec documents contain tables and formatted code
- react-markdown plugin ecosystem well-maintained

**Consequences:**
- Add highlight.js CSS theme (Oceanic Calm color scheme)
- Code blocks render with language-aware syntax highlighting
- Markdown tables render properly (PRD contains many tables)
- Slightly larger bundle (~50KB for highlight.js), acceptable for document viewer

---

### ADR-012: Session Lifecycle Management Patterns (Epic 2)

**Decision:** Implement three-layer session architecture: SessionManager (metadata) → PTYManager (processes) → WorktreeManager (git).

**Rationale:**
- Clean separation of concerns enables independent testing and crash isolation
- SessionManager handles persistence without knowing about PTY internals
- PTYManager handles process lifecycle without knowing about git
- WorktreeManager handles git operations without knowing about sessions

**Patterns Established:**
```typescript
// Session creation flow
sessionManager.createSession() → worktreeManager.create() → ptyManager.spawn()

// Session destruction flow (with cleanup options)
sessionManager.destroySession(id, { deleteWorktree })
  → ptyManager.kill() → worktreeManager.delete(optional)

// Crash recovery: PTY dies but session metadata persists
ptyManager.onExit(sessionId) → sessionManager.updateStatus('error')
```

**Consequences:**
- Each layer testable in isolation with mocked dependencies
- PTY crashes don't corrupt session state (isolation achieved)
- Session resume after container restart via `session.resume` WebSocket message

---

### ADR-013: WebSocket Message Protocol Patterns (Epic 2-3)

**Decision:** Use `resource.action` naming convention for all WebSocket messages.

**Documentation:** See `docs/websocket-protocol.md` for complete protocol specification.

**Message Categories:**
- **Terminal I/O:** `terminal.input`, `terminal.output`, `terminal.interrupt`, `terminal.exit`
- **Session Lifecycle:** `session.attach`, `session.detach`, `session.status`, `session.resume`, `session.destroyed`
- **File System:** `file.changed` (add/change/unlink events)
- **Workflow:** `workflow.updated` (BMAD status changes)
- **Layout:** `layout.shift` (auto-focus terminal/artifacts)
- **Control:** `heartbeat`, `error`

**Rationale:**
- Consistent naming enables easy message routing
- Type field enables switch-case handling in message handlers
- Protocol documented for maintainability

---

### ADR-014: Layout Context and State Management (Epic 3)

**Decision:** Use separate React contexts for each concern: SessionContext, LayoutContext, WorkflowContext, NotificationContext.

**LayoutContext State:**
```typescript
interface LayoutState {
  leftSidebarView: 'files' | 'workflow';  // Tab toggle
  leftSidebarWidth: number;                // 200-400px
  isLeftCollapsed: boolean;                // Collapsed state
  mainContentMode: 'terminal' | 'artifact' | 'split';
  splitRatio: number;                      // 0.3-0.7 (artifact/terminal)
  autoShiftPaused: boolean;                // Manual override active
}
```

**Persistence Pattern:**
- All layout state persists to localStorage
- Key format: `claude-container-layout` (global, not per-session)
- Graceful fallback to defaults if corrupted

**Keyboard Shortcuts:**
- `Cmd+W` / `Ctrl+W`: Toggle Files/Workflow view
- `Cmd+T` / `Ctrl+T`: Focus Terminal (100%)
- `Cmd+A` / `Ctrl+A`: Focus Artifacts (70/30 split)
- `Ctrl+Arrow`: Resize panels

---

### ADR-015: File Watching and Real-Time Updates (Epic 3)

**Decision:** Use Chokidar with debounced WebSocket broadcasts for file system changes.

**Watch Patterns:**
- `/workspace/**/*` - All workspace files for file tree
- `/workspace/.bmad/bmm/status/*.yaml` - BMAD workflow status
- `/workspace/docs/**/*.md` - Document writes trigger layout.shift

**Debounce Strategy:**
- 500ms debounce for file.changed events (batch rapid writes)
- Layout shift only triggers for markdown files in /docs/

**Message Flow:**
```
Chokidar event → 500ms debounce → statusParser.parse() → WebSocket broadcast
                                                       ↓
Frontend: FileTree updates / ArtifactViewer refreshes / WorkflowProgress updates
```

---

### ADR-016: Diff View and Cache Management (Epic 3)

**Decision:** Use localStorage-based diff cache with session isolation for tracking document changes.

**Cache Structure:**
```typescript
interface DiffCacheEntry {
  filePath: string;
  sessionId: string;
  lastViewedContent: string;
  lastViewedAt: string;  // ISO 8601
}
// Key: `diff-cache:${sessionId}:${filePath}`
```

**Cache Limits:**
- Max 50 entries per session
- LRU eviction when limit exceeded
- Cache cleared on session destruction

**Diff Display:**
- Green (#A3BE8C, 20% opacity): Added lines
- Red (#BF616A, 20% opacity): Deleted lines
- 3 lines context before/after changes

---

### ADR-017: Browser Notification Permission Flow (Epic 3)

**Decision:** Request notification permission on first load via banner UI, prepare for Epic 4 implementation.

**Permission States:**
- `default`: Show permission banner
- `granted`: Hide banner, ready for notifications
- `denied`: Show info in Settings, instructions to enable

**Persistence:**
- `notification-permission-dismissed`: Boolean (user clicked "Maybe Later")
- Banner dismissal persists across sessions

**Epic 4 Integration Point:**
- NotificationContext provides `permissionGranted` boolean
- Story 4.3 will add `sendNotification()` function

---

## Architectural Patterns Summary (Epic 1-3)

| Pattern | Location | Purpose |
|---------|----------|---------|
| Atomic File Writes | SessionManager, LayoutContext | Prevent corruption on crash |
| Three-Layer Architecture | Session/PTY/Worktree Managers | Separation of concerns, crash isolation |
| Context Splitting | React Contexts | Prevent unnecessary re-renders |
| WebSocket Protocol | `docs/websocket-protocol.md` | Documented message contract |
| Debounced Events | FileWatcher, Layout | Batch rapid updates |
| localStorage Persistence | Layout, Diff Cache, Notifications | State survives refresh |
| Exponential Backoff | WebSocket reconnection | Graceful degradation |
| Graceful Degradation | All error paths | Show fallback UI, log errors |

---

## Epic 4 Patterns (Production Stability & Polish)

### Session Status Tracking

**Pattern:** Backend tracks `lastActivity` timestamp and detects idle/stuck/waiting states via heuristics.

**Implementation:**

```typescript
interface Session {
  // ... existing fields
  lastActivity: string;        // ISO 8601, updated on every PTY output
  metadata?: {
    stuckSince?: string;       // ISO 8601, when stuck detection triggered
    lastWarning?: string;      // ISO 8601, when last warning sent
  };
}

// Status detection logic (runs every 60s)
function detectSessionStatus(session: Session): SessionStatus {
  const idleThreshold = 5 * 60 * 1000;   // 5 minutes
  const stuckThreshold = 30 * 60 * 1000; // 30 minutes
  const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();

  if (timeSinceActivity > stuckThreshold && session.status !== 'error') {
    return 'stuck';  // Send session.warning
  }
  if (timeSinceActivity > idleThreshold && session.status === 'active') {
    return 'idle';
  }
  if (session.ptyOutput.endsWith('?') && timeSinceActivity > 10000) {
    return 'waiting';  // Claude asking question
  }
  return 'active';
}
```

**WebSocket Messages:**
- `session.status` - Status change notification (active, waiting, idle, error, stopped)
- `session.warning` - Stuck session notification (30+ min no output)
- `session.needsInput` - Background session needs input (if not active)

---

### Toast Notification System

**Pattern:** Type-specific toast styling with auto-dismiss, stacking (max 3), and duplicate prevention.

**Implementation:**

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

// Toast styling (Oceanic Calm theme)
const toastStyles = {
  success: { border: '#A3BE8C', bg: 'rgba(163, 190, 140, 0.1)', icon: '✓' },
  error:   { border: '#BF616A', bg: 'rgba(191, 97, 106, 0.1)', icon: '✗' },
  warning: { border: '#EBCB8B', bg: 'rgba(235, 203, 139, 0.1)', icon: '⚠' },
  info:    { border: '#88C0D0', bg: 'rgba(136, 192, 208, 0.1)', icon: 'ℹ' }
};

// Duplicate prevention (within 1s window)
function shouldShowToast(message: string, recentToasts: ToastNotification[]): boolean {
  const oneSecondAgo = Date.now() - 1000;
  return !recentToasts.some(t =>
    t.message === message && new Date(t.timestamp).getTime() > oneSecondAgo
  );
}
```

**Auto-dismiss timing:**
- Success: 4 seconds
- Error: 8 seconds
- Warning: 6 seconds
- Info: 5 seconds

---

### Resource Monitoring

**Pattern:** Memory usage tracking with warning (87%) and critical (93%) thresholds, zombie process cleanup.

**Implementation:**

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

// Monitor every 30 seconds
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / (8 * 1024 * 1024 * 1024)) * 100;

  if (memPercent > 93) {
    logger.warn('Memory critical', { memPercent });
    resourceMonitor.blockNewSessions();
    broadcastWebSocket({ type: 'resource.warning', memoryUsagePercent: memPercent, isAcceptingNewSessions: false });
  } else if (memPercent > 87) {
    logger.warn('Memory warning', { memPercent });
    broadcastWebSocket({ type: 'resource.warning', memoryUsagePercent: memPercent, isAcceptingNewSessions: true });
  }
}, 30000);

// Zombie process cleanup (every 60s)
setInterval(() => {
  const zombies = findZombieProcesses();
  zombies.forEach(pid => {
    logger.warn('Cleaning up zombie process', { pid });
    process.kill(pid, 'SIGKILL');
  });
}, 60000);
```

**WebSocket Message:**
- `resource.warning` - High memory usage notification

---

### Graceful Shutdown

**Pattern:** SIGTERM handling with 5s PTY timeout, SIGKILL escalation, atomic session save, and 10s total window.

**Implementation:**

```typescript
// Graceful shutdown sequence
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  shutdownInProgress = true;

  // 1. Stop accepting new WebSocket connections
  wss.close();

  // 2. Broadcast shutdown notification to all clients
  broadcastWebSocket({ type: 'server.shutdown', gracePeriodMs: 5000 });

  // 3. Terminate all PTY processes (5s timeout)
  const ptyKillPromises = sessions.map(async (session) => {
    if (session.ptyPid) {
      logger.info('Sending SIGTERM to PTY', { sessionId: session.id, pid: session.ptyPid });
      process.kill(session.ptyPid, 'SIGTERM');

      // Wait up to 5s for graceful exit
      await waitForExit(session.ptyPid, 5000).catch(() => {
        logger.warn('PTY did not exit gracefully, sending SIGKILL', { sessionId: session.id, pid: session.ptyPid });
        process.kill(session.ptyPid, 'SIGKILL');
      });
    }
  });
  await Promise.all(ptyKillPromises);

  // 4. Save final session state atomically
  await saveSessionsAtomic(sessions);
  logger.info('Session state saved');

  // 5. Close all WebSocket connections
  wss.clients.forEach(ws => ws.close());

  // 6. Stop Express server
  server.close(() => {
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // 7. Force exit after 10s (Docker SIGKILL timeout)
  setTimeout(() => {
    logger.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
});
```

**WebSocket Message:**
- `server.shutdown` - Graceful shutdown notification (5s grace period)

---

### Keyboard Shortcut System

**Pattern:** Global keyboard handler with platform-aware modifiers (Cmd on macOS, Ctrl on Windows/Linux).

**Implementation:**

```typescript
interface KeyboardShortcut {
  key: string;
  modifiers: ('meta' | 'ctrl' | 'alt' | 'shift')[];
  action: string;
  description: string;
  enabled: boolean;
}

// Platform detection
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const cmdKey = isMac ? 'meta' : 'ctrl';

// Shortcut registry
const shortcuts: KeyboardShortcut[] = [
  { key: '1', modifiers: [cmdKey], action: 'switchSession1', description: 'Switch to session 1' },
  { key: '2', modifiers: [cmdKey], action: 'switchSession2', description: 'Switch to session 2' },
  { key: '3', modifiers: [cmdKey], action: 'switchSession3', description: 'Switch to session 3' },
  { key: '4', modifiers: [cmdKey], action: 'switchSession4', description: 'Switch to session 4' },
  { key: 'n', modifiers: [cmdKey], action: 'newSession', description: 'Create new session' },
  { key: 't', modifiers: [cmdKey], action: 'focusTerminal', description: 'Focus terminal (100%)' },
  { key: 'a', modifiers: [cmdKey], action: 'focusArtifact', description: 'Focus artifacts (70/30 split)' },
  { key: 'w', modifiers: [cmdKey], action: 'toggleSidebar', description: 'Toggle Files/Workflow view' },
  { key: 'Escape', modifiers: [], action: 'closeModal', description: 'Close modal' }
];

// Global handler (except when terminal has focus)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isTerminalFocused) return;  // Let terminal handle keys

    const matchedShortcut = shortcuts.find(s =>
      s.key === e.key &&
      s.modifiers.every(m => e.getModifierState(m)) &&
      s.enabled
    );

    if (matchedShortcut) {
      e.preventDefault();
      dispatchAction(matchedShortcut.action);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [shortcuts, isTerminalFocused]);
```

**Keyboard Shortcuts:**
- `Cmd+1-4` / `Ctrl+1-4` - Switch to session 1-4
- `Cmd+N` / `Ctrl+N` - Create new session
- `Cmd+T` / `Ctrl+T` - Focus terminal (100%)
- `Cmd+A` / `Ctrl+A` - Focus artifacts (70/30 split)
- `Cmd+W` / `Ctrl+W` - Toggle Files/Workflow sidebar view
- `ESC` - Close modal

---

### Accessibility Patterns

**Pattern:** WCAG AA compliance with ARIA labels, live regions, focus rings, and reduced motion support.

**Implementation:**

```typescript
// ARIA live regions for status announcements
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>

// Focus ring styling (2px #88C0D0)
const focusRingStyles = `
  :focus-visible {
    outline: 2px solid #88C0D0;
    outline-offset: 2px;
  }
`;

// Reduced motion support
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const animationStyles = prefersReducedMotion.matches
  ? { transition: 'none' }  // No animations
  : { transition: 'all 200ms ease-in-out' };

// Screen reader announcements
function announceStatusChange(sessionId: string, status: string) {
  const announcement = `Session ${sessionId} status changed to ${status}`;
  setStatusMessage(announcement);
  // Live region automatically announces to screen readers
}

// ARIA labels for interactive elements
<button aria-label="Create new session" onClick={handleNewSession}>
  <PlusIcon aria-hidden="true" />
</button>
```

**Accessibility Features:**
- **ARIA labels** - All interactive elements labeled
- **Focus rings** - 2px #88C0D0 outline on `:focus-visible`
- **Live regions** - Status changes announced to screen readers
- **Reduced motion** - Respects `prefers-reduced-motion` system preference
- **Color contrast** - All text meets WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)

---

### Performance Monitoring

**Pattern:** Backend tracks latency metrics, frontend measures render performance.

**Implementation:**

```typescript
// Backend: Performance monitoring
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordLatency(metric: string, latencyMs: number) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(latencyMs);
  }

  getP99(metric: string): number {
    const values = this.metrics.get(metric) || [];
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const index = Math.floor(values.length * 0.99);
    return values[index];
  }
}

// Terminal latency measurement
ptyProcess.onData((data) => {
  const start = performance.now();
  ws.send(JSON.stringify({ type: 'terminal.output', sessionId, data }));
  const end = performance.now();
  perfMonitor.recordLatency('terminal_output_latency', end - start);
});

// Frontend: Render performance
const [renderTime, setRenderTime] = useState(0);

useEffect(() => {
  const start = performance.now();
  // ... render logic
  const end = performance.now();
  setRenderTime(end - start);

  if (end - start > 100) {
    logger.warn('Slow render', { component: 'Terminal', renderTime: end - start });
  }
}, [deps]);
```

**Performance Targets (NFRs):**
- Terminal latency p99 <100ms
- Tab switch <50ms
- Session creation <5s
- 4 concurrent sessions without degradation
- Bundle size <500KB gzipped

---

## Architecture Decision Records (Epic 4)

### ADR-018: Toast Notification System (Radix UI Toast vs Sonner)

**Decision:** Use Radix UI Toast (@radix-ui/react-toast) instead of Sonner.

**Rationale:**
- Radix UI already used for other components (Tooltip, Dialog)
- Full control over styling and behavior
- Headless component pattern allows Oceanic Calm theme customization
- Lightweight (~15KB) compared to full-featured Sonner
- Stacking and auto-dismiss implemented manually for exact UX requirements

**Consequences:**
- More implementation work (stacking, duplicate prevention)
- Full control over animations and timing
- Consistent with existing UI component architecture
- No external dependency on Sonner

---

### ADR-019: Session Status Detection (Heuristics for Idle/Waiting States)

**Decision:** Use time-based heuristics and PTY output pattern matching instead of Claude CLI API integration.

**Rationale:**
- Claude CLI doesn't expose internal state via API
- PTY output is only reliable signal of activity
- Heuristics: 5min idle, 30min stuck, output ending with "?" = waiting
- False positives acceptable (users can override via manual actions)

**Consequences:**
- Idle detection: Simple and reliable (5min no output)
- Stuck detection: May miss edge cases (long-running silent operations)
- Waiting detection: "?" pattern may have false positives (rhetorical questions)
- Trade-off: Simplicity and reliability over perfect accuracy

---

### ADR-020: Resource Monitoring Strategy (Memory Thresholds, Zombie Cleanup)

**Decision:** Use 87% warning, 93% critical memory thresholds with zombie process cleanup every 60s.

**Rationale:**
- 87% warning: Early warning with time to close sessions
- 93% critical: Block new sessions to prevent OOM
- Docker memory limit (8GB default) provides hard backstop
- Zombie cleanup: PTY crashes can leave defunct processes

**Consequences:**
- Conservative thresholds prevent OOM crashes
- Users warned before reaching critical state
- 4-session design limit enforced via resource monitoring
- Zombie cleanup prevents slow memory leak

---

### ADR-021: Graceful Shutdown Pattern (SIGTERM Handling)

**Decision:** Implement graceful shutdown with 5s PTY timeout, SIGKILL escalation, and 10s total window.

**Rationale:**
- Docker sends SIGTERM, waits 10s, then sends SIGKILL
- PTY processes need time to flush output and clean up
- Session state must persist atomically (temp + rename)
- 10s window ensures all cleanup completes before Docker SIGKILL

**Consequences:**
- Graceful shutdown completes <10s in normal cases
- PTY processes exit cleanly (SIGTERM → wait → SIGKILL fallback)
- Session state always saved (atomic writes prevent corruption)
- WebSocket clients notified 5s before shutdown

---

### ADR-022: Keyboard Shortcut System (Global vs Component-Level)

**Decision:** Use global keyboard handler with platform-aware modifiers instead of component-level handlers.

**Rationale:**
- Global handler: Single source of truth for all shortcuts
- Platform detection: Cmd on macOS, Ctrl on Windows/Linux
- Terminal exception: Let terminal handle keys when focused
- Consistent UX: All shortcuts work from any UI location

**Consequences:**
- Single `useKeyboardShortcuts` hook
- Platform-aware modifier logic centralized
- Terminal focus detection prevents shortcut conflicts
- Easy to add new shortcuts (registry pattern)

---

### ADR-023: Accessibility Implementation (WCAG AA Compliance Approach)

**Decision:** WCAG AA compliance via ARIA labels, focus rings, live regions, and reduced motion support.

**Rationale:**
- WCAG AA standard for professional developer tools
- ARIA labels: Screen reader compatibility
- Focus rings: Keyboard navigation visibility
- Live regions: Status change announcements
- Reduced motion: Respect user preferences

**Consequences:**
- Accessible to users with disabilities
- Keyboard navigation fully supported
- Screen readers announce all state changes
- Animations disabled for users with motion sensitivity
- Manual testing required (axe-core for automated checks)

---

## Technology Stack Updates (Epic 4)

**Frontend Dependencies (No New Additions):**
- All Epic 4 features implemented with existing dependencies
- `@radix-ui/react-toast` (already installed in Epic 3)
- `@radix-ui/react-tooltip` (already installed in Epic 3)

**Backend Dependencies (No New Additions):**
- All Epic 4 features implemented with existing dependencies
- `winston` (logging)
- `ws` (WebSocket)
- `node-pty` (PTY management)

**Browser APIs Used (Epic 4):**
- `Notification` - Browser notifications for background sessions
- `performance.now()` - High-resolution timestamps for latency measurement
- `window.matchMedia('(prefers-reduced-motion)')` - Detect reduced motion preference

---

## Performance Considerations (Epic 4)

**Bundle Size Optimization:**
- Code splitting: Lazy load WorkflowDiagram and non-essential components with `React.lazy()`
- Tree shaking: Ensure unused code eliminated in production build
- Target: <500KB gzipped initial load

**React Rendering Optimization:**
- Context splitting: Separate contexts prevent unnecessary re-renders
- React concurrent features: Use transitions for non-urgent updates
- Memoization: `useMemo` and `useCallback` for expensive computations

**WebSocket Backpressure Handling:**
- Monitor `ws.bufferedAmount` every 100ms
- Pause PTY reading if buffer >1MB
- Resume PTY reading when buffer <100KB
- Drop oldest 50% of buffer if >10MB for 10s (prevent OOM)

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-11-24_
_Updated: 2025-11-26 (Epic 4 patterns and ADRs added)_
_For: Kyle_
