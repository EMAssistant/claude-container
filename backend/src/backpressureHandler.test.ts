/**
 * Unit tests for BackpressureHandler
 * Story 4.6 AC #8: Backend unit tests for backpressure logic
 *
 * Test coverage:
 * - bufferedAmount > 1MB triggers pause
 * - bufferedAmount < 100KB triggers resume
 * - Critical threshold detection (10MB for 10s)
 * - Per-session isolation (multiple sessions, only one throttled)
 * - Cleanup on session destroy
 */

import { BackpressureMonitor } from './backpressureHandler';
import type { WebSocket } from 'ws';
import type { IPty } from 'node-pty';

describe('BackpressureHandler', () => {
  let monitor: BackpressureMonitor;
  let mockWs: any;
  let mockPty: IPty;

  beforeEach(() => {
    // Create new monitor instance for each test
    monitor = new BackpressureMonitor();

    jest.useFakeTimers();

    // Mock WebSocket with mutable properties
    mockWs = {
      readyState: 1, // OPEN
      bufferedAmount: 0,
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

  describe('startMonitoring', () => {
    it('should start monitoring for a session', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Verify monitoring started (state should be initialized)
      const state = monitor.getState(sessionId);
      expect(state).toBeDefined();
      expect(state?.active).toBe(false);
      expect(state?.bufferedAmount).toBe(0);
    });

    it('should not start duplicate monitoring for same session', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);
      const state1 = monitor.getState(sessionId);

      // Try to start again
      monitor.startMonitoring(sessionId, mockWs, mockPty);
      const state2 = monitor.getState(sessionId);

      // Should be the same state object
      expect(state1).toBe(state2);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring and clean up state', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);
      expect(monitor.getState(sessionId)).toBeDefined();

      monitor.stopMonitoring(sessionId);
      expect(monitor.getState(sessionId)).toBeUndefined();
    });

    it('should resume PTY if it was paused', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Simulate backpressure (trigger pause)
      mockWs.bufferedAmount = 2 * 1024 * 1024; // 2MB
      jest.advanceTimersByTime(100);

      expect(monitor.isPaused(sessionId)).toBe(true);

      // Stop monitoring should resume
      monitor.stopMonitoring(sessionId);
      expect(monitor.isPaused(sessionId)).toBe(false);
    });
  });

  describe('backpressure detection', () => {
    it('should trigger pause when bufferedAmount exceeds 1MB', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);
      expect(monitor.isPaused(sessionId)).toBe(false);

      // Simulate high buffered amount (1.5MB)
      mockWs.bufferedAmount = 1.5 * 1024 * 1024;
      jest.advanceTimersByTime(100); // Trigger one check interval

      const state = monitor.getState(sessionId);
      expect(state?.active).toBe(true);
      expect(monitor.isPaused(sessionId)).toBe(true);
    });

    it('should not trigger pause when bufferedAmount is below 1MB', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Simulate moderate buffered amount (500KB)
      mockWs.bufferedAmount = 500 * 1024;
      jest.advanceTimersByTime(100);

      const state = monitor.getState(sessionId);
      expect(state?.active).toBe(false);
      expect(monitor.isPaused(sessionId)).toBe(false);
    });

    it('should trigger resume when bufferedAmount drops below 100KB', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Trigger pause (1.5MB)
      mockWs.bufferedAmount = 1.5 * 1024 * 1024;
      jest.advanceTimersByTime(100);
      expect(monitor.isPaused(sessionId)).toBe(true);

      // Buffer drains to 50KB
      mockWs.bufferedAmount = 50 * 1024;
      jest.advanceTimersByTime(100);

      const state = monitor.getState(sessionId);
      expect(state?.active).toBe(false);
      expect(monitor.isPaused(sessionId)).toBe(false);
    });

    it('should not resume when bufferedAmount is between 100KB and 1MB', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Trigger pause (1.5MB)
      mockWs.bufferedAmount = 1.5 * 1024 * 1024;
      jest.advanceTimersByTime(100);
      expect(monitor.isPaused(sessionId)).toBe(true);

      // Buffer drains to 500KB (still above 100KB threshold)
      mockWs.bufferedAmount = 500 * 1024;
      jest.advanceTimersByTime(100);

      // Should still be paused
      expect(monitor.isPaused(sessionId)).toBe(true);
    });
  });

  describe('critical threshold', () => {
    it('should detect critical threshold when bufferedAmount > 10MB for 10s', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Set bufferedAmount to 11MB
      mockWs.bufferedAmount = 11 * 1024 * 1024;
      jest.advanceTimersByTime(100);

      const state1 = monitor.getState(sessionId);
      expect(state1?.criticalSince).toBeDefined();

      // Wait 10 seconds (100 * 100ms checks)
      jest.advanceTimersByTime(10000);

      const state2 = monitor.getState(sessionId);
      expect(state2?.criticalSince).toBeDefined();
    });

    it('should clear critical state when bufferedAmount drops below 10MB', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Set critical level
      mockWs.bufferedAmount = 11 * 1024 * 1024;
      jest.advanceTimersByTime(100);

      const state1 = monitor.getState(sessionId);
      expect(state1?.criticalSince).toBeDefined();

      // Drop below critical threshold
      mockWs.bufferedAmount = 9 * 1024 * 1024;
      jest.advanceTimersByTime(100);

      const state2 = monitor.getState(sessionId);
      expect(state2?.criticalSince).toBeUndefined();
    });
  });

  describe('per-session isolation', () => {
    it('should isolate backpressure between multiple sessions', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      const mockWs1 = {
        readyState: 1,
        bufferedAmount: 0,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn()
      };
      const mockWs2 = {
        readyState: 1,
        bufferedAmount: 0,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn()
      };

      monitor.startMonitoring(session1, mockWs1 as unknown as WebSocket, mockPty);
      monitor.startMonitoring(session2, mockWs2 as unknown as WebSocket, mockPty);

      // Session 1 has high backpressure
      mockWs1.bufferedAmount = 2 * 1024 * 1024;
      // Session 2 has normal load
      mockWs2.bufferedAmount = 100 * 1024;

      jest.advanceTimersByTime(100);

      // Session 1 should be paused
      expect(monitor.isPaused(session1)).toBe(true);
      // Session 2 should continue normally
      expect(monitor.isPaused(session2)).toBe(false);
    });

    it('should handle multiple sessions with different backpressure states', () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      const mockSockets = sessions.map(() => ({
        readyState: 1,
        bufferedAmount: 0,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn()
      }));

      // Start monitoring all sessions
      sessions.forEach((sessionId, i) => {
        monitor.startMonitoring(sessionId, mockSockets[i] as unknown as WebSocket, mockPty);
      });

      // Set different backpressure levels
      mockSockets[0].bufferedAmount = 2 * 1024 * 1024;   // 2MB - paused
      mockSockets[1].bufferedAmount = 500 * 1024;        // 500KB - active
      mockSockets[2].bufferedAmount = 11 * 1024 * 1024;  // 11MB - critical + paused

      jest.advanceTimersByTime(100);

      expect(monitor.isPaused('session-1')).toBe(true);
      expect(monitor.isPaused('session-2')).toBe(false);
      expect(monitor.isPaused('session-3')).toBe(true);

      const state3 = monitor.getState('session-3');
      expect(state3?.criticalSince).toBeDefined();
    });
  });

  describe('WebSocket state handling', () => {
    it('should skip checks when WebSocket is not open', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      // Close WebSocket
      mockWs.readyState = 3; // CLOSED
      mockWs.bufferedAmount = 2 * 1024 * 1024;

      jest.advanceTimersByTime(100);

      // Should not trigger pause (WebSocket not open)
      expect(monitor.isPaused(sessionId)).toBe(false);
    });
  });

  describe('isPaused', () => {
    it('should return false for unknown session', () => {
      expect(monitor.isPaused('non-existent-session')).toBe(false);
    });

    it('should return correct pause state', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);
      expect(monitor.isPaused(sessionId)).toBe(false);

      // Trigger pause
      mockWs.bufferedAmount = 2 * 1024 * 1024;
      jest.advanceTimersByTime(100);
      expect(monitor.isPaused(sessionId)).toBe(true);

      // Trigger resume
      mockWs.bufferedAmount = 50 * 1024;
      jest.advanceTimersByTime(100);
      expect(monitor.isPaused(sessionId)).toBe(false);
    });
  });

  describe('state tracking', () => {
    it('should update bufferedAmount on each check', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      const amounts = [100 * 1024, 500 * 1024, 1.5 * 1024 * 1024, 200 * 1024];

      amounts.forEach((amount) => {
        mockWs.bufferedAmount = amount;
        jest.advanceTimersByTime(100);

        const state = monitor.getState(sessionId);
        expect(state?.bufferedAmount).toBe(amount);
      });
    });

    it('should update lastCheck timestamp on each check', () => {
      const sessionId = 'test-session-1';

      monitor.startMonitoring(sessionId, mockWs, mockPty);

      const initialState = monitor.getState(sessionId);
      const initialTime = initialState?.lastCheck;

      // Advance time and trigger check
      jest.advanceTimersByTime(100);

      const updatedState = monitor.getState(sessionId);
      expect(updatedState?.lastCheck).toBeGreaterThan(initialTime || 0);
    });
  });
});
