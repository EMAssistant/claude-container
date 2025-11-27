# claude-container - Product Requirements Document

**Author:** Kyle
**Date:** 2025-11-23
**Version:** 1.0

---

## Executive Summary

Claude Container is a self-contained Docker environment that eliminates the primary friction points in AI-assisted development: manual tool approval prompts, sequential workflow limitations, and poor visibility into autonomous agent progress.

The product transforms Claude Code from a supervised assistant requiring constant babysitting into a truly autonomous development partner. By providing safe sandboxing, parallel session management, and visual workflow tracking through a browser interface, it enables developers to assign epics to Claude and walk away while development proceeds independently across multiple features.

**Core Problem Solved:**
Daily friction with tool approvals blocks autonomous epic completion. Current terminal-based Claude Code requires manual approval for CLI tools to prevent destructive commands on the host system. This defeats the purpose of AI-assisted development by requiring constant supervision.

**Solution Approach:**
Docker container isolation allows unrestricted tool access within a safe sandbox. Combined with git worktrees for parallel development and a React-based web UI for session management, the product delivers the promise of autonomous AI development while maintaining safety through containerization.

### What Makes This Special

**This is not a "sometimes tool" - this becomes THE PRIMARY WORKFLOW.**

Claude Container is infrastructure-level software, not an experimental prototype. Every project will run in this containerized environment. This raises the quality bar significantly - the product must be rock-solid stable because it replaces the fundamental way development happens.

The product enables "getting more while doing less" - assign an epic, switch to another session, check back later to find completed, tested implementations across multiple features simultaneously.

---

## Project Classification

**Technical Type:** Web Application
**Domain:** General Software Development
**Complexity:** Low

**Classification Rationale:**

This is a **web application** delivering browser-based UI for managing backend processes (Claude CLI sessions). While it has developer tool characteristics, the primary interface is a React frontend communicating with an Express backend via WebSockets for real-time terminal streaming.

Domain classification is **general software development** with low complexity - no specialized regulatory requirements, no complex domain-specific validation needs. The product focuses on developer experience and workflow optimization for software engineering teams (or individual developers).

**Referenced Documentation:**
- Product Vision: docs/claude-container-project.md (Comprehensive brainstorming session - 2025-11-23)
- Architecture Decisions: docs/architecture-decisions.md (11 ADRs documenting technical choices)
- Brainstorming Results: Available but not used (template file)

