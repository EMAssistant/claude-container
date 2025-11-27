/**
 * Artifact Routes Tests
 * Story 5.6: Approve Artifact with Auto-Stage
 * Story 5.7: Request Changes Modal and Claude Injection
 *
 * Tests for artifact approval and request changes endpoints:
 * - POST /api/sessions/:sessionId/artifacts/:path/approve
 * - POST /api/sessions/:sessionId/artifacts/approve-batch
 * - POST /api/sessions/:sessionId/artifacts/:path/request-changes
 */

import request from 'supertest';
import express from 'express';
import * as fs from 'fs/promises';
import artifactRoutes from '../artifactRoutes';
import { sessionManager } from '../../sessionManager';
import { artifactReviewManager } from '../../artifactReviewManager';
import { GitManager } from '../../gitManager';
import { ptyManager } from '../../ptyManager';

// Mock dependencies
jest.mock('../../sessionManager');
jest.mock('../../artifactReviewManager');
jest.mock('../../gitManager');
jest.mock('../../ptyManager');
jest.mock('fs/promises');

// Mock server broadcast function
jest.mock('../../server', () => ({
  broadcast: jest.fn()
}));

describe('Artifact Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sessions', artifactRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/sessions/:sessionId/artifacts/:path/approve', () => {
    const sessionId = 'test-session-123';
    const artifactPath = 'src/components/Test.tsx';
    const worktreePath = '/workspace/.worktrees/test-session-123';

    it('should approve artifact and auto-stage file', async () => {
      // Setup mocks
      const reviewEntry = {
        reviewStatus: 'approved' as const,
        revision: 1,
        modifiedBy: 'claude' as const,
        lastModified: new Date().toISOString(),
        approvedAt: new Date().toISOString()
      };

      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [artifactPath]: reviewEntry
        }
      };

      (sessionManager.getSession as jest.Mock).mockImplementation(() => mockSession);
      (fs.access as jest.Mock).mockResolvedValue(undefined); // File exists
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockImplementation(() => {
        // Update the mock session's review entry
        if (!mockSession.artifactReviews) {
          mockSession.artifactReviews = {} as any;
        }
        if (!mockSession.artifactReviews[artifactPath]) {
          mockSession.artifactReviews[artifactPath] = reviewEntry;
        }
        mockSession.artifactReviews[artifactPath]!.reviewStatus = 'approved';
        mockSession.artifactReviews[artifactPath]!.approvedAt = new Date().toISOString();
      });

      const mockGitManager = {
        stageFiles: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({
          branch: 'main',
          ahead: 0,
          behind: 0,
          staged: [{ path: artifactPath, status: 'A' }],
          modified: [],
          untracked: []
        })
      };
      (GitManager as jest.Mock).mockImplementation(() => mockGitManager);

      // Make request
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/approve`)
        .expect(200);

      // Assertions
      expect(response.body.success).toBe(true);
      expect(response.body.staged).toBe(true);
      expect(response.body.artifact).toBeDefined();
      expect(artifactReviewManager.updateReviewStatus).toHaveBeenCalledWith(
        sessionId,
        artifactPath,
        'approved'
      );
      expect(mockGitManager.stageFiles).toHaveBeenCalledWith([artifactPath]);
    });

    it('should return 404 when session not found', async () => {
      (sessionManager.getSession as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/approve`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 400 when path is outside worktree', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {}
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      const maliciousPath = '../../../etc/passwd';
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(maliciousPath)}/approve`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_PATH');
    });

    it('should return 404 when file does not exist', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {}
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/approve`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FILE_NOT_FOUND');
    });

    it('should return 500 when git stage fails', async () => {
      const reviewEntry = {
        reviewStatus: 'approved' as const,
        revision: 1,
        modifiedBy: 'claude' as const,
        lastModified: new Date().toISOString(),
        approvedAt: new Date().toISOString()
      };

      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [artifactPath]: reviewEntry
        }
      };

      (sessionManager.getSession as jest.Mock).mockImplementation(() => mockSession);
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockImplementation(() => {
        if (!mockSession.artifactReviews) {
          mockSession.artifactReviews = {} as any;
        }
        if (!mockSession.artifactReviews[artifactPath]) {
          mockSession.artifactReviews[artifactPath] = reviewEntry;
        }
        mockSession.artifactReviews[artifactPath]!.reviewStatus = 'approved';
      });

      const mockGitManager = {
        stageFiles: jest.fn().mockRejectedValue(new Error('Git stage failed')),
        getStatus: jest.fn()
      };
      (GitManager as jest.Mock).mockImplementation(() => mockGitManager);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/approve`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('GIT_STAGE_FAILED');
    });
  });

  describe('POST /api/sessions/:sessionId/artifacts/approve-batch', () => {
    const sessionId = 'test-session-123';
    const worktreePath = '/workspace/.worktrees/test-session-123';
    const files = ['src/components/Test1.tsx', 'src/components/Test2.tsx', 'src/utils/helper.ts'];

    it('should batch approve multiple artifacts and stage them', async () => {
      // Setup mocks
      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [files[0]]: {
            reviewStatus: 'pending',
            revision: 1,
            modifiedBy: 'claude',
            lastModified: new Date().toISOString()
          },
          [files[1]]: {
            reviewStatus: 'changes-requested',
            revision: 2,
            modifiedBy: 'claude',
            lastModified: new Date().toISOString()
          },
          [files[2]]: {
            reviewStatus: 'pending',
            revision: 1,
            modifiedBy: 'claude',
            lastModified: new Date().toISOString()
          }
        }
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockResolvedValue(undefined);

      const mockGitManager = {
        stageFiles: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({
          branch: 'main',
          ahead: 0,
          behind: 0,
          staged: files.map(f => ({ path: f, status: 'A' })),
          modified: [],
          untracked: []
        })
      };
      (GitManager as jest.Mock).mockImplementation(() => mockGitManager);

      // Make request
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/approve-batch`)
        .send({ files })
        .expect(200);

      // Assertions
      expect(response.body.success).toBe(true);
      expect(response.body.approved).toBe(3);
      expect(response.body.staged).toBe(3);
      expect(response.body.files).toEqual(files);
      expect(artifactReviewManager.updateReviewStatus).toHaveBeenCalledTimes(3);
      expect(mockGitManager.stageFiles).toHaveBeenCalledWith(files);
    });

    it('should return 400 when files array is empty', async () => {
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/approve-batch`)
        .send({ files: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 when files is not an array', async () => {
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/approve-batch`)
        .send({ files: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });

    it('should return 404 when session not found', async () => {
      (sessionManager.getSession as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/approve-batch`)
        .send({ files })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 400 when any path is outside worktree', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {}
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      const maliciousFiles = ['src/Test.tsx', '../../../etc/passwd'];
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/approve-batch`)
        .send({ files: maliciousFiles })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_PATH');
    });

    it('should return 500 when git stage fails for batch', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [files[0]]: {
            reviewStatus: 'pending',
            revision: 1,
            modifiedBy: 'claude',
            lastModified: new Date().toISOString()
          }
        }
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockResolvedValue(undefined);

      const mockGitManager = {
        stageFiles: jest.fn().mockRejectedValue(new Error('Git stage batch failed')),
        getStatus: jest.fn()
      };
      (GitManager as jest.Mock).mockImplementation(() => mockGitManager);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/approve-batch`)
        .send({ files })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('GIT_STAGE_FAILED');
    });
  });

  describe('POST /api/sessions/:sessionId/artifacts/:path/request-changes', () => {
    const sessionId = 'test-session-123';
    const artifactPath = 'src/components/Test.tsx';
    const worktreePath = '/workspace/.worktrees/test-session-123';
    const feedback = 'Add error handling for network failures';

    it('should request changes and inject feedback into PTY', async () => {
      // Setup mocks
      const reviewEntry = {
        reviewStatus: 'changes-requested' as const,
        revision: 1,
        modifiedBy: 'claude' as const,
        lastModified: new Date().toISOString(),
        changesRequestedAt: new Date().toISOString(),
        feedback
      };

      const mockPtyProcess = {
        write: jest.fn()
      };

      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [artifactPath]: reviewEntry
        }
      };

      (sessionManager.getSession as jest.Mock).mockImplementation(() => mockSession);
      (ptyManager.getPtyProcess as jest.Mock).mockReturnValue(mockPtyProcess);
      (fs.access as jest.Mock).mockResolvedValue(undefined); // File exists
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockImplementation(() => {
        // Update the mock session's review entry
        if (!mockSession.artifactReviews) {
          mockSession.artifactReviews = {} as any;
        }
        if (!mockSession.artifactReviews[artifactPath]) {
          mockSession.artifactReviews[artifactPath] = reviewEntry;
        }
        mockSession.artifactReviews[artifactPath]!.reviewStatus = 'changes-requested';
        mockSession.artifactReviews[artifactPath]!.changesRequestedAt = new Date().toISOString();
        mockSession.artifactReviews[artifactPath]!.feedback = feedback;
      });

      // Make request
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback })
        .expect(200);

      // Assertions
      expect(response.body.success).toBe(true);
      expect(response.body.artifact).toBeDefined();
      expect(artifactReviewManager.updateReviewStatus).toHaveBeenCalledWith(
        sessionId,
        artifactPath,
        'changes-requested',
        feedback
      );
      expect(mockPtyProcess.write).toHaveBeenCalledWith(
        `Please revise ${artifactPath}:\n${feedback}\n`
      );
    });

    it('should return 400 when feedback is empty', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FEEDBACK_EMPTY');
    });

    it('should return 400 when feedback exceeds character limit', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      const longFeedback = 'x'.repeat(5001);
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback: longFeedback })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FEEDBACK_TOO_LONG');
    });

    it('should return 404 when session not found', async () => {
      (sessionManager.getSession as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 400 when path is outside worktree', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      const maliciousPath = '../../../etc/passwd';
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(maliciousPath)}/request-changes`)
        .send({ feedback })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_PATH');
    });

    it('should return 404 when file does not exist', async () => {
      const mockSession = {
        id: sessionId,
        worktreePath
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FILE_NOT_FOUND');
    });

    it('should return 500 when PTY process is not available', async () => {
      const reviewEntry = {
        reviewStatus: 'pending' as const,
        revision: 1,
        modifiedBy: 'claude' as const,
        lastModified: new Date().toISOString()
      };

      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [artifactPath]: reviewEntry
        }
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
      (ptyManager.getPtyProcess as jest.Mock).mockReturnValue(null); // No PTY process
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PTY_ERROR');
    });

    it('should return 500 when PTY write fails', async () => {
      const reviewEntry = {
        reviewStatus: 'pending' as const,
        revision: 1,
        modifiedBy: 'claude' as const,
        lastModified: new Date().toISOString()
      };

      const mockPtyProcess = {
        write: jest.fn().mockImplementation(() => {
          throw new Error('PTY write failed');
        })
      };

      const mockSession = {
        id: sessionId,
        worktreePath,
        artifactReviews: {
          [artifactPath]: reviewEntry
        }
      };

      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
      (ptyManager.getPtyProcess as jest.Mock).mockReturnValue(mockPtyProcess);
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (artifactReviewManager.updateReviewStatus as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactPath)}/request-changes`)
        .send({ feedback })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PTY_WRITE_FAILED');
    });
  });
});
