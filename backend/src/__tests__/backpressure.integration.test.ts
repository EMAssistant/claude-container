/**
 * Integration test for WebSocket backpressure handling
 * Story 4.6 AC #9: Integration test for high-volume PTY output
 *
 * Test scenario:
 * - Create session
 * - Simulate PTY outputting 10MB+ data rapidly
 * - Mock WebSocket bufferedAmount increasing
 * - Verify backpressure detected and PTY paused
 * - Simulate buffer draining
 * - Verify PTY resumed
 */

import { BackpressureMonitor } from '../backpressureHandler';
import type { IPty } from 'node-pty';

describe('BackpressureHandler Integration', () => {
  let monitor: BackpressureMonitor;
  let mockWs: any;
  let mockPty: IPty;

  beforeEach(() => {
    monitor = new BackpressureMonitor();
    jest.useFakeTimers();

    // Mock WebSocket with dynamic bufferedAmount
    let currentBufferedAmount = 0;
    mockWs = {
      readyState: 1, // OPEN
      get bufferedAmount() {
        return currentBufferedAmount;
      },
      set bufferedAmount(value: number) {
        currentBufferedAmount = value;
      },
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      removeListener: jest.fn()
    };

    // Mock PTY
    mockPty = {
      pid: 12345,
      onData: jest.fn(),
      write: jest.fn(),
      kill: jest.fn(),
      resize: jest.fn(),
      clear: jest.fn()
    } as unknown as IPty;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should handle high-volume PTY output without memory exhaustion', () => {
    const sessionId = 'integration-test-session';

    // Start monitoring
    monitor.startMonitoring(sessionId, mockWs, mockPty);

    // Simulate rapid PTY output filling WebSocket buffer
    // Simulate 10MB of data being queued
    const chunkSize = 100 * 1024; // 100KB chunks
    const totalChunks = 100; // 10MB total

    for (let i = 0; i < totalChunks; i++) {
      // Simulate WebSocket buffer filling up
      mockWs.bufferedAmount += chunkSize;

      // Advance time for one check interval
      jest.advanceTimersByTime(100);

      // Check if backpressure was triggered at 1MB threshold
      if (mockWs.bufferedAmount > 1024 * 1024) {
        expect(monitor.isPaused(sessionId)).toBe(true);
        break; // Stop simulating once paused
      }
    }

    // Verify backpressure was detected
    expect(monitor.isPaused(sessionId)).toBe(true);
    const state = monitor.getState(sessionId);
    expect(state?.active).toBe(true);

    // Simulate buffer draining (network catches up)
    // Need to drain below 100KB threshold to trigger resume
    while (mockWs.bufferedAmount > 0) {
      mockWs.bufferedAmount -= 200 * 1024; // Drain 200KB per interval
      if (mockWs.bufferedAmount < 0) {
        mockWs.bufferedAmount = 0;
      }
      jest.advanceTimersByTime(100);

      // Break once we've drained below resume threshold
      if (mockWs.bufferedAmount < 100 * 1024) {
        break;
      }
    }

    // Verify backpressure resolved
    expect(monitor.isPaused(sessionId)).toBe(false);
    const finalState = monitor.getState(sessionId);
    expect(finalState?.active).toBe(false);
  });

  it('should handle critical backpressure threshold', () => {
    const sessionId = 'critical-test-session';

    monitor.startMonitoring(sessionId, mockWs, mockPty);

    // Simulate critical buffer size (11MB)
    mockWs.bufferedAmount = 11 * 1024 * 1024;
    jest.advanceTimersByTime(100);

    // Verify critical state detected
    const state1 = monitor.getState(sessionId);
    expect(state1?.criticalSince).toBeDefined();
    expect(monitor.isPaused(sessionId)).toBe(true);

    // Simulate persisting for 10 seconds
    jest.advanceTimersByTime(10000);

    const state2 = monitor.getState(sessionId);
    expect(state2?.criticalSince).toBeDefined();

    // Verify PTY remains paused
    expect(monitor.isPaused(sessionId)).toBe(true);

    // Simulate buffer draining below critical
    mockWs.bufferedAmount = 500 * 1024;
    jest.advanceTimersByTime(100);

    // Critical state should be cleared
    const state3 = monitor.getState(sessionId);
    expect(state3?.criticalSince).toBeUndefined();

    // Should resume at 100KB threshold (need to drain more)
    mockWs.bufferedAmount = 50 * 1024;
    jest.advanceTimersByTime(100);
    expect(monitor.isPaused(sessionId)).toBe(false);
  });

  it('should cleanup state when session destroyed', () => {
    const sessionId = 'cleanup-test-session';

    monitor.startMonitoring(sessionId, mockWs, mockPty);

    // Trigger backpressure
    mockWs.bufferedAmount = 2 * 1024 * 1024;
    jest.advanceTimersByTime(100);

    expect(monitor.isPaused(sessionId)).toBe(true);
    expect(monitor.getState(sessionId)).toBeDefined();

    // Stop monitoring (simulates session destroy)
    monitor.stopMonitoring(sessionId);

    // Verify cleanup
    expect(monitor.getState(sessionId)).toBeUndefined();
    expect(monitor.isPaused(sessionId)).toBe(false);
  });

  it('should handle burst traffic patterns', () => {
    const sessionId = 'burst-test-session';

    monitor.startMonitoring(sessionId, mockWs, mockPty);

    // Simulate burst: rapid increase
    mockWs.bufferedAmount = 2 * 1024 * 1024; // 2MB burst
    jest.advanceTimersByTime(100);
    expect(monitor.isPaused(sessionId)).toBe(true);

    // Simulate partial drain
    mockWs.bufferedAmount = 800 * 1024; // Still above 100KB
    jest.advanceTimersByTime(100);
    expect(monitor.isPaused(sessionId)).toBe(true); // Still paused

    // Another burst
    mockWs.bufferedAmount = 1.5 * 1024 * 1024;
    jest.advanceTimersByTime(100);
    expect(monitor.isPaused(sessionId)).toBe(true);

    // Full drain
    mockWs.bufferedAmount = 50 * 1024;
    jest.advanceTimersByTime(100);
    expect(monitor.isPaused(sessionId)).toBe(false);
  });

  it('should maintain per-session isolation under load', () => {
    const sessions = ['session-1', 'session-2', 'session-3'];
    const mockSockets: any[] = sessions.map(() => {
      let amount = 0;
      return {
        readyState: 1,
        get bufferedAmount() {
          return amount;
        },
        set bufferedAmount(value: number) {
          amount = value;
        },
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn()
      };
    });

    // Start monitoring all sessions
    sessions.forEach((sessionId, i) => {
      monitor.startMonitoring(sessionId, mockSockets[i], mockPty);
    });

    // Simulate different load patterns
    // Session 1: High load (paused)
    mockSockets[0].bufferedAmount = 2 * 1024 * 1024;
    // Session 2: Normal load
    mockSockets[1].bufferedAmount = 500 * 1024;
    // Session 3: Critical load
    mockSockets[2].bufferedAmount = 12 * 1024 * 1024;

    jest.advanceTimersByTime(100);

    // Verify isolation
    expect(monitor.isPaused('session-1')).toBe(true);
    expect(monitor.isPaused('session-2')).toBe(false);
    expect(monitor.isPaused('session-3')).toBe(true);

    // Session 1 drains
    mockSockets[0].bufferedAmount = 50 * 1024;
    jest.advanceTimersByTime(100);

    // Only session 1 should resume
    expect(monitor.isPaused('session-1')).toBe(false);
    expect(monitor.isPaused('session-2')).toBe(false);
    expect(monitor.isPaused('session-3')).toBe(true);
  });

  it('should handle WebSocket connection state changes', () => {
    const sessionId = 'connection-test-session';

    monitor.startMonitoring(sessionId, mockWs, mockPty);

    // Trigger backpressure
    mockWs.bufferedAmount = 2 * 1024 * 1024;
    jest.advanceTimersByTime(100);
    expect(monitor.isPaused(sessionId)).toBe(true);

    // WebSocket closes
    mockWs.readyState = 3; // CLOSED
    jest.advanceTimersByTime(100);

    // Monitoring should continue but not update state
    // (state remains paused until explicitly stopped)
    expect(monitor.isPaused(sessionId)).toBe(true);

    // Stop monitoring
    monitor.stopMonitoring(sessionId);
    expect(monitor.isPaused(sessionId)).toBe(false);
  });
});
