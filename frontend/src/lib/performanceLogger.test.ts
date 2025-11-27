/**
 * Story 4.10: Performance Optimization and Profiling
 * Unit tests for PerformanceLogger class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceLogger } from './performanceLogger';

describe('PerformanceLogger', () => {
  let logger: PerformanceLogger;

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    logger = new PerformanceLogger();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('track', () => {
    it('should add entry to buffer', () => {
      logger.track('ws_receive', 50);
      const recent = logger.getRecentEntries(1);

      expect(recent).toHaveLength(1);
      expect(recent[0].eventType).toBe('ws_receive');
      expect(recent[0].latencyMs).toBe(50);
    });

    it('should include metadata when provided', () => {
      logger.track('ws_receive', 50, { messageType: 'terminal.output' });
      const recent = logger.getRecentEntries(1);

      expect(recent[0].metadata).toEqual({ messageType: 'terminal.output' });
    });

    it('should include timestamp', () => {
      const before = performance.now();
      logger.track('ws_receive', 50);
      const after = performance.now();
      const recent = logger.getRecentEntries(1);

      expect(recent[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(recent[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should warn on high latency (>150ms)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.track('tab_switch', 200);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('High latency detected'),
        undefined
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not warn on low latency (<150ms)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.track('tab_switch', 100);

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Circular buffer behavior', () => {
    it('should evict oldest entry when exceeding 1000 entries', () => {
      // Add 1001 entries
      for (let i = 0; i < 1001; i++) {
        logger.track('ws_receive', i);
      }

      const recent = logger.getRecentEntries(1001);

      // Should only have 1000 entries
      expect(recent).toHaveLength(1000);

      // First entry should be latency=1 (oldest=0 was evicted)
      expect(recent[0].latencyMs).toBe(1);

      // Last entry should be latency=1000
      expect(recent[999].latencyMs).toBe(1000);
    });

    it('should maintain FIFO order for eviction', () => {
      // Add 1100 entries
      for (let i = 0; i < 1100; i++) {
        logger.track('ws_receive', i);
      }

      const recent = logger.getRecentEntries(1000);

      // Should have evicted first 100 entries (0-99)
      // First entry should be 100
      expect(recent[0].latencyMs).toBe(100);
      // Last entry should be 1099
      expect(recent[999].latencyMs).toBe(1099);
    });
  });

  describe('getStats', () => {
    it('should return zeros when no entries exist', () => {
      const stats = logger.getStats('ws_receive');

      expect(stats).toEqual({
        p50: 0,
        p90: 0,
        p99: 0,
        count: 0
      });
    });

    it('should calculate correct percentiles for uniform distribution', () => {
      // Add 100 entries (0-99ms)
      for (let i = 0; i < 100; i++) {
        logger.track('ws_receive', i);
      }

      const stats = logger.getStats('ws_receive');

      expect(stats.count).toBe(100);
      // p50 should be around 49-50
      expect(stats.p50).toBeGreaterThanOrEqual(49);
      expect(stats.p50).toBeLessThanOrEqual(50);
      // p90 should be around 89-90
      expect(stats.p90).toBeGreaterThanOrEqual(89);
      expect(stats.p90).toBeLessThanOrEqual(90);
      // p99 should be around 98-99
      expect(stats.p99).toBeGreaterThanOrEqual(98);
      expect(stats.p99).toBeLessThanOrEqual(99);
    });

    it('should filter by event type', () => {
      logger.track('ws_receive', 10);
      logger.track('ws_receive', 20);
      logger.track('tab_switch', 5);
      logger.track('session_create', 3000);

      const wsStats = logger.getStats('ws_receive');
      const tabStats = logger.getStats('tab_switch');
      const sessionStats = logger.getStats('session_create');

      expect(wsStats.count).toBe(2);
      expect(tabStats.count).toBe(1);
      expect(sessionStats.count).toBe(1);

      // p50 of [10, 20] sorted = index Math.floor(2 * 0.5) = 1 = 20
      expect(wsStats.p50).toBe(20);
      expect(tabStats.p50).toBe(5);
      expect(sessionStats.p50).toBe(3000);
    });

    it('should handle single entry correctly', () => {
      logger.track('tab_switch', 42);
      const stats = logger.getStats('tab_switch');

      expect(stats).toEqual({
        p50: 42,
        p90: 42,
        p99: 42,
        count: 1
      });
    });
  });

  describe('sessionStorage persistence', () => {
    it('should save to sessionStorage every 10 entries', () => {
      // Add 9 entries - should not save yet
      for (let i = 0; i < 9; i++) {
        logger.track('ws_receive', i);
      }

      expect(sessionStorage.getItem('performance_log')).toBeNull();

      // Add 10th entry - should trigger save
      logger.track('ws_receive', 9);

      const stored = sessionStorage.getItem('performance_log');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(10);
    });

    it('should load from sessionStorage on initialization', () => {
      // Manually set sessionStorage data
      const testData = [
        { timestamp: 1000, eventType: 'ws_receive', latencyMs: 50 },
        { timestamp: 2000, eventType: 'tab_switch', latencyMs: 30 }
      ];
      sessionStorage.setItem('performance_log', JSON.stringify(testData));

      // Create new logger instance
      const newLogger = new PerformanceLogger();
      const entries = newLogger.getRecentEntries(10);

      expect(entries).toHaveLength(2);
      expect(entries[0].eventType).toBe('ws_receive');
      expect(entries[1].eventType).toBe('tab_switch');
    });

    it('should handle corrupted sessionStorage gracefully', () => {
      sessionStorage.setItem('performance_log', 'invalid json');

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      const newLogger = new PerformanceLogger();
      expect(newLogger.getRecentEntries(10)).toHaveLength(0);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load performance log'),
        expect.anything()
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      logger.track('ws_receive', 10);
      logger.track('tab_switch', 20);
      logger.track('session_create', 3000);

      logger.clear();

      const recent = logger.getRecentEntries(100);
      expect(recent).toEqual([]);

      const stats = logger.getStats('ws_receive');
      expect(stats.count).toBe(0);
    });

    it('should clear sessionStorage', () => {
      logger.track('ws_receive', 10);
      logger.saveToSessionStorage();

      expect(sessionStorage.getItem('performance_log')).not.toBeNull();

      logger.clear();

      expect(sessionStorage.getItem('performance_log')).toBeNull();
    });
  });

  describe('getRecentEntries', () => {
    it('should return last N entries', () => {
      for (let i = 0; i < 10; i++) {
        logger.track('ws_receive', i);
      }

      const recent = logger.getRecentEntries(5);

      expect(recent).toHaveLength(5);
      expect(recent[0].latencyMs).toBe(5); // Last 5: 5,6,7,8,9
      expect(recent[4].latencyMs).toBe(9);
    });

    it('should return all entries when limit exceeds count', () => {
      logger.track('ws_receive', 10);
      logger.track('ws_receive', 20);

      const recent = logger.getRecentEntries(100);

      expect(recent).toHaveLength(2);
    });

    it('should return empty array when no entries', () => {
      const recent = logger.getRecentEntries(10);

      expect(recent).toEqual([]);
    });
  });

  describe('Performance validation (NFR targets)', () => {
    it('should track WebSocket receive latencies for p99 <100ms validation', () => {
      // Simulate 100 WebSocket receive latencies with realistic distribution
      const latencies = [
        ...Array(80).fill(0).map(() => Math.random() * 40), // 80% fast (<40ms)
        ...Array(15).fill(0).map(() => 40 + Math.random() * 40), // 15% medium (40-80ms)
        ...Array(5).fill(0).map(() => 80 + Math.random() * 15), // 5% slow (80-95ms)
      ];

      latencies.forEach(latency => {
        logger.track('ws_receive', latency, { test: true });
      });

      const stats = logger.getStats('ws_receive');

      expect(stats.count).toBe(100);
      expect(stats.p99).toBeLessThan(100); // NFR-PERF-1: p99 <100ms
    });

    it('should track tab switch timing for <50ms validation', () => {
      // Simulate 50 tab switches
      const latencies = [
        ...Array(40).fill(0).map(() => Math.random() * 30), // 80% very fast (<30ms)
        ...Array(10).fill(0).map(() => 30 + Math.random() * 15), // 20% acceptable (30-45ms)
      ];

      latencies.forEach(latency => {
        logger.track('tab_switch', latency);
      });

      const stats = logger.getStats('tab_switch');

      expect(stats.count).toBe(50);
      expect(stats.p99).toBeLessThan(50); // NFR-PERF-2: tab switch <50ms
    });

    it('should track session creation timing for <5s validation', () => {
      // Simulate 20 session creations
      const latencies = [
        ...Array(15).fill(0).map(() => 2000 + Math.random() * 1000), // 75% fast (2-3s)
        ...Array(5).fill(0).map(() => 3000 + Math.random() * 1500), // 25% slower (3-4.5s)
      ];

      latencies.forEach(latency => {
        logger.track('session_create', latency);
      });

      const stats = logger.getStats('session_create');

      expect(stats.count).toBe(20);
      expect(stats.p99).toBeLessThan(5000); // NFR-PERF-3: session creation <5s
    });
  });
});
