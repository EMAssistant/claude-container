/**
 * SessionManager.destroySession() Unit Tests
 * Story 2.7: Session Destruction with Cleanup Options
 *
 * Tests:
 * - AC #2: Session destruction without worktree cleanup
 * - AC #3: Session destruction with worktree cleanup
 * - Error handling for session not found
 */

import { SessionManager } from './sessionManager';
import { ptyManager } from './ptyManager';
import { worktreeManager } from './worktreeManager';
import * as path from 'path';

// Mock dependencies
jest.mock('./ptyManager');
jest.mock('./worktreeManager');
jest.mock('./utils/atomicWrite');
jest.mock('./utils/logger');

describe('SessionManager.destroySession()', () => {
  let sessionManager: SessionManager;
  const testWorkspaceRoot = '/test/workspace';
  const testPersistencePath = path.join(testWorkspaceRoot, '.test-sessions.json');

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock ptyManager methods
    (ptyManager.spawn as jest.Mock) = jest.fn().mockReturnValue({
      pid: 12345,
      onData: jest.fn(),
      onExit: jest.fn(),
      write: jest.fn(),
      kill: jest.fn(),
    });
    (ptyManager.registerPtyProcess as jest.Mock) = jest.fn();
    (ptyManager.unregisterPtyProcess as jest.Mock) = jest.fn();
    (ptyManager.getPtyProcess as jest.Mock) = jest.fn().mockReturnValue(null);
    (ptyManager.killGracefully as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    // Mock worktreeManager methods
    (worktreeManager.createWorktree as jest.Mock) = jest.fn().mockResolvedValue('/test/workspace/.worktrees/test-session-id');
    (worktreeManager.removeWorktree as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    // Create SessionManager instance
    sessionManager = new SessionManager({
      workspaceRoot: testWorkspaceRoot,
      maxSessions: 4,
      persistencePath: testPersistencePath,
    });
  });

  describe('AC #2: Session Destruction Without Worktree Cleanup', () => {
    it('should remove session from registry without cleanup', async () => {
      // Create a session
      const session = await sessionManager.createSession('test-session');
      expect(sessionManager.getSession(session.id)).toBeDefined();

      // Destroy session without cleanup
      await sessionManager.destroySession(session.id, false);

      // Verify session is removed
      expect(sessionManager.getSession(session.id)).toBeUndefined();
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it('should call ptyManager.killGracefully when PTY is running', async () => {
      const mockPty = {
        pid: 12345,
        onData: jest.fn(),
        onExit: jest.fn(),
        write: jest.fn(),
        kill: jest.fn(),
      };

      // Mock PTY process exists
      (ptyManager.getPtyProcess as jest.Mock) = jest.fn().mockReturnValue(mockPty);

      // Create and destroy session
      const session = await sessionManager.createSession('test-session');
      await sessionManager.destroySession(session.id, false);

      // Verify graceful PTY shutdown was called
      expect(ptyManager.killGracefully).toHaveBeenCalledWith(mockPty);
    });

    it('should NOT call worktreeManager.removeWorktree when cleanup=false', async () => {
      const session = await sessionManager.createSession('test-session');
      await sessionManager.destroySession(session.id, false);

      // Verify worktree was NOT removed
      expect(worktreeManager.removeWorktree).not.toHaveBeenCalled();
    });

    it('should call ptyManager.unregisterPtyProcess', async () => {
      const session = await sessionManager.createSession('test-session');
      await sessionManager.destroySession(session.id, false);

      // Verify PTY was unregistered
      expect(ptyManager.unregisterPtyProcess).toHaveBeenCalledWith(session.id);
    });
  });

  describe('AC #3: Session Destruction With Worktree Cleanup', () => {
    it('should remove worktree when cleanup=true', async () => {
      const session = await sessionManager.createSession('test-session');
      await sessionManager.destroySession(session.id, true);

      // Verify worktree was removed
      expect(worktreeManager.removeWorktree).toHaveBeenCalledWith(session.id);
    });

    it('should still remove session even if worktree cleanup fails', async () => {
      // Mock worktree removal failure
      (worktreeManager.removeWorktree as jest.Mock).mockRejectedValue(
        new Error('Worktree has uncommitted changes')
      );

      const session = await sessionManager.createSession('test-session');

      // Destroy should succeed even if worktree cleanup fails
      // (error is logged but not thrown, allowing partial cleanup)
      await sessionManager.destroySession(session.id, true);

      // Verify session is removed despite worktree cleanup failure
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error if session not found', async () => {
      await expect(sessionManager.destroySession('non-existent-id')).rejects.toThrow('Session not found');
    });

    it('should continue destruction if PTY kill fails', async () => {
      const mockPty = {
        pid: 12345,
        onData: jest.fn(),
        onExit: jest.fn(),
        write: jest.fn(),
        kill: jest.fn(),
      };

      // Mock PTY kill failure
      (ptyManager.getPtyProcess as jest.Mock) = jest.fn().mockReturnValue(mockPty);
      (ptyManager.killGracefully as jest.Mock) = jest.fn().mockRejectedValue(new Error('Process already dead'));

      // Create and destroy session
      const session = await sessionManager.createSession('test-session');
      await sessionManager.destroySession(session.id, false);

      // Verify session is still removed despite PTY kill failure
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });
  });
});
