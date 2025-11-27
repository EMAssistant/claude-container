# Architecture Decision Records (ADR)

**Claude Container Project**

---

## ADR-001: Single Container vs External Orchestrator

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: Winston (Architect), John (PM), User

### Context
Initial architecture proposed external Node.js orchestrator on host managing multiple Docker containers (one per Claude session). User requirement: "one container that's running, with a service managing multiple Claude sessions inside the container."

### Decision
Build a single, self-contained Docker container that runs:
- One Node.js backend service
- Multiple Claude CLI processes (sessions) within the container
- React frontend served from the same backend

### Rationale

**Simplicity**:
- Single `docker run` command to start everything
- No external dependencies or orchestration complexity
- User hits `localhost:3000` and everything works

**Resource Efficiency**:
- Shared base system resources (OS, Node.js runtime)
- Lighter than spinning up N containers with full OS each
- Easier resource management and limits

**State Management**:
- Simpler persistence model (JSON file in workspace)
- No cross-container coordination needed
- Fewer moving parts = fewer failure modes

**User Experience**:
- One-stop shop matches user requirement
- Container start = service ready
- No configuration of multiple components

### Alternatives Considered

**Option A: External orchestrator + container per session**
- Pros: Better isolation between sessions, simpler per-session lifecycle
- Cons: Complex setup, multiple containers to manage, overkill for single-user local use
- Rejected: Overcomplicated for the use case

**Option B: Kubernetes-based orchestration**
- Pros: Production-grade scaling, robust state management
- Cons: Massive overkill, complex local setup, steep learning curve
- Rejected: User explicitly wants simple local tool

### Consequences

**Positive**:
- Minimal setup and configuration
- Easy to distribute (single Docker image)
- Faster startup (one container vs many)
- Simpler debugging and logging

**Negative**:
- Session isolation only at process level (not container level)
- Container crash affects all sessions
- Harder to implement per-session resource limits

**Mitigation**:
- Use node-pty for process isolation
- Implement graceful shutdown and recovery
- Session state persisted to workspace survives crashes

---

## ADR-002: BMAD in Workspace vs Separate Mount

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: Winston (Architect), User

### Context
Initial architecture proposed mounting host `.bmad` directory separately as read-only. User requirement: "bmad won't be mounted separately. it should be loaded into the workspace with a button in the UI to update it."

### Decision
Install BMAD Method inside the workspace directory (`/workspace/.bmad`) and provide UI button to run `npx bmad-method install` for updates.

### Rationale

**Version Control**:
- BMAD configuration can be version-controlled with project
- Different projects can use different BMAD versions
- Reproducible builds across team members

**Update Flexibility**:
- User can update BMAD without rebuilding container
- Updates via npm command, not container restart
- Test new BMAD versions easily

**Project Isolation**:
- Each workspace has its own BMAD configuration
- No shared state between projects
- Customizations stay with the project

**Simplicity**:
- Fewer volume mounts to configure
- One workspace mount contains everything
- Easier docker run command

### Alternatives Considered

**Option A: Separate read-only mount from host**
- Pros: Shared BMAD across projects, prevent accidental modification
- Cons: Can't update without host changes, version conflicts between projects
- Rejected: User wants in-workspace with update capability

**Option B: Bake BMAD into container image**
- Pros: Guaranteed version consistency, no installation needed
- Cons: Container rebuild for BMAD updates, inflexible
- Rejected: Too rigid, doesn't support updates

### Consequences

**Positive**:
- Project-specific BMAD configurations
- Easy updates via UI button
- Simpler volume mount strategy
- Version control friendly

**Negative**:
- Each project needs BMAD installation
- Slightly larger workspace size
- Could have version drift between projects (though this can be feature)

**Mitigation**:
- Document BMAD installation as setup step
- UI button makes updates obvious
- Include BMAD version in project docs

---

## ADR-003: Git Worktrees for Parallel Development

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: User, Winston (Architect), Murat (TEA)

### Context
Need mechanism for parallel development across multiple epics/features without conflicts. User familiar with git worktrees and suggests this approach.

