/**
 * Git utility functions
 */

/**
 * Extract repository name from a git remote URL
 * Handles both HTTPS and SSH formats:
 * - HTTPS: https://github.com/owner/repo.git -> repo
 * - HTTPS: https://github.com/owner/repo -> repo
 * - SSH: git@github.com:owner/repo.git -> repo
 * - SSH: git@github.com:owner/repo -> repo
 *
 * @param remoteUrl The git remote URL
 * @returns The repository name, or null if it couldn't be extracted
 */
export function extractRepoName(remoteUrl: string): string | null {
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return null;
  }

  const trimmedUrl = remoteUrl.trim();

  // Try HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = trimmedUrl.match(/\/([^/]+?)(\.git)?$/);
  if (httpsMatch && httpsMatch[1]) {
    return httpsMatch[1];
  }

  // Try SSH format: git@github.com:owner/repo.git or git@github.com:owner/repo
  const sshMatch = trimmedUrl.match(/:([^/]+?)\/([^/]+?)(\.git)?$/);
  if (sshMatch && sshMatch[2]) {
    return sshMatch[2];
  }

  return null;
}
