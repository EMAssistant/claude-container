# Claude Container

A Docker-based development environment for parallel Claude Code sessions with multi-session support, real-time workflow visibility, and document review tools.

## Features

- **Multi-session terminals** - Run up to 4 parallel Claude sessions simultaneously
- **Git worktree isolation** - Each session works on its own branch without conflicts
- **Workflow visibility** - Real-time BMAD workflow progress tracking
- **Document review** - Markdown rendering with diff view
- **Browser-based UI** - Web interface with xterm.js terminal emulation
- **Session persistence** - Sessions restore after container restart

## Quick Start

### Prerequisites

- Docker Host
- Git
- A project directory for Claude to work on

### 1. Build the Image

```bash
git clone https://github.com/EMAssistant/claude-container.git
cd claude-container
docker build -t claude-container .
```

### 2. One-Time Authentication

```bash
mkdir -p ~/.claude-container
docker run -it --rm \
  -v ~/.claude-container:/config/.claude-code \
  --entrypoint claude \
  claude-container
```

Complete the OAuth login in your browser, then exit with `/exit`.

### 3. Run the Container

```bash
docker run -d --name claude-container \
  -p 3000:3000 \
  -e HOST_WORKSPACE_PATH=/path/to/your/project \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --group-add $(stat -f '%g' /var/run/docker.sock) \
  -v /path/to/your/project:/workspace \
  -v ~/.claude-container:/config/.claude-code \
  -v ~/.gitconfig:/home/claude-user/.gitconfig:ro \
  claude-container
```

Then open **http://localhost:3000** in your browser.

### Volume Mounts

| Mount | Container Path | Purpose |
|-------|---------------|---------|
| Project directory | `/workspace` | Your code (read-write) |
| `~/.claude-container` | `/config/.claude-code` | Claude CLI auth & logs |
| `~/.gitconfig` | `/home/claude-user/.gitconfig` | Git identity (read-only) |
| `/var/run/docker.sock` | `/var/run/docker.sock` | Docker access (optional) |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `HOST_WORKSPACE_PATH` | Host path to workspace (enables `file://` links in UI) |

## Container Tools

- Python 3.13, Java 21 LTS, Node.js 24 LTS
- AWS CLI v2, Docker CLI, Docker Compose
- Claude CLI, Git, gcc, make, jq

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React + xterm.js)                 │
├─────────────────────────────────────────────┤
│  Node.js/Express Backend                    │
│  - PTY process management                   │
│  - WebSocket streaming                      │
│  - Git worktree isolation                   │
├─────────────────────────────────────────────┤
│  Docker Container (Ubuntu 22.04)            │
│  - Claude CLI + development tools           │
└─────────────────────────────────────────────┘
```

Each session runs in its own git worktree on a dedicated branch with crash isolation.

## Development

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
cd frontend && npx playwright test
```

## Troubleshooting

**Container won't start:**
- Check Docker is running: `docker ps`
- Verify port 3000 is available: `lsof -i :3000`

**Authentication fails:**
- Re-run the one-time authentication setup
- Verify `~/.claude-container` is mounted

**WebSocket connection lost:**
- Wait for auto-reconnect (exponential backoff)
- Refresh browser if persists >5 minutes

See [docs/troubleshooting.md](docs/troubleshooting.md) for more.

## Documentation

- [Architecture](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Testing Guide](docs/testing.md)
- [Contributing](CONTRIBUTING.md)

## Support

- **Issues:** https://github.com/EMAssistant/claude-container/issues
- **Docs:** See `docs/` directory
