# Claude Container Project

**Project Brainstorming Session - 2025-11-23**

---

## Problem Statement

### Current Pain Points
1. **Daily friction with tool approval** - Claude Code requires manual approval for CLI tools to prevent accidentally running destructive commands on the host system. This blocks autonomous epic completion and requires constant babysitting.

2. **Limited parallel workflow capability** - Currently restricted to sequential development in a single terminal session. Cannot efficiently parallelize work across multiple epics or features.

3. **Poor workflow visibility** - Terminal-based interface makes it difficult to track progress across multiple BMAD workflows, view generated documents, or understand current status.

### User Goals
- Give Claude Code an epic and have it run through development process to completion autonomously
- Develop multiple features in parallel across different sessions
- View workflow status, documents, and progress in a browser interface
- Safely sandbox Claude's tool usage without risk to host system

---

## Solution Overview

**Claude Container**: A self-contained Docker environment that provides:
1. **Safe sandbox** for Claude CLI with unrestricted tool access
2. **Web-based UI** for managing multiple parallel Claude sessions
3. **Visual workflow tracking** integrated with BMAD Method
4. **Document viewing** for generated stories, PRDs, architecture docs, etc.
5. **Git worktree management** for parallel feature development

**Target User**: Individual developer running on local machine (no auth, no session sharing, single-user)

**⭐ Critical Product Insight**: This is not a "sometimes tool" - this becomes the PRIMARY workflow for all development. This is infrastructure-level software requiring rock-solid stability, not an experimental prototype.

---

## Goals & Non-Goals

### Goals
- ✅ Enable autonomous Claude Code execution without approval prompts
- ✅ Support multiple parallel Claude sessions (different epics/features)
- ✅ Provide browser-based UI for session management and monitoring
- ✅ Integrate BMAD workflow status visualization
- ✅ Enable document viewing (markdown rendering) in browser
- ✅ Manage git worktrees for parallel development
- ✅ Maintain complete isolation from host system

### Non-Goals
- ❌ Multi-user authentication or authorization
- ❌ Session sharing across machines or users
- ❌ Real-time collaboration features
- ❌ Cloud deployment or hosting
- ❌ Mobile interface (desktop browser only)

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────┐
│  Docker Container (Ubuntu base)         │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ Node.js Backend (Express)          │ │
│  │ - Serves React frontend            │ │
│  │ - Manages Claude CLI processes     │ │
│  │ - WebSocket for real-time output   │ │
│  │ - REST API for session control     │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │Claude CLI│  │Claude CLI│  │Claude..││
│  │Session 1 │  │Session 2 │  │Session3││
│  │(node-pty)│  │(node-pty)│  │(pty)   ││
│  └──────────┘  └──────────┘  └────────┘│
│                                          │
│  /workspace/                             │
│    ├── worktree-1/  (Epic 1)            │
│    ├── worktree-2/  (Epic 2)            │
│    ├── worktree-3/  (Epic 3)            │
│    └── .bmad/       (BMAD Method)       │
│                                          │
│  /config/  (mounted .claude-code)       │
└─────────────────────────────────────────┘
         ↑
         │ Volume Mounts
         │
    Host Machine
