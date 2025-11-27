/**
 * Graceful Shutdown Manager
 * Story 4.7: Graceful Container Shutdown and Cleanup
 *
 * Orchestrates graceful container shutdown when SIGTERM signal is received:
 * 1. Stop accepting new connections
 * 2. Broadcast shutdown message to clients
 * 3. Terminate PTY processes (SIGTERM → SIGKILL after 5s)
 * 4. Save final session state
 * 5. Cleanup and exit
 *
 * Total shutdown time: <10 seconds (Docker's SIGKILL timeout)
 */

import type { Server } from 'http';
import type { WebSocketServer, WebSocket } from 'ws';
import type { SessionManager } from './sessionManager';
import { logger } from './utils/logger';

/**
 * ShutdownManager class
 * Orchestrates graceful container shutdown sequence
 *
 * Story 4.7 AC #5: Correct shutdown sequence ordering
 * Story 4.7 AC #6: Comprehensive shutdown logging
 */
export class ShutdownManager {
  private isShuttingDown: boolean = false;
  private shutdownStartTime?: number;

  /**
   * Create a new ShutdownManager instance
   *
   * @param server HTTP server instance
   * @param wss WebSocket server instance
   * @param sessionManager SessionManager instance
   */
  constructor(
    private server: Server,
    private wss: WebSocketServer,
    private sessionManager: SessionManager
  ) {}

  /**
   * Get shutdown state
   * Used by server.ts to reject new connections during shutdown
   */
  get isShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Initiate graceful shutdown sequence
   *
   * Story 4.7 AC #5: Ordered shutdown sequence (7 steps)
   * Story 4.7 AC #6: Comprehensive logging
   * Story 4.7 AC #21: Complete in <10s
   */
  async initiate(): Promise<void> {
    // Story 4.7 AC #7: Prevent double shutdown execution
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate signal');
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();

    // Get active sessions count for logging
    const sessions = this.sessionManager.getAllSessions();
    const activeSessions = sessions.filter(s => s.status !== 'stopped');

    logger.info('Received SIGTERM, shutting down gracefully...', {
      activeSessions: activeSessions.length,
      totalSessions: sessions.length
    });

    try {
      // Step 1: Stop accepting new connections
      this.stopAcceptingConnections();

      // Step 2: Broadcast shutdown message to clients
      await this.broadcastShutdown();

      // Step 3: Terminate PTY processes (SIGTERM → SIGKILL after 5s)
      await this.terminatePTYs();

      // Step 4: Save final session state
      await this.saveFinalState();

      // Step 5-7: Cleanup and exit
      this.cleanup();
    } catch (error) {
      logger.error('Shutdown sequence failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Force exit anyway to prevent hang
      process.exit(1);
    }
  }

  /**
   * Stop accepting new connections
   * Story 4.7 AC #8: Connection blocking during shutdown
   */
  private stopAcceptingConnections(): void {
    // Flag is checked via isShutdown getter by server.ts middleware
    logger.info('Stopped accepting new connections');
  }

  /**
   * Broadcast shutdown message to all WebSocket clients
   * Story 4.7 AC #4: Shutdown broadcast sent to clients
   */
  private async broadcastShutdown(): Promise<void> {
    const message = {
      type: 'server.shutdown' as const,
      message: 'Server shutting down',
      gracePeriodMs: 5000
    };

    const clientCount = this.wss.clients.size;
    logger.info('Broadcasting shutdown message to N clients', { clientCount });

    this.wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });

    // Give clients brief moment to receive message (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Terminate all PTY processes
   * Story 4.7 AC #2: PTY processes receive SIGTERM first, then SIGKILL after 5s
   */
  private async terminatePTYs(): Promise<void> {
    const sessions = this.sessionManager.getAllSessions();
    const activeSessions = sessions.filter(s => s.ptyPid && s.status !== 'stopped');

    logger.info('Terminating PTY processes', { count: activeSessions.length });

    const terminationPromises = activeSessions.map(async session => {
      if (!session.ptyPid) return;

      logger.info('Terminating PTY for session X (SIGTERM)', {
        sessionId: session.id,
        sessionName: session.name,
        signal: 'SIGTERM'
      });

      try {
        // Send SIGTERM and wait up to 5 seconds
        await this.sessionManager.terminatePTY(session.id, 'SIGTERM');
        logger.info('PTY for session X exited gracefully', {
          sessionId: session.id,
          sessionName: session.name
        });
      } catch (error) {
        // Timeout or error - force kill with SIGKILL
        logger.warn('PTY for session X force-killed (SIGKILL)', {
          sessionId: session.id,
          sessionName: session.name,
          signal: 'SIGKILL',
          reason: error instanceof Error ? error.message : 'Timeout after 5s'
        });

        try {
          await this.sessionManager.terminatePTY(session.id, 'SIGKILL');
        } catch (killError) {
          logger.error('Failed to SIGKILL PTY process', {
            sessionId: session.id,
            error: killError instanceof Error ? killError.message : String(killError)
          });
        }
      }
    });

    await Promise.all(terminationPromises);
  }

  /**
   * Save final session state
   * Story 4.7 AC #3: Session state saved on shutdown
   */
  private async saveFinalState(): Promise<void> {
    // Update all session statuses to 'stopped'
    this.sessionManager.updateAllStatuses('stopped');

    // Save to file atomically
    await this.sessionManager.saveToFile();

    logger.info('Saved session state to .claude-container-sessions.json');
  }

  /**
   * Cleanup and exit
   * Story 4.7 AC #5: Steps 5-7 of shutdown sequence
   * Story 4.7 AC #21: Total time <10s
   */
  private cleanup(): void {
    // Step 5: Close all WebSocket connections
    this.wss.clients.forEach((ws: WebSocket) => {
      ws.close(1001, 'Server shutting down');
    });
    this.wss.close();

    // Step 6: Stop Express server
    this.server.close(() => {
      const elapsedMs = Date.now() - (this.shutdownStartTime || Date.now());
      logger.info('Graceful shutdown complete', { elapsedMs });

      // Warning if shutdown exceeded 10s target
      if (elapsedMs > 10000) {
        logger.warn('Shutdown exceeded 10s target', { elapsedMs });
      }

      // Step 7: Exit process with code 0
      process.exit(0);
    });

    // Force exit after 1s if server.close doesn't finish
    setTimeout(() => {
      logger.warn('Forcing exit after server.close timeout');
      process.exit(0);
    }, 1000);
  }
}

/**
 * Create a new ShutdownManager instance
 *
 * Factory function for creating ShutdownManager in server.ts
 *
 * @param server HTTP server instance
 * @param wss WebSocket server instance
 * @param sessionManager SessionManager instance
 * @returns ShutdownManager instance
 */
export function createShutdownManager(
  server: Server,
  wss: WebSocketServer,
  sessionManager: SessionManager
): ShutdownManager {
  return new ShutdownManager(server, wss, sessionManager);
}