### Decision
Use git worktrees to create isolated working directories for each Claude session. Each session operates in its own worktree on a separate branch.

### Rationale

**True Parallelism**:
- Each worktree is independent working directory
- Sessions can modify different files without conflicts
- Parallel commits, builds, tests across features

**Git Native**:
- Built-in Git feature, no custom tooling
- Standard workflows apply
- Familiar to developers

**Resource Efficient**:
- Worktrees share `.git` directory (single repository)
- Less disk space than separate clones
- Faster creation than full clones

**User Preference**:
- User already using worktrees successfully
- Proven approach for the use case
- Matches mental model

### Alternatives Considered

**Option A: Single working directory with branch switching**
- Pros: Simplest, traditional Git workflow
- Cons: Only one session can work at a time, defeats parallel requirement
- Rejected: Doesn't support parallel development

**Option B: Separate repository clones per session**
- Pros: Complete isolation, simpler to reason about
- Cons: Huge disk space waste, slow clone operations, complex sync
- Rejected: Resource inefficient, overcomplicated

**Option C: Docker volumes per session**
- Pros: Strong isolation
- Cons: Complex volume management, doesn't integrate with Git workflow
- Rejected: Disconnected from version control

### Consequences

**Positive**:
- Parallel development achievable
- Standard Git operations work
- Efficient resource usage
- Clear separation between features

**Negative**:
- Worktrees share `.git` directory (potential race conditions)
- Manual merge required across worktrees
- Complexity if user not familiar with worktrees
- Orphaned worktrees need cleanup

**Risks** (from Murat, TEA):
- Concurrent git operations on shared `.git` could conflict
- Merge conflicts if features touch same code
- Worktree cleanup on session destroy

**Mitigation**:
- Test concurrent git operations thoroughly
- Document merge strategy for users
- Implement optional worktree cleanup
- User chooses features that touch different code areas

---

## ADR-004: Node-PTY for Claude CLI Execution

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: Amelia (DEV), Winston (Architect)

### Context
Need to spawn Claude CLI processes and capture their I/O for browser display. Choice between standard `child_process.spawn` or `node-pty` (pseudo-terminal).

### Decision
Use `node-pty` library to spawn Claude CLI processes in pseudo-terminals (PTY).

### Rationale

**Interactive Prompt Support**:
- Claude CLI may use interactive prompts
- PTY provides proper TTY environment
- Terminal control codes work correctly

**True Terminal Emulation**:
- xterm.js in frontend expects PTY-style output
- Colors, cursor control, screen clearing all work
- More faithful terminal experience

**Signal Handling**:
- Ctrl+C, Ctrl+D, and other signals work correctly
- Better process lifecycle control
- Graceful shutdown capabilities

**Industry Standard**:
- Used by VS Code terminal, Hyper, other terminal apps
- Well-maintained, battle-tested library
- Proven for this exact use case

### Alternatives Considered

**Option A: child_process.spawn**
- Pros: Built-in Node.js, simpler, no dependencies
- Cons: No TTY emulation, interactive prompts fail, poor terminal compatibility
- Rejected: Insufficient for full Claude CLI support

**Option B: docker exec with PTY**
- Pros: Docker handles TTY allocation
- Cons: Requires nested Docker or complex setup, goes against single-container design
- Rejected: Architecture mismatch

### Consequences

**Positive**:
- Full Claude CLI compatibility
- Rich terminal features (colors, positioning, etc.)
- Better user experience matches native terminal
- Handles edge cases (signals, interactive input)

**Negative**:
- Additional npm dependency
- Slightly more complex than basic spawn
- Native compilation required (potential build issues)

**Mitigation**:
- Lock node-pty version for stability
- Document build requirements
- Include in Docker image build (avoids user build issues)

---

## ADR-005: WebSocket for Terminal Streaming

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: Winston (Architect), Amelia (DEV)

### Context
Need real-time bidirectional communication between browser and Claude CLI processes. Terminal output must stream to browser, browser input must reach Claude CLI.

