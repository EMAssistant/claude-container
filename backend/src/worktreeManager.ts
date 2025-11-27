import simpleGit, { SimpleGit, GitError } from 'simple-git';
import { createLogger, format, transports } from 'winston';
import * as path from 'path';
import * as fs from 'fs/promises';
import { realpathSync } from 'fs';

// Winston logger for worktree operations
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      )
    })
  ]
});

/**
 * Worktree information structure
 */
export interface WorktreeInfo {
  /** Absolute path to worktree directory */
  path: string;
  /** Git branch associated with worktree */
  branch: string;
}

/**
 * WorktreeManager Options
 */
export interface WorktreeManagerOptions {
  /** Root directory of workspace (contains .git) */
  workspaceRoot: string;
}

/**
 * Git Worktree Manager
 *
 * Manages git worktrees for session isolation.
 * Each session operates in its own worktree on a separate branch.
 *
 * Story 2.2: Git Worktree Creation and Branch Management
 * Architecture: ADR-008 (simple-git library for git operations)
 */
export class WorktreeManager {
  private git: SimpleGit;
  private workspaceRoot: string;
  private worktreesDir: string;

  /**
   * Create a new WorktreeManager instance
   *
   * @param options Configuration options
   * @throws Error if workspace root is invalid or git not available
   */
  constructor(options: WorktreeManagerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.worktreesDir = path.join(this.workspaceRoot, '.worktrees');
    // Lazy initialize git - don't call simpleGit until needed
    // This supports test environments where workspaceRoot may not exist
    this.git = null as any;

    // Resolve symlinks (e.g., /var -> /private/var on macOS)
    try {
      this.worktreesDir = realpathSync(this.worktreesDir);
    } catch (error) {
      // worktreesDir might not exist yet, which is fine
      // Try to resolve parent directory symlinks
      try {
        const parentRealpath = realpathSync(this.workspaceRoot);
        this.worktreesDir = path.join(parentRealpath, '.worktrees');
      } catch {
        // If that also fails, keep original path
      }
    }

    logger.info('WorktreeManager initialized', {
      workspaceRoot: this.workspaceRoot,
      worktreesDir: this.worktreesDir
    });
  }

  /**
   * Get the git instance, initializing lazily if needed
   */
  private getGit(): SimpleGit {
    if (!this.git) {
      this.git = simpleGit(this.workspaceRoot);
    }
    return this.git;
  }

  /**
   * Create a new git worktree for a session
   *
   * Executes: git worktree add -b <branch> /workspace/.worktrees/<session-id>
   *
   * @param sessionId Unique session identifier
   * @param branchName Git branch name (e.g., "feature/feature-auth")
   * @returns Absolute path to created worktree
   * @throws Error if branch already exists or git operation fails
   *
   * @example
   * ```typescript
   * const worktreePath = await worktreeManager.createWorktree(
   *   '550e8400-e29b-41d4-a716-446655440000',
   *   'feature/feature-auth'
   * );
   * // Returns: '/workspace/.worktrees/550e8400-e29b-41d4-a716-446655440000'
   * ```
   */
  async createWorktree(sessionId: string, branchName: string): Promise<string> {
    const worktreePath = path.join(this.worktreesDir, sessionId);

    logger.info('Creating worktree', {
      sessionId,
      branchName,
      worktreePath
    });

    try {
      // Ensure .worktrees directory exists
      await fs.mkdir(this.worktreesDir, { recursive: true });

      // Execute git worktree add with new branch
      // git worktree add -b <branch> <path>
      await this.getGit().raw([
        'worktree',
        'add',
        '-b',
        branchName,
        worktreePath
      ]);

      // Verify worktree was created successfully
      const exists = await this.worktreeExists(worktreePath);
      if (!exists) {
        throw new Error(`Worktree directory not created at ${worktreePath}`);
      }

      logger.info('Worktree created successfully', {
        sessionId,
        branch: branchName,
        path: worktreePath
      });

      return worktreePath;
    } catch (error) {
      // Extract git error details
      const gitError = error as GitError;
      const errorMessage = gitError.message || String(error);
      const gitOutput = gitError.stack || '';

      logger.error('Git worktree creation failed', {
        sessionId,
        branch: branchName,
        path: worktreePath,
        error: errorMessage,
        gitOutput
      });

      // Provide user-friendly error messages
      if (errorMessage.includes('already exists')) {
        throw new Error(
          `Branch '${branchName}' already exists. Cannot create worktree for session ${sessionId}.`
        );
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('EACCES')) {
        throw new Error(
          `Permission denied creating worktree at ${worktreePath}. Check filesystem permissions.`
        );
      } else if (errorMessage.includes('ENOSPC') || errorMessage.includes('no space')) {
        throw new Error(
          `Insufficient disk space to create worktree for session ${sessionId}.`
        );
      } else {
        throw new Error(
          `Failed to create worktree for session ${sessionId}: ${errorMessage}`
        );
      }
    }
  }

