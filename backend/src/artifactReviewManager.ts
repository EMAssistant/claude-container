/**
 * Artifact Review Manager
 * Story 5.4: BMAD Artifact Detection with Story Linking
 *
 * Detects when Claude modifies files and links them to the active story's artifact list.
 * Tracks review status (pending/approved/changes-requested) and revision counts.
 *
 * Key Features:
 * - Claude activity detection: Files changed within 5s of PTY output attributed to Claude
 * - Story linking: Files linked to current in-progress story from sprint-status.yaml
 * - Review state: Tracks reviewStatus, revision, modifiedBy, timestamps per file
 * - WebSocket broadcasting: Sends artifact.updated messages to frontend
 * - Session persistence: Review state saved in session JSON across restarts
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ArtifactReview, ArtifactInfo, ArtifactUpdatedMessage } from './types';
import { logger } from './utils/logger';
import { parseSprintStatus } from './statusParser';

/**
 * Claude activity window (5 seconds)
 * If file change occurs within this window after last PTY output, attribute to Claude
 */
const CLAUDE_ACTIVITY_WINDOW_MS = 5000;

/**
 * Sprint status file path
 */
const SPRINT_STATUS_PATH = '/workspace/docs/sprint-artifacts/sprint-status.yaml';

/**
 * Artifact Review Manager class
 * Singleton instance exported for use throughout the application
 */
export class ArtifactReviewManager {
  private readonly claudeActivityWindowMs: number;

  constructor(claudeActivityWindowMs: number = CLAUDE_ACTIVITY_WINDOW_MS) {
    this.claudeActivityWindowMs = claudeActivityWindowMs;
    logger.info('ArtifactReviewManager initialized', {
      claudeActivityWindowMs: this.claudeActivityWindowMs
    });
  }

  /**
   * Check if file change was caused by Claude activity
   * Story 5.4 AC #2: Claude activity detection within 5-second window
   *
   * @param sessionId Session identifier
   * @param fileChangeTimestamp File modification timestamp
   * @returns true if change attributed to Claude, false if attributed to user
   */
  isClaudeActivity(sessionId: string, fileChangeTimestamp: Date): boolean {
    // Import sessionManager dynamically to avoid circular dependency
    const { sessionManager } = require('./sessionManager');

    const session = sessionManager.getSession(sessionId);
    if (!session?.claudeLastActivity) {
      // No recent Claude activity recorded
      logger.debug('No Claude activity recorded for session', { sessionId });
      return false;
    }

    const lastActivity = new Date(session.claudeLastActivity);
    const timeDiff = fileChangeTimestamp.getTime() - lastActivity.getTime();

    // Check if file change is within activity window
    // timeDiff must be >= 0 (file change after Claude output) and <= window
    const isClaudeChange = timeDiff >= 0 && timeDiff <= this.claudeActivityWindowMs;

    logger.debug('Claude activity detection', {
      sessionId,
      fileChangeTimestamp: fileChangeTimestamp.toISOString(),
      lastClaudeActivity: session.claudeLastActivity,
      timeDiffMs: timeDiff,
      isClaudeChange
    });

    return isClaudeChange;
  }

  /**
   * Link file to current story and create/update artifact review entry
   * Story 5.4 AC #3: Link changed files to current in-progress story
   * Story 5.4 AC #4: Add reviewStatus field to ArtifactInfo
   * Story 5.4 AC #5: Broadcast artifact.updated WebSocket event
   * Story 5.4 AC #6: Track revision count for review cycles
   *
   * @param sessionId Session identifier
   * @param filePath Absolute file path
   * @param modifiedBy Who modified the file (claude or user)
   * @param broadcastCallback Callback to broadcast WebSocket message
   */
  async linkToStory(
    sessionId: string,
    filePath: string,
    modifiedBy: 'claude' | 'user',
    broadcastCallback?: (message: ArtifactUpdatedMessage) => void
  ): Promise<void> {
    // Import sessionManager dynamically to avoid circular dependency
    const { sessionManager } = require('./sessionManager');

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn('Session not found for artifact linking', { sessionId, filePath });
      return;
    }

    // Convert absolute path to relative path from worktree root
    const worktreeRoot = session.worktreePath;
    if (!filePath.startsWith(worktreeRoot)) {
      logger.debug('File not in session worktree, skipping artifact linking', {
        sessionId,
        filePath,
        worktreeRoot
      });
      return;
    }

    const relativePath = path.relative(worktreeRoot, filePath);

    // Story 5.4 AC #3: Read sprint-status.yaml to find current in-progress story
    const currentStory = await this.getCurrentStory();
    if (!currentStory) {
      logger.warn('No in-progress story found, skipping artifact linking', {
        sessionId,
        filePath: relativePath
      });
      return;
    }

    const storyId = currentStory;

