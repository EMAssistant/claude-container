# Story 1.11: Tool Approval Elimination via Container Configuration

Status: done

## Story

As a developer,
I want all Claude CLI tools to be marked as safe within the container,
So that Claude can execute commands autonomously without approval prompts (FR6).

## Acceptance Criteria

1. **AC1: No Approval Prompts for CLI Tools**
   - Given the Claude CLI configuration in the container
   - When Claude attempts to use CLI tools (bash, git, npm, python, pytest, etc.)
   - Then NO approval prompts are shown
   - And commands execute immediately without user intervention

2. **AC2: Autonomous Command Execution**
   - Given Claude is running in the container terminal
   - When Claude runs commands like `git status`, `npm install`, `pytest`, or `rm -rf`
   - Then the command executes and output is streamed to terminal
   - And no user confirmation is required for any command

3. **AC3: Container Isolation Ensures Host Safety**
   - Given potentially destructive commands execute without prompts
   - When Claude runs destructive commands like `rm -rf` within the container
   - Then the command executes within the container filesystem only
   - And the host system remains protected by Docker isolation (FR7)

4. **AC4: Interrupt Capability Always Available**
   - Given Claude is executing any command autonomously
   - When the user presses ESC key or clicks the STOP button
   - Then the user can always interrupt with STOP button/ESC key (FR26, FR27)
   - And Claude CLI receives SIGINT and stops the operation

5. **AC5: Configuration Persists Across Container Restarts**
   - Given the container has been configured for unrestricted tool access
   - When the container is stopped and restarted
   - Then the tool approval settings persist
   - And Claude continues to execute commands without prompts

## Tasks / Subtasks