  /**
   * Create a new git worktree for an existing branch
   *
   * Story 4.14: Existing Branch Selection for Sessions
   * Executes: git worktree add /workspace/.worktrees/<session-id> <existing-branch>
   * (WITHOUT -b flag, which would create a new branch)
   *
   * @param sessionId Unique session identifier
   * @param branchName Existing git branch name (e.g., "main", "feature/auth")
   * @returns Absolute path to created worktree
   * @throws Error if branch doesn't exist or git operation fails
   *
   * @example
   * ```typescript
   * const worktreePath = await worktreeManager.createWorktreeFromExistingBranch(
   *   '550e8400-e29b-41d4-a716-446655440000',
   *   'main'
   * );
   * // Returns: '/workspace/.worktrees/550e8400-e29b-41d4-a716-446655440000'
   * // Worktree is checked out to existing 'main' branch
   * ```
   */
  async createWorktreeFromExistingBranch(sessionId: string, branchName: string): Promise<string> {
    const worktreePath = path.join(this.worktreesDir, sessionId);

    logger.info('Creating worktree from existing branch', {
      sessionId,
      branchName,
      worktreePath
    });

    // Check if a worktree already exists for this branch
    // If so, return the existing worktree path (shared worktree support)
    const existingWorktree = await this.findWorktreeForBranch(branchName);
    if (existingWorktree) {
      logger.info('Reusing existing worktree for branch (shared worktree)', {
        sessionId,
        branch: branchName,
        existingPath: existingWorktree.path,
        requestedPath: worktreePath
      });
      return existingWorktree.path;
    }

    try {
      // Ensure .worktrees directory exists
      await fs.mkdir(this.worktreesDir, { recursive: true });

      // Execute git worktree add WITHOUT -b flag (for existing branch)
      // git worktree add <path> <existing-branch>
      await this.getGit().raw([
        'worktree',
        'add',
        worktreePath,
        branchName
      ]);

      // Verify worktree was created successfully
      const exists = await this.worktreeExists(worktreePath);
      if (!exists) {
        throw new Error(`Worktree directory not created at ${worktreePath}`);
      }

      logger.info('Worktree created successfully from existing branch', {
        sessionId,
        branch: branchName,
        path: worktreePath
      });

      return worktreePath;
    } catch (error) {
      // Extract git error details
      const gitError = error as GitError;
      const errorMessage = gitError.message || String(error);
      const gitOutput = gitError.stack || '';

      logger.error('Git worktree creation from existing branch failed', {
        sessionId,
        branch: branchName,
        path: worktreePath,
        error: errorMessage,
        gitOutput
      });

      // Provide user-friendly error messages
      if (errorMessage.includes('invalid reference') || errorMessage.includes('not a valid')) {
        throw new Error(
          `Branch '${branchName}' does not exist. Cannot create worktree for session ${sessionId}.`
        );
      } else if (errorMessage.includes('already checked out') || errorMessage.includes('already exists')) {
        // Try to find and return the existing worktree (fallback for race conditions)
        const fallbackWorktree = await this.findWorktreeForBranch(branchName);
        if (fallbackWorktree) {
          logger.info('Found existing worktree after conflict (shared worktree fallback)', {
            sessionId,
            branch: branchName,
            existingPath: fallbackWorktree.path
          });
          return fallbackWorktree.path;
        }
        throw new Error(
          `Branch '${branchName}' is already checked out in another worktree. Cannot create worktree for session ${sessionId}.`
        );
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('EACCES')) {
        throw new Error(
          `Permission denied creating worktree at ${worktreePath}. Check filesystem permissions.`
        );
      } else if (errorMessage.includes('ENOSPC') || errorMessage.includes('no space')) {
        throw new Error(
          `Insufficient disk space to create worktree for session ${sessionId}.`
        );
      } else {
        throw new Error(
          `Failed to create worktree for session ${sessionId}: ${errorMessage}`
        );
      }
    }
  }