{{#if domain_context_summary}}

### Domain Context

{{domain_context_summary}}
{{/if}}

---

## Success Criteria

**Primary Success Indicator:**
"Getting more while doing less" - The qualitative feeling that Claude Container has become indispensable infrastructure.

**What Success Looks Like:**

1. **Autonomous Epic Completion** - Assign an epic to a Claude session, walk away, return to find completed implementation with passing tests
2. **Parallel Development Reality** - Actively develop 3-4 features simultaneously across different sessions without context switching overhead
3. **Zero Approval Friction** - No manual intervention required during Claude's autonomous work within the sandbox
4. **Infrastructure Reliability** - Rock-solid stability enables daily use across all projects (emassistant + work projects) without container restarts or manual intervention
5. **Browser-First Workflow** - Terminal interface completely replaced by browser UI for all Claude Code interactions

**Validation Criteria:**

- **Sprint 1 Success:** Can run a complete epic in browser without approval prompts, supporting full dev environment (Python 3.13, Java 21, npm, jq, git, etc.)
- **Sprint 2 Success:** Can develop 4 features simultaneously in parallel sessions using git worktrees
- **Sprint 3 Success:** Can monitor all sessions at a glance, view generated artifacts, and track BMAD workflow progress visually
- **Sprint 4 Success:** Can work daily with zero friction - container never needs manual intervention, sessions resume cleanly after restarts

**User Satisfaction Metric:**
This becomes THE PRIMARY WORKFLOW - all projects run containerized. User chooses Claude Container over native terminal for 100% of Claude Code interactions.

---

## Product Scope

### MVP - Minimum Viable Product

**Sprint 1: Core MVP - Claude in Browser**

Goal: Claude running in browser with unrestricted tools and full dev environment

**Must Have:**
1. **Complete dev environment in Docker**
   - Ubuntu 22.04 base
   - Python 3.13
   - Amazon Java 21 (OpenJDK)
   - Node.js + npm
   - jq, git, curl, wget, build-essential
   - Claude CLI installation

2. **Basic backend (Express + WebSocket)**
   - Single Claude CLI process spawn using node-pty
   - WebSocket server for terminal streaming
   - Serve static React frontend

3. **Basic frontend (React + xterm.js)**
   - Single terminal view (no tabs yet)
   - xterm.js terminal emulator
   - WebSocket connection to backend
   - ESC key + STOP button for interrupt

4. **Volume mounts**
   - Host project → `/workspace` (read-write)
   - Host `~/.config/claude-code` → `/config/.claude-code` (read-only)

5. **Unrestricted tools**
   - All tools marked safe (no approval prompts)
   - Validate can develop emassistant project
   - Validate can develop work projects

**Success Criteria:** Can run an epic in browser without approval prompts

**Sprint 2: Multi-Session Support**

Goal: Run 4 parallel Claude sessions in separate worktrees

**Must Have:**
1. Session management (JSON persistence at `/workspace/.claude-container-sessions.json`)
2. Git worktree creation/management
3. Multiple node-pty processes (one per session)
4. WebSocket streaming per session
5. Tabbed UI (up to 4 tabs)
6. Session naming (pre-generated + user override)

**Success Criteria:** Can develop 4 features simultaneously in parallel sessions

### Growth Features (Post-MVP)

**Sprint 3: BMAD Integration & UX Polish**

Goal: Visual workflow tracking and document viewing

1. **BMAD status file parser** (YAML/markdown)
2. **Workflow visualization UI**
   - Step progress indicators (✓ → ○)
   - Current step highlighting
   - Clickable steps for navigation
3. **Document browser**
   - Folder navigation
   - Markdown rendering
   - Diff view toggle ("show changes since last viewed")
4. **Browser notifications** when Claude needs input
5. **Tab attention indicators** (badges, idle timers)
6. **Session status display** (stuck warnings, input requests, current step)
7. **"Update BMAD" button** (runs `npx bmad-method install`)

**Success Criteria:** Can monitor 4 sessions at a glance and view all generated artifacts

**Sprint 4: Stability & Production Readiness**

Goal: Rock-solid infrastructure for daily use

1. **Session resume functionality**
   - Manual resume trigger
   - "Analyze what's been done" protocol
   - Resume from epic/story state files
2. **Error handling and recovery**
   - Graceful Claude crash handling
   - WebSocket reconnection
   - Container restart recovery
3. **Resource management**
   - Optimize for 4 concurrent sessions
   - Memory/CPU monitoring
   - Cleanup of terminated processes
4. **Comprehensive testing**
   - Concurrent git operations (worktree safety)
   - Container crash recovery
   - WebSocket stress tests
   - Multi-session integration tests
5. **Documentation**
   - README with docker run command
   - Architecture overview
   - Troubleshooting guide
6. **Docker image optimization**
   - Minimize image size
   - Layer caching for fast builds

**Success Criteria:** Can work daily with zero friction, container never needs manual intervention

### Vision (Future)

**Deferred to user feedback and real-world usage:**

- Auto-resume on container start
- Tighter resume point granularity
- Session lifecycle management (archive/cleanup completed sessions)
- Health monitoring automation
- Per-session resource isolation (if blast radius becomes problem)
- Smoke test mode
- UI-surfaced git rollback
- Dark mode
- Mobile support (if needed)
- Multi-user authentication (if team usage emerges)
- Cloud deployment options (if remote access needed)

---

{{#if domain_considerations}}

## Domain-Specific Requirements

{{domain_considerations}}

This section shapes all functional and non-functional requirements below.
{{/if}}

---

{{#if innovation_patterns}}

## Innovation & Novel Patterns

{{innovation_patterns}}

### Validation Approach

{{validation_approach}}
{{/if}}

---

## Web Application Specific Requirements

### Browser Platform

**Responsive Design:**
- UI optimized for desktop browsers (1920x1080 and 1440x900 common resolutions)
- No mobile responsive design required (desktop-only tool)
- Minimum supported resolution: 1280x720

**Frontend Technology:**
- React for UI framework (component-based architecture)
- xterm.js for terminal emulation
- WebSocket client for real-time communication
- Markdown renderer (marked.js or similar) for document viewing

**Backend Technology:**
- Node.js with Express for HTTP server
- WebSocket server (ws library) for real-time bidirectional communication
- node-pty for TTY pseudo-terminal emulation
- File system operations for session management and BMAD parsing

### API Design

**WebSocket Protocol:**
- Message format: JSON for control messages, raw text for terminal I/O
- Events: `session.create`, `session.destroy`, `terminal.input`, `terminal.output`, `terminal.interrupt`
- Connection per session (separate WebSocket for each Claude CLI session)
- Heartbeat/keepalive to detect disconnections

**REST Endpoints (if needed):**
- `GET /` - Serve React frontend
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `DELETE /api/sessions/:id` - Destroy session
- `GET /api/status` - BMAD workflow status
- `GET /api/documents/*` - Serve workspace files for document viewer
- `POST /api/bmad/update` - Trigger BMAD update command

### State Management

**Frontend State:**
- Active session ID
- Tab state (which tabs open, which is active)
- Document viewer state (current file, scroll position)
- Notification preferences

**Backend State:**
- Session registry (in-memory + persisted to JSON)
- Active Claude CLI processes (process handles)
- WebSocket connection registry (map session ID to WebSocket)

---

## User Experience Principles

### Visual Personality

**Utilitarian and Professional:**
- Clean, minimal interface focused on function over aesthetics
- Terminal-centric design language (monospace fonts, dark color schemes)
- No unnecessary animations or visual flourishes
- Information density optimized for developer workflow

**Terminal Parity:**
- UI should feel like a "better terminal" not a completely different paradigm
- Keyboard shortcuts mirror terminal conventions (ESC for interrupt)
- Monospace fonts for all code/terminal content
- Dark theme as default (light theme optional future enhancement)

### Key Interaction Patterns

**Primary Workflow:**
1. User opens `localhost:3000` in browser
2. Sees empty state with "+ New Session" button
3. Clicks to create session → Modal for session name (pre-filled with auto-generated name)
4. Session tab appears, terminal loads, Claude CLI prompt visible
5. User types epic assignment, Claude begins autonomous work
6. User switches to another tab to create second session in parallel
7. Periodically checks tabs to see progress, responds to questions if needed
8. When epic completes, reviews generated code and documentation

**Session Creation Flow:**
- Single-click "+ New Session" button
- Modal with session name input (pre-filled with `feature-2025-11-23-001` style name)
- User can edit or accept default
- "Create" button spawns session immediately
- New tab appears with session name, terminal auto-connects

**Session Switching:**
- Click tab to switch sessions
- Tab shows: session name + status indicator (green dot = active, yellow = waiting, gray = idle, red = error)
- Keyboard shortcut: Cmd+1, Cmd+2, Cmd+3, Cmd+4 for tabs 1-4 (optional enhancement)

**Interrupt Mechanism:**
- ESC key anywhere in UI sends interrupt to active session
- Big red "STOP" button visible in terminal toolbar
- Both trigger same SIGINT to Claude process
- Visual feedback: "Interrupting..." indicator during signal send
- Returns to Claude prompt after interrupt

**Workflow Progress Visibility:**
- Right sidebar panel shows BMAD workflow progress
- Compact view: Step name + indicator (✓/→/○)
- Current step highlighted with subtle color
- Updates automatically as Claude progresses through workflow
- Collapsible if user wants more terminal space

**Document Viewing:**
- Left sidebar (or bottom panel) for document browser
- Tree view of workspace folders
- Click file → opens rendered markdown in modal or split panel
- "Diff" toggle shows changes since last view
- Close button returns to terminal focus

**Status Notifications:**
- Browser notification when Claude asks question (user approval needed)
- Tab badge with "!" icon when attention needed
- Idle timer: "Last activity: 5m ago" in subtle gray text
- Stuck warning: "No output for 30+ minutes" in yellow banner

### Guiding Principles

**Minimize Context Switching:**
Everything needed to manage multiple Claude sessions should be visible at a glance. User should not need to navigate away from main UI or open external tools.

**Default to Autonomous:**
UI assumes Claude is working autonomously. Notifications only when user input required. No "are you sure?" confirmations that interrupt flow.

**Terminal First:**
Terminal emulation is the centerpiece. Workflow visualization and document viewing are supplementary panels that enhance but don't replace terminal interaction.

**Forgiveness Over Permission:**
ESC/STOP always available to interrupt. User can always regain control. No states where Claude is "stuck" without recourse.

---

## Functional Requirements

### Container & Environment Management

**FR1:** System shall provide Docker container with complete development environment (Ubuntu 22.04, Python 3.13, Java 21, Node.js, git, jq, build-essential)

**FR2:** System shall mount host project directory to `/workspace` with read-write access

**FR3:** System shall mount host `~/.config/claude-code` to `/config/.claude-code` with read-only access

**FR4:** System shall install BMAD Method within workspace directory (not separate mount)

**FR5:** Users can update BMAD Method installation via UI button executing `npx bmad-method install`

**FR6:** System shall mark all CLI tools as safe within container (no approval prompts required)

**FR7:** System shall isolate container filesystem from host system to prevent destructive commands affecting host

### Session Management

**FR8:** Users can create new Claude CLI sessions with user-defined or auto-generated names

**FR9:** System shall support up to 4 concurrent Claude CLI sessions

**FR10:** System shall persist session metadata (ID, name, worktree path, status, timestamps) to JSON file in workspace

**FR11:** Sessions shall survive container restarts through persistent JSON storage

**FR12:** Users can manually resume sessions after container restart

**FR13:** System shall spawn each session as independent Claude CLI process using node-pty (TTY emulation)

**FR14:** Users can destroy/terminate sessions

**FR15:** System shall optionally clean up git worktrees when sessions are destroyed

### Git Worktree Management

**FR16:** System shall create isolated git worktree for each Claude session on separate branch

**FR17:** Users can specify branch name or accept auto-generated branch name (e.g., `feature/{epic-name}`)

**FR18:** Each session shall operate exclusively within its own worktree directory

**FR19:** System shall execute `git worktree add` command with proper branch creation

**FR20:** Users are responsible for merging/rebasing worktrees (system does not auto-merge)

### Web Interface - Terminal Emulation

**FR21:** System shall serve browser-based UI accessible at `localhost:3000` (or configured port)

**FR22:** UI shall display full terminal emulator using xterm.js for each session

**FR23:** System shall stream Claude CLI stdout/stderr to browser terminal in real-time via WebSocket

**FR24:** Users can send input from browser to Claude CLI stdin

**FR25:** Terminal shall support full TTY features (colors, cursor control, screen clearing)

**FR26:** Users can interrupt current Claude operation using ESC key

**FR27:** Users can interrupt current Claude operation using visible STOP button in UI

**FR28:** ESC key and STOP button shall send SIGINT (Ctrl+C) to Claude PTY process

### Web Interface - Session Navigation

**FR29:** UI shall display tabbed interface for switching between multiple sessions

**FR30:** Users can switch between active sessions via tab selection

**FR31:** UI shall display "+" tab button for creating new sessions

**FR32:** Each tab shall show session name/identifier

**FR33:** Tabs shall display visual indicators for session status (active, waiting for input, idle, completed)

**FR34:** System shall show "last activity" timestamp per session tab

**FR35:** UI shall display prominent banner when Claude is waiting for user input

**FR36:** UI shall show warning indicator for sessions with no output for extended period (stuck detection)

### Web Interface - Workflow Visualization

**FR37:** System shall parse BMAD workflow status from YAML/markdown files in `.bmad/bmm/status/`

**FR38:** UI shall display visual workflow progress panel showing current step

**FR39:** Workflow panel shall show completed steps with checkmark indicator (✓)

**FR40:** Workflow panel shall show current step with arrow indicator (→) and highlighting

**FR41:** Workflow panel shall show upcoming steps with circle indicator (○)

**FR42:** Users can click workflow steps for navigation or context (optional enhancement)

### Web Interface - Document Viewing

**FR43:** UI shall provide document browser for navigating workspace files

**FR44:** Users can browse folder structures (stories, PRDs, architecture docs, etc.)

**FR45:** Users can view markdown files rendered in browser

**FR46:** Document viewer shall support toggling between current state and diff view

**FR47:** Diff view shall show changes since last user viewing

**FR48:** Users can view documents without leaving the UI

### Web Interface - Notifications & Status

**FR49:** System shall send browser notifications when Claude asks questions (requires user input)

**FR50:** Tab badges shall indicate sessions requiring attention

**FR51:** UI shall display idle timer showing time since last session activity

**FR52:** System shall prioritize status information: stuck warnings > input requests > current workflow step

### Backend Architecture

**FR53:** Backend shall use Express.js for HTTP server and static file serving

**FR54:** Backend shall use WebSocket (ws library) for bidirectional real-time communication

**FR55:** Backend shall use node-pty for spawning Claude CLI with proper TTY emulation

**FR56:** System shall maintain separate WebSocket connection per session

**FR57:** Backend shall handle stdin/stdout/stderr streaming for all active sessions concurrently

**FR58:** System shall implement graceful shutdown when container stops

### State & Persistence

**FR59:** System shall store session state in `/workspace/.claude-container-sessions.json`

**FR60:** System shall use atomic write operations (write temp file, rename) to prevent JSON corruption

**FR61:** System shall handle corrupted session file gracefully (rebuild from worktrees if needed)

**FR62:** System shall preserve all session metadata across container restarts

**FR63:** BMAD workflow state shall persist in workspace YAML files (handled by BMAD, not container)

### Error Handling & Recovery

**FR64:** System shall gracefully handle Claude CLI process crashes without affecting other sessions

**FR65:** System shall implement WebSocket reconnection logic for dropped connections

**FR66:** System shall recover from container crashes by reading persisted session state on restart

**FR67:** Users can analyze incomplete work and resume sessions manually after crashes

**FR68:** System shall provide error messages and logging for debugging

### Resource Management

**FR69:** System shall optimize for 4 concurrent sessions (design target)

**FR70:** System shall monitor memory and CPU usage per session (optional)

**FR71:** System shall clean up terminated Claude CLI processes

**FR72:** System shall handle resource limits gracefully (no silent failures)

---

## Non-Functional Requirements

### Performance

**NFR-PERF-1: Real-Time Terminal Latency**
- Terminal output streaming shall have <100ms latency between Claude CLI output and browser display
- Rationale: Terminal feel requires near-instantaneous responsiveness for natural interaction

**NFR-PERF-2: UI Responsiveness**
- Tab switching shall complete in <50ms
- UI interactions (button clicks, navigation) shall respond within <200ms
- Rationale: Smooth UI critical for managing multiple sessions without frustration

**NFR-PERF-3: Session Startup**
- New session creation (worktree + Claude spawn) shall complete within 5 seconds
- Container initial startup shall complete within 30 seconds
- Rationale: Delays in session creation interrupt flow; startup time acceptable as one-time cost

**NFR-PERF-4: Concurrent Session Handling**
- System shall handle 4 concurrent Claude sessions without performance degradation
- Each session shall maintain independent performance (no cross-session interference)
- Rationale: Design target is 4 sessions; must deliver full performance at design capacity

### Reliability

**NFR-REL-1: Infrastructure Stability**
- Container shall run continuously for multi-day sessions without restart required
- System shall be "rock-solid stable" as infrastructure-level software
- Rationale: This becomes THE PRIMARY WORKFLOW - unreliability is unacceptable

**NFR-REL-2: Crash Isolation**
- Claude CLI crash in one session shall not affect other sessions
- Container crash shall not corrupt session state (atomic writes protect JSON)
- Rationale: Parallel sessions must be truly independent; state loss defeats persistence

**NFR-REL-3: WebSocket Resilience**
- WebSocket connections shall automatically reconnect after network interruption
- Reconnection shall resume terminal streaming without data loss
- Rationale: Network hiccups should not require manual intervention

**NFR-REL-4: Graceful Degradation**
- System shall continue operating if non-critical features fail (e.g., workflow parsing, notifications)
- Core terminal functionality shall remain available even if UI enhancements fail
- Rationale: Terminal emulation is critical path; other features are enhancements

### Security

**NFR-SEC-1: Container Isolation**
- Container filesystem shall be fully isolated from host system
- Destructive commands within container shall not affect host
- Rationale: Core value proposition is safe sandbox for unrestricted Claude tools

**NFR-SEC-2: Volume Mount Safety**
- Workspace mount is read-write (intentional - Claude needs to modify project)
- Claude config mount is read-only (prevent accidental config corruption)
- Rationale: Workspace changes are desired output; config changes are errors

**NFR-SEC-3: Single-User Local Security Model**
- No authentication required (local single-user tool)
- Network access restricted to localhost by default
- Rationale: Personal development tool, not multi-user service

**NFR-SEC-4: Audit Logging**
- System shall log all destructive commands executed by Claude (for debugging, not security)
- Logs shall be accessible for post-mortem analysis
- Rationale: Helps debug when Claude does something unexpected

### Scalability

**NFR-SCALE-1: Session Limit**
- System optimized for 4 concurrent sessions (hard design constraint)
- May support more but performance not guaranteed beyond 4
- Rationale: 4 sessions is user cognitive limit; optimize for realistic usage

**NFR-SCALE-2: Resource Allocation**
- Each Claude session: ~1-2GB RAM estimated
- Total system: 4-8GB RAM for 4 sessions (reasonable for dev machine)
- CPU: 4 cores sufficient for 4 sessions
- Rationale: Must run on typical developer workstation

**NFR-SCALE-3: Workspace Size**
- System shall handle workspaces up to 10GB (typical project size)
- No artificial limits on number of files or worktrees
- Rationale: Real projects have substantial codebases; tool must handle realistic scale

### Usability

**NFR-USE-1: Zero Configuration Startup**
- Single `docker run` command starts entire system
- No separate configuration files or setup steps required
- Rationale: Simple startup critical for daily-use infrastructure

**NFR-USE-2: Intuitive UI**
- UI shall be self-explanatory without documentation
- Common operations (create session, switch tabs, interrupt) shall be discoverable
- Rationale: Minimize friction in daily workflow

**NFR-USE-3: Clear Error Messages**
- Error messages shall explain what happened and suggest remediation
- No cryptic error codes or technical jargon
- Rationale: User needs to quickly understand and fix issues

### Maintainability

**NFR-MAINT-1: Code Organization**
- Clean separation between backend (Node.js/Express) and frontend (React)
- Modular code structure (sessionManager.js, worktreeManager.js, statusParser.js, etc.)
- Rationale: Maintainability critical for infrastructure software

**NFR-MAINT-2: Docker Image Updates**
- Container image shall support versioning (semantic versioning)
- Layer caching shall enable fast rebuilds during development
- Rationale: Need to iterate quickly while maintaining stable releases

**NFR-MAINT-3: Documentation**
- README with docker run command and basic usage
- Architecture overview for contributors
- Troubleshooting guide for common issues
- Rationale: Long-lived infrastructure requires documentation for future maintenance

### Compatibility

**NFR-COMPAT-1: Browser Support**
- UI shall work in modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- No mobile browser support required (desktop tool)
- Rationale: Desktop development workflow; mobile out of scope

**NFR-COMPAT-2: Docker Host Requirements**
- Docker Desktop on macOS (primary target)
- Docker Engine on Linux (secondary target)
- Windows via WSL2 + Docker Desktop (tertiary target)
- Rationale: User's environment is macOS; support common alternatives

**NFR-COMPAT-3: Project Compatibility**
- Must support emassistant project (Python 3.13)
- Must support work projects (Java 21, npm-based)
- Rationale: Validation criteria from brainstorming session

---

## Summary

This PRD defines **Claude Container** - infrastructure-level software that transforms Claude Code from a supervised assistant into a truly autonomous development partner.

**Core Value Proposition:**
Replace manual tool approval friction with safe Docker sandbox isolation, enabling parallel autonomous development across multiple epics while providing browser-based visibility into progress.

**Key Differentiator:**
This is not a "sometimes tool" - **this becomes THE PRIMARY WORKFLOW**. Every project will run in this containerized environment, making rock-solid stability a requirement, not a nice-to-have.

**Requirements Summary:**
- **72 Functional Requirements** across 9 capability areas (Container Management, Sessions, Git Worktrees, Terminal Emulation, UI Navigation, Workflow Visualization, Document Viewing, Notifications, Backend Architecture, State/Persistence, Error Handling, Resources)
- **22 Non-Functional Requirements** covering Performance, Reliability, Security, Scalability, Usability, Maintainability, and Compatibility
- **4-Sprint Implementation Plan** with clear success criteria per sprint
- **Design Constraint:** Optimized for 4 concurrent sessions (user cognitive limit)

**Technical Foundation:**
- Docker container (Ubuntu 22.04 + Python 3.13 + Java 21 + Node.js + build tools)
- React + xterm.js frontend
- Node.js + Express + WebSocket backend
- node-pty for Claude CLI TTY emulation
- Git worktrees for parallel development isolation

**Success Validation:**
"Getting more while doing less" - qualitative feeling that Claude Container has become indispensable daily infrastructure. User chooses containerized Claude over native terminal for 100% of interactions.

---

_This PRD captures the complete requirements for claude-container - infrastructure that enables autonomous AI-assisted development through safe sandboxing, parallel session management, and visual workflow tracking._

_Created through BMAD Method collaborative discovery between Kyle and Product Manager agent John._

_Referenced Documentation: docs/claude-container-project.md (brainstorming session), docs/architecture-decisions.md (11 ADRs)_
