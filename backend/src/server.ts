import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { ptyManager } from './ptyManager';
import { sessionManager, MaxSessionsError, InvalidSessionNameError } from './sessionManager';
import { worktreeManager } from './worktreeManager';
import { fileWatcher } from './fileWatcher';
import { parseWorkflowStatus } from './statusParser';
import { StatusChecker } from './statusChecker';
import { backpressureMonitor } from './backpressureHandler';
import { createShutdownManager } from './shutdownManager';
import { createResourceMonitor } from './resourceMonitor';
import { createZombieCleanup } from './zombieCleanup';
import { performanceMonitor } from './performanceMonitor';
import gitRoutes from './routes/gitRoutes';
import artifactRoutes from './routes/artifactRoutes';
import {
  ClientMessage,
  TerminalInputMessage,
  TerminalInterruptMessage,
  TerminalResizeMessage,
  SessionAttachMessage,
  SessionDetachMessage,
  SessionResumeMessage,
  TerminalOutputMessage,
  SessionAttachedMessage,
  SessionStatusMessage,
  TerminalExitMessage,
  SessionDestroyedMessage,
  SessionCreatedMessage,
  SessionUpdatedMessage,
  ErrorMessage,
  OutputBuffer,
  SessionData,
  SessionStatus,
  SessionNeedsInputMessage
} from './types';

// Constants from story context
const PORT = 3000;
const HOST = '0.0.0.0';
const FRONTEND_DIST_PATH = '/app/frontend/dist';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const OUTPUT_BUFFER_DELAY = 16; // 16ms buffering for 60fps (~100ms latency target)

// Winston logger configuration with structured JSON logging
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      )
    })
  ]
});

// Initialize Express app
const app = express();

// Express middleware
app.use(express.json());

// Story 4.7 AC #8: Reject new HTTP requests during shutdown
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (shutdownManager && shutdownManager.isShutdown) {
    logger.warn('Rejecting HTTP request - server shutting down', { path: req.path });
    res.status(503).json({ error: 'Server shutting down' });
    return;
  }
  next();
});

// Serve static frontend files from /app/frontend/dist
app.use(express.static(FRONTEND_DIST_PATH));

// Story 5.1: Register git routes for session-specific git operations
app.use('/api/sessions', gitRoutes);

// Story 5.6: Register artifact routes for approval operations
app.use('/api/sessions', artifactRoutes);

// Story 2.11: Health check endpoint with session count and memory stats
// Task 4.4: Add health check endpoint GET /health with session count and memory
app.get('/api/health', (_req: Request, res: Response) => {
  const uptime = process.uptime();
  const sessions = sessionManager.getAllSessions();
  const memoryUsage = process.memoryUsage();

  res.json({
    status: 'ok',
    uptime,
    sessionCount: sessions.length,
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external
    }
  });
});

