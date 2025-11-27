/**
 * Resource Monitor Module
 * Story 4.8: Resource Monitoring and Limits
 *
 * Monitors container memory usage and enforces resource limits.
 * - Warning threshold: 87% (7GB of 8GB)
 * - Critical threshold: 93% (7.5GB of 8GB) - blocks new sessions
 * - Monitoring cycle: Every 30 seconds
 * - Broadcasts WebSocket messages on threshold changes
 */

import { logger } from './utils/logger';
import type { WebSocketServer } from 'ws';
import type { SessionManager } from './sessionManager';
import type { ResourceWarningMessage } from './types';

/**
 * Resource state interface
 * Tracks current memory usage and session count
 */
interface ResourceState {
  memoryUsedBytes: number;
  memoryLimitBytes: number;
  memoryUsagePercent: number;
  sessionCount: number;
  maxSessions: number;
  isAcceptingNewSessions: boolean;
  zombieProcessCount: number;
}

/**
 * ResourceMonitor class
 * Monitors memory usage and broadcasts warnings when thresholds are crossed
 */
export class ResourceMonitor {
  private static readonly MEMORY_LIMIT_BYTES = 8 * 1024 * 1024 * 1024; // 8GB
  private static readonly WARNING_THRESHOLD = 87; // %
  private static readonly CRITICAL_THRESHOLD = 93; // %
  private static readonly CHECK_INTERVAL_MS = 30000; // 30s

  private monitoringInterval?: NodeJS.Timeout;
  private currentState: ResourceState;
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private lastWarningState: 'none' | 'warning' | 'critical' = 'none';

  /**
   * Create a new ResourceMonitor instance
   *
   * @param wss WebSocketServer for broadcasting warnings
   * @param sessionManager SessionManager for tracking active sessions
   */
  constructor(wss: WebSocketServer, sessionManager: SessionManager) {
    this.wss = wss;
    this.sessionManager = sessionManager;
    this.currentState = {
      memoryUsedBytes: 0,
      memoryLimitBytes: ResourceMonitor.MEMORY_LIMIT_BYTES,
      memoryUsagePercent: 0,
      sessionCount: 0,
      maxSessions: 4,
      isAcceptingNewSessions: true,
      zombieProcessCount: 0
    };
  }

