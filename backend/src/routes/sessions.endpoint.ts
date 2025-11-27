// Story 2.3: Session creation REST endpoint
// POST /api/sessions - Create a new session with worktree and PTY

import { Request, Response } from 'express';
import { sessionManager, MaxSessionsError, InvalidSessionNameError } from '../sessionManager';
import { ptyManager } from '../ptyManager';
import { logger } from '../utils/logger';
import { SessionData } from '../types';

/**
 * Handler for POST /api/sessions endpoint
 * Creates a new session with git worktree and PTY process
 */
export async function createSessionHandler(
  req: Request,
  res: Response,
  activeSessions: Map<string, SessionData>,
  setupPtyOutputStreaming: (sessionId: string, ptyProcess: any) => void
): Promise<void> {
  try {
    const { name, branch } = req.body;

    logger.info('Session creation request received', { name, branch });

    // Validate request body
    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({
        error: 'Invalid session name type',
        code: 'INVALID_REQUEST'
      });
      return;
    }

    if (branch !== undefined && typeof branch !== 'string') {
      res.status(400).json({
        error: 'Invalid branch name type',
        code: 'INVALID_REQUEST'
      });
      return;
    }

    // Create session via sessionManager
    // This will:
    // 1. Validate session name
    // 2. Create git worktree
    // 3. Spawn PTY process
    // 4. Persist to JSON
    const session = await sessionManager.createSession(name, branch);

    // Set up PTY output streaming for the new session
    // Get PTY process from ptyManager (it was already spawned in createSession)
    const allPtyProcesses = (ptyManager as any).processes;
    let ptyProcess = null;

    // Find the PTY process by PID
    if (allPtyProcesses && session.ptyPid) {
      for (const [, proc] of allPtyProcesses) {
        if (proc.pid === session.ptyPid) {
          ptyProcess = proc;
          break;
        }
      }
    }

    if (ptyProcess) {
      // Create session data entry
      const newSessionData: SessionData = {
        sessionId: session.id,
        connectionId: '', // Will be set when client attaches
        ptyProcess,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity)
      };

      activeSessions.set(session.id, newSessionData);
      setupPtyOutputStreaming(session.id, ptyProcess);
    }

    logger.info('Session created successfully', {
      sessionId: session.id,
      name: session.name,
      branch: session.branch
    });

    // Return session object
    res.status(200).json({ session });
  } catch (error) {
    // Handle specific error types with appropriate status codes
    if (error instanceof InvalidSessionNameError) {
      logger.warn('Session creation failed: invalid name', {
        error: error.message
      });
      res.status(400).json({
        error: error.message,
        code: error.code
      });
      return;
    }

    if (error instanceof MaxSessionsError) {
      logger.warn('Session creation failed: max sessions reached', {
        error: error.message
      });
      res.status(400).json({
        error: error.message,
        code: error.code
      });
      return;
    }

    // Handle branch already exists error
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.warn('Session creation failed: branch already exists', {
        error: error.message
      });
      res.status(409).json({
        error: error.message,
        code: 'BRANCH_EXISTS'
      });
      return;
    }

    // Generic error handling
    logger.error('Session creation failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      error: 'Failed to create session',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
