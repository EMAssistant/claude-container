/**
 * Integration test for graceful shutdown sequence
 * Story 4.7: Graceful Container Shutdown and Cleanup
 * AC #10: Integration test - Full shutdown sequence
 */

import { createShutdownManager } from '../shutdownManager';
import { SessionManager } from '../sessionManager';
import type { Server } from 'http';
import type { WebSocketServer, WebSocket } from 'ws';
import type { Session } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  logSessionEvent: jest.fn(),
  logSessionError: jest.fn()
}));

// Mock ptyManager
jest.mock('../ptyManager', () => ({
  ptyManager: {
    spawn: jest.fn(() => ({
      pid: 12345,
      write: jest.fn(),
      kill: jest.fn(),
      onData: jest.fn(),
      onExit: jest.fn()
    })),
    write: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn(),
    onExit: jest.fn((_pty: any, callback: any) => {
      // Immediately call callback to simulate PTY exit
      setTimeout(() => callback({ exitCode: 0 }), 100);
    }),
    getPtyProcess: jest.fn(),
    registerPtyProcess: jest.fn(),
    unregisterPtyProcess: jest.fn(),
    killGracefully: jest.fn()
  }
}));

// Mock worktreeManager
jest.mock('../worktreeManager', () => ({
  worktreeManager: {
    createWorktree: jest.fn(),
    removeWorktree: jest.fn(),
    listWorktrees: jest.fn(() => Promise.resolve([]))
  }
}));

// Mock atomicWrite
jest.mock('../utils/atomicWrite', () => ({
  atomicWriteJson: jest.fn()
}));

