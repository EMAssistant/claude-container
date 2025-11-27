/**
 * Tests for ArtifactReviewManager
 * Story 5.4: BMAD Artifact Detection with Story Linking
 *
 * Test Coverage:
 * - Claude activity detection (5-second window)
 * - Story linking and artifact review creation
 * - Revision counter increments
 * - Review status updates
 * - WebSocket broadcasting
 * - Stale entry cleanup
 */

import { ArtifactReviewManager } from '../artifactReviewManager';
import { Session, ArtifactUpdatedMessage } from '../types';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../sessionManager', () => ({
  sessionManager: {
    getSession: jest.fn(),
    saveSessions: jest.fn()
  }
}));

jest.mock('../statusParser', () => ({
  parseSprintStatus: jest.fn()
}));

jest.mock('../gitManager', () => ({
  GitManager: jest.fn().mockImplementation(() => ({
    getStatus: jest.fn()
  }))
}));

jest.mock('fs/promises');
jest.mock('../utils/logger');

// Import mocked modules
import { sessionManager } from '../sessionManager';
import { parseSprintStatus } from '../statusParser';
import { GitManager } from '../gitManager';

describe('ArtifactReviewManager', () => {
  let manager: ArtifactReviewManager;
  let mockSession: Session;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize manager with 5-second window
    manager = new ArtifactReviewManager(5000);

    // Create mock session
    mockSession = {
      id: 'session-123',
      name: 'test-session',
      status: 'active',
      branch: 'feature/test',
      worktreePath: '/workspace/.worktrees/session-123',
      createdAt: '2025-11-26T10:00:00.000Z',
      lastActivity: '2025-11-26T10:00:00.000Z',
      claudeLastActivity: undefined,
      artifactReviews: {}
    };

    // Setup default mocks
    (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
    (sessionManager.saveSessions as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isClaudeActivity', () => {
    it('should return true when file change is within 5s window', () => {
      // Setup: Claude output at 10:00:00
      mockSession.claudeLastActivity = '2025-11-26T10:00:00.000Z';
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: File change at 10:00:03 (3 seconds later)
      const fileChangeTime = new Date('2025-11-26T10:00:03.000Z');
      const result = manager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(true);
    });

    it('should return false when file change is outside 5s window', () => {
      // Setup: Claude output at 10:00:00
      mockSession.claudeLastActivity = '2025-11-26T10:00:00.000Z';
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: File change at 10:00:06 (6 seconds later)
      const fileChangeTime = new Date('2025-11-26T10:00:06.000Z');
      const result = manager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(false);
    });

    it('should return false when file change is before Claude output', () => {
      // Setup: Claude output at 10:00:05
      mockSession.claudeLastActivity = '2025-11-26T10:00:05.000Z';
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: File change at 10:00:00 (5 seconds before)
      const fileChangeTime = new Date('2025-11-26T10:00:00.000Z');
      const result = manager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(false);
    });

    it('should return false when no Claude activity recorded', () => {
      // Setup: No claudeLastActivity
      mockSession.claudeLastActivity = undefined;
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: File change at any time
      const fileChangeTime = new Date('2025-11-26T10:00:00.000Z');
      const result = manager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(false);
    });

    it('should return false when session not found', () => {
      // Setup: Session not found
      (sessionManager.getSession as jest.Mock).mockReturnValue(undefined);

      // Test: File change at any time
      const fileChangeTime = new Date('2025-11-26T10:00:00.000Z');
      const result = manager.isClaudeActivity('session-999', fileChangeTime);

      expect(result).toBe(false);
    });

    it('should return true at exact 5-second boundary', () => {
      // Setup: Claude output at 10:00:00
      mockSession.claudeLastActivity = '2025-11-26T10:00:00.000Z';
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: File change at exactly 10:00:05 (5 seconds later)
      const fileChangeTime = new Date('2025-11-26T10:00:05.000Z');
      const result = manager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(true);
    });
  });

  describe('linkToStory', () => {
    beforeEach(() => {
      // Mock parseSprintStatus to return in-progress story
      (parseSprintStatus as jest.Mock).mockReturnValue({
        epics: [],
        stories: [
          {
            storyId: '5-4',
            storyKey: '5-4-bmad-artifact-detection',
            epicNumber: 5,
            storyNumber: 4,
            slug: 'bmad-artifact-detection',
            status: 'in-progress',
            artifacts: []
          }
        ],
        currentEpic: 5,
        currentStory: '5-4',
        lastUpdated: '2025-11-26T10:00:00.000Z'
      });

      // Mock fs.readFile for sprint status
      (fs.readFile as jest.Mock).mockResolvedValue('mocked sprint status yaml');
    });

    it('should create new artifact review entry for first modification', async () => {
      const filePath = '/workspace/.worktrees/session-123/backend/src/test.ts';
      const broadcastCallback = jest.fn();

      await manager.linkToStory('session-123', filePath, 'claude', broadcastCallback);

      // Verify artifact review was created
      expect(mockSession.artifactReviews).toBeDefined();
      expect(mockSession.artifactReviews!['backend/src/test.ts']).toBeDefined();
      const review = mockSession.artifactReviews!['backend/src/test.ts'];
      expect(review.reviewStatus).toBe('pending');
      expect(review.revision).toBe(1);
      expect(review.modifiedBy).toBe('claude');
      expect(review.lastModified).toBeDefined();

      // Verify session was saved
      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);

      // Verify WebSocket broadcast
      expect(broadcastCallback).toHaveBeenCalledTimes(1);
      const message = broadcastCallback.mock.calls[0][0] as ArtifactUpdatedMessage;
      expect(message.type).toBe('artifact.updated');
      expect(message.sessionId).toBe('session-123');
      expect(message.storyId).toBe('5-4');
      expect(message.artifact.path).toBe(filePath);
      expect(message.artifact.reviewStatus).toBe('pending');
      expect(message.artifact.modifiedBy).toBe('claude');
      expect(message.artifact.revision).toBe(1);
    });

    it('should increment revision on subsequent modifications', async () => {
      // Setup: Existing artifact review
      mockSession.artifactReviews = {
        'backend/src/test.ts': {
          reviewStatus: 'approved',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T09:00:00.000Z',
          approvedAt: '2025-11-26T09:30:00.000Z'
        }
      };

      const filePath = '/workspace/.worktrees/session-123/backend/src/test.ts';
      const broadcastCallback = jest.fn();

      await manager.linkToStory('session-123', filePath, 'user', broadcastCallback);

      // Verify revision incremented
      const review = mockSession.artifactReviews!['backend/src/test.ts'];
      expect(review.revision).toBe(2);
      expect(review.reviewStatus).toBe('pending'); // Reset to pending
      expect(review.modifiedBy).toBe('user');
      expect(review.approvedAt).toBeUndefined(); // Cleared
    });

    it('should reset review status to pending on any change', async () => {
      // Setup: Existing approved artifact
      mockSession.artifactReviews = {
        'backend/src/test.ts': {
          reviewStatus: 'approved',
          revision: 2,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T09:00:00.000Z',
          approvedAt: '2025-11-26T09:30:00.000Z'
        }
      };

      const filePath = '/workspace/.worktrees/session-123/backend/src/test.ts';
      await manager.linkToStory('session-123', filePath, 'claude');

      // Verify status reset
      const review = mockSession.artifactReviews!['backend/src/test.ts'];
      expect(review.reviewStatus).toBe('pending');
      expect(review.approvedAt).toBeUndefined();
    });

    it('should skip linking if file not in worktree', async () => {
      const filePath = '/workspace/docs/some-file.md'; // Not in worktree
      const broadcastCallback = jest.fn();

      await manager.linkToStory('session-123', filePath, 'claude', broadcastCallback);

      // Verify no artifact review created
      expect(mockSession.artifactReviews).toEqual({});
      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
      expect(broadcastCallback).not.toHaveBeenCalled();
    });

    it('should skip linking if no in-progress story found', async () => {
      // Mock: No in-progress stories
      (parseSprintStatus as jest.Mock).mockReturnValue({
        epics: [],
        stories: [
          {
            storyId: '5-4',
            storyKey: '5-4-bmad-artifact-detection',
            epicNumber: 5,
            storyNumber: 4,
            slug: 'bmad-artifact-detection',
            status: 'review', // Not in-progress
            artifacts: []
          }
        ],
        currentEpic: 5,
        currentStory: null,
        lastUpdated: '2025-11-26T10:00:00.000Z'
      });

      const filePath = '/workspace/.worktrees/session-123/backend/src/test.ts';
      const broadcastCallback = jest.fn();

      await manager.linkToStory('session-123', filePath, 'claude', broadcastCallback);

      // Verify no artifact review created
      expect(mockSession.artifactReviews).toEqual({});
      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
      expect(broadcastCallback).not.toHaveBeenCalled();
    });

    it('should handle session not found gracefully', async () => {
      (sessionManager.getSession as jest.Mock).mockReturnValue(undefined);

      const filePath = '/workspace/.worktrees/session-123/backend/src/test.ts';
      const broadcastCallback = jest.fn();

      // Should not throw
      await expect(
        manager.linkToStory('session-999', filePath, 'claude', broadcastCallback)
      ).resolves.toBeUndefined();

      expect(broadcastCallback).not.toHaveBeenCalled();
    });
  });

  describe('cleanupStaleEntries', () => {
    beforeEach(() => {
      mockSession.artifactReviews = {
        'backend/src/exists.ts': {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        },
        'backend/src/deleted.ts': {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        }
      };
    });

    it('should remove artifact reviews for deleted files', async () => {
      // Mock: First file exists, second file doesn't
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // exists.ts exists
        .mockRejectedValueOnce(new Error('ENOENT')); // deleted.ts doesn't exist

      await manager.cleanupStaleEntries('session-123');

      // Verify stale entry removed
      expect(mockSession.artifactReviews!['backend/src/exists.ts']).toBeDefined();
      expect(mockSession.artifactReviews!['backend/src/deleted.ts']).toBeUndefined();

      // Verify session saved
      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });

    it('should not modify artifacts if all files exist', async () => {
      // Mock: All files exist
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await manager.cleanupStaleEntries('session-123');

      // Verify no changes
      expect(mockSession.artifactReviews!['backend/src/exists.ts']).toBeDefined();
      expect(mockSession.artifactReviews!['backend/src/deleted.ts']).toBeDefined();

      // Session save not called when no changes
      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });

    it('should handle session without artifact reviews', async () => {
      mockSession.artifactReviews = undefined;

      // Should not throw
      await expect(
        manager.cleanupStaleEntries('session-123')
      ).resolves.toBeUndefined();
    });
  });

  describe('updateReviewStatus', () => {
    beforeEach(() => {
      mockSession.artifactReviews = {
        'backend/src/test.ts': {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        }
      };
    });

    it('should update review status to approved', async () => {
      await manager.updateReviewStatus('session-123', 'backend/src/test.ts', 'approved');

      const review = mockSession.artifactReviews!['backend/src/test.ts'];
      expect(review.reviewStatus).toBe('approved');
      expect(review.approvedAt).toBeDefined();
      expect(review.changesRequestedAt).toBeUndefined();
      expect(review.feedback).toBeUndefined();

      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });

    it('should update review status to changes-requested with feedback', async () => {
      await manager.updateReviewStatus(
        'session-123',
        'backend/src/test.ts',
        'changes-requested',
        'Please add more error handling'
      );

      const review = mockSession.artifactReviews!['backend/src/test.ts'];
      expect(review.reviewStatus).toBe('changes-requested');
      expect(review.changesRequestedAt).toBeDefined();
      expect(review.feedback).toBe('Please add more error handling');
      expect(review.approvedAt).toBeUndefined();

      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });

    it('should throw error if artifact review not found', async () => {
      await expect(
        manager.updateReviewStatus('session-123', 'nonexistent.ts', 'approved')
      ).rejects.toThrow('Artifact review not found: nonexistent.ts');
    });
  });

  describe('reconcileWithGitStatus - Story 5.10', () => {
    let mockGitManager: any;

    beforeEach(() => {
      mockGitManager = {
        getStatus: jest.fn()
      };
      (GitManager as jest.Mock).mockImplementation(() => mockGitManager);

      mockSession.artifactReviews = {
        'backend/src/approved-and-staged.ts': {
          reviewStatus: 'approved',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z',
          approvedAt: '2025-11-26T10:30:00.000Z'
        },
        'backend/src/approved-but-unstaged.ts': {
          reviewStatus: 'approved',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z',
          approvedAt: '2025-11-26T10:30:00.000Z'
        },
        'backend/src/pending.ts': {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        }
      };
    });

    it('should reset approved files to pending if not staged', async () => {
      // Mock git status: only first file is staged
      mockGitManager.getStatus.mockResolvedValue({
        staged: [{ path: 'backend/src/approved-and-staged.ts' }],
        modified: [],
        untracked: []
      });

      await manager.reconcileWithGitStatus('session-123');

      // Verify: approved-and-staged remains approved
      expect(mockSession.artifactReviews!['backend/src/approved-and-staged.ts'].reviewStatus).toBe('approved');
      expect(mockSession.artifactReviews!['backend/src/approved-and-staged.ts'].approvedAt).toBeDefined();

      // Verify: approved-but-unstaged reset to pending
      expect(mockSession.artifactReviews!['backend/src/approved-but-unstaged.ts'].reviewStatus).toBe('pending');
      expect(mockSession.artifactReviews!['backend/src/approved-but-unstaged.ts'].approvedAt).toBeUndefined();

      // Verify: pending remains pending
      expect(mockSession.artifactReviews!['backend/src/pending.ts'].reviewStatus).toBe('pending');

      // Verify session saved
      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });

    it('should not save session if no reconciliation needed', async () => {
      // Mock git status: both approved files are staged
      mockGitManager.getStatus.mockResolvedValue({
        staged: [
          { path: 'backend/src/approved-and-staged.ts' },
          { path: 'backend/src/approved-but-unstaged.ts' }
        ],
        modified: [],
        untracked: []
      });

      await manager.reconcileWithGitStatus('session-123');

      // Verify no changes
      expect(mockSession.artifactReviews!['backend/src/approved-and-staged.ts'].reviewStatus).toBe('approved');
      expect(mockSession.artifactReviews!['backend/src/approved-but-unstaged.ts'].reviewStatus).toBe('approved');

      // Session save not called
      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });

    it('should handle session without artifactReviews', async () => {
      mockSession.artifactReviews = undefined;

      await expect(
        manager.reconcileWithGitStatus('session-123')
      ).resolves.toBeUndefined();

      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });

    it('should handle git status error gracefully', async () => {
      mockGitManager.getStatus.mockRejectedValue(new Error('Git command failed'));

      await expect(
        manager.reconcileWithGitStatus('session-123')
      ).resolves.toBeUndefined();

      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });
  });

  describe('clearReviews - Story 5.10', () => {
    beforeEach(() => {
      mockSession.artifactReviews = {
        'backend/src/file1.ts': {
          reviewStatus: 'approved',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        },
        'backend/src/file2.ts': {
          reviewStatus: 'pending',
          revision: 2,
          modifiedBy: 'user',
          lastModified: '2025-11-26T11:00:00.000Z'
        },
        'backend/src/file3.ts': {
          reviewStatus: 'approved',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        }
      };
    });

    it('should clear review entries for committed files', async () => {
      await manager.clearReviews('session-123', [
        'backend/src/file1.ts',
        'backend/src/file2.ts'
      ]);

      // Verify: file1 and file2 cleared
      expect(mockSession.artifactReviews!['backend/src/file1.ts']).toBeUndefined();
      expect(mockSession.artifactReviews!['backend/src/file2.ts']).toBeUndefined();

      // Verify: file3 remains
      expect(mockSession.artifactReviews!['backend/src/file3.ts']).toBeDefined();

      // Verify session saved
      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });

    it('should not save if no paths were cleared', async () => {
      await manager.clearReviews('session-123', [
        'backend/src/nonexistent.ts'
      ]);

      // Verify all reviews remain
      expect(Object.keys(mockSession.artifactReviews!).length).toBe(3);

      // Session save not called
      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });

    it('should handle empty file paths array', async () => {
      await manager.clearReviews('session-123', []);

      // Verify all reviews remain
      expect(Object.keys(mockSession.artifactReviews!).length).toBe(3);

      // Session save not called
      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });

    it('should handle session without artifactReviews', async () => {
      mockSession.artifactReviews = undefined;

      await expect(
        manager.clearReviews('session-123', ['backend/src/file1.ts'])
      ).resolves.toBeUndefined();

      expect(sessionManager.saveSessions).not.toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      (sessionManager.getSession as jest.Mock).mockReturnValue(undefined);

      await expect(
        manager.clearReviews('session-999', ['backend/src/file1.ts'])
      ).rejects.toThrow('Session not found: session-999');
    });
  });

  describe('cleanupStaleEntries with git status - Story 5.10', () => {
    let mockGitManager: any;

    beforeEach(() => {
      mockGitManager = {
        getStatus: jest.fn()
      };
      (GitManager as jest.Mock).mockImplementation(() => mockGitManager);

      mockSession.artifactReviews = {
        'backend/src/exists-modified.ts': {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        },
        'backend/src/exists-committed.ts': {
          reviewStatus: 'approved',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        },
        'backend/src/deleted.ts': {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy: 'claude',
          lastModified: '2025-11-26T10:00:00.000Z'
        }
      };
    });

    it('should cleanup both deleted and committed files', async () => {
      // Mock git status: only first file is tracked (modified)
      mockGitManager.getStatus.mockResolvedValue({
        staged: [],
        modified: [{ path: 'backend/src/exists-modified.ts' }],
        untracked: []
      });

      // Mock file existence: first two exist, third is deleted
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // exists-modified exists
        .mockResolvedValueOnce(undefined) // exists-committed exists
        .mockRejectedValueOnce(new Error('ENOENT')); // deleted doesn't exist

      await manager.cleanupStaleEntries('session-123');

      // Verify: exists-modified kept (tracked in git)
      expect(mockSession.artifactReviews!['backend/src/exists-modified.ts']).toBeDefined();

      // Verify: exists-committed removed (not tracked, so it's committed)
      expect(mockSession.artifactReviews!['backend/src/exists-committed.ts']).toBeUndefined();

      // Verify: deleted removed (file doesn't exist)
      expect(mockSession.artifactReviews!['backend/src/deleted.ts']).toBeUndefined();

      // Verify session saved
      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });

    it('should fallback to file existence check if git status fails', async () => {
      // Mock git status fails
      mockGitManager.getStatus.mockRejectedValue(new Error('Git not initialized'));

      // Mock file existence: first file exists, others deleted
      (fs.access as jest.Mock)
        .mockResolvedValueOnce(undefined) // exists-modified exists
        .mockRejectedValueOnce(new Error('ENOENT')) // exists-committed deleted
        .mockRejectedValueOnce(new Error('ENOENT')); // deleted doesn't exist

      await manager.cleanupStaleEntries('session-123');

      // Verify: only first file kept
      expect(mockSession.artifactReviews!['backend/src/exists-modified.ts']).toBeDefined();
      expect(mockSession.artifactReviews!['backend/src/exists-committed.ts']).toBeUndefined();
      expect(mockSession.artifactReviews!['backend/src/deleted.ts']).toBeUndefined();

      // Verify session saved
      expect(sessionManager.saveSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle custom activity window', () => {
      // Create manager with 10-second window
      const customManager = new ArtifactReviewManager(10000);

      mockSession.claudeLastActivity = '2025-11-26T10:00:00.000Z';
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: 8 seconds should be within 10s window
      const fileChangeTime = new Date('2025-11-26T10:00:08.000Z');
      const result = customManager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(true);
    });

    it('should handle millisecond precision in activity window', () => {
      mockSession.claudeLastActivity = '2025-11-26T10:00:00.000Z';
      (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);

      // Test: 4999ms should be within window
      const fileChangeTime = new Date('2025-11-26T10:00:04.999Z');
      const result = manager.isClaudeActivity('session-123', fileChangeTime);

      expect(result).toBe(true);
    });
  });
});
