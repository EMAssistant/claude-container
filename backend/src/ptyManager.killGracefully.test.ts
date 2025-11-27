/**
 * PTYManager.killGracefully() Unit Tests
 * Story 2.7: Session Destruction with Cleanup Options
 *
 * Tests:
 * - AC #6: Graceful PTY shutdown with timeout
 * - SIGTERM → 5s timeout → SIGKILL logic
 */

import { PTYManager } from './ptyManager';
import type { IPty } from 'node-pty';

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

describe('PTYManager.killGracefully()', () => {
  let ptyManager: PTYManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    ptyManager = new PTYManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should send SIGTERM and resolve when process exits gracefully', async () => {
    const mockPty = {
      pid: 12345,
      kill: jest.fn(),
      onExit: jest.fn((callback: (e: { exitCode: number; signal?: number }) => void) => {
        // Simulate immediate exit
        setTimeout(() => callback({ exitCode: 0 }), 100);
        return { dispose: jest.fn() }; // Return IDisposable
      }),
    } as unknown as IPty;

    const killPromise = ptyManager.killGracefully(mockPty as IPty);

    // Fast-forward to process exit
    jest.advanceTimersByTime(100);

    await killPromise;

    // Verify SIGTERM was sent
    expect(mockPty.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mockPty.kill).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('should send SIGKILL after 5 second timeout if process does not exit', async () => {
    const mockPty: Partial<IPty> = {
      pid: 12345,
      kill: jest.fn(),
      onExit: jest.fn(),
    };

    const killPromise = ptyManager.killGracefully(mockPty as IPty, 5000);

    // Fast-forward past timeout
    jest.advanceTimersByTime(5000);

    await killPromise;

    // Verify SIGTERM was sent first, then SIGKILL
    expect(mockPty.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mockPty.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should use custom timeout value', async () => {
    const mockPty: Partial<IPty> = {
      pid: 12345,
      kill: jest.fn(),
      onExit: jest.fn(),
    };

    const customTimeout = 3000;
    const killPromise = ptyManager.killGracefully(mockPty as IPty, customTimeout);

    // Fast-forward to just before timeout
    jest.advanceTimersByTime(customTimeout - 100);
    expect(mockPty.kill).toHaveBeenCalledTimes(1); // Only SIGTERM

    // Fast-forward past timeout
    jest.advanceTimersByTime(100);

    await killPromise;

    // Verify SIGKILL was sent after custom timeout
    expect(mockPty.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should resolve immediately if SIGTERM fails (process already dead)', async () => {
    const mockPty: Partial<IPty> = {
      pid: 12345,
      kill: jest.fn(() => {
        throw new Error('Process not found');
      }),
      onExit: jest.fn(),
    };

    const killPromise = ptyManager.killGracefully(mockPty as IPty);

    await killPromise;

    // Verify SIGTERM was attempted but SIGKILL was not sent
    expect(mockPty.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mockPty.kill).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('should not send SIGKILL if process exits before timeout', async () => {
    const mockPty = {
      pid: 12345,
      kill: jest.fn(),
      onExit: jest.fn((callback: (e: { exitCode: number; signal?: number }) => void) => {
        // Exit after 2 seconds (before 5 second timeout)
        setTimeout(() => callback({ exitCode: 0 }), 2000);
        return { dispose: jest.fn() }; // Return IDisposable
      }),
    } as unknown as IPty;

    const killPromise = ptyManager.killGracefully(mockPty as IPty, 5000);

    // Fast-forward to process exit (2 seconds)
    jest.advanceTimersByTime(2000);

    await killPromise;

    // Verify only SIGTERM was sent
    expect(mockPty.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mockPty.kill).not.toHaveBeenCalledWith('SIGKILL');
  });
});
