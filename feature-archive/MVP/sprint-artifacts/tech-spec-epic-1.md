# Epic Technical Specification: Foundation & Single-Session Terminal

Date: 2025-11-24
Author: Kyle
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 establishes the foundational infrastructure for Claude Container - a Docker-based development environment that enables autonomous AI-assisted development by eliminating tool approval friction. This epic delivers a browser-based terminal interface where Claude CLI runs unrestricted within a sandboxed container, enabling developers to assign tasks and walk away while Claude executes commands autonomously.

The technical implementation centers on three core components: (1) a Docker container with comprehensive development tooling (Python 3.13, Java 21, Node.js, git, build-essential), (2) a Node.js/Express backend managing PTY processes and WebSocket streaming, and (3) a React/xterm.js frontend delivering real-time terminal interaction in the browser. This foundation solves the primary pain point identified in the PRD: "Daily friction with tool approvals blocks autonomous epic completion."

## Objectives and Scope

### In Scope

**Primary Objectives:**
- Deliver working browser-based Claude CLI terminal eliminating manual tool approvals (FR6, FR21-FR28)
- Establish complete development environment supporting emassistant (Python 3.13) and work projects (Java 21) (FR1)
- Implement real-time terminal streaming with <100ms latency via WebSocket (NFR-PERF-1)
- Enable single Claude session with full TTY emulation (colors, cursor control, signals) (FR25)
- Provide ESC key and STOP button for immediate interrupt capability (FR26-FR27, ADR-011)

**Technical Deliverables:**
- Docker container with Ubuntu 22.04 + multi-language development stack (Story 1.1)
- Volume mounts: workspace (RW) + Claude config (RO) (Story 1.2, FR2-FR3)
- Express backend with WebSocket server and PTY process management (Stories 1.3-1.5)
- React frontend with xterm.js terminal component and shadcn/ui components (Stories 1.6-1.9)
- Complete container startup pipeline with single `docker run` command (Story 1.10, NFR-USE-1)

**Validation Criteria (Story 1.12):**
- Can run complete epic in browser without approval prompts
- Python 3.13 projects execute successfully (pytest, pip)
- Java 21 projects compile and build (Maven/Gradle)
- Container startup completes within 30 seconds (NFR-PERF-3)

### Out of Scope (Deferred to Epic 2+)

- Multi-session support (Epic 2: 4 concurrent sessions with git worktrees)
- Session persistence across container restarts (Epic 2: JSON state management)
- BMAD workflow visualization (Epic 3: workflow status parsing and UI)
- Document/artifact viewing (Epic 3: markdown renderer, file browser)
- Browser notifications and advanced status indicators (Epic 3-4)
- Session resume functionality (Epic 4: manual resume after crashes)

## System Architecture Alignment

Epic 1 implements the foundational layer of the three-tier architecture defined in the Architecture document:

### Architecture Components Referenced

**Container Layer (ADR-001: Single Container):**
- Ubuntu 22.04 LTS base image provides stable, long-term support foundation
- Comprehensive development environment (Python 3.13, Amazon Corretto 21, Node.js 20 LTS, git, build-essential) per ADR-009
- Docker isolation ensures host system safety while allowing unrestricted tool access (ADR-008)
- Volume mounts: `/workspace` (RW) for code modification, `/config/.claude-code` (RO) for API keys (FR2-FR3)

**Backend Layer (Architecture "Backend Stack"):**
- Express 4.x HTTP server serves static frontend and provides REST endpoints
- ws 8.x library handles WebSocket connections for bidirectional terminal streaming (ADR-004)
- node-pty 1.x spawns Claude CLI with proper TTY emulation (ADR-004, xterm-256color terminal type)
- Single backend process manages PTY lifecycle and WebSocket streaming per architecture pattern

**Frontend Layer (Architecture "Frontend Stack"):**
- React 19 + TypeScript 5.x for component-based UI with type safety
- Vite 6.x provides instant HMR and optimized production builds (ADR-002)
- xterm.js 5.x delivers full terminal emulation with canvas renderer (ADR-006)
- shadcn/ui components (Button, Tabs, Dialog) styled with Oceanic Calm theme from UX spec
- Tailwind CSS 4.0 for utility-first styling matching terminal-centric design

### Architecture Constraints Satisfied

**Performance (Architecture "Performance Considerations"):**
- Terminal streaming: 16ms buffering (60fps equivalent) achieves <100ms latency target
- WebSocket binary frames for PTY output (faster than JSON encoding)
- xterm.js canvas renderer with hardware acceleration
- Frontend code splitting via React.lazy() for optimal initial load

**Security (Architecture "Security Architecture"):**
- Docker container isolation prevents host system access (threat model: container escape)
- Path validation ensures file operations stay within `/workspace` (path traversal protection)
- react-markdown for safe artifact rendering (XSS prevention)
- Read-only Claude config mount prevents accidental API key corruption

**Reliability (Architecture "Error Handling"):**
- Winston structured logging for debugging PTY failures
- Graceful shutdown on SIGTERM (closes WebSocket connections, kills PTY processes)
- Atomic file writes pattern ready for Epic 2 session persistence

### Deviations from Full Architecture

Epic 1 implements a **subset** of the complete architecture:
- **Implemented:** Single session, basic UI layout, terminal streaming, interrupt handling
- **Deferred to Epic 2:** Session management, git worktrees, JSON persistence, multiple PTY processes
- **Deferred to Epic 3:** File watcher, BMAD status parser, artifact viewer, workflow visualization
- **Deferred to Epic 4:** Auto-reconnection, session resume, resource monitoring

This incremental approach follows Architecture pattern: "Simple first, scale later."

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner/Location |
|--------|---------------|---------|---------|----------------|
| **server.ts** | Express app initialization, WebSocket server setup, static file serving | Environment config, port 3000 | HTTP server, WebSocket endpoint | `backend/src/server.ts` |
| **ptyManager.ts** | Spawn Claude CLI via node-pty, manage PTY lifecycle, handle process exit | Session config (cwd, env), terminal size | PTY process handle, stdout/stderr streams | `backend/src/ptyManager.ts` |
| **Terminal.tsx** | xterm.js wrapper, WebSocket client, keyboard input handling | sessionId, websocketUrl | Terminal UI, user input events | `frontend/src/components/Terminal.tsx` |
| **App.tsx** | Root React component, layout structure, session state | None (entry point) | Complete UI render tree | `frontend/src/App.tsx` |
| **Dockerfile** | Container image definition, multi-stage build, dev environment setup | Base image (Ubuntu 22.04), package manifests | Built container image | `Dockerfile` |

**Module Interactions:**
1. **Container Startup:** Dockerfile → Express server starts → Spawns initial Claude PTY process
2. **Browser Access:** User navigates to localhost:3000 → Express serves built React app
3. **WebSocket Handshake:** Frontend Terminal component → Connects to ws://localhost:3000
4. **Terminal Streaming:** Claude PTY output → ptyManager → WebSocket → Terminal component → xterm.js render
5. **User Input:** Keyboard event → Terminal component → WebSocket → ptyManager → PTY stdin
6. **Interrupt:** ESC key or STOP button → WebSocket interrupt message → ptyManager sends SIGINT to PTY

