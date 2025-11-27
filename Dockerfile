# Claude Container - Development Environment
# Base: Ubuntu 24.04 LTS for stability and long-term support
# Purpose: Sandboxed environment for autonomous Claude CLI execution
# Multi-stage build: Separates build dependencies from runtime image

# ============================================================================
# Stage 1: Frontend Builder - Build React frontend with Vite
# ============================================================================
FROM ubuntu:24.04 AS frontend-builder

# Prevent interactive prompts during package installation
ARG DEBIAN_FRONTEND=noninteractive

# Install only what's needed to build frontend: Node.js
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24 LTS (only dependency for frontend build)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory for frontend build
WORKDIR /app/frontend

# Copy frontend package files first for optimal layer caching
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build frontend for production
# Output: /app/frontend/dist/ with optimized assets
RUN npm run build

# ============================================================================
# Stage 2: Backend Builder - Build TypeScript backend
# ============================================================================
FROM ubuntu:24.04 AS backend-builder

# Prevent interactive prompts during package installation
ARG DEBIAN_FRONTEND=noninteractive

# Install what's needed to build backend: Node.js + build tools for node-pty
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory for backend build
WORKDIR /app/backend

# Copy backend package files first for optimal layer caching
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci

# Copy backend source code
COPY backend/ ./

# Build backend TypeScript to JavaScript
RUN npm run build

# ============================================================================
# Stage 4: Runtime - Minimal runtime environment without build dependencies
# ============================================================================
FROM ubuntu:24.04

# Image metadata labels
LABEL version="1.0.0" \
      maintainer="Kyle" \
      description="Claude Container Development Environment with Python 3.13, Java 21, Node.js 24 LTS, AWS CLI v2" \
      source="https://github.com/EMAssistant/claude-container"

# Prevent interactive prompts (ARG instead of ENV to avoid runtime persistence)
ARG DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies
# - build-essential needed for node-pty native module rebuild during npm ci
# - OpenJDK 21 JDK (includes javac for Java development)
# - Maven for Java builds
# - software-properties-common for add-apt-repository (Python 3.13 PPA)
# - apt-transport-https, gnupg, lsb-release for Docker repo setup
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    jq \
    ca-certificates \
    software-properties-common \
    build-essential \
    openjdk-21-jdk \
    maven \
    apt-transport-https \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Add Docker repository and install Docker CLI
# Only installs CLI, not the daemon - uses host's Docker via socket mount
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y docker-ce-cli docker-compose-plugin && \
    rm -rf /var/lib/apt/lists/*

# Install Python 3.13 runtime via deadsnakes PPA
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y \
    python3.13 \
    python3.13-venv \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.13 as default python3
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.13 1

# Install pip for Python 3.13
RUN python3.13 -m ensurepip --upgrade && \
    python3.13 -m pip install --upgrade pip setuptools wheel

# Install Node.js 24 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN apt-get update && apt-get install -y unzip && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws && \
    rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy frontend build output from frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy backend build output from backend-builder stage
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY --from=backend-builder /app/backend/package*.json /app/backend/

# Set working directory for backend
WORKDIR /app/backend

# Install backend dependencies (includes rebuilding native modules like node-pty)
RUN npm ci

# Copy entrypoint script for volume mount validation (before user creation)
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

# Task 7: Configure container user and security
# Create non-root user for running container processes
RUN useradd -m -s /bin/bash claude-user && \
    mkdir -p /workspace /config/.claude-code /app/backend /app/frontend && \
    chown -R claude-user:claude-user /workspace /app && \
    # Allow claude-user to update global npm packages (for Claude CLI auto-update)
    chown -R claude-user:claude-user /usr/lib/node_modules /usr/bin

# Declare volume mount points (Story 1.2)
# /workspace - Host project directory (read-write)
# /config/.claude-code - Claude CLI configuration (read-only)
VOLUME ["/workspace", "/config/.claude-code"]

# Story 1.11: Tool Approval Elimination via Container Configuration
# Configure Claude CLI to bypass all permission prompts in the sandboxed environment
# This enables autonomous execution without approval prompts (FR6)
# Safe due to Docker container isolation (FR7)
ENV CLAUDE_PERMISSION_MODE=bypassPermissions

# Point Claude CLI to the mounted config directory
# This allows using the host's Claude Code authentication and settings
ENV CLAUDE_CONFIG_DIR=/config/.claude-code

# Switch to non-root user
USER claude-user

# Set entrypoint script for startup validation
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Expose port 3000 for web interface
EXPOSE 3000

# Health check: Verify backend server is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start backend server which serves frontend and handles WebSocket connections
CMD ["node", "dist/server.js"]
