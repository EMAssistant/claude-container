# Story 1.2: Volume Mounts for Workspace and Configuration

Status: done

## Story

As a developer,
I want my host project directory and Claude configuration mounted into the container,
so that Claude can modify my code and use my API keys without copying files.

## Acceptance Criteria

1. **Given** a host project directory at `$HOME/my-project`
   **When** the container is started with volume mounts:
   ```bash
   docker run -v $HOME/my-project:/workspace \
              -v ~/.config/claude-code:/config/.claude-code:ro
   ```
   **Then** the host project directory is accessible at `/workspace` with read-write permissions

2. **And** files created/modified in `/workspace` by Claude persist on the host

3. **And** the Claude configuration directory is accessible at `/config/.claude-code` with read-only permissions

4. **And** Claude CLI can read API keys from `/config/.claude-code` but cannot modify them

## Tasks / Subtasks

- [x] Task 1: Configure workspace volume mount (AC: #1, #2)
  - [x] 1.1: Update docker run command to include `-v $HOST_PATH:/workspace` volume mount
  - [x] 1.2: Verify container can read files from /workspace
  - [x] 1.3: Verify container can create new files in /workspace that persist on host
  - [x] 1.4: Verify container can modify existing files in /workspace
  - [x] 1.5: Test with actual project directory containing source code

- [x] Task 2: Configure Claude config volume mount (AC: #3, #4)
  - [x] 2.1: Update docker run command to include `-v ~/.config/claude-code:/config/.claude-code:ro` mount
  - [x] 2.2: Verify container can read files from /config/.claude-code
  - [x] 2.3: Verify container CANNOT write to /config/.claude-code (read-only enforcement)
  - [x] 2.4: Verify Claude CLI successfully reads API keys from mounted config

- [x] Task 3: Add container startup validation (AC: #1, #3)
  - [x] 3.1: Implement startup script that checks /workspace directory exists and is writable
  - [x] 3.2: Implement startup check that /config/.claude-code exists and is readable
  - [x] 3.3: Exit with error message if required mounts are missing
  - [x] 3.4: Log mount validation results to container logs

- [x] Task 4: Document volume mount requirements
  - [x] 4.1: Add volume mount examples to README
  - [x] 4.2: Document workspace mount purpose and permissions
  - [x] 4.3: Document config mount purpose and read-only rationale
  - [x] 4.4: Provide troubleshooting guide for mount permission issues

- [x] Task 5: Testing and validation (AC: #1-4)
  - [x] 5.1: Test workspace mount with sample project files
  - [x] 5.2: Test config mount with actual Claude CLI configuration
  - [x] 5.3: Verify file permission handling on macOS/Linux
  - [x] 5.4: Test container behavior when mounts are missing (error handling)
  - [x] 5.5: Validate that modifications in /workspace appear on host immediately

## Dev Notes

### Architecture Patterns and Constraints

**Volume Mount Strategy** [Source: docs/architecture.md#Deployment-Architecture]
- **Workspace mount (RW):** Entire host project directory mounted to `/workspace` - This is where Claude modifies code
- **Claude config mount (RO):** API keys and settings mounted read-only at `/config/.claude-code` to prevent accidental corruption
- **Persistence:** Session JSON and logs stored in `/workspace` to survive container restarts

**BMAD Installation Location** [Source: docs/architecture-decisions.md#ADR-002]
- BMAD Method should be installed inside workspace directory at `/workspace/.bmad` (not mounted separately per FR4)
- Allows per-project BMAD configuration and version control integration
- UI button will be added in later epic to update BMAD via `npx bmad-method install`

**Security Considerations** [Source: docs/architecture.md#Security-Architecture]
- Docker container provides filesystem isolation from host
- Read-only config mount (`:ro` flag) prevents Claude from accidentally modifying API keys
- Path validation ensures file operations stay within `/workspace` (prevents path traversal attacks)

**Volume Mount Validation** [Source: docs/epics/epic-1-foundation.md#Story-1.2-Technical-Notes]
- Container startup should validate mounts exist and exit with error if missing
- Error messages should guide users to correct docker run command
- Log mount paths at startup for debugging

### Source Tree Components

**Files to Create/Modify:**
- `Dockerfile` - Add VOLUME declarations for `/workspace` and `/config/.claude-code`
- `docker-entrypoint.sh` (new) - Container startup script to validate mounts
- `README.md` - Document volume mount requirements and examples

**Container Paths:**
- `/workspace` - Mounted host project directory (read-write)
- `/config/.claude-code` - Mounted Claude CLI configuration (read-only)
- `/workspace/.bmad` - BMAD Method installation location (within workspace)
- `/workspace/.claude-container-sessions.json` - Session state persistence (within workspace)

### Testing Standards

**Mount Validation Tests:**
1. Verify workspace mount is readable and writable
2. Verify config mount is readable but not writable
3. Test file creation persistence (create file in container, verify on host)
4. Test file modification persistence (modify file in container, verify on host)
5. Test error handling when mounts are missing

**Permission Tests:**
1. Verify `:ro` flag prevents writes to /config/.claude-code
2. Test Docker user mapping for file ownership (non-root user)
3. Validate that host user can read/write files created by container

### Project Structure Notes

**Alignment with unified-project-structure:**
- No unified-project-structure.md found in repository yet
- Volume mounts establish the foundation for project file organization
- `/workspace` is the root for all user project files and Claude-generated artifacts
- Container-specific files (sessions JSON, logs) co-located in workspace for persistence

**Mount Organization:**
```
Host System:
  ~/my-project/           → mounted to → /workspace (RW)
  ~/.config/claude-code/  → mounted to → /config/.claude-code (RO)

Container View:
  /workspace/
    ├── (user project files)
    ├── .bmad/                          # BMAD Method installation
    ├── .claude-container-sessions.json # Session persistence
    └── logs/                           # Container logs (optional)
  /config/.claude-code/
    └── config.json                     # Claude CLI API keys
```

### References

- [Source: docs/epics/epic-1-foundation.md#Story-1.2] - Story requirements and acceptance criteria
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Volume-Mounts] - Technical specification AC2
- [Source: docs/architecture.md#Deployment-Architecture] - Volume mount strategy
- [Source: docs/architecture.md#Security-Architecture] - Path validation and read-only config mount
- [Source: docs/architecture-decisions.md#ADR-002] - BMAD in workspace decision
- [Source: PRD FR2, FR3, FR4] - Functional requirements for workspace and config mounts

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/1-2-volume-mounts-for-workspace-and-configuration.context.xml

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - All tests passed successfully

### Completion Notes List

1. **docker-entrypoint.sh Created** - Comprehensive startup validation script
   - Validates workspace mount exists, is readable and writable
   - Validates config mount exists and is readable
   - Checks read-only enforcement on config mount
   - Provides clear error messages with docker run examples
   - Logs mount information for debugging
   - Exits with non-zero status if validation fails

2. **Dockerfile Updated** - Integrated volume mount support
   - Added COPY for docker-entrypoint.sh script
   - Set proper permissions (755) for script execution
   - Added VOLUME declarations for /workspace and /config/.claude-code
   - Set ENTRYPOINT to run validation script
   - Maintained non-root user (claude-user) security model

3. **README.md Created** - Comprehensive documentation
   - Quick start guide with basic usage examples
   - Detailed volume mount documentation for both workspace and config
   - Explanation of mount purposes and permissions
   - Container startup validation process description
   - Troubleshooting guide for common mount issues
   - Advanced usage examples (docker-compose, custom commands)
   - Security features and directory structure overview

4. **Testing Completed** - All acceptance criteria validated
   - AC1: Workspace mount accessible at /workspace with read-write permissions
   - AC2: Files created/modified in container persist on host
   - AC3: Config mount accessible at /config/.claude-code with read-only permissions
   - AC4: Read-only enforcement prevents writes to config directory
   - Error handling: Container exits with helpful message when mounts are missing/incorrect

5. **Implementation Notes**
   - Script permissions issue resolved by using chmod 755 (not just +x)
   - Entrypoint script must be copied before USER directive for proper permissions
   - Docker automatically creates VOLUME directories, validation checks permissions
   - Color-coded output (green/yellow/red) for clear validation feedback
   - Exit code 1 on validation failure for scripting/automation compatibility

### File List

**Created Files:**
- docker-entrypoint.sh - Volume mount validation script
- README.md - Project documentation

**Modified Files:**
- Dockerfile - Added entrypoint script, VOLUME declarations, and ENTRYPOINT directive

**Test Results:**
- Workspace read test: PASS
- Workspace write test: PASS (file created and persisted on host)
- Workspace modify test: PASS (existing file modified and persisted)
- Config read test: PASS
- Config write protection test: PASS (correctly denied with "Read-only file system" error)
- Missing workspace validation: PASS (detected non-writable workspace)
- Startup validation output: PASS (clear color-coded messages)