### Decision
Use WebSocket protocol for terminal I/O streaming between backend and frontend.

### Rationale

**Bidirectional**:
- Terminal needs both output (Claude → browser) and input (browser → Claude)
- WebSocket provides full-duplex communication
- Single connection handles both directions

**Low Latency**:
- Real-time streaming critical for terminal experience
- WebSocket has minimal overhead
- No HTTP request/response cycle per message

**Browser Support**:
- Native WebSocket API in all modern browsers
- xterm.js designed to work with WebSockets
- Standard pattern for web-based terminals

**Event-Driven**:
- Matches terminal I/O model (async events)
- Easy to handle multiple concurrent sessions
- Natural fit for Node.js event loop

### Alternatives Considered

**Option A: Server-Sent Events (SSE)**
- Pros: Simpler than WebSocket, automatic reconnection
- Cons: One-way only (server → client), separate HTTP request needed for input
- Rejected: Bidirectional requirement eliminates this

**Option B: Long Polling**
- Pros: Works everywhere, no special protocol
- Cons: High latency, inefficient, poor UX for terminal
- Rejected: Unacceptable latency for interactive terminal

**Option C: HTTP/2 or gRPC**
- Pros: Modern protocols, good performance
- Cons: Overcomplicated, WebSocket simpler for this use case
- Rejected: Overkill, adds complexity

### Consequences

**Positive**:
- Real-time terminal experience
- Efficient bandwidth usage
- Standard pattern, well-documented
- Good library support (ws for Node.js)

**Negative**:
- Connection management complexity (reconnection, errors)
- Potential buffer overflow if output too fast
- Stateful connection (harder to scale, though not a concern for single-user)

**Risks** (from Murat, TEA):
- WebSocket buffer overflow if Claude outputs massive data
- Connection drops need graceful handling

**Mitigation**:
- Implement backpressure if buffer fills
- Automatic reconnection with state recovery
- Rate limiting if output too verbose
- Test with high-volume Claude outputs

---

## ADR-006: React Frontend with xterm.js

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: Sally (UX Designer), Amelia (DEV)

### Context
Need to build web UI for terminal emulation, document viewing, and workflow visualization. Technology choice impacts development speed and user experience.

### Decision
Use React for frontend framework with xterm.js for terminal emulation component.

### Rationale

**React Benefits**:
- Component-based architecture fits UI structure (tabs, panels, etc.)
- Rich ecosystem for UI components
- Easy state management for multiple sessions
- Fast development with modern tooling

**xterm.js for Terminal**:
- Industry-standard terminal emulator (used by VS Code, Hyper, etc.)
- Full VT100/xterm compatibility
- Excellent performance with large outputs
- WebSocket integration built-in
- Actively maintained

**Combined Strengths**:
- xterm.js integrates cleanly as React component
- React handles UI chrome, xterm handles terminal
- Clear separation of concerns

**Developer Familiarity**:
- React widely known
- Easier to maintain and extend
- Good documentation and community

### Alternatives Considered

**Option A: Vanilla JavaScript**
- Pros: No framework overhead, faster load time
- Cons: More code for state management, slower development, harder to maintain
- Rejected: Development speed matters more than marginal performance

**Option B: Vue.js**
- Pros: Simpler than React, good performance
- Cons: Smaller ecosystem, less familiarity
- Rejected: React ecosystem richer, more widely known

**Option C: Svelte**
- Pros: Compiled, no runtime, fast
- Cons: Smaller community, less mature ecosystem
- Rejected: React safer choice for maintainability

**Option D: Alternative terminals (hterm, term.js)**
- Pros: Different feature sets
- Cons: xterm.js is most mature, best maintained, used in production by major projects
- Rejected: xterm.js is clear winner in terminal emulator space

### Consequences

**Positive**:
- Rapid UI development
- Professional terminal experience
- Rich component ecosystem (markdown renderers, etc.)
- Easy to add features later

**Negative**:
- Framework bundle size (React ~40KB gzipped)
- Build step required (webpack/vite)
- More complex than vanilla JS

