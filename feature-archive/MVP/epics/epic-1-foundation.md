# Epic 1: Foundation & Single-Session Terminal

**Goal:** Deliver a working browser-based Claude CLI terminal in a sandboxed Docker environment that eliminates approval prompts

**User Value:** Developers can run Claude autonomously in browser without manual tool approvals - the core promise of the product

**FR Coverage:** FR1-FR7 (Container), FR13 (PTY spawning), FR21-FR28 (Terminal), FR53-FR58 (Backend), FR71 (Process cleanup)

---

## Story 1.1: Docker Container with Development Environment

As a developer,
I want a Docker container with all necessary development tools pre-installed,
So that Claude can work on both emassistant (Python 3.13) and work projects (Java 21) without tool installation friction.

**Acceptance Criteria:**

**Given** a Dockerfile in the repository root
**When** the container is built with `docker build -t claude-container .`
**Then** the container includes:
- Ubuntu 22.04 LTS base image
- Python 3.13 installed and accessible via `python3 --version`
- Amazon Corretto 21 (OpenJDK) installed and accessible via `java --version`
- Node.js 20 LTS installed with npm
- Git, jq, curl, wget, build-essential packages installed
- Claude CLI installed globally

**And** when the container starts
**Then** all development tools are immediately available without additional setup

**And** the container filesystem is isolated from the host system
**Then** destructive commands within the container do not affect the host

**Prerequisites:** None (first story)

**Technical Notes:**
- Dockerfile structure per Architecture doc: Ubuntu 22.04 → apt-get packages → Python 3.13 → Java 21 → Node.js → Claude CLI
- Layer caching optimized: base packages first, source code last
- Use multi-stage build if needed to reduce final image size
- Container runs as non-root user for security
- Reference: Architecture doc section "Development Environment (Docker Container)"

---

## Story 1.2: Volume Mounts for Workspace and Configuration

As a developer,
I want my host project directory and Claude configuration mounted into the container,
So that Claude can modify my code and use my API keys without copying files.

**Acceptance Criteria:**

**Given** a host project directory at `$HOME/my-project`
**When** the container is started with volume mounts:
```bash
docker run -v $HOME/my-project:/workspace \
           -v ~/.config/claude-code:/config/.claude-code:ro
```
**Then** the host project directory is accessible at `/workspace` with read-write permissions

**And** files created/modified in `/workspace` by Claude persist on the host

**And** the Claude configuration directory is accessible at `/config/.claude-code` with read-only permissions

**And** Claude CLI can read API keys from `/config/.claude-code` but cannot modify them

**Prerequisites:** Story 1.1 (Container exists)

**Technical Notes:**
- Workspace mount: Read-write, this is where Claude modifies code
- Config mount: Read-only prevents accidental config corruption
- Validate mounts on container startup (exit with error if missing)
- BMAD Method installed in `/workspace/.bmad` (not separate mount per FR4)
- Reference: PRD FR2, FR3, FR4

---

## Story 1.3: Backend Server with Express and WebSocket

As a developer,
I want a backend server that handles HTTP requests and WebSocket connections,
So that the frontend can communicate with Claude CLI processes in real-time.

**Acceptance Criteria:**

**Given** the backend code is in `/backend/src/server.ts`
**When** the container starts
**Then** Express.js HTTP server starts on port 3000

**And** the server serves static frontend assets from `/frontend/dist`

**And** a WebSocket server is listening on the same port (port 3000)

**And** the server logs "Server listening on port 3000" using Winston structured logging

**And** when a WebSocket client connects
**Then** the connection is established successfully

**And** the server sends a `{ type: 'heartbeat', timestamp: <ms> }` message every 30 seconds

**And** when the container receives SIGTERM
**Then** the server closes all WebSocket connections gracefully before exiting

**Prerequisites:** Story 1.1 (Container with Node.js)

**Technical Notes:**
- Express.js 4.x for HTTP server (Architecture ADR-003)
- ws library 8.x for WebSocket (Architecture ADR-004)
- Single HTTP server handles both static files and WebSocket upgrade requests
- Heartbeat every 30s to detect disconnections
- Graceful shutdown: close WebSockets → stop Express → exit (FR58)
- Winston logger with JSON format for structured logs
- Reference: Architecture "Backend Stack" and "API Contracts - WebSocket Protocol"

---

## Story 1.4: PTY Process Management with node-pty

As a developer,
I want the backend to spawn Claude CLI as a pseudo-terminal (PTY) process,
So that Claude receives proper TTY emulation with color support and interactive prompts.

**Acceptance Criteria:**

