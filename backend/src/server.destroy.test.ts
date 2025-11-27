/**
 * DELETE /api/sessions/:id Integration Test
 * Story 2.7: Session Destruction with Cleanup Options
 *
 * Tests:
 * - AC #2: Session destruction without worktree cleanup
 * - AC #3: Session destruction with worktree cleanup
 * - Error handling (404, 500)
 */

import request from 'supertest';
import { app, sessionManager } from './server';
import { ptyManager } from './ptyManager';
import { worktreeManager } from './worktreeManager';

// Mock dependencies
jest.mock('./ptyManager');
jest.mock('./worktreeManager');
jest.mock('./utils/atomicWrite');
jest.mock('./utils/logger');

describe('DELETE /api/sessions/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ptyManager
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

    // Mock worktreeManager
    (worktreeManager.createWorktree as jest.Mock) = jest.fn().mockResolvedValue('/workspace/.worktrees/test-id');
    (worktreeManager.removeWorktree as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  describe('AC #2: Session Destruction Without Worktree Cleanup', () => {
    it('should destroy session and return 200 with cleanup=false', async () => {
      // Create a session first
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ name: 'test-session' });

      expect(createResponse.status).toBe(200);
      const sessionId = createResponse.body.session.id;

      // Destroy session without cleanup
      const destroyResponse = await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .query({ cleanup: 'false' });

      expect(destroyResponse.status).toBe(200);
      expect(destroyResponse.body).toEqual({ success: true });

      // Verify session is removed
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeUndefined();

      // Verify worktree was NOT removed
      expect(worktreeManager.removeWorktree).not.toHaveBeenCalled();
    });

    it('should call ptyManager.killGracefully when destroying session', async () => {
      const mockPty = {
        pid: 12345,
        onData: jest.fn(),
        onExit: jest.fn(),
        write: jest.fn(),
        kill: jest.fn(),
      };

      (ptyManager.getPtyProcess as jest.Mock) = jest.fn().mockReturnValue(mockPty);

      // Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ name: 'test-session' });

      const sessionId = createResponse.body.session.id;

      // Destroy session
      await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .query({ cleanup: 'false' });

      // Verify graceful shutdown was called
      expect(ptyManager.killGracefully).toHaveBeenCalledWith(mockPty);
    });
  });

  describe('AC #3: Session Destruction With Worktree Cleanup', () => {
    it('should destroy session and remove worktree with cleanup=true', async () => {
      // Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ name: 'test-session' });

      const sessionId = createResponse.body.session.id;

      // Destroy session with cleanup
      const destroyResponse = await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .query({ cleanup: 'true' });

      expect(destroyResponse.status).toBe(200);
      expect(destroyResponse.body).toEqual({ success: true });

      // Verify worktree removal was called
      expect(worktreeManager.removeWorktree).toHaveBeenCalledWith(sessionId);
    });

    it('should return 200 and still destroy session even if worktree cleanup fails', async () => {
      // Mock worktree removal failure
      (worktreeManager.removeWorktree as jest.Mock).mockRejectedValue(
        new Error('Worktree has uncommitted changes')
      );

      // Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ name: 'test-session' });

      const sessionId = createResponse.body.session.id;

      // Destroy session with cleanup - should succeed even if worktree cleanup fails
      // (partial cleanup: session removed, worktree may remain)
      const destroyResponse = await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .query({ cleanup: 'true' });

      // Should return success - session destruction completes even if cleanup fails
      expect(destroyResponse.status).toBe(200);

      // Verify session is removed despite worktree cleanup failure
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if session not found', async () => {
      const response = await request(app)
        .delete('/api/sessions/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.error).toBe('Session not found');
    });

    it('should handle missing cleanup query parameter (defaults to false)', async () => {
      // Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({ name: 'test-session' });

      const sessionId = createResponse.body.session.id;

      // Destroy session without cleanup parameter
      const destroyResponse = await request(app)
        .delete(`/api/sessions/${sessionId}`);

      expect(destroyResponse.status).toBe(200);

      // Verify worktree was NOT removed (cleanup defaults to false)
      expect(worktreeManager.removeWorktree).not.toHaveBeenCalled();
    });
  });
});