### Data Models and Contracts

**WebSocket Message Protocol (Architecture "API Contracts - WebSocket Protocol"):**

```typescript
// Client → Server Messages
type ClientMessage =
  | { type: 'terminal.input', data: string }           // User typed character
  | { type: 'terminal.interrupt' }                     // ESC key or STOP button
  | { type: 'heartbeat', timestamp: number };          // Keep-alive ping

// Server → Client Messages
type ServerMessage =
  | { type: 'terminal.output', data: string }          // PTY stdout/stderr
  | { type: 'terminal.ready' }                         // Claude CLI prompt ready
  | { type: 'error', message: string, code?: string }  // Fatal errors
  | { type: 'heartbeat', timestamp: number };          // Keep-alive pong
```

**PTY Process Configuration:**

```typescript
interface PTYConfig {
  name: 'xterm-256color';        // Terminal type for color support
  cols: 80;                       // Initial columns (resizable later)
  rows: 24;                       // Initial rows (resizable later)
  cwd: '/workspace';              // Working directory (mounted host project)
  env: ProcessEnv;                // Inherited from container environment
}
```

**Terminal Component Props:**

```typescript
interface TerminalProps {
  websocketUrl: string;           // ws://localhost:3000
  onInterrupt: () => void;        // Callback for STOP button
  readonly?: boolean;             // Disable input (future feature)
}
```

**xterm.js Theme Configuration (UX Spec "Oceanic Calm"):**

```typescript
const xtermTheme = {
  background: '#2E3440',          // Main background
  foreground: '#D8DEE9',          // Text color
  cursor: '#88C0D0',              // Cursor color (primary)
  cursorAccent: '#2E3440',        // Cursor text color
  selection: 'rgba(136, 192, 208, 0.3)',  // Selection highlight
  black: '#3B4252',
  red: '#BF616A',
  green: '#A3BE8C',
  yellow: '#EBCB8B',
  blue: '#88C0D0',
  magenta: '#B48EAD',
  cyan: '#8FBCBB',
  white: '#D8DEE9',
  // Bright variants
  brightBlack: '#4C566A',
  brightRed: '#BF616A',
  brightGreen: '#A3BE8C',
  brightYellow: '#EBCB8B',
  brightBlue: '#81A1C1',
  brightMagenta: '#B48EAD',
  brightCyan: '#88C0D0',
  brightWhite: '#ECEFF4'
};
```

**Note:** Epic 1 does not persist session state to disk. Session persistence (JSON file format) defined in Epic 2 Architecture.

### APIs and Interfaces

**HTTP Endpoints:**

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET | `/` | None | HTML (index.html) | Serve React frontend |
| GET | `/assets/*` | None | Static files (JS, CSS) | Serve built frontend assets |
| GET | `/api/health` | None | `{ status: 'ok', uptime: number }` | Health check endpoint |
| GET | `/api/version` | None | `{ version: string, buildDate: string }` | Version information |

**WebSocket Endpoint:**

- **URL:** `ws://localhost:3000`
- **Protocol:** JSON messages for control, raw text for terminal I/O
- **Connection Lifecycle:**
  1. Client opens WebSocket connection
  2. Server sends `terminal.ready` message when Claude CLI prompt appears
  3. Client sends `terminal.input` for each keystroke
  4. Server streams `terminal.output` as Claude generates output
  5. Heartbeat messages exchanged every 30 seconds
  6. Client can send `terminal.interrupt` to SIGINT Claude process

**PTY Manager Interface:**

```typescript
class PTYManager {
  // Spawn Claude CLI process with TTY emulation
  spawn(command: string, args: string[], config: PTYConfig): PTYProcess;

  // Write data to PTY stdin
  write(ptyProcess: PTYProcess, data: string): void;

  // Send signal to PTY process
  kill(ptyProcess: PTYProcess, signal: 'SIGINT' | 'SIGTERM'): void;

  // Register callback for PTY output
  onData(ptyProcess: PTYProcess, callback: (data: string) => void): void;

  // Register callback for PTY exit
  onExit(ptyProcess: PTYProcess, callback: (code: number, signal?: number) => void): void;
}
```

**Terminal Component Interface:**

```typescript
class Terminal extends React.Component<TerminalProps> {
  // Initialize xterm.js terminal
  componentDidMount(): void;

  // Connect to WebSocket, attach event handlers
  connectWebSocket(): void;

  // Handle keyboard input, send to backend
  handleInput(data: string): void;

  // Handle interrupt signal (ESC key or STOP button)
  handleInterrupt(): void;

  // Clean up terminal and WebSocket on unmount
  componentWillUnmount(): void;
}
```

**Error Handling Patterns:**

```typescript
// Backend WebSocket errors
ws.on('error', (error) => {
  logger.error('WebSocket error', { error: error.message, stack: error.stack });
  ws.close(1011, 'Internal server error');
});

// PTY spawn errors
try {
  const ptyProcess = pty.spawn('claude', [], config);
} catch (error) {
  logger.error('PTY spawn failed', { error });
  ws.send(JSON.stringify({
    type: 'error',
    message: 'Failed to start Claude CLI',
    code: 'PTY_SPAWN_ERROR'
  }));
}

// Frontend WebSocket errors
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  showToast('Connection error', 'error');
  // Auto-reconnect deferred to Epic 4
};
```

### Workflows and Sequencing

**Sequence 1: Container Startup & Initial Session**

```
[User] docker run -v $(pwd):/workspace -v ~/.config/claude-code:/config/.claude-code:ro -p 3000:3000 claude-container
   ↓
[Container] Ubuntu 22.04 starts, Express server initializes (server.ts)
   ↓
[Backend] Spawns Claude CLI process via node-pty in /workspace directory
   ↓
[Backend] Claude CLI loads, displays prompt, writes to PTY stdout
   ↓
[Backend] WebSocket server listening on port 3000
   ↓
[User] Opens browser to http://localhost:3000
   ↓
[Backend] Express serves index.html + React bundle from /app/frontend/dist
   ↓
[Frontend] React app mounts, Terminal component initializes xterm.js
   ↓
[Frontend] Opens WebSocket connection to ws://localhost:3000
   ↓
[Backend] Accepts WebSocket connection, streams buffered PTY output
   ↓
[Frontend] xterm.js renders terminal with Claude prompt visible
   ↓
[Result] User sees "Claude CLI ready" in browser terminal
```

**Sequence 2: User Input Flow**