**Given** a backend module `ptyManager.ts`
**When** a session is created via `ptyManager.spawn('claude', [], { cwd: '/workspace' })`
**Then** a Claude CLI process is spawned with node-pty

**And** the PTY process has:
- Terminal type: `xterm-256color`
- Initial size: 80 columns × 24 rows (default, resizable later)
- Working directory: `/workspace`
- Environment variables: inherit from container process

**And** when the PTY process writes to stdout
**Then** the data is captured via `ptyProcess.onData((data) => { ... })` callback

**And** when data is written to the PTY stdin via `ptyProcess.write(data)`
**Then** Claude CLI receives the input as if typed in a terminal

**And** when Claude CLI exits (normal or crash)
**Then** the `ptyProcess.onExit()` callback fires with exit code and signal

**And** the PTY process is cleaned up (FR71)

**Prerequisites:** Story 1.1 (Container with Node.js)

**Technical Notes:**
- node-pty 1.x library (Architecture decision)
- Spawn command: `claude` (assumes Claude CLI in PATH)
- TTY emulation critical for colors, cursor control, interactive prompts (FR25)
- Exit handling logs sessionId, exitCode, signal for debugging
- Reference: Architecture "PTY Process Management" and "API Contracts"

---

## Story 1.5: WebSocket Terminal Streaming Protocol

As a developer,
I want PTY stdout/stderr streamed to the browser via WebSocket in real-time,
So that I see Claude's terminal output instantly (<100ms latency per NFR-PERF-1).

**Acceptance Criteria:**

**Given** a PTY process is running for a session
**When** the PTY writes output (e.g., "Hello from Claude\n")
**Then** the backend sends a WebSocket message:
```json
{ "type": "terminal.output", "sessionId": "<uuid>", "data": "Hello from Claude\n" }
```

**And** the message is sent within 100ms of the PTY outputting the data

**And** when the browser sends terminal input:
```json
{ "type": "terminal.input", "sessionId": "<uuid>", "data": "help\n" }
```
**Then** the backend writes the data to the PTY stdin via `ptyProcess.write("help\n")`

**And** Claude CLI receives the input and responds

**And** when the browser sends an interrupt:
```json
{ "type": "terminal.interrupt", "sessionId": "<uuid>" }
```
**Then** the backend sends SIGINT to the PTY process (Ctrl+C) (FR28)

**And** Claude CLI stops the current operation and returns to prompt

**Prerequisites:** Story 1.3 (WebSocket server), Story 1.4 (PTY processes)

**Technical Notes:**
- Buffering: Accumulate PTY output in 16ms chunks (60fps) for efficiency
- WebSocket binary frames for terminal data (faster than JSON encoding)
- Message format per Architecture "API Contracts - WebSocket Protocol"
- SIGINT handling: `ptyProcess.kill('SIGINT')` for graceful interrupt
- Latency target: <100ms from PTY output to WebSocket send (NFR-PERF-1)
- Reference: Architecture "Communication Patterns"

---

## Story 1.6: Frontend Project Setup with Vite + React + TypeScript

As a developer,
I want a modern React frontend with instant HMR and TypeScript safety,
So that I can build the UI quickly with fast feedback loops.

**Acceptance Criteria:**

**Given** the frontend directory structure:
```
frontend/
├── src/
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Root component
│   ├── components/
│   ├── hooks/
│   ├── context/
│   └── types.ts
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```
**When** `npm run dev` is executed in the frontend directory
**Then** Vite dev server starts with instant HMR

**And** TypeScript compilation errors are shown in real-time

**And** when `npm run build` is executed
**Then** optimized production assets are created in `frontend/dist/`

**And** the build output includes:
- `index.html` with hashed asset references
- JavaScript bundles with code splitting
- CSS bundle with Tailwind utilities

**And** the backend can serve these static assets from Express

**Prerequisites:** Story 1.1 (Container with Node.js)

**Technical Notes:**
- Vite 6.x for build tool (Architecture ADR-002)
- React 19 with TypeScript 5.x
- Tailwind CSS 4.0 configured with Oceanic Calm theme colors (UX spec section 3.1)
- Path aliases: `@/` maps to `src/` for clean imports
- vitest configured for unit tests
- Reference: Architecture "Frontend Setup" and UX spec "Implementation Guidance"

---

## Story 1.7: shadcn/ui Component Library Integration

As a developer,
I want accessible UI component primitives that can be fully customized,
So that I can build the Oceanic Calm themed interface quickly without reinventing components.

**Acceptance Criteria:**

**Given** shadcn/ui is initialized in the frontend project
**When** `npx shadcn-ui@latest init` is run
**Then** the following is configured:
- Tailwind CSS with shadcn/ui theme
- `components/ui/` directory for copied components
- `lib/utils.ts` with cn() helper function

