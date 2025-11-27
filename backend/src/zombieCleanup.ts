/**
 * Zombie Process Cleanup Module
 * Story 4.8: Resource Monitoring and Limits
 *
 * Detects and cleans up orphaned PTY processes that are running
 * but not associated with any active session.
 * - Cleanup cycle: Every 60 seconds
 * - Cleanup timeout: Must complete within 5 seconds
 */

import { logger } from './utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SessionManager } from './sessionManager';

const execAsync = promisify(exec);

/**
 * ZombieCleanup class
 * Detects and kills orphaned PTY processes
 */
export class ZombieCleanup {
  private static readonly CLEANUP_INTERVAL_MS = 60000; // 60s
  private static readonly CLEANUP_TIMEOUT_MS = 5000; // 5s

  private cleanupInterval?: NodeJS.Timeout;
  private sessionManager: SessionManager;
  private isRunning: boolean = false;

  /**
   * Create a new ZombieCleanup instance
   *
   * @param sessionManager SessionManager for getting active PIDs
   */
  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Start zombie cleanup timer
   * Story 4.8 AC #3: Zombie processes cleaned up every 60 seconds
   */
  startCleanup(): void {
    logger.info('Zombie cleanup started', {
      cleanupIntervalMs: ZombieCleanup.CLEANUP_INTERVAL_MS,
      cleanupTimeoutMs: ZombieCleanup.CLEANUP_TIMEOUT_MS
    });

    this.isRunning = true;

    // Set interval for periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.detectAndCleanZombies().catch(err => {
        logger.error('Zombie cleanup failed', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        });
      });
    }, ZombieCleanup.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop zombie cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.isRunning = false;
      logger.info('Zombie cleanup stopped');
    }
  }

  /**
   * Detect and clean zombie processes
   * Story 4.8 AC #3: Zombie process detection and cleanup
   *
   * Detects PTY processes that are running but not in active sessions
   * and sends SIGKILL to clean them up.
   */
  private async detectAndCleanZombies(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    const timeout = setTimeout(() => {
      logger.warn('Zombie cleanup timeout exceeded', {
        timeoutMs: ZombieCleanup.CLEANUP_TIMEOUT_MS,
        elapsedMs: Date.now() - startTime
      });
    }, ZombieCleanup.CLEANUP_TIMEOUT_MS);

    try {
      // Get active session PIDs
      const activePIDs = this.sessionManager.getActivePIDs();
      logger.debug('Active session PIDs', { activePIDs });

      // Find all node processes (PTY processes run as node child processes)
      // Look for processes with 'node' or 'claude' in the command
      let stdout: string;
      try {
        const result = await execAsync('ps -eo pid,comm | grep -E "node|claude" || true');
        stdout = result.stdout;
      } catch (error) {
        // ps command failed or no matches found
        logger.debug('No PTY processes found or ps command failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        clearTimeout(timeout);
        return;
      }

      const runningPTYs = this.parsePTYProcesses(stdout);
      logger.debug('Running PTY processes', { runningPTYs });

      // Identify zombies (running but not in active sessions)
      const zombiePIDs = runningPTYs.filter(pid => !activePIDs.includes(pid));

      if (zombiePIDs.length === 0) {
        logger.debug('No zombie processes detected');
        clearTimeout(timeout);
        return;
      }

      // Clean zombies
      for (const pid of zombiePIDs) {
        const cleanupStartTime = Date.now();
        logger.warn('Zombie process detected', { pid });

        try {
          // Send SIGKILL to zombie process
          process.kill(pid, 'SIGKILL');
          const elapsedMs = Date.now() - cleanupStartTime;
          logger.info('Zombie process cleaned', {
            pid,
            elapsedMs
          });
        } catch (err) {
          // Process may have already exited
          logger.error('Failed to kill zombie process', {
            pid,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    } finally {
      clearTimeout(timeout);
      const totalElapsedMs = Date.now() - startTime;
      logger.debug('Zombie cleanup cycle completed', {
        elapsedMs: totalElapsedMs
      });
    }
  }

  /**
   * Parse PTY process IDs from ps output
   *
   * @param psOutput Output from ps command
   * @returns Array of PIDs
   */
  private parsePTYProcesses(psOutput: string): number[] {
    const lines = psOutput.trim().split('\n');
    return lines
      .map(line => {
        const match = line.trim().match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((pid): pid is number => pid !== null && !isNaN(pid));
  }

  /**
   * Check if cleanup is running
   *
   * @returns true if cleanup is running
   */
  isCleanupRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Factory function to create ZombieCleanup instance
 * Story 4.8 Task 2: Create ZombieCleanup module
 *
 * @param sessionManager SessionManager instance
 * @returns ZombieCleanup instance
 */
export function createZombieCleanup(
  sessionManager: SessionManager
): ZombieCleanup {
  return new ZombieCleanup(sessionManager);
}
