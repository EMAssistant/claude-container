/**
 * GitManager Unit Tests
 * Story 5.1: Git Status API Endpoints
 *
 * Tests git status parsing and error handling.
 */

import {
  GitManager,
  GitNotInitializedError,
  GitCommandError,
  NothingToCommitError,
  GitAuthError,
  GitMergeConflictError,
  GitRemoteError,
  ValidationError
} from '../gitManager';
import simpleGit from 'simple-git';

// Mock simple-git
jest.mock('simple-git');

describe('GitManager', () => {
  let gitManager: GitManager;
  const mockWorktreePath = '/workspace/.worktrees/test-session-id';
  let mockGit: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock git instance
    mockGit = {
      raw: jest.fn(),
      add: jest.fn(),
      reset: jest.fn(),
      commit: jest.fn(),
      push: jest.fn(),
      pull: jest.fn()
    };

    // Mock simpleGit to return our mock instance
    (simpleGit as jest.Mock).mockReturnValue(mockGit);

    // Create GitManager instance
    gitManager = new GitManager(mockWorktreePath);
  });

  describe('getStatus', () => {
    it('should parse clean worktree correctly', async () => {
      // Mock git status output for clean worktree
      const gitOutput = '## feature-auth...origin/feature-auth\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(simpleGit).toHaveBeenCalledWith(mockWorktreePath);
      expect(mockGit.raw).toHaveBeenCalledWith(['status', '--porcelain', '-b']);
      expect(status).toEqual({
        branch: 'feature-auth',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: []
      });
    });

    it('should parse staged file correctly', async () => {
      const gitOutput = '## feature-auth\nM  src/auth/login.ts\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.branch).toBe('feature-auth');
      expect(status.staged).toHaveLength(1);
      expect(status.staged[0]).toEqual({
        path: 'src/auth/login.ts',
        status: 'M ',
        oldPath: undefined
      });
      expect(status.modified).toHaveLength(0);
      expect(status.untracked).toHaveLength(0);
    });

    it('should parse modified file correctly', async () => {
      const gitOutput = '## feature-auth\n M src/components/Header.tsx\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.modified).toHaveLength(1);
      expect(status.modified[0]).toEqual({
        path: 'src/components/Header.tsx',
        status: ' M',
        oldPath: undefined
      });
      expect(status.staged).toHaveLength(0);
      expect(status.untracked).toHaveLength(0);
    });

    it('should parse untracked file correctly', async () => {
      const gitOutput = '## feature-auth\n?? src/utils/helpers.ts\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.untracked).toHaveLength(1);
      expect(status.untracked[0]).toEqual({
        path: 'src/utils/helpers.ts',
        status: '??'
      });
      expect(status.staged).toHaveLength(0);
      expect(status.modified).toHaveLength(0);
    });

    it('should parse renamed file correctly', async () => {
      const gitOutput = '## feature-auth\nR  old-file.ts -> new-file.ts\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.staged).toHaveLength(1);
      expect(status.staged[0]).toEqual({
        path: 'new-file.ts',
        status: 'R ',
        oldPath: 'old-file.ts'
      });
    });

    it('should parse staged and modified file correctly (MM status)', async () => {
      const gitOutput = '## feature-auth\nMM src/auth/login.ts\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      // File appears in both staged and modified arrays
      expect(status.staged).toHaveLength(1);
      expect(status.staged[0]).toEqual({
        path: 'src/auth/login.ts',
        status: 'MM',
        oldPath: undefined
      });
      expect(status.modified).toHaveLength(1);
      expect(status.modified[0]).toEqual({
        path: 'src/auth/login.ts',
        status: 'MM',
        oldPath: undefined
      });
    });

    it('should parse ahead/behind counts correctly', async () => {
      const gitOutput = '## feature-auth...origin/feature-auth [ahead 2, behind 1]\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.branch).toBe('feature-auth');
      expect(status.ahead).toBe(2);
      expect(status.behind).toBe(1);
    });

    it('should parse multiple files correctly', async () => {
      const gitOutput = `## feature-auth
M  src/auth/login.ts
 M src/components/Header.tsx
?? src/utils/helpers.ts
A  src/new-file.ts
D  src/old-file.ts
`;
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.staged).toHaveLength(3); // M, A, D
      expect(status.modified).toHaveLength(1); // M
      expect(status.untracked).toHaveLength(1); // ??
    });

    it('should throw GitNotInitializedError when not a git repository', async () => {
      const error = new Error('fatal: not a git repository (or any of the parent directories): .git');
      mockGit.raw.mockRejectedValue(error);

      await expect(gitManager.getStatus()).rejects.toThrow(GitNotInitializedError);
      await expect(gitManager.getStatus()).rejects.toThrow('Not a git repository');
    });

    it('should throw GitCommandError for other git errors', async () => {
      const error: any = new Error('fatal: ambiguous argument');
      error.stderr = 'stderr output';
      mockGit.raw.mockRejectedValue(error);

      await expect(gitManager.getStatus()).rejects.toThrow(GitCommandError);
    });

    it('should handle empty repository', async () => {
      const gitOutput = '';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status).toEqual({
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: []
      });
    });

    it('should handle detached HEAD state', async () => {
      const gitOutput = '## HEAD (no branch)\nM  src/file.ts\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.branch).toBe('HEAD');
      expect(status.staged).toHaveLength(1);
    });

    it('should handle branch with no remote tracking', async () => {
      const gitOutput = '## main\nM  src/file.ts\n';
      mockGit.raw.mockResolvedValue(gitOutput);

      const status = await gitManager.getStatus();

      expect(status.branch).toBe('main');
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
    });
  });

  describe('stageFiles', () => {
    it('should stage single file successfully', async () => {
      mockGit.add.mockResolvedValue(undefined);

      const result = await gitManager.stageFiles(['file.ts']);

      expect(mockGit.add).toHaveBeenCalledWith(['file.ts']);
      expect(result).toEqual(['file.ts']);
    });

    it('should stage multiple files successfully', async () => {
      mockGit.add.mockResolvedValue(undefined);

      const files = ['file1.ts', 'file2.ts', 'file3.ts'];
      const result = await gitManager.stageFiles(files);

      expect(mockGit.add).toHaveBeenCalledWith(files);
      expect(result).toEqual(files);
    });

    it('should stage files with glob pattern', async () => {
      mockGit.add.mockResolvedValue(undefined);

      const result = await gitManager.stageFiles(['*.ts']);

      expect(mockGit.add).toHaveBeenCalledWith(['*.ts']);
      expect(result).toEqual(['*.ts']);
    });

    it('should throw ValidationError when files array is empty', async () => {
      await expect(gitManager.stageFiles([])).rejects.toThrow(ValidationError);
      await expect(gitManager.stageFiles([])).rejects.toThrow('Files array required');
    });

    it('should throw GitCommandError when git add fails', async () => {
      const error: any = new Error('pathspec did not match any files');
      error.stderr = 'pathspec did not match any files';
      mockGit.add.mockRejectedValue(error);

      await expect(gitManager.stageFiles(['nonexistent.ts'])).rejects.toThrow(GitCommandError);
    });
  });

  describe('unstageFiles', () => {
    it('should unstage single file successfully', async () => {
      mockGit.reset.mockResolvedValue(undefined);

      const result = await gitManager.unstageFiles(['file.ts']);

      expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', '--', 'file.ts']);
      expect(result).toEqual(['file.ts']);
    });

    it('should unstage multiple files successfully', async () => {
      mockGit.reset.mockResolvedValue(undefined);

      const files = ['file1.ts', 'file2.ts'];
      const result = await gitManager.unstageFiles(files);

      expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', '--', 'file1.ts', 'file2.ts']);
      expect(result).toEqual(files);
    });

    it('should throw ValidationError when files array is empty', async () => {
      await expect(gitManager.unstageFiles([])).rejects.toThrow(ValidationError);
      await expect(gitManager.unstageFiles([])).rejects.toThrow('Files array required');
    });

    it('should throw GitCommandError when git reset fails', async () => {
      const error: any = new Error('git reset failed');
      error.stderr = 'error details';
      mockGit.reset.mockRejectedValue(error);

      await expect(gitManager.unstageFiles(['file.ts'])).rejects.toThrow(GitCommandError);
    });

    it('should be idempotent (unstage when nothing staged)', async () => {
      mockGit.reset.mockResolvedValue(undefined);

      const result = await gitManager.unstageFiles(['file.ts']);

      expect(mockGit.reset).toHaveBeenCalled();
      expect(result).toEqual(['file.ts']);
    });
  });

  describe('commit', () => {
    beforeEach(() => {
      // Mock getStatus to return staged files
      mockGit.raw.mockResolvedValue('## feature-auth\nM  src/file.ts\n');
    });

    it('should commit with simple message', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc1234' });

      const result = await gitManager.commit('Add feature');

      expect(mockGit.commit).toHaveBeenCalledWith('Add feature');
      expect(result).toEqual({
        commitHash: 'abc1234',
        message: 'Add feature'
      });
    });

    it('should escape double quotes in commit message', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc1234' });

      const result = await gitManager.commit('Add "quotes" test');

      expect(mockGit.commit).toHaveBeenCalledWith('Add \\"quotes\\" test');
      expect(result.message).toBe('Add \\"quotes\\" test');
    });

    it('should truncate first line to 72 chars', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc1234' });

      const longMessage = 'A'.repeat(80);
      const result = await gitManager.commit(longMessage);

      expect(result.message).toHaveLength(72);
      expect(result.message).toBe('A'.repeat(69) + '...');
    });

    it('should preserve multi-line messages', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc1234' });

      const multiLineMessage = 'First line\nSecond line\nThird line';
      const result = await gitManager.commit(multiLineMessage);

      expect(mockGit.commit).toHaveBeenCalledWith(multiLineMessage);
      expect(result.message).toBe(multiLineMessage);
    });

    it('should truncate only first line in multi-line message', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc1234' });

      const multiLineMessage = 'A'.repeat(80) + '\nSecond line stays intact';
      const result = await gitManager.commit(multiLineMessage);

      const lines = result.message.split('\n');
      expect(lines[0]).toHaveLength(72);
      expect(lines[1]).toBe('Second line stays intact');
    });

    it('should throw ValidationError for empty message', async () => {
      await expect(gitManager.commit('')).rejects.toThrow(ValidationError);
      await expect(gitManager.commit('')).rejects.toThrow('Commit message required');
    });

    it('should throw ValidationError for whitespace-only message', async () => {
      await expect(gitManager.commit('   ')).rejects.toThrow(ValidationError);
      await expect(gitManager.commit('   ')).rejects.toThrow('Commit message required');
    });

    it('should throw NothingToCommitError when no files staged', async () => {
      // Mock getStatus to return no staged files
      mockGit.raw.mockResolvedValue('## feature-auth\n M src/file.ts\n');

      await expect(gitManager.commit('Test')).rejects.toThrow(NothingToCommitError);
      await expect(gitManager.commit('Test')).rejects.toThrow('Nothing to commit');
    });

    it('should throw GitCommandError when git commit fails', async () => {
      const error: any = new Error('commit failed');
      error.stderr = 'error details';
      mockGit.commit.mockRejectedValue(error);

      await expect(gitManager.commit('Test')).rejects.toThrow(GitCommandError);
    });
  });

  describe('push', () => {
    it('should push to remote successfully', async () => {
      // Mock: getStatus -> calculateAheadBehind (verify origin/main) -> push
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n') // getStatus
        .mockResolvedValueOnce('abc123') // rev-parse --verify origin/main
        .mockResolvedValueOnce('0') // rev-list ahead count
        .mockResolvedValueOnce('0') // rev-list behind count
        .mockResolvedValueOnce(undefined); // push --set-upstream

      await gitManager.push();

      expect(mockGit.raw).toHaveBeenLastCalledWith(['push', '--set-upstream', 'origin', 'feature-auth']);
    });

    it('should throw GitRemoteError when no branch found', async () => {
      // Mock getStatus to return empty branch
      mockGit.raw.mockResolvedValueOnce('');

      await expect(gitManager.push()).rejects.toThrow(GitRemoteError);

      mockGit.raw.mockResolvedValueOnce('');
      await expect(gitManager.push()).rejects.toThrow('No branch found');
    });

    it('should throw GitAuthError on permission denied', async () => {
      const error: any = new Error('push failed');
      error.stderr = 'Permission denied (publickey)';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n') // getStatus
        .mockResolvedValueOnce('abc123') // rev-parse --verify origin/main
        .mockResolvedValueOnce('1') // rev-list ahead count
        .mockResolvedValueOnce('0') // rev-list behind count
        .mockRejectedValueOnce(error); // push fails

      await expect(gitManager.push()).rejects.toThrow(GitAuthError);

      // Reset for second assertion
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(error);
      await expect(gitManager.push()).rejects.toThrow('Git authentication failed');
    });

    it('should throw GitAuthError on authentication failed', async () => {
      const error: any = new Error('push failed');
      error.stderr = 'authentication failed';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(error);

      await expect(gitManager.push()).rejects.toThrow(GitAuthError);
    });

    it('should throw GitRemoteError when remote not configured', async () => {
      const error: any = new Error('push failed');
      error.stderr = 'No configured push destination';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(error);

      await expect(gitManager.push()).rejects.toThrow(GitRemoteError);
    });

    it('should throw GitCommandError for other push errors', async () => {
      const error: any = new Error('push failed');
      error.stderr = 'unknown error';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(error);

      await expect(gitManager.push()).rejects.toThrow(GitCommandError);
    });
  });

  describe('pull', () => {
    it('should pull from remote successfully', async () => {
      // Mock: getStatus -> calculateAheadBehind -> check remote branch -> pull
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n') // getStatus
        .mockResolvedValueOnce('abc123') // rev-parse --verify origin/main (for calculateAheadBehind)
        .mockResolvedValueOnce('0') // rev-list ahead
        .mockResolvedValueOnce('0') // rev-list behind
        .mockResolvedValueOnce('def456'); // rev-parse --verify origin/feature-auth (remote check)
      mockGit.pull.mockResolvedValue({
        summary: { changes: 3 }
      });

      const result = await gitManager.pull();

      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'feature-auth');
      expect(result).toEqual({ commits: 3 });
    });

    it('should return 0 commits when already up to date', async () => {
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockResolvedValue({
        summary: { changes: 0 }
      });

      const result = await gitManager.pull();

      expect(result).toEqual({ commits: 0 });
    });

    it('should return 0 commits when remote branch does not exist', async () => {
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(new Error('fatal: bad revision')); // remote branch check fails

      const result = await gitManager.pull();

      expect(result).toEqual({ commits: 0 });
      expect(mockGit.pull).not.toHaveBeenCalled();
    });

    it('should handle missing summary in pull result', async () => {
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockResolvedValue({});

      const result = await gitManager.pull();

      expect(result).toEqual({ commits: 0 });
    });

    it('should throw GitRemoteError when no branch found', async () => {
      // Mock getStatus to return empty branch
      mockGit.raw.mockResolvedValueOnce('');

      await expect(gitManager.pull()).rejects.toThrow(GitRemoteError);

      mockGit.raw.mockResolvedValueOnce('');
      await expect(gitManager.pull()).rejects.toThrow('No branch found');
    });

    it('should throw GitAuthError on permission denied', async () => {
      const error: any = new Error('pull failed');
      error.stderr = 'Permission denied (publickey)';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockRejectedValue(error);

      await expect(gitManager.pull()).rejects.toThrow(GitAuthError);

      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      await expect(gitManager.pull()).rejects.toThrow('Git authentication failed');
    });

    it('should throw GitMergeConflictError on conflict', async () => {
      const error: any = new Error('pull failed');
      error.stderr = 'CONFLICT (content): file.ts';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockRejectedValue(error);

      await expect(gitManager.pull()).rejects.toThrow(GitMergeConflictError);

      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      await expect(gitManager.pull()).rejects.toThrow('Merge conflict detected');
    });

    it('should parse conflict file paths', async () => {
      const error: any = new Error('pull failed');
      error.stderr = 'CONFLICT (content): file1.ts\nCONFLICT (add/add): file2.ts';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockRejectedValue(error);

      try {
        await gitManager.pull();
      } catch (err: any) {
        expect(err).toBeInstanceOf(GitMergeConflictError);
        expect(err.conflicts).toEqual(['file1.ts', 'file2.ts']);
      }
    });

    it('should throw GitMergeConflictError on automatic merge failed', async () => {
      const error: any = new Error('pull failed');
      error.stderr = 'Automatic merge failed';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockRejectedValue(error);

      await expect(gitManager.pull()).rejects.toThrow(GitMergeConflictError);
    });

    it('should throw GitRemoteError on no tracking information', async () => {
      const error: any = new Error('pull failed');
      error.stderr = 'no tracking information';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockRejectedValue(error);

      await expect(gitManager.pull()).rejects.toThrow(GitRemoteError);
    });

    it('should throw GitCommandError for other pull errors', async () => {
      const error: any = new Error('pull failed');
      error.stderr = 'unknown error';
      mockGit.raw
        .mockResolvedValueOnce('## feature-auth\n')
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('def456');
      mockGit.pull.mockRejectedValue(error);

      await expect(gitManager.pull()).rejects.toThrow(GitCommandError);
    });
  });
});
