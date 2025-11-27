#!/bin/bash
# docker-entrypoint.sh
# Container startup script for claude-container
# Validates required volume mounts and logs mount status
# Exit with error if required mounts are missing or have incorrect permissions

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Claude Container - Startup Validation"
echo "=========================================="

# Flag to track validation success
VALIDATION_FAILED=0

# ============================================================================
# Task 3.1: Validate workspace mount (/workspace)
# ============================================================================
echo -e "\n${YELLOW}[1/3] Checking workspace mount (/workspace)...${NC}"

if [ ! -d "/workspace" ]; then
    echo -e "${RED}ERROR: /workspace directory does not exist!${NC}"
    echo "The workspace mount is required for Claude to access your project files."
    VALIDATION_FAILED=1
elif [ ! -r "/workspace" ]; then
    echo -e "${RED}ERROR: /workspace is not readable!${NC}"
    echo "Check volume mount permissions."
    VALIDATION_FAILED=1
elif [ ! -w "/workspace" ]; then
    echo -e "${RED}ERROR: /workspace is not writable!${NC}"
    echo "Claude needs write access to modify project files."
    VALIDATION_FAILED=1
else
    echo -e "${GREEN}✓ /workspace is mounted and accessible (read-write)${NC}"
    ls -ld /workspace
fi

# ============================================================================
# Task 3.2: Validate Claude config mount (/config/.claude-code)
# ============================================================================
echo -e "\n${YELLOW}[2/3] Checking Claude config mount (/config/.claude-code)...${NC}"

if [ ! -d "/config/.claude-code" ]; then
    echo -e "${RED}ERROR: /config/.claude-code directory does not exist!${NC}"
    echo "The Claude config mount is required for API key authentication."
    VALIDATION_FAILED=1
elif [ ! -r "/config/.claude-code" ]; then
    echo -e "${RED}ERROR: /config/.claude-code is not readable!${NC}"
    echo "Check volume mount permissions."
    VALIDATION_FAILED=1
else
    echo -e "${GREEN}✓ /config/.claude-code is mounted and readable${NC}"
    ls -ld /config/.claude-code

    # Verify it's read-only by checking if we can write to it
    if touch /config/.claude-code/.write-test 2>/dev/null; then
        echo -e "${YELLOW}WARNING: /config/.claude-code is writable (should be read-only)${NC}"
        echo "Consider mounting with :ro flag to prevent accidental modifications."
        rm -f /config/.claude-code/.write-test 2>/dev/null
    else
        echo -e "${GREEN}✓ /config/.claude-code is correctly mounted read-only${NC}"
    fi

    # Check if config.json exists
    if [ -f "/config/.claude-code/config.json" ]; then
        echo -e "${GREEN}✓ Claude config file found (config.json)${NC}"
    else
        echo -e "${YELLOW}WARNING: config.json not found in /config/.claude-code${NC}"
        echo "Claude CLI may not be able to authenticate without configuration."
    fi
fi

# ============================================================================
# Task 3.2.1: Check Docker socket mount (optional)
# ============================================================================
echo -e "\n${YELLOW}[3/3] Checking Docker socket mount (optional)...${NC}"

DOCKER_SOCK="/var/run/docker.sock"
if [ -S "$DOCKER_SOCK" ]; then
    if [ -r "$DOCKER_SOCK" ] && [ -w "$DOCKER_SOCK" ]; then
        echo -e "${GREEN}✓ Docker socket is mounted and accessible${NC}"
        docker --version 2>/dev/null && echo -e "${GREEN}✓ Docker CLI is working${NC}"
    else
        echo -e "${YELLOW}WARNING: Docker socket mounted but not accessible${NC}"
        echo "  Socket permissions: $(ls -la $DOCKER_SOCK)"
        echo "  Current user: $(whoami) (UID: $(id -u), GID: $(id -g))"
        echo ""
        echo "  To fix, run the container with the docker group:"
        echo "    --group-add \$(stat -c '%g' /var/run/docker.sock)"
    fi
else
    echo -e "${YELLOW}Docker socket not mounted (optional feature)${NC}"
    echo "  To enable Docker access, add: -v /var/run/docker.sock:/var/run/docker.sock"
fi

# ============================================================================
# Task 3.3: Exit with error if validation failed
# ============================================================================
echo -e "\n=========================================="
if [ $VALIDATION_FAILED -eq 1 ]; then
    echo -e "${RED}VALIDATION FAILED - Container startup aborted${NC}"
    echo -e "\nRequired volume mounts:"
    echo "  docker run -v \$HOME/my-project:/workspace \\"
    echo "             -v ~/.config/claude-code:/config/.claude-code:ro \\"
    echo "             claude-container"
    echo ""
    echo "Documentation: See README.md for detailed setup instructions"
    echo "=========================================="
    exit 1
fi

echo -e "${GREEN}All validations passed - Starting container${NC}"
echo "=========================================="
echo ""

# ============================================================================
# Task 3.4: Log mount validation results
# ============================================================================
# Log mount information for debugging
echo "Mount Information:"
echo "  Workspace: /workspace"
echo "  Config: /config/.claude-code"
echo "  User: $(whoami) (UID: $(id -u), GID: $(id -g))"
echo ""

# Execute the command passed to docker run
# This allows flexibility in what command runs after validation
exec "$@"
