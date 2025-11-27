/**
 * Git Routes Module
 * Story 5.1: Git Status API Endpoints
 *
 * Provides REST API endpoints for git operations on session worktrees.
 *
 * Endpoints:
 * - GET /api/sessions/:sessionId/git/status - Get git status for session worktree
 */

import express, { Request, Response } from 'express';
import { promises as fs } from 'fs';
import { sessionManager } from '../sessionManager';
import {
  GitManager,
  GitNotInitializedError,
  GitCommandError,
  NothingToCommitError,
  GitAuthError,
  GitMergeConflictError,
  GitRemoteError,
  ValidationError
} from '../gitManager';
import { logger } from '../utils/logger';
import {
  GitStageRequest,
  GitStageResponse,
  GitUnstageRequest,
  GitUnstageResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitPushResponse,
  GitPullResponse,
  GitStatusUpdatedMessage
} from '../types';

const router = express.Router();

/**
 * Broadcast WebSocket message to all connected clients
 * Note: Uses dynamic require to avoid circular dependency
 * The broadcast function is exported from server.ts after initialization
 * @param message Message to broadcast
 */
function broadcastWebSocket(message: any): void {
  try {
    // Dynamic import to avoid circular dependency at module load time
    // This is safe because routes are registered after server initialization
    const { broadcast } = require('../server');
    if (typeof broadcast === 'function') {
      broadcast(message);
    } else {
      logger.warn('Broadcast function not available', { messageType: message.type });
    }
  } catch (error) {
    logger.error('Failed to load broadcast function', {
      messageType: message.type,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * GET /api/sessions/:sessionId/git/status
 * Story 5.1 AC #1, #3, #4, #5: Git status API endpoint
 *
 * Returns git status for a session's worktree in structured JSON format.
 *
 * Response:
 * - 200 OK: GitStatus object with branch, ahead/behind, and file arrays
 * - 400 Bad Request: Not a git repository or worktree doesn't exist
 * - 404 Not Found: Session doesn't exist
 * - 500 Internal Server Error: Git command failed
 */
router.get('/:sessionId/git/status', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const startTime = performance.now();

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git status requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', {
        sessionId,
        worktreePath
      });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Get git status
    const gitManager = new GitManager(worktreePath);
    const status = await gitManager.getStatus();
    const duration = performance.now() - startTime;

    // Log slow git status operations (>500ms)
    if (duration > 500) {
      const fileCount = status.staged.length + status.modified.length + status.untracked.length;
      logger.warn('Slow git status', {
        sessionId,
        duration: duration.toFixed(2),
        fileCount,
        branch: status.branch
      });
    }

    logger.info('Git status retrieved', {
      sessionId,
      branch: status.branch,
      ahead: status.ahead,
      behind: status.behind,
      stagedCount: status.staged.length,
      modifiedCount: status.modified.length,
      untrackedCount: status.untracked.length,
      duration: duration.toFixed(2)
    });

    return res.json(status);
  } catch (error: any) {
    // Story 5.1 AC #5: Return 400 for "not a git repository"
    if (error instanceof GitNotInitializedError) {
      logger.warn('Git not initialized', {
        sessionId,
        error: error.message
      });
      return res.status(400).json({
        error: 'Not a git repository',
        code: 'GIT_NOT_INITIALIZED'
      });
    }

    // Other git command errors
    if (error instanceof GitCommandError) {
      logger.error('Git status command failed', {
        sessionId,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git status failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git status endpoint', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/git/stage
 * Story 5.2 AC #1: Stage files for commit
 *
 * Request body: { files: string[] }
 * Response: { success: boolean, staged: string[] }
 */
router.post('/:sessionId/git/stage', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { files } = req.body as GitStageRequest;
  const startTime = performance.now();

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git stage requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', { sessionId, worktreePath });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Stage files
    const gitManager = new GitManager(worktreePath);
    const staged = await gitManager.stageFiles(files);
    const duration = performance.now() - startTime;

    logger.info('Git stage successful', {
      sessionId,
      fileCount: staged.length,
      duration: duration.toFixed(2)
    });

    // Broadcast git.status.updated to update UI immediately
    const updatedStatus = await gitManager.getStatus();
    const gitMessage: GitStatusUpdatedMessage = {
      type: 'git.status.updated',
      sessionId,
      status: updatedStatus
    };
    broadcastWebSocket(gitMessage);

    const response: GitStageResponse = {
      success: true,
      staged
    };
    return res.json(response);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        field: error.field
      });
    }

    if (error instanceof GitCommandError) {
      logger.error('Git stage command failed', {
        sessionId,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git stage failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git stage endpoint', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/git/unstage
 * Story 5.2 AC #2: Unstage files (keep working tree changes)
 *
 * Request body: { files: string[] }
 * Response: { success: boolean, unstaged: string[] }
 */
router.post('/:sessionId/git/unstage', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { files } = req.body as GitUnstageRequest;
  const startTime = performance.now();

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git unstage requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', { sessionId, worktreePath });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Unstage files
    const gitManager = new GitManager(worktreePath);
    const unstaged = await gitManager.unstageFiles(files);
    const duration = performance.now() - startTime;

    logger.info('Git unstage successful', {
      sessionId,
      fileCount: unstaged.length,
      duration: duration.toFixed(2)
    });

    // Broadcast git.status.updated to update UI immediately
    const updatedStatus = await gitManager.getStatus();
    const gitMessage: GitStatusUpdatedMessage = {
      type: 'git.status.updated',
      sessionId,
      status: updatedStatus
    };
    broadcastWebSocket(gitMessage);

    const response: GitUnstageResponse = {
      success: true,
      unstaged
    };
    return res.json(response);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        field: error.field
      });
    }

    if (error instanceof GitCommandError) {
      logger.error('Git unstage command failed', {
        sessionId,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git unstage failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git unstage endpoint', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/git/commit
 * Story 5.2 AC #3, #4: Commit staged files
 * Story 5.10: Clear artifact reviews for committed files
 *
 * Request body: { message: string }
 * Response: { success: boolean, commitHash: string, message: string }
 */
router.post('/:sessionId/git/commit', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { message } = req.body as GitCommitRequest;
  const startTime = performance.now();

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git commit requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', { sessionId, worktreePath });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Story 5.10: Get staged files before commit
    const gitManager = new GitManager(worktreePath);
    const statusBeforeCommit = await gitManager.getStatus();
    const stagedPaths = statusBeforeCommit.staged.map((f) => f.path);

    // Commit
    const result = await gitManager.commit(message);
    const duration = performance.now() - startTime;

    // Story 5.10: Clear artifact reviews for committed files
    if (stagedPaths.length > 0) {
      try {
        const { artifactReviewManager } = await import('../artifactReviewManager');
        await artifactReviewManager.clearReviews(sessionId, stagedPaths);
        logger.debug('Cleared artifact reviews after commit', {
          sessionId,
          fileCount: stagedPaths.length
        });
      } catch (clearError) {
        // Log error but don't fail the commit response
        logger.error('Failed to clear artifact reviews after commit', {
          sessionId,
          error: clearError instanceof Error ? clearError.message : String(clearError)
        });
      }
    }

    logger.info('Git commit successful', {
      sessionId,
      commitHash: result.commitHash,
      duration: duration.toFixed(2)
    });

    // Broadcast git.status.updated to update UI immediately
    const updatedStatus = await gitManager.getStatus();
    const gitMessage: GitStatusUpdatedMessage = {
      type: 'git.status.updated',
      sessionId,
      status: updatedStatus
    };
    broadcastWebSocket(gitMessage);

    const response: GitCommitResponse = {
      success: true,
      commitHash: result.commitHash,
      message: result.message
    };
    return res.json(response);
  } catch (error: any) {
    // Story 5.2 AC #4: Return 400 for "nothing to commit"
    if (error instanceof NothingToCommitError) {
      logger.warn('Git commit with nothing staged', { sessionId });
      return res.status(400).json({
        error: 'Nothing to commit',
        code: 'NOTHING_STAGED'
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
        field: error.field
      });
    }

    if (error instanceof GitCommandError) {
      logger.error('Git commit command failed', {
        sessionId,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git commit failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git commit endpoint', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/git/push
 * Story 5.2 AC #5, #7: Push to remote
 *
 * Request body: {}
 * Response: { success: boolean, pushed: boolean }
 */
router.post('/:sessionId/git/push', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const startTime = performance.now();

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git push requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', { sessionId, worktreePath });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Push
    const gitManager = new GitManager(worktreePath);
    await gitManager.push();
    const duration = performance.now() - startTime;

    logger.info('Git push successful', {
      sessionId,
      duration: duration.toFixed(2)
    });

    const response: GitPushResponse = {
      success: true,
      pushed: true
    };
    return res.json(response);
  } catch (error: any) {
    // Story 5.2 AC #7: Detailed error messages
    if (error instanceof GitAuthError) {
      return res.status(500).json({
        error: 'Git authentication failed',
        code: 'GIT_AUTH_FAILED',
        details: error.stderr
      });
    }

    if (error instanceof GitRemoteError) {
      return res.status(500).json({
        error: 'Git remote error',
        code: 'GIT_REMOTE_ERROR',
        details: error.stderr
      });
    }

    if (error instanceof GitCommandError) {
      logger.error('Git push command failed', {
        sessionId,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git push failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git push endpoint', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/git/pull
 * Story 5.2 AC #6, #7: Pull from remote
 *
 * Request body: {}
 * Response: { success: boolean, pulled: boolean, commits: number }
 */
router.post('/:sessionId/git/pull', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const startTime = performance.now();

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git pull requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', { sessionId, worktreePath });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Pull
    const gitManager = new GitManager(worktreePath);
    const result = await gitManager.pull();
    const duration = performance.now() - startTime;

    logger.info('Git pull successful', {
      sessionId,
      commits: result.commits,
      duration: duration.toFixed(2)
    });

    const response: GitPullResponse = {
      success: true,
      pulled: true,
      commits: result.commits
    };
    return res.json(response);
  } catch (error: any) {
    // Story 5.2 AC #7: Detailed error messages
    if (error instanceof GitAuthError) {
      return res.status(500).json({
        error: 'Git authentication failed',
        code: 'GIT_AUTH_FAILED',
        details: error.stderr
      });
    }

    if (error instanceof GitMergeConflictError) {
      return res.status(500).json({
        error: 'Merge conflict detected',
        code: 'GIT_MERGE_CONFLICT',
        conflicts: error.conflicts
      });
    }

    if (error instanceof GitRemoteError) {
      return res.status(500).json({
        error: 'Git remote error',
        code: 'GIT_REMOTE_ERROR',
        details: error.stderr
      });
    }

    if (error instanceof GitCommandError) {
      logger.error('Git pull command failed', {
        sessionId,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git pull failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git pull endpoint', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /api/sessions/:sessionId/git/show/:filePath(*)
 * Get file content at HEAD (last commit)
 * Used for Git diff comparison
 *
 * Response:
 * - 200 OK: { content: string } with file content at HEAD
 * - 200 OK: { content: null } if file is new (doesn't exist at HEAD)
 * - 404 Not Found: Session doesn't exist
 * - 400 Bad Request: Worktree not found or not a git repo
 * - 500 Internal Server Error: Git command failed
 */
router.get('/:sessionId/git/show/*', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  // Extract file path from URL - everything after /git/show/
  const filePath = req.params[0];
  const startTime = performance.now();

  try {
    if (!filePath) {
      return res.status(400).json({
        error: 'File path required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Git show requested for non-existent session', { sessionId });
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get worktree path
    const worktreePath = session.worktreePath;
    if (!worktreePath) {
      logger.warn('Session has no worktree path', { sessionId });
      return res.status(400).json({
        error: 'Session has no worktree',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Verify worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      logger.warn('Worktree path does not exist', { sessionId, worktreePath });
      return res.status(400).json({
        error: 'Worktree not found',
        code: 'WORKTREE_NOT_FOUND'
      });
    }

    // Get file content at HEAD
    const gitManager = new GitManager(worktreePath);
    const content = await gitManager.getFileAtHead(filePath);
    const duration = performance.now() - startTime;

    logger.info('Git show successful', {
      sessionId,
      filePath,
      hasContent: content !== null,
      duration: duration.toFixed(2)
    });

    return res.json({ content });
  } catch (error: any) {
    if (error instanceof GitNotInitializedError) {
      logger.warn('Git not initialized', {
        sessionId,
        error: error.message
      });
      return res.status(400).json({
        error: 'Not a git repository',
        code: 'GIT_NOT_INITIALIZED'
      });
    }

    if (error instanceof GitCommandError) {
      logger.error('Git show command failed', {
        sessionId,
        filePath,
        error: error.message,
        stderr: error.stderr
      });
      return res.status(500).json({
        error: 'Git show failed',
        code: 'GIT_COMMAND_FAILED',
        details: error.stderr
      });
    }

    // Unexpected errors
    logger.error('Unexpected error in git show endpoint', {
      sessionId,
      filePath,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

export default router;
