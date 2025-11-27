/**
 * Story 4.10: Performance Optimization and Profiling
 * Unit tests for PerformanceMonitor class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PerformanceMonitor } from './performanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('trackLatency', () => {
    it('should add measurement to buffer', () => {
      monitor.trackLatency('pty_output', 50);
      const recent = monitor.getRecentMeasurements(1);

      expect(recent).toHaveLength(1);
      expect(recent[0].eventType).toBe('pty_output');
      expect(recent[0].latencyMs).toBe(50);
    });

    it('should include sessionId when provided', () => {
      monitor.trackLatency('pty_output', 50, 'session-123');
      const recent = monitor.getRecentMeasurements(1);

      expect(recent[0].sessionId).toBe('session-123');
    });

    it('should include timestamp', () => {
      const before = performance.now();
      monitor.trackLatency('pty_output', 50);
      const after = performance.now();
      const recent = monitor.getRecentMeasurements(1);

      expect(recent[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(recent[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Circular buffer behavior', () => {
    it('should evict oldest measurement when exceeding 1000 entries', () => {
      // Add 1001 measurements
      for (let i = 0; i < 1001; i++) {
        monitor.trackLatency('pty_output', i);
      }

      const recent = monitor.getRecentMeasurements(1001);

      // Should only have 1000 measurements
      expect(recent).toHaveLength(1000);

      // First measurement should be latency=1 (oldest=0 was evicted)
      expect(recent[0].latencyMs).toBe(1);

      // Last measurement should be latency=1000
      expect(recent[999].latencyMs).toBe(1000);
    });

    it('should maintain FIFO order for eviction', () => {
      // Add 1100 measurements
      for (let i = 0; i < 1100; i++) {
        monitor.trackLatency('pty_output', i);
      }

      const recent = monitor.getRecentMeasurements(1000);

      // Should have evicted first 100 measurements (0-99)
      // First entry should be 100
      expect(recent[0].latencyMs).toBe(100);
      // Last entry should be 1099
      expect(recent[999].latencyMs).toBe(1099);
    });
  });

  describe('getStats', () => {
    it('should return zeros when no measurements exist', () => {
      const stats = monitor.getStats('pty_output');

      expect(stats).toEqual({
        p50: 0,
        p90: 0,
        p99: 0,
        count: 0
      });
    });

    it('should calculate correct percentiles for uniform distribution', () => {
      // Add 100 measurements (0-99ms)
      for (let i = 0; i < 100; i++) {
        monitor.trackLatency('pty_output', i);
      }

      const stats = monitor.getStats('pty_output');

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
      monitor.trackLatency('pty_output', 10);
      monitor.trackLatency('pty_output', 20);
      monitor.trackLatency('session_create', 100);
      monitor.trackLatency('websocket_send', 5);

      const ptyStats = monitor.getStats('pty_output');
      const sessionStats = monitor.getStats('session_create');
      const wsStats = monitor.getStats('websocket_send');

      expect(ptyStats.count).toBe(2);
      expect(sessionStats.count).toBe(1);
      expect(wsStats.count).toBe(1);

      // p50 of [10, 20] sorted = index Math.floor(2 * 0.5) = 1 = 20
      expect(ptyStats.p50).toBe(20);
      expect(sessionStats.p50).toBe(100);
      expect(wsStats.p50).toBe(5);
    });

    it('should handle single measurement correctly', () => {
      monitor.trackLatency('pty_output', 42);
      const stats = monitor.getStats('pty_output');

      expect(stats).toEqual({
        p50: 42,
        p90: 42,
        p99: 42,
        count: 1
      });
    });

    it('should handle two measurements correctly', () => {
      monitor.trackLatency('pty_output', 10);
      monitor.trackLatency('pty_output', 90);
      const stats = monitor.getStats('pty_output');

      expect(stats.count).toBe(2);
      // sorted = [10, 90]
      // p50 = index Math.floor(2 * 0.5) = 1 = 90
      // p90 = index Math.floor(2 * 0.9) = 1 = 90
      // p99 = index Math.floor(2 * 0.99) = 1 (clamped) = 90
      expect(stats.p50).toBe(90);
      expect(stats.p90).toBe(90);
      expect(stats.p99).toBe(90);
    });
  });

  describe('getRecentMeasurements', () => {
    it('should return last N entries', () => {
      for (let i = 0; i < 10; i++) {
        monitor.trackLatency('pty_output', i);
      }

      const recent = monitor.getRecentMeasurements(5);

      expect(recent).toHaveLength(5);
      expect(recent[0].latencyMs).toBe(5); // Last 5: 5,6,7,8,9
      expect(recent[4].latencyMs).toBe(9);
    });

    it('should return all entries when limit exceeds count', () => {
      monitor.trackLatency('pty_output', 10);
      monitor.trackLatency('pty_output', 20);

      const recent = monitor.getRecentMeasurements(100);

      expect(recent).toHaveLength(2);
    });

    it('should return empty array when no measurements', () => {
      const recent = monitor.getRecentMeasurements(10);

      expect(recent).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all measurements', () => {
      monitor.trackLatency('pty_output', 10);
      monitor.trackLatency('pty_output', 20);
      monitor.trackLatency('session_create', 100);

      monitor.clear();

      const recent = monitor.getRecentMeasurements(100);
      expect(recent).toEqual([]);

      const stats = monitor.getStats('pty_output');
      expect(stats.count).toBe(0);
    });
  });

  describe('Performance validation (NFR targets)', () => {
    it('should track terminal latency measurements for p99 <100ms validation', () => {
      // Simulate 100 terminal output latencies with realistic distribution
      const latencies = [
        ...Array(80).fill(0).map(() => Math.random() * 50), // 80% fast (<50ms)
        ...Array(15).fill(0).map(() => 50 + Math.random() * 30), // 15% medium (50-80ms)
        ...Array(5).fill(0).map(() => 80 + Math.random() * 15), // 5% slow (80-95ms)
      ];

      latencies.forEach(latency => {
        monitor.trackLatency('pty_output', latency);
      });

      const stats = monitor.getStats('pty_output');

      expect(stats.count).toBe(100);
      expect(stats.p99).toBeLessThan(100); // NFR-PERF-1: p99 <100ms
    });

    it('should track multiple event types independently', () => {
      monitor.trackLatency('pty_output', 50, 'session-1');
      monitor.trackLatency('session_create', 3000, 'session-1');
      monitor.trackLatency('websocket_send', 10, 'session-1');

      const ptyStats = monitor.getStats('pty_output');
      const sessionStats = monitor.getStats('session_create');
      const wsStats = monitor.getStats('websocket_send');

      expect(ptyStats.count).toBe(1);
      expect(sessionStats.count).toBe(1);
      expect(wsStats.count).toBe(1);

      // Verify no cross-contamination
      expect(ptyStats.p50).toBe(50);
      expect(sessionStats.p50).toBe(3000);
      expect(wsStats.p50).toBe(10);
    });
  });
});
