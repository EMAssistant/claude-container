/**
 * Story 4.10: Performance Optimization and Profiling
 * Frontend performance logging with latency tracking and percentile calculations
 */

/**
 * Performance entry for frontend events
 * Records client-side performance metrics
 */
export interface PerformanceEntry {
  /** High-resolution timestamp (performance.now()) */
  timestamp: number;
  /** Type of event being measured */
  eventType: 'ws_receive' | 'tab_switch' | 'session_create';
  /** Measured latency in milliseconds */
  latencyMs: number;
  /** Optional metadata for debugging */
  metadata?: Record<string, any>;
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
 * PerformanceLogger class
 * Tracks frontend latency measurements and provides percentile statistics
 *
 * Story 4.10 AC#6: Frontend implements PerformanceLogger
 * - Track WebSocket receive → xterm render latency
 * - Track tab switch timing (click → display)
 * - Track session creation timing (click → ready)
 * - Log to console (development) or sessionStorage (production)
 */
export class PerformanceLogger {
  private entries: PerformanceEntry[] = [];
  private readonly maxSize = 1000; // Circular buffer size
  private saveCounter = 0;
  private readonly SAVE_INTERVAL = 10; // Save to sessionStorage every 10 entries
  private readonly HIGH_LATENCY_THRESHOLD = 150; // Warn threshold in ms

  constructor() {
    // Load persisted entries from sessionStorage on initialization
    this.loadFromSessionStorage();
  }

  /**
   * Track a performance entry
   * @param eventType Type of event (ws_receive, tab_switch, session_create)
   * @param latencyMs Measured latency in milliseconds
   * @param metadata Optional metadata for debugging
   */
  track(eventType: PerformanceEntry['eventType'], latencyMs: number, metadata?: Record<string, any>): void {
    const entry: PerformanceEntry = {
      timestamp: performance.now(),
      eventType,
      latencyMs,
      metadata
    };

    this.entries.push(entry);

    // Circular buffer: Remove oldest when exceeding maxSize
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }

    // Periodically save to sessionStorage
    this.saveCounter++;
    if (this.saveCounter >= this.SAVE_INTERVAL) {
      this.saveToSessionStorage();
      this.saveCounter = 0;
    }

    // Warn on high latency
    if (latencyMs > this.HIGH_LATENCY_THRESHOLD) {
      console.warn(`High latency detected: ${eventType} took ${latencyMs.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Calculate percentile statistics for a specific event type
   * @param eventType Event type to filter by
   * @returns Statistics with p50, p90, p99, and count
   */
  getStats(eventType: PerformanceEntry['eventType']): PerformanceStats {
    const filtered = this.entries.filter(e => e.eventType === eventType);

    if (filtered.length === 0) {
      return { p50: 0, p90: 0, p99: 0, count: 0 };
    }

    // Sort by latency for percentile calculation
    const sorted = filtered.map(e => e.latencyMs).sort((a, b) => a - b);
    const count = sorted.length;

    return {
      p50: this.calculatePercentile(sorted, 0.5),
      p90: this.calculatePercentile(sorted, 0.9),
      p99: this.calculatePercentile(sorted, 0.99),
      count
    };
  }

  /**
   * Log recent performance entries to console
   * Useful for development and debugging
   */
  logToConsole(): void {
    const recent = this.entries.slice(-20);
    console.table(recent.map(e => ({
      eventType: e.eventType,
      latencyMs: e.latencyMs.toFixed(2),
      timestamp: new Date(e.timestamp).toISOString(),
      metadata: e.metadata ? JSON.stringify(e.metadata) : '-'
    })));
  }

  /**
   * Save entries to sessionStorage for persistence across page reloads
   */
  saveToSessionStorage(): void {
    try {
      const data = JSON.stringify(this.entries);
      sessionStorage.setItem('performance_log', data);
    } catch (error) {
      console.warn('Failed to save performance log to sessionStorage', error);
    }
  }

  /**
   * Load entries from sessionStorage
   */
  loadFromSessionStorage(): void {
    try {
      const stored = sessionStorage.getItem('performance_log');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load performance log from sessionStorage', error);
    }
  }

  /**
   * Clear all entries (for testing/reset)
   */
  clear(): void {
    this.entries = [];
    try {
      sessionStorage.removeItem('performance_log');
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Get recent entries (most recent N)
   * @param limit Maximum number of entries to return
   * @returns Array of recent entries
   */
  getRecentEntries(limit: number): PerformanceEntry[] {
    return this.entries.slice(-limit);
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
export const performanceLogger = new PerformanceLogger();