**Mitigation**:
- Use production builds for size optimization
- Code splitting if needed
- Bundle size acceptable for local tool (not public site)

---

## ADR-007: JSON File for Session Persistence

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: Amelia (DEV), Winston (Architect)

### Context
Sessions must persist across container restarts. Need to store session metadata (ID, name, worktree path, status, timestamps).

### Decision
Store session data in JSON file at `/workspace/.claude-container-sessions.json`.

### Rationale

**Simplicity**:
- No database server needed
- Single file, easy to read/write
- Human-readable for debugging

**Persistence**:
- Lives in workspace (mounted volume)
- Survives container restarts
- No separate backup mechanism needed

**Portability**:
- JSON easily parsed in any language
- Can migrate to database later if needed
- Version control friendly (can gitignore if desired)

**Atomic Writes**:
- Write to temp file, rename (atomic operation)
- Prevents corruption on crash
- Simple to implement correctly

**Single-User Fit**:
- No concurrent access from multiple users
- No need for database locking
- Number of sessions small (< 100)

### Alternatives Considered

**Option A: SQLite**
- Pros: ACID guarantees, relational queries, battle-tested
- Cons: Overkill for simple key-value storage, adds dependency
- Rejected: JSON sufficient for scale and simplicity

**Option B: Redis**
- Pros: Fast, pub/sub for notifications
- Cons: Another service to run, persistence config needed, overcomplicated
- Rejected: Way overkill for single-user local tool

**Option C: In-memory only**
- Pros: Simplest possible
- Cons: Loses all sessions on restart, unacceptable
- Rejected: Persistence required

### Consequences

**Positive**:
- Zero dependencies
- Easy debugging (cat the file)
- Fast read/write for small datasets
- Simple backup (copy file)

**Negative**:
- No ACID guarantees (though atomic rename helps)
- No built-in schema validation
- Could theoretically have corruption
- Manual locking if concurrent writes (unlikely)

**Mitigation**:
- Implement atomic write (write temp, rename)
- JSON schema validation on read
- Backup file on write
- Graceful handling of corrupted file (rebuild from worktrees)

---

## ADR-008: All Tools Marked Safe in Sandbox

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: User, Winston (Architect), Murat (TEA)

### Context
Core problem: Claude needs approval for destructive commands on host. User wants autonomous execution. Container provides isolation layer.

### Decision
Mark all tools as safe (no approval required) within the Docker container. Claude has unrestricted CLI access.

### Rationale

**Container Isolation**:
- Docker provides filesystem isolation
- Worst case: Claude destroys container filesystem
- Host system remains untouched

**User Goal**:
- Entire point of project is autonomous epic execution
- Approval prompts defeat the purpose
- User explicitly accepts risks within sandbox

**Rebuilding is Cheap**:
- Container is ephemeral, easily recreated
- `docker run` brings back clean environment
- Workspace (mounted volume) persists

**Development Reality**:
- Claude needs tools like `rm`, `git reset --hard`, etc.
- Blocking these prevents real work
- False positives on approval would be constant

### Alternatives Considered

**Option A: Whitelist safe commands only**
- Pros: Extra safety layer
- Cons: Impossible to predict all needed commands, defeats autonomous goal
- Rejected: Undermines project purpose

**Option B: Prompt for approval but within container**
- Pros: Still catches obviously bad commands
- Cons: Brings back babysitting problem, just moved to different location
- Rejected: Same friction as current state

**Option C: Command auditing without blocking**
- Pros: Observability without friction
- Cons: Not really an alternative, can do this alongside
- Accepted as complement: Log destructive commands for debugging

### Consequences

**Positive**:
- Autonomous Claude execution achieved
- No babysitting required
- Claude can self-recover from mistakes
- User can kick off epic and walk away

**Negative**:
- Claude could thrash the container filesystem
- Wasted compute on bad commands
- Might need container restart on severe issues

