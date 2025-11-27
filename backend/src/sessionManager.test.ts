/**
 * Unit tests for SessionManager
 * Story 2.1: Session Manager Module with State Persistence
 *
 * Test coverage:
 * - AC #1: Session Creation and Object Structure
 * - AC #2: Session Persistence with Atomic Writes
 * - AC #3: Session Restoration on Container Restart
 * - AC #4: Graceful Handling of Corrupted JSON
 * - AC #5: Session Count Limit Enforcement
 */

import { SessionManager, MaxSessionsError } from './sessionManager';
import { SessionStatus } from './types';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn()
}));

jest.mock('./utils/atomicWrite', () => ({
  atomicWriteJson: jest.fn()
}));

jest.mock('./utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  logSessionEvent: jest.fn(),
  logSessionError: jest.fn()
}));

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn()
  }
}));

jest.mock('./worktreeManager', () => ({
  worktreeManager: {
    createWorktree: jest.fn(),
    removeWorktree: jest.fn(),
    listWorktrees: jest.fn()
  }
}));

jest.mock('./ptyManager', () => ({
  ptyManager: {
    spawn: jest.fn(),
    registerPtyProcess: jest.fn(),
    unregisterPtyProcess: jest.fn(),
    kill: jest.fn(),
    write: jest.fn(),
    onData: jest.fn(),
    onExit: jest.fn(),
    getPtyProcess: jest.fn()
  }
}));