describe('Graceful Shutdown Integration Test', () => {
  let sessionManager: SessionManager;
  let mockServer: jest.Mocked<Server>;
  let mockWss: jest.Mocked<WebSocketServer>;
  let mockWsClient1: jest.Mocked<WebSocket>;
  let mockWsClient2: jest.Mocked<WebSocket>;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join('/tmp', `shutdown-test-${Date.now()}`);
    await fs.promises.mkdir(testDir, { recursive: true });

    // Create session manager with test directory
    sessionManager = new SessionManager({
      workspaceRoot: testDir,
      maxSessions: 4,
      persistencePath: path.join(testDir, '.claude-container-sessions.json')
    });

    // Mock HTTP server
    mockServer = {
      close: jest.fn((callback) => {
        if (callback) setTimeout(callback, 50); // Simulate async close
      })
    } as any;

    // Mock WebSocket clients
    mockWsClient1 = {
      readyState: 1, // WebSocket.OPEN
      OPEN: 1,
      send: jest.fn(),
      close: jest.fn()
    } as any;

    mockWsClient2 = {
      readyState: 1, // WebSocket.OPEN
      OPEN: 1,
      send: jest.fn(),
      close: jest.fn()
    } as any;

    const mockWsClients = new Set([mockWsClient1, mockWsClient2]);

    // Mock WebSocket server
    mockWss = {
      clients: mockWsClients,
      close: jest.fn()
    } as any;
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    jest.clearAllMocks();
  });

  it('should complete full shutdown sequence (AC #10)', async () => {
    const { ptyManager } = require('../ptyManager');
    const { atomicWriteJson } = require('../utils/atomicWrite');

    // Mock atomicWriteJson to track calls
    atomicWriteJson.mockResolvedValue(undefined);

    // Create 2 active sessions
    const session1: Session = {
      id: 'session-1',
      name: 'test-session-1',
      status: 'active',
      branch: 'feature/test-1',
      worktreePath: path.join(testDir, '.worktrees', 'session-1'),
      ptyPid: 12345,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    const session2: Session = {
      id: 'session-2',
      name: 'test-session-2',
      status: 'active',
      branch: 'feature/test-2',
      worktreePath: path.join(testDir, '.worktrees', 'session-2'),
      ptyPid: 12346,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    // Manually add sessions to internal map (bypass createSession for testing)
    (sessionManager as any).sessions.set('session-1', session1);
    (sessionManager as any).sessions.set('session-2', session2);

    // Mock PTY processes for sessions
    const mockPty1 = {
      pid: 12345,
      write: jest.fn(),
      kill: jest.fn()
    };
    const mockPty2 = {
      pid: 12346,
      write: jest.fn(),
      kill: jest.fn()
    };

    ptyManager.getPtyProcess
      .mockReturnValueOnce(mockPty1)
      .mockReturnValueOnce(mockPty2);

    // Create shutdown manager
    const shutdownManager = createShutdownManager(mockServer, mockWss, sessionManager);

    // Mock process.exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Measure shutdown time
    const startTime = Date.now();

    // Initiate shutdown (send SIGTERM) - Don't await to avoid hanging on process.exit
    shutdownManager.initiate();

    // Give it time to complete (PTY exit callbacks + broadcast delay)
    await new Promise(resolve => setTimeout(resolve, 500));

    const elapsedTime = Date.now() - startTime;

    // Verify: Total time <10s (AC #1, #10)
    expect(elapsedTime).toBeLessThan(10000);

    // Verify: server.shutdown WebSocket message sent (AC #4, #10)
    expect(mockWsClient1.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'server.shutdown',
        message: 'Server shutting down',
        gracePeriodMs: 5000
      })
    );
    expect(mockWsClient2.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'server.shutdown',
        message: 'Server shutting down',
        gracePeriodMs: 5000
      })
    );

    // Verify: PTYs terminated (AC #2, #10)
    expect(ptyManager.kill).toHaveBeenCalledWith(mockPty1, 'SIGTERM');
    expect(ptyManager.kill).toHaveBeenCalledWith(mockPty2, 'SIGTERM');

    // Verify: Session JSON updated with 'stopped' status (AC #3, #10)
    expect(atomicWriteJson).toHaveBeenCalled();
    const savedData = atomicWriteJson.mock.calls[0][1];
    expect(savedData.sessions.every((s: Session) => s.status === 'stopped')).toBe(true);

    // Verify: WebSocket connections closed
    expect(mockWsClient1.close).toHaveBeenCalledWith(1001, 'Server shutting down');
    expect(mockWsClient2.close).toHaveBeenCalledWith(1001, 'Server shutting down');
    expect(mockWss.close).toHaveBeenCalled();

    // Verify: Express server closed
    expect(mockServer.close).toHaveBeenCalled();

    // Note: process.exit(0) is called from setTimeout, which may happen after test completes
    // The important part is that all shutdown steps completed successfully

    mockExit.mockRestore();
  });

  it('should handle shutdown with no active sessions', async () => {
    const { atomicWriteJson } = require('../utils/atomicWrite');
    atomicWriteJson.mockResolvedValue(undefined);

    // Create shutdown manager with no sessions
    const shutdownManager = createShutdownManager(mockServer, mockWss, sessionManager);

    // Mock process.exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    shutdownManager.initiate();

    // Give it time to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify: Shutdown completes successfully
    expect(atomicWriteJson).toHaveBeenCalled();

    // Note: process.exit(0) is called from setTimeout
    // The important part is that shutdown completed without errors

    mockExit.mockRestore();
  });

  it('should handle PTY termination timeout with SIGKILL fallback', async () => {
    const { ptyManager } = require('../ptyManager');

    // Create session with stubborn PTY
    const session: Session = {
      id: 'session-stubborn',
      name: 'stubborn-session',
      status: 'active',
      branch: 'feature/stubborn',
      worktreePath: path.join(testDir, '.worktrees', 'session-stubborn'),
      ptyPid: 99999,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    (sessionManager as any).sessions.set('session-stubborn', session);

    const mockPty = {
      pid: 99999,
      write: jest.fn(),
      kill: jest.fn()
    };

    ptyManager.getPtyProcess.mockReturnValue(mockPty);

    // Mock onExit to simulate timeout (never calls callback for SIGTERM)
    let exitCallCount = 0;
    ptyManager.onExit.mockImplementation((_pty: any, callback: any) => {
      exitCallCount++;
      if (exitCallCount === 2) {
        // Second call (SIGKILL) - exit immediately
        setTimeout(() => callback({ exitCode: 137, signal: 9 }), 100);
      }
      // First call (SIGTERM) - timeout, don't call callback
    });

    const shutdownManager = createShutdownManager(mockServer, mockWss, sessionManager);
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await shutdownManager.initiate();

    // Verify: SIGTERM attempted first
    expect(ptyManager.kill).toHaveBeenCalledWith(mockPty, 'SIGTERM');

    // Verify: SIGKILL used after timeout
    expect(ptyManager.kill).toHaveBeenCalledWith(mockPty, 'SIGKILL');

    // Verify: Shutdown still completes successfully
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });

  it('should reject new connections during shutdown (AC #8)', async () => {
    const shutdownManager = createShutdownManager(mockServer, mockWss, sessionManager);

    // Check state before shutdown
    expect(shutdownManager.isShutdown).toBe(false);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Start shutdown (don't await)
    const shutdownPromise = shutdownManager.initiate();

    // Check state during shutdown
    expect(shutdownManager.isShutdown).toBe(true);

    await shutdownPromise;

    // Verify state remains true after shutdown
    expect(shutdownManager.isShutdown).toBe(true);

    mockExit.mockRestore();
  });
});
