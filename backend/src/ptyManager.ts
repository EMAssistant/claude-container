import * as pty from 'node-pty';
import { IPty } from 'node-pty';
import { createLogger, format, transports } from 'winston';

// Winston logger for PTY operations
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

/**
 * Zombie cleanup interval (Story 2.11)
 * Periodic check every 60 seconds for orphaned PTY processes
 */
const ZOMBIE_CLEANUP_INTERVAL_MS = 60000;

/**
 * PTY configuration interface
 * Defines spawn options for Claude CLI process
 */
export interface PTYConfig {
  /** Terminal type - xterm-256color for full color support */
  name: string;
  /** Initial terminal columns (width) */
  cols: number;
  /** Initial terminal rows (height) */
  rows: number;
  /** Working directory for the spawned process */
  cwd: string;
  /** Environment variables to pass to the process */
  env: NodeJS.ProcessEnv;
}

/**
 * Default PTY configuration matching Story 1.4 requirements
 */
export const DEFAULT_PTY_CONFIG: Partial<PTYConfig> = {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: '/workspace',
  env: process.env
};

/**
 * PTY Manager
 * Manages pseudo-terminal processes for Claude CLI sessions
 *
 * Story 1.4: PTY Process Management with node-pty
 * Story 2.11: Zombie process detection and cleanup
 * Provides spawn, write, kill, and event handling for PTY processes
 */
export class PTYManager {
  /**
   * Track PTY processes by sessionId for zombie detection
   * Story 2.11 Task 2.2: Track PTY PIDs alongside PTY processes
   */
  private ptyProcesses: Map<string, { pty: IPty; pid: number }>;

  /**
   * Cleanup timer for zombie process detection
   * Story 2.11 Task 2.1: Add periodic cleanup timer
   */
  private cleanupTimer: NodeJS.Timeout | null;

  /**
   * Callback to get active session IDs from SessionManager
   * Used for zombie detection - PTY without active session is zombie
   */
  private getActiveSessionIds: (() => string[]) | null;

  constructor() {
    this.ptyProcesses = new Map();
    this.cleanupTimer = null;
    this.getActiveSessionIds = null;
  }

  /**
   * Set callback to get active session IDs
   * Called from server.ts after SessionManager is initialized
   *
   * @param callback Function that returns array of active session IDs
   */
  setSessionCallback(callback: () => string[]): void {
    this.getActiveSessionIds = callback;
  }

  /**
   * Start zombie cleanup timer
   * Story 2.11 Task 2.6: Start cleanup timer on server initialization
   */
  startZombieCleanup(): void {
    if (this.cleanupTimer) {
      logger.warn('Zombie cleanup timer already running');
      return;
    }

    logger.info('Starting zombie process cleanup timer', {
      intervalMs: ZOMBIE_CLEANUP_INTERVAL_MS
    });

    this.cleanupTimer = setInterval(() => {
      this.cleanupZombieProcesses();
    }, ZOMBIE_CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop zombie cleanup timer
   * Story 2.11 Task 2.7: Stop cleanup timer on graceful shutdown
   */
  stopZombieCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info('Zombie cleanup timer stopped');
    }
  }