```
[User] Types "help" + Enter in browser terminal
   ↓
[Frontend] xterm.js captures keypress events ('h', 'e', 'l', 'p', '\n')
   ↓
[Frontend] Terminal component sends WebSocket messages:
            { type: 'terminal.input', data: 'h' }
            { type: 'terminal.input', data: 'e' }
            { type: 'terminal.input', data: 'l' }
            { type: 'terminal.input', data: 'p' }
            { type: 'terminal.input', data: '\n' }
   ↓
[Backend] Receives WebSocket messages, writes to PTY stdin: "help\n"
   ↓
[Claude CLI] Receives input, processes command, generates help text output
   ↓
[Backend] PTY onData callback fires with Claude output chunks
   ↓
[Backend] Buffers output for 16ms, sends WebSocket message:
            { type: 'terminal.output', data: '[help text...]' }
   ↓
[Frontend] Receives WebSocket message, writes to xterm.js: terminal.write(data)
   ↓
[Frontend] xterm.js renders output with ANSI colors, cursor positioning
   ↓
[Result] User sees Claude's help text rendered in terminal (<100ms latency)
```

**Sequence 3: Interrupt Flow (ESC Key or STOP Button)**

```
[User] Presses ESC key (or clicks red STOP button) while Claude executing long operation
   ↓
[Frontend] Keyboard handler captures ESC key event
   ↓
[Frontend] Sends WebSocket message: { type: 'terminal.interrupt' }
   ↓
[Frontend] Displays "Interrupting..." indicator briefly
   ↓
[Backend] Receives interrupt message
   ↓
[Backend] Sends SIGINT to PTY process: ptyProcess.kill('SIGINT')
   ↓
[Claude CLI] Receives SIGINT signal, stops current operation
   ↓
[Claude CLI] Writes "^C" to terminal, returns to prompt
   ↓
[Backend] PTY streams output containing interrupt confirmation
   ↓
[Frontend] xterm.js renders "^C" and new prompt
   ↓
[Result] Claude interrupted, prompt ready for new input (typically <500ms)
```

**Sequence 4: Graceful Shutdown**

```
[User] Stops container: docker stop claude-container
   ↓
[Container] Receives SIGTERM signal
   ↓
[Backend] server.ts SIGTERM handler triggered
   ↓
[Backend] Closes all WebSocket connections gracefully
   ↓
[Frontend] WebSocket onclose event fires, terminal shows "Connection closed"
   ↓
[Backend] Sends SIGTERM to Claude PTY process
   ↓
[Backend] Waits up to 5 seconds for Claude CLI to exit gracefully
   ↓
[Backend] If Claude still running after 5s, sends SIGKILL
   ↓
[Backend] Express server closes HTTP listener
   ↓
[Container] Node.js process exits with code 0
   ↓
[Result] Clean shutdown, no orphaned processes
```

## Non-Functional Requirements

### Performance

**NFR-PERF-1: Real-Time Terminal Latency (<100ms)**
- **Target:** Terminal output appears in browser within 100ms of Claude CLI generating it
- **Implementation:** 16ms buffering (60fps equivalent) + WebSocket binary frames for PTY data
- **Measurement:** `performance.now()` timestamps comparing PTY stdout event to xterm.js render
- **Source:** PRD NFR-PERF-1, critical for natural terminal interaction feel

**NFR-PERF-2: UI Responsiveness**
- **Button clicks:** <200ms response (primary action feedback)
- **Keyboard input:** Immediate echo to terminal (no perceptible delay)
- **STOP button:** Interrupt signal sent within 50ms of click
- **Source:** PRD NFR-PERF-2, maintains responsive developer workflow

**NFR-PERF-3: Container Startup Time (<30 seconds)**
- **Docker image build:** Optimized layer caching (apt-get → language runtimes → npm install → source code)
- **Container start to Claude prompt:** Express initialization + PTY spawn + WebSocket ready = ~10-15 seconds typical
- **Frontend load:** Vite optimized bundle (<500KB gzipped) + code splitting for <3s initial render
- **Source:** PRD NFR-PERF-3, acceptable one-time cost for daily-use infrastructure

**Terminal Rendering Optimization:**
- xterm.js canvas renderer (GPU-accelerated, faster than DOM)
- Scrollback buffer: 1000 lines (balance memory vs. history)
- Throttle high-volume output: If >10,000 lines/sec, batch rendering to prevent UI freeze
- WebGL renderer consideration deferred to Epic 4 (performance optimization sprint)

### Security

**NFR-SEC-1: Container Isolation (Core Security Boundary)**
- **Docker filesystem isolation:** Commands within container cannot access host filesystem (except mounted volumes)
- **Threat mitigated:** Container escape attempts, malicious code execution
- **Validation:** Run `rm -rf /` inside container → Only container filesystem affected, host untouched
- **Source:** PRD NFR-SEC-1, Architecture "Security Architecture - Threat Model"

**NFR-SEC-2: Volume Mount Safety**
- **Workspace mount (RW):** `/workspace` ← host project directory, Claude CLI can modify files (intentional)
- **Config mount (RO):** `/config/.claude-code` ← read-only prevents accidental API key corruption
- **No additional mounts:** No `/tmp`, `/var`, or other host directories exposed
- **Source:** PRD NFR-SEC-2, ADR-002 (BMAD in workspace, not separate mount)

**NFR-SEC-3: Single-User Local Security Model**
- **No authentication:** Tool runs on localhost:3000, assumes trusted local user
- **No TLS/HTTPS:** WebSocket uses `ws://` not `wss://` (localhost only)
- **Network binding:** Express binds to `0.0.0.0:3000` inside container, host exposes as `127.0.0.1:3000`
- **Rationale:** Personal development tool, not multi-user service or internet-facing application
- **Source:** PRD NFR-SEC-3, Architecture "Security Architecture - Out-of-Scope Threats"

**XSS Prevention (Future Epic 3):**
- react-markdown library (safe by default, no `dangerouslySetInnerHTML`)
- Epic 1 has no user-generated content rendering beyond terminal (xterm.js handles escaping)

**Command Audit Logging (Observability, Not Security):**
- Winston structured logs capture all PTY commands for debugging
- Not access control mechanism, just operational visibility
- Logs stored in container (ephemeral unless volume mounted for persistence)

### Reliability/Availability

**NFR-REL-1: Infrastructure Stability (Rock-Solid Requirement)**
- **Target:** Container runs continuously for multi-day development sessions without restart
- **Implementation:**
  - Robust error handling in PTY manager (catch spawn errors, handle unexpected exits)
  - Winston logging captures all error conditions for post-mortem debugging
  - Graceful shutdown on SIGTERM (5-second timeout for Claude CLI to exit)
- **Epic 1 Limitation:** Single session only, no automatic recovery if Claude crashes (user restarts container)
- **Epic 2 Enhancement:** Session persistence enables recovery without full container restart
- **Source:** PRD NFR-REL-1, "This becomes THE PRIMARY WORKFLOW" = stability is non-negotiable

**NFR-REL-2: Crash Isolation (Single Session in Epic 1)**
- **Epic 1 Scope:** Only one Claude session, so crash affects entire container
- **Mitigation:** User can restart container via `docker restart claude-container`, loses work in progress
- **Epic 2 Solution:** Multiple sessions isolated via separate PTY processes, one crash doesn't affect others
- **Source:** PRD NFR-REL-2, full implementation deferred to multi-session architecture

