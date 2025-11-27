/**
 * Tests for git utility functions
 */

import { extractRepoName } from './gitUtils';

describe('extractRepoName', () => {
  describe('HTTPS URLs', () => {
    it('should extract repo name from HTTPS URL with .git suffix', () => {
      expect(extractRepoName('https://github.com/owner/my-repo.git')).toBe('my-repo');
    });

    it('should extract repo name from HTTPS URL without .git suffix', () => {
      expect(extractRepoName('https://github.com/owner/my-repo')).toBe('my-repo');
    });

    it('should extract repo name from GitLab HTTPS URL', () => {
      expect(extractRepoName('https://gitlab.com/owner/project-name.git')).toBe('project-name');
    });

    it('should extract repo name from Bitbucket HTTPS URL', () => {
      expect(extractRepoName('https://bitbucket.org/owner/repo-name.git')).toBe('repo-name');
    });

    it('should extract repo name from HTTPS URL with nested groups', () => {
      expect(extractRepoName('https://gitlab.com/group/subgroup/repo.git')).toBe('repo');
    });

    it('should return null for HTTPS URL with trailing slash', () => {
      // Edge case - URLs shouldn't have trailing slashes, returns null
      expect(extractRepoName('https://github.com/owner/repo/')).toBeNull();
    });
  });

  describe('SSH URLs', () => {
    it('should extract repo name from SSH URL with .git suffix', () => {
      expect(extractRepoName('git@github.com:owner/my-repo.git')).toBe('my-repo');
    });

    it('should extract repo name from SSH URL without .git suffix', () => {
      expect(extractRepoName('git@github.com:owner/my-repo')).toBe('my-repo');
    });

    it('should extract repo name from GitLab SSH URL', () => {
      expect(extractRepoName('git@gitlab.com:owner/project-name.git')).toBe('project-name');
    });

    it('should extract repo name from Bitbucket SSH URL', () => {
      expect(extractRepoName('git@bitbucket.org:owner/repo-name.git')).toBe('repo-name');
    });

    it('should extract repo name from SSH URL with port', () => {
      expect(extractRepoName('ssh://git@github.com:22/owner/repo.git')).toBe('repo');
    });
  });

  describe('Edge cases', () => {
    it('should return null for empty string', () => {
      expect(extractRepoName('')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(extractRepoName(null as unknown as string)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractRepoName(undefined as unknown as string)).toBeNull();
    });

    it('should handle URL with whitespace', () => {
      expect(extractRepoName('  https://github.com/owner/repo.git  ')).toBe('repo');
    });

    it('should handle repo names with special characters', () => {
      expect(extractRepoName('https://github.com/owner/my_repo-name.123.git')).toBe('my_repo-name.123');
    });

    it('should return null for malformed URL', () => {
      expect(extractRepoName('not-a-valid-url')).toBeNull();
    });

    it('should extract domain for URL without path (edge case)', () => {
      // Edge case - not a valid git URL, but regex extracts last path segment
      expect(extractRepoName('https://github.com')).toBe('github.com');
    });
  });

  describe('Real-world examples', () => {
    it('should handle claude-container HTTPS URL', () => {
      expect(extractRepoName('https://github.com/anthropics/claude-container.git')).toBe('claude-container');
    });

    it('should handle claude-container SSH URL', () => {
      expect(extractRepoName('git@github.com:anthropics/claude-container.git')).toBe('claude-container');
    });
  });
});
