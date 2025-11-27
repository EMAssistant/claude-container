# Story 4.12: Documentation and README

Status: drafted

## Story

As a developer using Claude Container,
I want comprehensive documentation including README, architecture guide, troubleshooting, and contribution guidelines,
so that I can quickly set up, understand, and maintain the project without tribal knowledge.

## Acceptance Criteria

1. **AC4.43**: README has Quick Start section
   - Given: New user with Docker installed
   - When: Reading README.md
   - Then: Quick Start section exists with clear steps:
     - Prerequisites listed (Docker, Node.js version, OS requirements)
     - One-time authentication setup (Claude Code OAuth)
     - Basic run command (without Docker socket)
     - Run command with Docker socket (macOS and Linux variants)
     - Access URL (http://localhost:3000)
     - Health check command (curl http://localhost:3000/api/health)
   - And: Commands are copy-paste ready with proper escaping
   - And: Volume mount paths clearly explained (/workspace, /config/.claude-code)
   - Validation: README.md Quick Start section complete and accurate

2. **AC4.44**: Troubleshooting section exists
   - Given: User encounters common issues
   - When: Reading README.md or docs/troubleshooting.md
   - Then: Troubleshooting section documents common issues:
     - "Container won't start" → Check Docker, check volume paths
     - "Claude authentication fails" → One-time setup instructions
     - "WebSocket connection lost" → Auto-reconnect behavior explanation
     - "Session won't resume after restart" → Manual resume button explanation
     - "Terminal not responding" → STOP button, session restart
     - "File tree not showing files" → File watcher initialization time
     - "Diff view empty" → First-time viewing explanation
     - "High memory usage" → Resource limits explanation
   - And: Each issue includes:
     - Symptoms (what user sees)
     - Cause (why it happens)
     - Solution (how to fix)
     - Prevention (how to avoid in future)
   - Validation: Troubleshooting guide reviewed and complete

3. **README structure completeness**: Comprehensive project overview
   - Given: Developer wants to understand Claude Container
   - When: Reading README.md
   - Then: README includes these sections:
     - Project overview (what is Claude Container)
     - Key features (multi-session, workflow visibility, document review)
     - Quick Start (as per AC4.43)
     - Architecture overview (high-level diagram or link to docs/architecture.md)
     - Development setup (how to build and run locally)
     - Volume mounts table (what each mount does)
     - Rebuild and restart commands
     - Logs and health check commands
     - Testing (link to docs/testing.md from Story 4.11)
     - Troubleshooting (as per AC4.44)
     - Contributing (link to CONTRIBUTING.md)
     - License
   - And: README is concise (1-2 screens, links to detailed docs)
   - Validation: README reviewed and approved

4. **Architecture documentation updated**: Epic 4 patterns documented
   - Given: Developer wants to understand system architecture
   - When: Reading docs/architecture.md
   - Then: Architecture doc includes Epic 4 additions:
     - Session status tracking and idle detection patterns
     - Toast notification system architecture
     - Resource monitoring and memory limits
     - Graceful shutdown sequence
     - Keyboard shortcut system
     - Accessibility patterns (ARIA, reduced motion)
     - Performance monitoring infrastructure (from Story 4.10)
   - And: ADRs (Architecture Decision Records) section updated with Epic 4 decisions
   - Validation: Architecture doc reviewed for Epic 4 completeness

5. **WebSocket protocol documented**: Complete protocol spec
   - Given: Developer wants to understand WebSocket communication
   - When: Reading docs/websocket-protocol.md
   - Then: WebSocket protocol doc includes all Epic 4 message types:
     - session.status (idle detection, stuck warnings)
     - session.warning (30+ min stuck)
     - session.needsInput (question detection)
     - resource.warning (memory threshold)
     - server.shutdown (graceful shutdown)
   - And: Each message type documented with:
     - Direction (client→server or server→client)
     - Message structure (TypeScript interface)
     - When sent (trigger conditions)
     - Example payload
   - Validation: WebSocket protocol doc complete and accurate

6. **Testing documentation**: Testing guide from Story 4.11
   - Given: Developer wants to run or write tests
   - When: Reading docs/testing.md
   - Then: Testing guide exists (created in Story 4.11, verified here)
   - And: README.md links to testing guide
   - Validation: Testing guide link present in README

7. **Contributing guide**: Contribution guidelines
   - Given: Developer wants to contribute to Claude Container
   - When: Reading CONTRIBUTING.md
   - Then: Contributing guide includes:
     - How to set up development environment
     - How to run tests locally
     - Code style guidelines (ESLint, Prettier configs)
     - Commit message conventions (if any)
     - Pull request process
     - Code review expectations
     - Issue reporting template (link to GitHub issues)
   - And: Links to architecture.md and testing.md for context
   - Validation: CONTRIBUTING.md created and complete

8. **API documentation**: REST and WebSocket endpoints
   - Given: Developer wants to integrate with Claude Container APIs
   - When: Reading docs/api.md or API section in architecture.md
   - Then: API documentation includes:
     - All REST endpoints (sessions, documents, workflow, health, metrics from Story 4.10)
     - Request/response formats for each endpoint
     - Error response formats (from Story 4.5)
     - WebSocket protocol (link to websocket-protocol.md)
   - And: Examples provided for common operations
   - Validation: API documentation complete and accurate

9. **Performance documentation**: Performance testing and monitoring
   - Given: Developer wants to understand performance characteristics
   - When: Reading docs/performance-testing.md (from Story 4.10)
   - Then: Performance doc exists and is referenced in README
   - Validation: README links to performance documentation

10. **Accessibility documentation**: WCAG compliance guide
    - Given: Developer wants to verify or improve accessibility
    - When: Reading docs/accessibility-testing-checklist.md (from Story 4.11)
    - Then: Accessibility checklist exists (created in Story 4.11)
    - And: README mentions accessibility compliance (WCAG AA)
    - Validation: Accessibility mentioned in README

## Tasks / Subtasks

- [ ] Task 1: Update README.md with Quick Start and comprehensive sections (AC: #1, #2, #3)
  - [ ] Subtask 1.1: Add project overview section
    - Short description: "Claude Container is a browser-based development environment for parallel BMAD workflow execution with Claude Code"
    - Key features: Multi-session parallel development, workflow visibility, document review, git worktree isolation
    - Screenshot or ASCII diagram of UI layout
  - [ ] Subtask 1.2: Write Quick Start section
    - Prerequisites: Docker Desktop/Engine, Git, modern browser
    - One-time auth setup: `mkdir -p ~/.claude-container && docker run -it --rm ...` (exact commands from CLAUDE.md)
    - Basic run command (no Docker socket)
    - Run with Docker socket (macOS variant with `stat -f '%g'`)
    - Run with Docker socket (Linux variant with `stat -c '%g'`)
    - Access URL and health check
    - Volume mounts table (3 rows: workspace, config, docker socket)
  - [ ] Subtask 1.3: Add Development Setup section
    - How to build Docker image: `docker build -t claude-container .`
    - How to run locally with volume mounts
    - How to rebuild and restart: `docker kill && docker rm && docker build && docker run` (exact command from CLAUDE.md)
    - How to check logs: `docker logs claude-container --tail 50`
  - [ ] Subtask 1.4: Add Troubleshooting section (inline or link to docs/troubleshooting.md)
    - Common issues (8 issues from AC4.44)
    - Each with: Symptoms, Cause, Solution, Prevention
    - Consider creating separate docs/troubleshooting.md if section gets too long
  - [ ] Subtask 1.5: Add sections for Testing, Contributing, Architecture
    - Testing: Link to docs/testing.md
    - Contributing: Link to CONTRIBUTING.md
    - Architecture: Link to docs/architecture.md
    - Performance: Link to docs/performance-testing.md
    - Accessibility: Mention WCAG AA compliance
  - [ ] Subtask 1.6: Add License section
    - Specify project license (MIT, Apache 2.0, or as appropriate)
  - [ ] Subtask 1.7: Review README for clarity and conciseness
    - Keep README to 1-2 screens of scrolling
    - Move detailed content to docs/ directory
    - Ensure all commands are copy-paste ready
    - Verify markdown formatting (headers, code blocks, tables)

- [ ] Task 2: Create or update docs/troubleshooting.md (AC: #2)
  - [ ] Subtask 2.1: Document "Container won't start" issue
    - Symptoms: `docker run` fails with error
    - Causes: Docker not running, volume path doesn't exist, port 3000 in use
    - Solutions: Start Docker, create volume path, stop conflicting service
    - Prevention: Check prerequisites before running
  - [ ] Subtask 2.2: Document "Claude authentication fails" issue
    - Symptoms: "Not authenticated" error in terminal
    - Cause: One-time setup not completed or config volume not mounted
    - Solution: Run one-time auth setup, verify volume mount
    - Prevention: Follow Quick Start authentication step
  - [ ] Subtask 2.3: Document "WebSocket connection lost" issue
    - Symptoms: Red banner "Connection lost. Reconnecting..."
    - Cause: Network interruption, container restart
    - Solution: Wait for auto-reconnect (1s-30s exponential backoff)
    - Prevention: Normal behavior, no prevention needed
  - [ ] Subtask 2.4: Document "Session won't resume after restart" issue
    - Symptoms: Sessions show "stopped" status after container restart
    - Cause: PTY processes don't persist across restarts (by design)
    - Solution: Click "Resume" button on each session
    - Prevention: Expected behavior from Story 2.10
  - [ ] Subtask 2.5: Document "Terminal not responding" issue
    - Symptoms: Terminal frozen, commands not executing
    - Cause: PTY process stuck or crashed
    - Solutions: Press STOP button (sends SIGINT), restart session if needed
    - Prevention: Monitor session status badges
  - [ ] Subtask 2.6: Document "File tree not showing files" issue
    - Symptoms: Empty file tree on first load
    - Cause: File watcher initialization takes 1-2s
    - Solution: Wait 2 seconds, refresh browser if still empty
    - Prevention: Normal initialization delay
  - [ ] Subtask 2.7: Document "Diff view empty" issue
    - Symptoms: Toggle diff shows no changes
    - Cause: First-time viewing document (no cached baseline)
    - Solution: View document again after Claude modifies it
    - Prevention: Expected behavior from Story 3.7
  - [ ] Subtask 2.8: Document "High memory usage" issue
    - Symptoms: Resource warning banner, slow performance
    - Cause: 4 concurrent sessions, large terminal output buffers
    - Solutions: Close idle sessions, restart container if needed
    - Prevention: Keep to 3 or fewer active sessions for best performance

- [ ] Task 3: Update docs/architecture.md with Epic 4 patterns (AC: #4)
  - [ ] Subtask 3.1: Add "Epic 4 Patterns" section to architecture doc
    - Session status tracking: idle detection (5 min), stuck detection (30 min)
    - Toast notification system: ToastProvider, type-specific styling, stacking
    - Resource monitoring: Memory thresholds (87% warning, 93% critical), zombie cleanup
    - Graceful shutdown: SIGTERM → SIGKILL escalation, session state save
    - Keyboard shortcuts: Global shortcut handler, platform detection (Cmd vs Ctrl)
    - Accessibility: ARIA live regions, reduced motion, focus rings
    - Performance monitoring: PerformanceMonitor backend, PerformanceLogger frontend
  - [ ] Subtask 3.2: Add ADRs for Epic 4 architectural decisions
    - ADR-018: Toast Notification System (Radix UI Toast vs Sonner)
    - ADR-019: Session Status Detection (Heuristics for idle/waiting states)
    - ADR-020: Resource Monitoring Strategy (Memory thresholds, zombie cleanup)
    - ADR-021: Graceful Shutdown Pattern (SIGTERM handling)
    - ADR-022: Keyboard Shortcut System (Global vs component-level)
    - ADR-023: Accessibility Implementation (WCAG AA compliance approach)
  - [ ] Subtask 3.3: Update Technology Stack section
    - Add Epic 4 dependencies: @radix-ui/react-toast (if used), performance monitoring utilities
    - Update Testing section: Reference comprehensive test suite (Story 4.11)
  - [ ] Subtask 3.4: Update Performance Considerations section
    - Add performance monitoring from Story 4.10
    - Add bundle size limits (<500KB gzipped)
    - Add latency targets (p99 <100ms)

- [ ] Task 4: Update or create docs/websocket-protocol.md (AC: #5)
  - [ ] Subtask 4.1: Check if docs/websocket-protocol.md exists (mentioned in ADR-013)
    - If exists: Update with Epic 4 message types
    - If not exists: Create complete protocol documentation
  - [ ] Subtask 4.2: Document Epic 4 WebSocket message types
    - session.status (server→client): Session activity update
      ```typescript
      {
        type: 'session.status',
        sessionId: string,
        status: 'active' | 'waiting' | 'idle' | 'error' | 'stopped',
        lastActivity: string,  // ISO 8601
        isStuck: boolean
      }
      ```
    - session.warning (server→client): Stuck session notification
      ```typescript
      {
        type: 'session.warning',
        sessionId: string,
        message: string,  // "No output for 30+ minutes"
        severity: 'warning' | 'error'
      }
      ```
    - session.needsInput (server→client): Background session needs input
      ```typescript
      {
        type: 'session.needsInput',
        sessionId: string,
        message: string  // "Claude is asking a question"
      }
      ```
    - resource.warning (server→client): High memory usage
      ```typescript
      {
        type: 'resource.warning',
        message: string,  // "High memory usage"
        memoryUsagePercent: number,
        isAcceptingNewSessions: boolean
      }
      ```
    - server.shutdown (server→client): Graceful shutdown notification
      ```typescript
      {
        type: 'server.shutdown',
        message: string,  // "Server shutting down"
        gracePeriodMs: number  // 5000
      }
      ```
  - [ ] Subtask 4.3: Ensure all existing message types documented (from Epics 1-3)
    - Verify terminal.input, terminal.output, terminal.interrupt, terminal.exit
    - Verify session.attach, session.detach, session.resume, session.destroyed
    - Verify file.changed, workflow.updated, layout.shift
    - Verify heartbeat, error
  - [ ] Subtask 4.4: Add protocol patterns section
    - Connection lifecycle (connect → attach → streaming → reconnect)
    - Heartbeat pattern (30s interval)
    - Reconnection pattern (exponential backoff 1s-30s)
    - Message ordering guarantees

- [ ] Task 5: Create CONTRIBUTING.md (AC: #7)
  - [ ] Subtask 5.1: Write Development Environment Setup section
    - Prerequisites: Docker, Node.js 20+, Git
    - Clone repository: `git clone <url> && cd claude-container`
    - Install dependencies: `cd backend && npm ci && cd ../frontend && npm ci`
    - Build Docker image: `docker build -t claude-container .`
    - Run locally: Docker run command with volume mounts
  - [ ] Subtask 5.2: Write Testing section
    - How to run backend tests: `cd backend && npm test`
    - How to run frontend tests: `cd frontend && npm test`
    - How to run E2E tests: `cd frontend && npx playwright test`
    - Coverage reports: `npm run test:coverage`
    - Link to docs/testing.md for detailed guide
  - [ ] Subtask 5.3: Write Code Style Guidelines section
    - ESLint and Prettier configuration (enforced automatically)
    - Naming conventions: PascalCase components, camelCase functions, UPPER_SNAKE_CASE constants
    - Import order: External → Internal → Types → Styles
    - Component structure pattern (from architecture.md)
    - Link to architecture.md "Naming Conventions" section
  - [ ] Subtask 5.4: Write Pull Request Process section
    - Fork repository and create feature branch
    - Make changes and add tests
    - Run tests locally (all must pass)
    - Commit with descriptive message
    - Push to fork and create PR
    - PR must pass CI checks (tests, linting, bundle size)
    - Request review from maintainers
  - [ ] Subtask 5.5: Write Issue Reporting section
    - Use GitHub Issues for bug reports and feature requests
    - Include: Description, Steps to reproduce, Expected vs Actual behavior
    - Include: Environment (Docker version, OS, browser)
    - Include: Logs if relevant (`docker logs claude-container`)
  - [ ] Subtask 5.6: Add Code of Conduct link (if applicable)

- [ ] Task 6: Create or update docs/api.md (AC: #8)
  - [ ] Subtask 6.1: Document REST API endpoints
    - Base URL: `http://localhost:3000/api`
    - GET /api/sessions - List all sessions
    - POST /api/sessions - Create new session (body: { name?, branch? })
    - DELETE /api/sessions/:id - Destroy session (query: { deleteWorktree? })
    - GET /api/sessions/:id/status - Get session status
    - GET /api/workflow/status - Get BMAD workflow status
    - POST /api/bmad/update - Trigger BMAD status refresh (from Story 3.9)
    - GET /api/documents/:path - Serve workspace file
    - GET /api/documents/tree - Get file tree structure
    - GET /api/health - Health check endpoint
    - GET /api/metrics - Performance metrics (from Story 4.10)
  - [ ] Subtask 6.2: Document request/response formats
    - Each endpoint: Method, Path, Request body/query params, Response body, Error responses
    - Use TypeScript interfaces for clarity
    - Include example requests and responses
  - [ ] Subtask 6.3: Document error response format (from Story 4.5)
    - Standard error structure:
      ```typescript
      {
        error: {
          type: 'validation' | 'git' | 'pty' | 'resource' | 'internal',
          message: string,  // User-friendly
          details?: string,  // Technical details
          suggestion?: string,  // How to fix
          code?: string  // Machine-readable code
        }
      }
      ```
    - Example error responses for common scenarios
  - [ ] Subtask 6.4: Link to WebSocket protocol documentation
    - Add section: "WebSocket API"
    - Link to docs/websocket-protocol.md
    - Brief overview: "For real-time terminal streaming and status updates, see WebSocket protocol"

- [ ] Task 7: Verify and link to Story 4.10 and 4.11 documentation (AC: #6, #9, #10)
  - [ ] Subtask 7.1: Verify docs/testing.md exists (created in Story 4.11)
    - Check file exists: docs/testing.md
    - If not exists, create stub linking to Story 4.11 tasks
  - [ ] Subtask 7.2: Verify docs/performance-testing.md exists (created in Story 4.10)
    - Check file exists: docs/performance-testing.md
    - If not exists, create stub linking to Story 4.10 tasks
  - [ ] Subtask 7.3: Verify docs/accessibility-testing-checklist.md exists (created in Story 4.11)
    - Check file exists
    - If not exists, create stub linking to Story 4.11 tasks
  - [ ] Subtask 7.4: Add links in README.md to all documentation
    - Testing: Link to docs/testing.md
    - Performance: Link to docs/performance-testing.md
    - Accessibility: Mention WCAG AA compliance, link to checklist
    - Architecture: Link to docs/architecture.md
    - API: Link to docs/api.md
    - Troubleshooting: Link to docs/troubleshooting.md (or inline section)
    - Contributing: Link to CONTRIBUTING.md

- [ ] Task 8: Add inline code documentation (JSDoc/TSDoc) for key modules (Optional, if time permits)
  - [ ] Subtask 8.1: Add JSDoc comments to backend managers
    - sessionManager.ts: Class and public method documentation
    - ptyManager.ts: Class and public method documentation
    - worktreeManager.ts: Class and public method documentation
    - resourceMonitor.ts: Class and public method documentation
    - shutdownManager.ts: Graceful shutdown sequence documentation
  - [ ] Subtask 8.2: Add TSDoc comments to frontend components
    - ToastProvider.tsx: Component props and usage
    - AttentionBadge.tsx: Component props and priority logic
    - useKeyboardShortcuts.ts: Hook usage and shortcut registry
    - useNotifications.ts: Hook usage and permission handling
  - [ ] Subtask 8.3: Generate API documentation with TypeDoc (optional)
    - Install TypeDoc: `npm install -D typedoc`
    - Configure typedoc.json
    - Generate docs: `npx typedoc`
    - Output to docs/api-reference/

- [ ] Task 9: Create docs/index.md (documentation hub) (Optional)
  - [ ] Subtask 9.1: Create documentation index page
    - Overview of all documentation files
    - Organized by category: Getting Started, Development, Architecture, Testing, API
    - Links to all docs with brief description
  - [ ] Subtask 9.2: Add "Documentation" section to README
    - Link to docs/index.md or list key docs inline

- [ ] Task 10: Final review and validation (AC: All)
  - [ ] Subtask 10.1: Review README.md for completeness
    - All sections present (AC #3)
    - Quick Start clear and accurate (AC #1)
    - Troubleshooting comprehensive (AC #2)
    - Links to all documentation working
    - Commands tested and copy-paste ready
  - [ ] Subtask 10.2: Review architecture.md for Epic 4 completeness
    - All Epic 4 patterns documented (AC #4)
    - ADRs added for Epic 4 decisions
    - Technology stack updated
  - [ ] Subtask 10.3: Review websocket-protocol.md for completeness
    - All Epic 4 message types documented (AC #5)
    - Examples provided
    - Protocol patterns explained
  - [ ] Subtask 10.4: Review CONTRIBUTING.md for completeness
    - All sections present (AC #7)
    - Clear contribution workflow
    - Links to architecture and testing docs
  - [ ] Subtask 10.5: Review docs/api.md for completeness
    - All REST endpoints documented (AC #8)
    - Error response format documented
    - WebSocket protocol linked
  - [ ] Subtask 10.6: Verify all documentation links work
    - Test all internal links (docs/ files)
    - Test all external links (if any)
    - Fix any broken links
  - [ ] Subtask 10.7: Proofread all documentation
    - Fix typos and grammar
    - Ensure consistent terminology
    - Verify code examples are correct
    - Check markdown formatting renders properly

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Documentation Requirements (AC4.43-AC4.44 from Acceptance Criteria section)**:
- **AC4.43**: README has Quick Start section with prerequisites, auth setup, run commands, volume mounts
- **AC4.44**: Troubleshooting section exists with common issues and solutions (8 scenarios)
- **NFR-MAINT-3**: Documentation must include README, architecture docs, contribution guide

**From Architecture (docs/architecture.md)**:

**Project Structure** (Section: Project Structure):
- README.md at repository root
- Documentation in docs/ directory:
  - architecture.md (system architecture and decisions)
  - architecture-decisions.md (ADRs)
  - websocket-protocol.md (mentioned in ADR-013, may need creation)
  - Additional docs as needed

**Testing Strategy** (Section: Testing Strategy):
- docs/testing.md created in Story 4.11
- Should be linked from README

**From CLAUDE.md (project instructions)**:

**Quick Start Commands** (entire file is Quick Start template):
- One-time authentication setup: `mkdir -p ~/.claude-container && docker run -it --rm ...`
- Basic run (no Docker socket): `docker run -d --name claude-container -p 3000:3000 ...`
- Run with Docker socket (macOS): `docker run -d ... -v /var/run/docker.sock:/var/run/docker.sock --group-add $(stat -f '%g' /var/run/docker.sock) ...`
- Run with Docker socket (Linux): Same but `stat -c '%g'` instead of `stat -f '%g'`
- Volume mounts table: workspace (RW), config (RO), docker socket (optional)
- Rebuild and restart: `docker kill && docker rm && docker build && docker run`
- Logs: `docker logs claude-container --tail 50`
- Health check: `curl http://localhost:3000/api/health`

**IMPORTANT**: CLAUDE.md is the source of truth for Quick Start commands - copy these exactly into README.md

### Project Structure Notes

**Files to Create:**
```

├── README.md                           # Update with comprehensive sections
├── CONTRIBUTING.md                     # New file - contribution guidelines
├── docs/
│   ├── troubleshooting.md             # New file - common issues and solutions
│   ├── api.md                         # New file - REST and WebSocket API docs
│   ├── websocket-protocol.md          # Create if doesn't exist (mentioned in ADR-013)
│   ├── index.md                       # Optional - documentation hub
│   └── api-reference/                 # Optional - TypeDoc generated docs
└── (No changes to existing files unless updating)
```

**Files to Modify:**
```

├── README.md                           # Major update - add all sections
└── docs/
    └── architecture.md                 # Update with Epic 4 patterns and ADRs
```

**Files to Verify Exist (from previous stories):**
```
docs/
├── testing.md                          # Created in Story 4.11
├── performance-testing.md              # Created in Story 4.10
└── accessibility-testing-checklist.md  # Created in Story 4.11
```

### Implementation Guidance

**README.md Structure (Recommended Order):**
```markdown
# Claude Container

[Badge: Build Status] [Badge: License]

## Overview
Brief description (2-3 sentences)

## Key Features
- Multi-session parallel development with git worktree isolation
- Real-time workflow visibility with BMAD status tracking
- Document review with diff view and markdown rendering
- Browser-based terminal with xterm.js (full TTY emulation)

## Quick Start

### Prerequisites
- Docker Desktop (macOS) or Docker Engine (Linux)
- Git
- Modern browser (Chrome, Firefox, Safari, Edge - latest 2 versions)

### One-Time Authentication Setup
[Commands from CLAUDE.md]

### Running the Container
[Commands from CLAUDE.md - Basic and with Docker socket]

### Volume Mounts
[Table from CLAUDE.md]

### Rebuild and Restart
[Commands from CLAUDE.md]

### Logs and Health Check
[Commands from CLAUDE.md]

## Architecture
High-level diagram or description. [Link to docs/architecture.md]

## Development
Instructions for developers. [Link to CONTRIBUTING.md]

## Testing
[Link to docs/testing.md]

## API Documentation
[Link to docs/api.md]

## Performance
[Link to docs/performance-testing.md]

## Accessibility
WCAG AA compliant. [Link to docs/accessibility-testing-checklist.md]

## Troubleshooting
[Link to docs/troubleshooting.md or inline common issues]

## Contributing
[Link to CONTRIBUTING.md]

## License
[License information]
```

**Troubleshooting.md Structure:**
```markdown
# Troubleshooting Guide

## Common Issues

### Issue 1: Container Won't Start
**Symptoms:** `docker run` fails with error message...
**Cause:** Docker not running, volume path doesn't exist, or port 3000 in use
**Solution:**
1. Check Docker is running: `docker ps`
2. Verify volume path exists: `ls -la /path/to/project`
3. Check port 3000 availability: `lsof -i :3000` (kill if in use)
**Prevention:** Ensure Docker is running and prerequisites are met before starting container

### Issue 2: Claude Authentication Fails
[Same structure]

[Repeat for all 8 issues from AC4.44]
```

**WebSocket Protocol Documentation Pattern:**
```markdown
# WebSocket Protocol Specification

## Overview
Claude Container uses WebSocket for real-time bidirectional communication...

## Connection
- URL: `ws://localhost:3000`
- Protocol: Standard WebSocket (ws library)
- Reconnection: Exponential backoff (1s-30s)

## Message Types

### Client → Server Messages

#### terminal.input
Send user input to PTY process.
```typescript
{
  type: 'terminal.input',
  sessionId: string,
  data: string  // Keystrokes from xterm.js
}
```
**When Sent:** User types in terminal
**Example:**
```json
{"type":"terminal.input","sessionId":"abc123","data":"ls -la\r"}
```

[Repeat for all message types]
```

**CONTRIBUTING.md Structure:**
```markdown
# Contributing to Claude Container

Thank you for considering contributing!

## Development Environment Setup
[Prerequisites, clone, install, build, run]

## Running Tests
[Link to docs/testing.md for details]

## Code Style Guidelines
- ESLint and Prettier enforced automatically
- Naming conventions: [Link to architecture.md#Naming-Conventions]
- Component structure: [Link to architecture.md#Code-Organization]

## Making Changes
1. Fork repository and create feature branch
2. Make changes and add tests (required)
3. Run tests locally: `npm test`
4. Ensure linting passes: `npm run lint`
5. Commit with descriptive message

## Pull Request Process
1. Push to fork and create PR
2. PR must pass CI checks (tests, linting, bundle size <500KB)
3. Request review from maintainers
4. Address review feedback
5. PR will be merged after approval

## Issue Reporting
Use GitHub Issues for:
- Bug reports (include steps to reproduce, environment)
- Feature requests (describe use case and proposed solution)
- Questions (use Discussions for general questions)

Include in bug reports:
- Description of issue
- Steps to reproduce
- Expected vs Actual behavior
- Environment: Docker version, OS, browser
- Logs: `docker logs claude-container`

## Code of Conduct
[Link to CODE_OF_CONDUCT.md if applicable]
```

**API Documentation Pattern:**
```markdown
# API Documentation

## REST API

### Base URL
`http://localhost:3000/api`

### Endpoints

#### GET /api/sessions
List all sessions.

**Request:** None

**Response:**
```typescript
{
  sessions: Session[]
}
```

**Example:**
```bash
curl http://localhost:3000/api/sessions
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "abc123",
      "name": "feature-auth",
      "status": "active",
      "branch": "feature/feature-auth",
      "worktreePath": "/workspace/.worktrees/abc123",
      "createdAt": "2025-11-25T10:00:00.000Z",
      "lastActivity": "2025-11-25T10:05:00.000Z"
    }
  ]
}
```

[Repeat for all endpoints]

### Error Responses
All endpoints return errors in this format:
```typescript
{
  error: {
    type: 'validation' | 'git' | 'pty' | 'resource' | 'internal',
    message: string,
    details?: string,
    suggestion?: string,
    code?: string
  }
}
```

## WebSocket API
For real-time terminal streaming and status updates, see [WebSocket Protocol](./websocket-protocol.md).
```

**Documentation Principles:**
- **Clarity over brevity**: Explain WHY not just HOW
- **Examples everywhere**: Show don't tell
- **Copy-paste ready**: All commands should work as-is
- **Link liberally**: Don't duplicate, link to source of truth
- **Keep README concise**: Move detailed docs to docs/ directory
- **Troubleshooting first**: Address common issues proactively
- **Versioning**: Date documentation updates (especially API changes)

### Learnings from Previous Story

**From Story 4-11-comprehensive-testing-suite (Status: drafted)**

**Documentation Created in Story 4.11:**
- **docs/testing.md** - Comprehensive testing guide created in Task 8
  - This story (4.12) must verify it exists and link from README
  - Should include: Running tests, writing tests, coverage, CI/CD, troubleshooting
- **docs/accessibility-testing-checklist.md** - Manual accessibility checklist created in Task 7
  - This story must verify it exists and reference from README (accessibility section)
  - Includes: Screen reader testing, keyboard navigation, focus rings, ARIA labels

**Testing Infrastructure from Story 4.11:**
- **CI/CD pipeline** configured in `.github/workflows/ci.yml`
  - This story should mention CI in CONTRIBUTING.md
  - Contributors should know: "PR must pass CI checks"
- **Test coverage targets**: 70% backend, 50% frontend
  - This story should mention in README or CONTRIBUTING (quality standards)

**Documentation Patterns from Story 4.11:**
- Story 4.11 created detailed testing guide in docs/testing.md
  - This story reuses same pattern for other docs (troubleshooting, api, contributing)
  - Consistent structure: Overview → How To → Patterns → Troubleshooting

**Integration Points:**
- README.md Testing section → Link to docs/testing.md (created in 4.11)
- README.md Accessibility section → Mention WCAG AA, link to checklist (created in 4.11)
- CONTRIBUTING.md Testing section → Link to docs/testing.md for detailed guide

**Dependencies:**
- This story (4.12) depends on Story 4.11 having created docs/testing.md and docs/accessibility-testing-checklist.md
- If those files don't exist, create stubs with TODO markers referencing Story 4.11

**No Code Conflicts:**
- Story 4.11 created test files and documentation
- Story 4.12 creates user-facing documentation (README, CONTRIBUTING, API docs)
- No overlap in file creation

**Documentation Continuity:**
- Story 4.11 focused on testing documentation for developers
- Story 4.12 focuses on onboarding documentation for new users
- Combined: Complete documentation suite for users and contributors

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.43-AC4.44 documentation requirements
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Non-Functional-Requirements] - NFR-MAINT-3 documentation standards
- [Source: docs/architecture.md#Project-Structure] - Documentation structure and organization
- [Source: docs/architecture.md#Architecture-Decision-Records] - ADR format and patterns
- [Source: CLAUDE.md] - Quick Start commands (source of truth)
- [Source: docs/sprint-artifacts/4-11-comprehensive-testing-suite.md#Dev-Notes] - Testing documentation created in previous story

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-11 (testing.md and accessibility-testing-checklist.md created, links required)
- Documentation ACs (AC4.43-AC4.44) extracted from tech spec
- CLAUDE.md commands copied as source of truth for Quick Start
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