**NFR-REL-4: Graceful Degradation**
- **Core terminal functionality:** Always available, even if optional features fail
- **Error scenarios handled:**
  - PTY spawn failure → Display error message in UI, suggest troubleshooting steps
  - WebSocket disconnect → Show "Connection lost" banner (auto-reconnect in Epic 4)
  - Frontend build errors → Express serves 500 error page with diagnostic info
- **Non-blocking failures:** Winston logging errors don't crash server
- **Source:** PRD NFR-REL-4, terminal emulation is critical path

**Container Health Monitoring (Epic 4):**
- Epic 1: No automated health checks beyond `/api/health` endpoint
- Future: Watchdog process, automatic restart on hang detection, resource monitoring

### Observability

**Structured Logging (Winston with JSON Format)**

Log levels and usage:
- **error:** PTY spawn failures, WebSocket errors, unhandled exceptions → Requires attention
- **warn:** High memory usage (>80%), slow startup (>45s), unusual conditions → Investigate if recurring
- **info:** Container startup, PTY process spawned, WebSocket connections, graceful shutdown → Operational events
- **debug:** WebSocket message traffic, PTY output chunks, terminal input events → Disabled in production (verbose)

**Log Format:**
```json
{
  "timestamp": "2025-11-24T10:30:00.123Z",
  "level": "error",
  "message": "PTY process crashed",
  "ptyPid": 12345,
  "exitCode": 1,
  "signal": null,
  "cwd": "/workspace",
  "command": "claude",
  "stack": "Error: ..."
}
```

**Key Observability Signals:**

1. **Container Lifecycle Events**
   - `info: Express server listening on port 3000`
   - `info: Claude CLI spawned, pid: 12345`
   - `info: Graceful shutdown initiated`

2. **Error Conditions**
   - `error: PTY spawn failed` → Check Claude CLI installation, permissions
   - `error: WebSocket error` → Client disconnect, network issue
   - `error: Unhandled exception` → Code bug, needs fix

3. **Performance Metrics (Future Enhancement)**
   - WebSocket message latency (p50, p95, p99)
   - Terminal rendering FPS
   - PTY stdout throughput (bytes/sec)
   - Container memory/CPU usage

**Log Destinations:**
- **stdout/stderr:** Docker captures automatically via `docker logs claude-container`
- **File logging (optional):** Epic 2+ can mount `/workspace/logs` for persistent logs
- **Log aggregation:** Out of scope for Epic 1 (local tool, not cloud deployment)

**Developer Debugging:**
- `docker logs -f claude-container` → Real-time log streaming
- `docker exec -it claude-container bash` → Interactive debugging inside container
- Browser DevTools console → Frontend errors, WebSocket traffic inspection

## Dependencies and Integrations

### Backend Dependencies (Node.js)

**Core Runtime:**
- **Node.js:** 20 LTS (Long-term support, stable API)
- **npm:** Bundled with Node.js, package management

**Production Dependencies:**
```json
{
  "express": "^4.18.0",           // HTTP server, static file serving
  "ws": "^8.14.0",                 // WebSocket library for terminal streaming
  "node-pty": "^1.0.0",            // PTY (pseudo-terminal) for Claude CLI
  "winston": "^3.11.0",            // Structured JSON logging
  "uuid": "^9.0.0"                 // Session ID generation (Epic 2+)
}
```

**Development Dependencies:**
```json
{
  "typescript": "^5.3.0",          // Type safety for backend code
  "@types/node": "^20.10.0",       // Node.js type definitions
  "@types/express": "^4.17.0",     // Express type definitions
  "@types/ws": "^8.5.0",           // WebSocket type definitions
  "nodemon": "^3.0.0",             // Dev server auto-reload
  "jest": "^29.7.0",               // Backend unit testing
  "@types/jest": "^29.5.0",        // Jest type definitions
  "ts-jest": "^29.1.0",            // TypeScript Jest transformer
  "eslint": "^8.55.0",             // Code linting
  "@typescript-eslint/parser": "^6.15.0",
  "@typescript-eslint/eslint-plugin": "^6.15.0"
}
```

### Frontend Dependencies (React)

**Core Runtime:**
- **React:** 19.x (Latest stable with concurrent features)
- **React DOM:** 19.x (Browser rendering)

**Build Tool:**
- **Vite:** 6.x (Fast HMR, optimized builds, ADR-002)

