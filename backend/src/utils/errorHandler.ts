/**
 * Error Handler Utility
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.15: Error messages include type, message, details, suggestion
 * AC4.8: Git operation errors translated to user-friendly messages
 *
 * Provides utilities for creating consistent error responses and translating
 * technical errors into user-friendly messages with actionable suggestions.
 */

import { ErrorResponse, ErrorType } from '../types';

/**
 * Create a standardized error response
 * Story 4.5 AC4.15: Error response structure
 *
 * @param type Error category (validation, git, pty, resource, internal)
 * @param message User-friendly error message (what happened)
 * @param details Technical details (why it happened) - optional
 * @param suggestion How to fix (actionable guidance) - optional
 * @param code Machine-readable error code - optional
 * @returns Standardized ErrorResponse object
 *
 * @example
 * createErrorResponse('validation', 'Invalid session name',
 *   'Session names must be alphanumeric with dashes only.',
 *   'Example: feature-auth')
 */
export function createErrorResponse(
  type: ErrorType,
  message: string,
  details?: string,
  suggestion?: string,
  code?: string
): ErrorResponse {
  return {
    error: {
      type,
      message,
      ...(details && { details }),
      ...(suggestion && { suggestion }),
      ...(code && { code })
    }
  };
}

/**
 * Translate git errors into user-friendly error responses
 * Story 4.5 AC4.8: Git operation errors translated
 *
 * Detects common git error patterns and provides specific, actionable guidance
 * instead of generic git error messages.
 *
 * @param gitError Error from git operation
 * @returns ErrorResponse with user-friendly message and suggestion
 *
 * @example
 * try {
 *   await git.checkoutBranch('feature-auth');
 * } catch (error) {
 *   const errorResponse = translateGitError(error);
 *   res.status(409).json(errorResponse);
 * }
 */
export function translateGitError(gitError: Error): ErrorResponse {
  const message = gitError.message.toLowerCase();

  // Branch already exists
  if (message.includes('already exists') && message.includes('branch')) {
    return createErrorResponse(
      'git',
      'Branch already exists',
      gitError.message,
      'Choose a different branch name or delete the existing worktree.',
      'BRANCH_EXISTS'
    );
  }

  // Worktree already exists
  if (message.includes('already exists') && message.includes('worktree')) {
    return createErrorResponse(
      'git',
      'Worktree already exists',
      gitError.message,
      'Remove the existing worktree before creating a new one.',
      'WORKTREE_EXISTS'
    );
  }

  // Worktree is locked
  if (message.includes('worktree') && message.includes('locked')) {
    return createErrorResponse(
      'git',
      'Worktree is locked',
      gitError.message,
      'Another process may be using this worktree. Wait or force unlock with: git worktree unlock <path>',
      'WORKTREE_LOCKED'
    );
  }

  // Worktree in use (cannot remove)
  if (message.includes('worktree') && (message.includes('in use') || message.includes('is dirty'))) {
    return createErrorResponse(
      'git',
      'Worktree is in use',
      gitError.message,
      'Close any processes using this worktree before removing it.',
      'WORKTREE_IN_USE'
    );
  }

  // Branch not found
  if (message.includes('not found') || message.includes('does not exist') || message.includes('did not match')) {
    return createErrorResponse(
      'git',
      'Branch not found',
      gitError.message,
      'Verify the branch name is correct. Use "git branch -a" to list all branches.',
      'BRANCH_NOT_FOUND'
    );
  }

  // No commits yet (empty repository)
  if (message.includes('no commits yet') || message.includes('does not have any commits')) {
    return createErrorResponse(
      'git',
      'Repository has no commits',
      gitError.message,
      'Create an initial commit before creating worktrees: git commit --allow-empty -m "Initial commit"',
      'NO_COMMITS'
    );
  }

  // Merge conflicts
  if (message.includes('conflict') || message.includes('merge')) {
    return createErrorResponse(
      'git',
      'Merge conflict detected',
      gitError.message,
      'Resolve conflicts in the working directory before proceeding.',
      'MERGE_CONFLICT'
    );
  }

  // Detached HEAD state
  if (message.includes('detached head') || message.includes('not currently on a branch')) {
    return createErrorResponse(
      'git',
      'Detached HEAD state',
      gitError.message,
      'Checkout a branch before creating a worktree: git checkout <branch>',
      'DETACHED_HEAD'
    );
  }

  // Permission denied
  if (message.includes('permission denied') || message.includes('access denied')) {
    return createErrorResponse(
      'git',
      'Git permission denied',
      gitError.message,
      'Check file permissions and ownership in the repository.',
      'PERMISSION_DENIED'
    );
  }

  // Generic git error (fallback)
  return createErrorResponse(
    'git',
    'Git operation failed',
    gitError.message,
    'Check git configuration and repository state. Run "git status" for details.'
  );
}

/**
 * Translate PTY errors into user-friendly error responses
 * Story 4.5 AC4.15: PTY error handling
 *
 * @param ptyError Error from PTY operation
 * @param sessionId Session ID for context
 * @returns ErrorResponse with user-friendly message
 */
export function translatePtyError(ptyError: Error, sessionId?: string): ErrorResponse {
  const message = ptyError.message.toLowerCase();

  // PTY spawn failed
  if (message.includes('spawn') || message.includes('enoent')) {
    return createErrorResponse(
      'pty',
      'Failed to start terminal process',
      ptyError.message,
      'The Claude CLI executable may not be installed or not in PATH.',
      'PTY_SPAWN_FAILED'
    );
  }

  // PTY already terminated
  if (message.includes('terminated') || message.includes('closed') || message.includes('has been')) {
    const suggestion = sessionId
      ? 'Resume the session or create a new one.'
      : 'Resume the session or create a new one.';
    return createErrorResponse(
      'pty',
      'Terminal process has terminated',
      ptyError.message,
      suggestion,
      'PTY_TERMINATED'
    );
  }

  // Generic PTY error
  return createErrorResponse(
    'pty',
    'Terminal process error',
    ptyError.message,
    'Try restarting the session or check server logs for details.'
  );
}

/**
 * Create a validation error response
 * Story 4.5 AC4.15: Validation error formatting
 *
 * @param field Field that failed validation
 * @param message Validation error message
 * @param example Example of valid input (optional)
 * @returns ErrorResponse for validation failure
 */
export function createValidationError(
  field: string,
  message: string,
  example?: string
): ErrorResponse {
  const suggestion = example ? `Example: ${example}` : 'Please check the input and try again.';

  return createErrorResponse(
    'validation',
    `Invalid ${field}`,
    message,
    suggestion,
    'VALIDATION_ERROR'
  );
}

/**
 * Create a resource exhaustion error response
 * Story 4.5 AC4.15: Resource error formatting
 *
 * @param resourceType Type of resource (memory, sessions, disk)
 * @param current Current usage
 * @param limit Maximum allowed
 * @returns ErrorResponse for resource exhaustion
 */
export function createResourceError(
  resourceType: string,
  current: string | number,
  limit: string | number
): ErrorResponse {
  return createErrorResponse(
    'resource',
    `Maximum ${resourceType} capacity reached`,
    `${resourceType} usage is at ${current} (limit: ${limit}).`,
    'Close idle sessions or wait for resources to be freed.',
    'RESOURCE_EXHAUSTED'
  );
}
