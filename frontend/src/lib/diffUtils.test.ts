/**
 * Tests for diffUtils
 * Story 3.7: Diff View for Document Changes
 */

import { describe, it, expect } from 'vitest'
import {
  calculateDiff,
  groupDiffBlocks,
  countChanges,
  isContentIdentical,
  type DiffChange,
} from './diffUtils'

describe('diffUtils', () => {
  describe('calculateDiff', () => {
    it('should identify added lines', () => {
      const oldContent = 'Line 1\nLine 2'
      const newContent = 'Line 1\nLine 2\nLine 3'

      const changes = calculateDiff(oldContent, newContent)

      // Should have added line(s)
      const addedLines = changes.filter((c) => c.type === 'add')
      expect(addedLines.length).toBeGreaterThan(0)
      expect(addedLines.some((c) => c.line === 'Line 3')).toBe(true)
    })

    it('should identify deleted lines', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3'
      const newContent = 'Line 1\nLine 3'

      const changes = calculateDiff(oldContent, newContent)

      expect(changes).toHaveLength(3)
      expect(changes[0]).toMatchObject({ type: 'unchanged', line: 'Line 1' })
      expect(changes[1]).toMatchObject({ type: 'delete', line: 'Line 2' })
      expect(changes[2]).toMatchObject({ type: 'unchanged', line: 'Line 3' })
    })

    it('should identify modified lines as delete + add', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3'
      const newContent = 'Line 1\nLine 2 modified\nLine 3'

      const changes = calculateDiff(oldContent, newContent)

      // Should show deletion of old line and addition of new line
      expect(changes.some((c) => c.type === 'delete' && c.line === 'Line 2')).toBe(true)
      expect(
        changes.some((c) => c.type === 'add' && c.line === 'Line 2 modified')
      ).toBe(true)
    })

    it('should handle empty content', () => {
      const changes = calculateDiff('', '')
      expect(changes).toHaveLength(0)
    })

    it('should handle adding content to empty document', () => {
      const oldContent = ''
      const newContent = 'New line'

      const changes = calculateDiff(oldContent, newContent)

      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({ type: 'add', line: 'New line' })
    })

    it('should handle removing all content', () => {
      const oldContent = 'Line 1\nLine 2'
      const newContent = ''

      const changes = calculateDiff(oldContent, newContent)

      expect(changes.filter((c) => c.type === 'delete')).toHaveLength(2)
    })

    it('should assign correct line numbers', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3'
      const newContent = 'Line 1\nLine 2 modified\nLine 3\nLine 4'

      const changes = calculateDiff(oldContent, newContent)

      // Line numbers should increment for unchanged and added lines
      const unchangedOrAdded = changes.filter(
        (c) => c.type !== 'delete' && c.lineNumber > 0
      )
      const lineNumbers = unchangedOrAdded.map((c) => c.lineNumber)

      // Should be sequential
      for (let i = 1; i < lineNumbers.length; i++) {
        expect(lineNumbers[i]).toBe(lineNumbers[i - 1] + 1)
      }
    })

    it('should handle markdown content with code blocks', () => {
      const oldContent = '# Header\n\n```js\nconst x = 1\n```'
      const newContent = '# Header\n\n```js\nconst x = 2\n```'

      const changes = calculateDiff(oldContent, newContent)

      expect(changes.some((c) => c.line === '# Header')).toBe(true)
      expect(changes.some((c) => c.line === '```js')).toBe(true)
    })
  })

  describe('groupDiffBlocks', () => {
    it('should group changes into blocks with context', () => {
      const changes: DiffChange[] = [
        { type: 'unchanged', line: 'Line 1', lineNumber: 1, count: 1 },
        { type: 'unchanged', line: 'Line 2', lineNumber: 2, count: 1 },
        { type: 'unchanged', line: 'Line 3', lineNumber: 3, count: 1 },
        { type: 'add', line: 'Line 4 new', lineNumber: 4, count: 1 },
        { type: 'unchanged', line: 'Line 5', lineNumber: 5, count: 1 },
        { type: 'unchanged', line: 'Line 6', lineNumber: 6, count: 1 },
        { type: 'unchanged', line: 'Line 7', lineNumber: 7, count: 1 },
      ]

      const blocks = groupDiffBlocks(changes, 3)

      expect(blocks.length).toBeGreaterThan(0)
      expect(blocks[0].hasChanges).toBe(true)
      expect(blocks[0].changes).toContainEqual(
        expect.objectContaining({ type: 'add' })
      )
    })

    it('should include context lines before and after changes', () => {
      const changes: DiffChange[] = [
        { type: 'unchanged', line: 'Context 1', lineNumber: 1, count: 1 },
        { type: 'unchanged', line: 'Context 2', lineNumber: 2, count: 1 },
        { type: 'unchanged', line: 'Context 3', lineNumber: 3, count: 1 },
        { type: 'add', line: 'Added line', lineNumber: 4, count: 1 },
        { type: 'unchanged', line: 'Context 4', lineNumber: 5, count: 1 },
        { type: 'unchanged', line: 'Context 5', lineNumber: 6, count: 1 },
        { type: 'unchanged', line: 'Context 6', lineNumber: 7, count: 1 },
      ]

      const blocks = groupDiffBlocks(changes, 3)

      const firstBlock = blocks[0]
      // Should include 3 context lines before and after
      expect(firstBlock.changes.length).toBeGreaterThanOrEqual(4) // 3 before + change
    })

    it('should handle no changes', () => {
      const changes: DiffChange[] = [
        { type: 'unchanged', line: 'Line 1', lineNumber: 1, count: 1 },
        { type: 'unchanged', line: 'Line 2', lineNumber: 2, count: 1 },
      ]

      const blocks = groupDiffBlocks(changes, 3)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].hasChanges).toBe(false)
    })

    it('should handle empty changes array', () => {
      const blocks = groupDiffBlocks([], 3)
      expect(blocks).toHaveLength(0)
    })
  })

  describe('countChanges', () => {
    it('should count additions, deletions, and unchanged lines', () => {
      const changes: DiffChange[] = [
        { type: 'unchanged', line: 'Line 1', lineNumber: 1, count: 1 },
        { type: 'add', line: 'Line 2', lineNumber: 2, count: 1 },
        { type: 'delete', line: 'Line 3', lineNumber: 3, count: 1 },
        { type: 'add', line: 'Line 4', lineNumber: 4, count: 1 },
        { type: 'unchanged', line: 'Line 5', lineNumber: 5, count: 1 },
      ]

      const stats = countChanges(changes)

      expect(stats.additions).toBe(2)
      expect(stats.deletions).toBe(1)
      expect(stats.unchanged).toBe(2)
    })

    it('should handle empty changes', () => {
      const stats = countChanges([])

      expect(stats.additions).toBe(0)
      expect(stats.deletions).toBe(0)
      expect(stats.unchanged).toBe(0)
    })

    it('should handle all additions', () => {
      const changes: DiffChange[] = [
        { type: 'add', line: 'Line 1', lineNumber: 1, count: 1 },
        { type: 'add', line: 'Line 2', lineNumber: 2, count: 1 },
      ]

      const stats = countChanges(changes)

      expect(stats.additions).toBe(2)
      expect(stats.deletions).toBe(0)
      expect(stats.unchanged).toBe(0)
    })
  })

  describe('isContentIdentical', () => {
    it('should return true for identical content', () => {
      const content = 'Line 1\nLine 2\nLine 3'
      expect(isContentIdentical(content, content)).toBe(true)
    })

    it('should return false for different content', () => {
      const oldContent = 'Line 1\nLine 2'
      const newContent = 'Line 1\nLine 3'
      expect(isContentIdentical(oldContent, newContent)).toBe(false)
    })

    it('should return false for different whitespace', () => {
      const oldContent = 'Line 1\nLine 2'
      const newContent = 'Line 1 \nLine 2'
      expect(isContentIdentical(oldContent, newContent)).toBe(false)
    })

    it('should return true for empty strings', () => {
      expect(isContentIdentical('', '')).toBe(true)
    })
  })
})