  /**
   * Start resource monitoring
   * Story 4.8 AC #4: Monitoring cycle runs every 30 seconds
   */
  startMonitoring(): void {
    logger.info('Resource monitoring started', {
      checkIntervalMs: ResourceMonitor.CHECK_INTERVAL_MS,
      memoryLimitBytes: ResourceMonitor.MEMORY_LIMIT_BYTES,
      warningThreshold: ResourceMonitor.WARNING_THRESHOLD,
      criticalThreshold: ResourceMonitor.CRITICAL_THRESHOLD
    });

    // Initial check
    this.checkResources();

    // Set interval for periodic checks
    this.monitoringInterval = setInterval(() => {
      this.checkResources();
    }, ResourceMonitor.CHECK_INTERVAL_MS);
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Resource monitoring stopped');
    }
  }

  /**
   * Check resources and update state
   * Story 4.8 AC #4: Memory monitoring cycle
   */
  private checkResources(): void {
    // Get heap used from process.memoryUsage()
    const heapUsed = process.memoryUsage().heapUsed;
    const memoryUsagePercent = (heapUsed / ResourceMonitor.MEMORY_LIMIT_BYTES) * 100;
    const sessionCount = this.sessionManager.getSessionCount();

    // Update state
    const previousState = { ...this.currentState };
    this.currentState = {
      memoryUsedBytes: heapUsed,
      memoryLimitBytes: ResourceMonitor.MEMORY_LIMIT_BYTES,
      memoryUsagePercent,
      sessionCount,
      maxSessions: 4,
      isAcceptingNewSessions: this.currentState.isAcceptingNewSessions,
      zombieProcessCount: 0 // Updated by ZombieCleanup
    };

    // Check thresholds and broadcast if needed
    this.checkMemoryThresholds(previousState);
  }

  /**
   * Check memory thresholds and broadcast warnings
   * Story 4.8 AC #1, #2: Memory warning at 87%, sessions blocked at 93%
   *
   * @param previousState Previous resource state
   */
  private checkMemoryThresholds(previousState: ResourceState): void {
    const percent = this.currentState.memoryUsagePercent;
    const previousPercent = previousState.memoryUsagePercent;

    // Critical threshold (93%)
    if (percent >= ResourceMonitor.CRITICAL_THRESHOLD) {
      if (this.currentState.isAcceptingNewSessions || this.lastWarningState !== 'critical') {
        this.currentState.isAcceptingNewSessions = false;
        this.lastWarningState = 'critical';
        logger.error('Memory critical, blocking new sessions', {
          memoryUsagePercent: percent,
          sessionCount: this.currentState.sessionCount,
          memoryUsedBytes: this.currentState.memoryUsedBytes,
          memoryLimitBytes: this.currentState.memoryLimitBytes
        });
        this.broadcastResourceWarning();
      }
    }
    // Warning threshold (87%)
    else if (percent >= ResourceMonitor.WARNING_THRESHOLD) {
      // If was critical, now just warning - recovered somewhat
      if (!this.currentState.isAcceptingNewSessions) {
        this.currentState.isAcceptingNewSessions = true;
        this.lastWarningState = 'warning';
        logger.warn('Memory usage recovered from critical to warning', {
          memoryUsagePercent: percent,
          sessionCount: this.currentState.sessionCount,
          memoryUsedBytes: this.currentState.memoryUsedBytes
        });
        this.broadcastResourceWarning();
      } else if (this.lastWarningState !== 'warning') {
        // First time crossing warning threshold
        this.lastWarningState = 'warning';
        logger.warn('Memory usage high', {
          memoryUsagePercent: percent,
          sessionCount: this.currentState.sessionCount,
          memoryUsedBytes: this.currentState.memoryUsedBytes,
          memoryLimitBytes: this.currentState.memoryLimitBytes
        });
        this.broadcastResourceWarning();
      }
    }
    // Recovered (below 87%)
    else if (previousPercent >= ResourceMonitor.WARNING_THRESHOLD) {
      if (this.lastWarningState !== 'none') {
        this.currentState.isAcceptingNewSessions = true;
        this.lastWarningState = 'none';
        logger.info('Memory usage recovered', {
          memoryUsagePercent: percent,
          sessionCount: this.currentState.sessionCount,
          memoryUsedBytes: this.currentState.memoryUsedBytes
        });
        this.broadcastResourceWarning();
      }
    }
  }

  /**
   * Broadcast resource warning to all WebSocket clients
   * Story 4.8 AC #8: Resource state broadcast
   */
  private broadcastResourceWarning(): void {
    const message: ResourceWarningMessage = {
      type: 'resource.warning',
      message: this.getWarningMessage(),
      memoryUsagePercent: Math.round(this.currentState.memoryUsagePercent * 10) / 10, // Round to 1 decimal
      isAcceptingNewSessions: this.currentState.isAcceptingNewSessions
    };

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.wss.clients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.send(messageStr);
        sentCount++;
      }
    });

    logger.info('Resource warning broadcasted', {
      memoryUsagePercent: this.currentState.memoryUsagePercent,
      isAcceptingNewSessions: this.currentState.isAcceptingNewSessions,
      clientCount: sentCount
    });
  }

  /**
   * Get warning message based on current state
   * Story 4.8 AC #7: Frontend resource warning display
   *
   * @returns User-friendly warning message
   */
  private getWarningMessage(): string {
    const percent = Math.round(this.currentState.memoryUsagePercent);
    if (!this.currentState.isAcceptingNewSessions) {
      return `Memory critical (${percent}%). Cannot create new sessions until memory is freed.`;
    }
    if (this.currentState.memoryUsagePercent >= ResourceMonitor.WARNING_THRESHOLD) {
      return `High memory usage (${percent}%). Consider closing idle sessions.`;
    }
    return `Memory usage normal (${percent}%).`;
  }

  /**
   * Check if accepting new sessions
   * Story 4.8 AC #2: New sessions blocked at 93%
   *
   * @returns true if accepting new sessions, false if blocked
   */
  get isAcceptingNewSessions(): boolean {
    return this.currentState.isAcceptingNewSessions;
  }

  /**
   * Get current resource state
   *
   * @returns Current resource state
   */
  getResourceState(): ResourceState {
    return { ...this.currentState };
  }
}

/**
 * Factory function to create ResourceMonitor instance
 * Story 4.8 Task 1: Create ResourceMonitor module
 *
 * @param wss WebSocketServer instance
 * @param sessionManager SessionManager instance
 * @returns ResourceMonitor instance
 */
export function createResourceMonitor(
  wss: WebSocketServer,
  sessionManager: SessionManager
): ResourceMonitor {
  return new ResourceMonitor(wss, sessionManager);
}
