# Claude Container - Development Guide

## Launching the Container

### Prerequisites

1. Docker installed
2. One-time authentication completed (see below)

### One-Time Authentication Setup

Before first use, create credentials that persist across container runs:

```bash
mkdir -p ~/.claude-container
docker run -it --rm \
  -v ~/.claude-container:/config/.claude-code \
  --entrypoint claude \
  claude-container
```

Complete the OAuth login in your browser, then exit with `/exit`.

### Running the Container

**Basic (without Docker access):**
```bash
docker run -d --name claude-container \
  -p 3000:3000 \
  --memory=8g \
  -e HOST_WORKSPACE_PATH=/path/to/your/project \
  -v /path/to/your/project:/workspace \
  -v ~/.claude-container:/config/.claude-code \
  -v ~/.gitconfig:/home/claude-user/.gitconfig:ro \
  claude-container
```

**With Docker socket (recommended for development):**

macOS:
```bash
docker run -d --name claude-container \
  -p 3000:3000 \
  --memory=8g \
  -e HOST_WORKSPACE_PATH=/path/to/your/project \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --group-add $(stat -f '%g' /var/run/docker.sock) \
  -v /path/to/your/project:/workspace \
  -v ~/.claude-container:/config/.claude-code \
  -v ~/.gitconfig:/home/claude-user/.gitconfig:ro \
  claude-container
```

Linux:
```bash
docker run -d --name claude-container \
  -p 3000:3000 \
  --memory=8g \
  -e HOST_WORKSPACE_PATH=/path/to/your/project \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --group-add $(stat -c '%g' /var/run/docker.sock) \
  -v /path/to/your/project:/workspace \
  -v ~/.claude-container:/config/.claude-code \
  -v ~/.gitconfig:/home/claude-user/.gitconfig:ro \
  claude-container
```

Then open http://localhost:3000

### Volume Mounts

| Mount | Container Path | Purpose |
|-------|---------------|---------|
| Project directory | `/workspace` | Your code (read-write) |
| `~/.claude-container` | `/config/.claude-code` | Claude CLI auth & logs |
| `~/.gitconfig` | `/home/claude-user/.gitconfig` | Git identity for commits (read-only) |
| `/var/run/docker.sock` | `/var/run/docker.sock` | Docker access (optional) |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `HOST_WORKSPACE_PATH` | Real host path to workspace (enables `file://` links in UI) |

### Rebuild and Restart

macOS:
```bash
docker kill claude-container && docker rm claude-container
docker build -t claude-container .
docker run -d --name claude-container \
  -p 3000:3000 \
  --memory=8g \
  -e HOST_WORKSPACE_PATH=/path/to/your/project \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --group-add $(stat -f '%g' /var/run/docker.sock) \
  -v /path/to/your/project:/workspace \
  -v ~/.claude-container:/config/.claude-code \
  -v ~/.gitconfig:/home/claude-user/.gitconfig:ro \
  claude-container
```

### Check Logs

```bash
docker logs claude-container --tail 50
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## Playwright Testing

When using Playwright MCP tools to test the Claude Container UI:

### Page Load Timing

After navigating to the page, **wait at least 2 seconds** before interacting with elements. The WebSocket connection and session data need time to initialize:

```javascript
// Navigate to page
await page.goto('http://localhost:3000');

// Wait for WebSocket and session initialization
await new Promise(f => setTimeout(f, 2000));

// Now interact with elements
```

### Sending Commands to Claude Sessions

The terminal input requires a **two-step process** to send commands:

1. **Type the text** using the `browser_type` tool (fills the input field)
2. **Press Enter separately** using the `browser_press_key` tool

```javascript
// Step 1: Type the command (do NOT use submit: true)
await page.getByRole('textbox', { name: 'Terminal input' }).fill('your command here');

// Step 2: Press Enter to submit
await page.keyboard.press('Enter');
```

**Important:** Do not use `submit: true` with `browser_type` - it adds a newline instead of submitting. Always use a separate `browser_press_key` call with `Enter`.

### Waiting for Claude Responses

Claude responses can take 5-30+ seconds. Use appropriate wait times:

```javascript
// Wait for Claude to process and respond
await new Promise(f => setTimeout(f, 15000)); // 15 seconds

// Then take a snapshot to see the response
await page.snapshot();
```