**Mitigation** (from Murat, TEA):
- Log all destructive commands for audit trail
- Helps debug when Claude does something unexpected
- Not for security, for observability
- Monitor container health, auto-restart if needed

**Risk Assessment**: Low. Container isolation protects host. Workspace backup strategy recommended but separate concern.

---

## ADR-009: Development Environment Requirements

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: User (based on project needs)

### Context
Container must support both emassistant project and work projects. Need to identify required tools and versions to include in base image.

### Decision
Include comprehensive development environment in base container image:

**Required Tools & Versions**:
- **Python 3.13** - For Python-based projects
- **Amazon Corretto Java 21** (or OpenJDK 21) - For Java-based work projects
- **Node.js + npm** - For JavaScript/TypeScript projects and container app itself
- **jq** - JSON processing utility
- **git** - Version control
- **curl, wget** - HTTP clients
- **build-essential** - Compilers and build tools (gcc, g++, make)

**Rationale for Comprehensive Approach**:
- User's projects span multiple languages/ecosystems
- Installing tools on-demand would slow development
- Container rebuild is rare, so size impact acceptable
- Having all tools pre-installed enables immediate epic execution

### Alternatives Considered

**Option A: Minimal base + on-demand installation**
- Pros: Smaller image, only install what's needed
- Cons: Delays at runtime, Claude would need to install tools mid-epic, complexity
- Rejected: Friction contradicts "autonomous execution" goal

**Option B: Separate containers per language**
- Pros: Optimized per project type
- Cons: User would need multiple containers, complex setup, violates "one-stop shop"
- Rejected: Adds operational complexity

**Option C: User-customizable Dockerfile**
- Pros: Maximum flexibility
- Cons: Every user builds their own, no standard image to distribute
- Rejected: Want shareable base image for simplicity

### Consequences

**Positive**:
- Claude can immediately work on any user project
- No runtime delays installing tools
- Validated support for emassistant + work projects
- Easy to add more tools if needed

**Negative**:
- Larger Docker image (~2-3GB estimated)
- Longer initial build time
- Some tools may never be used in specific projects

**Mitigation**:
- Use multi-stage builds to minimize layers
- Image size acceptable for local development (not cloud deployment)
- First build is slow, but cached layers make rebuilds fast
- Distribute pre-built image to avoid build entirely

**Validation**: Sprint 1 success criteria includes "validate can develop emassistant project and work projects"

---

## ADR-010: Maximum 4 Concurrent Sessions

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: User (based on cognitive limits)

### Context
Need to determine resource constraints and optimize for realistic usage. How many parallel sessions should the system support?

### Decision
Design for maximum 4 concurrent Claude sessions.

### Rationale

**User Cognitive Limit**:
- 4 is the maximum user can mentally track simultaneously
- More sessions = context switching overhead, diminishing returns
- User's real-world experience: 4 is sweet spot

**Resource Planning**:
- Each Claude session: ~1-2GB RAM estimated
- 4 sessions = 4-8GB RAM total (reasonable for dev machine)
- CPU: 4 cores can handle 4 sessions comfortably
- Disk I/O: 4 git worktrees manageable

**Simplicity**:
- Don't over-engineer for hypothetical 20+ session scenario
- Optimize UI for 4 tabs, not infinite scalability
- Clear constraint makes design decisions easier

### Alternatives Considered

**Option A: Unlimited sessions**
- Pros: Maximum flexibility
- Cons: Resource exhaustion, UI cluttered, unrealistic usage
- Rejected: No real user need, adds complexity

**Option B: Hard limit at 2-3 sessions**
- Pros: Even more resource-efficient
- Cons: User sometimes wants 4, would feel constrained
- Rejected: 4 is validated user need

**Option C: Configurable limit**
- Pros: User can adjust based on machine
- Cons: Adds configuration complexity, one more thing to set
- Rejected: 4 is good default, configurability unnecessary for v1

### Consequences

**Positive**:
- Clear design target for resource optimization
- UI can be designed for specific tab count (not infinite scroll)
- Prevents resource exhaustion scenarios
- Matches validated user behavior

