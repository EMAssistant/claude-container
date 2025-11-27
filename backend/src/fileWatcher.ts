/**
 * File Watcher Module
 * Story 3.4: File Tree Component with Workspace Navigation
 * Story 3.6: Context-Aware Layout Shifting (Terminal ↔ Artifacts)
 *
 * Features:
 * - Watches /workspace directory for file system changes
 * - Sends file.changed WebSocket messages on add/change/unlink events
 * - Debounces rapid file changes (500ms) to batch updates
 * - Ignores node_modules, .git, .worktrees directories
 * - Detects markdown file writes in docs/ folder and triggers layout.shift messages
 */

import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createLogger, format, transports } from 'winston';
import { FileTreeNode, FileChangedMessage, LayoutShiftMessage, WorkflowState, SprintStatus, GitStatus, GitStatusUpdatedMessage, ArtifactUpdatedMessage } from './types';
import { parseWorkflowStatus, parseSprintStatus } from './statusParser';
import { GitManager } from './gitManager';
import { artifactReviewManager } from './artifactReviewManager';

// Winston logger configuration
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

// Workspace root path
const WORKSPACE_ROOT = '/workspace';

// Debounce delay for file change events (500ms)
const DEBOUNCE_DELAY = 500;

// File change event handler type
type FileChangeHandler = (message: FileChangedMessage) => void;

// Story 3.6: Layout shift event handler type
type LayoutShiftHandler = (message: LayoutShiftMessage) => void;

// Story 3.1: Workflow update event handler type
type WorkflowUpdateHandler = (workflow: WorkflowState) => void;

// Story 6.1: Sprint update event handler type
type SprintUpdateHandler = (sprintStatus: SprintStatus, changedStories: string[]) => void;

// Story 5.1: Git status update event handler type
type GitStatusUpdateHandler = (message: GitStatusUpdatedMessage) => void;

// Story 5.4: Artifact update event handler type
type ArtifactUpdateHandler = (message: ArtifactUpdatedMessage) => void;

// Pattern to match BMAD workflow status files
const WORKFLOW_STATUS_PATTERN = /bmm-workflow-status\.yaml$/;

// Story 6.1: Pattern to match sprint status files
const SPRINT_STATUS_PATTERN = /sprint-status\.yaml$/;

// Story 5.1: Debounce delay for git status refresh (500ms)
const GIT_STATUS_DEBOUNCE_DELAY = 500;

/**
 * File Watcher class
 * Manages chokidar instance and broadcasts file change events
 */
class FileWatcherManager {
  private watcher: FSWatcher | null = null;
  private handlers: Set<FileChangeHandler> = new Set();
  private layoutShiftHandlers: Set<LayoutShiftHandler> = new Set(); // Story 3.6
  private workflowUpdateHandlers: Set<WorkflowUpdateHandler> = new Set(); // Story 3.1
  private sprintUpdateHandlers: Set<SprintUpdateHandler> = new Set(); // Story 6.1
  private gitStatusUpdateHandlers: Set<GitStatusUpdateHandler> = new Set(); // Story 5.1
  private artifactUpdateHandlers: Set<ArtifactUpdateHandler> = new Set(); // Story 5.4
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastSprintStatus: SprintStatus | null = null; // Story 6.1: Track previous sprint status for diff
  private gitStatusDebounceTimers: Map<string, NodeJS.Timeout> = new Map(); // Story 5.1: Per-session git status debounce

  /**
   * Start watching the workspace directory
   */
  start(): void {
    if (this.watcher) {
      logger.warn('File watcher already running');
      return;
    }

    logger.info('Starting file watcher', { workspace: WORKSPACE_ROOT });

    this.watcher = chokidar.watch(WORKSPACE_ROOT, {
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files on startup
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.worktrees/**',
        '**/.claude-container-sessions.json' // Ignore session persistence file
      ],
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFileEvent(filePath, 'add'))
      .on('change', (filePath: string) => this.handleFileEvent(filePath, 'change'))
      .on('unlink', (filePath: string) => this.handleFileEvent(filePath, 'unlink'))
      .on('error', (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('File watcher error', { error: error.message, stack: error.stack });
      })
      .on('ready', () => {
        logger.info('File watcher ready');
      });
  }

  /**
   * Stop watching the workspace directory
   */
  async stop(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    logger.info('Stopping file watcher');

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    await this.watcher.close();
    this.watcher = null;

    logger.info('File watcher stopped');
  }