  /**
   * Remove a git worktree for a session
   *
   * Executes: git worktree remove <path> [--force]
   * Note: Branch is NOT deleted (user responsibility per FR20)
   *
   * @param sessionId Session identifier
   * @param force Force removal even with uncommitted changes
   * @returns Promise that resolves when worktree is removed
   * @throws Error if worktree doesn't exist or removal fails
   *
   * @example
   * ```typescript
   * // Remove worktree without force (fails if uncommitted changes)
   * await worktreeManager.removeWorktree('550e8400-e29b-41d4-a716-446655440000');
   *
   * // Force removal (discards uncommitted changes)
   * await worktreeManager.removeWorktree('550e8400-e29b-41d4-a716-446655440000', true);
   * ```
   */
  async removeWorktree(sessionId: string, force: boolean = true): Promise<void> {
    const worktreePath = path.join(this.worktreesDir, sessionId);

    logger.info('Removing worktree', {
      sessionId,
      worktreePath,
      force
    });

    try {
      // Build git worktree remove command
      const args = ['worktree', 'remove'];
      if (force) {
        args.push('--force');
      }
      args.push(worktreePath);

      // Execute git worktree remove
      await this.getGit().raw(args);

      // Verify worktree was removed
      const exists = await this.worktreeExists(worktreePath);
      if (exists) {
        logger.warn('Worktree directory still exists after removal', {
          sessionId,
          worktreePath
        });
      }

      logger.info('Worktree removed successfully', {
        sessionId,
        cleanup: true,
        forced: force
      });
    } catch (error) {
      const gitError = error as GitError;
      const errorMessage = gitError.message || String(error);
      const gitOutput = gitError.stack || '';

      logger.error('Git worktree removal failed', {
        sessionId,
        path: worktreePath,
        force,
        error: errorMessage,
        gitOutput
      });

      // Provide user-friendly error messages
      if (errorMessage.includes('is not a working tree') || errorMessage.includes('not found')) {
        throw new Error(
          `Worktree for session ${sessionId} does not exist at ${worktreePath}.`
        );
      } else if (errorMessage.includes('uncommitted changes') || errorMessage.includes('modified content')) {
        throw new Error(
          `Worktree for session ${sessionId} has uncommitted changes. Use force flag to discard changes.`
        );
      } else if (errorMessage.includes('locked')) {
        throw new Error(
          `Worktree for session ${sessionId} is locked by another git operation. Try again later.`
        );
      } else {
        throw new Error(
          `Failed to remove worktree for session ${sessionId}: ${errorMessage}`
        );
      }
    }
  }

  /**
   * List all git worktrees in the workspace
   *
   * Executes: git worktree list --porcelain
   * Filters for worktrees in /workspace/.worktrees/ directory only
   *
   * @returns Array of worktree information objects
   *
   * @example
   * ```typescript
   * const worktrees = await worktreeManager.listWorktrees();
   * // Returns: [
   * //   { path: '/workspace/.worktrees/session-1', branch: 'feature/auth' },
   * //   { path: '/workspace/.worktrees/session-2', branch: 'feature/ui' }
   * // ]
   * ```
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    logger.debug('Listing worktrees');

    try {
      // Execute git worktree list --porcelain
      const output = await this.getGit().raw(['worktree', 'list', '--porcelain']);

      // Parse porcelain output
      const worktrees = this.parseWorktreeList(output);

      // Filter for worktrees in .worktrees directory only
      const sessionWorktrees = worktrees.filter(wt =>
        wt.path.startsWith(this.worktreesDir)
      );

      logger.debug('Worktrees listed successfully', {
        total: worktrees.length,
        sessionWorktrees: sessionWorktrees.length
      });

      return sessionWorktrees;
    } catch (error) {
      const gitError = error as GitError;
      const errorMessage = gitError.message || String(error);

      logger.error('Git worktree list failed', {
        error: errorMessage,
        gitOutput: gitError.stack
      });

      throw new Error(`Failed to list worktrees: ${errorMessage}`);
    }
  }

  /**
   * Validate branch name against git restrictions
   *
   * Rules:
   * - Only alphanumeric, dash, slash, underscore characters
   * - Max 255 characters (git limit)
   * - Cannot start with slash or dot
   *
   * @param name Branch name to validate
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * worktreeManager.validateBranchName('feature/auth'); // true
   * worktreeManager.validateBranchName('feature/my-feature'); // true
   * worktreeManager.validateBranchName('/invalid'); // false (starts with slash)
   * worktreeManager.validateBranchName('has spaces'); // false (invalid chars)
   * ```
   */
  validateBranchName(name: string): boolean {
    // Check length
    if (name.length === 0 || name.length > 255) {
      return false;
    }

    // Check for leading slash or dot (git restriction)
    if (name.startsWith('/') || name.startsWith('.')) {
      return false;
    }

    // Check for valid git branch characters
    // Allowed: alphanumeric, dash, slash, underscore, dot
    const validPattern = /^[a-zA-Z0-9/_.-]+$/;
    if (!validPattern.test(name)) {
      return false;
    }

    return true;
  }

