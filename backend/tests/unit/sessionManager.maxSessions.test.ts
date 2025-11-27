/**
 * Unit tests for MAX_SESSIONS enforcement
 * Story 2.11 Task 1.6: Attempt to create 5th session, verify rejection
 */

import { SessionManager, MaxSessionsError } from '../../src/sessionManager';
import { ptyManager } from '../../src/ptyManager';
import { worktreeManager } from '../../src/worktreeManager';

// Mock dependencies
jest.mock('../../src/ptyManager');
jest.mock('../../src/utils/atomicWrite');
jest.mock('../../src/utils/logger');

// Mock simple-git before importing worktreeManager
jest.mock('simple-git', () => {
  return jest.fn(() => ({
    raw: jest.fn().mockResolvedValue(''),
    checkIsRepo: jest.fn().mockResolvedValue(true),
    revparse: jest.fn().mockResolvedValue('')
  }));
});

jest.mock('../../src/worktreeManager');

describe('SessionManager - MAX_SESSIONS enforcement', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Create a new SessionManager instance for each test
    sessionManager = new SessionManager({
      workspaceRoot: '/tmp/test-workspace',
      maxSessions: 4,
      persistencePath: '/tmp/test-sessions.json'
    });

    // Mock PTYManager.spawn to return a fake PTY process
    (ptyManager.spawn as jest.Mock).mockReturnValue({
      pid: Math.floor(Math.random() * 10000),
      write: jest.fn(),
      kill: jest.fn(),
      onData: jest.fn(),
      onExit: jest.fn(),
      resize: jest.fn()
    });

    // Mock PTYManager.registerPtyProcess
    (ptyManager.registerPtyProcess as jest.Mock).mockImplementation(() => {});

    // Mock PTYManager.unregisterPtyProcess
    (ptyManager.unregisterPtyProcess as jest.Mock).mockImplementation(() => {});

    // Mock worktreeManager.createWorktree
    (worktreeManager.createWorktree as jest.Mock).mockResolvedValue(undefined);

    // Mock worktreeManager.removeWorktree
    (worktreeManager.removeWorktree as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create up to 4 sessions successfully', async () => {
    // Create 4 sessions
    const session1 = await sessionManager.createSession('test-1');
    const session2 = await sessionManager.createSession('test-2');
    const session3 = await sessionManager.createSession('test-3');
    const session4 = await sessionManager.createSession('test-4');

    // Verify all 4 sessions were created
    expect(session1).toBeDefined();
    expect(session1.name).toBe('test-1');
    expect(session2).toBeDefined();
    expect(session2.name).toBe('test-2');
    expect(session3).toBeDefined();
    expect(session3.name).toBe('test-3');
    expect(session4).toBeDefined();
    expect(session4.name).toBe('test-4');

    // Verify session count
    const allSessions = sessionManager.getAllSessions();
    expect(allSessions).toHaveLength(4);
  });

  it('should reject 5th session with MAX_SESSIONS error', async () => {
    // Create 4 sessions
    await sessionManager.createSession('test-1');
    await sessionManager.createSession('test-2');
    await sessionManager.createSession('test-3');
    await sessionManager.createSession('test-4');

    // Attempt to create 5th session
    await expect(sessionManager.createSession('test-5'))
      .rejects
      .toThrow(MaxSessionsError);

    // Verify error message
    try {
      await sessionManager.createSession('test-5');
    } catch (error) {
      expect(error).toBeInstanceOf(MaxSessionsError);
      expect((error as MaxSessionsError).code).toBe('MAX_SESSIONS');
      expect((error as MaxSessionsError).message).toContain('Maximum 4 sessions supported');
      expect((error as MaxSessionsError).message).toContain('Destroy a session to create a new one');
    }

    // Verify session count remains 4
    const allSessions = sessionManager.getAllSessions();
    expect(allSessions).toHaveLength(4);
  });

  it('should allow creating new session after destroying one', async () => {
    // Create 4 sessions
    const session1 = await sessionManager.createSession('test-1');
    await sessionManager.createSession('test-2');
    await sessionManager.createSession('test-3');
    await sessionManager.createSession('test-4');

    // Destroy session 2
    await sessionManager.destroySession(session1.id);

    // Verify session count is now 3
    let allSessions = sessionManager.getAllSessions();
    expect(allSessions).toHaveLength(3);

    // Create new session (should succeed)
    const session5 = await sessionManager.createSession('test-5');
    expect(session5).toBeDefined();
    expect(session5.name).toBe('test-5');

    // Verify session count is back to 4
    allSessions = sessionManager.getAllSessions();
    expect(allSessions).toHaveLength(4);
  });

  it('should not create any session data on MAX_SESSIONS error', async () => {
    // Create 4 sessions
    await sessionManager.createSession('test-1');
    await sessionManager.createSession('test-2');
    await sessionManager.createSession('test-3');
    await sessionManager.createSession('test-4');

    // Track initial mock call counts
    const initialWorktreeCallCount = (worktreeManager.createWorktree as jest.Mock).mock.calls.length;
    const initialPtySpawnCallCount = (ptyManager.spawn as jest.Mock).mock.calls.length;

    // Attempt to create 5th session (should fail)
    await expect(sessionManager.createSession('test-5')).rejects.toThrow(MaxSessionsError);

    // Verify no worktree or PTY was created during the failed attempt
    expect((worktreeManager.createWorktree as jest.Mock).mock.calls.length).toBe(initialWorktreeCallCount);
    expect((ptyManager.spawn as jest.Mock).mock.calls.length).toBe(initialPtySpawnCallCount);

    // Verify session count remains 4
    const allSessions = sessionManager.getAllSessions();
    expect(allSessions).toHaveLength(4);
  });
});
