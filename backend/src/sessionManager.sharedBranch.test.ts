/**
 * Unit tests for Story 4.15: Multiple Sessions on Same Branch
 * Tests shared branch functionality, session count metadata, and getSessionsByBranch
 */

import { SessionManager } from './sessionManager';
import { ptyManager } from './ptyManager';
import { worktreeManager } from './worktreeManager';

// Mock dependencies
jest.mock('./ptyManager');
jest.mock('./utils/atomicWrite');
jest.mock('./utils/logger');

// Mock simple-git before importing worktreeManager
jest.mock('simple-git', () => {
  return jest.fn(() => ({
    raw: jest.fn().mockResolvedValue(''),
    checkIsRepo: jest.fn().mockResolvedValue(true),
    revparse: jest.fn().mockResolvedValue(''),
    branchLocal: jest.fn().mockResolvedValue({
      all: ['main', 'feature/auth', 'feature/payments'],
      branches: {},
      current: 'main'
    })
  }));
});

jest.mock('./worktreeManager');

describe('SessionManager - Story 4.15: Multiple Sessions on Same Branch', () => {
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

    // Mock worktreeManager.createWorktreeFromExistingBranch
    (worktreeManager.createWorktreeFromExistingBranch as jest.Mock).mockResolvedValue(undefined);

    // Mock worktreeManager.removeWorktree
    (worktreeManager.removeWorktree as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessionsByBranch', () => {
    it('should return empty array when no sessions exist', () => {
      const sessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(sessions).toEqual([]);
    });

    it('should return sessions for a specific branch', async () => {
      // Create sessions on different branches
      await sessionManager.createSession('session-1', 'feature/auth', true);
      await sessionManager.createSession('session-2', 'feature/payments', true);
      await sessionManager.createSession('session-3', 'feature/auth', true);

      // Get sessions for feature/auth
      const authSessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(authSessions).toHaveLength(2);
      expect(authSessions[0].name).toBe('session-1');
      expect(authSessions[1].name).toBe('session-3');

      // Get sessions for feature/payments
      const paymentsSessions = sessionManager.getSessionsByBranch('feature/payments');
      expect(paymentsSessions).toHaveLength(1);
      expect(paymentsSessions[0].name).toBe('session-2');
    });

    it('should exclude stopped sessions from count', async () => {
      // Create two sessions on same branch
      const session1 = await sessionManager.createSession('session-1', 'feature/auth', true);
      await sessionManager.createSession('session-2', 'feature/auth', true);

      // Initially both are active
      let authSessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(authSessions).toHaveLength(2);

      // Update one session to stopped status
      await sessionManager.updateSessionStatus(session1.id, 'stopped');

      // Should only return 1 session now
      authSessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(authSessions).toHaveLength(1);
      expect(authSessions[0].name).toBe('session-2');
    });
  });

  describe('shared branch metadata', () => {
    it('should set sharedBranch=false for first session on a branch', async () => {
      const session = await sessionManager.createSession('session-1', 'feature/auth', true);

      expect(session.metadata?.sharedBranch).toBe(false);
      expect(session.metadata?.branchSessionCount).toBe(1);
    });

    it('should set sharedBranch=true for second session on same branch', async () => {
      // Create first session
      await sessionManager.createSession('session-1', 'feature/auth', true);

      // Create second session on same branch
      const session2 = await sessionManager.createSession('session-2', 'feature/auth', true);

      expect(session2.metadata?.sharedBranch).toBe(true);
      expect(session2.metadata?.branchSessionCount).toBe(2);
    });

    it('should correctly count multiple sessions on same branch', async () => {
      // Create first session
      await sessionManager.createSession('session-1', 'feature/auth', true);

      // Create second session on same branch
      const session2 = await sessionManager.createSession('session-2', 'feature/auth', true);
      expect(session2.metadata?.branchSessionCount).toBe(2);

      // Create third session on same branch
      const session3 = await sessionManager.createSession('session-3', 'feature/auth', true);
      expect(session3.metadata?.branchSessionCount).toBe(3);
    });

    it('should handle sessions on different branches independently', async () => {
      // Create session on feature/auth
      const session1 = await sessionManager.createSession('session-1', 'feature/auth', true);
      expect(session1.metadata?.sharedBranch).toBe(false);
      expect(session1.metadata?.branchSessionCount).toBe(1);

      // Create session on feature/payments
      const session2 = await sessionManager.createSession('session-2', 'feature/payments', true);
      expect(session2.metadata?.sharedBranch).toBe(false);
      expect(session2.metadata?.branchSessionCount).toBe(1);

      // Create another session on feature/auth
      const session3 = await sessionManager.createSession('session-3', 'feature/auth', true);
      expect(session3.metadata?.sharedBranch).toBe(true);
      expect(session3.metadata?.branchSessionCount).toBe(2);
    });
  });

  describe('worktree conflict removal', () => {
    it('should allow creating multiple sessions on the same existing branch', async () => {
      // Create first session on existing branch
      const session1 = await sessionManager.createSession('session-1', 'feature/auth', true);
      expect(session1).toBeDefined();
      expect(session1.branch).toBe('feature/auth');

      // Create second session on same existing branch (should NOT throw 409 error)
      const session2 = await sessionManager.createSession('session-2', 'feature/auth', true);
      expect(session2).toBeDefined();
      expect(session2.branch).toBe('feature/auth');

      // Both sessions should have different IDs and worktree paths
      expect(session1.id).not.toBe(session2.id);
      expect(session1.worktreePath).not.toBe(session2.worktreePath);

      // Verify both worktrees point to same branch
      expect(session1.branch).toBe(session2.branch);
    });

    it('should create separate worktrees for each session on same branch', async () => {
      // Create two sessions on same branch
      const session1 = await sessionManager.createSession('session-1', 'feature/auth', true);
      const session2 = await sessionManager.createSession('session-2', 'feature/auth', true);

      // Worktree paths should be unique (based on session ID)
      expect(session1.worktreePath).toContain(session1.id);
      expect(session2.worktreePath).toContain(session2.id);
      expect(session1.worktreePath).not.toBe(session2.worktreePath);

      // Both should call createWorktreeFromExistingBranch
      expect(worktreeManager.createWorktreeFromExistingBranch).toHaveBeenCalledTimes(2);
      expect(worktreeManager.createWorktreeFromExistingBranch).toHaveBeenCalledWith(
        session1.id,
        'feature/auth'
      );
      expect(worktreeManager.createWorktreeFromExistingBranch).toHaveBeenCalledWith(
        session2.id,
        'feature/auth'
      );
    });
  });

  describe('session cleanup with shared branches', () => {
    it('should destroy one session without affecting other sessions on same branch', async () => {
      // Create two sessions on same branch
      const session1 = await sessionManager.createSession('session-1', 'feature/auth', true);
      const session2 = await sessionManager.createSession('session-2', 'feature/auth', true);

      // Verify both exist
      expect(sessionManager.getSession(session1.id)).toBeDefined();
      expect(sessionManager.getSession(session2.id)).toBeDefined();

      // Destroy session 1 with cleanup
      await sessionManager.destroySession(session1.id, true);

      // Verify session 1 is gone but session 2 remains
      expect(sessionManager.getSession(session1.id)).toBeUndefined();
      expect(sessionManager.getSession(session2.id)).toBeDefined();

      // Verify worktree cleanup was called only for session 1
      expect(worktreeManager.removeWorktree).toHaveBeenCalledTimes(1);
      expect(worktreeManager.removeWorktree).toHaveBeenCalledWith(session1.id);
    });

    it('should update session count after destroying a session', async () => {
      // Create three sessions on same branch
      const session1 = await sessionManager.createSession('session-1', 'feature/auth', true);
      await sessionManager.createSession('session-2', 'feature/auth', true);
      await sessionManager.createSession('session-3', 'feature/auth', true);

      // Verify count
      let authSessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(authSessions).toHaveLength(3);

      // Destroy one session
      await sessionManager.destroySession(session1.id);

      // Verify count decreased
      authSessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(authSessions).toHaveLength(2);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex multi-branch, multi-session scenario', async () => {
      // Create sessions across multiple branches
      await sessionManager.createSession('auth-1', 'feature/auth', true);
      await sessionManager.createSession('auth-2', 'feature/auth', true);
      await sessionManager.createSession('payments-1', 'feature/payments', true);
      await sessionManager.createSession('main-1', 'main', true);

      // Verify counts per branch
      const authSessions = sessionManager.getSessionsByBranch('feature/auth');
      expect(authSessions).toHaveLength(2);

      const paymentsSessions = sessionManager.getSessionsByBranch('feature/payments');
      expect(paymentsSessions).toHaveLength(1);

      const mainSessions = sessionManager.getSessionsByBranch('main');
      expect(mainSessions).toHaveLength(1);

      // Verify total session count
      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toHaveLength(4);
    });
  });
});
