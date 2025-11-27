import { WorktreeManager } from './worktreeManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { realpathSync } from 'fs';

/**
 * Integration tests for WorktreeManager with real git repository
 *
 * These tests use actual git commands and filesystem operations
 * to verify worktree functionality in a real environment.
 */
describe('WorktreeManager Integration Tests', () => {
  let testRepoPath: string;
  let worktreeManager: WorktreeManager;

  beforeAll(async () => {
    // Create temporary directory for test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'worktree-test-'));

    // Initialize git repository
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });

    // Create initial commit (required for worktrees)
    const readmePath = path.join(testRepoPath, 'README.md');
    await fs.writeFile(readmePath, '# Test Repository\n');
    execSync('git add README.md', { cwd: testRepoPath });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath });

    // Create WorktreeManager instance
    worktreeManager = new WorktreeManager({
      workspaceRoot: testRepoPath
    });
  });

  afterAll(async () => {
    // Cleanup: Remove all worktrees first
    try {
      const worktrees = await worktreeManager.listWorktrees();
      for (const worktree of worktrees) {
        try {
          const sessionId = path.basename(worktree.path);
          await worktreeManager.removeWorktree(sessionId, true);
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }

    // Remove test repository directory
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test repository:', error);
    }
  });

  describe('Full Workflow: Create -> List -> Remove', () => {
    it('should create worktree, list it, and remove it successfully', async () => {
      const sessionId = 'integration-test-session-1';
      const branchName = 'feature/integration-test';

      // Create worktree
      const worktreePath = await worktreeManager.createWorktree(sessionId, branchName);

      // Verify path is correct (handle symlinks - e.g., /var vs /private/var on macOS)
      const expectedPath = path.join(realpathSync(testRepoPath), '.worktrees', sessionId);
      expect(worktreePath).toBe(expectedPath);

      // Verify worktree directory exists
      const stats = await fs.stat(worktreePath);
      expect(stats.isDirectory()).toBe(true);

      // Verify README.md exists in worktree
      const readmePath = path.join(worktreePath, 'README.md');
      const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false);
      expect(readmeExists).toBe(true);

      // List worktrees
      const worktrees = await worktreeManager.listWorktrees();

      expect(worktrees.length).toBeGreaterThan(0);
      expect(worktrees.find(wt => wt.path === worktreePath)).toEqual({
        path: worktreePath,
        branch: branchName
      });

      // Remove worktree
      await worktreeManager.removeWorktree(sessionId, true);

      // Verify worktree directory is deleted
      const existsAfterRemoval = await fs.access(worktreePath).then(() => true).catch(() => false);
      expect(existsAfterRemoval).toBe(false);

      // Verify worktree is not in list anymore
      const worktreesAfterRemoval = await worktreeManager.listWorktrees();
      expect(worktreesAfterRemoval.find(wt => wt.path === worktreePath)).toBeUndefined();

      // Verify branch still exists (FR20: user responsibility to delete)
      const branches = execSync('git branch', { cwd: testRepoPath, encoding: 'utf-8' });
      expect(branches).toContain(branchName);
    });
  });

  describe('Worktree Isolation', () => {
    it('should isolate changes between two worktrees', async () => {
      const sessionId1 = 'isolation-test-session-1';
      const sessionId2 = 'isolation-test-session-2';
      const branchName1 = 'feature/isolation-test-1';
      const branchName2 = 'feature/isolation-test-2';

      try {
        // Create two worktrees
        const worktreePath1 = await worktreeManager.createWorktree(sessionId1, branchName1);
        const worktreePath2 = await worktreeManager.createWorktree(sessionId2, branchName2);

        // Create file in worktree 1
        const file1Path = path.join(worktreePath1, 'file1.txt');
        await fs.writeFile(file1Path, 'Content from worktree 1');

        // Verify file exists in worktree 1
        const file1Exists = await fs.access(file1Path).then(() => true).catch(() => false);
        expect(file1Exists).toBe(true);

        // Verify file does NOT exist in worktree 2
        const file1InWorktree2 = path.join(worktreePath2, 'file1.txt');
        const file1ExistsInWorktree2 = await fs.access(file1InWorktree2).then(() => true).catch(() => false);
        expect(file1ExistsInWorktree2).toBe(false);

        // Create different file in worktree 2
        const file2Path = path.join(worktreePath2, 'file2.txt');
        await fs.writeFile(file2Path, 'Content from worktree 2');

        // Verify file exists in worktree 2
        const file2Exists = await fs.access(file2Path).then(() => true).catch(() => false);
        expect(file2Exists).toBe(true);

        // Verify file does NOT exist in worktree 1
        const file2InWorktree1 = path.join(worktreePath1, 'file2.txt');
        const file2ExistsInWorktree1 = await fs.access(file2InWorktree1).then(() => true).catch(() => false);
        expect(file2ExistsInWorktree1).toBe(false);

        // Cleanup
        await worktreeManager.removeWorktree(sessionId1, true);
        await worktreeManager.removeWorktree(sessionId2, true);
      } catch (error) {
        // Cleanup on error
        try {
          await worktreeManager.removeWorktree(sessionId1, true);
        } catch {}
        try {
          await worktreeManager.removeWorktree(sessionId2, true);
        } catch {}
        throw error;
      }
    });
  });

  describe('Concurrent Worktree Creation', () => {
    it('should handle concurrent worktree creation without race conditions', async () => {
      const sessionId1 = 'concurrent-test-session-1';
      const sessionId2 = 'concurrent-test-session-2';
      const branchName1 = 'feature/concurrent-test-1';
      const branchName2 = 'feature/concurrent-test-2';

      try {
        // Create two worktrees concurrently
        const [worktreePath1, worktreePath2] = await Promise.all([
          worktreeManager.createWorktree(sessionId1, branchName1),
          worktreeManager.createWorktree(sessionId2, branchName2)
        ]);

        // Verify both worktrees were created successfully
        const stats1 = await fs.stat(worktreePath1);
        const stats2 = await fs.stat(worktreePath2);
        expect(stats1.isDirectory()).toBe(true);
        expect(stats2.isDirectory()).toBe(true);

        // Verify both are in worktree list
        const worktrees = await worktreeManager.listWorktrees();
        expect(worktrees.find(wt => wt.path === worktreePath1)).toBeDefined();
        expect(worktrees.find(wt => wt.path === worktreePath2)).toBeDefined();

        // Cleanup
        await Promise.all([
          worktreeManager.removeWorktree(sessionId1, true),
          worktreeManager.removeWorktree(sessionId2, true)
        ]);
      } catch (error) {
        // Cleanup on error
        try {
          await worktreeManager.removeWorktree(sessionId1, true);
        } catch {}
        try {
          await worktreeManager.removeWorktree(sessionId2, true);
        } catch {}
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should fail when trying to create worktree with existing branch', async () => {
      const sessionId1 = 'duplicate-branch-test-1';
      const sessionId2 = 'duplicate-branch-test-2';
      const branchName = 'feature/duplicate-branch-test';

      try {
        // Create first worktree
        await worktreeManager.createWorktree(sessionId1, branchName);

        // Try to create second worktree with same branch (should fail)
        await expect(
          worktreeManager.createWorktree(sessionId2, branchName)
        ).rejects.toThrow(`Branch '${branchName}' already exists`);

        // Cleanup
        await worktreeManager.removeWorktree(sessionId1, true);
      } catch (error) {
        // Cleanup on error
        try {
          await worktreeManager.removeWorktree(sessionId1, true);
        } catch {}
        throw error;
      }
    });

    it('should fail when trying to remove non-existent worktree', async () => {
      const nonExistentSessionId = 'non-existent-session-id';

      await expect(
        worktreeManager.removeWorktree(nonExistentSessionId, true)
      ).rejects.toThrow(`Worktree for session ${nonExistentSessionId} does not exist`);
    });

    it('should handle worktree removal with uncommitted changes when force=true', async () => {
      const sessionId = 'uncommitted-changes-test';
      const branchName = 'feature/uncommitted-test';

      try {
        // Create worktree
        const worktreePath = await worktreeManager.createWorktree(sessionId, branchName);

        // Create uncommitted file
        const uncommittedFilePath = path.join(worktreePath, 'uncommitted.txt');
        await fs.writeFile(uncommittedFilePath, 'Uncommitted content');

        // Remove worktree with force=true (should succeed)
        await expect(
          worktreeManager.removeWorktree(sessionId, true)
        ).resolves.not.toThrow();

        // Verify worktree is removed
        const existsAfterRemoval = await fs.access(worktreePath).then(() => true).catch(() => false);
        expect(existsAfterRemoval).toBe(false);
      } catch (error) {
        // Cleanup on error
        try {
          await worktreeManager.removeWorktree(sessionId, true);
        } catch {}
        throw error;
      }
    });
  });

  describe('Branch Name Validation and Generation', () => {
    it('should accept valid generated branch names', () => {
      const validNames = [
        'feature-auth',
        'my-feature',
        '2025-11-24-001',
        'feature_with_underscore'
      ];

      for (const name of validNames) {
        const branchName = worktreeManager.generateBranchName(name);
        expect(worktreeManager.validateBranchName(branchName)).toBe(true);
      }
    });

    it('should sanitize session names with special characters', () => {
      const sessionName = 'my feature@test!';
      const branchName = worktreeManager.generateBranchName(sessionName);
      expect(worktreeManager.validateBranchName(branchName)).toBe(true);
      expect(branchName).toBe('feature/my-featuretest');
    });
  });
});
