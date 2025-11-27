/**
 * Unit tests for StatusChecker
 * Story 4.1: Session Status Tracking with Idle Detection
 */

import { StatusChecker } from './statusChecker';
import { SessionManager } from './sessionManager';
import { Session } from './types';

// Mock SessionManager
jest.mock('./sessionManager');

// Mock logger
jest.mock('./utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  logWithSession: jest.fn()
}));

describe('StatusChecker', () => {
  let statusChecker: StatusChecker;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockBroadcast: jest.Mock;
  let mockSessions: Session[];

  beforeEach(() => {
    jest.useFakeTimers();

    // Create mock broadcast function
    mockBroadcast = jest.fn();

    // Create mock SessionManager
    mockSessionManager = new SessionManager() as jest.Mocked<SessionManager>;
    mockSessionManager.getAllSessions = jest.fn();
    mockSessionManager.updateSessionStatus = jest.fn();
    mockSessionManager.saveSessions = jest.fn();

    // Create StatusChecker instance
    statusChecker = new StatusChecker(mockSessionManager, mockBroadcast);

    // Default mock sessions
    mockSessions = [];
  });

  afterEach(() => {
    jest.useRealTimers();
    statusChecker.stop();
  });

  describe('start and stop', () => {
    it('should start the status checker interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      statusChecker.start();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
      setIntervalSpy.mockRestore();
    });

    it('should not start if already running', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      statusChecker.start();
      const firstCallCount = setIntervalSpy.mock.calls.length;

      statusChecker.start();
      const secondCallCount = setIntervalSpy.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
      setIntervalSpy.mockRestore();
    });

    it('should stop the status checker interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      statusChecker.start();
      statusChecker.stop();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('idle detection', () => {
    it('should detect idle session after 5 minutes', async () => {
      // Session with lastActivity 6 minutes ago
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      mockSessions = [{
        id: 'session-1',
        name: 'test-session',
        status: 'active',
        branch: 'main',
        worktreePath: '/workspace/.worktrees/session-1',
        createdAt: sixMinutesAgo.toISOString(),
        lastActivity: sixMinutesAgo.toISOString()
      }];

      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);
      mockSessionManager.updateSessionStatus.mockResolvedValue();

      statusChecker.start();

      // Fast-forward 60 seconds to trigger check
      await jest.advanceTimersByTimeAsync(60000);

      // Should update status to idle
      expect(mockSessionManager.updateSessionStatus).toHaveBeenCalledWith('session-1', 'idle');

      // Should broadcast status message
      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'session.status',
        sessionId: 'session-1',
        status: 'idle',
        lastActivity: sixMinutesAgo.toISOString(),
        isStuck: false
      });
    });

    it('should not detect idle if session is not active', async () => {
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      mockSessions = [{
        id: 'session-1',
        name: 'test-session',
        status: 'idle', // Already idle
        branch: 'main',
        worktreePath: '/workspace/.worktrees/session-1',
        createdAt: sixMinutesAgo.toISOString(),
        lastActivity: sixMinutesAgo.toISOString()
      }];

      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);

      statusChecker.start();
      await jest.advanceTimersByTimeAsync(60000);

      // Should NOT update status again
      expect(mockSessionManager.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('should not detect idle if less than 5 minutes', async () => {
      const now = new Date();
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);

      mockSessions = [{
        id: 'session-1',
        name: 'test-session',
        status: 'active',
        branch: 'main',
        worktreePath: '/workspace/.worktrees/session-1',
        createdAt: fourMinutesAgo.toISOString(),
        lastActivity: fourMinutesAgo.toISOString()
      }];

      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);

      statusChecker.start();
      await jest.advanceTimersByTimeAsync(60000);

      // Should NOT update status
      expect(mockSessionManager.updateSessionStatus).not.toHaveBeenCalled();
    });
  });

  describe('stuck detection', () => {
    it('should send warning after 30 minutes', async () => {
      const now = new Date();
      const thirtyFiveMinutesAgo = new Date(now.getTime() - 35 * 60 * 1000);

      mockSessions = [{
        id: 'session-1',
        name: 'test-session',
        status: 'idle',
        branch: 'main',
        worktreePath: '/workspace/.worktrees/session-1',
        createdAt: thirtyFiveMinutesAgo.toISOString(),
        lastActivity: thirtyFiveMinutesAgo.toISOString(),
        metadata: {}
      }];

      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);
      mockSessionManager.saveSessions.mockResolvedValue();

      statusChecker.start();
      await jest.advanceTimersByTimeAsync(60000);

      // Should broadcast warning message
      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.warning',
          sessionId: 'session-1',
          message: expect.stringContaining('minutes'),
          severity: 'warning'
        })
      );

      // Should broadcast status with isStuck flag
      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.status',
          sessionId: 'session-1',
          isStuck: true
        })
      );

      // Should set stuckSince metadata
      expect(mockSessions[0].metadata?.stuckSince).toBeDefined();
      expect(mockSessions[0].metadata?.lastWarning).toBeDefined();

      // Should persist metadata
      expect(mockSessionManager.saveSessions).toHaveBeenCalled();
    });

    it('should not send warning again within 1 hour', async () => {
      const now = new Date();
      const thirtyFiveMinutesAgo = new Date(now.getTime() - 35 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      mockSessions = [{
        id: 'session-1',
        name: 'test-session',
        status: 'idle',
        branch: 'main',
        worktreePath: '/workspace/.worktrees/session-1',
        createdAt: thirtyFiveMinutesAgo.toISOString(),
        lastActivity: thirtyFiveMinutesAgo.toISOString(),
        metadata: {
          stuckSince: thirtyFiveMinutesAgo.toISOString(),
          lastWarning: tenMinutesAgo.toISOString() // Warned 10 minutes ago
        }
      }];

      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);

      statusChecker.start();
      await jest.advanceTimersByTimeAsync(60000);

      // Should NOT send warning again
      expect(mockBroadcast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.warning'
        })
      );
    });
  });

  describe('error handling', () => {
    it('should continue checking other sessions if one fails', async () => {
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

      mockSessions = [
        {
          id: 'session-1',
          name: 'test-session-1',
          status: 'active',
          branch: 'main',
          worktreePath: '/workspace/.worktrees/session-1',
          createdAt: sixMinutesAgo.toISOString(),
          lastActivity: sixMinutesAgo.toISOString()
        },
        {
          id: 'session-2',
          name: 'test-session-2',
          status: 'active',
          branch: 'main',
          worktreePath: '/workspace/.worktrees/session-2',
          createdAt: sixMinutesAgo.toISOString(),
          lastActivity: sixMinutesAgo.toISOString()
        }
      ];

      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);

      // Make first session fail
      mockSessionManager.updateSessionStatus.mockImplementation((sessionId) => {
        if (sessionId === 'session-1') {
          return Promise.reject(new Error('Test error'));
        }
        return Promise.resolve();
      });

      statusChecker.start();
      await jest.advanceTimersByTimeAsync(60000);

      // Should still update second session
      expect(mockSessionManager.updateSessionStatus).toHaveBeenCalledWith('session-2', 'idle');
    });
  });
});
