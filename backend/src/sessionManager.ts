/**
 * Session Manager Module
 * Story 2.1: Session Manager Module with State Persistence
 *
 * Manages multiple sessions with persistent state across container restarts.
 * Enforces maximum session limit (4 sessions), handles session lifecycle,
 * and persists session state to JSON file using atomic writes.
 *
 * Architecture: ADR-009 - Flat JSON File for Session Persistence
 */

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  Session,
  SessionStatus,
  SessionPersistence,
  SessionManagerOptions
} from './types';
import { atomicWriteJson } from './utils/atomicWrite';
import { logger, logSessionEvent, logSessionError } from './utils/logger';
import { worktreeManager } from './worktreeManager';
import { ptyManager } from './ptyManager';

/**
 * Maximum number of concurrent sessions (Design constraint per PRD NFR-SCALE-1)
 */
const MAX_SESSIONS = 4;

/**
 * Default workspace root path
 */
const DEFAULT_WORKSPACE_ROOT = '/workspace';

/**
 * Default session persistence file name
 */
const DEFAULT_PERSISTENCE_FILE = '.claude-container-sessions.json';

/**
 * Session persistence schema version
 */
const PERSISTENCE_VERSION = '1.0';

/**
 * Custom error class for MAX_SESSIONS limit
 */
export class MaxSessionsError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'MaxSessionsError';
    this.code = 'MAX_SESSIONS';
  }
}

/**
 * Custom error class for invalid session name
 */
export class InvalidSessionNameError extends Error {
  code: string;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidSessionNameError';
    this.code = 'INVALID_NAME';
  }
}

/**
 * Session name validation regex
 * Alphanumeric with dashes only, 1-50 characters
 */
const SESSION_NAME_REGEX = /^[a-zA-Z0-9-]{1,50}$/;

/**
 * SessionManager class
 *
 * Manages session lifecycle, persistence, and restoration
 * Story 2.1: Session Manager Module with State Persistence
 */
export class SessionManager {
  private sessions: Map<string, Session>;
  private workspaceRoot: string;
  private maxSessions: number;
  private persistencePath: string;
  private statusUpdateCallback?: (sessionId: string, status: SessionStatus, reason?: string) => void;

  /**
   * Create a new SessionManager instance
   *
   * @param options Configuration options
   */
  constructor(options?: Partial<SessionManagerOptions>) {
    this.sessions = new Map();
    this.workspaceRoot = options?.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
    this.maxSessions = options?.maxSessions || MAX_SESSIONS;
    this.persistencePath = options?.persistencePath ||
      path.join(this.workspaceRoot, DEFAULT_PERSISTENCE_FILE);

    logger.info('SessionManager initialized', {
      workspaceRoot: this.workspaceRoot,
      maxSessions: this.maxSessions,
      persistencePath: this.persistencePath
    });
  }

  /**
   * Register callback for session status updates
   * Story 2.9: Crash Isolation Between Sessions
   * Allows server.ts to receive status updates and broadcast via WebSocket
   *
   * @param callback Function to call when session status changes
   */
  setStatusUpdateCallback(callback: (sessionId: string, status: SessionStatus, reason?: string) => void): void {
    this.statusUpdateCallback = callback;
  }