  /**
   * Clean up zombie PTY processes
   * Story 2.11 Task 2.3-2.5: Cleanup logic for orphaned PTYs
   *
   * A zombie process is a PTY that exists in ptyProcesses Map
   * but has no corresponding active session in SessionManager
   */
  cleanupZombieProcesses(): void {
    if (!this.getActiveSessionIds) {
      logger.debug('Session callback not set, skipping zombie cleanup');
      return;
    }

    const activeSessionIds = this.getActiveSessionIds();
    const activeSessionSet = new Set(activeSessionIds);

    logger.debug('Running zombie process cleanup', {
      ptyProcessCount: this.ptyProcesses.size,
      activeSessionCount: activeSessionIds.length
    });

    // Find and kill zombie PTY processes
    const zombieSessionIds: string[] = [];
    for (const [sessionId] of this.ptyProcesses.entries()) {
      if (!activeSessionSet.has(sessionId)) {
        zombieSessionIds.push(sessionId);
      }
    }

    // Kill and remove zombie processes
    for (const sessionId of zombieSessionIds) {
      const processInfo = this.ptyProcesses.get(sessionId);
      if (processInfo) {
        logger.warn('Cleaned up zombie process for session', {
          sessionId,
          pid: processInfo.pid
        });

        try {
          // Send SIGKILL to zombie process (zombies don't respond to SIGTERM)
          processInfo.pty.kill('SIGKILL');
        } catch (error) {
          logger.error('Failed to kill zombie PTY process', {
            sessionId,
            pid: processInfo.pid,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        // Remove from registry
        this.ptyProcesses.delete(sessionId);
      }
    }

    if (zombieSessionIds.length > 0) {
      logger.info('Zombie cleanup completed', {
        zombiesKilled: zombieSessionIds.length,
        sessionIds: zombieSessionIds
      });
    }
  }

  /**
   * Register a PTY process for a session
   * Story 2.11 Task 2.2: Track PTY PIDs in Map alongside PTY processes
   *
   * @param sessionId Session identifier
   * @param ptyProcess PTY process instance
   */
  registerPtyProcess(sessionId: string, ptyProcess: IPty): void {
    this.ptyProcesses.set(sessionId, {
      pty: ptyProcess,
      pid: ptyProcess.pid
    });

    logger.debug('PTY process registered', {
      sessionId,
      pid: ptyProcess.pid,
      totalProcesses: this.ptyProcesses.size
    });
  }

  /**
   * Unregister a PTY process for a session
   * Called when session is destroyed or PTY exits
   *
   * @param sessionId Session identifier
   */
  unregisterPtyProcess(sessionId: string): void {
    const processInfo = this.ptyProcesses.get(sessionId);
    if (processInfo) {
      this.ptyProcesses.delete(sessionId);
      logger.debug('PTY process unregistered', {
        sessionId,
        pid: processInfo.pid,
        totalProcesses: this.ptyProcesses.size
      });
    }
  }

  /**
   * Get PTY process for a session
   *
   * @param sessionId Session identifier
   * @returns PTY process instance or undefined
   */
  getPtyProcess(sessionId: string): IPty | undefined {
    const processInfo = this.ptyProcesses.get(sessionId);
    return processInfo?.pty;
  }

  /**
   * Spawn a new PTY process
   *
   * @param command Command to execute (e.g., 'claude')
   * @param args Command arguments (empty array for Claude CLI)
   * @param config PTY configuration options
   * @returns IPty process instance
   *
   * @example
   * ```typescript
   * const ptyManager = new PTYManager();
   * const ptyProcess = ptyManager.spawn('claude', [], {
   *   cwd: '/workspace',
   *   cols: 80,
   *   rows: 24
   * });
   * ```
   */
  spawn(
    command: string,
    args: string[],
    config: Partial<PTYConfig> = {}
  ): IPty {
    // Merge provided config with defaults
    const finalConfig: PTYConfig = {
      name: config.name || DEFAULT_PTY_CONFIG.name!,
      cols: config.cols || DEFAULT_PTY_CONFIG.cols!,
      rows: config.rows || DEFAULT_PTY_CONFIG.rows!,
      cwd: config.cwd || DEFAULT_PTY_CONFIG.cwd!,
      env: config.env || DEFAULT_PTY_CONFIG.env!
    };

    // Story 1.11: Add --dangerously-skip-permissions flag for Claude CLI
    // This enables autonomous execution without approval prompts (FR6)
    // Safe due to Docker container isolation (FR7)
    let finalArgs = [...args];
    if (command === 'claude') {
      // Add permission bypass flag if not already present
      if (!finalArgs.includes('--dangerously-skip-permissions')) {
        finalArgs.push('--dangerously-skip-permissions');
      }

      // Set permission mode via flag (takes precedence over env var)
      const permissionMode = process.env.CLAUDE_PERMISSION_MODE || 'bypassPermissions';
      if (!finalArgs.includes('--permission-mode')) {
        finalArgs.push('--permission-mode', permissionMode);
      }
    }

    try {
      logger.info('Spawning PTY process', {
        command,
        args: finalArgs,
        cwd: finalConfig.cwd,
        terminalType: finalConfig.name,
        size: `${finalConfig.cols}x${finalConfig.rows}`,
        permissionMode: command === 'claude' ? process.env.CLAUDE_PERMISSION_MODE : undefined
      });

      // Spawn PTY process with node-pty
      const ptyProcess = pty.spawn(command, finalArgs, finalConfig);

      logger.info('PTY process spawned successfully', {
        pid: ptyProcess.pid,
        command,
        cwd: finalConfig.cwd,
        approvalMode: command === 'claude' ? 'unrestricted' : undefined
      });

      return ptyProcess;
    } catch (error) {
      logger.error('PTY spawn failed', {
        command,
        args: finalArgs,
        cwd: finalConfig.cwd,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Write data to PTY stdin
   *
   * @param ptyProcess PTY process instance
   * @param data Data to write (typically user keyboard input)
   *
   * @example
   * ```typescript
   * ptyManager.write(ptyProcess, 'help\n');
   * ```
   */
  write(ptyProcess: IPty, data: string): void {
    try {
      ptyProcess.write(data);
      logger.debug('Data written to PTY stdin', {
        pid: ptyProcess.pid,
        bytes: data.length
      });
    } catch (error) {
      logger.error('PTY write failed', {
        pid: ptyProcess.pid,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Send signal to PTY process
   *
   * @param ptyProcess PTY process instance
   * @param signal Signal to send (SIGINT for Ctrl+C, SIGTERM for graceful shutdown)
   *
   * @example
   * ```typescript
   * // Send Ctrl+C to interrupt Claude
   * ptyManager.kill(ptyProcess, 'SIGINT');
   * ```
   */
  kill(ptyProcess: IPty, signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
    try {
      logger.info('Sending signal to PTY process', {
        pid: ptyProcess.pid,
        signal
      });
      ptyProcess.kill(signal);
    } catch (error) {
      logger.error('PTY kill failed', {
        pid: ptyProcess.pid,
        signal,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gracefully kill PTY process with timeout
   * Story 2.7: Session Destruction with Cleanup Options
   *
   * Implements graceful shutdown pattern:
   * 1. Send SIGTERM to PTY process
   * 2. Wait 5 seconds for graceful exit
   * 3. If still running, send SIGKILL
   *
   * @param ptyProcess PTY process instance
   * @param timeoutMs Timeout in milliseconds (default: 5000ms)
   * @returns Promise that resolves when process exits
   *
   * @example
   * ```typescript
   * await ptyManager.killGracefully(ptyProcess);
   * // Process will be sent SIGTERM, then SIGKILL if needed
   * ```
   */
  async killGracefully(ptyProcess: IPty, timeoutMs: number = 5000): Promise<void> {
    const pid = ptyProcess.pid;

    logger.info('Graceful PTY shutdown initiated', {
      pid,
      timeoutMs
    });

    return new Promise<void>((resolve) => {
      let resolved = false;
      let killTimer: NodeJS.Timeout | null = null;

      // Register exit handler to detect when process exits
      const exitHandler = () => {
        if (resolved) return;
        resolved = true;

        if (killTimer) {
          clearTimeout(killTimer);
        }

        logger.info('PTY process exited gracefully', { pid });
        resolve();
      };

      ptyProcess.onExit(exitHandler);

      // Send SIGTERM for graceful shutdown
      try {
        this.kill(ptyProcess, 'SIGTERM');
        logger.info('SIGTERM sent to PTY process', { pid });
      } catch (error) {
        logger.error('Failed to send SIGTERM', {
          pid,
          error: error instanceof Error ? error.message : String(error)
        });
        // Process might already be dead, resolve immediately
        resolved = true;
        resolve();
        return;
      }

      // Set timeout to send SIGKILL if process doesn't exit
      killTimer = setTimeout(() => {
        if (resolved) return;

        logger.warn('PTY process did not exit gracefully, sending SIGKILL', {
          pid,
          timeoutMs
        });

        try {
          this.kill(ptyProcess, 'SIGKILL');
          logger.info('SIGKILL sent to PTY process', { pid });
        } catch (error) {
          logger.error('Failed to send SIGKILL', {
            pid,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        // Resolve after SIGKILL (process should be dead)
        resolved = true;
        resolve();
      }, timeoutMs);
    });
  }

  /**
   * Register callback for PTY output
   * Callback receives data chunks as PTY process writes to stdout/stderr
   *
   * @param ptyProcess PTY process instance
   * @param callback Function to call with output data
   *
   * @example
   * ```typescript
   * ptyManager.onData(ptyProcess, (data) => {
   *   console.log('PTY output:', data);
   *   // Send data to WebSocket client
   * });
   * ```
   */
  onData(ptyProcess: IPty, callback: (data: string) => void): void {
    ptyProcess.onData((data: string) => {
      try {
        callback(data);
      } catch (error) {
        logger.error('PTY onData callback error', {
          pid: ptyProcess.pid,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Register callback for PTY exit
   * Callback receives exit code and signal when process terminates
   *
   * @param ptyProcess PTY process instance
   * @param callback Function to call when process exits
   *
   * @example
   * ```typescript
   * ptyManager.onExit(ptyProcess, ({ exitCode, signal }) => {
   *   console.log('PTY exited:', exitCode, signal);
   *   // Clean up resources
   * });
   * ```
   */
  onExit(
    ptyProcess: IPty,
    callback: (event: { exitCode: number; signal?: number }) => void
  ): void {
    ptyProcess.onExit((event: { exitCode: number; signal?: number }) => {
      logger.info('PTY process exited', {
        pid: ptyProcess.pid,
        exitCode: event.exitCode,
        signal: event.signal
      });

      try {
        callback(event);
      } catch (error) {
        logger.error('PTY onExit callback error', {
          pid: ptyProcess.pid,
          exitCode: event.exitCode,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Resize PTY terminal
   * Updates terminal dimensions (used when browser window resizes)
   *
   * @param ptyProcess PTY process instance
   * @param cols New column count
   * @param rows New row count
   *
   * @example
   * ```typescript
   * // Resize terminal to 100x30
   * ptyManager.resize(ptyProcess, 100, 30);
   * ```
   */
  resize(ptyProcess: IPty, cols: number, rows: number): void {
    try {
      ptyProcess.resize(cols, rows);
      logger.debug('PTY resized', {
        pid: ptyProcess.pid,
        size: `${cols}x${rows}`
      });
    } catch (error) {
      logger.error('PTY resize failed', {
        pid: ptyProcess.pid,
        size: `${cols}x${rows}`,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Export singleton instance
export const ptyManager = new PTYManager();