    // Story 5.4 AC #6: Get or create artifact review entry
    const existingReview = session.artifactReviews?.[relativePath];
    const reviewEntry: ArtifactReview = existingReview
      ? {
          ...existingReview,
          revision: existingReview.revision + 1,
          reviewStatus: 'pending', // Reset to pending on any change
          modifiedBy,
          lastModified: new Date().toISOString(),
          // Clear approval/changes-requested timestamps on new change
          approvedAt: undefined,
          changesRequestedAt: undefined,
          feedback: undefined
        }
      : {
          reviewStatus: 'pending',
          revision: 1,
          modifiedBy,
          lastModified: new Date().toISOString()
        };

    // Update session artifactReviews map
    const updatedArtifactReviews = {
      ...(session.artifactReviews || {}),
      [relativePath]: reviewEntry
    };

    // Update session via sessionManager (triggers persistence)
    session.artifactReviews = updatedArtifactReviews;
    await sessionManager.saveSessions();

    logger.info('Artifact linked to story', {
      sessionId,
      storyId,
      filePath: relativePath,
      modifiedBy,
      revision: reviewEntry.revision,
      reviewStatus: reviewEntry.reviewStatus
    });

    // Story 5.4 AC #5: Broadcast artifact.updated WebSocket message
    if (broadcastCallback) {
      const artifact: ArtifactInfo = {
        name: path.basename(relativePath),
        path: filePath, // Send absolute path to frontend
        exists: true,
        icon: '📄', // Default icon
        reviewStatus: reviewEntry.reviewStatus,
        modifiedBy: reviewEntry.modifiedBy,
        revision: reviewEntry.revision,
        lastModified: reviewEntry.lastModified
      };

      const message: ArtifactUpdatedMessage = {
        type: 'artifact.updated',
        sessionId,
        storyId,
        artifact
      };

      broadcastCallback(message);

      logger.debug('Broadcast artifact.updated message', {
        sessionId,
        storyId,
        artifactPath: relativePath
      });
    }
  }

  /**
   * Get current in-progress story from sprint-status.yaml
   * Story 5.4 AC #3: Read sprint-status.yaml to find current in-progress story
   *
   * @returns Story ID (e.g., "5-4") or null if none found
   */
  private async getCurrentStory(): Promise<string | null> {
    try {
      const content = await fs.readFile(SPRINT_STATUS_PATH, 'utf-8');
      const sprintStatus = parseSprintStatus(content);

      if (!sprintStatus) {
        logger.warn('Failed to parse sprint status file', {
          path: SPRINT_STATUS_PATH
        });
        return null;
      }

      // Find first in-progress story
      const inProgressStory = sprintStatus.stories.find(
        story => story.status === 'in-progress'
      );

      if (inProgressStory) {
        logger.debug('Current in-progress story found', {
          storyId: inProgressStory.storyId,
          storyKey: inProgressStory.storyKey
        });
        return inProgressStory.storyId;
      }

      logger.debug('No in-progress story found in sprint status');
      return null;
    } catch (error) {
      logger.error('Error reading sprint status file', {
        path: SPRINT_STATUS_PATH,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Cleanup stale artifact review entries (deleted or committed files)
   * Story 5.10 AC #6: Stale entry cleanup on session load
   *
   * Removes review entries for:
   * - Files that no longer exist in worktree (deleted)
   * - Files that have been committed (not in git status output)
   *
   * @param sessionId Session identifier
   */
  async cleanupStaleEntries(sessionId: string): Promise<void> {
    // Import sessionManager and gitManager dynamically to avoid circular dependency
    const { sessionManager } = require('./sessionManager');
    const { GitManager } = require('./gitManager');

    const session = sessionManager.getSession(sessionId);
    if (!session?.artifactReviews) {
      return;
    }

    const worktreeRoot = session.worktreePath;
    const artifactReviews = session.artifactReviews;
    const staleEntries: string[] = [];

    // Get git status to check for committed files
    let gitStatus: any;
    try {
      const gitManager = new GitManager(worktreeRoot);
      gitStatus = await gitManager.getStatus();
    } catch (error) {
      logger.warn('Failed to get git status for cleanup', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with file existence check only
    }

    // Build set of tracked paths (modified, staged, untracked)
    const trackedPaths = new Set<string>();
    if (gitStatus) {
      gitStatus.staged.forEach((f: any) => trackedPaths.add(f.path));
      gitStatus.modified.forEach((f: any) => trackedPaths.add(f.path));
      gitStatus.untracked.forEach((f: any) => trackedPaths.add(f.path));
    }

    // Check each artifact path for existence and git status
    for (const relativePath of Object.keys(artifactReviews)) {
      const absolutePath = path.join(worktreeRoot, relativePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        // File doesn't exist, mark for removal
        staleEntries.push(relativePath);
        logger.debug('Cleanup: File deleted', { sessionId, path: relativePath });
        continue;
      }

      // If git status available, check if file committed (not in modified/staged/untracked)
      if (gitStatus && !trackedPaths.has(relativePath)) {
        staleEntries.push(relativePath);
        logger.debug('Cleanup: File committed', { sessionId, path: relativePath });
      }
    }

    // Remove stale entries
    if (staleEntries.length > 0) {
      const updatedArtifactReviews = { ...artifactReviews };
      for (const stalePath of staleEntries) {
        delete updatedArtifactReviews[stalePath];
      }

      session.artifactReviews = updatedArtifactReviews;
      await sessionManager.saveSessions();

      logger.info('Cleaned up stale artifact review entries', {
        sessionId,
        staleCount: staleEntries.length,
        stalePaths: staleEntries
      });
    } else {
      logger.debug('No stale artifact review entries found', { sessionId });
    }
  }

  /**
   * Reconcile review state with git status
   * Story 5.10 AC #9: Approved files verified still staged
   *
   * If an approved file is not in git staged area, reset to "pending"
   * (user may have manually unstaged it)
   *
   * @param sessionId Session identifier
   */
  async reconcileWithGitStatus(sessionId: string): Promise<void> {
    // Import sessionManager and gitManager dynamically to avoid circular dependency
    const { sessionManager } = require('./sessionManager');
    const { GitManager } = require('./gitManager');

    const session = sessionManager.getSession(sessionId);
    if (!session?.artifactReviews) {
      return;
    }

    const worktreeRoot = session.worktreePath;
    const artifactReviews = session.artifactReviews;

    // Get git status
    let gitStatus: any;
    try {
      const gitManager = new GitManager(worktreeRoot);
      gitStatus = await gitManager.getStatus();
    } catch (error) {
      logger.warn('Failed to get git status for reconciliation', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    // Build set of staged file paths
    const stagedPaths = new Set<string>(gitStatus.staged.map((f: any) => f.path));

    // Check each approved file
    let reconciled = false;
    for (const [relativePath, reviewEntry] of Object.entries(artifactReviews)) {
      const review = reviewEntry as ArtifactReview;
      if (review.reviewStatus === 'approved' && !stagedPaths.has(relativePath)) {
        // Approved file is not staged - reset to pending
        review.reviewStatus = 'pending';
        review.approvedAt = undefined;
        reconciled = true;
        logger.info('Reconciled: Approved file unstaged, reset to pending', {
          sessionId,
          path: relativePath
        });
      }
    }

    // Save if any reconciliation occurred
    if (reconciled) {
      await sessionManager.saveSessions();
      logger.info('Reconciliation complete', { sessionId });
    } else {
      logger.debug('No reconciliation needed', { sessionId });
    }
  }

  /**
   * Clear review entries for committed files
   * Story 5.10 AC #5: Committed files cleared from artifactReviews
   *
   * Called by git commit handler after successful commit
   *
   * @param sessionId Session identifier
   * @param filePaths Array of file paths that were committed (relative to worktree)
   */
  async clearReviews(sessionId: string, filePaths: string[]): Promise<void> {
    // Import sessionManager dynamically to avoid circular dependency
    const { sessionManager } = require('./sessionManager');

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.artifactReviews) {
      return; // No reviews to clear
    }

    // Remove specified paths
    const clearedPaths: string[] = [];
    for (const filePath of filePaths) {
      if (session.artifactReviews[filePath]) {
        delete session.artifactReviews[filePath];
        clearedPaths.push(filePath);
      }
    }

    // Save session if any paths were cleared
    if (clearedPaths.length > 0) {
      await sessionManager.saveSessions();

      logger.info('Reviews cleared after commit', {
        sessionId,
        clearedCount: clearedPaths.length,
        clearedPaths
      });
    }
  }

  /**
   * Update artifact review status (approve or request changes)
   * Story 5.6: Approve Artifact with Auto-Stage
   * Story 5.7: Request Changes Modal and Claude Injection
   *
   * @param sessionId Session identifier
   * @param filePath Relative file path from worktree root
   * @param reviewStatus New review status
   * @param feedback Optional feedback text (for changes-requested)
   */
  async updateReviewStatus(
    sessionId: string,
    filePath: string,
    reviewStatus: 'approved' | 'changes-requested',
    feedback?: string
  ): Promise<void> {
    // Import sessionManager dynamically to avoid circular dependency
    const { sessionManager } = require('./sessionManager');

    const session = sessionManager.getSession(sessionId);
    if (!session?.artifactReviews?.[filePath]) {
      throw new Error(`Artifact review not found: ${filePath}`);
    }

    const reviewEntry = session.artifactReviews[filePath];
    reviewEntry.reviewStatus = reviewStatus;

    if (reviewStatus === 'approved') {
      reviewEntry.approvedAt = new Date().toISOString();
      reviewEntry.changesRequestedAt = undefined;
      reviewEntry.feedback = undefined;
    } else if (reviewStatus === 'changes-requested') {
      reviewEntry.changesRequestedAt = new Date().toISOString();
      reviewEntry.approvedAt = undefined;
      reviewEntry.feedback = feedback;
    }

    // Update session
    session.artifactReviews[filePath] = reviewEntry;
    await sessionManager.saveSessions();

    logger.info('Artifact review status updated', {
      sessionId,
      filePath,
      reviewStatus,
      revision: reviewEntry.revision
    });
  }
}

/**
 * Singleton instance
 */
export const artifactReviewManager = new ArtifactReviewManager();
