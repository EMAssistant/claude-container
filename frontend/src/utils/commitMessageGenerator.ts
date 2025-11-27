/**
 * Commit Message Generator
 * Story 5.9: Auto-Generated Commit Messages
 *
 * Generates git commit messages from staged files and story context.
 * Follows git best practices (72-character first line, imperative mood).
 */

import type { GitFileEntry } from '@/hooks/useGitStatus'
import { isCodeFile } from './fileTypes'

const MAX_SUBJECT_LENGTH = 72
const TRUNCATE_SUFFIX = '...'

export interface StoryContext {
  storyId: string
  storyTitle: string
}

/**
 * Extract story ID and title from currentStory string
 * Format: "4-16-session-list-hydration" → { storyId: "4-16", storyTitle: "session list hydration" }
 */
export function extractStoryContext(currentStory?: string | null): StoryContext | null {
  if (!currentStory) return null

  const parts = currentStory.split('-')
  if (parts.length < 3) return null

  const storyId = `${parts[0]}-${parts[1]}`
  const storyTitle = parts.slice(2).join(' ').replace(/-/g, ' ')

  return { storyId, storyTitle }
}

/**
 * Check if a file path is a documentation file
 */
function isDocFile(path: string): boolean {
  return (
    path.startsWith('docs/') ||
    path.startsWith('.bmad/') ||
    path.startsWith('stories/') ||
    path.endsWith('.md') ||
    path.endsWith('.xml') ||
    path.endsWith('.json') ||
    path.endsWith('.yaml')
  )
}

/**
 * Categorize files into code and docs
 * Uses explicit code file detection (isCodeFile) rather than implicit "not docs = code" logic
 */
export function categorizeFiles(files: GitFileEntry[]): { code: string[], docs: string[] } {
  const code: string[] = []
  const docs: string[] = []

  files.forEach(file => {
    const path = file.path

    // Explicit categorization: check docs first, then code files
    if (isDocFile(path)) {
      docs.push(path)
    } else if (isCodeFile(path)) {
      code.push(path)
    }
    // Files that are neither docs nor code are not categorized
  })

  return {
    code: code.sort(),
    docs: docs.sort()
  }
}

/**
 * Truncate subject line to MAX_SUBJECT_LENGTH
 * @param subject - Subject line to truncate
 * @returns Truncated subject line
 */
export function truncateSubject(subject: string): string {
  if (subject.length <= MAX_SUBJECT_LENGTH) {
    return subject
  }
  return subject.substring(0, MAX_SUBJECT_LENGTH - TRUNCATE_SUFFIX.length) + TRUNCATE_SUFFIX
}

/**
 * Generate action verb based on git status
 * @param status - Git status code (A, M, D, R, etc.)
 * @returns Action verb in imperative mood
 */
export function getActionVerb(status: string): string {
  switch (status) {
    case 'A': return 'Add'
    case 'D': return 'Remove'
    case 'R': return 'Rename'
    case 'M':
    case 'MM':
    case 'AM':
    default:
      return 'Update'
  }
}

/**
 * Extract epic number from file paths
 * @param files - Array of file paths to search
 * @returns Epic number if found, null otherwise
 */
export function extractEpicNumber(files: string[]): string | null {
  for (const file of files) {
    const match = file.match(/epic-(\d+)/)
    if (match) {
      return match[1]
    }
  }
  return null
}

/**
 * Generate commit message from staged files
 * @param stagedFiles - Array of staged git files
 * @param currentStory - Optional current story ID for context
 * @returns Formatted commit message (subject + body)
 */
export function generateCommitMessage(
  stagedFiles: GitFileEntry[],
  currentStory?: string | null
): string {
  if (stagedFiles.length === 0) {
    return ''
  }

  // Single file: simple format
  if (stagedFiles.length === 1) {
    const file = stagedFiles[0]
    const filename = file.path.split('/').pop() || file.path
    const action = getActionVerb(file.status)

    if (file.status === 'R' && file.oldPath) {
      const oldFilename = file.oldPath.split('/').pop() || file.oldPath
      return `Rename ${oldFilename} to ${filename}`
    }

    return `${action} ${filename}`
  }

  // Multiple files: categorize
  const { code, docs } = categorizeFiles(stagedFiles)
  const storyContext = extractStoryContext(currentStory)

  let subject: string
  let body: string

  if (code.length > 0 && docs.length === 0) {
    // Code only
    if (storyContext) {
      subject = `Implement story ${storyContext.storyId}: ${storyContext.storyTitle}`
    } else {
      subject = 'Implement feature'
    }
    body = 'Files:\n' + code.map(f => `- ${f}`).join('\n')
  } else if (docs.length > 0 && code.length === 0) {
    // Docs only
    const epicNum = extractEpicNumber(docs)

    if (epicNum) {
      subject = `Add epic-${epicNum} stories and architecture update`
    } else {
      subject = 'Update documentation'
    }
    body = 'Files:\n' + docs.map(f => `- ${f}`).join('\n')
  } else {
    // Mixed: code + docs
    if (storyContext) {
      subject = `Implement story ${storyContext.storyId} with documentation updates`
    } else {
      subject = 'Implement feature with documentation updates'
    }
    body = 'Code:\n' + code.map(f => `- ${f}`).join('\n') +
           '\n\nDocs:\n' + docs.map(f => `- ${f}`).join('\n')
  }

  subject = truncateSubject(subject)

  return `${subject}\n\n${body}`
}
