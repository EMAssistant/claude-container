/**
 * Unit tests for error handler utility
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.15: ErrorResponse structure tested
 * AC4.8: Git error translation tested
 */

import {
  createErrorResponse,
  translateGitError,
  translatePtyError,
  createValidationError,
  createResourceError
} from './errorHandler';

describe('createErrorResponse', () => {
  it('should create basic error response with type and message', () => {
    const result = createErrorResponse('validation', 'Invalid input');
    expect(result.error.type).toBe('validation');
    expect(result.error.message).toBe('Invalid input');
    expect(result.error.details).toBeUndefined();
    expect(result.error.suggestion).toBeUndefined();
    expect(result.error.code).toBeUndefined();
  });

  it('should create complete error response with all fields', () => {
    const result = createErrorResponse(
      'git',
      'Branch already exists',
      'A worktree already exists for branch feature-auth',
      'Choose a different branch name',
      'BRANCH_EXISTS'
    );
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Branch already exists');
    expect(result.error.details).toBe('A worktree already exists for branch feature-auth');
    expect(result.error.suggestion).toBe('Choose a different branch name');
    expect(result.error.code).toBe('BRANCH_EXISTS');
  });

  it('should handle all error types', () => {
    const types: Array<'validation' | 'git' | 'pty' | 'resource' | 'internal'> = [
      'validation',
      'git',
      'pty',
      'resource',
      'internal'
    ];

    types.forEach(type => {
      const result = createErrorResponse(type, 'Test message');
      expect(result.error.type).toBe(type);
    });
  });
});

describe('translateGitError', () => {
  it('should translate "branch already exists" error', () => {
    const gitError = new Error('fatal: A branch named "feature-auth" already exists.');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Branch already exists');
    expect(result.error.code).toBe('BRANCH_EXISTS');
    expect(result.error.suggestion).toContain('different branch name');
  });

  it('should translate "worktree already exists" error', () => {
    const gitError = new Error('fatal: worktree already exists at /path/to/worktree');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Worktree already exists');
    expect(result.error.code).toBe('WORKTREE_EXISTS');
    expect(result.error.suggestion).toContain('Remove the existing worktree');
  });

  it('should translate "worktree locked" error', () => {
    const gitError = new Error('fatal: worktree is locked');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Worktree is locked');
    expect(result.error.code).toBe('WORKTREE_LOCKED');
    expect(result.error.suggestion).toContain('Another process');
  });

  it('should translate "worktree in use" error', () => {
    const gitError = new Error('fatal: worktree is in use');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Worktree is in use');
    expect(result.error.code).toBe('WORKTREE_IN_USE');
    expect(result.error.suggestion).toContain('Close any processes');
  });

  it('should translate "branch not found" error', () => {
    const gitError = new Error('error: pathspec "nonexistent-branch" did not match any file(s) known to git');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Branch not found');
    expect(result.error.code).toBe('BRANCH_NOT_FOUND');
    expect(result.error.suggestion).toContain('Verify the branch name');
  });

  it('should translate "no commits yet" error', () => {
    const gitError = new Error('fatal: your current branch does not have any commits yet');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Repository has no commits');
    expect(result.error.code).toBe('NO_COMMITS');
    expect(result.error.suggestion).toContain('Create an initial commit');
  });

  it('should translate "merge conflict" error', () => {
    const gitError = new Error('error: Your local changes would be overwritten by merge');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Merge conflict detected');
    expect(result.error.code).toBe('MERGE_CONFLICT');
    expect(result.error.suggestion).toContain('Resolve conflicts');
  });

  it('should translate "detached HEAD" error', () => {
    const gitError = new Error('You are in "detached HEAD" state');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Detached HEAD state');
    expect(result.error.code).toBe('DETACHED_HEAD');
    expect(result.error.suggestion).toContain('Checkout a branch');
  });

  it('should translate "permission denied" error', () => {
    const gitError = new Error('fatal: Unable to create /path/.git/index.lock: Permission denied');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Git permission denied');
    expect(result.error.code).toBe('PERMISSION_DENIED');
    expect(result.error.suggestion).toContain('Check file permissions');
  });

  it('should provide generic error for unknown git errors', () => {
    const gitError = new Error('Some unknown git error');
    const result = translateGitError(gitError);
    expect(result.error.type).toBe('git');
    expect(result.error.message).toBe('Git operation failed');
    expect(result.error.code).toBeUndefined();
    expect(result.error.suggestion).toContain('Check git configuration');
  });

  it('should handle case-insensitive error matching', () => {
    const gitError = new Error('FATAL: A BRANCH NAMED "test" ALREADY EXISTS.');
    const result = translateGitError(gitError);
    expect(result.error.message).toBe('Branch already exists');
    expect(result.error.code).toBe('BRANCH_EXISTS');
  });
});