// Workspace info endpoint - returns repository name and workspace path
app.get('/api/workspace/info', async (_req: Request, res: Response) => {
  try {
    const workspacePath = process.env.WORKSPACE_ROOT || '/workspace';
    let repoName = 'workspace'; // Default fallback

    // Try to get repository name from git remote origin
    const { execSync } = require('child_process');
    const { extractRepoName } = require('./utils/gitUtils');
    const path = require('path');

    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: workspacePath,
        encoding: 'utf8',
        timeout: 5000
      }).trim();

      logger.info('Git remote URL detected', { remoteUrl });

      // Extract repo name from URL using tested utility function
      const extracted = extractRepoName(remoteUrl);
      if (extracted) {
        repoName = extracted;
      }

      logger.info('Repository name extracted', { repoName });
    } catch (gitError) {
      // If git remote fails, try to use workspace directory name
      logger.warn('Failed to get git remote, using directory name', {
        error: gitError instanceof Error ? gitError.message : String(gitError)
      });
      repoName = path.basename(workspacePath) || 'workspace';
    }

    res.json({
      repoName,
      workspacePath
    });
  } catch (error) {
    logger.error('Failed to get workspace info', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      error: 'Failed to get workspace info',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Story 4.10: Performance metrics endpoint
// GET /api/metrics - Return performance statistics (p50, p90, p99) for various event types
app.get('/api/metrics', (_req: Request, res: Response) => {
  try {
    const ptyOutputStats = performanceMonitor.getStats('pty_output');
    const sessionCreateStats = performanceMonitor.getStats('session_create');
    const websocketSendStats = performanceMonitor.getStats('websocket_send');
    const recentMeasurements = performanceMonitor.getRecentMeasurements(100);

    res.json({
      ptyOutput: ptyOutputStats,
      sessionCreate: sessionCreateStats,
      websocketSend: websocketSendStats,
      recentMeasurements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to retrieve performance metrics', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Failed to retrieve performance metrics',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 2.3: Session creation REST endpoint
// POST /api/sessions - Create a new session with worktree and PTY
// Story 4.14: Extended to accept existingBranch parameter
// Story 4.8: Check resource availability before creating session
app.post('/api/sessions', async (req: Request, res: Response) => {
  try {
    // Story 4.8 AC #2: Check if accepting new sessions (memory < 93%)
    if (resourceMonitor && !resourceMonitor.isAcceptingNewSessions) {
      const resourceState = resourceMonitor.getResourceState();
      logger.warn('Session creation blocked - memory critical', {
        memoryUsagePercent: resourceState.memoryUsagePercent,
        memoryUsedBytes: resourceState.memoryUsedBytes,
        memoryLimitBytes: resourceState.memoryLimitBytes
      });
      return res.status(503).json({
        error: {
          type: 'resource',
          message: 'Maximum resource capacity reached',
          details: `Memory usage is at ${Math.round(resourceState.memoryUsagePercent)}%. Cannot create new sessions.`,
          suggestion: 'Close idle sessions before creating new ones.'
        }
      });
    }

    const { name, branch, existingBranch } = req.body;
    logger.info('Session creation request received', { name, branch, existingBranch });

    // Validate request body
    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid session name type', code: 'INVALID_REQUEST' });
    }
    if (branch !== undefined && typeof branch !== 'string') {
      return res.status(400).json({ error: 'Invalid branch name type', code: 'INVALID_REQUEST' });
    }
    if (existingBranch !== undefined && typeof existingBranch !== 'boolean') {
      return res.status(400).json({ error: 'Invalid existingBranch type', code: 'INVALID_REQUEST' });
    }

    // Create session via sessionManager (validates, creates worktree, spawns PTY, persists)
    const session = await sessionManager.createSession(name, branch, existingBranch);

    // Set up PTY output streaming using the registered PTY process
    const ptyProcess = ptyManager.getPtyProcess(session.id);

    if (ptyProcess) {
      const newSessionData: SessionData = {
        sessionId: session.id,
        connectionId: '',
        ptyProcess,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity)
      };
      activeSessions.set(session.id, newSessionData);
      setupPtyOutputStreaming(session.id, ptyProcess);
    }

    // Story 4.17: Broadcast session.created to all WebSocket clients
    broadcastSessionCreated(session);

    logger.info('Session created successfully', { sessionId: session.id, name: session.name, branch: session.branch });
    return res.status(200).json({ session });
  } catch (error) {
    if (error instanceof InvalidSessionNameError) {
      logger.warn('Session creation failed: invalid name', { error: error.message });
      return res.status(400).json({ error: error.message, code: error.code });
    }
    if (error instanceof MaxSessionsError) {
      logger.warn('Session creation failed: max sessions reached', { error: error.message });
      return res.status(400).json({ error: error.message, code: error.code });
    }
    // Story 4.15: Removed worktree conflict error (409) - multiple sessions can share branches now
    // Story 4.14: Handle branch doesn't exist error (400 Bad Request)
    if (error instanceof Error && error.message.includes('does not exist')) {
      logger.warn('Session creation failed: branch does not exist', { error: error.message });
      return res.status(400).json({
        error: {
          type: 'validation',
          message: error.message,
          suggestion: 'Choose an existing branch from the dropdown or create a new branch.'
        }
      });
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.warn('Session creation failed: branch already exists', { error: error.message });
      return res.status(409).json({ error: error.message, code: 'BRANCH_EXISTS' });
    }
    logger.error('Session creation failed', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    return res.status(500).json({ error: 'Failed to create session', code: 'INTERNAL_ERROR', details: error instanceof Error ? error.message : String(error) });
  }
});

// Story 4.16: Session list endpoint
// GET /api/sessions - Return all active sessions
app.get('/api/sessions', (_req: Request, res: Response) => {
  try {
    const sessions = sessionManager.getAllSessions();
    logger.info('Session list retrieved', { count: sessions.length });
    return res.status(200).json({ sessions });
  } catch (error) {
    logger.error('Failed to retrieve session list', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: 'Failed to retrieve sessions',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 2.7: Session destruction REST endpoint
// DELETE /api/sessions/:id - Destroy a session with optional worktree cleanup
app.delete('/api/sessions/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const cleanup = req.query.cleanup === 'true';

    logger.info('Session destruction request received', { sessionId, cleanup });

    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Session destruction failed: session not found', { sessionId });
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
    }

    let cleanupError: Error | null = null;

    // Destroy session via sessionManager (graceful PTY shutdown, optional worktree cleanup)
    try {
      await sessionManager.destroySession(sessionId, cleanup);
    } catch (error) {
      // Worktree cleanup failed, but session was removed
      cleanupError = error as Error;
    }

    // Clean up active session data
    activeSessions.delete(sessionId);
    sessionOutputHistory.delete(sessionId);
    sessionDisconnectBuffers.delete(sessionId);
    outputBuffers.delete(sessionId);

    // Broadcast session.destroyed message to all subscribers
    broadcastSessionDestroyed(sessionId);

    logger.info('Session destroyed successfully', { sessionId, cleanup, cleanupError: cleanupError?.message });

    // Return appropriate response based on cleanup result
    if (cleanupError) {
      // Session destroyed but worktree cleanup failed
      return res.status(500).json({
        error: 'Worktree cleanup failed',
        code: 'CLEANUP_ERROR',
        details: cleanupError.message,
        message: 'Session destroyed but worktree cleanup failed. You may need to manually remove the worktree.'
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Session destruction failed', {
      sessionId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: 'Failed to destroy session',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 4.14: Branch listing endpoint
// Story 4.15: Extended to include sessionCount and activeSessions
// GET /api/git/branches - Return list of local branches with metadata
app.get('/api/git/branches', async (_req: Request, res: Response) => {
  try {
    logger.info('Branch listing request received');

    // Use simple-git to get branch list
    const simpleGit = require('simple-git');
    const git = simpleGit('/workspace');

    // Get all local branches
    const branchSummary = await git.branchLocal();
    const allBranches = branchSummary.all;

    // Get active sessions to filter out branches with active worktrees
    const activeSessions = sessionManager.getAllSessions();
    const activeBranches = new Set(activeSessions.map(s => s.branch));

    // Build branch list with metadata
    const branches = await Promise.all(
      allBranches.map(async (branchName: string) => {
        try {
          // Get last commit for this branch
          const log = await git.log(['-1', branchName]);
          const lastCommit = log.latest;

          // Truncate commit message to max 72 chars
          const message = lastCommit?.message?.split('\n')[0].substring(0, 72) || 'No commits';

          // Story 4.15: Compute session count and active session names
          // Check both with and without "feature/" prefix to handle all branch formats
          const sessionsOnBranch = sessionManager.getSessionsByBranch(branchName);
          const sessionsOnFeatureBranch = sessionManager.getSessionsByBranch(`feature/${branchName}`);
          const allSessionsOnBranch = [...sessionsOnBranch, ...sessionsOnFeatureBranch];
          const sessionCount = allSessionsOnBranch.length;
          const activeSessionNames = allSessionsOnBranch.map(s => s.name);

          return {
            name: branchName,
            fullName: `refs/heads/${branchName}`,
            hasActiveSession: activeBranches.has(`feature/${branchName}`) || activeBranches.has(branchName),
            sessionCount,
            activeSessions: activeSessionNames,
            lastCommit: {
              hash: lastCommit?.hash?.substring(0, 7) || '',
              message,
              author: lastCommit?.author_name || '',
              date: lastCommit?.date ? new Date(lastCommit.date).toISOString() : new Date().toISOString()
            }
          };
        } catch (error) {
          logger.warn('Failed to get commit info for branch', {
            branch: branchName,
            error: error instanceof Error ? error.message : String(error)
          });
          // Return branch with minimal metadata on error
          // Story 4.15: Include sessionCount and activeSessions even on error
          const sessionsOnBranch = sessionManager.getSessionsByBranch(branchName);
          const sessionsOnFeatureBranch = sessionManager.getSessionsByBranch(`feature/${branchName}`);
          const allSessionsOnBranch = [...sessionsOnBranch, ...sessionsOnFeatureBranch];
          const sessionCount = allSessionsOnBranch.length;
          const activeSessionNames = allSessionsOnBranch.map(s => s.name);

          return {
            name: branchName,
            fullName: `refs/heads/${branchName}`,
            hasActiveSession: activeBranches.has(`feature/${branchName}`) || activeBranches.has(branchName),
            sessionCount,
            activeSessions: activeSessionNames,
            lastCommit: {
              hash: '',
              message: 'Unable to load commit info',
              author: '',
              date: new Date().toISOString()
            }
          };
        }
      })
    );

    logger.info('Branch list retrieved', { count: branches.length });
    return res.status(200).json({ branches });
  } catch (error) {
    logger.error('Failed to list branches', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: {
        type: 'git',
        message: 'Failed to retrieve branch list',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
});

// Story 3.9: Update BMAD Method endpoint
// POST /api/bmad/update - Execute npx bmad-method install command
app.post('/api/bmad/update', async (_req: Request, res: Response) => {
  let responseSent = false;
  const BMAD_UPDATE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  try {
    logger.info('BMAD update request received');

    // Spawn child process to execute npx bmad-method install
    const { spawn } = require('child_process');

    // Security: Do NOT use shell: true to prevent command injection
    const childProcess = spawn('npx', ['bmad-method', 'install'], {
      cwd: '/workspace',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Set timeout to prevent hanging requests
    const timeout = setTimeout(() => {
      if (!responseSent) {
        responseSent = true;
        childProcess.kill('SIGTERM');
        logger.error('BMAD update timeout');
        res.status(504).json({
          success: false,
          message: 'BMAD Method update timed out',
          error: 'Command exceeded 5 minute timeout'
        });
      }
    }, BMAD_UPDATE_TIMEOUT);

    // Capture stdout
    childProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      logger.info('BMAD update output', { output: output.trim() });
    });

    // Capture stderr
    childProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      logger.warn('BMAD update stderr', { output: output.trim() });
    });

    // Wait for process to complete
    childProcess.on('close', (code: number) => {
      clearTimeout(timeout);
      if (responseSent) return;
      responseSent = true;

      if (code === 0) {
        logger.info('BMAD update completed successfully', { exitCode: code });
        res.status(200).json({
          success: true,
          message: 'BMAD Method updated successfully',
          output: stdout
        });
      } else {
        logger.error('BMAD update failed', { exitCode: code, stderr });
        res.status(500).json({
          success: false,
          message: 'BMAD Method update failed',
          error: stderr || stdout,
          exitCode: code
        });
      }
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      clearTimeout(timeout);
      if (responseSent) return;
      responseSent = true;

      logger.error('BMAD update process error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Failed to spawn BMAD update process',
        error: error.message
      });
    });
  } catch (error) {
    if (responseSent) return;
    responseSent = true;

    logger.error('BMAD update failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to update BMAD Method',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 3.4: File Tree Component with Workspace Navigation
// GET /api/documents/tree - Return file tree structure for workspace
app.get('/api/documents/tree', async (_req: Request, res: Response) => {
  try {
    logger.info('File tree request received');
    const tree = await fileWatcher.buildFileTree();
    return res.status(200).json({ tree });
  } catch (error) {
    logger.error('Failed to build file tree', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: 'Failed to build file tree',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 3.1: Workflow Status API Endpoint
// GET /api/workflow/status - Return current BMAD workflow status
app.get('/api/workflow/status', async (_req: Request, res: Response) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const statusFilePath = path.join('/workspace', 'docs', 'bmm-workflow-status.yaml');

    logger.info('Workflow status request received');

    // Check if file exists
    try {
      await fs.access(statusFilePath);
    } catch {
      // No workflow status file - return null (this is normal for new projects)
      logger.info('No workflow status file found');
      return res.status(200).json({ workflow: null });
    }

    // Read and parse the file
    const content = await fs.readFile(statusFilePath, 'utf-8');
    const workflowState = parseWorkflowStatus(content);

    if (!workflowState) {
      logger.warn('Failed to parse workflow status file');
      return res.status(200).json({ workflow: null });
    }

    logger.info('Workflow status read successfully', {
      currentStep: workflowState.currentStep,
      stepsCount: workflowState.steps.length
    });

    return res.status(200).json({ workflow: workflowState });
  } catch (error) {
    logger.error('Failed to read workflow status', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: 'Failed to read workflow status',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 6.1: Sprint Status API Endpoint
// GET /api/sprint/status - Return current sprint status
app.get('/api/sprint/status', async (_req: Request, res: Response) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const statusFilePath = path.join('/workspace', 'docs', 'sprint-artifacts', 'sprint-status.yaml');

    logger.info('Sprint status request received');

    // Check if file exists
    try {
      await fs.access(statusFilePath);
    } catch {
      // No sprint status file - return error with suggestion
      logger.info('Sprint status file not found');
      return res.status(200).json({
        error: {
          type: 'not_found',
          message: 'Sprint status file not found',
          suggestion: 'Run sprint-planning workflow to initialize'
        }
      });
    }

    // Read and parse the file
    const content = await fs.readFile(statusFilePath, 'utf-8');
    const { parseSprintStatus } = require('./statusParser');
    const sprintStatus = parseSprintStatus(content);

    if (!sprintStatus) {
      logger.warn('Failed to parse sprint status file');
      return res.status(200).json({
        error: {
          type: 'parse_error',
          message: 'Failed to parse sprint-status.yaml',
          details: 'YAML file is malformed or missing required sections'
        }
      });
    }

    logger.info('Sprint status read successfully', {
      currentEpic: sprintStatus.currentEpic,
      currentStory: sprintStatus.currentStory,
      epicCount: sprintStatus.epics.length,
      storyCount: sprintStatus.stories.length
    });

    return res.status(200).json({ sprintStatus });
  } catch (error) {
    logger.error('Failed to read sprint status', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: 'Failed to read sprint status',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Story 3.5: Artifact Viewer with Markdown Rendering
// GET /api/documents/:path - Read and return file content
app.get('/api/documents/:path(*)', async (req: Request, res: Response) => {
  try {
    const filePath = req.params.path;
    logger.info('File content request received', { filePath });

    // Security: Validate path is within /workspace
    const fs = require('fs').promises;
    const path = require('path');
    const absolutePath = path.join('/workspace', filePath);
    const resolvedPath = path.resolve(absolutePath);

    // Prevent path traversal attacks
    if (!resolvedPath.startsWith('/workspace/')) {
      logger.warn('Path traversal attempt blocked', { filePath, resolvedPath });
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN'
      });
    }

    // Check if file exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        logger.warn('Requested path is not a file', { filePath, resolvedPath });
        return res.status(400).json({
          error: 'Path is not a file',
          code: 'INVALID_PATH'
        });
      }
    } catch (error) {
      logger.warn('File not found', { filePath, resolvedPath });
      return res.status(404).json({
        error: 'File not found',
        code: 'NOT_FOUND'
      });
    }

    // Read file content
    const content = await fs.readFile(resolvedPath, 'utf-8');
    logger.info('File content read successfully', { filePath, size: content.length });

    // Return as plain text
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(content);
  } catch (error) {
    logger.error('Failed to read file', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      error: 'Failed to read file',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Serve index.html for root route
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(`${FRONTEND_DIST_PATH}/index.html`);
});

// SPA routing: Serve index.html for all non-API routes (client-side routing)
// This must come after API routes but before error middleware
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // Serve index.html for all other routes to support client-side routing
  res.sendFile(`${FRONTEND_DIST_PATH}/index.html`);
});

// Express error middleware (Task 5)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Express error middleware', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({
    type: 'error',
    message: 'Internal server error',
    code: err.name
  });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Create WebSocket server attached to same HTTP server (AC3)
const wss = new WebSocketServer({ server: httpServer });

// Track active WebSocket connections
const activeConnections = new Map<string, WebSocket>();

// Track sessions with their connection and PTY process
// In a complete implementation, this would be managed by sessionManager.ts (Story 1.4)
const activeSessions = new Map<string, SessionData>();

// Track output buffers for each session (16ms buffering)
const outputBuffers = new Map<string, OutputBuffer>();

// Track session output history for replay on reconnection
// This ensures new connections see the full terminal history
const sessionOutputHistory = new Map<string, string>();

// Maximum output history size (100KB per session)
const MAX_OUTPUT_HISTORY_SIZE = 100 * 1024;

// Story 2.8: Output buffer during WebSocket disconnect (1MB per session)
// Queues output when no clients are connected, flushes on reconnection
const sessionDisconnectBuffers = new Map<string, string>();

// Maximum disconnect buffer size (1MB per session)
const MAX_DISCONNECT_BUFFER_SIZE = 1024 * 1024;

// Default session ID for Epic 1 single-session mode
const DEFAULT_SESSION_ID = 'default-session';

// Story 2.6: Multi-session WebSocket subscription tracking

/**
 * Map from WebSocket client to the set of sessionIds it's subscribed to.
 * Tracks which sessions each WebSocket is actively receiving output from.
 * Updated by handleSessionAttach and handleSessionDetach.
 */
const clientSubscriptions = new Map<WebSocket, Set<string>>();

/**
 * Map from sessionId to the set of WebSocket clients subscribed to it.
 * Used to route PTY output to all clients subscribed to a specific session.
 * Updated by handleSessionAttach and handleSessionDetach.
 */
const sessionSubscribers = new Map<string, Set<WebSocket>>();

/**
 * Throttle activity broadcasts to avoid flooding the WebSocket
 * Tracks last broadcast timestamp per session, broadcasts at most every 5 seconds
 */
const lastActivityBroadcast = new Map<string, number>();
const ACTIVITY_BROADCAST_THROTTLE_MS = 5000; // 5 seconds

/**
 * Create a new session with a PTY process running Claude CLI
 *
 * Story 1.4: PTY Process Management with node-pty
 * Story 1.10: Container Startup - Claude CLI ready to receive commands
 *
 * @param sessionId Session identifier
 * @param connectionId WebSocket connection ID
 * @returns SessionData with PTY process
 */
function createSession(sessionId: string, connectionId: string): SessionData {
  logger.info('Creating new session', { sessionId, connectionId });

  // Spawn Claude CLI as PTY process (Story 1.4)
  const ptyProcess = ptyManager.spawn('claude', [], {
    cwd: '/workspace',
    cols: 80,
    rows: 24
  });

  // Story 2.11: Register PTY process for zombie detection
  ptyManager.registerPtyProcess(sessionId, ptyProcess);

  // Create session data
  const session: SessionData = {
    sessionId,
    connectionId,
    ptyProcess,
    createdAt: new Date(),
    lastActivity: new Date()
  };

  // Store session
  activeSessions.set(sessionId, session);

  // Wire up PTY output streaming (Story 1.5)
  setupPtyOutputStreaming(sessionId, ptyProcess);

  logger.info('Session created successfully', {
    sessionId,
    connectionId,
    pid: ptyProcess.pid
  });

  return session;
}

/**
 * Send error message to WebSocket client
 * @param ws WebSocket connection
 * @param message Error message
 * @param code Optional error code
 * @param sessionId Optional session ID
 */
function sendError(ws: WebSocket, message: string, code?: string, sessionId?: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    const errorMessage: ErrorMessage = {
      type: 'error',
      message,
      code,
      sessionId
    };
    ws.send(JSON.stringify(errorMessage));
  }
}

/**
 * Broadcast session status update to all subscribed WebSocket clients
 * Story 2.9: Crash Isolation Between Sessions
 *
 * @param sessionId Session ID
 * @param status New session status
 * @param reason Optional reason for status change
 */
function broadcastSessionStatus(sessionId: string, status: SessionStatus, reason?: string): void {
  const subscribers = sessionSubscribers.get(sessionId);
  if (!subscribers || subscribers.size === 0) {
    logger.debug('No subscribers for session status update', { sessionId, status });
    return;
  }

  // Get session to extract lastActivity and check if stuck
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    logger.warn('Session not found for status broadcast', { sessionId });
    return;
  }

  // Calculate if session is stuck (30+ min idle)
  const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();
  const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
  const isStuck = timeSinceActivity > STUCK_THRESHOLD_MS;

  const statusMessage: SessionStatusMessage = {
    type: 'session.status',
    sessionId,
    status,
    lastActivity: session.lastActivity,
    isStuck,
    reason
  };

  const messageStr = JSON.stringify(statusMessage);
  let sentCount = 0;

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  logger.info('Session status broadcasted', {
    sessionId,
    status,
    lastActivity: session.lastActivity,
    isStuck,
    reason,
    subscriberCount: sentCount
  });
}

/**
 * Broadcast terminal exit event to all subscribed WebSocket clients
 * Story 2.9: Crash Isolation Between Sessions
 *
 * @param sessionId Session ID
 * @param exitCode PTY process exit code
 * @param signal Optional signal that caused exit
 */
function broadcastTerminalExit(sessionId: string, exitCode: number, signal?: number): void {
  const subscribers = sessionSubscribers.get(sessionId);
  if (!subscribers || subscribers.size === 0) {
    logger.debug('No subscribers for terminal exit event', { sessionId, exitCode, signal });
    return;
  }

  const exitMessage: TerminalExitMessage = {
    type: 'terminal.exit',
    sessionId,
    exitCode,
    signal
  };

  const messageStr = JSON.stringify(exitMessage);
  let sentCount = 0;

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  logger.info('Terminal exit broadcasted', {
    sessionId,
    exitCode,
    signal,
    subscriberCount: sentCount
  });
}

/**
 * Broadcast session destroyed event to all WebSocket clients
 * Story 2.7: Session Destruction with Cleanup Options
 *
 * @param sessionId Session ID that was destroyed
 */
function broadcastSessionDestroyed(sessionId: string): void {
  // Broadcast to all active connections (not just subscribers)
  // This ensures all clients remove the session from their UI
  const destroyedMessage: SessionDestroyedMessage = {
    type: 'session.destroyed',
    sessionId
  };

  const messageStr = JSON.stringify(destroyedMessage);
  let sentCount = 0;

  for (const [, client] of activeConnections) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  // Clean up session subscribers map
  sessionSubscribers.delete(sessionId);

  logger.info('Session destroyed message broadcasted', {
    sessionId,
    clientCount: sentCount
  });
}

/**
 * Broadcast session created event to all WebSocket clients
 * Story 4.17: Cross-Tab Session Synchronization
 *
 * @param session Full session object that was created
 */
function broadcastSessionCreated(session: import('./types').Session): void {
  // Broadcast to all active connections
  // This ensures all tabs/clients see the new session
  const createdMessage: SessionCreatedMessage = {
    type: 'session.created',
    session
  };

  const messageStr = JSON.stringify(createdMessage);
  let sentCount = 0;

  for (const [, client] of activeConnections) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  logger.info('Session created message broadcasted', {
    sessionId: session.id,
    sessionName: session.name,
    clientCount: sentCount
  });
}

/**
 * General broadcast function for sending messages to all connected WebSocket clients
 * Story 5.6: Used by artifact routes for broadcasting artifact.updated and git.status.updated
 *
 * @param message Message to broadcast to all clients
 */
function broadcast(message: any): void {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  for (const [, client] of activeConnections) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  logger.debug('Message broadcasted', {
    messageType: message.type,
    clientCount: sentCount
  });
}

/**
 * Broadcast session updated event to all WebSocket clients
 * Story 4.17: Cross-Tab Session Synchronization
 *
 * @param session Full session object with updated data
 */
function broadcastSessionUpdated(session: import('./types').Session): void {
  // Broadcast to all active connections
  // This ensures all tabs/clients see updated session data
  const updatedMessage: SessionUpdatedMessage = {
    type: 'session.updated',
    session
  };

  const messageStr = JSON.stringify(updatedMessage);
  let sentCount = 0;

  for (const [, client] of activeConnections) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  logger.info('Session updated message broadcasted', {
    sessionId: session.id,
    sessionName: session.name,
    clientCount: sentCount
  });
}

/**
 * Validate that a message has required fields
 * @param message Parsed message object
 * @returns true if valid, false otherwise
 */
function validateMessage(message: any): message is ClientMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }
  if (typeof message.type !== 'string') {
    return false;
  }
  return true;
}

/**
 * Send buffered terminal output to all subscribed WebSocket clients
 * Story 2.6: Route output by sessionId to multiple clients
 * Implements 16ms buffering to reduce message overhead while maintaining <100ms latency
 * @param sessionId Session ID
 */
function flushOutputBuffer(sessionId: string): void {
  const buffer = outputBuffers.get(sessionId);
  if (!buffer || !buffer.data) {
    return;
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    logger.warn('Session not found when flushing output buffer', { sessionId });
    outputBuffers.delete(sessionId);
    return;
  }

  // Story 2.6: Get all WebSocket clients subscribed to this session
  const subscribers = sessionSubscribers.get(sessionId);

  // Fall back to single-session mode (Epic 1 compatibility)
  // If no subscribers tracked, use the session's connection
  const clients: WebSocket[] = [];
  if (subscribers && subscribers.size > 0) {
    // Multi-session mode: send to all subscribed clients
    clients.push(...Array.from(subscribers));
  } else {
    // Single-session mode: use the session's connection
    const ws = activeConnections.get(session.connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      clients.push(ws);
    }
  }

  // Story 2.8: If no clients available, queue output in disconnect buffer
  if (clients.length === 0) {
    logger.debug('No WebSocket clients available, buffering output during disconnect', { sessionId });

    // Add to disconnect buffer
    let disconnectBuffer = sessionDisconnectBuffers.get(sessionId) || '';
    disconnectBuffer += buffer.data;

    // Enforce 1MB limit (FIFO eviction - drop oldest data)
    if (disconnectBuffer.length > MAX_DISCONNECT_BUFFER_SIZE) {
      const excess = disconnectBuffer.length - MAX_DISCONNECT_BUFFER_SIZE;
      disconnectBuffer = disconnectBuffer.slice(excess);
      logger.warn('Disconnect buffer exceeded 1MB, dropped oldest data', {
        sessionId,
        droppedBytes: excess,
        bufferSize: disconnectBuffer.length
      });
    }

    sessionDisconnectBuffers.set(sessionId, disconnectBuffer);

    // Clear the output buffer
    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }
    outputBuffers.delete(sessionId);
    return;
  }

  // Calculate latency from first buffered output to send
  const latency = performance.now() - buffer.timestamp;

  // Send terminal output message to all subscribed clients
  const outputMessage: TerminalOutputMessage = {
    type: 'terminal.output',
    sessionId,
    data: buffer.data
  };

  const messageStr = JSON.stringify(outputMessage);
  let sentCount = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  }

  // Story 4.10 AC#1: Track PTY output → WebSocket send latency
  performanceMonitor.trackLatency('pty_output', latency, sessionId);

  // Store output in history for replay on reconnection
  // Filter out problematic escape sequences that display as raw text:
  // - \x1b[O (cursor key response / application mode)
  // - \x1bO (SS3 - single shift three)
  // - Mouse tracking responses
  const filteredData = buffer.data
    .replace(/\x1b\[O/g, '')  // ESC [ O - malformed CSI
    .replace(/\x1bO[A-Z]/g, '')  // ESC O A-Z - SS3 cursor keys
    .replace(/\x1b\[\?[0-9;]*[hl]/g, '');  // Mouse mode enable/disable responses

  let history = sessionOutputHistory.get(sessionId) || '';
  history += filteredData;
  // Trim history if it exceeds max size (keep most recent output)
  if (history.length > MAX_OUTPUT_HISTORY_SIZE) {
    history = history.slice(-MAX_OUTPUT_HISTORY_SIZE);
  }
  sessionOutputHistory.set(sessionId, history);

  logger.info('Terminal output sent via WebSocket', {
    sessionId,
    bytes: buffer.data.length,
    latencyMs: latency.toFixed(2),
    subscriberCount: sentCount
  });

  // Story 5.4: Update claudeLastActivity timestamp for artifact detection
  const persistedSession = sessionManager.getSession(sessionId);
  if (persistedSession) {
    persistedSession.claudeLastActivity = new Date().toISOString();
    // Note: No need to persist to disk on every PTY output for performance
    // claudeLastActivity is only used for the 5-second detection window
  }

  // Clear buffer
  if (buffer.timer) {
    clearTimeout(buffer.timer);
  }
  outputBuffers.delete(sessionId);
}

/**
 * Buffer terminal output with 16ms delay for batching
 * This reduces WebSocket message overhead while maintaining <100ms latency target
 * Story 4.6: Skip buffering if backpressure is active
 * @param sessionId Session ID
 * @param data Output data from PTY
 */
function bufferTerminalOutput(sessionId: string, data: string): void {
  // Story 4.6 AC #2: Skip buffering if PTY is paused due to backpressure
  if (backpressureMonitor.isPaused(sessionId)) {
    logger.debug('Skipping output buffer - PTY paused due to backpressure', {
      sessionId,
      droppedBytes: data.length
    });
    return;
  }

  let buffer = outputBuffers.get(sessionId);

  if (!buffer) {
    // Create new buffer with timer
    buffer = {
      sessionId,
      data,
      timer: null,
      timestamp: performance.now()
    };
    outputBuffers.set(sessionId, buffer);

    // Set timer to flush after 16ms
    buffer.timer = setTimeout(() => {
      flushOutputBuffer(sessionId);
    }, OUTPUT_BUFFER_DELAY);
  } else {
    // Append to existing buffer
    buffer.data += data;

    // If buffer is getting large (>4KB), flush immediately
    if (buffer.data.length > 4096) {
      flushOutputBuffer(sessionId);
    }
  }
}

/**
 * Set up PTY output streaming for a session
 * Wires PTY onData callback to buffer terminal output for WebSocket streaming
 * Handles PTY exit events for cleanup
 *
 * Story 1.4: PTY Process Management with node-pty
 *
 * @param sessionId Session ID
 * @param ptyProcess PTY process instance (from node-pty)
 * @param clearHistory If true, clears the output history for this session (used when spawning new PTY)
 */
function setupPtyOutputStreaming(sessionId: string, ptyProcess: import('node-pty').IPty, clearHistory: boolean = true): void {
  // Clear output history when a new PTY is spawned to avoid duplicate banners
  if (clearHistory) {
    sessionOutputHistory.delete(sessionId);
    sessionDisconnectBuffers.delete(sessionId);
    logger.info('Cleared output history for new PTY', { sessionId });
  }
  // Story 4.1 AC #4: Waiting status detection
  let waitingTimeout: NodeJS.Timeout | null = null;

  // Wire PTY output to WebSocket streaming (AC #3)
  ptyManager.onData(ptyProcess, (data: string) => {
    logger.info('PTY output received', { sessionId, bytes: data.length, preview: data.substring(0, 100) });
    bufferTerminalOutput(sessionId, data);

    // Story 4.1 AC #1: Update lastActivity timestamp on PTY output
    const newLastActivity = new Date().toISOString();
    sessionManager.updateLastActivity(sessionId).catch(error => {
      logger.error('Failed to update lastActivity', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Throttled activity broadcast - send session.status update to keep frontend in sync
    const now = Date.now();
    const lastBroadcast = lastActivityBroadcast.get(sessionId) || 0;
    if (now - lastBroadcast >= ACTIVITY_BROADCAST_THROTTLE_MS) {
      lastActivityBroadcast.set(sessionId, now);
      const session = sessionManager.getSession(sessionId);
      if (session) {
        const activityMessage: SessionStatusMessage = {
          type: 'session.status',
          sessionId,
          status: session.status,
          lastActivity: newLastActivity,
          isStuck: false
        };
        const subscribers = sessionSubscribers.get(sessionId);
        if (subscribers) {
          const messageStr = JSON.stringify(activityMessage);
          for (const client of subscribers) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(messageStr);
            }
          }
        }
      }
    }

    // Story 4.1 AC #4: Detect "waiting" status from output ending with "?"
    // Strip ANSI escape codes to get plain text for question detection
    // eslint-disable-next-line no-control-regex
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\[\?[0-9;]*[a-zA-Z]/g, '');
    const plainText = stripAnsi(data).trim();

    // Check if this is meaningful content (not just whitespace, line chars, or prompt symbols)
    const isMeaningfulContent = plainText.length > 0 && !/^[\s\r\n─>]*$/.test(plainText);

    // Debug: Log stripped text if it contains meaningful content
    if (isMeaningfulContent) {
      logger.info('PTY text for question detection', { sessionId, plainText: plainText.substring(0, 200), containsQuestion: plainText.includes('?') });
    }

    // Only clear the waiting timeout if there's meaningful content that isn't a question
    // This prevents ANSI cursor movements from resetting the timeout
    if (waitingTimeout && isMeaningfulContent && !plainText.includes('?')) {
      logger.info('Clearing waiting timeout due to new meaningful output', { sessionId });
      clearTimeout(waitingTimeout);
      waitingTimeout = null;
    }

    // Check if output contains question mark (questions may span multiple chunks)
    // Use contains instead of endsWith since UI elements may follow the question
    if (plainText.includes('?')) {
      // Set 10-second timeout to detect waiting state
      waitingTimeout = setTimeout(async () => {
        const session = sessionManager.getSession(sessionId);
        if (!session) return;

        // Only set to waiting if session is currently active
        if (session.status === 'active') {
          logger.info('Detected waiting state (question detected)', { sessionId });

          // Update session status to waiting
          await sessionManager.updateSessionStatus(sessionId, 'waiting').catch(error => {
            logger.error('Failed to update status to waiting', {
              sessionId,
              error: error instanceof Error ? error.message : String(error)
            });
          });

          // Send session.status message to update frontend
          const statusMessage: SessionStatusMessage = {
            type: 'session.status',
            sessionId,
            status: 'waiting',
            lastActivity: session.lastActivity,
            isStuck: false
          };

          // Send session.needsInput message for browser notifications
          const needsInputMessage: SessionNeedsInputMessage = {
            type: 'session.needsInput',
            sessionId,
            message: 'Claude is asking a question'
          };

          const subscribers = sessionSubscribers.get(sessionId);
          if (subscribers) {
            const statusStr = JSON.stringify(statusMessage);
            const needsInputStr = JSON.stringify(needsInputMessage);
            for (const client of subscribers) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(statusStr);
                client.send(needsInputStr);
              }
            }
          }
        }

        waitingTimeout = null;
      }, 10000); // 10 seconds
    }
  });

  // Wire PTY exit event to crash detection and cleanup
  // Story 2.9: Crash Isolation Between Sessions (AC #1, #2)
  ptyManager.onExit(ptyProcess, async ({ exitCode, signal }) => {
    logger.info('PTY process exited', { sessionId, exitCode, signal });

    // Flush any remaining buffered output
    flushOutputBuffer(sessionId);

    // Story 2.9 AC #2: Detect crash and update session status
    // Update session status to 'error' via SessionManager
    try {
      const session = sessionManager.getSession(sessionId);
      if (session) {
        const signalName = signal ? `signal ${signal}` : 'no signal';
        const reason = `Process exited with code ${exitCode}, ${signalName}`;

        logger.error(`PTY crashed for ${sessionId}`, {
          sessionId,
          exitCode,
          signal,
          lastActivity: session.lastActivity
        });

        // Update session status to error
        await sessionManager.updateSessionStatus(sessionId, 'error', reason);

        // Story 2.9 AC #2: Send terminal.exit WebSocket message
        broadcastTerminalExit(sessionId, exitCode, signal);

        // Note: broadcastSessionStatus is called automatically by sessionManager.updateSessionStatus
        // via the status update callback registered below
      }
    } catch (error) {
      logger.error('Failed to update session status on PTY exit', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Clean up session data (but keep session in SessionManager for restart)
    const session = activeSessions.get(sessionId);
    if (session) {
      // Don't send error message - we're using terminal.exit and session.status messages instead
    }

    // Story 2.11: Unregister PTY process when it exits
    ptyManager.unregisterPtyProcess(sessionId);

    // Remove from activeSessions but DON'T delete from SessionManager
    // Session stays in 'error' state and can be resumed
    activeSessions.delete(sessionId);

    // Clear output buffer timer if exists
    const buffer = outputBuffers.get(sessionId);
    if (buffer?.timer) {
      clearTimeout(buffer.timer);
    }
    outputBuffers.delete(sessionId);

    // Don't clear output history - keep it for when session is resumed
    // sessionOutputHistory.delete(sessionId); // Commented out

    logger.info('Session cleaned up after PTY exit (session kept in error state for restart)', { sessionId });
  });

  logger.info('PTY output streaming configured', { sessionId, pid: ptyProcess.pid });
}

/**
 * Handle terminal input message from WebSocket client
 * Writes data to PTY stdin
 *
 * Story 1.4: AC #4 - PTY Input Handling
 *
 * @param ws WebSocket connection
 * @param message Terminal input message
 */
function handleTerminalInput(ws: WebSocket, message: TerminalInputMessage): void {
  const { sessionId, data } = message;

  // Validate session exists
  const session = activeSessions.get(sessionId);
  if (!session) {
    logger.warn('Terminal input for non-existent session', { sessionId });
    sendError(ws, 'Session not found', 'SESSION_NOT_FOUND', sessionId);
    return;
  }

  // Validate PTY process exists
  if (!session.ptyProcess) {
    logger.error('Session has no PTY process', { sessionId });
    sendError(ws, 'PTY process not available', 'PTY_NOT_FOUND', sessionId);
    return;
  }

  logger.info('Terminal input received', { sessionId, bytes: data.length, data: data.substring(0, 50) });

  // Write to PTY stdin (AC #4)
  try {
    ptyManager.write(session.ptyProcess, data);
    logger.info('Data written to PTY', { sessionId, bytes: data.length });
  } catch (error) {
    logger.error('Failed to write to PTY stdin', {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    sendError(ws, 'Failed to write to PTY', 'PTY_WRITE_ERROR', sessionId);
    return;
  }

  // Update session activity
  session.lastActivity = new Date();
}

/**
 * Handle terminal interrupt message from WebSocket client
 * Sends SIGINT to PTY process (Ctrl+C)
 *
 * Story 1.4: AC #4 - PTY Input Handling (interrupt signal)
 *
 * @param ws WebSocket connection
 * @param message Terminal interrupt message
 */
function handleTerminalInterrupt(ws: WebSocket, message: TerminalInterruptMessage): void {
  const { sessionId } = message;

  // Validate session exists
  const session = activeSessions.get(sessionId);
  if (!session) {
    logger.warn('Terminal interrupt for non-existent session', { sessionId });
    sendError(ws, 'Session not found', 'SESSION_NOT_FOUND', sessionId);
    return;
  }

  // Validate PTY process exists
  if (!session.ptyProcess) {
    logger.error('Session has no PTY process', { sessionId });
    sendError(ws, 'PTY process not available', 'PTY_NOT_FOUND', sessionId);
    return;
  }

  logger.info('Terminal interrupt received', { sessionId });

  // Send ESC character to PTY process to interrupt Claude CLI
  // Claude CLI uses ESC to interrupt current operation, not SIGINT
  try {
    ptyManager.write(session.ptyProcess, '\x1b');
    logger.info('ESC character sent to PTY', { sessionId });
  } catch (error) {
    logger.error('Failed to send ESC to PTY', {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    sendError(ws, 'Failed to interrupt PTY', 'PTY_INTERRUPT_ERROR', sessionId);
    return;
  }

  // Update session activity
  session.lastActivity = new Date();
}

/**
 * Handle terminal resize message from WebSocket client
 * Updates PTY dimensions when browser window/panel resizes
 *
 * @param ws WebSocket connection
 * @param message Terminal resize message with cols and rows
 */
function handleTerminalResize(ws: WebSocket, message: TerminalResizeMessage): void {
  const { sessionId, cols, rows } = message;

  // Validate session exists
  const session = activeSessions.get(sessionId);
  if (!session) {
    logger.warn('Terminal resize for non-existent session', { sessionId });
    sendError(ws, 'Session not found', 'SESSION_NOT_FOUND', sessionId);
    return;
  }

  // Validate PTY process exists
  if (!session.ptyProcess) {
    logger.debug('Session has no PTY process, skipping resize', { sessionId });
    return;
  }

  // Validate dimensions are reasonable
  if (cols < 1 || cols > 500 || rows < 1 || rows > 200) {
    logger.warn('Invalid terminal dimensions', { sessionId, cols, rows });
    return;
  }

  logger.debug('Terminal resize received', { sessionId, cols, rows });

  // Resize PTY process
  try {
    ptyManager.resize(session.ptyProcess, cols, rows);
  } catch (error) {
    logger.error('Failed to resize PTY', {
      sessionId,
      cols,
      rows,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handle session attach message from WebSocket client
 * Story 2.6: Subscribe WebSocket to session output
 * Story 4.6: Start backpressure monitoring
 * Story 4.16: Auto-spawn PTY if session was restored without one (container restart)
 *
 * @param ws WebSocket connection
 * @param message Session attach message
 */
async function handleSessionAttach(ws: WebSocket, message: SessionAttachMessage): Promise<void> {
  const { sessionId } = message;

  // Validate session exists in activeSessions or sessionManager
  let session = activeSessions.get(sessionId);

  // Story 4.16: Check if session exists in sessionManager but not in activeSessions
  // This happens after container restart when sessions are restored from JSON
  if (!session) {
    const managedSession = sessionManager.getSession(sessionId);
    if (!managedSession) {
      logger.warn('Session attach for non-existent session', { sessionId });
      sendError(ws, 'Session not found', 'SESSION_NOT_FOUND', sessionId);
      return;
    }

    // Session exists in sessionManager but has no PTY - need to spawn one
    logger.info('Session exists but has no PTY, auto-spawning', { sessionId, name: managedSession.name, currentStatus: managedSession.status });

    try {
      // Story 4.16: If session status is 'active' but no PTY exists (stale status from before restart),
      // update to 'idle' first so resumeSession() will accept it
      if (managedSession.status === 'active') {
        logger.info('Session has stale active status (no PTY), updating to idle', { sessionId });
        await sessionManager.updateSessionStatus(sessionId, 'idle', 'Container restart - no PTY running');
      }

      // Create PTY process reference to store the spawned process
      const ptyProcessRef = { ptyProcess: null as any };

      // Resume session via SessionManager (spawns PTY, updates status)
      await sessionManager.resumeSession(sessionId, ptyProcessRef);

      // Wire up PTY output streaming
      if (ptyProcessRef.ptyProcess) {
        setupPtyOutputStreaming(sessionId, ptyProcessRef.ptyProcess);

        // Store PTY process in activeSessions
        const sessionData: SessionData = {
          sessionId,
          connectionId: '',
          ptyProcess: ptyProcessRef.ptyProcess,
          createdAt: new Date(managedSession.createdAt),
          lastActivity: new Date(managedSession.lastActivity)
        };
        activeSessions.set(sessionId, sessionData);
        session = sessionData;

        logger.info('Auto-spawned PTY for restored session', {
          sessionId,
          name: managedSession.name,
          ptyPid: ptyProcessRef.ptyProcess.pid
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to auto-spawn PTY for session', {
        sessionId,
        error: errorMessage
      });
      sendError(ws, `Failed to spawn terminal: ${errorMessage}`, 'PTY_SPAWN_ERROR', sessionId);
      return;
    }
  }

  // Story 4.16: Also check if session exists but PTY is not running
  if (session && !session.ptyProcess) {
    const managedSession = sessionManager.getSession(sessionId);
    if (managedSession) {
      logger.info('Session has no PTY process, auto-spawning', { sessionId, currentStatus: managedSession.status });

      try {
        // Story 4.16: If session status is 'active' but no PTY exists, update to 'idle' first
        if (managedSession.status === 'active') {
          logger.info('Session has stale active status (no PTY), updating to idle', { sessionId });
          await sessionManager.updateSessionStatus(sessionId, 'idle', 'No PTY process running');
        }

        const ptyProcessRef = { ptyProcess: null as any };
        await sessionManager.resumeSession(sessionId, ptyProcessRef);

        if (ptyProcessRef.ptyProcess) {
          setupPtyOutputStreaming(sessionId, ptyProcessRef.ptyProcess);
          session.ptyProcess = ptyProcessRef.ptyProcess;

          logger.info('Auto-spawned PTY for session without process', {
            sessionId,
            ptyPid: ptyProcessRef.ptyProcess.pid
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to auto-spawn PTY', { sessionId, error: errorMessage });
        sendError(ws, `Failed to spawn terminal: ${errorMessage}`, 'PTY_SPAWN_ERROR', sessionId);
        return;
      }
    }
  }

  // Add WebSocket to client subscriptions
  if (!clientSubscriptions.has(ws)) {
    clientSubscriptions.set(ws, new Set());
  }
  clientSubscriptions.get(ws)!.add(sessionId);

  // Add WebSocket to session subscribers
  if (!sessionSubscribers.has(sessionId)) {
    sessionSubscribers.set(sessionId, new Set());
  }
  sessionSubscribers.get(sessionId)!.add(ws);

  // Story 4.6 AC #6: Start backpressure monitoring per session
  if (session && session.ptyProcess) {
    backpressureMonitor.startMonitoring(sessionId, ws, session.ptyProcess);
  }

  logger.info('Session attached', {
    sessionId,
    subscriberCount: sessionSubscribers.get(sessionId)!.size,
    hasPty: !!(session && session.ptyProcess)
  });

  // Send confirmation message
  if (ws.readyState === WebSocket.OPEN) {
    const confirmMessage: SessionAttachedMessage = {
      type: 'session.attached',
      sessionId
    };
    ws.send(JSON.stringify(confirmMessage));
  }

  // Replay output history to newly attached client
  const history = sessionOutputHistory.get(sessionId);
  if (history && ws.readyState === WebSocket.OPEN) {
    const replayMessage: TerminalOutputMessage = {
      type: 'terminal.output',
      sessionId,
      data: history
    };
    ws.send(JSON.stringify(replayMessage));
    logger.info('Replayed terminal history to attached client', {
      sessionId,
      bytes: history.length
    });
  }

  // Story 2.8: Flush disconnect buffer if it exists
  const disconnectBuffer = sessionDisconnectBuffers.get(sessionId);
  if (disconnectBuffer && ws.readyState === WebSocket.OPEN) {
    const bufferMessage: TerminalOutputMessage = {
      type: 'terminal.output',
      sessionId,
      data: disconnectBuffer
    };
    ws.send(JSON.stringify(bufferMessage));
    logger.info('Flushed disconnect buffer to reconnected client', {
      sessionId,
      bytes: disconnectBuffer.length
    });

    // Clear the disconnect buffer after flushing
    sessionDisconnectBuffers.delete(sessionId);

    // Also add to history for future reconnections
    let updatedHistory = sessionOutputHistory.get(sessionId) || '';
    updatedHistory += disconnectBuffer;
    if (updatedHistory.length > MAX_OUTPUT_HISTORY_SIZE) {
      updatedHistory = updatedHistory.slice(-MAX_OUTPUT_HISTORY_SIZE);
    }
    sessionOutputHistory.set(sessionId, updatedHistory);
  }
}

/**
 * Handle session detach message from WebSocket client
 * Story 2.6: Unsubscribe WebSocket from session output
 * Story 4.6: Stop backpressure monitoring if no more subscribers
 *
 * @param ws WebSocket connection
 * @param message Session detach message
 */
function handleSessionDetach(ws: WebSocket, message: SessionDetachMessage): void {
  const { sessionId } = message;

  // Remove sessionId from client subscriptions
  const clientSessions = clientSubscriptions.get(ws);
  if (clientSessions) {
    clientSessions.delete(sessionId);
    if (clientSessions.size === 0) {
      clientSubscriptions.delete(ws);
    }
  }

  // Remove WebSocket from session subscribers
  const subscribers = sessionSubscribers.get(sessionId);
  if (subscribers) {
    // Capture size BEFORE deletion to avoid race condition in logging
    const subscriberCountBeforeDeletion = subscribers.size;
    subscribers.delete(ws);

    // Story 4.6: Stop backpressure monitoring if no more subscribers
    if (subscribers.size === 0) {
      sessionSubscribers.delete(sessionId);
      backpressureMonitor.stopMonitoring(sessionId);
    }

    logger.info('Session detached', {
      sessionId,
      remainingSubscribers: subscribers.size,
      subscriberCountBeforeDeletion
    });
  } else {
    logger.info('Session detached', {
      sessionId,
      remainingSubscribers: 0
    });
  }
}

/**
 * Handle session resume message from WebSocket client
 * Story 2.10: Manual resume functionality via WebSocket
 * Story 2.10 Task 3.1-3.4: Resume idle session, spawn PTY, update status
 *
 * @param ws WebSocket connection
 * @param message Session resume message
 */
async function handleSessionResume(ws: WebSocket, message: SessionResumeMessage): Promise<void> {
  const { sessionId } = message;

  logger.info('Session resume requested', { sessionId });

  try {
    // Create PTY process reference to store the spawned process
    const ptyProcessRef = { ptyProcess: null as any };

    // Resume session via SessionManager (spawns PTY, updates status)
    await sessionManager.resumeSession(sessionId, ptyProcessRef);

    // Get the resumed session
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found after resume: ${sessionId}`);
    }

    // Wire up PTY output streaming
    if (ptyProcessRef.ptyProcess) {
      setupPtyOutputStreaming(sessionId, ptyProcessRef.ptyProcess);

      // Store PTY process in activeSessions for Epic 1 compatibility
      // This ensures existing session management code continues to work
      const sessionData: SessionData = {
        sessionId,
        connectionId: '', // Will be updated by Epic 1 single-session logic
        ptyProcess: ptyProcessRef.ptyProcess,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity)
      };
      activeSessions.set(sessionId, sessionData);
    }

    // Send session.status update to client
    if (ws.readyState === WebSocket.OPEN) {
      // Calculate if session is stuck
      const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();
      const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
      const isStuck = timeSinceActivity > STUCK_THRESHOLD_MS;

      const statusMessage: SessionStatusMessage = {
        type: 'session.status',
        sessionId,
        status: session.status,
        lastActivity: session.lastActivity,
        isStuck
      };
      ws.send(JSON.stringify(statusMessage));
      logger.info('Session status update sent to client', {
        sessionId,
        status: session.status,
        lastActivity: session.lastActivity,
        isStuck
      });
    }

    logger.info('Session resumed successfully', {
      sessionId,
      name: session.name,
      status: session.status,
      ptyPid: session.ptyPid
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to resume session', {
      sessionId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    sendError(ws, `Failed to resume session: ${errorMessage}`, 'SESSION_RESUME_ERROR', sessionId);
  }
}

// WebSocket connection handler (AC4)
wss.on('connection', (ws: WebSocket) => {
  // Story 4.7 AC #8: Reject new connections during shutdown
  if (shutdownManager && shutdownManager.isShutdown) {
    logger.warn('Rejecting new WebSocket connection - server shutting down');
    ws.close(1001, 'Server shutting down');
    return;
  }

  const connectionId = uuidv4();
  activeConnections.set(connectionId, ws);

  logger.info('WebSocket connection established', { connectionId });

  // Epic 1: Create default session if it doesn't exist
  // This ensures Claude CLI is ready when the first client connects
  if (!activeSessions.has(DEFAULT_SESSION_ID)) {
    try {
      createSession(DEFAULT_SESSION_ID, connectionId);
    } catch (error) {
      logger.error('Failed to create default session', {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      sendError(ws, 'Failed to start Claude CLI session', 'SESSION_CREATE_ERROR');
    }
  } else {
    // Update existing session's connection ID (reconnection case)
    const existingSession = activeSessions.get(DEFAULT_SESSION_ID);
    if (existingSession) {
      existingSession.connectionId = connectionId;
      logger.info('Reconnected to existing session', {
        sessionId: DEFAULT_SESSION_ID,
        connectionId
      });

      // Replay output history to new connection
      const history = sessionOutputHistory.get(DEFAULT_SESSION_ID);
      if (history && ws.readyState === WebSocket.OPEN) {
        const replayMessage: TerminalOutputMessage = {
          type: 'terminal.output',
          sessionId: DEFAULT_SESSION_ID,
          data: history
        };
        ws.send(JSON.stringify(replayMessage));
        logger.info('Replayed terminal history to reconnected client', {
          sessionId: DEFAULT_SESSION_ID,
          connectionId,
          bytes: history.length
        });
      }
    }
  }

  // Heartbeat mechanism (AC5)
  const heartbeatTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      }));
    }
  }, HEARTBEAT_INTERVAL);

  // WebSocket message handler
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Validate message structure
      if (!validateMessage(message)) {
        logger.warn('Invalid message format', { connectionId });
        sendError(ws, 'Invalid message format', 'INVALID_MESSAGE');
        return;
      }

      logger.debug('WebSocket message received', { connectionId, type: message.type });

      // Route message based on type
      const messageType = message.type;
      switch (messageType) {
        case 'heartbeat':
          // Client heartbeat received, no action needed
          break;

        case 'terminal.input':
          handleTerminalInput(ws, message as TerminalInputMessage);
          break;

        case 'terminal.interrupt':
          handleTerminalInterrupt(ws, message as TerminalInterruptMessage);
          break;

        case 'terminal.resize':
          handleTerminalResize(ws, message as TerminalResizeMessage);
          break;

        case 'session.attach':
          handleSessionAttach(ws, message as SessionAttachMessage);
          break;

        case 'session.detach':
          handleSessionDetach(ws, message as SessionDetachMessage);
          break;

        case 'session.resume':
          handleSessionResume(ws, message as SessionResumeMessage);
          break;

        default:
          logger.warn('Unknown message type', { connectionId, type: messageType });
          sendError(ws, `Unknown message type: ${messageType}`, 'UNKNOWN_MESSAGE_TYPE');
      }
    } catch (error) {
      logger.error('WebSocket message parse error', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendError(ws, 'Failed to parse message', 'PARSE_ERROR');
    }
  });

  // WebSocket error handler (Task 5)
  ws.on('error', (error: Error) => {
    logger.error('WebSocket error', {
      connectionId,
      error: error.message,
      stack: error.stack
    });
  });

  // WebSocket close handler
  ws.on('close', (code: number, reason: Buffer) => {
    logger.info('WebSocket connection closed', {
      connectionId,
      code,
      reason: reason.toString()
    });
    clearInterval(heartbeatTimer);
    activeConnections.delete(connectionId);

    // Story 2.6: Clean up all session subscriptions for this WebSocket
    const subscribedSessions = clientSubscriptions.get(ws);
    if (subscribedSessions) {
      const sessionCount = subscribedSessions.size;
      const sessionIds = Array.from(subscribedSessions);
      for (const sessionId of sessionIds) {
        // Remove WebSocket from session subscribers
        const subscribers = sessionSubscribers.get(sessionId);
        if (subscribers) {
          subscribers.delete(ws);
          // Story 4.6: Stop backpressure monitoring if no more subscribers
          if (subscribers.size === 0) {
            sessionSubscribers.delete(sessionId);
            backpressureMonitor.stopMonitoring(sessionId);
          }
        }
      }
      clientSubscriptions.delete(ws);
      logger.info('Cleaned up session subscriptions on disconnect', {
        connectionId,
        sessionCount
      });
    }

    // Check if any sessions are still associated with this connection
    // Note: Don't terminate PTY if session has been reassigned to a new connection
    const sessionEntries = Array.from(activeSessions.entries());
    for (const [sessionId, session] of sessionEntries) {
      if (session.connectionId === connectionId) {
        // Check if this is the default session - keep it alive for reconnection
        if (sessionId === DEFAULT_SESSION_ID) {
          logger.info('Connection closed but keeping default session alive for reconnection', {
            sessionId,
            connectionId
          });
          // Don't clean up the session or PTY - keep it running for reconnection
          continue;
        }

        // For non-default sessions, clean up as before
        logger.info('Cleaning up session on connection close', { sessionId });

        // Clear output buffer if exists
        const buffer = outputBuffers.get(sessionId);
        if (buffer?.timer) {
          clearTimeout(buffer.timer);
        }
        outputBuffers.delete(sessionId);

        // Clear output history
        sessionOutputHistory.delete(sessionId);

        // Clear disconnect buffer
        sessionDisconnectBuffers.delete(sessionId);

        // Terminate PTY process (AC #5 - cleanup)
        if (session.ptyProcess) {
          try {
            logger.info('Terminating PTY process on connection close', {
              sessionId,
              pid: session.ptyProcess.pid
            });
            // Story 2.11: Unregister PTY process before killing
            ptyManager.unregisterPtyProcess(sessionId);
            ptyManager.kill(session.ptyProcess, 'SIGTERM');
          } catch (error) {
            logger.error('Failed to terminate PTY process', {
              sessionId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        activeSessions.delete(sessionId);
      }
    }
  });
});

// WebSocket server error handler (Task 5)
wss.on('error', (error: Error) => {
  logger.error('WebSocket server error', {
    error: error.message,
    stack: error.stack
  });
});

// Story 4.7: Graceful shutdown manager instance
// Will be initialized after server starts
let shutdownManager: ReturnType<typeof createShutdownManager> | null = null;

// Story 4.8: Resource monitor and zombie cleanup instances
// Will be initialized after server starts
let resourceMonitor: ReturnType<typeof createResourceMonitor> | null = null;
let zombieCleanup: ReturnType<typeof createZombieCleanup> | null = null;

// Unhandled exception handler (Task 5)
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  if (shutdownManager) {
    shutdownManager.initiate();
  } else {
    process.exit(1);
  }
});

// Unhandled rejection handler (Task 5)
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
  if (shutdownManager) {
    shutdownManager.initiate();
  } else {
    process.exit(1);
  }
});

// Start HTTP server (AC1)
httpServer.listen(PORT, HOST, async () => {
  logger.info('Server listening on port 3000', {
    port: PORT,
    host: HOST,
    nodeEnv: process.env.NODE_ENV || 'development',
    claudePermissionMode: process.env.CLAUDE_PERMISSION_MODE || 'default'
  });

  // Story 1.11: Log Claude CLI approval configuration on startup
  const permissionMode = process.env.CLAUDE_PERMISSION_MODE || 'default';
  if (permissionMode === 'bypassPermissions') {
    logger.info('Claude CLI approval mode: unrestricted (all tools safe in container)', {
      mode: permissionMode,
      security: 'Container isolation ensures host safety'
    });
  } else {
    logger.warn('Claude CLI approval mode: restricted (manual approvals required)', {
      mode: permissionMode,
      recommendation: 'Set CLAUDE_PERMISSION_MODE=bypassPermissions for autonomous execution'
    });
  }

  // Story 2.9: Register session status update callback BEFORE loading sessions
  // This prevents race conditions where sessions are loaded before the callback is registered
  sessionManager.setStatusUpdateCallback((sessionId, status, reason) => {
    broadcastSessionStatus(sessionId, status, reason);

    // Story 4.17: Also broadcast full session object for cross-tab sync
    const session = sessionManager.getSession(sessionId);
    if (session) {
      broadcastSessionUpdated(session);
    }
  });

  // Story 2.11: Wire up PTYManager zombie cleanup with SessionManager
  // Set callback for PTYManager to get active session IDs
  ptyManager.setSessionCallback(() => {
    return sessionManager.getAllSessions().map(s => s.id);
  });

  // Story 2.11: Start zombie process cleanup timer
  ptyManager.startZombieCleanup();
  logger.info('Zombie process cleanup timer started');

  // Story 3.4: Start file watcher and register WebSocket handler
  fileWatcher.start();
  fileWatcher.onFileChange((message) => {
    // Broadcast file.changed message to all active connections
    const messageJson = JSON.stringify(message);
    for (const ws of activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageJson);
      }
    }
  });

  // Story 3.6: Register layout shift handler
  fileWatcher.onLayoutShift((message) => {
    // Broadcast layout.shift message to all active connections
    const messageJson = JSON.stringify(message);
    for (const ws of activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageJson);
      }
    }
  });

  // Story 3.1: Register workflow update handler
  fileWatcher.onWorkflowUpdate((workflow) => {
    // Broadcast workflow.updated message to all active connections
    const message = {
      type: 'workflow.updated',
      workflow
    };
    const messageJson = JSON.stringify(message);
    logger.info('Broadcasting workflow.updated to clients', {
      currentStep: workflow.currentStep,
      stepsCount: workflow.steps.length,
      clientCount: activeConnections.size
    });
    for (const ws of activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageJson);
      }
    }
  });

  // Story 3.1: Load initial workflow status and broadcast to connected clients
  await fileWatcher.loadInitialWorkflowStatus();

  // Story 6.1: Register sprint update handler
  fileWatcher.onSprintUpdate((sprintStatus, changedStories) => {
    // Broadcast sprint.updated message to all active connections
    const message = {
      type: 'sprint.updated',
      sprintStatus,
      changedStories
    };
    const messageJson = JSON.stringify(message);
    logger.info('Broadcasting sprint.updated to clients', {
      currentEpic: sprintStatus.currentEpic,
      currentStory: sprintStatus.currentStory,
      changedStoriesCount: changedStories.length,
      clientCount: activeConnections.size
    });
    for (const ws of activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageJson);
      }
    }
  });

  // Story 5.1: Register git status update handler
  fileWatcher.onGitStatusUpdate((message) => {
    // Broadcast git.status.updated message to all active connections
    const messageJson = JSON.stringify(message);
    logger.debug('Broadcasting git.status.updated to clients', {
      sessionId: message.sessionId,
      branch: message.status.branch,
      clientCount: activeConnections.size
    });
    for (const ws of activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageJson);
      }
    }
  });

  // Story 5.4: Register artifact update handler
  fileWatcher.onArtifactUpdate((message) => {
    // Broadcast artifact.updated message to all active connections
    const messageJson = JSON.stringify(message);
    logger.debug('Broadcasting artifact.updated to clients', {
      sessionId: message.sessionId,
      storyId: message.storyId,
      artifactPath: message.artifact.path,
      clientCount: activeConnections.size
    });
    for (const ws of activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageJson);
      }
    }
  });

  logger.info('File watcher started');

  // Story 4.1: Initialize and start StatusChecker
  const statusChecker = new StatusChecker(sessionManager, (message) => {
    // Broadcast status messages to session subscribers
    const messageJson = JSON.stringify(message);
    const subscribers = sessionSubscribers.get(message.sessionId);
    if (subscribers) {
      for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageJson);
        }
      }
    }
  });
  statusChecker.start();
  logger.info('StatusChecker started');

  // Story 2.1: Load sessions from persistence file on startup
  // Callback must be registered BEFORE this to avoid race conditions
  try {
    // First, prune any orphaned worktrees (git worktrees without corresponding directories)
    try {
      const prunedCount = await worktreeManager.pruneOrphanedWorktrees();
      if (prunedCount > 0) {
        logger.info('Pruned orphaned worktrees on startup', { prunedCount });
      }
    } catch (pruneError) {
      logger.warn('Failed to prune orphaned worktrees', {
        error: pruneError instanceof Error ? pruneError.message : String(pruneError)
      });
      // Continue with session loading even if prune fails
    }

    await sessionManager.loadSessions();
    const sessions = sessionManager.getAllSessions();
    logger.info('Session restoration complete', {
      sessionCount: sessions.length,
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        branch: s.branch
      }))
    });
  } catch (error) {
    logger.error('Failed to load sessions on startup', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Continue server startup even if session loading fails
  }

  // Story 4.7: Initialize shutdown manager and register signal handlers
  shutdownManager = createShutdownManager(httpServer, wss, sessionManager);

  // Story 4.8: Initialize resource monitor and zombie cleanup
  resourceMonitor = createResourceMonitor(wss, sessionManager);
  resourceMonitor.startMonitoring();
  logger.info('Resource monitor started');

  zombieCleanup = createZombieCleanup(sessionManager);
  zombieCleanup.startCleanup();
  logger.info('Zombie cleanup started');

  // Story 4.7 AC #7: Register SIGTERM handler
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal');
    // Story 4.8: Stop resource monitor and zombie cleanup
    if (resourceMonitor) {
      resourceMonitor.stopMonitoring();
    }
    if (zombieCleanup) {
      zombieCleanup.stopCleanup();
    }
    if (shutdownManager) {
      shutdownManager.initiate();
    }
  });

  // Story 4.7 AC #7: Register SIGINT handler (for Ctrl+C in development)
  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal');
    // Story 4.8: Stop resource monitor and zombie cleanup
    if (resourceMonitor) {
      resourceMonitor.stopMonitoring();
    }
    if (zombieCleanup) {
      zombieCleanup.stopCleanup();
    }
    if (shutdownManager) {
      shutdownManager.initiate();
    }
  });

  logger.info('Shutdown manager, resource monitor, and zombie cleanup initialized');
});

// Export server instances and helper functions for testing and integration
export {
  app,
  httpServer,
  wss,
  bufferTerminalOutput,
  setupPtyOutputStreaming,
  createSession,
  activeSessions,
  outputBuffers,
  DEFAULT_SESSION_ID,
  sessionManager,
  clientSubscriptions,
  sessionSubscribers,
  broadcast
};
