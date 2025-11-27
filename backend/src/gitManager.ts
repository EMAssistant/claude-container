/**
 * Git Manager Module
 * Story 5.1: Git Status API Endpoints
 *
 * Manages git operations via simple-git wrapper.
 * Provides git status parsing and reporting for session worktrees.
 *
 * Features:
 * - Parse git status --porcelain -b output
 * - Extract branch, ahead/behind counts
 * - Categorize files: staged, modified, untracked
 * - Handle renamed files with oldPath tracking
 * - Error handling for non-git repositories
 */

import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from './utils/logger';
import { GitStatus, GitFileEntry } from './types';

/**
 * Custom error class for git not initialized
 */
export class GitNotInitializedError extends Error {
  code = 'GIT_NOT_INITIALIZED';

  constructor(message: string) {
    super(message);
    this.name = 'GitNotInitializedError';
  }
}

/**
 * Custom error class for git command failures
 */
export class GitCommandError extends Error {
  code = 'GIT_COMMAND_FAILED';
  stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = 'GitCommandError';
    this.stderr = stderr;
  }
}

/**
 * Custom error class for nothing to commit
 * Story 5.2 AC #4
 */
export class NothingToCommitError extends Error {
  code = 'NOTHING_STAGED';

  constructor(message: string) {
    super(message);
    this.name = 'NothingToCommitError';
  }
}

/**
 * Custom error class for git authentication errors
 * Story 5.2 AC #7
 */
export class GitAuthError extends Error {
  code = 'GIT_AUTH_FAILED';
  stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = 'GitAuthError';
    this.stderr = stderr;
  }
}

/**
 * Custom error class for git merge conflicts
 * Story 5.2 AC #7
 */
export class GitMergeConflictError extends Error {
  code = 'GIT_MERGE_CONFLICT';
  conflicts: string[];

  constructor(message: string, conflicts: string[]) {
    super(message);
    this.name = 'GitMergeConflictError';
    this.conflicts = conflicts;
  }
}

/**
 * Custom error class for git remote errors
 * Story 5.2 AC #7
 */
export class GitRemoteError extends Error {
  code = 'GIT_REMOTE_ERROR';
  stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = 'GitRemoteError';
    this.stderr = stderr;
  }
}

/**
 * Custom error class for validation errors
 * Story 5.2 - Input validation
 */
export class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * GitManager class
 * Wraps simple-git for session-specific git operations
 */
export class GitManager {
  private git: SimpleGit;
  private worktreePath: string;

  /**
   * Create a new GitManager instance
   * @param worktreePath Absolute path to git worktree
   */
  constructor(worktreePath: string) {
    this.worktreePath = worktreePath;
    this.git = simpleGit(worktreePath);
  }