```

### Architecture Principles
- **Single container, self-contained** - No external orchestrator needed
- **One container manages multiple sessions** - Not one container per session
- **All tools marked safe in sandbox** - Unrestricted CLI access within container
- **Git worktrees for parallelization** - Each session works in isolated git worktree
- **Browser as primary interface** - Web UI replaces terminal app

---

## Technical Decisions

### Container Strategy

**Base Image**: Ubuntu + Node.js + Claude CLI + standard dev tools (git, build tools, etc.)

**Volume Mounts**:
- Host project directory → `/workspace` (read-write)
  - Contains all worktrees and git repository
  - Contains `.bmad` directory (NOT mounted separately)
- Host `~/.config/claude-code` → `/config/.claude-code` (read-only)
  - Claude Code configuration and MCP servers

**BMAD Integration**:
- BMAD Method installed IN the workspace (not separate mount)
- UI provides "Update BMAD" button to run `npx bmad-method install`
- Allows user to refresh BMAD tooling without container rebuild

**Rationale**: Mounting BMAD in workspace keeps it version-controlled with the project and allows easy updates via npm command.

### Backend Architecture

**Tech Stack**:
- Node.js with Express for HTTP server
- WebSocket (ws library) for real-time terminal streaming
- node-pty for proper TTY pseudo-terminal emulation
- REST API for session management

**Session Management**:
- Store sessions in JSON file: `/workspace/.claude-container-sessions.json`
- Persists across container restarts
- Track: session_id, epic_name, worktree_path, status, creation_time

**Claude CLI Spawning**:
- Use `node-pty` for proper TTY emulation (enables interactive prompts)
- Each session = separate Claude CLI process in its own worktree
- Capture stdout/stderr, stream via WebSocket to frontend
- Handle stdin from browser input

**Git Worktree Management**:
- On session create: `git worktree add ./worktree-{session_id} -b feature/{epic-name}`
- Set Claude CLI `cwd` to worktree directory
- User handles merge strategy (tool doesn't auto-merge)
- Optional cleanup on session destroy

**Status Parsing**:
- Parse BMAD workflow status from YAML/markdown files
- Read from `.bmad/bmm/status/*.yaml` and related markdown files
- Expose via API for frontend visualization

**Document Serving**:
- Serve markdown files from workspace for browser viewing
- Render markdown client-side in frontend

### Frontend Architecture

**Tech Stack**:
- React for UI framework
- xterm.js for terminal emulation
- WebSocket connection to backend
- Markdown renderer (marked.js or similar)

**File Structure**:
```
/container-app/
  /backend/
    server.js           # Express + WebSocket server
    sessionManager.js   # Create/manage Claude CLI processes
    statusParser.js     # Parse BMAD status files
    worktreeManager.js  # Git worktree operations
  /frontend/
    /src/
      App.jsx           # Main React app
      SessionTab.jsx    # Individual session view
      WorkflowPanel.jsx # Workflow status visualization
      DocumentViewer.jsx # Markdown document renderer
```

### Startup Flow

1. User runs: `docker run -p 3000:3000 -v $(pwd):/workspace -v ~/.config/claude-code:/config/.claude-code:ro claude-container`
2. Container starts, backend launches on port 3000
3. User opens `localhost:3000` in browser
4. Frontend loads, shows empty state with "+ New Session" button
5. User creates sessions as needed

---

## UX Design Concepts

### Initial State
- Empty dashboard with prominent "+ New Session" button
- Welcome message explaining how to get started

### Session Creation Flow
1. User clicks "+ New Session"
2. Modal appears: "Create New Session"
3. Input field with pre-generated worktree name (e.g., `feature-2025-11-23-001`)
4. User can override name or accept default
5. Click "Create" → backend creates worktree, spawns Claude CLI
6. New tab appears with session name

### Active Session View

**Split Screen Layout**:
```
┌─────────────────────────────────────────────────┐
│ [Tab: User Auth] [Tab: Payment] [+]             │
├──────────────────┬──────────────────────────────┤
│                  │  📊 Workflow Status          │
│   Terminal       │  ✓ 1. PRD Created           │
│   (xterm.js)     │  ✓ 2. Architecture          │
│                  │  → 3. Story Creation        │
│   Claude Code>   │  ○ 4. Implementation        │
│   _              │  ○ 5. Testing               │
│                  │                              │
│                  ├──────────────────────────────┤
│                  │  📁 Documents                │
│                  │  📄 PRD.md                  │
│                  │  📄 architecture.md         │
│                  │  📁 stories/                │
│                  │     📄 story-1.md           │
│                  │     📄 story-2.md           │
├──────────────────┴──────────────────────────────┤
│ Input: [type here to interact with Claude]      │
└─────────────────────────────────────────────────┘
```

**Key Features**:
- **Tabbed interface** - Switch between multiple active sessions
- **Terminal pane** - Full xterm.js terminal connected to Claude CLI
- **Workflow status panel** - Visual progress through BMAD workflows
  - ✓ Completed steps (green checkmark)
  - → Current step (arrow, highlighted)
  - ○ Upcoming steps (gray circle)
  - Clickable steps to focus Claude or jump to context
- **Documents panel** - Browse and view generated files
  - Click document → opens rendered markdown in modal/panel
  - Folder navigation for organized artifacts
- **Input box** - Type commands/responses to Claude CLI

**Parallel Session Experience**:
- User can switch tabs freely
- Each session progresses independently
- Subtle notifications when session completes step or needs input
- Visual indicators for session status (active, waiting, completed)

### BMAD Integration UI
- **"Update BMAD" button** in settings/toolbar
- Triggers `npx bmad-method install` in container
- Shows progress/output in modal
- Allows keeping BMAD tooling current without container rebuild

---

## Requirements

### Functional Requirements

**FR-1: Container Isolation**
- Container must isolate Claude CLI from host system
- All CLI tools available without restrictions inside container
- Host system remains safe from destructive commands

**FR-2: Multi-Session Management**
- Support creating multiple parallel Claude CLI sessions
- Each session runs independently in its own git worktree
- Sessions persist across container restarts

**FR-3: Web Interface**
- Browser-based UI served from container
- Accessible at `localhost:3000` (or configured port)
- No authentication required (single-user, local only)

**FR-4: Terminal Emulation**
- Full terminal interface in browser using xterm.js
- Real-time output streaming from Claude CLI
- Input capability from browser to Claude CLI
- Support for interactive prompts and TTY features

**FR-5: Git Worktree Management**
- Create git worktree on session creation
- User-defined or auto-generated worktree names
- Each session operates in isolated worktree
- Optional worktree cleanup on session destroy

**FR-6: Workflow Status Visualization**
- Parse BMAD workflow YAML/markdown status files
- Display visual progress through workflow steps
- Highlight current step, show completed/upcoming steps
- Clickable steps for navigation or context

**FR-7: Document Viewing**
- Browse generated documents (stories, PRDs, architecture, etc.)
- Render markdown files in browser
- Navigate folder structures
- View file contents without leaving UI

**FR-8: BMAD Method Updates**
- UI button to update BMAD Method installation
- Executes `npx bmad-method install` in container
- Shows command output/progress to user

**FR-9: Session Persistence**
- Sessions stored in JSON file in workspace
- Survive container restarts
- Track session metadata (name, worktree, status, timing)

**FR-10: Tabbed Interface**
- Multiple tabs for multiple sessions
- Easy switching between active sessions
- Visual indicators for session status
- Create new sessions via "+" tab button

### Non-Functional Requirements

**NFR-1: Performance**
- Handle at least 3-5 concurrent Claude CLI sessions
- Real-time terminal output with minimal latency (<100ms)
- Smooth UI interactions, responsive tab switching

**NFR-2: Reliability**
- Graceful handling of Claude CLI crashes
- Container crash recovery without data loss
- Robust WebSocket reconnection

**NFR-3: Resource Management**
- Reasonable memory limits per session
- CPU throttling to prevent resource exhaustion
- Cleanup of terminated sessions

**NFR-4: Developer Experience**
- Simple docker run command to start
- Intuitive UI requiring no documentation
- Clear error messages and logging

**NFR-5: Maintainability**
- Clean separation between backend and frontend
- Modular code structure
- Well-documented APIs and interfaces

---

## Testing Considerations

### Risk Areas (from Murat, TEA)

**High Risk: Git Worktree Concurrency**
- Worktrees share `.git` directory
- Risk of race conditions on simultaneous git operations
- Potential for merge conflicts if sessions touch same files

**Test Cases Needed**:
1. Spawn 3 sessions, commit/push simultaneously from each
2. Concurrent git config modifications
3. Conflicting changes across worktrees
4. Rebase/merge operations during parallel work

**Medium Risk: Container Crash Recovery**
- Sessions must resume after container restart
- State persistence critical

**Test Cases Needed**:
1. Kill container mid-session, restart, verify sessions resume
2. Data integrity check after unclean shutdown
3. Orphaned worktree cleanup

**Medium Risk: Resource Limits**
- Multiple Claude sessions = high memory/CPU usage
- Risk of resource exhaustion

**Test Cases Needed**:
1. Spawn 10+ sessions, monitor memory/CPU
2. Implement resource limits and test throttling
3. OOM killer behavior and recovery

**Low Risk: WebSocket Buffer Overflow**
- Claude can produce large outputs quickly
- WebSocket buffers could overflow

**Test Cases Needed**:
1. Stress test with verbose Claude output
2. Buffer overflow handling
3. Backpressure mechanisms

### Audit Trail
- Log all destructive commands even in sandbox
- Helps debugging when Claude does something unexpected
- Not for security, just observability

---

## Brainstorming Q&A - Critical Decisions

### Session Resume & Recovery (from Mary)

**Q: When a Claude session crashes mid-epic, what's the recovery path?**

**A: Pick up where we left off using epic/story states**
- Epic and story state files provide breadcrumbs for progress
- Key challenge: Mid-development context loss
- **Resume Protocol**: "Claude, here's the epic state file, here's the story, now analyze the worktree and tell me what you've already done"
- Claude must analyze what's been completed before continuing
- Manual resume trigger (not automatic on container start)

**Implementation Note**: Resume points need further refinement - noted for future discussion.

**Q: What about artifacts Claude generates (build outputs, dependencies, reports)?**

**A: They're all in the worktree**
- `node_modules/` in worktree
- Build outputs in `dist/` or similar
- Test reports in worktree
- All artifacts naturally part of the git worktree structure

**Q: Can you hand off a session from Claude back to manual work?**

**A: Claude-driven for the most part, with interrupt capability**
- Like terminal behavior: ESC key stops current Claude operation
- Returns control to user for new prompt
- User can interrupt and provide new direction anytime

**Q: Upper bound on parallel sessions?**

**A: 4 sessions maximum**
- Design constraint: Optimize for 4 concurrent sessions, not 50
- User limit: 4 is max that can be mentally tracked
- Resource planning based on 4-session scenario

### Container & State Management (from Winston)

**Q: Container update strategy - what happens to active sessions?**

**A: High-level state managed in files for persistence**
- Container updates handled same as container crashes
- State in JSON + BMAD YAML files persists in workspace volume
- Sessions pick up where they left off after container restart
- Same recovery code path for updates, crashes, and restarts

**Q: Workspace conflicts - multiple sessions modifying shared files?**

**A: Git worktrees handle isolation on separate branches**
- Each worktree has its own `package.json`, `node_modules/`, etc.
- Sessions operate on different branches = different directories
- Two sessions doing `npm install` touch different directories
- No conflicts at workspace level

**Q: Network requirements?**

**A: Claude needs internet access**
- Required for: MCP servers, npm installs, git pushes, etc.
- Standard Docker bridge network with outbound allowed
- Docker handles networking, no custom config needed

**Q: State divergence across worktrees?**

**A: User handles git reconciliation**
- Worktree A might complete architectural changes while Worktree B still on old architecture
- User responsibility to handle rebase, merge, sync
- Tool doesn't auto-reconcile - user git skills required
- Manual merge strategy for now

**Q: Long-running sessions and container restarts?**

**A: Manual resume**
- Sessions don't auto-resume on container start
- User triggers resume manually
- **Future refinement needed**: Explore tighter resume points and auto-resume capabilities

### User Experience & Notifications (from Sally)

**Q: How to notify user when Claude needs input?**

**A: Browser notifications + tab indicators**
- Browser notifications when Claude asks questions
- Visual indicator on session tab when attention needed
- Idle indicator per tab: "Last activity: 5m ago"
- User can glance and see which sessions need checking

**Q: Most important information when checking session status?**

**A: Priority order**
1. **Is it stuck?** - "No output for 30+ minutes" warning
2. **Any user input requests?** - "Claude is asking you a question" prominent banner
3. **What step is it on?** - "Step 3: Story Creation" in workflow panel

**Q: Session comparison - side-by-side view?**

**A: Isolated session views**
- Each session viewed independently
- No comparison view needed
- User switches between tabs as needed

**Q: Document viewing - current state or diffs?**

**A: Both**
- Current state renderer (markdown)
- Diff view toggle: "Show changes since last viewed"
- User can switch between modes

**Q: Session lifecycle - what happens to completed sessions?**

**A: Not decided yet**
- Archive? Delete? Leave in tabs?
- **Open question** - needs further discussion

**Q: User control mechanism?**

**A: ESC key interrupt + STOP button**
- ESC key stops current Claude operation (terminal parity)
- Big red STOP button in UI for same function
- Dual mechanism for user control

### Quality & Risk Management (from Murat)

**Q: If one session goes rogue, should it kill other sessions?**

**A: Accept the blast radius risk**
- If one session kills the container, all sessions die
- User accepts this trade-off for v1
- "Cross that bridge when we get to it" approach
- No per-session resource isolation in MVP

**Q: Smoke test mode before running epics?**

**A: No**
- Skip smoke tests for v1
- User will validate setup manually if needed

**Q: Rollback strategy for bad commits?**

**A: User handles git magic**
- Standard git commands for rollback
- UI doesn't surface rollback features in v1
- User git skills required

**Q: Health monitoring for stuck sessions?**

**A: Not decided yet**
- **Open question** - needs further exploration
- Likely: Last output timestamp + idle warnings

### Product Strategy (from John)

**Q: Success metrics - how do we know this works?**

**A: Qualitative feeling, not trackable metrics**
- "Getting more while doing less"
- User's Product Sense will validate success
- Optimize for user satisfaction, not arbitrary KPIs
- No formal measurement needed

**Q: Is this THE workflow or a sometimes-tool?**

**A: THIS BECOMES THE PRIMARY WORKFLOW** ⭐
- **Critical insight**: Not a side tool, this is daily infrastructure
- All projects will run in containerized way
- Raises quality bar - building infrastructure, not prototype
- Must be rock-solid stable, not experimental

**Q: Sharing/collaboration with colleagues?**

**A: Docker run command sharing**
- README includes exact command
- Colleagues copy-paste the command
- Simple sharing model for v1

**Q: First priority to validate?**

**A: Claude + basic web UI + unrestricted tools + full dev environment**
- Must support emassistant project and work projects
- Required tools: Python 3.13, Java 21, npm, jq, git, etc.
- Sprint 1 goal: Can I run an epic in browser without approvals?

---

## Open Questions (Remaining)

### Technical
1. **Status file locations** - Exact paths for BMAD status YAML files need documentation
2. **Markdown renderer** - marked.js vs alternatives? Security considerations?
3. **Docker image size** - How minimal can we keep the base image?
4. **Health monitoring details** - Exactly how to detect stuck sessions?
5. **Resume point granularity** - How tight can we make resume points for better recovery?

### UX
1. **Session persistence UI** - How to show "this session is resumed from previous run"?
2. **Error state visualization** - How to visually indicate session crashed vs stalled vs waiting?
3. **Dark mode** - Should UI support theme switching?
4. **Session lifecycle & cleanup** - How to archive/delete completed sessions?

### Workflow
1. **BMAD version management** - How to handle BMAD updates across active sessions?
2. **Auto-resume capabilities** - Should sessions auto-resume on container start?

### Deployment
1. **Docker image distribution** - Docker Hub? GitHub Container Registry?
2. **Version tagging** - Semantic versioning strategy?
3. **Documentation approach** - README vs separate docs site?

---

## Next Steps - Refined Implementation Plan

### Sprint 1: Core MVP - Claude in Browser (PRIORITY)

**Goal**: Claude running in browser with unrestricted tools and full dev environment

**Sprint 1 Deliverables**:
1. **Dockerfile with complete dev environment**
   - Base: Ubuntu 22.04
   - Python 3.13
   - Amazon Java 21 (OpenJDK)
   - Node.js + npm
   - jq, git, curl, wget, build-essential
   - Claude CLI installation
   - Container app (Node.js backend + React frontend)

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

**Success Criteria**: Can run an epic in browser without approval prompts

**Explicitly OUT of scope for Sprint 1**:
- ❌ Multi-session/tabs (Sprint 2)
- ❌ Git worktrees (Sprint 2)
- ❌ Workflow visualization (Sprint 3)
- ❌ Document viewer (Sprint 3)
- ❌ Browser notifications (Sprint 3)

---

### Sprint 2: Multi-Session Support

**Goal**: Run 4 parallel Claude sessions in separate worktrees

**Sprint 2 Deliverables**:
1. Session management (JSON persistence at `/workspace/.claude-container-sessions.json`)
2. Git worktree creation/management
3. Multiple node-pty processes (one per session)
4. WebSocket streaming per session
5. Tabbed UI (up to 4 tabs)
6. Session naming (pre-generated + user override)

**Success Criteria**: Can develop 4 features simultaneously in parallel sessions

---

### Sprint 3: BMAD Integration & UX Polish

**Goal**: Visual workflow tracking and document viewing

**Sprint 3 Deliverables**:
1. BMAD status file parser (YAML/markdown)
2. Workflow visualization UI
   - Step progress indicators (✓ → ○)
   - Current step highlighting
   - Clickable steps for navigation
3. Document browser
   - Folder navigation
   - Markdown rendering
   - Diff view toggle ("show changes since last viewed")
4. Browser notifications when Claude needs input
5. Tab attention indicators (badges, idle timers)
6. Session status display (stuck warnings, input requests, current step)
7. "Update BMAD" button (runs `npx bmad-method install`)

**Success Criteria**: Can monitor 4 sessions at a glance and view all generated artifacts

---

### Sprint 4: Stability & Production Readiness

**Goal**: Rock-solid infrastructure for daily use

**Sprint 4 Deliverables**:
1. Session resume functionality
   - Manual resume trigger
   - "Analyze what's been done" protocol
   - Resume from epic/story state files
2. Error handling and recovery
   - Graceful Claude crash handling
   - WebSocket reconnection
   - Container restart recovery
3. Resource management
   - Optimize for 4 concurrent sessions
   - Memory/CPU monitoring
   - Cleanup of terminated processes
4. Comprehensive testing
   - Concurrent git operations (worktree safety)
   - Container crash recovery
   - WebSocket stress tests
   - Multi-session integration tests
5. Documentation
   - README with docker run command
   - Architecture overview
   - Troubleshooting guide
6. Docker image optimization
   - Minimize image size
   - Layer caching for fast builds

**Success Criteria**: Can work daily with zero friction, container never needs manual intervention

---

### Future Enhancements (Post-MVP)

**Deferred to user feedback and real-world usage**:
- Auto-resume on container start
- Tighter resume point granularity
- Session lifecycle management (archive/cleanup completed sessions)
- Health monitoring automation
- Per-session resource isolation (if blast radius becomes problem)
- Smoke test mode
- UI-surfaced git rollback
- Dark mode
- Mobile support (if needed)

---

## Contributing Agents

- **John (PM)**: Problem validation, scope definition, MVP planning
- **Winston (Architect)**: Container architecture, tech stack decisions, system design
- **Amelia (DEV)**: Technical implementation details, file structures, libraries
- **Sally (UX Designer)**: UI/UX concepts, interaction flows, visual design
- **Murat (TEA)**: Risk assessment, testing strategy, quality considerations
- **Mary (Analyst)**: Requirements extraction and organization
- **Paige (Technical Writer)**: Documentation structure and clarity
- **Bob (Scrum Master)**: Process coordination, documentation capture
- **BMad Master**: Workflow orchestration and facilitation

---

**Document Status**: Initial brainstorming capture
**Last Updated**: 2025-11-23
**Next Review**: After Phase 1 completion