import { v4 as uuidv4 } from 'uuid';
import { atomicWriteJson } from './utils/atomicWrite';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const mockWorkspaceRoot = '/test-workspace';
  const mockPersistencePath = path.join(mockWorkspaceRoot, '.claude-container-sessions.json');

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a fresh SessionManager instance for each test
    sessionManager = new SessionManager({
      workspaceRoot: mockWorkspaceRoot,
      maxSessions: 4,
      persistencePath: mockPersistencePath
    });

    // Setup default mock behavior
    (uuidv4 as jest.Mock).mockReturnValue('test-uuid-1234');
    (atomicWriteJson as jest.Mock).mockResolvedValue(undefined);

    // Setup default mocks for worktreeManager and ptyManager
    const mockWorktreeManager = require('./worktreeManager');
    const mockPtyManager = require('./ptyManager');
    mockWorktreeManager.worktreeManager.createWorktree.mockResolvedValue(undefined);
    mockWorktreeManager.worktreeManager.removeWorktree.mockResolvedValue(undefined);
    mockPtyManager.ptyManager.spawn.mockReturnValue({ pid: 12345 });
    mockPtyManager.ptyManager.registerPtyProcess.mockReturnValue(undefined);
    mockPtyManager.ptyManager.unregisterPtyProcess.mockReturnValue(undefined);
    mockPtyManager.ptyManager.kill.mockReturnValue(undefined);
    mockPtyManager.ptyManager.getPtyProcess.mockReturnValue(null); // Default to no process
  });

  describe('AC #1: Session Creation and Object Structure', () => {
    it('should create session with valid name and return correct structure', async () => {
      const session = await sessionManager.createSession('feature-auth');

      expect(session).toMatchObject({
        id: 'test-uuid-1234',
        name: 'feature-auth',
        status: 'active',
        branch: 'feature/feature-auth',
        worktreePath: '/test-workspace/.worktrees/test-uuid-1234'
      });
      expect(session.createdAt).toBeDefined();
      expect(session.lastActivity).toBeDefined();
      expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // PTY is spawned during session creation, so ptyPid should be set
      expect(session.ptyPid).toBe(12345);
    });

    it('should auto-generate session name when not provided', async () => {
      const session = await sessionManager.createSession();

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedPrefix = `feature-${year}-${month}-${day}`;

      expect(session.name).toMatch(new RegExp(`^${expectedPrefix}-\\d{3}$`));
      expect(session.branch).toBe(`feature/${session.name}`);
    });

    it('should increment auto-generated session names sequentially', async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      const session3 = await sessionManager.createSession();

      expect(session1.name).toMatch(/-001$/);
      expect(session2.name).toMatch(/-002$/);
      expect(session3.name).toMatch(/-003$/);
    });

    it('should use custom branch name when provided', async () => {
      const session = await sessionManager.createSession('my-feature', 'custom/my-branch');

      expect(session.name).toBe('my-feature');
      expect(session.branch).toBe('custom/my-branch');
    });
  });

  describe('AC #2: Session Persistence with Atomic Writes', () => {
    it('should persist session to JSON after creation', async () => {
      await sessionManager.createSession('test-session');

      expect(atomicWriteJson).toHaveBeenCalledWith(
        mockPersistencePath,
        expect.objectContaining({
          version: '1.0',
          sessions: expect.arrayContaining([
            expect.objectContaining({
              name: 'test-session',
              status: 'active'
            })
          ])
        })
      );
    });

    it('should use atomic write pattern for persistence', async () => {
      await sessionManager.createSession('test-session');

      // Verify atomicWriteJson was called (which uses temp file + rename)
      expect(atomicWriteJson).toHaveBeenCalledTimes(1);
    });

    it('should persist sessions after status update', async () => {
      const session = await sessionManager.createSession('test-session');
      jest.clearAllMocks();

      await sessionManager.updateSessionStatus(session.id, 'waiting');

      expect(atomicWriteJson).toHaveBeenCalledTimes(1);
    });

    it('should persist sessions after activity update', async () => {
      const session = await sessionManager.createSession('test-session');
      jest.clearAllMocks();

      await sessionManager.updateLastActivity(session.id);

      expect(atomicWriteJson).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC #3: Session Restoration on Container Restart', () => {
    it('should restore sessions from JSON file', async () => {
      const mockSessionData = {
        version: '1.0',
        sessions: [
          {
            id: 'restored-1',
            name: 'feature-auth',
            status: 'active' as SessionStatus,
            branch: 'feature/feature-auth',
            worktreePath: '/workspace/.worktrees/restored-1',
            createdAt: '2025-11-24T10:00:00.000Z',
            lastActivity: '2025-11-24T10:30:00.000Z'
          },
          {
            id: 'restored-2',
            name: 'feature-ui',
            status: 'waiting' as SessionStatus,
            branch: 'feature/feature-ui',
            worktreePath: '/workspace/.worktrees/restored-2',
            createdAt: '2025-11-24T11:00:00.000Z',
            lastActivity: '2025-11-24T11:15:00.000Z'
          }
        ]
      };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));

      await sessionManager.loadSessions();

      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('restored-1');
      expect(sessions[1].id).toBe('restored-2');
    });

    it('should set all restored sessions to idle status', async () => {
      const mockSessionData = {
        version: '1.0',
        sessions: [
          {
            id: 'restored-1',
            name: 'feature-auth',
            status: 'active' as SessionStatus,
            branch: 'feature/feature-auth',
            worktreePath: '/workspace/.worktrees/restored-1',
            ptyPid: 12345,
            createdAt: '2025-11-24T10:00:00.000Z',
            lastActivity: '2025-11-24T10:30:00.000Z'
          }
        ]
      };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));

      await sessionManager.loadSessions();

      const session = sessionManager.getSession('restored-1');
      expect(session?.status).toBe('idle');
    });

    it('should preserve session metadata on restoration', async () => {
      const mockSessionData = {
        version: '1.0',
        sessions: [
          {
            id: 'restored-1',
            name: 'feature-auth',
            status: 'active' as SessionStatus,
            branch: 'feature/feature-auth',
            worktreePath: '/workspace/.worktrees/restored-1',
            createdAt: '2025-11-24T10:00:00.000Z',
            lastActivity: '2025-11-24T10:30:00.000Z',
            currentPhase: 'planning',
            metadata: { key: 'value' }
          }
        ]
      };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));

      await sessionManager.loadSessions();

      const session = sessionManager.getSession('restored-1');
      expect(session?.name).toBe('feature-auth');
      expect(session?.branch).toBe('feature/feature-auth');
      expect(session?.createdAt).toBe('2025-11-24T10:00:00.000Z');
      expect(session?.lastActivity).toBe('2025-11-24T10:30:00.000Z');
      expect(session?.currentPhase).toBe('planning');
      expect(session?.metadata).toEqual({ key: 'value' });
    });

    it('should start with empty state when persistence file does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      await sessionManager.loadSessions();

      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('AC #4: Graceful Handling of Corrupted JSON', () => {
    it('should handle corrupted JSON file gracefully', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue('{ invalid json');

      await sessionManager.loadSessions();

      // Should not throw and continue with empty state
      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should continue with empty state on corrupted JSON (rebuildFromWorktrees deferred)', async () => {
      // Note: rebuildFromWorktrees is a stub that returns empty array
      // The current implementation continues with empty state on corrupted JSON
      // rather than attempting worktree rebuild (deferred to future enhancement)
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue('{ invalid json');

      await sessionManager.loadSessions();

      // Should continue with empty sessions, not throw
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it('should return empty array from rebuildFromWorktrees stub', async () => {
      const result = await (sessionManager as any).rebuildFromWorktrees();
      expect(result).toEqual([]);
    });

    it('should continue operation after JSON read failure', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read failed'));

      await sessionManager.loadSessions();

      // Should not throw - verify by creating a new session
      const session = await sessionManager.createSession('test');
      expect(session).toBeDefined();
    });
  });

  describe('AC #5: Session Count Limit Enforcement', () => {
    it('should allow creating up to 4 sessions', async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3')
        .mockReturnValueOnce('uuid-4');

      await sessionManager.createSession('session-1');
      await sessionManager.createSession('session-2');
      await sessionManager.createSession('session-3');
      await sessionManager.createSession('session-4');

      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(4);
    });

    it('should throw MAX_SESSIONS error when creating 5th session', async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3')
        .mockReturnValueOnce('uuid-4')
        .mockReturnValueOnce('uuid-5');

      await sessionManager.createSession('session-1');
      await sessionManager.createSession('session-2');
      await sessionManager.createSession('session-3');
      await sessionManager.createSession('session-4');

      await expect(sessionManager.createSession('session-5')).rejects.toThrow(MaxSessionsError);
    });

    it('should include user-friendly error message', async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3')
        .mockReturnValueOnce('uuid-4')
        .mockReturnValueOnce('uuid-5');

      await sessionManager.createSession('session-1');
      await sessionManager.createSession('session-2');
      await sessionManager.createSession('session-3');
      await sessionManager.createSession('session-4');

      try {
        await sessionManager.createSession('session-5');
        fail('Should have thrown MaxSessionsError');
      } catch (error) {
        expect(error).toBeInstanceOf(MaxSessionsError);
        expect((error as MaxSessionsError).message).toBe(
          'Maximum 4 sessions supported. Destroy a session to create a new one.'
        );
        expect((error as MaxSessionsError).code).toBe('MAX_SESSIONS');
      }
    });

    it('should allow creating new session after destroying one', async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3')
        .mockReturnValueOnce('uuid-4')
        .mockReturnValueOnce('uuid-5');

      const session1 = await sessionManager.createSession('session-1');
      await sessionManager.createSession('session-2');
      await sessionManager.createSession('session-3');
      await sessionManager.createSession('session-4');

      // Destroy one session
      await sessionManager.destroySession(session1.id);

      // Should be able to create a new session now
      const session5 = await sessionManager.createSession('session-5');
      expect(session5).toBeDefined();
      expect(sessionManager.getAllSessions()).toHaveLength(4);
    });
  });

  describe('Session Management Methods', () => {
    it('should get session by ID', async () => {
      const session = await sessionManager.createSession('test-session');
      const retrieved = sessionManager.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.name).toBe('test-session');
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should get all sessions', async () => {
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      await sessionManager.createSession('session-1');
      await sessionManager.createSession('session-2');

      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name)).toContain('session-1');
      expect(sessions.map(s => s.name)).toContain('session-2');
    });

    it('should update session status', async () => {
      const session = await sessionManager.createSession('test-session');

      await sessionManager.updateSessionStatus(session.id, 'waiting');

      const updated = sessionManager.getSession(session.id);
      expect(updated?.status).toBe('waiting');
    });

    it('should throw error when updating status of non-existent session', async () => {
      await expect(
        sessionManager.updateSessionStatus('non-existent', 'waiting')
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should update last activity timestamp', async () => {
      const session = await sessionManager.createSession('test-session');
      const originalActivity = session.lastActivity;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionManager.updateLastActivity(session.id);

      const updated = sessionManager.getSession(session.id);
      expect(updated?.lastActivity).not.toBe(originalActivity);
      expect(new Date(updated!.lastActivity).getTime()).toBeGreaterThan(
        new Date(originalActivity).getTime()
      );
    });

    it('should throw error when updating activity of non-existent session', async () => {
      await expect(
        sessionManager.updateLastActivity('non-existent')
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should destroy session and remove from registry', async () => {
      const session = await sessionManager.createSession('test-session');

      await sessionManager.destroySession(session.id);

      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it('should throw error when destroying non-existent session', async () => {
      await expect(
        sessionManager.destroySession('non-existent')
      ).rejects.toThrow('Session not found: non-existent');
    });
  });

  describe('Story 2.3: Session Name Validation', () => {
    it('should accept valid session name with alphanumeric and dashes', async () => {
      const session = await sessionManager.createSession('feature-auth-123');
      expect(session.name).toBe('feature-auth-123');
    });

    it('should accept session name with only letters', async () => {
      const session = await sessionManager.createSession('featureauth');
      expect(session.name).toBe('featureauth');
    });

    it('should accept session name with only numbers', async () => {
      const session = await sessionManager.createSession('12345');
      expect(session.name).toBe('12345');
    });

    it('should accept session name exactly 50 characters', async () => {
      const name50chars = 'a'.repeat(50);
      const session = await sessionManager.createSession(name50chars);
      expect(session.name).toBe(name50chars);
    });

    it('should reject session name with underscore', async () => {
      await expect(
        sessionManager.createSession('feature_auth')
      ).rejects.toThrow('Session name must be alphanumeric with dashes, max 50 characters');
    });

    it('should reject session name with spaces', async () => {
      await expect(
        sessionManager.createSession('feature auth')
      ).rejects.toThrow('Session name must be alphanumeric with dashes, max 50 characters');
    });

    it('should reject session name with special characters', async () => {
      await expect(sessionManager.createSession('feature@auth')).rejects.toThrow();
      await expect(sessionManager.createSession('feature#auth')).rejects.toThrow();
      await expect(sessionManager.createSession('feature$auth')).rejects.toThrow();
    });

    it('should reject session name longer than 50 characters', async () => {
      const name51chars = 'a'.repeat(51);
      await expect(
        sessionManager.createSession(name51chars)
      ).rejects.toThrow('Session name must be alphanumeric with dashes, max 50 characters');
    });

    it('should auto-generate name when empty string provided (treated as no name)', async () => {
      // Empty string is falsy in JavaScript, so it triggers auto-generation
      // This is intentional - '' is treated the same as undefined/null
      const session = await sessionManager.createSession('');

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedPrefix = `feature-${year}-${month}-${day}`;

      expect(session.name).toMatch(new RegExp(`^${expectedPrefix}-\\d{3}$`));
    });
  });

  describe('Story 2.9: Crash Isolation - Session Status Updates', () => {
    it('should update session status to error', async () => {
      // Use module-level mocks (configured at top of file)
      const mockWorktreeManager = require('./worktreeManager');
      const mockPtyManager = require('./ptyManager');
      mockWorktreeManager.worktreeManager.createWorktree.mockResolvedValue(undefined);
      mockPtyManager.ptyManager.spawn.mockReturnValue({ pid: 12345 });

      // Create a session
      const session = await sessionManager.createSession('test-session');
      expect(session.status).toBe('active');

      // Update status to error
      await sessionManager.updateSessionStatus(session.id, 'error', 'Process crashed');

      // Verify status was updated
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.status).toBe('error');

      // Verify persistence was called
      expect(atomicWriteJson).toHaveBeenCalled();
    });

    it('should call status update callback when status changes', async () => {
      // Use module-level mocks (configured at top of file)
      const mockWorktreeManager = require('./worktreeManager');
      const mockPtyManager = require('./ptyManager');
      mockWorktreeManager.worktreeManager.createWorktree.mockResolvedValue(undefined);
      mockPtyManager.ptyManager.spawn.mockReturnValue({ pid: 12345 });

      // Register callback
      const mockCallback = jest.fn();
      sessionManager.setStatusUpdateCallback(mockCallback);

      // Create a session
      const session = await sessionManager.createSession('test-session');

      // Update status to error
      await sessionManager.updateSessionStatus(session.id, 'error', 'Process exited with code 1');

      // Verify callback was called
      expect(mockCallback).toHaveBeenCalledWith(session.id, 'error', 'Process exited with code 1');
    });

    it('should allow resuming a session in error status', async () => {
      // Use module-level mocks (configured at top of file)
      const mockWorktreeManager = require('./worktreeManager');
      const mockPtyManager = require('./ptyManager');
      mockWorktreeManager.worktreeManager.createWorktree.mockResolvedValue(undefined);
      mockPtyManager.ptyManager.spawn.mockReturnValue({ pid: 12345 });

      // Mock fs.access to simulate worktree exists
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      // Create a session
      const session = await sessionManager.createSession('test-session');

      // Update status to error (simulate crash)
      await sessionManager.updateSessionStatus(session.id, 'error', 'Process crashed');

      // Verify session is in error state
      const errorSession = sessionManager.getSession(session.id);
      expect(errorSession?.status).toBe('error');

      // Mock PTY spawn for resume
      mockPtyManager.ptyManager.spawn = jest.fn().mockReturnValue({ pid: 67890 });

      // Resume the crashed session
      await sessionManager.resumeSession(session.id);

      // Verify status changed to active
      const resumedSession = sessionManager.getSession(session.id);
      expect(resumedSession?.status).toBe('active');
      expect(resumedSession?.ptyPid).toBe(67890);
    });

    it('should reject resume for active sessions', async () => {
      // Use module-level mocks (configured at top of file)
      const mockWorktreeManager = require('./worktreeManager');
      const mockPtyManager = require('./ptyManager');
      mockWorktreeManager.worktreeManager.createWorktree.mockResolvedValue(undefined);
      mockPtyManager.ptyManager.spawn.mockReturnValue({ pid: 12345 });

      // Create a session
      const session = await sessionManager.createSession('test-session');
      expect(session.status).toBe('active');

      // Try to resume an active session - should fail
      await expect(
        sessionManager.resumeSession(session.id)
      ).rejects.toThrow('Session cannot be resumed');
    });
  });
});