**Negative**:
- Hard limit might frustrate future users with different workflows
- Potential artificial constraint if use cases evolve

**Mitigation**:
- Document as "optimized for 4, not hard-limited"
- If user later needs more, can be revisited
- Resource monitoring will inform if 4 is sustainable

**Note**: Could implement soft warning at 4 ("performance may degrade") rather than hard block, but start with 4 as design target.

---

## ADR-011: ESC Key Interrupt as Primary Control

**Date**: 2025-11-23
**Status**: Accepted
**Deciders**: User, Sally (UX Designer)

### Context
User needs ability to stop Claude mid-operation and provide new direction. How to implement terminal-like interrupt behavior in browser UI?

### Decision
Implement dual interrupt mechanism:
1. **ESC key** - Browser captures ESC keypress, sends Ctrl+C to Claude PTY
2. **STOP button** - Visible UI button for same function

### Rationale

**Terminal Parity**:
- Users familiar with Ctrl+C in terminal
- ESC is browser-safe alternative (Ctrl+C captured by browser)
- Provides expected "interrupt current operation" behavior

**Accessibility**:
- ESC key for power users (keyboard-driven workflow)
- STOP button for discoverability (new users see it in UI)
- Redundancy ensures always a way to regain control

**Safety**:
- User can always interrupt runaway Claude operations
- No "stuck in infinite loop" scenario
- Maintains user agency over autonomous agent

### Alternatives Considered

**Option A: Ctrl+C only**
- Pros: Exact terminal behavior
- Cons: Browser intercepts Ctrl+C, complex to override
- Rejected: Browser compatibility nightmare

**Option B: Button only**
- Pros: Obvious, always visible
- Cons: Slower than keyboard, not terminal-like
- Rejected: Power users would be frustrated

**Option C: Custom key combo (e.g., Cmd+K)**
- Pros: Avoid browser conflicts
- Cons: Not discoverable, need to teach users
- Rejected: ESC is more intuitive

### Consequences

**Positive**:
- Terminal-like feel with ESC interrupt
- Visible STOP button for discoverability
- User always has control over Claude
- Dual mechanism = redundancy/safety

**Negative**:
- Need to handle ESC in React (prevent default behaviors)
- Button takes UI space
- Two mechanisms to maintain (but simple logic)

**Implementation Notes**:
- Frontend: Capture ESC keypress (event.key === 'Escape')
- Send interrupt signal over WebSocket to backend
- Backend: Send Ctrl+C (SIGINT) to Claude PTY process
- Button triggers same WebSocket message as ESC
- Visual feedback: "Interrupting..." indicator during signal send

---

## Summary

These 11 ADRs capture the key architectural decisions for the Claude Container project:

1. **Single Container vs Orchestrator** - Self-contained approach wins
2. **BMAD in Workspace** - Install in workspace, not separate mount
3. **Git Worktrees** - Parallel development strategy
4. **Node-PTY** - Full TTY emulation for Claude CLI
5. **WebSocket** - Real-time bidirectional terminal streaming
6. **React + xterm.js** - Frontend framework and terminal emulator
7. **JSON Persistence** - Simple file-based session storage
8. **Unrestricted Tools** - Sandbox enables complete CLI access
9. **Dev Environment** - Comprehensive toolset (Python 3.13, Java 21, npm, jq, etc.)
10. **4 Session Maximum** - Design target based on cognitive limits
11. **ESC Interrupt** - Terminal-like control with dual mechanisms

Each decision prioritizes:

1. **Simplicity** - Single-user local tool, avoid overengineering
2. **User Goals** - Autonomous execution, parallel development, browser UI
3. **Boring Technology** - Proven tools (Docker, React, WebSocket, Git)
4. **Developer Experience** - Easy setup, intuitive usage, minimal configuration
5. **Production Quality** - This is infrastructure, not a prototype

Future ADRs will document additional decisions as the project evolves.

---

**Document Maintainer**: Winston (Architect)
**Last Updated**: 2025-11-23
**Status**: Living document, updated as decisions made
