// Story 5.8: File type detection utilities for artifact toast filtering
// AC#6: Only Claude-modified code files trigger notifications

const CODE_FILE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.java', '.go', '.rs',
  '.cpp', '.c', '.h', '.cs',
  '.rb', '.php', '.vue', '.svelte',
  '.kt', '.swift', '.m', '.mm',
  '.scala', '.clj', '.ex', '.exs',
  '.hs', '.elm', '.dart', '.lua',
]

const EXCLUDED_PATH_PATTERNS = [
  /^docs\//,
  /^\.bmad\//,
  /^stories\//,
  /\.context\.xml$/,
  /^\.git\//,
  /^node_modules\//,
  /^dist\//,
  /^build\//,
]

/**
 * Check if a file path represents a code file (not documentation)
 * @param path - File path to check
 * @returns true if file is a code file that should trigger notifications
 */
export function isCodeFile(path: string): boolean {
  return CODE_FILE_EXTENSIONS.some(ext => path.endsWith(ext))
}

/**
 * Check if a file path should be excluded from notifications
 * Excludes Story/Context docs, .bmad files, and build artifacts
 * @param path - File path to check
 * @returns true if file should be excluded from notifications
 */
export function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATH_PATTERNS.some(pattern => pattern.test(path))
}

/**
 * Get file icon based on file extension
 * @param path - File path
 * @returns emoji icon for file type
 */
export function getFileIcon(path: string): string {
  if (path.endsWith('.md') || path.endsWith('.txt')) {
    return '📋'
  }
  return '📄'
}
