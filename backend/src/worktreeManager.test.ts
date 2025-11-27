import { WorktreeManager } from './worktreeManager';
import simpleGit, { SimpleGit, GitError } from 'simple-git';

// Mock simple-git module
jest.mock('simple-git');

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn()
}));

const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;
const fs = require('fs/promises');

describe('WorktreeManager', () => {
  let worktreeManager: WorktreeManager;
  let mockGit: jest.Mocked<SimpleGit>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock git instance
    mockGit = {
      raw: jest.fn()
    } as unknown as jest.Mocked<SimpleGit>;

    // Mock simpleGit to return our mock instance
    mockSimpleGit.mockReturnValue(mockGit);

    // Create WorktreeManager instance
    worktreeManager = new WorktreeManager({
      workspaceRoot: '/workspace'
    });
  });

  describe('constructor', () => {
    it('should initialize with workspace root (git lazy initialized)', async () => {
      // Git is now lazy-initialized on first use, not in constructor
      // This supports test environments where /workspace may not exist
      expect(mockSimpleGit).not.toHaveBeenCalled();

      // Trigger lazy initialization by calling a method
      mockGit.raw.mockResolvedValue('');
      fs.access.mockResolvedValue(undefined);
      await worktreeManager.createWorktree('test-session', 'feature/test');

      // Now simpleGit should have been called
      expect(mockSimpleGit).toHaveBeenCalledWith('/workspace');
    });
  });

  describe('createWorktree', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const branchName = 'feature/feature-auth';
    const expectedPath = '/workspace/.worktrees/550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      // Mock fs.access to simulate worktree exists after creation
      fs.access.mockResolvedValue(undefined);
    });

    it('should create worktree with valid session ID and branch name', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.createWorktree(sessionId, branchName);

      expect(fs.mkdir).toHaveBeenCalledWith('/workspace/.worktrees', { recursive: true });
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        expectedPath
      ]);
      expect(result).toBe(expectedPath);
    });

    it('should throw error when branch already exists', async () => {
      const gitError = new Error("fatal: A branch named 'feature/feature-auth' already exists.") as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.createWorktree(sessionId, branchName)
      ).rejects.toThrow(`Branch '${branchName}' already exists`);
    });

    it('should throw error on permission denied', async () => {
      const gitError = new Error('permission denied') as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.createWorktree(sessionId, branchName)
      ).rejects.toThrow('Permission denied creating worktree');
    });

    it('should throw error on insufficient disk space', async () => {
      const gitError = new Error('ENOSPC: no space left on device') as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.createWorktree(sessionId, branchName)
      ).rejects.toThrow('Insufficient disk space');
    });

    it('should throw error if worktree directory not created', async () => {
      mockGit.raw.mockResolvedValue('');
      fs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(
        worktreeManager.createWorktree(sessionId, branchName)
      ).rejects.toThrow('Worktree directory not created');
    });
  });

  describe('removeWorktree', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const expectedPath = '/workspace/.worktrees/550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      // Mock fs.access to simulate worktree doesn't exist after removal
      fs.access.mockRejectedValue(new Error('ENOENT'));
    });

    it('should remove worktree successfully with force flag', async () => {
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.removeWorktree(sessionId, true);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '--force',
        expectedPath
      ]);
    });

    it('should remove worktree without force flag when specified', async () => {
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.removeWorktree(sessionId, false);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        expectedPath
      ]);
    });

    it('should default to force=true when not specified', async () => {
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.removeWorktree(sessionId);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '--force',
        expectedPath
      ]);
    });

    it('should throw error when worktree does not exist', async () => {
      const gitError = new Error('not a working tree') as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.removeWorktree(sessionId)
      ).rejects.toThrow('not a working tree');
    });

    it('should throw error when worktree has uncommitted changes without force', async () => {
      const gitError = new Error('uncommitted changes') as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.removeWorktree(sessionId, false)
      ).rejects.toThrow('uncommitted changes');
    });

    it('should throw error when worktree is locked', async () => {
      const gitError = new Error('locked by another git operation') as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.removeWorktree(sessionId)
      ).rejects.toThrow('locked by another git operation');
    });
  });

  describe('listWorktrees', () => {
    it('should list and parse worktrees correctly', async () => {
      const porcelainOutput = `worktree /workspace
HEAD abc123
branch refs/heads/main

worktree /workspace/.worktrees/session-1
HEAD def456
branch refs/heads/feature/auth

worktree /workspace/.worktrees/session-2
HEAD ghi789
branch refs/heads/feature/ui
`;

      mockGit.raw.mockResolvedValue(porcelainOutput);

      const result = await worktreeManager.listWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: '/workspace/.worktrees/session-1',
        branch: 'feature/auth'
      });
      expect(result[1]).toEqual({
        path: '/workspace/.worktrees/session-2',
        branch: 'feature/ui'
      });
    });

    it('should filter out main worktree (not in .worktrees directory)', async () => {
      const porcelainOutput = `worktree /workspace
HEAD abc123
branch refs/heads/main

worktree /other/path
HEAD def456
branch refs/heads/other-branch
`;

      mockGit.raw.mockResolvedValue(porcelainOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no worktrees exist', async () => {
      const porcelainOutput = `worktree /workspace
HEAD abc123
branch refs/heads/main
`;

      mockGit.raw.mockResolvedValue(porcelainOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toHaveLength(0);
    });

    it('should throw error when git command fails', async () => {
      const gitError = new Error('git command failed') as GitError;
      mockGit.raw.mockRejectedValue(gitError);

      await expect(
        worktreeManager.listWorktrees()
      ).rejects.toThrow('Failed to list worktrees');
    });
  });

  describe('validateBranchName', () => {
    it('should validate correct branch names', () => {
      expect(worktreeManager.validateBranchName('feature/auth')).toBe(true);
      expect(worktreeManager.validateBranchName('feature/my-feature')).toBe(true);
      expect(worktreeManager.validateBranchName('bugfix/issue-123')).toBe(true);
      expect(worktreeManager.validateBranchName('release/v1.0')).toBe(true);
      expect(worktreeManager.validateBranchName('feature_auth')).toBe(true);
      expect(worktreeManager.validateBranchName('feature/2025-11-24-001')).toBe(true);
    });

    it('should reject empty branch names', () => {
      expect(worktreeManager.validateBranchName('')).toBe(false);
    });

    it('should reject branch names longer than 255 characters', () => {
      const longName = 'a'.repeat(256);
      expect(worktreeManager.validateBranchName(longName)).toBe(false);
    });

    it('should reject branch names starting with slash', () => {
      expect(worktreeManager.validateBranchName('/invalid')).toBe(false);
    });

    it('should reject branch names starting with dot', () => {
      expect(worktreeManager.validateBranchName('.invalid')).toBe(false);
    });

    it('should reject branch names with spaces', () => {
      expect(worktreeManager.validateBranchName('has spaces')).toBe(false);
    });

    it('should reject branch names with special characters', () => {
      expect(worktreeManager.validateBranchName('feature@auth')).toBe(false);
      expect(worktreeManager.validateBranchName('feature#auth')).toBe(false);
      expect(worktreeManager.validateBranchName('feature!auth')).toBe(false);
      expect(worktreeManager.validateBranchName('feature*auth')).toBe(false);
    });
  });

  describe('generateBranchName', () => {
    it('should generate branch name from user-provided session name', () => {
      expect(worktreeManager.generateBranchName('feature-auth')).toBe('feature/feature-auth');
      expect(worktreeManager.generateBranchName('my-feature')).toBe('feature/my-feature');
    });

    it('should generate branch name from auto-generated session name', () => {
      expect(worktreeManager.generateBranchName('2025-11-24-001')).toBe('feature/2025-11-24-001');
      expect(worktreeManager.generateBranchName('2025-11-24-002')).toBe('feature/2025-11-24-002');
    });

    it('should replace spaces with dashes', () => {
      expect(worktreeManager.generateBranchName('my feature')).toBe('feature/my-feature');
      expect(worktreeManager.generateBranchName('feature  auth')).toBe('feature/feature-auth');
    });

    it('should remove special characters', () => {
      expect(worktreeManager.generateBranchName('feature@auth')).toBe('feature/featureauth');
      expect(worktreeManager.generateBranchName('my#feature!')).toBe('feature/myfeature');
    });

    it('should handle mixed alphanumeric with allowed characters', () => {
      expect(worktreeManager.generateBranchName('feature_auth_123')).toBe('feature/feature_auth_123');
    });
  });
});