- [x] Task 1: Research Claude CLI configuration for tool approval (AC: #1, #2, #5)
  - [x] Subtask 1.1: Review Claude CLI documentation for approval configuration
  - [x] Subtask 1.2: Identify configuration method (environment variable, config file, or CLI flag)
  - [x] Subtask 1.3: Test configuration approach in local Claude CLI installation
  - [x] Subtask 1.4: Document exact configuration steps and file paths

- [x] Task 2: Implement container-level configuration (AC: #1, #2, #5)
  - [x] Subtask 2.1: Add configuration to Dockerfile or docker-compose.yml
  - [x] Subtask 2.2: Set environment variables if needed (e.g., CLAUDE_APPROVE_ALL=true)
  - [x] Subtask 2.3: Modify mounted Claude config if needed (read-only constraints)
  - [x] Subtask 2.4: Ensure configuration applies before Claude CLI starts

- [x] Task 3: Validate host system isolation (AC: #3)
  - [x] Subtask 3.1: Run destructive test commands in container (rm -rf /)
  - [x] Subtask 3.2: Verify host filesystem remains untouched
  - [x] Subtask 3.3: Confirm workspace mount (RW) is only writable volume
  - [x] Subtask 3.4: Test container escape attempts (security validation)

- [x] Task 4: Verify interrupt mechanism compatibility (AC: #4)
  - [x] Subtask 4.1: Test ESC key interrupt with autonomous commands
  - [x] Subtask 4.2: Test STOP button interrupt with autonomous commands
  - [x] Subtask 4.3: Verify SIGINT delivery to PTY process
  - [x] Subtask 4.4: Confirm Claude CLI responds to interrupt within 1 second

- [x] Task 5: End-to-end validation with real commands (AC: #1, #2, #3, #4, #5)
  - [x] Subtask 5.1: Test git operations (git status, git commit) - no prompts
  - [x] Subtask 5.2: Test npm operations (npm install, npm run) - no prompts
  - [x] Subtask 5.3: Test Python operations (pytest, pip install) - no prompts
  - [x] Subtask 5.4: Test file operations (rm, mv, cp) - no prompts
  - [x] Subtask 5.5: Verify all operations complete without user intervention

## Dev Notes

### Architectural Patterns and Constraints

**Core Value Proposition** [Source: docs/epics/epic-1-foundation.md#Story-1.11]
- This story implements THE CORE VALUE PROPOSITION: Autonomous Claude without manual approval babysitting
- Tool approval elimination is the primary pain point solved by Claude Container
- Container isolation (FR7) ensures host system safety even with unrestricted tools

**Container Isolation Security Model** [Source: docs/architecture.md#Security Architecture]
- Docker container provides process and filesystem isolation from host
- Volume mounts: Workspace (RW) at `/workspace`, Claude config (RO) at `/config/.claude-code`
- Network: Localhost binding only, no external network exposure
- Threat model: Container escape attempts, malicious code execution (mitigated by Docker)

**Claude CLI Configuration Approaches** [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Open Questions]
- **Option A: Environment Variable** - Set in Dockerfile or docker-compose.yml (CLAUDE_APPROVE_ALL=true)
- **Option B: Config File Setting** - Modify Claude config JSON at `/config/.claude-code/config.json`
- **Option C: Claude CLI Flag** - Pass flag to claude command when spawning PTY process
- **Decision Required:** Test all options and select most reliable approach

**PTY Process Integration** [Source: docs/architecture.md#PTY Process Management]
- Claude CLI spawned via node-pty in backend/src/ptyManager.ts
- Configuration must be applied before or during PTY spawn
- Environment variables inherited from container process
- Working directory: `/workspace` (mounted host project)

**Safety Mechanisms** [Source: docs/sprint-artifacts/tech-spec-epic-1.md#NFR-SEC-1]
- Docker filesystem isolation: Commands within container cannot access host filesystem (except mounted volumes)
- Workspace mount (RW): Claude can modify `/workspace` files (intentional, user's project)
- Config mount (RO): Claude cannot corrupt API keys in `/config/.claude-code`
- User can always interrupt via ESC key (FR26) or STOP button (FR27)

### Source Tree Components to Touch

**Dockerfile** (Container Configuration)
- Add environment variables for Claude CLI approval configuration
- Example: `ENV CLAUDE_APPROVE_ALL=true` or similar
- Ensure variables persist across container restarts

**docker-compose.yml** (Orchestration - Optional)
- Add environment section if using docker-compose
- Document configuration for users running with docker-compose

**backend/src/ptyManager.ts** (PTY Process Spawning)
- Ensure environment variables passed to PTY process
- Modify spawn configuration if Claude CLI flag needed
- Example: `pty.spawn('claude', ['--approve-all'], { env: process.env })`

**backend/src/server.ts** (Container Startup)
- Validate configuration on startup (log approval settings)
- Add health check that confirms configuration applied
- Example: Log "Claude CLI approval mode: unrestricted" on startup

**README.md or docs/** (Documentation)
- Document the approval configuration for user reference
- Explain security model (container isolation ensures host safety)
- Provide troubleshooting steps if approval prompts still appear

### Testing Standards Summary

**Security Validation Tests** [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Test Strategy]
- **SEC-1: Container Isolation Test** - Run `rm -rf /` inside container, verify host unaffected
- **SEC-2: Volume Mount Permission Test** - Verify workspace (RW) and config (RO) permissions
- **SEC-3: Tool Execution Test** - Run git, npm, pytest, rm commands, verify no prompts
- **SEC-4: Interrupt Test** - Run long command, press ESC, verify interrupt works

**Acceptance Test Approach**
1. Build and start container with approval configuration
2. Ask Claude to run `git status` - verify no prompt
3. Ask Claude to run `npm install` - verify no prompt
4. Ask Claude to run `pytest tests/` - verify no prompt
5. Ask Claude to run destructive command (`rm test.txt`) - verify no prompt, file deleted
6. Run long command, interrupt with ESC - verify works
7. Restart container, repeat tests - verify configuration persists

**Validation Commands**
```bash
# Test git operations
docker exec -it claude-container bash -c "cd /workspace && claude 'run git status'"

# Test npm operations
docker exec -it claude-container bash -c "cd /workspace && claude 'run npm install'"

# Test destructive command in isolated environment
docker exec -it claude-container bash -c "cd /workspace && claude 'create a test file and delete it'"

# Verify host isolation
docker exec -it claude-container bash -c "rm -rf /"
# Then verify host filesystem intact
```

### Project Structure Notes

**Alignment with Unified Project Structure** [Source: docs/architecture.md#Project Structure]
- Configuration applied at container level (Dockerfile or docker-compose.yml)
- No new source files required (configuration only)
- PTY manager may need minor modification for environment variable passing
- Follows principle: Security via isolation, not restriction

**Learnings from Previous Stories**

**From Story 1.10: Container Startup and Frontend Build Pipeline**
- Dockerfile structure established with backend and frontend build stages
- Backend server (server.ts) initializes on container startup
- PTY process spawned during backend initialization
- Configuration must be available before PTY spawn

**Configuration Integration Points:**
- Environment variables set in Dockerfile are available to server.ts process
- server.ts passes environment to ptyManager.ts when spawning Claude
- Claude CLI inherits environment from PTY spawn call
- Configuration persists because it's baked into Docker image or docker-compose

**No Detected Conflicts**
- Story adds configuration, doesn't modify existing architecture
- Container isolation already implemented (FR1-FR7)
- Interrupt mechanism already implemented (FR26-FR27, Stories 1.5, 1.8)
- Builds on foundation from Stories 1.1-1.10

### References

- [Source: docs/epics/epic-1-foundation.md#Story-1.11]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Acceptance Criteria - AC10]
- [Source: docs/architecture.md#Security Architecture]
- [Source: docs/architecture-decisions.md#ADR-008: All Tools Safe in Sandbox]
- [Source: docs/prd.md#FR6, FR7, FR26, FR27]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/1-11-tool-approval-elimination-via-container-configuration.context.xml

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - Implementation was already complete from previous development session.

### Completion Notes List

**Implementation Summary:**

Story 1.11 was implemented successfully across three key components:

1. **Dockerfile (Line 169):** Added `ENV CLAUDE_PERMISSION_MODE=bypassPermissions` in the runtime stage to enable autonomous command execution without approval prompts.

2. **ptyManager.ts (Lines 97-112):** Modified PTY spawn logic to add `--dangerously-skip-permissions` and `--permission-mode` flags to Claude CLI invocations, ensuring all tools are marked as safe within the container.

3. **server.ts (Lines 541-556):** Added startup logging to validate and display the permission mode configuration, providing visibility into the approval settings.

**Key Decisions:**

- **Configuration Method:** Used environment variable `CLAUDE_PERMISSION_MODE=bypassPermissions` as the primary configuration mechanism, supplemented with CLI flags for redundancy.
- **Security Model:** Relied on Docker container isolation (FR7) to ensure host safety even with unrestricted tool access.
- **Placement:** Placed ENV in Dockerfile runtime stage (not build stage) to ensure persistence across container restarts.

**Testing Results:**

All acceptance criteria verified:
- AC1: Configuration enables unrestricted tool access ✓
- AC2: Commands execute autonomously without prompts ✓
- AC3: Container isolation protects host filesystem ✓
- AC4: Interrupt mechanism (ESC/STOP) remains functional ✓
- AC5: Configuration persists across container restarts ✓

Automated test suite: 12/12 tests passed
See: docs/sprint-artifacts/1-11-test-results.md

**No Blockers or Issues Identified**

### File List

**Modified Files:**

1. `Dockerfile`
   - Line 169: Added `ENV CLAUDE_PERMISSION_MODE=bypassPermissions`
   - Lines 165-169: Added documentation comments explaining FR6 and FR7

2. `backend/src/ptyManager.ts`
   - Lines 97-112: Added permission bypass flag logic for Claude CLI spawn
   - Lines 114-132: Enhanced logging to track permission mode

3. `backend/src/server.ts`
   - Lines 541-556: Added startup logging for permission mode validation

**Created Files:**

1. `test-tool-approval.sh`
   - Automated test script for Story 1.11 acceptance criteria
   - 12 tests covering configuration, implementation, isolation, and persistence

2. `docs/sprint-artifacts/1-11-test-results.md`
   - Comprehensive test results and validation report
   - Documents all acceptance criteria testing
   - Includes code evidence and integration testing details

**Read-Only Files (for context):**

1. `docker-entrypoint.sh`
   - Validated read-only config mount mechanism
   - Confirmed container isolation validation logic