  /**
   * Generate branch name from session name
   *
   * Converts session name to git branch format:
   * - User-provided names: feature/<session-name>
   * - Auto-generated names: feature/YYYY-MM-DD-NNN
   *
   * @param sessionName Session name (user-provided or auto-generated)
   * @returns Git branch name
   *
   * @example
   * ```typescript
   * worktreeManager.generateBranchName('feature-auth');
   * // Returns: 'feature/feature-auth'
   *
   * worktreeManager.generateBranchName('2025-11-24-001');
   * // Returns: 'feature/2025-11-24-001'
   * ```
   */
  generateBranchName(sessionName: string): string {
    // Clean session name (replace multiple spaces with single dash, remove special chars)
    const cleanName = sessionName
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_.-]/g, '');

    // Format: feature/<session-name>
    const branchName = `feature/${cleanName}`;

    logger.debug('Generated branch name', {
      sessionName,
      branchName
    });

    return branchName;
  }

  /**
   * Check if worktree directory exists
   *
   * @param worktreePath Path to worktree directory
   * @returns true if exists, false otherwise
   */
  private async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
      await fs.access(worktreePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find an existing worktree for a given branch
   *
   * Used to enable shared worktrees between sessions.
   * If a worktree already exists for a branch, sessions can share it.
   *
   * @param branchName The branch name to find a worktree for
   * @returns WorktreeInfo if found, null if no worktree exists for this branch
   *
   * @example
   * ```typescript
   * const existingWorktree = await worktreeManager.findWorktreeForBranch('feature/auth');
   * if (existingWorktree) {
   *   // Reuse existing worktree path
   *   console.log('Found existing worktree at:', existingWorktree.path);
   * }
   * ```
   */
  async findWorktreeForBranch(branchName: string): Promise<WorktreeInfo | null> {
    try {
      const worktrees = await this.listWorktrees();
      const found = worktrees.find(wt => wt.branch === branchName);

      if (found) {
        logger.debug('Found existing worktree for branch', {
          branch: branchName,
          path: found.path
        });
      }

      return found || null;
    } catch (error) {
      logger.warn('Failed to find worktree for branch', {
        branch: branchName,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Prune orphaned git worktrees
   *
   * Removes worktrees that are marked as "prunable" by git
   * (worktrees whose directories no longer exist on disk).
   *
   * @returns Number of worktrees pruned
   *
   * @example
   * ```typescript
   * const pruned = await worktreeManager.pruneOrphanedWorktrees();
   * console.log(`Pruned ${pruned} orphaned worktrees`);
   * ```
   */
  async pruneOrphanedWorktrees(): Promise<number> {
    logger.info('Pruning orphaned worktrees');

    try {
      // Get worktree list before pruning
      const beforeOutput = await this.getGit().raw(['worktree', 'list', '--porcelain']);
      const beforeCount = (beforeOutput.match(/^worktree /gm) || []).length;

      // Execute git worktree prune
      await this.getGit().raw(['worktree', 'prune']);

      // Get worktree list after pruning
      const afterOutput = await this.getGit().raw(['worktree', 'list', '--porcelain']);
      const afterCount = (afterOutput.match(/^worktree /gm) || []).length;

      const prunedCount = beforeCount - afterCount;

      logger.info('Worktree prune completed', {
        beforeCount,
        afterCount,
        pruned: prunedCount
      });

      return prunedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Git worktree prune failed', {
        error: errorMessage
      });
      throw new Error(`Failed to prune worktrees: ${errorMessage}`);
    }
  }

  /**
   * Parse git worktree list --porcelain output
   *
   * Porcelain format:
   * worktree <path>
   * HEAD <commit>
   * branch <branch>
   *
   * @param output Raw output from git worktree list --porcelain
   * @returns Array of parsed worktree information
   */
  private parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const lines = output.split('\n');

    let currentWorktree: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        // Empty line indicates end of worktree entry
        if (currentWorktree.path && currentWorktree.branch) {
          worktrees.push(currentWorktree as WorktreeInfo);
          currentWorktree = {};
        }
        continue;
      }

      if (trimmedLine.startsWith('worktree ')) {
        // Start new worktree entry
        currentWorktree.path = trimmedLine.substring('worktree '.length).trim();
      } else if (trimmedLine.startsWith('branch ')) {
        // Extract branch name (remove refs/heads/ prefix)
        const branchRef = trimmedLine.substring('branch '.length).trim();
        currentWorktree.branch = branchRef.replace('refs/heads/', '');
      }
    }

    // Add last worktree if present
    if (currentWorktree.path && currentWorktree.branch) {
      worktrees.push(currentWorktree as WorktreeInfo);
    }

    return worktrees;
  }
}

/**
 * Singleton WorktreeManager instance
 *
 * Note: Git operations are lazy-initialized on first use via getGit(),
 * so this can be safely instantiated even if /workspace doesn't exist yet.
 * This supports test environments where the workspace path may not exist.
 */
export const worktreeManager = new WorktreeManager({
  workspaceRoot: process.env.WORKSPACE_ROOT || '/workspace'
});