  /**
   * Register a handler for file change events
   */
  onFileChange(handler: FileChangeHandler): () => void {
    this.handlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Story 3.6: Register a handler for layout shift events
   */
  onLayoutShift(handler: LayoutShiftHandler): () => void {
    this.layoutShiftHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.layoutShiftHandlers.delete(handler);
    };
  }

  /**
   * Story 3.1: Register a handler for workflow update events
   */
  onWorkflowUpdate(handler: WorkflowUpdateHandler): () => void {
    this.workflowUpdateHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.workflowUpdateHandlers.delete(handler);
    };
  }

  /**
   * Story 6.1: Register a handler for sprint update events
   */
  onSprintUpdate(handler: SprintUpdateHandler): () => void {
    this.sprintUpdateHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.sprintUpdateHandlers.delete(handler);
    };
  }

  /**
   * Story 5.1: Register a handler for git status update events
   */
  onGitStatusUpdate(handler: GitStatusUpdateHandler): () => void {
    this.gitStatusUpdateHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.gitStatusUpdateHandlers.delete(handler);
    };
  }

  /**
   * Story 5.4: Register a handler for artifact update events
   */
  onArtifactUpdate(handler: ArtifactUpdateHandler): () => void {
    this.artifactUpdateHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.artifactUpdateHandlers.delete(handler);
    };
  }

  /**
   * Story 3.1: Load and broadcast initial workflow status on startup
   * Called after file watcher is started to send current workflow state
   */
  async loadInitialWorkflowStatus(): Promise<void> {
    const statusFilePath = path.join(WORKSPACE_ROOT, 'docs', 'bmm-workflow-status.yaml');

    try {
      const content = await fs.readFile(statusFilePath, 'utf-8');
      const workflowState = parseWorkflowStatus(content);

      if (workflowState) {
        logger.info('Initial workflow status loaded', {
          path: statusFilePath,
          currentStep: workflowState.currentStep,
          stepsCount: workflowState.steps.length
        });
        this.broadcastWorkflowUpdate(workflowState);
      }
    } catch (error) {
      // File doesn't exist or can't be read - this is normal for new projects
      logger.debug('No initial workflow status file found', { path: statusFilePath });
    }
  }

  /**
   * Handle file system event with debouncing
   */
  private handleFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): void {
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.broadcastFileChange(filePath, event);
    }, DEBOUNCE_DELAY);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Broadcast file change message to all registered handlers
   */
  private broadcastFileChange(filePath: string, event: 'add' | 'change' | 'unlink'): void {
    const message: FileChangedMessage = {
      type: 'file.changed',
      path: filePath,
      event,
      timestamp: new Date().toISOString()
    };

    logger.info('File change detected', { path: filePath, event });

    // Call all registered handlers
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (error) {
        logger.error('Error in file change handler', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    // Story 3.6: Check if this is a markdown file write in docs/ folder
    // Trigger layout shift to artifact-dominant mode
    if ((event === 'add' || event === 'change') &&
        filePath.includes('/docs/') &&
        filePath.endsWith('.md')) {
      this.broadcastLayoutShift('artifact', 'file_write');
    }

    // Story 3.1: Check if this is a BMAD workflow status file change
    // Parse and broadcast workflow state updates
    if ((event === 'add' || event === 'change') &&
        WORKFLOW_STATUS_PATTERN.test(filePath)) {
      this.handleWorkflowStatusChange(filePath);
    }

    // Story 6.1: Check if this is a sprint status file change
    // Parse and broadcast sprint status updates
    if ((event === 'add' || event === 'change') &&
        SPRINT_STATUS_PATTERN.test(filePath)) {
      this.handleSprintStatusChange(filePath);
    }

    // Story 5.1: Check if file is in a session worktree
    // Trigger git status refresh for the session
    this.handleWorktreeFileChange(filePath);

    // Story 5.4: Check if file is in a session worktree
    // Detect artifact changes and link to story
    if (event === 'change' || event === 'add') {
      this.handleArtifactDetection(filePath);
    }
  }

  /**
   * Story 3.1: Handle workflow status file change
   * Read, parse, and broadcast workflow state
   */
  private async handleWorkflowStatusChange(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const workflowState = parseWorkflowStatus(content);

      if (workflowState) {
        logger.info('Workflow status file changed', {
          path: filePath,
          currentStep: workflowState.currentStep,
          completedSteps: workflowState.completedSteps.length,
          totalSteps: workflowState.steps.length
        });
        this.broadcastWorkflowUpdate(workflowState);
      }
    } catch (error) {
      logger.error('Error reading workflow status file', {
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Story 3.1: Broadcast workflow update to all registered handlers
   */
  private broadcastWorkflowUpdate(workflow: WorkflowState): void {
    logger.info('Broadcasting workflow update', {
      currentStep: workflow.currentStep,
      stepsCount: workflow.steps.length
    });

    for (const handler of this.workflowUpdateHandlers) {
      try {
        handler(workflow);
      } catch (error) {
        logger.error('Error in workflow update handler', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }

  /**
   * Story 3.6: Broadcast layout shift message to all registered handlers
   */
  private broadcastLayoutShift(mode: 'terminal' | 'artifact' | 'split', trigger: 'file_write' | 'user_input'): void {
    const message: LayoutShiftMessage = {
      type: 'layout.shift',
      mode,
      trigger
    };

    logger.info('Layout shift triggered', { mode, trigger });

    // Call all registered layout shift handlers
    for (const handler of this.layoutShiftHandlers) {
      try {
        handler(message);
      } catch (error) {
        logger.error('Error in layout shift handler', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }

  /**
   * Story 6.1: Handle sprint status file change
   * Read, parse, and broadcast sprint status with changed stories
   */
  private async handleSprintStatusChange(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const sprintStatus = parseSprintStatus(content);

      if (sprintStatus) {
        // Calculate changed stories by diffing with previous state
        const changedStories: string[] = [];
        if (this.lastSprintStatus) {
          // Compare story statuses to detect changes
          const currentStories = new Map(sprintStatus.stories.map(s => [s.storyId, s.status]));
          const previousStories = new Map(this.lastSprintStatus.stories.map(s => [s.storyId, s.status]));

          // Check for status changes in existing stories
          for (const [storyId, currentStatus] of currentStories) {
            const previousStatus = previousStories.get(storyId);
            if (previousStatus !== currentStatus) {
              changedStories.push(storyId);
            }
          }

          // Check for new stories
          for (const storyId of currentStories.keys()) {
            if (!previousStories.has(storyId)) {
              changedStories.push(storyId);
            }
          }
        }

        logger.info('Sprint status file changed', {
          path: filePath,
          currentEpic: sprintStatus.currentEpic,
          currentStory: sprintStatus.currentStory,
          epicCount: sprintStatus.epics.length,
          storyCount: sprintStatus.stories.length,
          changedStories
        });

        // Store current state for next diff
        this.lastSprintStatus = sprintStatus;

        // Broadcast sprint update
        this.broadcastSprintUpdate(sprintStatus, changedStories);
      }
    } catch (error) {
      logger.error('Error reading sprint status file', {
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Story 6.1: Broadcast sprint update to all registered handlers
   */
  private broadcastSprintUpdate(sprintStatus: SprintStatus, changedStories: string[]): void {
    logger.info('Broadcasting sprint update', {
      currentEpic: sprintStatus.currentEpic,
      currentStory: sprintStatus.currentStory,
      changedStoriesCount: changedStories.length
    });

    for (const handler of this.sprintUpdateHandlers) {
      try {
        handler(sprintStatus, changedStories);
      } catch (error) {
        logger.error('Error in sprint update handler', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }

  /**
   * Story 5.1: Handle worktree file change
   * Detect file changes in session worktrees and trigger git status refresh
   */
  private handleWorktreeFileChange(filePath: string): void {
    // Check if file is in a session worktree: /workspace/.worktrees/<sessionId>/
    const worktreeMatch = filePath.match(/\/workspace\/\.worktrees\/([^/]+)\//);
    if (!worktreeMatch) {
      return; // Not a worktree file
    }

    const sessionId = worktreeMatch[1];

    // Ignore .git directory changes (git internals)
    if (filePath.includes('/.git/')) {
      return;
    }

    // Story 5.1 AC #6: Debounce git status refresh (500ms)
    // Clear existing timer for this session
    const existingTimer = this.gitStatusDebounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.gitStatusDebounceTimers.delete(sessionId);
      await this.refreshGitStatus(sessionId);
    }, GIT_STATUS_DEBOUNCE_DELAY);

    this.gitStatusDebounceTimers.set(sessionId, timer);
  }

  /**
   * Story 5.1: Refresh git status for a session and broadcast update
   */
  private async refreshGitStatus(sessionId: string): Promise<void> {
    try {
      // Import sessionManager dynamically to avoid circular dependency
      const { sessionManager } = await import('./sessionManager');

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        logger.debug('Git status refresh skipped: session not found', { sessionId });
        return;
      }

      const gitManager = new GitManager(session.worktreePath);
      const status = await gitManager.getStatus();

      logger.debug('Git status refreshed via file watcher', {
        sessionId,
        branch: status.branch,
        stagedCount: status.staged.length,
        modifiedCount: status.modified.length,
        untrackedCount: status.untracked.length
      });

      // Broadcast git.status.updated message
      this.broadcastGitStatusUpdate(sessionId, status);
    } catch (error) {
      // Silently ignore git errors (e.g., not a git repository)
      // These are expected in some scenarios (session destroyed, worktree removed, etc.)
      logger.debug('Git status refresh failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Story 5.1: Broadcast git status update to all registered handlers
   */
  private broadcastGitStatusUpdate(sessionId: string, status: GitStatus): void {
    const message: GitStatusUpdatedMessage = {
      type: 'git.status.updated',
      sessionId,
      status
    };

    logger.debug('Broadcasting git status update', {
      sessionId,
      branch: status.branch,
      handlerCount: this.gitStatusUpdateHandlers.size
    });

    for (const handler of this.gitStatusUpdateHandlers) {
      try {
        handler(message);
      } catch (error) {
        logger.error('Error in git status update handler', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }

  /**
   * Story 5.4: Handle artifact detection for worktree file changes
   * Detect if file change was caused by Claude and link to current story
   */
  private async handleArtifactDetection(filePath: string): Promise<void> {
    // Check if file is in a session worktree: /workspace/.worktrees/<sessionId>/
    const worktreeMatch = filePath.match(/\/workspace\/\.worktrees\/([^/]+)\//);
    if (!worktreeMatch) {
      return; // Not a worktree file
    }

    const sessionId = worktreeMatch[1];

    // Ignore .git directory changes
    if (filePath.includes('/.git/')) {
      return;
    }

    // Ignore session persistence file
    if (filePath.includes('.claude-container-sessions.json')) {
      return;
    }

    // Detect if change was caused by Claude
    const changeTimestamp = new Date();
    const isClaudeChange = artifactReviewManager.isClaudeActivity(sessionId, changeTimestamp);
    const modifiedBy = isClaudeChange ? 'claude' : 'user';

    // Link file to current story
    await artifactReviewManager.linkToStory(
      sessionId,
      filePath,
      modifiedBy,
      (message) => this.broadcastArtifactUpdate(message)
    );
  }

  /**
   * Story 5.4: Broadcast artifact update to all registered handlers
   */
  private broadcastArtifactUpdate(message: ArtifactUpdatedMessage): void {
    logger.debug('Broadcasting artifact update', {
      sessionId: message.sessionId,
      storyId: message.storyId,
      artifactPath: message.artifact.path
    });

    for (const handler of this.artifactUpdateHandlers) {
      try {
        handler(message);
      } catch (error) {
        logger.error('Error in artifact update handler', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }

  /**
   * Build file tree from workspace directory
   * Returns hierarchical FileTreeNode structure
   * Security: Validates path is within /workspace to prevent path traversal
   */
  async buildFileTree(rootPath: string = WORKSPACE_ROOT): Promise<FileTreeNode[]> {
    // Security: Validate path is within workspace to prevent path traversal
    const normalizedPath = path.normalize(rootPath);
    if (!normalizedPath.startsWith(WORKSPACE_ROOT)) {
      logger.error('Path traversal attempt detected', { rootPath, normalizedPath });
      throw new Error(`Invalid path: must be within ${WORKSPACE_ROOT}`);
    }

    try {
      const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
      const nodes: FileTreeNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(rootPath, entry.name);

        // Skip ignored directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.worktrees') {
          continue;
        }

        // Skip session persistence file
        if (entry.name === '.claude-container-sessions.json') {
          continue;
        }

        const stats = await fs.stat(fullPath);
        const node: FileTreeNode = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          lastModified: stats.mtime.toISOString()
        };

        // Recursively build children for directories
        if (entry.isDirectory()) {
          node.children = await this.buildFileTree(fullPath);
        }

        nodes.push(node);
      }

      // Sort: directories first, then files, alphabetically within each group
      nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });

      return nodes;
    } catch (error) {
      logger.error('Error building file tree', {
        path: rootPath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}

// Export singleton instance
export const fileWatcher = new FileWatcherManager();
