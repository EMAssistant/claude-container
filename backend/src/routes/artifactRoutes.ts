/**
 * Artifact Routes Module
 * Story 5.6: Approve Artifact with Auto-Stage
 *
 * Provides REST API endpoints for artifact approval operations.
 *
 * Endpoints:
 * - POST /api/sessions/:sessionId/artifacts/:path(*)/approve - Approve single artifact
 * - POST /api/sessions/:sessionId/artifacts/approve-batch - Approve multiple artifacts
 */

import express, { Request, Response } from 'express';
import * as path from 'path';
import { promises as fs } from 'fs';
import { sessionManager } from '../sessionManager';
import { artifactReviewManager } from '../artifactReviewManager';
import { GitManager } from '../gitManager';
import { ptyManager } from '../ptyManager';
import { logger } from '../utils/logger';
import { ArtifactInfo, ArtifactUpdatedMessage, GitStatusUpdatedMessage } from '../types';

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
 * POST /api/sessions/:sessionId/artifacts/approve-batch
 * Story 5.6 AC #4: Batch artifact approval endpoint
 *
 * Approves multiple artifacts and auto-stages them for git commit.
 *
 * IMPORTANT: This route MUST come before the wildcard routes (:path(*)/approve and :path(*)/request-changes)
 * because Express matches routes in order and wildcards would otherwise match "approve-batch".
 *
 * Request:
 * - { files: string[] } - Array of artifact paths (relative to worktree)
 *
 * Response:
 * - 200 OK: { success: true, approved: number, staged: number, files: string[] }
 * - 400 Bad Request: Invalid sessionId or paths
 * - 404 Not Found: Session not found
 * - 500 Internal Server Error: Approval or staging failed
 */