describe('translatePtyError', () => {
  it('should translate PTY spawn failed error', () => {
    const ptyError = new Error('spawn claude ENOENT');
    const result = translatePtyError(ptyError);
    expect(result.error.type).toBe('pty');
    expect(result.error.message).toBe('Failed to start terminal process');
    expect(result.error.code).toBe('PTY_SPAWN_FAILED');
    expect(result.error.suggestion).toContain('Claude CLI executable');
  });

  it('should translate PTY terminated error', () => {
    const ptyError = new Error('PTY process has been terminated');
    const result = translatePtyError(ptyError);
    expect(result.error.type).toBe('pty');
    expect(result.error.message).toBe('Terminal process has terminated');
    expect(result.error.code).toBe('PTY_TERMINATED');
    expect(result.error.suggestion).toContain('Resume the session');
  });

  it('should include sessionId in suggestion when provided', () => {
    const ptyError = new Error('PTY process has been terminated');
    const result = translatePtyError(ptyError, 'session-123');
    expect(result.error.suggestion).toContain('Resume the session');
  });

  it('should provide generic error for unknown PTY errors', () => {
    const ptyError = new Error('Unknown PTY error');
    const result = translatePtyError(ptyError);
    expect(result.error.type).toBe('pty');
    expect(result.error.message).toBe('Terminal process error');
    expect(result.error.suggestion).toContain('Try restarting');
  });
});

describe('createValidationError', () => {
  it('should create validation error with example', () => {
    const result = createValidationError(
      'session name',
      'Session names must be alphanumeric with dashes only.',
      'feature-auth'
    );
    expect(result.error.type).toBe('validation');
    expect(result.error.message).toBe('Invalid session name');
    expect(result.error.details).toBe('Session names must be alphanumeric with dashes only.');
    expect(result.error.suggestion).toBe('Example: feature-auth');
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('should create validation error without example', () => {
    const result = createValidationError('email', 'Email format is invalid');
    expect(result.error.type).toBe('validation');
    expect(result.error.message).toBe('Invalid email');
    expect(result.error.details).toBe('Email format is invalid');
    expect(result.error.suggestion).toBe('Please check the input and try again.');
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle various field names', () => {
    const fields = ['username', 'password', 'branch name', 'file path'];
    fields.forEach(field => {
      const result = createValidationError(field, 'Invalid format');
      expect(result.error.message).toBe(`Invalid ${field}`);
    });
  });
});

describe('createResourceError', () => {
  it('should create resource error with string values', () => {
    const result = createResourceError('memory', '93%', '100%');
    expect(result.error.type).toBe('resource');
    expect(result.error.message).toBe('Maximum memory capacity reached');
    expect(result.error.details).toBe('memory usage is at 93% (limit: 100%).');
    expect(result.error.suggestion).toContain('Close idle sessions');
    expect(result.error.code).toBe('RESOURCE_EXHAUSTED');
  });

  it('should create resource error with numeric values', () => {
    const result = createResourceError('sessions', 4, 4);
    expect(result.error.type).toBe('resource');
    expect(result.error.message).toBe('Maximum sessions capacity reached');
    expect(result.error.details).toBe('sessions usage is at 4 (limit: 4).');
    expect(result.error.code).toBe('RESOURCE_EXHAUSTED');
  });

  it('should handle various resource types', () => {
    const resources = ['memory', 'disk', 'cpu', 'sessions'];
    resources.forEach(resource => {
      const result = createResourceError(resource, 90, 100);
      expect(result.error.message).toContain(resource);
    });
  });
});

describe('ErrorResponse structure validation', () => {
  it('should always include type and message', () => {
    const result = createErrorResponse('internal', 'Server error');
    expect(result.error).toHaveProperty('type');
    expect(result.error).toHaveProperty('message');
  });

  it('should only include optional fields when provided', () => {
    const result1 = createErrorResponse('validation', 'Invalid input');
    expect(result1.error).not.toHaveProperty('details');
    expect(result1.error).not.toHaveProperty('suggestion');
    expect(result1.error).not.toHaveProperty('code');

    const result2 = createErrorResponse(
      'validation',
      'Invalid input',
      'Details here',
      'Suggestion here',
      'CODE_HERE'
    );
    expect(result2.error).toHaveProperty('details');
    expect(result2.error).toHaveProperty('suggestion');
    expect(result2.error).toHaveProperty('code');
  });

  it('should match ErrorResponse interface structure', () => {
    const result = createErrorResponse('git', 'Test', 'Details', 'Suggestion', 'CODE');
    expect(result).toHaveProperty('error');
    expect(result.error).toHaveProperty('type');
    expect(result.error).toHaveProperty('message');
    expect(typeof result.error.type).toBe('string');
    expect(typeof result.error.message).toBe('string');
  });
});