  /**
   * Create a new session
   *
   * Story 2.1 AC #1: Session Creation and Object Structure
   * Story 2.1 AC #5: Session Count Limit Enforcement
   * Story 4.14: Existing Branch Selection for Sessions
   *
   * @param name Optional session name (auto-generated if not provided)
   * @param branch Optional branch name (derived from session name if not provided)
   * @param existingBranch Whether to use an existing branch (default: false = create new branch)
   * @returns Created Session object
   * @throws MaxSessionsError if MAX_SESSIONS limit is exceeded
   *
   * @example
   * ```typescript
   * const session = await sessionManager.createSession('feature-auth');
   * // Returns:
   * // {
   * //   id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
   * //   name: "feature-auth",
   * //   status: "active",
   * //   branch: "feature/feature-auth",
   * //   worktreePath: "/workspace/.worktrees/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
   * //   createdAt: "2025-11-24T10:30:00.000Z",
   * //   lastActivity: "2025-11-24T10:30:00.000Z",
   * //   branchType: "new"
   * // }
   * ```
   */
  async createSession(name?: string, branch?: string, existingBranch?: boolean): Promise<Session> {
    // AC #5: Enforce MAX_SESSIONS limit
    if (this.sessions.size >= this.maxSessions) {
      const errorMessage = `Maximum ${this.maxSessions} sessions supported. Destroy a session to create a new one.`;
      logSessionError('creation', undefined, errorMessage);
      throw new MaxSessionsError(errorMessage);
    }

    // Auto-generate session name if not provided (format: feature-YYYY-MM-DD-NNN)
    const sessionName = name || this.generateSessionName();

    // Story 2.3: Validate session name (alphanumeric + dashes, max 50 chars)
    if (!SESSION_NAME_REGEX.test(sessionName)) {
      const errorMessage = 'Session name must be alphanumeric with dashes, max 50 characters';
      logSessionError('creation', undefined, errorMessage);
      throw new InvalidSessionNameError(errorMessage);
    }

    // Generate session ID (UUID v4)
    const id = uuidv4();

    // Story 4.14: Determine branch type and validate
    const useExistingBranch = existingBranch === true;
    const branchType: 'new' | 'existing' = useExistingBranch ? 'existing' : 'new';

    // Derive branch name from session name (format: feature/{session-name})
    const sessionBranch = branch || `feature/${sessionName}`;

    // Story 4.14: Validate existing branch if specified
    if (useExistingBranch) {
      if (!branch) {
        const errorMessage = 'Branch name is required when using existing branch';
        logSessionError('creation', undefined, errorMessage);
        throw new InvalidSessionNameError(errorMessage);
      }

      // Check if branch exists using simple-git
      const simpleGit = require('simple-git');
      const git = simpleGit(this.workspaceRoot);
      const branchSummary = await git.branchLocal();

      if (!branchSummary.all.includes(branch)) {
        const errorMessage = `Branch '${branch}' does not exist. Choose an existing branch or create a new one.`;
        logSessionError('creation', undefined, errorMessage);
        throw new Error(errorMessage);
      }

      // Story 4.15: Removed worktree conflict check
      // Multiple sessions can now use the same branch with separate worktrees
    }

    // Expected worktree path (format: /workspace/.worktrees/{session-id})
    // Note: Actual path may differ if sharing an existing worktree
    const expectedWorktreePath = path.join(this.workspaceRoot, '.worktrees', id);

    // Get current UTC timestamp in ISO 8601 format
    const timestamp = new Date().toISOString();

    // Story 4.15: Compute shared branch metadata
    const sessionsOnBranch = this.getSessionsByBranch(sessionBranch);
    const sharedBranch = sessionsOnBranch.length > 0; // Will be shared after this session is created
    const branchSessionCount = sessionsOnBranch.length + 1; // Include this new session

    // Story 2.3: Integrate with worktreeManager and ptyManager
    // Atomic session creation with rollback on failure
    let ptyProcess: import('node-pty').IPty | undefined;
    let worktreeCreated = false;
    let actualWorktreePath = expectedWorktreePath;
    let isSharedWorktree = false;

    try {
      // Step 1: Create git worktree via worktreeManager (new or existing branch)
      // Note: May return existing worktree path if branch already has one (shared worktree)
      logger.info('Creating worktree for session', { id, branch: sessionBranch, branchType });
      if (useExistingBranch) {
        actualWorktreePath = await worktreeManager.createWorktreeFromExistingBranch(id, sessionBranch);
      } else {
        actualWorktreePath = await worktreeManager.createWorktree(id, sessionBranch);
      }

      // Check if we're sharing an existing worktree
      isSharedWorktree = actualWorktreePath !== expectedWorktreePath;
      worktreeCreated = !isSharedWorktree; // Only mark as created if we created a new one

      if (isSharedWorktree) {
        logger.info('Session sharing existing worktree', {
          id,
          expectedPath: expectedWorktreePath,
          actualPath: actualWorktreePath,
          branch: sessionBranch
        });
      }

      // Step 2: Spawn PTY process with cwd=actual worktree path
      logger.info('Spawning PTY process for session', { id, cwd: actualWorktreePath });
      ptyProcess = ptyManager.spawn('claude', [], {
        cwd: actualWorktreePath,
        cols: 80,
        rows: 24
      });

      // Story 2.11: Register PTY process for zombie detection
      ptyManager.registerPtyProcess(id, ptyProcess);

      // Create Session object
      const session: Session = {
        id,
        name: sessionName,
        status: 'active',
        branch: sessionBranch,
        worktreePath: actualWorktreePath,
        ptyPid: ptyProcess.pid,
        createdAt: timestamp,
        lastActivity: timestamp,
        branchType,
        metadata: {
          sharedBranch,
          branchSessionCount,
          sharedWorktree: isSharedWorktree
        }
      };

      // Store in memory registry
      this.sessions.set(id, session);

      // Persist to JSON file (atomic write)
      await this.saveSessions();

      logSessionEvent('created', id, {
        name: sessionName,
        branch: sessionBranch,
        worktreePath: actualWorktreePath,
        sharedWorktree: isSharedWorktree,
        ptyPid: ptyProcess.pid,
        sessionCount: this.sessions.size
      });

      return session;
    } catch (error) {
      // Rollback on failure
      logger.error('Session creation failed, rolling back', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Cleanup PTY process if spawned
      if (ptyProcess) {
        try {
          // Story 2.11: Unregister PTY process before killing
          ptyManager.unregisterPtyProcess(id);
          ptyManager.kill(ptyProcess, 'SIGTERM');
          logger.info('PTY process terminated during rollback', { id });
        } catch (killError) {
          logger.error('Failed to kill PTY during rollback', {
            id,
            error: killError instanceof Error ? killError.message : String(killError)
          });
        }
      }

      // Cleanup worktree if created
      if (worktreeCreated) {
        try {
          await worktreeManager.removeWorktree(id, true);
          logger.info('Worktree removed during rollback', { id });
        } catch (removeError) {
          logger.error('Failed to remove worktree during rollback', {
            id,
            error: removeError instanceof Error ? removeError.message : String(removeError)
          });
        }
      }

      // Re-throw original error
      throw error;
    }
  }

  /**
   * Get a session by ID
   *
   * Story 2.1 Task 3: Session lookup methods
   *
   * @param sessionId Session identifier
   * @returns Session object or undefined if not found
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   *
   * Story 2.1 Task 3: Session lookup methods
   *
   * @returns Array of all sessions
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Update session status
   *
   * Story 2.1 Task 3: Session management methods
   * Story 2.9: Crash Isolation Between Sessions - emit WebSocket status update
   *
   * @param sessionId Session identifier
   * @param status New status
   * @param reason Optional reason for status change (e.g., "Process crashed")
   * @throws Error if session not found
   */
  async updateSessionStatus(sessionId: string, status: SessionStatus, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const oldStatus = session.status;
    session.status = status;

    // Persist changes
    await this.saveSessions();

    logger.info('Session status updated', {
      sessionId,
      oldStatus,
      newStatus: status,
      reason
    });

    // Story 2.9: Emit WebSocket status update via callback
    if (this.statusUpdateCallback) {
      this.statusUpdateCallback(sessionId, status, reason);
    }
  }

  /**
   * Update session last activity timestamp
   *
   * Story 2.1 Task 3: Session management methods
   *
   * @param sessionId Session identifier
   * @throws Error if session not found
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastActivity = new Date().toISOString();

    // Persist changes
    await this.saveSessions();

    logger.debug('Session activity updated', {
      sessionId,
      lastActivity: session.lastActivity
    });
  }

  /**
   * Destroy a session
   *
   * Story 2.1 Task 3: Session management methods
   * Story 2.7: Session Destruction with Cleanup Options
   * Story 2.11: Unregister PTY process on destroy
   *
   * @param sessionId Session identifier
   * @param cleanup Optional flag to remove git worktree (default: false)
   * @throws Error if session not found
   *
   * @example
   * ```typescript
   * // Destroy session, keep worktree
   * await sessionManager.destroySession(sessionId);
   *
   * // Destroy session and remove worktree
   * await sessionManager.destroySession(sessionId, true);
   * ```
   */
  async destroySession(sessionId: string, cleanup: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    logger.info('Destroying session', {
      sessionId,
      name: session.name,
      cleanup
    });

    // Story 2.7: Gracefully terminate PTY process if running
    const ptyProcess = ptyManager.getPtyProcess(sessionId);
    if (ptyProcess) {
      try {
        logger.info('Gracefully terminating PTY process', {
          sessionId,
          pid: ptyProcess.pid
        });
        await ptyManager.killGracefully(ptyProcess);
        logger.info('PTY process terminated successfully', { sessionId });
      } catch (error) {
        logger.error('Failed to terminate PTY process', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with session destruction even if PTY kill fails
      }
    }

    // Story 2.11: Unregister PTY process from zombie tracking
    ptyManager.unregisterPtyProcess(sessionId);

    // Story 2.7: Remove worktree if cleanup requested
    if (cleanup) {
      // Check if other sessions are sharing this worktree
      const otherSessionsOnWorktree = this.getSessionsSharingWorktree(
        session.worktreePath,
        sessionId
      );

      if (otherSessionsOnWorktree.length > 0) {
        // Other sessions are still using this worktree - don't remove it
        logger.info('Worktree shared by other sessions, preserving', {
          sessionId,
          worktreePath: session.worktreePath,
          otherSessionCount: otherSessionsOnWorktree.length,
          otherSessionIds: otherSessionsOnWorktree.map(s => s.id)
        });
      } else {
        // No other sessions using this worktree - safe to remove
        try {
          logger.info('Removing worktree for session', {
            sessionId,
            worktreePath: session.worktreePath
          });
          // Extract session ID from worktree path for removeWorktree
          const worktreeSessionId = path.basename(session.worktreePath);
          await worktreeManager.removeWorktree(worktreeSessionId);
          logger.info('Worktree removed successfully', { sessionId });
        } catch (error) {
          // Log error but don't fail session destruction
          // This allows partial cleanup (session removed even if worktree fails)
          logger.error('Failed to remove worktree, continuing with session destruction', {
            sessionId,
            worktreePath: session.worktreePath,
            error: error instanceof Error ? error.message : String(error)
          });
          // Note: We intentionally don't re-throw here - session destruction
          // should complete even if worktree cleanup fails. The user can
          // manually clean up the orphaned worktree later if needed.
        }
      }
    }

    // Remove from registry
    this.sessions.delete(sessionId);

    // Persist changes
    await this.saveSessions();

    logSessionEvent('destroyed', sessionId, {
      name: session.name,
      branch: session.branch,
      cleanup,
      sessionCount: this.sessions.size
    });
  }

  /**
   * Resume an idle or crashed session by spawning a new PTY process
   *
   * Story 2.10 AC #6-9: Manual resume functionality
   * Story 2.9 AC #4: Manual restart of crashed sessions
   * Story 2.10 Task 3.2: Spawn PTY with persisted worktreePath as cwd
   *
   * @param sessionId Session identifier
   * @param ptyProcessRef Reference to store the spawned PTY process (from server.ts)
   * @throws Error if session not found or not in idle/error status
   */
  async resumeSession(sessionId: string, ptyProcessRef?: { ptyProcess: any }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Story 2.9: Verify session is in idle or error status (allow resuming crashed sessions)
    if (session.status !== 'idle' && session.status !== 'error') {
      logger.warn('Attempt to resume session that is not idle or error', {
        sessionId,
        currentStatus: session.status
      });
      throw new Error(`Session cannot be resumed: ${sessionId} (status: ${session.status})`);
    }

    // Verify worktree path exists
    try {
      await fs.access(session.worktreePath);
    } catch {
      const errorMessage = `Worktree path does not exist: ${session.worktreePath}`;
      logSessionError('resume', sessionId, errorMessage);
      throw new Error(errorMessage);
    }

    logger.info('Resuming session', {
      sessionId,
      name: session.name,
      worktreePath: session.worktreePath
    });

    // Spawn new PTY process with worktreePath as cwd
    const ptyProcess = ptyManager.spawn('claude', [], {
      cwd: session.worktreePath,
      cols: 80,
      rows: 24
    });

    // Story 2.11: Register PTY process for zombie detection
    ptyManager.registerPtyProcess(sessionId, ptyProcess);

    // Store PTY process reference if provided
    if (ptyProcessRef) {
      ptyProcessRef.ptyProcess = ptyProcess;
    }

    // Update session status and PTY pid
    session.status = 'active';
    session.ptyPid = ptyProcess.pid;
    session.lastActivity = new Date().toISOString();

    // Persist changes
    await this.saveSessions();

    logSessionEvent('resumed', sessionId, {
      name: session.name,
      worktreePath: session.worktreePath,
      ptyPid: ptyProcess.pid
    });
  }

  /**
   * Save sessions to JSON file using atomic write
   *
   * Story 2.1 AC #2: Session Persistence with Atomic Writes
   * Story 2.1 Task 4: Implement atomic JSON persistence
   *
   * Uses atomic write pattern (temp file + rename) to prevent corruption on crash
   */
  async saveSessions(): Promise<void> {
    const data: SessionPersistence = {
      version: PERSISTENCE_VERSION,
      sessions: this.getAllSessions()
    };

    try {
      await atomicWriteJson(this.persistencePath, data);
      logger.debug('Sessions persisted to JSON', {
        persistencePath: this.persistencePath,
        sessionCount: this.sessions.size
      });
    } catch (error) {
      logger.error('Failed to save sessions', {
        persistencePath: this.persistencePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Save sessions to JSON file (alias for saveSessions)
   * Story 4.7: Graceful Container Shutdown and Cleanup
   *
   * Provided for shutdown manager to call saveToFile()
   */
  async saveToFile(): Promise<void> {
    return this.saveSessions();
  }

  /**
   * Update all session statuses to a specific status
   * Story 4.7 AC #3: Session state saved on shutdown
   *
   * @param status New status for all sessions
   */
  updateAllStatuses(status: SessionStatus): void {
    const timestamp = new Date().toISOString();
    this.sessions.forEach(session => {
      session.status = status;
      session.lastActivity = timestamp;
    });
    logger.info('Updated all session statuses', {
      status,
      sessionCount: this.sessions.size
    });
  }

  /**
   * Get all active sessions (not stopped)
   * Story 4.7: Used by shutdown manager to get sessions with PTY processes
   *
   * @returns Array of sessions that are not in 'stopped' status
   */
  getAllActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status !== 'stopped' && s.ptyPid
    );
  }

  /**
   * Get session count
   * Story 4.8: Resource Monitoring and Limits
   * Used by ResourceMonitor to track active sessions
   *
   * @returns Number of sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all sessions using a specific branch
   * Story 4.15: Multiple Sessions on Same Branch
   * Used to calculate session counts and shared branch metadata
   *
   * @param branchName Branch name to filter by
   * @returns Array of sessions on the specified branch (excluding stopped sessions)
   */
  getSessionsByBranch(branchName: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      session => session.branch === branchName && session.status !== 'stopped'
    );
  }

  /**
   * Get all sessions sharing a specific worktree path
   * Used to determine if a worktree can be safely removed
   *
   * @param worktreePath Worktree path to check
   * @param excludeSessionId Optional session ID to exclude from the count
   * @returns Array of sessions using the specified worktree
   */
  getSessionsSharingWorktree(worktreePath: string, excludeSessionId?: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      session =>
        session.worktreePath === worktreePath &&
        session.id !== excludeSessionId
    );
  }

  /**
   * Get active PTY process IDs
   * Story 4.8: Resource Monitoring and Limits
   * Used by ZombieCleanup to detect orphaned processes
   *
   * @returns Array of PTY PIDs for all sessions
   */
  getActivePIDs(): number[] {
    return Array.from(this.sessions.values())
      .filter(s => s.ptyPid !== undefined)
      .map(s => s.ptyPid!);
  }

  /**
   * Terminate a PTY process for a session
   * Story 4.7 AC #2: PTY processes receive SIGTERM first, then SIGKILL
   *
   * @param sessionId Session identifier
   * @param signal Signal to send (SIGTERM or SIGKILL)
   * @returns Promise that resolves when PTY exits or after 5s timeout
   */
  async terminatePTY(sessionId: string, signal: NodeJS.Signals): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const ptyProcess = ptyManager.getPtyProcess(sessionId);
    if (!ptyProcess) {
      throw new Error(`Session ${sessionId} has no PTY process`);
    }

    // Validate signal is supported
    if (signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      throw new Error(`Unsupported signal: ${signal}`);
    }

    return new Promise((resolve, reject) => {
      // 5-second timeout for graceful termination
      const timeout = setTimeout(() => {
        reject(new Error('PTY termination timeout'));
      }, 5000);

      // Listen for PTY exit event
      ptyManager.onExit(ptyProcess, () => {
        clearTimeout(timeout);
        resolve();
      });

      // Send signal to PTY process
      ptyManager.kill(ptyProcess, signal as 'SIGTERM' | 'SIGKILL');
    });
  }

  /**
   * Load sessions from JSON file
   *
   * Story 2.1 AC #3: Session Restoration on Container Restart
   * Story 2.10 AC #1-3: Backend session restoration on startup
   * Story 2.1 Task 5: Implement session restoration from JSON
   * Story 2.10 Task 1.1-1.5: Load sessions, validate worktrees, handle corruption
   *
   * Restores sessions from persistence file on startup.
   * Sets all restored sessions to status 'idle' (PTY processes not running yet)
   * Validates worktree paths still exist on filesystem
   * Handles corrupted JSON gracefully
   */
  async loadSessions(): Promise<void> {
    try {
      // Check if persistence file exists
      try {
        await fs.access(this.persistencePath);
      } catch {
        // File doesn't exist - start with empty state
        logger.info('No persistence file found, starting with empty state', {
          persistencePath: this.persistencePath
        });
        return;
      }

      // Read and parse JSON file
      const content = await fs.readFile(this.persistencePath, 'utf-8');
      const data: SessionPersistence = JSON.parse(content);

      // Validate schema version
      if (data.version !== PERSISTENCE_VERSION) {
        logger.warn('Persistence file version mismatch', {
          expectedVersion: PERSISTENCE_VERSION,
          actualVersion: data.version,
          persistencePath: this.persistencePath
        });
        // Continue anyway - schema is simple enough to be compatible
      }

      // Clear current registry
      this.sessions.clear();

      // Restore sessions to in-memory registry
      // Set all sessions to 'idle' status (PTY processes not running)
      // Story 2.10 Task 1.3: Validate worktree paths still exist
      for (const session of data.sessions) {
        session.status = 'idle';
        delete session.ptyPid; // PTY processes don't survive restart

        // Story 5.10: Initialize artifactReviews if missing (backward compatibility)
        if (!session.artifactReviews) {
          session.artifactReviews = {};
        }

        // Validate worktree path exists
        try {
          await fs.access(session.worktreePath);
          logger.debug('Worktree path validated', {
            sessionId: session.id,
            worktreePath: session.worktreePath
          });
        } catch {
          // Worktree missing - log warning but keep session (user can recreate or destroy)
          logger.warn('Worktree path missing for session', {
            sessionId: session.id,
            name: session.name,
            worktreePath: session.worktreePath,
            note: 'Session kept in registry - user can recreate worktree or destroy session'
          });
        }

        // Story 5.10: Cleanup stale artifact review entries and reconcile with git status
        await this.cleanupAndReconcileSession(session);

        this.sessions.set(session.id, session);
      }

      logger.info('Sessions restored from JSON', {
        persistencePath: this.persistencePath,
        sessionCount: this.sessions.size,
        sessions: data.sessions.map(s => ({ id: s.id, name: s.name, status: s.status }))
      });
    } catch (error) {
      // Story 2.10 Task 1.5: Graceful handling of corrupted JSON
      logger.warn('Failed to load sessions from JSON, continuing with empty state', {
        persistencePath: this.persistencePath,
        error: error instanceof Error ? error.message : String(error),
        note: 'Server startup will continue with empty session list'
      });

      // Don't crash the server - continue with empty session list
      this.sessions.clear();
    }
  }

  /**
   * Rebuild session state from git worktrees
   *
   * Story 2.1 AC #4: Graceful Handling of Corrupted JSON
   * Story 2.1 Task 6: Implement corrupted JSON recovery
   *
   * This is a stub implementation for Story 2.1.
   * Actual worktree scanning will be implemented in Story 2.2 (Git Worktree Creation and Branch Management)
   *
   * @returns Array of recovered sessions
   */
  async rebuildFromWorktrees(): Promise<Session[]> {
    logger.warn('rebuildFromWorktrees called - stub implementation', {
      note: 'Actual worktree scanning will be implemented in Story 2.2'
    });

    // Stub implementation - return empty array
    // Story 2.2 will scan /workspace/.worktrees directory and rebuild session state
    return [];
  }

  /**
   * Cleanup and reconcile session artifact reviews
   * Story 5.10: Artifact Review State Persistence
   *
   * Cleans up stale entries (deleted/committed files) and reconciles approved files with git status
   *
   * @param session Session to cleanup and reconcile
   */
  private async cleanupAndReconcileSession(session: Session): Promise<void> {
    // Dynamically import artifactReviewManager to avoid circular dependency
    const { artifactReviewManager } = await import('./artifactReviewManager');

    try {
      // Cleanup stale entries (deleted or committed files)
      await artifactReviewManager.cleanupStaleEntries(session.id);

      // Reconcile approved files with git status
      await artifactReviewManager.reconcileWithGitStatus(session.id);

      logger.debug('Session artifact reviews cleaned and reconciled', {
        sessionId: session.id
      });
    } catch (error) {
      // Log error but don't fail session load
      logger.warn('Failed to cleanup/reconcile session artifact reviews', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate auto-generated session name
   *
   * Format: feature-YYYY-MM-DD-NNN
   * NNN is a sequential counter for sessions created on the same day
   *
   * @returns Generated session name
   *
   * @private
   */
  private generateSessionName(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `feature-${year}-${month}-${day}`;

    // Count existing sessions with same date prefix
    const existingSessions = Array.from(this.sessions.values())
      .filter(s => s.name.startsWith(datePrefix));

    // Generate sequential counter
    const counter = String(existingSessions.length + 1).padStart(3, '0');

    return `${datePrefix}-${counter}`;
  }
}

/**
 * Singleton SessionManager instance
 * Exported for use throughout the application
 */
export const sessionManager = new SessionManager();