  /**
   * Get git status for the worktree
   * Story 5.1 AC #1-4: Parse git status --porcelain -b output
   *
   * @returns GitStatus object with branch, ahead/behind, and file arrays
   * @throws GitNotInitializedError if not a git repository
   * @throws GitCommandError if git command fails
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const result = await this.git.raw(['status', '--porcelain', '-b']);
      const status = this.parseGitStatus(result);

      // If no ahead/behind from tracking, calculate relative to origin's default branch
      if (status.ahead === 0 && status.behind === 0 && status.branch) {
        const { ahead, behind } = await this.calculateAheadBehind(status.branch);
        status.ahead = ahead;
        status.behind = behind;
      }

      return status;
    } catch (error: any) {
      // Check for "not a git repository" error
      if (error.message && error.message.includes('not a git repository')) {
        logger.warn('Git status failed: not a git repository', {
          worktreePath: this.worktreePath
        });
        throw new GitNotInitializedError('Not a git repository');
      }

      // Other git errors
      logger.error('Git status command failed', {
        worktreePath: this.worktreePath,
        error: error.message,
        stderr: error.stderr || ''
      });
      throw new GitCommandError('Git status failed', error.stderr || error.message);
    }
  }

  /**
   * Calculate ahead/behind relative to origin's default branch
   * Used when the current branch has no upstream tracking branch set.
   *
   * @param currentBranch The current branch name
   * @returns Object with ahead and behind counts
   */
  private async calculateAheadBehind(currentBranch: string): Promise<{ ahead: number; behind: number }> {
    try {
      // Try to find the default remote branch (origin/main or origin/master)
      let remoteBranch = 'origin/main';
      try {
        await this.git.raw(['rev-parse', '--verify', 'origin/main']);
      } catch {
        // Try origin/master as fallback
        try {
          await this.git.raw(['rev-parse', '--verify', 'origin/master']);
          remoteBranch = 'origin/master';
        } catch {
          // No remote branch found, can't calculate
          logger.debug('No remote branch found for ahead/behind calculation', {
            worktreePath: this.worktreePath,
            currentBranch
          });
          return { ahead: 0, behind: 0 };
        }
      }

      // Calculate commits ahead (local commits not on remote)
      const aheadResult = await this.git.raw([
        'rev-list',
        '--count',
        `${remoteBranch}..${currentBranch}`
      ]);
      const ahead = parseInt(aheadResult.trim(), 10) || 0;

      // Calculate commits behind (remote commits not on local)
      const behindResult = await this.git.raw([
        'rev-list',
        '--count',
        `${currentBranch}..${remoteBranch}`
      ]);
      const behind = parseInt(behindResult.trim(), 10) || 0;

      logger.debug('Calculated ahead/behind relative to remote', {
        worktreePath: this.worktreePath,
        currentBranch,
        remoteBranch,
        ahead,
        behind
      });

      return { ahead, behind };
    } catch (error) {
      // Silently return 0/0 on any error (don't break status)
      logger.debug('Failed to calculate ahead/behind', {
        worktreePath: this.worktreePath,
        currentBranch,
        error: error instanceof Error ? error.message : String(error)
      });
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * Parse git status --porcelain -b output
   * Story 5.1 AC #2: Parse porcelain format correctly
   *
   * Format:
   * Line 1: ## branch-name...origin/branch-name [ahead X, behind Y]
   * Subsequent lines: XY path (X = staged, Y = working tree)
   *
   * Status codes:
   * - M (modified), A (added), D (deleted), R (renamed), ?? (untracked)
   * - First char = staged status, second char = working tree status
   *
   * @param output Raw git status --porcelain -b output
   * @returns Parsed GitStatus object
   */
  private parseGitStatus(output: string): GitStatus {
    const lines = output.trim().split('\n');

    // Handle empty repository or no output
    if (lines.length === 0 || !lines[0]) {
      return {
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: []
      };
    }

    // Parse first line: ## branch-name...origin/branch-name [ahead X, behind Y]
    const branchLine = lines[0];
    const branchMatch = branchLine.match(/^## ([^\s.]+)/);
    const branch = branchMatch ? branchMatch[1] : '';

    const aheadMatch = branchLine.match(/ahead (\d+)/);
    const behindMatch = branchLine.match(/behind (\d+)/);
    const ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0;
    const behind = behindMatch ? parseInt(behindMatch[1], 10) : 0;

    const staged: GitFileEntry[] = [];
    const modified: GitFileEntry[] = [];
    const untracked: GitFileEntry[] = [];

    // Parse subsequent lines: XY path
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3);

      // Status codes:
      // First char (X) = staged status
      // Second char (Y) = working tree status
      const stagedStatus = statusCode[0];
      const workingStatus = statusCode[1];

      // Handle renamed files: "R  old.ts -> new.ts"
      let path = filePath;
      let oldPath: string | undefined;
      if (stagedStatus === 'R') {
        const renameParts = filePath.split(' -> ');
        if (renameParts.length === 2) {
          oldPath = renameParts[0];
          path = renameParts[1];
        }
      }

      // Untracked files (status ??)
      if (statusCode === '??') {
        untracked.push({ path, status: '??' });
        continue;
      }

      // Staged files (X != ' ')
      if (stagedStatus !== ' ' && stagedStatus !== '?') {
        staged.push({
          path,
          status: statusCode as any,
          oldPath
        });
      }

      // Modified files (Y != ' ' and not untracked)
      if (workingStatus !== ' ' && statusCode !== '??') {
        // If file is both staged and modified (MM), it appears in both arrays
        modified.push({
          path,
          status: statusCode as any,
          oldPath
        });
      }
    }

    return {
      branch,
      ahead,
      behind,
      staged,
      modified,
      untracked
    };
  }

  /**
   * Stage files in the worktree
   * Story 5.2 AC #1: Stage files for commit
   *
   * @param files Array of file paths or glob patterns to stage
   * @returns Array of successfully staged files
   * @throws ValidationError if files array is empty
   * @throws GitCommandError if git add fails
   */
  async stageFiles(files: string[]): Promise<string[]> {
    if (!files || files.length === 0) {
      throw new ValidationError('Files array required', 'files');
    }

    try {
      // simple-git add() accepts array of files or glob patterns
      await this.git.add(files);

      logger.info('Git stage', {
        worktreePath: this.worktreePath,
        files,
        count: files.length
      });

      return files;
    } catch (error: any) {
      logger.error('Git stage failed', {
        worktreePath: this.worktreePath,
        error: error.message,
        stderr: error.stderr || ''
      });
      throw new GitCommandError('Git stage failed', error.stderr || error.message);
    }
  }

  /**
   * Unstage files in the worktree
   * Story 5.2 AC #2: Unstage files (keep working tree changes)
   *
   * @param files Array of file paths to unstage
   * @returns Array of successfully unstaged files
   * @throws ValidationError if files array is empty
   * @throws GitCommandError if git reset fails
   */
  async unstageFiles(files: string[]): Promise<string[]> {
    if (!files || files.length === 0) {
      throw new ValidationError('Files array required', 'files');
    }

    try {
      // simple-git reset() with files unstages without losing working tree changes
      await this.git.reset(['HEAD', '--', ...files]);

      logger.info('Git unstage', {
        worktreePath: this.worktreePath,
        files,
        count: files.length
      });

      return files;
    } catch (error: any) {
      logger.error('Git unstage failed', {
        worktreePath: this.worktreePath,
        error: error.message,
        stderr: error.stderr || ''
      });
      throw new GitCommandError('Git unstage failed', error.stderr || error.message);
    }
  }

  /**
   * Sanitize commit message
   * Story 5.2: Commit message sanitization
   *
   * - Escape double quotes to prevent shell injection
   * - Limit first line to 72 chars (git best practice)
   * - Preserve multi-line messages
   *
   * @param message Raw commit message
   * @returns Sanitized commit message
   * @throws ValidationError if message is empty
   */
  private sanitizeCommitMessage(message: string): string {
    if (!message || message.trim() === '') {
      throw new ValidationError('Commit message required', 'message');
    }

    // Escape double quotes to prevent shell injection
    let sanitized = message.replace(/"/g, '\\"');

    // Split into lines (preserve multi-line messages)
    const lines = sanitized.split('\n');

    // Limit first line to 72 chars (git best practice)
    if (lines[0].length > 72) {
      lines[0] = lines[0].substring(0, 69) + '...';
    }

    return lines.join('\n');
  }

  /**
   * Commit staged files
   * Story 5.2 AC #3, #4: Commit staged files with message sanitization
   *
   * @param message Commit message
   * @returns Commit hash and sanitized message
   * @throws ValidationError if message is empty
   * @throws NothingToCommitError if no files are staged
   * @throws GitCommandError if git commit fails
   */
  async commit(message: string): Promise<{ commitHash: string; message: string }> {
    // Check if anything is staged
    const status = await this.getStatus();
    if (status.staged.length === 0) {
      throw new NothingToCommitError('Nothing to commit');
    }

    // Sanitize message
    const sanitizedMessage = this.sanitizeCommitMessage(message);

    try {
      // Execute git commit
      const result = await this.git.commit(sanitizedMessage);
      const commitHash = result.commit;

      logger.info('Git commit', {
        worktreePath: this.worktreePath,
        hash: commitHash,
        message: sanitizedMessage
      });

      return { commitHash, message: sanitizedMessage };
    } catch (error: any) {
      logger.error('Git commit failed', {
        worktreePath: this.worktreePath,
        error: error.message,
        stderr: error.stderr || ''
      });
      throw new GitCommandError('Git commit failed', error.stderr || error.message);
    }
  }

  /**
   * Parse conflict file paths from git stderr
   * Story 5.2: Helper for GitMergeConflictError
   *
   * @param stderr Git error output
   * @returns Array of conflicting file paths
   */
  private parseConflicts(stderr: string): string[] {
    // Extract conflict file paths from git stderr
    const conflictRegex = /CONFLICT \(.*?\): (.+)/g;
    const conflicts: string[] = [];
    let match;

    while ((match = conflictRegex.exec(stderr)) !== null) {
      conflicts.push(match[1]);
    }

    return conflicts;
  }

  /**
   * Push commits to remote
   * Story 5.2 AC #5, #7: Push to remote with error handling
   *
   * @throws GitAuthError if authentication fails
   * @throws GitRemoteError if no remote tracking branch
   * @throws GitCommandError if push fails
   */
  async push(): Promise<void> {
    // Get current branch from status
    const status = await this.getStatus();
    const branch = status.branch;

    if (!branch) {
      throw new GitRemoteError('No branch found', 'Not on any branch');
    }

    try {
      // Push to origin with --set-upstream to handle new branches
      // This creates the remote branch if it doesn't exist
      await this.git.raw(['push', '--set-upstream', 'origin', branch]);

      logger.info('Git push', {
        worktreePath: this.worktreePath,
        branch,
        success: true
      });
    } catch (error: any) {
      const stderr = error.stderr || error.message;

      // Detect authentication errors
      if (stderr.includes('Permission denied') || stderr.includes('authentication failed')) {
        logger.warn('Git auth failed', {
          worktreePath: this.worktreePath,
          operation: 'push'
        });
        throw new GitAuthError('Git authentication failed', stderr);
      }

      // Detect remote errors (no remote configured)
      if (stderr.includes('does not have a remote') || stderr.includes('No configured push destination')) {
        throw new GitRemoteError('No remote configured', stderr);
      }

      logger.error('Git push failed', {
        worktreePath: this.worktreePath,
        error: error.message,
        stderr
      });
      throw new GitCommandError('Git push failed', stderr);
    }
  }

  /**
   * Get file content at HEAD (last commit)
   * Used for Git diff comparison
   *
   * @param filePath Relative file path within the worktree
   * @returns File content at HEAD, or null if file doesn't exist at HEAD
   * @throws GitCommandError if git show fails for other reasons
   */
  async getFileAtHead(filePath: string): Promise<string | null> {
    try {
      // git show HEAD:path/to/file returns the file content at HEAD
      const content = await this.git.raw(['show', `HEAD:${filePath}`]);
      return content;
    } catch (error: any) {
      const stderr = error.stderr || error.message;

      // File doesn't exist at HEAD (new file)
      if (stderr.includes('does not exist') || stderr.includes('path') && stderr.includes('does not exist in')) {
        return null;
      }

      // Fatal error - not a valid object name (file never existed)
      if (stderr.includes('fatal:') && (stderr.includes('does not exist') || stderr.includes('invalid object'))) {
        return null;
      }

      logger.error('Git show failed', {
        worktreePath: this.worktreePath,
        filePath,
        error: error.message,
        stderr
      });
      throw new GitCommandError('Git show failed', stderr);
    }
  }

  /**
   * Pull commits from remote
   * Story 5.2 AC #6, #7: Pull from remote with error handling
   *
   * @returns Number of commits pulled
   * @throws GitAuthError if authentication fails
   * @throws GitMergeConflictError if merge conflicts occur
   * @throws GitRemoteError if no remote tracking branch
   * @throws GitCommandError if pull fails
   */
  async pull(): Promise<{ commits: number }> {
    // Get current branch from status
    const status = await this.getStatus();
    const branch = status.branch;

    if (!branch) {
      throw new GitRemoteError('No branch found', 'Not on any branch');
    }

    // Check if the remote branch exists before attempting pull
    try {
      await this.git.raw(['rev-parse', '--verify', `origin/${branch}`]);
    } catch {
      // Remote branch doesn't exist - nothing to pull
      logger.info('Git pull skipped - remote branch does not exist', {
        worktreePath: this.worktreePath,
        branch
      });
      return { commits: 0 };
    }

    try {
      // Pull from origin
      const result = await this.git.pull('origin', branch);

      // Parse commit count from result (summary.changes, or 0 if unparseable)
      const commits = result.summary?.changes || 0;

      logger.info('Git pull', {
        worktreePath: this.worktreePath,
        branch,
        commits
      });

      return { commits };
    } catch (error: any) {
      const stderr = error.stderr || error.message;

      // Detect authentication errors
      if (stderr.includes('Permission denied') || stderr.includes('authentication failed')) {
        logger.warn('Git auth failed', {
          worktreePath: this.worktreePath,
          operation: 'pull'
        });
        throw new GitAuthError('Git authentication failed', stderr);
      }

      // Detect merge conflicts
      if (stderr.includes('CONFLICT') || stderr.includes('Automatic merge failed')) {
        const conflicts = this.parseConflicts(stderr);
        throw new GitMergeConflictError('Merge conflict detected', conflicts);
      }

      // Detect remote errors
      if (stderr.includes('no tracking information') || stderr.includes('does not have a remote')) {
        throw new GitRemoteError('No remote tracking branch', stderr);
      }

      // Remote branch doesn't exist (couldn't find remote ref)
      if (stderr.includes("couldn't find remote ref")) {
        logger.info('Git pull skipped - remote branch does not exist', {
          worktreePath: this.worktreePath,
          branch
        });
        return { commits: 0 };
      }

      logger.error('Git pull failed', {
        worktreePath: this.worktreePath,
        error: error.message,
        stderr
      });
      throw new GitCommandError('Git pull failed', stderr);
    }
  }
}