**Production Dependencies:**
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "xterm": "^5.3.0",               // Terminal emulator
  "xterm-addon-fit": "^0.8.0",     // Terminal auto-sizing
  "xterm-addon-web-links": "^0.9.0", // Clickable URLs in terminal
  "xterm-addon-screen-reader-mode": "^0.1.0", // Accessibility
  "lucide-react": "^0.294.0",      // Icon library (matches shadcn/ui)
  "clsx": "^2.0.0",                // Utility class merging
  "tailwind-merge": "^2.2.0"       // Tailwind class merging
}
```

**Development Dependencies:**
```json
{
  "typescript": "^5.3.0",
  "@vitejs/plugin-react": "^4.2.0",
  "tailwindcss": "^4.0.0",         // Utility-first CSS
  "@tailwindcss/vite": "^4.0.0",   // Tailwind Vite plugin
  "vite": "^6.0.0",
  "vitest": "^1.0.0",              // Unit testing (Vite-native)
  "@testing-library/react": "^14.1.0",
  "@testing-library/jest-dom": "^6.1.0",
  "@testing-library/user-event": "^14.5.0",
  "eslint": "^8.55.0",
  "@typescript-eslint/parser": "^6.15.0",
  "@typescript-eslint/eslint-plugin": "^6.15.0",
  "prettier": "^3.1.0"
}
```

**shadcn/ui Components (Copied, Not Installed):**
- Button, Tabs, Dialog, Resizable, Badge, Dropdown Menu, Scroll Area, Separator, Tooltip
- Installed via: `npx shadcn-ui@latest add [component]`
- Source: https://ui.shadcn.com/

### Container System Dependencies (Docker Image)

**Base Image:**
- **Ubuntu:** 22.04 LTS (`ubuntu:22.04`)

**System Packages (apt-get):**
```dockerfile
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    jq \
    build-essential \      # gcc, g++, make for native modules
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*
```

**Python Environment:**
- **Python:** 3.13 (latest stable, required for emassistant validation)
- **pip:** Latest (bundled with Python 3.13)
- **Installation:** `apt-get install python3.13 python3-pip`

**Java Environment:**
- **Amazon Corretto 21:** OpenJDK 21 distribution
- **Installation:** Add Corretto apt repository, `apt-get install java-21-amazon-corretto-jdk`
- **Alternative:** `openjdk-21-jdk` (if Corretto unavailable)

**Node.js Environment (Container):**
- **Node.js:** 20 LTS (matches backend requirement)
- **Installation:** NodeSource repository, `apt-get install nodejs`
- **npm:** Bundled with Node.js

**Claude CLI:**
- **Installation:** `npm install -g @anthropic-ai/claude-cli` (or latest installation method)
- **Config:** Mounted from host `~/.config/claude-code` → container `/config/.claude-code`

### External Integrations

**Claude API (via Claude CLI):**
- **Integration Point:** Claude CLI communicates with Anthropic API
- **Authentication:** API key from `/config/.claude-code/config.json` (mounted read-only)
- **Network:** Container requires internet access for Claude API calls
- **Rate Limits:** Managed by Claude CLI, not container's responsibility

**Git (Version Control):**
- **Usage:** Claude CLI executes git commands within `/workspace`
- **Configuration:** User's git config in `/workspace/.git/config`
- **Epic 1:** Basic git operations (commit, status, diff)
- **Epic 2:** Advanced git worktree management for multi-session isolation

**Docker Host:**
- **Volume Mounts:** Docker daemon mounts host directories into container
- **Port Mapping:** Docker forwards host `localhost:3000` → container port `3000`
- **No Docker-in-Docker:** Container does not spawn additional Docker containers

### Dependency Version Strategy

**Locked Versions (package-lock.json / package.json):**
- All dependencies use semantic versioning with caret (`^`) for minor/patch updates
- Major versions locked to prevent breaking changes
- `npm ci` in Dockerfile ensures reproducible builds

**Container Base Image:**
- Ubuntu 22.04 LTS pinned (`ubuntu:22.04`) for stability
- Language runtimes (Python 3.13, Java 21) installed from official sources
- Docker image tagged with version: `claude-container:1.0.0`

**Update Strategy:**
- Security patches: Applied via `apt-get upgrade` in CI/CD builds
- npm dependencies: Updated monthly, tested before deployment
- Node.js/Python/Java: Upgrade to new LTS versions between major epic releases

## Acceptance Criteria (Authoritative)

These criteria define "done" for Epic 1. All must pass for epic completion.

### AC1: Docker Container with Complete Dev Environment

**Given** a Dockerfile in repository root
**When** built with `docker build -t claude-container .`
**Then** the container includes:
- Ubuntu 22.04 LTS base image
- Python 3.13 (`python3 --version` outputs 3.13.x)
- Amazon Corretto 21 or OpenJDK 21 (`java --version` outputs 21.x)
- Node.js 20 LTS (`node --version` outputs v20.x)
- git, jq, curl, wget, build-essential installed
- Claude CLI accessible as `claude` command

**Validation:** Run `docker run claude-container python3 --version && java --version && node --version && git --version && claude --version` → All commands succeed

### AC2: Volume Mounts Function Correctly

**Given** host project at `~/my-project` and Claude config at `~/.config/claude-code`
**When** container started with `-v ~/my-project:/workspace -v ~/.config/claude-code:/config/.claude-code:ro`
**Then**:
- Files in `~/my-project` visible at `/workspace` inside container
- Changes made in `/workspace` persist to `~/my-project` on host
- Claude config readable at `/config/.claude-code` but not writable
- Claude CLI can read API keys from config

**Validation:** Create test file in container `/workspace/test.txt`, verify appears on host; attempt `touch /config/.claude-code/test` fails with permission error

### AC3: Backend Server Starts and Serves Frontend

**Given** container running
**When** backend server starts on port 3000
**Then**:
- Express HTTP server listening
- WebSocket server listening on same port
- `GET /` returns React frontend HTML
- `GET /api/health` returns `{ status: 'ok', uptime: <number> }`
- `docker logs claude-container` shows "Express server listening on port 3000"

**Validation:** `curl http://localhost:3000` returns HTML with React root div; `curl http://localhost:3000/api/health` returns JSON

### AC4: Claude CLI Spawns as PTY Process

**Given** backend server running
**When** server initializes
**Then**:
- Claude CLI spawned via node-pty with xterm-256color terminal type
- PTY process working directory is `/workspace`
- PTY stdout/stderr captured by backend
- Claude prompt visible in terminal output
- PTY responds to stdin writes

**Validation:** Backend logs show "Claude CLI spawned, pid: <number>"; WebSocket streams Claude prompt to connected clients

### AC5: WebSocket Terminal Streaming Works

**Given** Claude CLI PTY running and WebSocket server listening
**When** frontend connects to `ws://localhost:3000`
**Then**:
- WebSocket connection established successfully
- Server sends `terminal.output` messages with PTY stdout
- Frontend sends `terminal.input` messages for keystrokes
- Backend writes input to PTY stdin
- Terminal output appears in browser within 100ms (NFR-PERF-1)
- Heartbeat messages exchanged every 30 seconds

**Validation:** Type "help" in browser terminal → Claude responds with help text; measure latency <100ms

### AC6: React Frontend Renders Terminal UI

**Given** Vite build completes and Express serves static files
**When** browser accesses `http://localhost:3000`
**Then**:
- React app loads and renders
- xterm.js terminal component visible with Oceanic Calm theme
- Top bar displays "Claude Container" title and red STOP button
- Terminal shows Claude CLI prompt
- Terminal accepts keyboard input
- Terminal renders ANSI colors, cursor control, TTY features correctly

**Validation:** Visual inspection confirms terminal rendering; type commands and see colored output; STOP button visible

### AC7: ESC Key and STOP Button Interrupt Claude

**Given** Claude CLI executing a long-running operation
**When** user presses ESC key OR clicks STOP button
**Then**:
- Frontend sends `terminal.interrupt` WebSocket message
- Backend sends SIGINT to PTY process
- Claude CLI receives interrupt signal
- Terminal shows "^C" and returns to prompt within 1 second
- New commands can be entered immediately

**Validation:** Run `sleep 60` in terminal, press ESC or click STOP → command interrupted, prompt returns

### AC8: shadcn/ui Components Styled with Oceanic Calm

