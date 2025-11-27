/**
 * Unit tests for ZombieCleanup
 * Story 4.8: Resource Monitoring and Limits
 * AC #9: Backend unit tests for zombie cleanup logic
 */

import { ZombieCleanup, createZombieCleanup } from './zombieCleanup';
import type { SessionManager } from './sessionManager';
import { exec } from 'child_process';

// Mock logger
jest.mock('./utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock process.kill
const mockProcessKill = jest.fn();
global.process.kill = mockProcessKill;

describe('ZombieCleanup', () => {
  let sessionManager: SessionManager;
  let zombieCleanup: ZombieCleanup;

  beforeEach(() => {
    // Mock SessionManager
    sessionManager = {
      getActivePIDs: jest.fn().mockReturnValue([1234, 5678])
    } as any;

    // Create ZombieCleanup instance
    zombieCleanup = createZombieCleanup(sessionManager);

    // Clear all mocks
    jest.clearAllMocks();
    mockProcessKill.mockClear();
  });

  afterEach(() => {
    // Stop cleanup
    zombieCleanup.stopCleanup();
  });

  describe('startCleanup and stopCleanup', () => {
    it('should start cleanup timer', () => {
      zombieCleanup.startCleanup();

      expect(zombieCleanup.isCleanupRunning()).toBe(true);

      const { logger } = require('./utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Zombie cleanup started',
        expect.objectContaining({
          cleanupIntervalMs: 60000,
          cleanupTimeoutMs: 5000
        })
      );
    });

    it('should stop cleanup timer', () => {
      zombieCleanup.startCleanup();
      zombieCleanup.stopCleanup();

      expect(zombieCleanup.isCleanupRunning()).toBe(false);

      const { logger } = require('./utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Zombie cleanup stopped');
    });
  });

  describe('zombie process detection', () => {
    it('should detect zombie processes (PID in ps but not in sessions)', () => {
      jest.useFakeTimers();

      // Mock exec to return PIDs 1234, 5678, 9999 (9999 is zombie)
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd: string, callback: any) => {
        callback(null, {
          stdout: '1234 node\n5678 claude\n9999 node\n',
          stderr: ''
        });
        return {} as any;
      });

      zombieCleanup.startCleanup();

      // Advance time by 60 seconds to trigger first cleanup cycle
      jest.advanceTimersByTime(60000);

      // Verify zombie was detected (PID 9999)
      const { logger } = require('./utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie process detected',
        expect.objectContaining({ pid: 9999 })
      );

      jest.useRealTimers();
    });

    it('should not detect active session PIDs as zombies', () => {
      jest.useFakeTimers();

      // Mock exec to return only active session PIDs
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd: string, callback: any) => {
        callback(null, {
          stdout: '1234 node\n5678 claude\n',
          stderr: ''
        });
        return {} as any;
      });

      zombieCleanup.startCleanup();

      // Advance time by 60 seconds to trigger first cleanup cycle
      jest.advanceTimersByTime(60000);

      // Verify no zombies were detected
      const { logger } = require('./utils/logger');
      expect(logger.warn).not.toHaveBeenCalledWith(
        'Zombie process detected',
        expect.anything()
      );

      jest.useRealTimers();
    });
  });

  describe('zombie cleanup', () => {
    it('should send SIGKILL to zombie processes', () => {
      jest.useFakeTimers();

      // Mock exec to return zombie PID 9999
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd: string, callback: any) => {
        callback(null, {
          stdout: '1234 node\n5678 claude\n9999 node\n',
          stderr: ''
        });
        return {} as any;
      });

      zombieCleanup.startCleanup();

      // Advance time by 60 seconds to trigger first cleanup cycle
      jest.advanceTimersByTime(60000);

      // Verify SIGKILL was sent to zombie
      expect(mockProcessKill).toHaveBeenCalledWith(9999, 'SIGKILL');

      const { logger } = require('./utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Zombie process cleaned',
        expect.objectContaining({ pid: 9999 })
      );

      jest.useRealTimers();
    });

    it('should handle errors when killing zombie processes', () => {
      jest.useFakeTimers();

      // Mock exec to return zombie PID 9999
      const mockExec = exec as jest.MockedFunction<typeof exec>;
      mockExec.mockImplementation((_cmd: string, callback: any) => {
        callback(null, {
          stdout: '9999 node\n',
          stderr: ''
        });
        return {} as any;
      });

      // Mock process.kill to throw error
      mockProcessKill.mockImplementation(() => {
        throw new Error('Process not found');
      });

      zombieCleanup.startCleanup();

      // Advance time by 60 seconds to trigger first cleanup cycle
      jest.advanceTimersByTime(60000);

      // Verify error was logged
      const { logger } = require('./utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to kill zombie process',
        expect.objectContaining({ pid: 9999 })
      );

      jest.useRealTimers();
    });
  });

  describe('cleanup cycle timing', () => {
    it('should run cleanup every 60 seconds', () => {
      jest.useFakeTimers();

      const mockExec = exec as jest.MockedFunction<typeof exec>;
      let callCount = 0;
      mockExec.mockImplementation((_cmd: string, callback: any) => {
        callCount++;
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      zombieCleanup.startCleanup();

      // Advance time by 60 seconds
      jest.advanceTimersByTime(60000);

      // Verify cleanup ran
      expect(callCount).toBeGreaterThan(0);

      jest.useRealTimers();
    });
  });
});
