/**
 * Story 4.10: Performance Optimization and Profiling
 * Backend performance monitoring with latency tracking and percentile calculations
 */

/**
 * Latency measurement entry
 * Records performance metrics for various event types
 */
export interface LatencyMeasurement {
  /** High-resolution timestamp (performance.now()) */
  timestamp: number;
  /** Type of event being measured */
  eventType: 'pty_output' | 'session_create' | 'websocket_send';
  /** Measured latency in milliseconds */
  latencyMs: number;
  /** Optional session ID for session-specific measurements */
  sessionId?: string;
}

/**
 * Performance statistics with percentiles
 */
export interface PerformanceStats {
  /** 50th percentile (median) */
  p50: number;
  /** 90th percentile */
  p90: number;
  /** 99th percentile */
  p99: number;
  /** Total sample count */
  count: number;
}

/**
 * PerformanceMonitor class
 * Tracks latency measurements in a circular buffer and calculates percentile statistics
 *
 * Story 4.10 AC#6: Backend implements PerformanceMonitor class
 * - Track PTY data → WebSocket send latency
 * - Track session creation phases (worktree, PTY spawn, connect)
 * - Store measurements in memory with circular buffer (last 1000 events)
 * - Expose GET /api/metrics endpoint with latency stats (p50, p90, p99)
 */
export class PerformanceMonitor {
  private measurements: LatencyMeasurement[] = [];
  private readonly maxSize = 1000; // Circular buffer size

  /**
   * Track a latency measurement
   * @param eventType Type of event (pty_output, session_create, websocket_send)
   * @param latencyMs Measured latency in milliseconds
   * @param sessionId Optional session ID
   */
  trackLatency(eventType: LatencyMeasurement['eventType'], latencyMs: number, sessionId?: string): void {
    const measurement: LatencyMeasurement = {
      timestamp: performance.now(),
      eventType,
      latencyMs,
      sessionId
    };

    this.measurements.push(measurement);

    // Circular buffer: Remove oldest when exceeding maxSize
    if (this.measurements.length > this.maxSize) {
      this.measurements.shift();
    }
  }

  /**
   * Calculate percentile statistics for a specific event type
   * @param eventType Event type to filter by
   * @returns Statistics with p50, p90, p99, and count
   */
  getStats(eventType: LatencyMeasurement['eventType']): PerformanceStats {
    const filtered = this.measurements.filter(m => m.eventType === eventType);

    if (filtered.length === 0) {
      return { p50: 0, p90: 0, p99: 0, count: 0 };
    }

    // Sort by latency for percentile calculation
    const sorted = filtered.map(m => m.latencyMs).sort((a, b) => a - b);
    const count = sorted.length;

    return {
      p50: this.calculatePercentile(sorted, 0.5),
      p90: this.calculatePercentile(sorted, 0.9),
      p99: this.calculatePercentile(sorted, 0.99),
      count
    };
  }

  /**
   * Get recent measurements (most recent N entries)
   * @param limit Maximum number of entries to return
   * @returns Array of recent measurements
   */
  getRecentMeasurements(limit: number): LatencyMeasurement[] {
    return this.measurements.slice(-limit);
  }

  /**
   * Clear all measurements (for testing/reset)
   */
  clear(): void {
    this.measurements = [];
  }

  /**
   * Calculate a percentile value from a sorted array
   * @param sorted Sorted array of numbers
   * @param percentile Percentile to calculate (0.0 to 1.0)
   * @returns Calculated percentile value
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;

    const index = Math.floor(sorted.length * percentile);
    // Clamp to valid array bounds
    const clampedIndex = Math.min(index, sorted.length - 1);

    return sorted[clampedIndex];
  }
}

/**
 * Singleton instance for global use
 */
export const performanceMonitor = new PerformanceMonitor();
