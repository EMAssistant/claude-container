/**
 * Status Checker Service
 * Story 4.1: Session Status Tracking with Idle Detection
 *
 * Monitors session activity and detects idle/stuck states.
 * Runs periodic checks every 60 seconds to identify:
 * - Idle sessions (5+ minutes no output)
 * - Stuck sessions (30+ minutes no output)
 * - Sends WebSocket notifications for status changes
 */

import { SessionManager } from './sessionManager';
import { Session, SessionWarningMessage, SessionStatusMessage } from './types';
import { logger, logWithSession } from './utils/logger';

/**
 * Idle threshold: 5 minutes of no PTY output
 */
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Stuck threshold: 30 minutes of no PTY output
 */
const STUCK_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Check interval: Run status checks every 60 seconds
 */
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Status Checker Service
 * Monitors session activity and sends notifications for idle/stuck states
 */
export class StatusChecker {
  private intervalId?: NodeJS.Timeout;
  private sessionManager: SessionManager;
  private broadcastMessage: (message: any) => void;

  /**
   * Create a new StatusChecker instance
   *
   * @param sessionManager SessionManager instance to check
   * @param broadcastMessage Function to broadcast WebSocket messages to all clients
   */
  constructor(
    sessionManager: SessionManager,
    broadcastMessage: (message: any) => void
  ) {
    this.sessionManager = sessionManager;
    this.broadcastMessage = broadcastMessage;
  }

  /**
   * Start the status checker
   * Begins periodic checks every 60 seconds
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('StatusChecker already running');
      return;
    }

    logger.info('Starting StatusChecker', {
      idleThresholdMs: IDLE_THRESHOLD_MS,
      stuckThresholdMs: STUCK_THRESHOLD_MS,
      checkIntervalMs: CHECK_INTERVAL_MS
    });

    this.intervalId = setInterval(() => {
      this.checkAllSessions();
    }, CHECK_INTERVAL_MS);
  }

  /**
   * Stop the status checker
   * Clears the periodic check interval
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('StatusChecker stopped');
    }
  }

  /**
   * Check all sessions for idle/stuck states
   * Called by the interval timer every 60 seconds
   */
  private async checkAllSessions(): Promise<void> {
    const sessions = this.sessionManager.getAllSessions();

    logger.debug('StatusChecker running', {
      sessionCount: sessions.length
    });

    for (const session of sessions) {
      try {
        await this.checkSession(session);
      } catch (error) {
        // Don't crash on individual session failures
        logger.error('StatusChecker failed for session', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Check a single session for status changes
   * Implements idle and stuck detection logic
   *
   * @param session Session to check
   */
  private async checkSession(session: Session): Promise<void> {
    const now = Date.now();
    const lastActivityTime = new Date(session.lastActivity).getTime();
    const timeSinceActivity = now - lastActivityTime;

    // Idle detection (5 minutes)
    if (timeSinceActivity > IDLE_THRESHOLD_MS && session.status === 'active') {
      await this.setSessionIdle(session);
    }

    // Stuck detection (30 minutes)
    if (timeSinceActivity > STUCK_THRESHOLD_MS) {
      await this.sendStuckWarning(session, timeSinceActivity);
    }
  }

  /**
   * Set session to idle status
   * Sends session.status WebSocket message
   *
   * @param session Session to mark as idle
   */
  private async setSessionIdle(session: Session): Promise<void> {
    logWithSession('info', 'Session status changed to idle', session.id, {
      from: 'active',
      to: 'idle',
      lastActivity: session.lastActivity
    });

    // Update session status
    await this.sessionManager.updateSessionStatus(session.id, 'idle');

    // Broadcast status change
    const statusMessage: SessionStatusMessage = {
      type: 'session.status',
      sessionId: session.id,
      status: 'idle',
      lastActivity: session.lastActivity,
      isStuck: false
    };

    this.broadcastMessage(statusMessage);
  }

  /**
   * Send stuck warning for session
   * Sets metadata.stuckSince and sends session.warning WebSocket message
   *
   * @param session Session that is stuck
   * @param timeSinceActivity Time since last activity in milliseconds
   */
  private async sendStuckWarning(session: Session, timeSinceActivity: number): Promise<void> {
    const now = new Date().toISOString();

    // Initialize metadata if not present
    if (!session.metadata) {
      session.metadata = {};
    }

    // Only send warning if we haven't warned recently (prevent spam)
    // Send warning at most once per hour
    const lastWarningTime = session.metadata.lastWarning
      ? new Date(session.metadata.lastWarning).getTime()
      : 0;
    const timeSinceLastWarning = Date.now() - lastWarningTime;
    const ONE_HOUR_MS = 60 * 60 * 1000;

    if (timeSinceLastWarning < ONE_HOUR_MS) {
      // Already warned recently, skip
      return;
    }

    // Set stuckSince if not already set
    if (!session.metadata.stuckSince) {
      session.metadata.stuckSince = now;
    }

    // Update lastWarning timestamp
    session.metadata.lastWarning = now;

    // Persist metadata changes
    await this.sessionManager.saveSessions();

    const minutesIdle = Math.floor(timeSinceActivity / (60 * 1000));

    logWithSession('warn', 'Session stuck - no output', session.id, {
      minutesIdle,
      lastActivity: session.lastActivity,
      stuckSince: session.metadata.stuckSince
    });

    // Broadcast stuck warning
    const warningMessage: SessionWarningMessage = {
      type: 'session.warning',
      sessionId: session.id,
      message: `No output for ${minutesIdle}+ minutes`,
      severity: 'warning'
    };

    this.broadcastMessage(warningMessage);

    // Also broadcast status update with isStuck flag
    const statusMessage: SessionStatusMessage = {
      type: 'session.status',
      sessionId: session.id,
      status: session.status,
      lastActivity: session.lastActivity,
      isStuck: true
    };

    this.broadcastMessage(statusMessage);
  }
}
