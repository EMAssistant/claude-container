/**
 * Diff Utilities Module
 * Story 3.7: Diff View for Document Changes
 *
 * Provides line-by-line diff calculation using the `diff` library.
 * Used for showing changes in markdown documents since last viewing.
 */

import { diffLines, type Change } from 'diff'

/**
 * Represents a single line change in a diff
 */
export interface DiffChange {
  /** Type of change: addition, deletion, or unchanged */
  type: 'add' | 'delete' | 'unchanged'
  /** The text content of the line */
  line: string
  /** The line number in the context of the diff */
  lineNumber: number
  /** Number of lines this change represents (for grouping) */
  count: number
}

/**
 * Represents a block of changes with optional context
 */
export interface DiffBlock {
  /** Array of changes in this block */
  changes: DiffChange[]
  /** Starting line number for this block */
  startLine: number
  /** Ending line number for this block */
  endLine: number
  /** Whether this block contains actual changes (not just context) */
  hasChanges: boolean
}

/**
 * Options for diff calculation
 */
export interface DiffOptions {
  /** Number of context lines to show before/after changes (default: 3) */
  contextLines?: number
  /** Whether to include line numbers (default: true) */
  includeLineNumbers?: boolean
}

/**
 * Calculate line-by-line diff between old and new content
 *
 * @param oldContent - The original content
 * @param newContent - The updated content
 * @param options - Diff calculation options
 * @returns Array of diff changes with line numbers
 *
 * @example
 * const changes = calculateDiff(
 *   "Line 1\nLine 2\nLine 3",
 *   "Line 1\nLine 2 modified\nLine 3\nLine 4"
 * )
 */
export function calculateDiff(
  oldContent: string,
  newContent: string,
  options: DiffOptions = {}
): DiffChange[] {
  const { includeLineNumbers = true } = options

  // Use diff library's line-by-line comparison
  const changes: Change[] = diffLines(oldContent, newContent)

  const result: DiffChange[] = []
  let lineNumber = 1

  changes.forEach((change) => {
    const lines = change.value.split('\n')
    // Remove empty last line if value ends with newline
    if (lines[lines.length - 1] === '') {
      lines.pop()
    }

    const changeType = change.added ? 'add' : change.removed ? 'delete' : 'unchanged'

    lines.forEach((line) => {
      result.push({
        type: changeType,
        line,
        lineNumber: includeLineNumbers ? lineNumber : 0,
        count: 1,
      })

      // Only increment line number for unchanged and added lines
      // Deleted lines don't consume line numbers in the new document
      if (changeType !== 'delete') {
        lineNumber++
      }
    })
  })

  return result
}

/**
 * Group diff changes into blocks with context lines
 *
 * This function takes a flat list of changes and groups them into blocks,
 * preserving context lines (unchanged lines before/after changes).
 *
 * @param changes - Array of diff changes
 * @param contextLines - Number of context lines to preserve (default: 3)
 * @returns Array of diff blocks with context
 *
 * @example
 * const blocks = groupDiffBlocks(changes, 3)
 * blocks.forEach(block => {
 *   console.log(`Lines ${block.startLine}-${block.endLine}`)
 * })
 */
export function groupDiffBlocks(
  changes: DiffChange[],
  contextLines: number = 3
): DiffBlock[] {
  if (changes.length === 0) {
    return []
  }

  const blocks: DiffBlock[] = []
  let currentBlock: DiffChange[] = []
  let blockStartLine = 1
  let lastChangeIndex = -1

  // Find indices of all changed lines
  const changedIndices = changes
    .map((change, index) => (change.type !== 'unchanged' ? index : -1))
    .filter((index) => index !== -1)

  if (changedIndices.length === 0) {
    // No changes, return single block with all content
    return [
      {
        changes,
        startLine: 1,
        endLine: changes.length,
        hasChanges: false,
      },
    ]
  }

  changes.forEach((change, index) => {
    // Check if this line is within context of any changed line
    const isInContext = changedIndices.some(
      (changedIndex) => Math.abs(index - changedIndex) <= contextLines
    )

    if (isInContext || change.type !== 'unchanged') {
      // Start new block if there's a gap
      if (currentBlock.length > 0 && index - lastChangeIndex > contextLines * 2 + 1) {
        blocks.push({
          changes: currentBlock,
          startLine: blockStartLine,
          endLine: blockStartLine + currentBlock.length - 1,
          hasChanges: currentBlock.some((c) => c.type !== 'unchanged'),
        })
        currentBlock = []
        blockStartLine = change.lineNumber
      }

      // Start first block
      if (currentBlock.length === 0) {
        blockStartLine = change.lineNumber
      }

      currentBlock.push(change)
      lastChangeIndex = index
    }
  })

  // Add final block
  if (currentBlock.length > 0) {
    blocks.push({
      changes: currentBlock,
      startLine: blockStartLine,
      endLine: blockStartLine + currentBlock.length - 1,
      hasChanges: currentBlock.some((c) => c.type !== 'unchanged'),
    })
  }

  return blocks
}

/**
 * Count the number of additions and deletions in a diff
 *
 * @param changes - Array of diff changes
 * @returns Object with counts of additions and deletions
 */
export function countChanges(changes: DiffChange[]): {
  additions: number
  deletions: number
  unchanged: number
} {
  return changes.reduce(
    (acc, change) => {
      if (change.type === 'add') {
        acc.additions++
      } else if (change.type === 'delete') {
        acc.deletions++
      } else {
        acc.unchanged++
      }
      return acc
    },
    { additions: 0, deletions: 0, unchanged: 0 }
  )
}

/**
 * Check if two contents are identical (no diff)
 *
 * @param oldContent - The original content
 * @param newContent - The updated content
 * @returns True if contents are identical
 */
export function isContentIdentical(oldContent: string, newContent: string): boolean {
  return oldContent === newContent
}