**Given** shadcn/ui initialized and components added
**When** UI renders
**Then**:
- Button components use correct color scheme (primary: #88C0D0, destructive: #BF616A)
- Tabs, dialogs, and other components follow Oceanic Calm colors
- Background colors: main #2E3440, secondary #3B4252
- Text colors: primary #D8DEE9, secondary #81A1C1
- All components accessible (keyboard navigation, focus rings)

**Validation:** Visual inspection confirms color scheme matches UX spec; keyboard navigation works for all interactive elements

### AC9: Container Startup Pipeline Complete

**Given** Docker image built
**When** `docker run -d -p 3000:3000 -v $(pwd):/workspace -v ~/.config/claude-code:/config/.claude-code:ro claude-container`
**Then**:
- Container starts within 30 seconds (NFR-PERF-3)
- Express backend initializes
- Frontend build served from `/app/frontend/dist`
- Claude CLI PTY spawned
- WebSocket server listening
- Browser can access `localhost:3000` and see working terminal

**Validation:** Time container startup from `docker run` to browser showing Claude prompt → <30 seconds

### AC10: Tool Approval Elimination Works

**Given** container running with mounted workspace
**When** Claude CLI attempts to use tools (bash, git, npm, python, etc.)
**Then**:
- NO approval prompts appear
- Commands execute immediately without user intervention
- Claude can run `git status`, `npm install`, `pytest`, `rm -rf` without confirmation
- Host system remains safe (Docker isolation prevents host access)

**Validation:** Ask Claude to run `git status`, `ls -la`, `rm test.txt` → All execute without prompts

### AC11: Graceful Shutdown Functions

**Given** container running with active Claude CLI session
**When** `docker stop claude-container`
**Then**:
- Backend receives SIGTERM signal
- WebSocket connections close gracefully
- Frontend shows "Connection closed" message
- Backend sends SIGTERM to Claude PTY process
- Claude CLI exits within 5 seconds (or SIGKILL sent)
- Container stops cleanly with exit code 0

**Validation:** `docker stop claude-container && docker inspect claude-container | grep ExitCode` → Shows 0

### AC12: Real Project Validation (emassistant + Work Projects)

**Given** emassistant project (Python 3.13) mounted as workspace
**When** Claude CLI executes Python commands
**Then**:
- Python 3.13 runs successfully
- pip installs packages without errors
- pytest runs tests successfully

**And Given** work project (Java 21) mounted as workspace
**When** Claude CLI executes Java commands
**Then**:
- Java 21 compiles code successfully
- Maven/Gradle builds execute without errors
- npm commands work for Node.js portions

**Validation:** Mount actual emassistant project, run `pytest`; mount actual work project, run `mvn clean install` → Both succeed

## Traceability Mapping

| Acceptance Criteria | PRD Functional Requirements | Architecture Components | Epic 1 Stories | Test Approach |
|---------------------|----------------------------|------------------------|----------------|---------------|
| **AC1: Dev Environment** | FR1 (Complete dev env) | Dockerfile, ADR-009 (Dev requirements) | Story 1.1 | Docker image inspection, command version checks |
| **AC2: Volume Mounts** | FR2 (Workspace RW), FR3 (Config RO) | ADR-002 (BMAD in workspace) | Story 1.2 | File creation/modification tests, permission tests |
| **AC3: Backend Server** | FR53 (Express), FR54 (WebSocket) | Architecture "Backend Stack" | Story 1.3 | HTTP request tests, health endpoint validation |
| **AC4: PTY Process** | FR13 (PTY spawning), FR25 (TTY features) | ADR-004 (node-pty), ptyManager.ts | Story 1.4 | Process spawn validation, PTY output capture |
| **AC5: WebSocket Streaming** | FR21-FR24 (Terminal streaming), NFR-PERF-1 (<100ms) | Architecture "API Contracts - WebSocket" | Story 1.5 | WebSocket message validation, latency measurement |
| **AC6: React Frontend** | FR21-FR28 (Terminal UI), NFR-USE-2 (Intuitive UI) | ADR-006 (React + xterm.js), UX spec Oceanic Calm | Stories 1.6-1.9 | Visual inspection, rendering tests, keyboard input |
| **AC7: Interrupt** | FR26 (ESC key), FR27 (STOP button), FR28 (SIGINT) | ADR-011 (ESC interrupt), Terminal.tsx | Story 1.8, 1.9 | Interrupt signal validation, timing test (<1s) |
| **AC8: shadcn/ui Styling** | FR21 (Browser UI) | UX spec "Design System Foundation" | Story 1.7 | Visual inspection, accessibility audit (axe DevTools) |
| **AC9: Startup Pipeline** | NFR-USE-1 (Zero config), NFR-PERF-3 (<30s startup) | Architecture "Deployment Architecture" | Story 1.10 | Container startup timing, end-to-end smoke test |
| **AC10: Tool Approval Elimination** | FR6 (All tools safe), FR7 (Container isolation) | ADR-008 (Unrestricted tools), NFR-SEC-1 | Story 1.11 | Command execution without prompts, isolation validation |
| **AC11: Graceful Shutdown** | FR58 (Graceful shutdown), NFR-REL-4 (Degradation) | Architecture "Error Handling" | Story 1.3 | SIGTERM handling test, exit code validation |
| **AC12: Project Validation** | PRD Success Criteria Sprint 1 | ADR-009 (Python 3.13, Java 21) | Story 1.12 | Real emassistant + work project execution tests |

### Requirements Coverage Analysis

**PRD Functional Requirements Covered:**
- FR1-FR7: Container & Environment Management (7 FRs) ✓
- FR13: Session Management (1 FR - PTY spawning only) ✓
- FR21-FR28: Web Interface - Terminal Emulation (8 FRs) ✓
- FR53-FR58: Backend Architecture (6 FRs) ✓
- FR71: Resource Management - Process cleanup (1 FR) ✓

**Total Epic 1 Coverage:** 23 of 72 PRD Functional Requirements (32%)

**PRD NFRs Covered:**
- NFR-PERF-1: Terminal latency <100ms ✓
- NFR-PERF-2: UI responsiveness ✓
- NFR-PERF-3: Container startup <30s ✓
- NFR-SEC-1: Container isolation ✓
- NFR-SEC-2: Volume mount safety ✓
- NFR-SEC-3: Single-user local security ✓
- NFR-REL-1: Infrastructure stability (partial - single session) ✓
- NFR-REL-4: Graceful degradation ✓
- NFR-USE-1: Zero configuration startup ✓

**Architecture ADRs Implemented:**
- ADR-001: Single Container ✓
- ADR-002: BMAD in Workspace (validation deferred to Epic 3) ✓
- ADR-004: Node-PTY for Claude CLI ✓
- ADR-005: WebSocket for Terminal Streaming ✓
- ADR-006: React + xterm.js Frontend ✓
- ADR-008: All Tools Safe in Sandbox ✓
- ADR-009: Development Environment Requirements ✓
- ADR-011: ESC Key Interrupt ✓

**Deferred to Later Epics:**
- ADR-003: Git Worktrees (Epic 2)
- ADR-007: JSON File Persistence (Epic 2)
- ADR-010: Testing Frameworks (Epic 4 - validation sprint)

## Risks, Assumptions, Open Questions

### Risks

**RISK-1: node-pty Native Compilation Failures**
- **Description:** node-pty requires native compilation (C++ bindings), may fail on some platforms or Docker base images
- **Impact:** HIGH - Cannot spawn PTY processes, core functionality broken
- **Mitigation:** Use Ubuntu 22.04 LTS with build-essential pre-installed; lock node-pty version; test Docker build in CI
- **Contingency:** Fallback to `child_process.spawn` (loses TTY features but functional)
- **Owner:** Backend developer implementing Story 1.4

**RISK-2: WebSocket Connection Instability**
- **Description:** WebSocket connections may drop unexpectedly due to network issues, browser hibernation, or backend errors
- **Impact:** MEDIUM - User loses terminal session temporarily, no auto-reconnect in Epic 1
- **Mitigation:** Implement heartbeat (30s interval) to detect disconnections; clear error messages to user
- **Contingency:** User manually refreshes page (Epic 4 adds auto-reconnect)
- **Owner:** Backend developer implementing Story 1.5

**RISK-3: Claude CLI Installation Method Changes**
- **Description:** Claude CLI installation command/method may change between Docker image builds
- **Impact:** LOW - Container build fails if installation command outdated
- **Mitigation:** Document current installation method in Dockerfile comments; subscribe to Claude CLI release notes
- **Contingency:** Update Dockerfile with new installation command
- **Owner:** DevOps/Container developer

**RISK-4: Terminal Rendering Performance on Large Output**
- **Description:** If Claude generates massive output (>100,000 lines), xterm.js may freeze browser
- **Impact:** MEDIUM - Browser becomes unresponsive, user must force-refresh
- **Mitigation:** Implement output throttling (batch rendering if >10,000 lines/sec); scrollback buffer limit (1000 lines)
- **Contingency:** Epic 4 adds output rate limiting and virtual scrolling
- **Owner:** Frontend developer implementing Story 1.8

**RISK-5: Docker Volume Mount Permission Issues**
- **Description:** File permission mismatches between host user and container user may prevent file writes
- **Impact:** MEDIUM - Claude cannot modify workspace files, breaks core use case
- **Mitigation:** Run container processes as non-root user matching host UID/GID; document in README
- **Contingency:** Use Docker user mapping (`--user $(id -u):$(id -g)`)
- **Owner:** Container developer, Story 1.2

### Assumptions

**ASSUMPTION-1: Claude CLI Installed on Host**
- **Assumption:** User has Claude CLI configured on host with valid API key in `~/.config/claude-code`
- **Validation:** Document in README prerequisites; container startup checks for config file existence
- **Risk if False:** Claude CLI cannot authenticate, all operations fail

**ASSUMPTION-2: Single Session Sufficient for Epic 1 Validation**
- **Assumption:** Single Claude session demonstrates value proposition, validates core technology
- **Validation:** User testing with real epic execution
- **Risk if False:** Need multi-session earlier than Epic 2 (scope creep)

**ASSUMPTION-3: Docker Desktop Installed and Configured**
- **Assumption:** User has Docker Desktop (macOS) or Docker Engine (Linux) with sufficient resources (4GB RAM, 2 CPU cores)
- **Validation:** Document system requirements in README
- **Risk if False:** Container performs poorly or fails to start

**ASSUMPTION-4: Browser Supports Modern Web APIs**
- **Assumption:** User browser supports WebSocket, Canvas API (for xterm.js), ES2020+ JavaScript
- **Validation:** Target Chrome/Firefox/Safari/Edge latest 2 versions (UX spec NFR-COMPAT-1)
- **Risk if False:** Frontend fails to load or render terminal

**ASSUMPTION-5: Network Access for Claude API Calls**
- **Assumption:** Container has internet access to reach Anthropic API endpoints
- **Validation:** Test with `curl` from inside container to api.anthropic.com
- **Risk if False:** Claude CLI cannot execute, all AI operations fail

### Open Questions

**QUESTION-1: Claude CLI Unrestricted Tool Access Configuration**
- **Question:** What is the exact configuration method to mark all tools as "safe" and disable approval prompts?
- **Options:** (A) Environment variable, (B) Config file setting, (C) Claude CLI flag
- **Decision Needed By:** Story 1.11 implementation
- **Impact:** Core functionality requirement (FR6)
- **Action:** Review Claude CLI documentation, test in container environment

**QUESTION-2: Optimal PTY Buffer Size for Terminal Streaming**
- **Question:** What PTY output buffer size balances latency (<100ms) with WebSocket message overhead?
- **Options:** 16ms (current), 8ms (lower latency), 32ms (reduce messages)
- **Decision Needed By:** Story 1.5 implementation
- **Impact:** NFR-PERF-1 (terminal latency target)
- **Action:** Performance testing with various buffer sizes, measure p50/p95/p99 latency

**QUESTION-3: Frontend Build Optimization Strategy**
- **Question:** Should frontend build happen during Docker image build or at container startup?
- **Options:** (A) Docker build time (current design), (B) Container startup (slower but fresher builds)
- **Decision Needed By:** Story 1.10 implementation
- **Impact:** Developer workflow (rebuild Docker image for frontend changes)
- **Action:** Architecture decision: Build-time = production, startup = development mode

**QUESTION-4: Error Message Verbosity for End Users**
- **Question:** How much technical detail should error messages include for non-technical users?
- **Options:** (A) Full stack traces, (B) User-friendly messages only, (C) Configurable verbosity
- **Decision Needed By:** Story 1.3 error handling implementation
- **Impact:** NFR-USE-3 (Clear error messages)
- **Action:** UX decision: User-friendly by default, full logs in Docker logs for debugging

**QUESTION-5: Container Resource Limits**
- **Question:** Should Docker resource limits (memory, CPU) be set by default or left to user configuration?
- **Options:** (A) No limits (use all available), (B) Conservative limits (2GB RAM, 1 CPU), (C) Documented recommendations
- **Decision Needed By:** Story 1.1 Dockerfile finalization
- **Impact:** NFR-REL-1 (Infrastructure stability), NFR-PERF-4 (Concurrent sessions in Epic 2)
- **Action:** Architecture decision: No hard limits in Dockerfile, document recommendations in README

## Test Strategy Summary

### Testing Approach

Epic 1 prioritizes **integration testing** and **end-to-end validation** over comprehensive unit test coverage. The goal is to prove the complete stack works end-to-end before optimizing individual components.

**Test Pyramid for Epic 1:**
```
    E2E Tests (5)           ← Critical user flows, manual + automated
   /              \
  Integration (15)          ← Component interactions, API contracts
 /                  \
Unit Tests (20)              ← Core logic, utilities, helpers
```

### Test Categories

**1. Docker Container Tests (Story 1.1-1.2)**

**Unit Tests:**
- Dockerfile syntax validation (`docker build` succeeds)
- System package installation verification (Python 3.13, Java 21, Node.js versions)
- Volume mount path resolution (correct directories mounted)

**Integration Tests:**
- Container builds successfully from scratch (no cache)
- Layer caching works correctly (rebuild only changed layers)
- Volume mount permissions (RW workspace, RO config)
- Container resource usage (baseline memory/CPU without load)

**Validation Commands:**
```bash
# Build test
docker build --no-cache -t claude-container:test .

# Version tests
docker run claude-container:test python3 --version | grep "3.13"
docker run claude-container:test java --version | grep "21"
docker run claude-container:test node --version | grep "v20"

# Mount test
docker run -v $(pwd):/workspace claude-container:test ls /workspace
docker run -v ~/.config/claude-code:/config/.claude-code:ro claude-container:test ls /config/.claude-code
```

---

**2. Backend API Tests (Story 1.3-1.5)**

**Unit Tests:**
- Express route handlers (health endpoint, static file serving)
- PTY manager spawn function (mocked node-pty)
- WebSocket message parser (JSON serialization/deserialization)
- Error handling (PTY spawn failure, WebSocket errors)

**Integration Tests:**
- Express server starts and binds to port 3000
- WebSocket server accepts connections
- PTY process spawns Claude CLI successfully
- WebSocket streams PTY output to connected client
- WebSocket receives client input and writes to PTY stdin
- Heartbeat mechanism keeps connections alive
- Graceful shutdown (SIGTERM → close connections → kill PTY)

**Test Framework:** Jest + ts-jest (Backend TypeScript testing)

**Example Test:**
```typescript
describe('PTY Manager', () => {
  it('spawns Claude CLI with correct config', async () => {
    const ptyManager = new PTYManager();
    const ptyProcess = ptyManager.spawn('claude', [], {
      cwd: '/workspace',
      cols: 80,
      rows: 24
    });

    expect(ptyProcess).toBeDefined();
    expect(ptyProcess.pid).toBeGreaterThan(0);
  });
});
```

---

**3. Frontend Component Tests (Story 1.6-1.9)**

**Unit Tests:**
- Terminal component renders xterm.js instance
- WebSocket connection established on mount
- Keyboard input captured and sent via WebSocket
- ESC key triggers interrupt message
- STOP button click triggers interrupt
- xterm.js theme applied (Oceanic Calm colors)

**Integration Tests:**
- Terminal component + WebSocket hook (mocked WebSocket)
- Terminal receives messages and writes to xterm.js
- Button components render with correct styles
- shadcn/ui components styled correctly

**Test Framework:** Vitest + @testing-library/react (Frontend React testing)

**Example Test:**
```typescript
describe('Terminal Component', () => {
  it('sends interrupt message on ESC key', () => {
    const mockSend = vi.fn();
    render(<Terminal websocketUrl="ws://localhost:3000" />);

    // Simulate ESC key press
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({ type: 'terminal.interrupt' })
    );
  });
});
```

---

**4. End-to-End Tests (Story 1.10, 1.12)**

**Critical Flows (Manual Testing for Epic 1):**

**E2E-1: Container Startup to Claude Prompt**
1. Run `docker run -d -p 3000:3000 -v $(pwd):/workspace -v ~/.config/claude-code:/config/.claude-code:ro claude-container`
2. Wait for container to start (expect <30 seconds)
3. Open browser to `http://localhost:3000`
4. Verify React app loads, terminal renders
5. Verify Claude CLI prompt appears in terminal
6. **Pass Criteria:** Claude prompt visible within 30 seconds of `docker run`

**E2E-2: Terminal Interaction (Input/Output)**
1. Type `help` in terminal, press Enter
2. Verify Claude responds with help text
3. Verify ANSI colors render correctly
4. Verify terminal supports cursor keys, backspace, clear screen (Ctrl+L)
5. **Pass Criteria:** All terminal features work, output latency <100ms

**E2E-3: Interrupt Flow**
1. Run long operation: `sleep 60`
2. Press ESC key (or click STOP button)
3. Verify "^C" appears in terminal
4. Verify prompt returns within 1 second
5. Type new command, verify works immediately
6. **Pass Criteria:** Interrupt stops command, prompt immediately available

**E2E-4: Project Validation (emassistant)**
1. Mount emassistant project: `-v ~/emassistant:/workspace`
2. Ask Claude to run: `pytest tests/`
3. Verify pytest executes without approval prompts
4. Verify test results displayed in terminal
5. **Pass Criteria:** Python 3.13 works, Claude executes autonomously

**E2E-5: Project Validation (Work Project - Java 21)**
1. Mount work project: `-v ~/work-project:/workspace`
2. Ask Claude to run: `mvn clean install`
3. Verify Maven executes without approval prompts
4. Verify build succeeds or shows expected errors
5. **Pass Criteria:** Java 21 works, Claude executes autonomously

**Automated E2E (Future - Epic 4):**
- Playwright tests for browser automation
- Docker-in-Docker for container testing
- CI/CD integration (GitHub Actions)

---

**5. Performance Testing (NFR Validation)**

**PERF-1: Terminal Latency Measurement**
```typescript
// Backend: Measure PTY output to WebSocket send
const ptyOutputTime = performance.now();
ptyProcess.onData((data) => {
  const wsTime = performance.now();
  ws.send(JSON.stringify({ type: 'terminal.output', data }));
  const latency = wsTime - ptyOutputTime;
  logger.info('Terminal latency', { latency }); // Target <100ms
});
```

**PERF-2: Container Startup Timing**
```bash
# Measure end-to-end startup
time (docker run -d claude-container && curl --retry 10 --retry-delay 1 http://localhost:3000)
# Target: <30 seconds
```

**PERF-3: Frontend Bundle Size**
```bash
npm run build
ls -lh dist/*.js | awk '{print $5}' # Should be <500KB gzipped
```

---

**6. Security Testing (Validation)**

**SEC-1: Container Isolation Test**
```bash
# Inside container, attempt to access host filesystem
docker exec -it claude-container bash -c "rm -rf /"
# Verify host filesystem unaffected, only container damaged
docker inspect claude-container # Check exit status after destructive command
```

**SEC-2: Volume Mount Permission Test**
```bash
# Attempt to write to read-only config mount
docker exec -it claude-container bash -c "touch /config/.claude-code/test.txt"
# Expect: "Read-only file system" error
```

---

### Test Execution Plan

**Phase 1: Development Testing (During Story Implementation)**
- Unit tests written alongside code (TDD where practical)
- Integration tests for each story's completion
- Developer runs tests locally before PR

**Phase 2: Story Acceptance Testing**
- Each story's acceptance criteria validated
- Manual testing of UI/UX elements
- Performance spot-checks (terminal latency, startup time)

**Phase 3: Epic Integration Testing**
- All 12 stories integrated, full stack running
- End-to-end flows validated (E2E-1 through E2E-5)
- Real project validation (emassistant + work project)

**Phase 4: Epic Completion Validation**
- All acceptance criteria (AC1-AC12) verified
- NFR validation (performance, security, reliability)
- Documentation review (README, troubleshooting)

**Test Automation (Epic 4):**
- CI/CD pipeline with automated unit/integration tests
- Playwright E2E tests
- Performance regression testing
- Security scanning (Docker image vulnerabilities)

---

### Coverage Targets

**Epic 1 (Pragmatic, Not Exhaustive):**
- Unit tests: 50% code coverage (core logic)
- Integration tests: 70% of API contracts validated
- E2E tests: 5 critical flows (100% of user-facing features)

**Epic 4 (Comprehensive):**
- Unit tests: 80% code coverage
- Integration tests: 90% of API contracts
- E2E tests: 20+ flows including error cases

---

### Test Environment

**Local Development:**
- Developer machine: macOS/Linux with Docker Desktop
- Node.js 20 LTS, npm for test framework execution
- Browser: Chrome/Firefox for frontend testing

**CI/CD (Future):**
- GitHub Actions runners with Docker support
- Matrix testing: Multiple OS, browser versions
- Performance benchmarking on dedicated runners
