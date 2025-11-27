# Troubleshooting Guide

**Version:** 1.0
**Last Updated:** 2025-11-26

This guide covers common issues you may encounter when using Claude Container, along with symptoms, causes, solutions, and prevention strategies.

## Common Issues

### Issue 1: Container Won't Start

**Symptoms:**
- `docker run` command fails with error message
- Container exits immediately after starting
- Cannot access http://localhost:3000

**Causes:**
- Docker daemon not running
- Volume path doesn't exist on host
- Port 3000 already in use by another service
- Volume mount permissions issue
- One-time authentication not completed

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker ps
   # Should list running containers, or at least show column headers
   ```

2. **Verify volume paths exist:**
   ```bash
   ls -la /path/to/your/project
   ls -la ~/.claude-container
   ```
   If `~/.claude-container` doesn't exist, create it:
   ```bash
   mkdir -p ~/.claude-container
   ```

3. **Check port 3000 availability:**
   ```bash
   # macOS/Linux
   lsof -i :3000

   # If port is in use, kill the conflicting process or change port
   docker run -p 3001:3000 ...  # Use port 3001 instead
   ```

4. **Check container logs for validation errors:**
   ```bash
   docker logs claude-container
   ```
   Look for startup validation messages indicating mount issues.

5. **Verify permissions on project directory:**
   ```bash
   # On host system
   ls -ld $HOME/my-project
   chmod -R u+rw $HOME/my-project  # Ensure read-write permissions
   ```

**Prevention:**
- Always check Docker is running before starting the container
- Create required directories before running `docker run`
- Use absolute paths (not relative paths) for volume mounts
- Complete one-time authentication before first use

---

### Issue 2: Claude Authentication Fails

**Symptoms:**
- Terminal shows "Not authenticated" error
- Claude CLI shows login/setup screen instead of ready prompt
- OAuth login prompt appears in terminal

**Causes:**
- One-time authentication setup not completed
- Config volume not mounted correctly
- Credentials file missing or corrupted
- Using host `~/.config/claude-code` instead of `~/.claude-container`

**Solutions:**

1. **Complete one-time authentication:**
   ```bash
   mkdir -p ~/.claude-container
   docker run -it --rm \
     -v ~/.claude-container:/config/.claude-code \
     --entrypoint claude \
     claude-container

   # Complete OAuth login in browser
   # Exit with /exit after successful login
   ```

2. **Verify config volume is mounted:**
   ```bash
   docker inspect claude-container | grep claude-code
   # Should show: "Source": "/Users/you/.claude-container"
   ```

3. **Check credentials file exists:**
   ```bash
   ls ~/.claude-container/.credentials.json
   # Should exist if authentication was successful
   ```

4. **Re-run authentication if credentials corrupted:**
   ```bash
   rm -rf ~/.claude-container/*
   # Then run one-time authentication again
   ```

**Prevention:**
- Always mount `~/.claude-container` (not `~/.config/claude-code`)
- Backup `~/.claude-container/.credentials.json` periodically
- Don't manually edit credentials file
- Complete authentication before running main container

**Why this happens:** On macOS/Windows, Claude CLI stores OAuth tokens in the system Keychain, not in config files. The container needs its own portable credentials created via the one-time authentication setup.

---

### Issue 3: WebSocket Connection Lost

**Symptoms:**
- Red banner "Connection lost. Reconnecting..." appears at top of UI
- Terminal stops responding to input
- Session status shows "disconnected"
- Auto-reconnect attempts visible in UI

**Causes:**
- Network interruption (WiFi disconnect, VPN change)
- Container restart or crash
- Browser tab suspended (Chrome throttling)
- WebSocket server overload
- Normal behavior during container restart

**Solutions:**

1. **Wait for auto-reconnect:**
   - Client automatically retries with exponential backoff (1s, 2s, 4s, 8s, ..., max 30s)
   - Wait up to 5 minutes for reconnection
   - Monitor banner for "Reconnecting..." messages

2. **Check container is running:**
   ```bash
   docker ps | grep claude-container
   # Should show status "Up X minutes"
   ```

3. **Refresh browser if reconnect fails:**
   - Press F5 or Cmd+R to refresh the page
   - WebSocket will reconnect on page load

4. **Check container logs for errors:**
   ```bash
   docker logs claude-container --tail 50
   ```

5. **Restart container if crashed:**
   ```bash
   docker restart claude-container
   ```

**Prevention:**
- This is normal behavior during network interruptions
- Keep browser tab active (Chrome suspends inactive tabs)
- Use stable network connection (avoid frequent WiFi switching)
- Graceful reconnection is automatic; no action needed in most cases

---

### Issue 4: Session Won't Resume After Restart

**Symptoms:**
- After container restart, sessions show "stopped" or "idle" status
- Resume button appears on sessions
- Terminal is blank or shows no output
- Session metadata exists but PTY is not running

**Causes:**
- PTY processes don't persist across container restarts (by design)
- This is expected behavior, not a bug
- Session state (metadata, git worktree) persists, but PTY must be manually restarted

**Solutions:**

1. **Click "Resume" button on each session:**
   - Each session has a Resume button when in idle/stopped state
   - Click Resume to restart the Claude CLI PTY process
   - Terminal will reinitialize and show Claude prompt

2. **Verify session metadata persisted:**
   ```bash
   docker exec claude-container cat /workspace/.claude-container-sessions.json
   # Should show sessions with status "stopped" or "idle"
   ```

3. **Resume all sessions programmatically (if needed):**
   - No CLI command exists; must use UI Resume button
   - Sessions restore from `/workspace/.claude-container-sessions.json`

**Prevention:**
- This is expected behavior from Epic 2 Story 2.10
- Session persistence was designed for metadata recovery, not PTY persistence
- Manual resume gives you control over which sessions to restart
- PTY processes are ephemeral by design (cannot survive container restarts)

**Why this works this way:** PTY processes hold file descriptors and kernel state that cannot serialize across restarts. Session metadata (branch, worktree path, history) persists in JSON, but the running process must be manually restarted.

---

### Issue 5: Terminal Not Responding

**Symptoms:**
- Terminal frozen, not accepting input
- Commands typed don't appear
- Claude CLI not producing output
- Session status shows "active" but nothing happens

**Causes:**
- PTY process stuck or crashed
- Claude CLI waiting for input (background question)
- Long-running operation (test suite, build)
- PTY stdin buffer full
- Network latency causing apparent freeze

**Solutions:**

1. **Press STOP button or ESC key:**
   - Sends SIGINT (Ctrl+C) to Claude CLI
   - Wait 5-10 seconds for response
   - Check for `^C` echo in terminal

2. **Check session status badge:**
   - Green (active) = running normally
   - Yellow (waiting) = Claude needs input
   - Red (error) = PTY crashed
   - Blue (idle) = no output for 5+ minutes

3. **Wait for long-running operations:**
   - If test suite or build is running, wait for completion
   - Check container logs for output:
     ```bash
     docker logs claude-container --tail 100
     ```

4. **Restart session if frozen:**
   - Click session destroy button (trash icon)
   - Create new session or resume existing
   - Check worktree still exists:
     ```bash
     docker exec claude-container ls /workspace/.worktrees/
     ```

5. **Check WebSocket connection:**
   - Look for "Connection lost" banner
   - If disconnected, wait for auto-reconnect

**Prevention:**
- Monitor session status badges for warnings
- Use STOP button if Claude appears stuck >5 minutes
- Check container logs regularly for errors
- Ensure sufficient container resources (2GB+ RAM per session)

---

### Issue 6: File Tree Not Showing Files

**Symptoms:**
- Left sidebar file tree is empty
- "No files" message shown
- Expected workspace files not visible
- File tree doesn't update after Claude writes files

**Causes:**
- File watcher initialization takes 1-2 seconds after container start
- Workspace mounted as empty directory
- File watcher crashed or not started
- Chokidar ignoring files (node_modules, .git, etc.)

**Solutions:**

1. **Wait 2 seconds after page load:**
   - File watcher initialization is not instant
   - Wait for file tree to populate automatically

2. **Refresh browser:**
   - Press F5 or Cmd+R
   - File tree should repopulate on page load

3. **Check workspace volume mount:**
   ```bash
   docker exec claude-container ls -la /workspace/
   # Should show your project files
   ```
   If empty, volume mount is incorrect. Fix:
   ```bash
   docker stop claude-container
   docker rm claude-container
   # Re-run with correct volume path:
   docker run -v /correct/path:/workspace ...
   ```

4. **Check container logs for file watcher errors:**
   ```bash
   docker logs claude-container | grep -i "file watcher\|chokidar"
   ```

5. **Verify files are not ignored:**
   - File tree ignores: `node_modules/`, `.git/`, `.worktrees/`
   - Ensure your files are in workspace root or subdirectories

**Prevention:**
- Verify volume mount path before starting container
- Wait 2 seconds after page load for file tree initialization
- Check logs if file tree doesn't appear after 5 seconds
- Normal initialization delay; not a bug

---

### Issue 7: Diff View Empty

**Symptoms:**
- Toggle diff button shows no changes
- Diff view blank or shows "No changes"
- Expected to see green/red highlighting but doesn't appear
- Diff cache not working

**Causes:**
- First-time viewing document (no cached baseline)
- Diff cache cleared (localStorage cleared or session destroyed)
- No actual changes made to document since last view
- Cache key mismatch (session ID or file path changed)

**Solutions:**

1. **View document again after Claude modifies it:**
   - First view establishes baseline in cache
   - Second view (after Claude edits) will show diff
   - Toggle "Show Diff" button to see changes

2. **Check if document actually changed:**
   - Open document in external editor
   - Verify Claude made changes to the file
   - Diff view only shows changes since YOUR last view, not all changes

3. **Clear and re-establish cache:**
   - Click "Clear Diff Cache" button (if available)
   - View document to establish new baseline
   - Make changes and view again

4. **Check localStorage:**
   ```javascript
   // In browser console:
   localStorage.getItem('diff-cache:sessionId:filePath')
   // Should show cached content
   ```

5. **Verify session ID hasn't changed:**
   - Destroying and recreating session changes session ID
   - Diff cache is per-session
   - New session = new cache

**Prevention:**
- Expected behavior from Story 3.7: first view establishes baseline
- Diff cache shows changes since YOUR last view, not all changes
- If document was modified before you opened it, first view shows final state
- Second view (after Claude modifies) will show diff

**Why this works this way:** Diff cache stores content when YOU view a document. If Claude already modified it before you opened it, the baseline is the already-modified content. Future modifications will show as diffs.

---

### Issue 8: High Memory Usage

**Symptoms:**
- Resource warning banner appears: "High memory usage"
- Container performance degrades (slow terminal response)
- Browser becomes sluggish
- Memory usage >87% reported in UI
- Cannot create new sessions (blocked at 93%)

**Causes:**
- 4 concurrent sessions running (design limit)
- Large terminal output buffers (long test output, logs)
- Memory leak in backend or frontend
- Claude CLI process consuming excessive memory
- Zombie processes not cleaned up

**Solutions:**

1. **Close idle sessions:**
   - Check session status badges
   - Destroy sessions with idle (blue) or stopped (gray) status
   - Keep 3 or fewer active sessions for best performance

2. **Restart container to clear memory:**
   ```bash
   docker restart claude-container
   ```
   Sessions will restore from JSON; resume as needed.

3. **Check container memory usage:**
   ```bash
   docker stats claude-container
   # Shows real-time memory usage
   ```

4. **Increase container memory limit:**
   ```bash
   # If using Docker Compose, add:
   deploy:
     resources:
       limits:
         memory: 8G  # Increase from default

   # Or with docker run:
   docker run --memory="8g" ...
   ```

5. **Clear terminal output buffers:**
   - Destroy and recreate sessions to clear output history
   - xterm.js keeps last ~1000 lines in buffer

6. **Check for zombie processes:**
   ```bash
   docker exec claude-container ps aux | grep -i defunct
   # Should see "0" defunct processes
   ```
   If zombies exist, restart container.

**Prevention:**
- Keep to 3 or fewer active sessions for optimal performance
- Close sessions when not actively in use
- Monitor memory warning banner
- Design limit is 4 concurrent sessions; exceeding this degrades performance
- Resource monitoring (Story 4.8) warns at 87%, blocks new sessions at 93%

**Memory Guidelines:**
- 1 active session: ~1.5GB RAM
- 2 active sessions: ~2.5GB RAM
- 3 active sessions: ~3.5GB RAM
- 4 active sessions: ~5GB RAM (approaching warning threshold)

---

## Additional Troubleshooting

### Container Logs

Always check container logs for detailed error messages:

```bash
# Last 50 lines
docker logs claude-container --tail 50

# Follow logs in real-time
docker logs claude-container --follow

# Filter for errors
docker logs claude-container 2>&1 | grep -i error

# Filter for specific session
docker logs claude-container 2>&1 | grep "sessionId=abc123"
```

### Health Check

Verify container health:

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","uptime":12345,"sessions":2,"memory":"45%"}
```

### Container Inspection

Get detailed container information:

```bash
# Inspect container configuration
docker inspect claude-container

# Check volume mounts
docker inspect claude-container | grep -A 10 "Mounts"

# Check environment variables
docker inspect claude-container | grep -A 10 "Env"
```

### Session State

Check persisted session state:

```bash
# View session JSON
docker exec claude-container cat /workspace/.claude-container-sessions.json

# Pretty-print with jq
docker exec claude-container cat /workspace/.claude-container-sessions.json | jq .
```

### WebSocket Debugging

Check WebSocket connection in browser DevTools:

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by WS (WebSocket)
4. Click on WebSocket connection
5. View Messages tab for message flow

---

## Getting Help

If these troubleshooting steps don't resolve your issue:

1. **Check GitHub Issues:** https://github.com/EMAssistant/claude-container/issues
   - Search for similar issues
   - Check closed issues for solutions

2. **Create New Issue:**
   - Include: Description, steps to reproduce, expected vs actual behavior
   - Include: Docker version, OS, browser, container logs
   - Include: Output of `docker inspect claude-container`

3. **Debugging Information to Include:**
   ```bash
   # Docker version
   docker --version

   # Container status
   docker ps -a | grep claude-container

   # Container logs (last 100 lines)
   docker logs claude-container --tail 100

   # Volume mounts
   docker inspect claude-container | grep -A 10 "Mounts"

   # System resources
   docker stats claude-container --no-stream
   ```

---

## Related Documentation

- [README.md](../README.md) - Quick Start and overview
- [docs/architecture.md](architecture.md) - System architecture and design patterns
- [docs/api.md](api.md) - REST API and WebSocket protocol
- [docs/testing.md](testing.md) - Testing guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development setup

---

**Last Updated:** 2025-11-26
**Story:** 4.12 - Documentation and README