**And** when components are added via `npx shadcn-ui@latest add button tabs dialog`
**Then** the components are copied into `components/ui/`:
- `components/ui/button.tsx`
- `components/ui/tabs.tsx`
- `components/ui/dialog.tsx`

**And** the components follow Oceanic Calm color scheme:
- Primary buttons: `#88C0D0` background
- Secondary buttons: `#3B4252` background with `#4C566A` border
- Destructive buttons: `#BF616A` background

**And** all components support keyboard navigation and screen readers (WCAG AA)

**Prerequisites:** Story 1.6 (Frontend project setup)

**Technical Notes:**
- shadcn/ui provides: Button, Tabs, Dialog, Resizable, Badge, Dropdown, Scroll Area, Separator, Tooltip
- Components are copied (not imported) for full customization
- Tailwind config extended with Oceanic Calm colors per UX spec section 3.1
- Lucide React icons installed for icon components
- Reference: UX spec "Design System Foundation" and "Component Library"

---

## Story 1.8: Terminal Component with xterm.js Integration

As a developer,
I want a React component that renders a full-featured terminal emulator,
So that users can interact with Claude CLI in the browser with proper TTY support.

**Acceptance Criteria:**

**Given** a `Terminal.tsx` component in `frontend/src/components/`
**When** the component mounts with props `{ sessionId: string, websocketUrl: string }`
**Then** an xterm.js terminal instance is created with:
- Theme: Oceanic Calm colors (background `#2E3440`, foreground `#D8DEE9`)
- Font: `'JetBrains Mono', 'Fira Code', monospace` at 13px
- Line height: 1.6
- Canvas renderer (better performance than DOM)

**And** the terminal is attached to a DOM element with FitAddon
**Then** the terminal resizes to fill its container

**And** when the WebSocket receives `terminal.output` messages
**Then** the data is written to the terminal via `terminal.write(data)`

**And** the terminal displays the output with full TTY features:
- ANSI colors render correctly
- Cursor positioning works
- Screen clearing works (Ctrl+L)

**And** when the user types in the terminal
**Then** the input is sent via WebSocket:
```json
{ "type": "terminal.input", "sessionId": "<id>", "data": "<typed-char>" }
```

**And** when the user presses ESC key
**Then** an interrupt message is sent:
```json
{ "type": "terminal.interrupt", "sessionId": "<id>" }
```

**Prerequisites:** Story 1.5 (WebSocket protocol), Story 1.6 (Frontend setup)

**Technical Notes:**
- xterm.js 5.x with addons: fit, web-links, screen-reader-mode
- Keyboard handling: Capture ESC key (FR26), pass other keys to terminal
- Terminal addon loading per Architecture "xterm.js Integration"
- WebSocket connection managed by `useWebSocket` custom hook
- Terminal cleanup on unmount: `terminal.dispose()`
- Reference: UX spec "Terminal Component" and Architecture "Terminal Streaming"

---

## Story 1.9: Basic UI Layout with Single Terminal View

As a developer,
I want a minimal browser UI that displays a single terminal session,
So that I can validate the complete stack (Docker → Backend → WebSocket → Frontend → Terminal) works end-to-end.

**Acceptance Criteria:**

**Given** the `App.tsx` root component
**When** the app loads at `http://localhost:3000`
**Then** the UI displays:
- Top bar with "Claude Container" logo/title
- Large red "STOP" button in top bar (Oceanic Calm error color `#BF616A`)
- Main content area with Terminal component (full height minus top bar)

**And** the Terminal component connects to WebSocket `ws://localhost:3000`

**And** when the WebSocket connects successfully
**Then** the terminal displays Claude CLI prompt

**And** when the user types commands in the terminal
**Then** Claude CLI responds with output

**And** when the user clicks the STOP button
**Then** an interrupt message is sent to the backend

**And** Claude CLI stops the current operation (Ctrl+C effect)

**And** the terminal returns to the prompt

**Prerequisites:** Story 1.8 (Terminal component), Story 1.3 (Backend server)

**Technical Notes:**
- Layout: Flexbox vertical stack (top bar + terminal)
- Top bar height: 56px (14rem), background `#3B4252` per UX spec
- STOP button: Destructive button style, always visible (FR27)
- No tabs yet (single session only in Epic 1)
- No sidebars yet (added in Epic 3)
- Oceanic Calm theme colors applied per UX spec section 3.1
- Reference: UX spec "Design Direction" section 4.1

---

## Story 1.10: Container Startup and Frontend Build Pipeline

