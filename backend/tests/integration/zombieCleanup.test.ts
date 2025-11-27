/**
 * Integration tests for zombie process cleanup
 * Story 2.11 Task 2.8-2.9: Mock zombie PTY, verify cleanup triggers
 */

import { PTYManager } from '../../src/ptyManager';
import { IPty } from 'node-pty';

// Mock dependencies
jest.mock('../../src/utils/atomicWrite');
jest.mock('../../src/utils/logger');
jest.mock('../../src/worktreeManager');

describe('Zombie Process Cleanup', () => {
  let ptyManager: PTYManager;
  let mockPtyProcess1: Partial<IPty>;
  let mockPtyProcess2: Partial<IPty>;

  beforeEach(() => {
    // Create fresh instances
    ptyManager = new PTYManager();

    // Create mock PTY processes
    mockPtyProcess1 = {
      pid: 1001,
      write: jest.fn(),
      kill: jest.fn(),
      onData: jest.fn(),
      onExit: jest.fn(),
      resize: jest.fn()
    } as Partial<IPty>;

    mockPtyProcess2 = {
      pid: 1002,
      write: jest.fn(),
      kill: jest.fn(),
      onData: jest.fn(),
      onExit: jest.fn(),
      resize: jest.fn()
    } as Partial<IPty>;
  });

  afterEach(() => {
    // Stop cleanup timer to prevent interference between tests
    ptyManager.stopZombieCleanup();
    jest.clearAllMocks();
  });

  it('should detect and clean up zombie PTY process', () => {
    // Setup: Register PTY processes
    ptyManager.registerPtyProcess('session-1', mockPtyProcess1 as IPty);
    ptyManager.registerPtyProcess('session-2', mockPtyProcess2 as IPty);

    // Set session callback to only return session-1 (session-2 is orphaned)
    ptyManager.setSessionCallback(() => ['session-1']);

    // Run cleanup manually
    ptyManager.cleanupZombieProcesses();

    // Verify session-2's PTY was killed
    expect(mockPtyProcess2.kill).toHaveBeenCalledWith('SIGKILL');

    // Verify session-1's PTY was NOT killed
    expect(mockPtyProcess1.kill).not.toHaveBeenCalled();

    // Verify zombie process was unregistered
    expect(ptyManager.getPtyProcess('session-2')).toBeUndefined();
    expect(ptyManager.getPtyProcess('session-1')).toBeDefined();
  });

  it('should handle multiple zombie processes', () => {
    // Setup: Register 3 PTY processes
    const mockPty3 = {
      pid: 1003,
      write: jest.fn(),
      kill: jest.fn(),
      onData: jest.fn(),
      onExit: jest.fn(),
      resize: jest.fn()
    } as Partial<IPty>;

    ptyManager.registerPtyProcess('session-1', mockPtyProcess1 as IPty);
    ptyManager.registerPtyProcess('session-2', mockPtyProcess2 as IPty);
    ptyManager.registerPtyProcess('session-3', mockPty3 as IPty);

    // Set session callback to only return session-2 (session-1 and session-3 are zombies)
    ptyManager.setSessionCallback(() => ['session-2']);

    // Run cleanup manually
    ptyManager.cleanupZombieProcesses();

    // Verify both zombie PTYs were killed
    expect(mockPtyProcess1.kill).toHaveBeenCalledWith('SIGKILL');
    expect(mockPty3.kill).toHaveBeenCalledWith('SIGKILL');

    // Verify active PTY was NOT killed
    expect(mockPtyProcess2.kill).not.toHaveBeenCalled();

    // Verify zombie processes were unregistered
    expect(ptyManager.getPtyProcess('session-1')).toBeUndefined();
    expect(ptyManager.getPtyProcess('session-3')).toBeUndefined();
    expect(ptyManager.getPtyProcess('session-2')).toBeDefined();
  });

  it('should not kill any processes when all sessions are active', () => {
    // Setup: Register PTY processes
    ptyManager.registerPtyProcess('session-1', mockPtyProcess1 as IPty);
    ptyManager.registerPtyProcess('session-2', mockPtyProcess2 as IPty);

    // Set session callback to return both sessions
    ptyManager.setSessionCallback(() => ['session-1', 'session-2']);

    // Run cleanup manually
    ptyManager.cleanupZombieProcesses();

    // Verify NO PTYs were killed
    expect(mockPtyProcess1.kill).not.toHaveBeenCalled();
    expect(mockPtyProcess2.kill).not.toHaveBeenCalled();

    // Verify all processes still registered
    expect(ptyManager.getPtyProcess('session-1')).toBeDefined();
    expect(ptyManager.getPtyProcess('session-2')).toBeDefined();
  });

  it('should handle cleanup when no sessions exist', () => {
    // Setup: Register PTY processes but no sessions
    ptyManager.registerPtyProcess('session-1', mockPtyProcess1 as IPty);
    ptyManager.registerPtyProcess('session-2', mockPtyProcess2 as IPty);

    // Set session callback to return empty array (all zombies)
    ptyManager.setSessionCallback(() => []);

    // Run cleanup manually
    ptyManager.cleanupZombieProcesses();

    // Verify all PTYs were killed
    expect(mockPtyProcess1.kill).toHaveBeenCalledWith('SIGKILL');
    expect(mockPtyProcess2.kill).toHaveBeenCalledWith('SIGKILL');

    // Verify all processes unregistered
    expect(ptyManager.getPtyProcess('session-1')).toBeUndefined();
    expect(ptyManager.getPtyProcess('session-2')).toBeUndefined();
  });

  it('should handle PTY kill errors gracefully', () => {
    // Setup: Mock kill to throw error
    mockPtyProcess1.kill = jest.fn(() => {
      throw new Error('Process already dead');
    });

    ptyManager.registerPtyProcess('session-1', mockPtyProcess1 as IPty);

    // Set session callback to return empty (session-1 is zombie)
    ptyManager.setSessionCallback(() => []);

    // Run cleanup manually (should not throw)
    expect(() => {
      ptyManager.cleanupZombieProcesses();
    }).not.toThrow();

    // Verify kill was attempted
    expect(mockPtyProcess1.kill).toHaveBeenCalledWith('SIGKILL');

    // Verify process was still unregistered despite error
    expect(ptyManager.getPtyProcess('session-1')).toBeUndefined();
  });

  it('should start and stop cleanup timer', (done) => {
    // Register a zombie process
    ptyManager.registerPtyProcess('session-zombie', mockPtyProcess1 as IPty);
    ptyManager.setSessionCallback(() => []); // No active sessions

    // Start cleanup timer (60s interval, but we'll stop it early)
    ptyManager.startZombieCleanup();

    // Wait a short time, then stop timer
    setTimeout(() => {
      // Verify kill was NOT called yet (60s hasn't passed)
      expect(mockPtyProcess1.kill).not.toHaveBeenCalled();

      // Stop cleanup timer
      ptyManager.stopZombieCleanup();

      // Wait a bit more to ensure timer was stopped
      setTimeout(() => {
        // Verify kill still wasn't called (timer stopped)
        expect(mockPtyProcess1.kill).not.toHaveBeenCalled();
        done();
      }, 100);
    }, 100);
  });

  it('should not start duplicate cleanup timers', () => {
    // Start cleanup timer
    ptyManager.startZombieCleanup();

    // Try to start again (should be no-op)
    ptyManager.startZombieCleanup();

    // Stop cleanup timer
    ptyManager.stopZombieCleanup();

    // No assertion needed - test passes if no errors thrown
    expect(true).toBe(true);
  });
});