router.post('/:sessionId/artifacts/approve-batch', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { files } = req.body as { files: string[] };

  logger.info('Batch artifact approval requested', { sessionId, fileCount: files?.length });

  try {
    // Validate request body
    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: files array required',
        code: 'INVALID_REQUEST'
      });
      return;
    }

    // Story 5.6: Limit batch size to prevent DoS
    const MAX_BATCH_SIZE = 100;
    if (files.length > MAX_BATCH_SIZE) {
      res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} files`,
        code: 'BATCH_TOO_LARGE'
      });
      return;
    }

    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Batch approval for non-existent session', { sessionId });
      res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
      return;
    }

    const worktreeRoot = session.worktreePath;

    // Validate all paths are within worktree
    for (const filePath of files) {
      const fullPath = path.resolve(worktreeRoot, filePath);
      if (!fullPath.startsWith(worktreeRoot)) {
        logger.warn('Batch approval includes path outside worktree', {
          sessionId,
          filePath,
          worktreeRoot
        });
        res.status(400).json({
          success: false,
          error: `Invalid path: ${filePath} is outside worktree boundary`,
          code: 'INVALID_PATH'
        });
        return;
      }
    }

    // Story 5.6 AC #4: Update review status for all files
    const approvedArtifacts: ArtifactInfo[] = [];
    for (const filePath of files) {
      try {
        await artifactReviewManager.updateReviewStatus(sessionId, filePath, 'approved');

        const reviewEntry = session.artifactReviews?.[filePath];
        if (reviewEntry) {
          const artifact: ArtifactInfo = {
            name: path.basename(filePath),
            path: path.resolve(worktreeRoot, filePath),
            exists: true,
            icon: '📄',
            reviewStatus: reviewEntry.reviewStatus,
            modifiedBy: reviewEntry.modifiedBy,
            revision: reviewEntry.revision,
            lastModified: reviewEntry.lastModified
          };
          approvedArtifacts.push(artifact);

          // Story 5.6 AC #4: Broadcast individual artifact.updated for each
          const artifactMessage: ArtifactUpdatedMessage = {
            type: 'artifact.updated',
            sessionId,
            storyId: '',
            artifact
          };
          broadcastWebSocket(artifactMessage);
        }
      } catch (error) {
        logger.error('Failed to approve artifact in batch', {
          sessionId,
          filePath,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other files even if one fails
      }
    }

    // Story 5.6 AC #4: Batch stage all files (single git add operation)
    const gitManager = new GitManager(worktreeRoot);
    try {
      await gitManager.stageFiles(files);
      logger.info('Batch artifacts staged after approval', {
        sessionId,
        fileCount: files.length
      });
    } catch (error) {
      logger.error('Failed to stage artifacts in batch', {
        sessionId,
        fileCount: files.length,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: `Failed to stage files: ${error instanceof Error ? error.message : String(error)}`,
        code: 'GIT_STAGE_FAILED'
      });
      return;
    }

    // Story 5.6 AC #4: Broadcast git.status.updated
    const gitStatus = await gitManager.getStatus();
    const gitMessage: GitStatusUpdatedMessage = {
      type: 'git.status.updated',
      sessionId,
      status: gitStatus
    };
    broadcastWebSocket(gitMessage);

    logger.info('Batch artifact approval completed', {
      sessionId,
      approved: approvedArtifacts.length,
      staged: files.length
    });

    res.json({
      success: true,
      approved: approvedArtifacts.length,
      staged: files.length,
      files
    });
  } catch (error) {
    logger.error('Batch artifact approval failed', {
      sessionId,
      filesCount: files?.length,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/artifacts/:path(*)/approve
 * Story 5.6 AC #1, #8: Single artifact approval endpoint
 *
 * Approves an artifact and auto-stages it for git commit.
 *
 * Request:
 * - No body required, path parameter contains artifact path
 *
 * Response:
 * - 200 OK: { success: true, staged: true, artifact: ArtifactInfo }
 * - 400 Bad Request: Invalid sessionId or path outside worktree
 * - 404 Not Found: Session or artifact not found
 * - 500 Internal Server Error: Git stage or approval failed
 */
router.post('/:sessionId/artifacts/:path(*)/approve', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const artifactPath = req.params.path; // Captured by :path(*) wildcard

  logger.info('Artifact approval requested', { sessionId, artifactPath });

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Artifact approval for non-existent session', { sessionId });
      res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
      return;
    }

    // Validate path is within worktree
    const worktreeRoot = session.worktreePath;
    const fullPath = path.resolve(worktreeRoot, artifactPath);
    if (!fullPath.startsWith(worktreeRoot)) {
      logger.warn('Artifact approval for path outside worktree', {
        sessionId,
        artifactPath,
        worktreeRoot,
        fullPath
      });
      res.status(400).json({
        success: false,
        error: 'Invalid path: outside worktree boundary',
        code: 'INVALID_PATH'
      });
      return;
    }

    // Verify file exists
    try {
      await fs.access(fullPath);
    } catch {
      logger.warn('Artifact approval for non-existent file', {
        sessionId,
        artifactPath,
        fullPath
      });
      res.status(404).json({
        success: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
      return;
    }

    // Story 5.6 AC #8: Update review status to approved
    await artifactReviewManager.updateReviewStatus(sessionId, artifactPath, 'approved');

    // Story 5.6 AC #8: Auto-stage the file
    const gitManager = new GitManager(worktreeRoot);
    try {
      await gitManager.stageFiles([artifactPath]);
      logger.info('Artifact staged after approval', { sessionId, artifactPath });
    } catch (error) {
      logger.error('Failed to stage artifact after approval', {
        sessionId,
        artifactPath,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: `Failed to stage file: ${error instanceof Error ? error.message : String(error)}`,
        code: 'GIT_STAGE_FAILED'
      });
      return;
    }

    // Get updated artifact info
    // Note: artifactReviews may not exist if artifactReviewManager stores state separately
    // In that case, construct ArtifactInfo from available data
    const reviewEntry = session.artifactReviews?.[artifactPath];
    if (!reviewEntry) {
      logger.warn('Artifact review entry not found in session after approval', {
        sessionId,
        artifactPath,
        note: 'Using default values - artifact was approved successfully'
      });
      // Continue with default values since approval and staging succeeded
    }

    const artifact: ArtifactInfo = {
      name: path.basename(artifactPath),
      path: fullPath,
      exists: true,
      icon: '📄',
      reviewStatus: reviewEntry?.reviewStatus || 'approved',
      modifiedBy: reviewEntry?.modifiedBy || 'claude',
      revision: reviewEntry?.revision || 1,
      lastModified: reviewEntry?.lastModified || new Date().toISOString()
    };

    // Story 5.6 AC #8: Broadcast artifact.updated WebSocket message
    const artifactMessage: ArtifactUpdatedMessage = {
      type: 'artifact.updated',
      sessionId,
      storyId: '', // Story ID will be determined by frontend from sprint status
      artifact
    };
    broadcastWebSocket(artifactMessage);

    // Story 5.6 AC #8: Broadcast git.status.updated WebSocket message
    const gitStatus = await gitManager.getStatus();
    const gitMessage: GitStatusUpdatedMessage = {
      type: 'git.status.updated',
      sessionId,
      status: gitStatus
    };
    broadcastWebSocket(gitMessage);

    logger.info('Artifact approved and staged successfully', {
      sessionId,
      artifactPath,
      revision: reviewEntry?.revision || 1
    });

    res.json({
      success: true,
      staged: true,
      artifact
    });
  } catch (error) {
    logger.error('Artifact approval failed', {
      sessionId,
      artifactPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/artifacts/:path(*)/request-changes
 * Story 5.7 AC #3, #4, #8: Request changes endpoint
 *
 * Requests changes on an artifact and injects feedback into Claude's PTY stdin.
 *
 * Request:
 * - { feedback: string } - User feedback text (max 5000 chars)
 *
 * Response:
 * - 200 OK: { success: true, artifact: ArtifactInfo }
 * - 400 Bad Request: Invalid sessionId, path, or feedback
 * - 404 Not Found: Session or artifact not found
 * - 500 Internal Server Error: PTY injection or status update failed
 */
router.post('/:sessionId/artifacts/:path(*)/request-changes', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const artifactPath = req.params.path; // Captured by :path(*) wildcard
  const { feedback } = req.body as { feedback: string };

  logger.info('Request changes requested', { sessionId, artifactPath });

  try {
    // Story 5.7 AC #7: Validate feedback is non-empty
    if (!feedback || feedback.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Feedback cannot be empty',
        code: 'FEEDBACK_EMPTY'
      });
      return;
    }

    // Story 5.7 AC #7: Validate feedback length
    if (feedback.length > 5000) {
      res.status(400).json({
        success: false,
        error: 'Feedback must be under 5000 characters',
        code: 'FEEDBACK_TOO_LONG'
      });
      return;
    }

    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Request changes for non-existent session', { sessionId });
      res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
      return;
    }

    // Validate path is within worktree
    const worktreeRoot = session.worktreePath;
    const fullPath = path.resolve(worktreeRoot, artifactPath);
    if (!fullPath.startsWith(worktreeRoot)) {
      logger.warn('Request changes for path outside worktree', {
        sessionId,
        artifactPath,
        worktreeRoot,
        fullPath
      });
      res.status(400).json({
        success: false,
        error: 'Invalid path: outside worktree boundary',
        code: 'INVALID_PATH'
      });
      return;
    }

    // Verify file exists
    try {
      await fs.access(fullPath);
    } catch {
      logger.warn('Request changes for non-existent file', {
        sessionId,
        artifactPath,
        fullPath
      });
      res.status(404).json({
        success: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
      return;
    }

    // Story 5.7 AC #4: Update review status to changes-requested
    await artifactReviewManager.updateReviewStatus(sessionId, artifactPath, 'changes-requested', feedback);

    // Story 5.7 AC #3: Inject feedback into PTY stdin
    const message = `Please revise ${artifactPath}:\n${feedback}\n`;
    const ptyProcess = ptyManager.getPtyProcess(sessionId);

    if (!ptyProcess || !ptyProcess.write) {
      logger.error('PTY process not available for feedback injection', {
        sessionId,
        artifactPath,
        hasPtyProcess: !!ptyProcess,
        hasWrite: ptyProcess ? !!ptyProcess.write : false
      });
      res.status(500).json({
        success: false,
        error: 'PTY process not available',
        code: 'PTY_ERROR'
      });
      return;
    }

    // Write message to PTY stdin
    try {
      ptyProcess.write(message);
      logger.info('Feedback injected into PTY', { sessionId, artifactPath, feedbackLength: feedback.length });
    } catch (error) {
      logger.error('Failed to write to PTY', {
        sessionId,
        artifactPath,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to send message to PTY',
        code: 'PTY_WRITE_FAILED'
      });
      return;
    }

    // Get updated artifact info
    const reviewEntry = session.artifactReviews?.[artifactPath];
    if (!reviewEntry) {
      logger.warn('Artifact review entry not found after changes requested', {
        sessionId,
        artifactPath,
        note: 'Using default values - status was updated successfully'
      });
    }

    const artifact: ArtifactInfo = {
      name: path.basename(artifactPath),
      path: fullPath,
      exists: true,
      icon: '📄',
      reviewStatus: reviewEntry?.reviewStatus || 'changes-requested',
      modifiedBy: reviewEntry?.modifiedBy || 'claude',
      revision: reviewEntry?.revision || 1,
      lastModified: reviewEntry?.lastModified || new Date().toISOString()
    };

    // Story 5.7 AC #4: Broadcast artifact.updated WebSocket message
    const artifactMessage: ArtifactUpdatedMessage = {
      type: 'artifact.updated',
      sessionId,
      storyId: '', // Story ID will be determined by frontend from sprint status
      artifact
    };
    broadcastWebSocket(artifactMessage);

    logger.info('Request changes completed successfully', {
      sessionId,
      artifactPath,
      revision: reviewEntry?.revision || 1,
      feedbackLength: feedback.length
    });

    res.json({
      success: true,
      artifact
    });
  } catch (error) {
    logger.error('Request changes failed', {
      sessionId,
      artifactPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