As a developer,
I want a single `docker run` command that starts the container and serves the UI,
So that setup is simple and matches the "zero configuration startup" requirement (NFR-USE-1).

**Acceptance Criteria:**

**Given** the Dockerfile includes:
```dockerfile
# Backend setup
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/src ./src

# Frontend build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Runtime
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "src/server.js"]
```
**When** the container is built with `docker build -t claude-container .`
**Then** the frontend is built during container image creation

**And** the production assets are available at `/app/frontend/dist`

**And** when the container starts
**Then** the Express backend serves frontend assets from `/app/frontend/dist`

**And** when a browser accesses `http://localhost:3000`
**Then** the React UI loads and displays the terminal

**And** the WebSocket connects to the backend successfully

**And** Claude CLI is ready to receive commands

**And** the entire startup completes within 30 seconds (NFR-PERF-3)

**Prerequisites:** All previous stories in Epic 1

**Technical Notes:**
- Multi-stage Docker build to separate build dependencies from runtime
- Frontend built once during image creation (not on every container start)
- Backend serves static files via Express: `app.use(express.static('/app/frontend/dist'))`
- Health check endpoint: `GET /api/health` returns `{ status: 'ok' }`
- Docker CMD starts backend server which spawns initial Claude session
- Reference: Architecture "Deployment Architecture" and "Docker Container Optimization"

---

## Story 1.11: Tool Approval Elimination via Container Configuration

As a developer,
I want all Claude CLI tools to be marked as safe within the container,
So that Claude can execute commands autonomously without approval prompts (FR6).

**Acceptance Criteria:**

**Given** the Claude CLI configuration in the container
**When** Claude attempts to use CLI tools (bash, git, npm, python, etc.)
**Then** NO approval prompts are shown

**And** commands execute immediately without user intervention

**And** when Claude runs a bash command like `git status`
**Then** the command executes and output is streamed to terminal

**And** when Claude runs potentially destructive commands like `rm -rf`
**Then** the command executes within the container (host is protected by Docker isolation)

**And** the user can always interrupt with STOP button/ESC key (FR26, FR27)

**Prerequisites:** Story 1.1 (Docker container), Story 1.2 (Volume mounts)

**Technical Notes:**
- Claude CLI config: Set all tools to "approved" or "safe" in `/config/.claude-code`
- Alternative: Environment variable in container to disable all approval prompts
- Container isolation (FR7) ensures host system safety even with unrestricted tools
- This is the CORE VALUE PROPOSITION: Autonomous Claude without babysitting
- Reference: PRD Executive Summary "Core Problem Solved"

---

## Story 1.12: Validation with Real Project Workflows

As a developer,
I want to validate that Claude Container works with both emassistant (Python 3.13) and work projects (Java 21),
So that I'm confident the tool meets the PRD validation criteria.

**Acceptance Criteria:**

**Given** the container is running with an emassistant project mounted at `/workspace`
**When** Claude is asked to run Python 3.13 code
**Then** Python 3.13 executes successfully

**And** pip installs packages without errors

**And** pytest runs tests successfully

**And** when the container is restarted with a work project (Java 21) mounted
**Then** Java 21 compiles code successfully

**And** Maven/Gradle builds execute without errors

**And** npm commands work for Node.js portions of the project

**And** git operations work correctly

**And** Claude can autonomously develop features without approval prompts

**Prerequisites:** All previous stories in Epic 1 (complete working system)

**Technical Notes:**
- Test with REAL projects, not mock examples
- Validation success criteria from PRD: "Can run an epic in browser without approval prompts"
- Python 3.13 validation: emassistant project
- Java 21 validation: work projects
- All dev tools must be functional (git, jq, curl, build-essential)
- Reference: PRD "Success Criteria" Sprint 1

---

## Epic 1 Complete - Review

**Epic 1: Foundation & Single-Session Terminal**

**Stories:** 12 total
- Story 1.1: Docker environment
- Story 1.2: Volume mounts
- Story 1.3: Backend server
- Story 1.4: PTY process management
- Story 1.5: WebSocket streaming
- Story 1.6: Frontend setup
- Story 1.7: shadcn/ui integration
- Story 1.8: Terminal component
- Story 1.9: Basic UI layout
- Story 1.10: Container startup
- Story 1.11: Tool approval elimination
- Story 1.12: Real project validation

**FRs Covered:** FR1-FR7, FR13, FR21-FR28, FR53-FR58, FR71 (23 FRs)

**User Value Delivered:** Developers can run Claude CLI in browser without approval prompts in a safe Docker sandbox

**Ready for Epic 2:** Yes - foundation established for multi-session expansion
