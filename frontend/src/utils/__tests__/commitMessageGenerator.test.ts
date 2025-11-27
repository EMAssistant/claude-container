/**
 * Tests for commitMessageGenerator.ts
 * Story 5.9: Auto-Generated Commit Messages
 */

import { describe, it, expect } from 'vitest'
import {
  generateCommitMessage,
  extractStoryContext,
  categorizeFiles,
  truncateSubject,
  getActionVerb,
  extractEpicNumber,
} from '../commitMessageGenerator'
import type { GitFileEntry } from '@/hooks/useGitStatus'

describe('extractStoryContext', () => {
  it('should extract story ID and title from currentStory string', () => {
    const result = extractStoryContext('4-16-session-list-hydration')
    expect(result).toEqual({
      storyId: '4-16',
      storyTitle: 'session list hydration'
    })
  })

  it('should handle story IDs with hyphens in title', () => {
    const result = extractStoryContext('5-9-auto-generated-commit-messages')
    expect(result).toEqual({
      storyId: '5-9',
      storyTitle: 'auto generated commit messages'
    })
  })

  it('should return null for undefined currentStory', () => {
    const result = extractStoryContext(undefined)
    expect(result).toBeNull()
  })

  it('should return null for null currentStory', () => {
    const result = extractStoryContext(null)
    expect(result).toBeNull()
  })

  it('should return null for invalid format (too few parts)', () => {
    const result = extractStoryContext('4-16')
    expect(result).toBeNull()
  })

  it('should return null for invalid format (single segment)', () => {
    const result = extractStoryContext('story')
    expect(result).toBeNull()
  })
})

describe('categorizeFiles', () => {
  it('should categorize code files correctly', () => {
    const files: GitFileEntry[] = [
      { path: 'src/components/SessionList.tsx', status: 'M' },
      { path: 'src/hooks/useWebSocket.ts', status: 'M' },
    ]
    const result = categorizeFiles(files)
    expect(result.code).toEqual([
      'src/components/SessionList.tsx',
      'src/hooks/useWebSocket.ts',
    ])
    expect(result.docs).toEqual([])
  })

  it('should categorize docs files correctly', () => {
    const files: GitFileEntry[] = [
      { path: 'docs/architecture.md', status: 'M' },
      { path: '.bmad/context.xml', status: 'M' },
      { path: 'stories/epic-3-story-2.md', status: 'A' },
    ]
    const result = categorizeFiles(files)
    expect(result.code).toEqual([])
    expect(result.docs).toEqual([
      '.bmad/context.xml',
      'docs/architecture.md',
      'stories/epic-3-story-2.md',
    ])
  })

  it('should categorize mixed files correctly', () => {
    const files: GitFileEntry[] = [
      { path: 'src/components/GitPanel.tsx', status: 'M' },
      { path: 'docs/sprint-artifacts/5-9-auto-generated-commit-messages.md', status: 'M' },
      { path: 'package.json', status: 'M' },
    ]
    const result = categorizeFiles(files)
    expect(result.code).toEqual(['src/components/GitPanel.tsx'])
    expect(result.docs).toEqual([
      'docs/sprint-artifacts/5-9-auto-generated-commit-messages.md',
      'package.json',
    ])
  })

  it('should categorize yaml/xml files as docs', () => {
    const files: GitFileEntry[] = [
      { path: 'config.yaml', status: 'M' },
      { path: 'data.xml', status: 'A' },
    ]
    const result = categorizeFiles(files)
    expect(result.code).toEqual([])
    expect(result.docs).toEqual(['config.yaml', 'data.xml'])
  })

  it('should sort files alphabetically within categories', () => {
    const files: GitFileEntry[] = [
      { path: 'src/utils/z.ts', status: 'M' },
      { path: 'src/components/a.tsx', status: 'M' },
      { path: 'docs/z.md', status: 'M' },
      { path: 'docs/a.md', status: 'M' },
    ]
    const result = categorizeFiles(files)
    expect(result.code).toEqual([
      'src/components/a.tsx',
      'src/utils/z.ts',
    ])
    expect(result.docs).toEqual([
      'docs/a.md',
      'docs/z.md',
    ])
  })

  it('should handle empty array', () => {
    const result = categorizeFiles([])
    expect(result.code).toEqual([])
    expect(result.docs).toEqual([])
  })
})

describe('truncateSubject', () => {
  it('should not truncate short subjects', () => {
    const subject = 'Update SessionList.tsx'
    expect(truncateSubject(subject)).toBe(subject)
  })

  it('should not truncate subjects exactly at 72 chars', () => {
    const subject = 'A'.repeat(72)
    expect(truncateSubject(subject)).toBe(subject)
  })

  it('should truncate long subjects to 72 chars with ...', () => {
    const subject = 'Implement story 4-16-session-list-hydration-with-websocket-reconnection-and-state-management'
    const result = truncateSubject(subject)
    expect(result.length).toBe(72)
    expect(result.endsWith('...')).toBe(true)
    // Actual truncation is at 69 chars + '...' = 72 total
    expect(result).toBe(subject.substring(0, 69) + '...')
  })

  it('should truncate very long subjects', () => {
    const subject = 'A'.repeat(200)
    const result = truncateSubject(subject)
    expect(result.length).toBe(72)
    expect(result.endsWith('...')).toBe(true)
  })
})

describe('getActionVerb', () => {
  it('should return "Add" for added files', () => {
    expect(getActionVerb('A')).toBe('Add')
  })

  it('should return "Remove" for deleted files', () => {
    expect(getActionVerb('D')).toBe('Remove')
  })

  it('should return "Rename" for renamed files', () => {
    expect(getActionVerb('R')).toBe('Rename')
  })

  it('should return "Update" for modified files', () => {
    expect(getActionVerb('M')).toBe('Update')
  })

  it('should return "Update" for MM status', () => {
    expect(getActionVerb('MM')).toBe('Update')
  })

  it('should return "Update" for AM status', () => {
    expect(getActionVerb('AM')).toBe('Update')
  })

  it('should return "Update" for unknown status', () => {
    expect(getActionVerb('?')).toBe('Update')
  })
})

describe('extractEpicNumber', () => {
  it('should extract epic number from file path', () => {
    const files = ['docs/stories/epic-3-story-2.md']
    expect(extractEpicNumber(files)).toBe('3')
  })

  it('should extract first epic number found', () => {
    const files = ['docs/epic-5.md', 'docs/epic-3.md']
    expect(extractEpicNumber(files)).toBe('5')
  })

  it('should return null if no epic number found', () => {
    const files = ['docs/architecture.md', 'README.md']
    expect(extractEpicNumber(files)).toBeNull()
  })

  it('should handle empty array', () => {
    expect(extractEpicNumber([])).toBeNull()
  })
})

describe('generateCommitMessage', () => {
  describe('single file commits', () => {
    it('should generate simple message for single modified file', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/SessionList.tsx', status: 'M' }
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe('Update SessionList.tsx')
    })

    it('should generate simple message for single added file', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/NewComponent.tsx', status: 'A' }
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe('Add NewComponent.tsx')
    })

    it('should generate simple message for single deleted file', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/OldComponent.tsx', status: 'D' }
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe('Remove OldComponent.tsx')
    })

    it('should generate rename message for renamed file', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/NewName.tsx', status: 'R', oldPath: 'src/components/OldName.tsx' }
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe('Rename OldName.tsx to NewName.tsx')
    })

    it('should extract filename from path', () => {
      const files: GitFileEntry[] = [
        { path: 'src/utils/deep/nested/file.ts', status: 'M' }
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe('Update file.ts')
    })
  })

  describe('code-only commits', () => {
    it('should generate message with story context', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/SessionList.tsx', status: 'M' },
        { path: 'src/hooks/useWebSocket.ts', status: 'M' },
      ]
      const result = generateCommitMessage(files, '4-16-session-list-hydration')
      expect(result).toBe(
        'Implement story 4-16: session list hydration\n\n' +
        'Files:\n' +
        '- src/components/SessionList.tsx\n' +
        '- src/hooks/useWebSocket.ts'
      )
    })

    it('should generate message without story context', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/SessionList.tsx', status: 'M' },
        { path: 'src/hooks/useWebSocket.ts', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe(
        'Implement feature\n\n' +
        'Files:\n' +
        '- src/components/SessionList.tsx\n' +
        '- src/hooks/useWebSocket.ts'
      )
    })

    it('should sort files alphabetically in body', () => {
      const files: GitFileEntry[] = [
        { path: 'src/utils/z.ts', status: 'M' },
        { path: 'src/components/a.tsx', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toContain(
        'Files:\n' +
        '- src/components/a.tsx\n' +
        '- src/utils/z.ts'
      )
    })
  })

  describe('docs-only commits', () => {
    it('should generate message with epic number', () => {
      const files: GitFileEntry[] = [
        { path: 'docs/stories/epic-3-story-2.md', status: 'M' },
        { path: 'docs/architecture.md', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe(
        'Add epic-3 stories and architecture update\n\n' +
        'Files:\n' +
        '- docs/architecture.md\n' +
        '- docs/stories/epic-3-story-2.md'
      )
    })

    it('should generate generic message without epic number', () => {
      const files: GitFileEntry[] = [
        { path: 'README.md', status: 'M' },
        { path: 'docs/guide.md', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe(
        'Update documentation\n\n' +
        'Files:\n' +
        '- README.md\n' +
        '- docs/guide.md'
      )
    })
  })

  describe('mixed commits (code + docs)', () => {
    it('should generate message with story context', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/GitPanel.tsx', status: 'M' },
        { path: 'docs/sprint-artifacts/5-9-auto-generated-commit-messages.md', status: 'M' },
      ]
      const result = generateCommitMessage(files, '5-9-auto-generated-commit-messages')
      expect(result).toBe(
        'Implement story 5-9 with documentation updates\n\n' +
        'Code:\n' +
        '- src/components/GitPanel.tsx\n\n' +
        'Docs:\n' +
        '- docs/sprint-artifacts/5-9-auto-generated-commit-messages.md'
      )
    })

    it('should generate message without story context', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/GitPanel.tsx', status: 'M' },
        { path: 'README.md', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe(
        'Implement feature with documentation updates\n\n' +
        'Code:\n' +
        '- src/components/GitPanel.tsx\n\n' +
        'Docs:\n' +
        '- README.md'
      )
    })

    it('should separate code and docs in body', () => {
      const files: GitFileEntry[] = [
        { path: 'src/a.ts', status: 'M' },
        { path: 'src/b.ts', status: 'M' },
        { path: 'docs/x.md', status: 'M' },
        { path: 'docs/y.md', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toContain('Code:\n- src/a.ts\n- src/b.ts')
      expect(result).toContain('Docs:\n- docs/x.md\n- docs/y.md')
    })
  })

  describe('edge cases', () => {
    it('should return empty string for empty array', () => {
      const result = generateCommitMessage([])
      expect(result).toBe('')
    })

    it('should truncate long subject lines', () => {
      const files: GitFileEntry[] = [
        { path: 'src/a.ts', status: 'M' },
        { path: 'src/b.ts', status: 'M' },
      ]
      const longStory = '4-16-session-list-hydration-with-websocket-reconnection-and-exponential-backoff-and-state-management'
      const result = generateCommitMessage(files, longStory)
      const firstLine = result.split('\n')[0]
      expect(firstLine.length).toBe(72)
      expect(firstLine.endsWith('...')).toBe(true)
    })

    it('should handle null currentStory', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/SessionList.tsx', status: 'M' },
        { path: 'src/hooks/useWebSocket.ts', status: 'M' },
      ]
      const result = generateCommitMessage(files, null)
      expect(result).toBe(
        'Implement feature\n\n' +
        'Files:\n' +
        '- src/components/SessionList.tsx\n' +
        '- src/hooks/useWebSocket.ts'
      )
    })

    it('should handle files with spaces in paths', () => {
      const files: GitFileEntry[] = [
        { path: 'src/my file.ts', status: 'M' }
      ]
      const result = generateCommitMessage(files)
      expect(result).toBe('Update my file.ts')
    })

    it('should keep first line under 72 chars for code commits', () => {
      const files: GitFileEntry[] = [
        { path: 'src/a.ts', status: 'M' },
        { path: 'src/b.ts', status: 'M' },
      ]
      const result = generateCommitMessage(files, '5-9-auto-generated-commit-messages')
      const firstLine = result.split('\n')[0]
      expect(firstLine.length).toBeLessThanOrEqual(72)
    })

    it('should have blank line between subject and body', () => {
      const files: GitFileEntry[] = [
        { path: 'src/a.ts', status: 'M' },
        { path: 'src/b.ts', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      const lines = result.split('\n')
      expect(lines[1]).toBe('')  // Second line should be blank
    })

    it('should use forward slashes in file paths', () => {
      const files: GitFileEntry[] = [
        { path: 'src/components/deep/nested/Component.tsx', status: 'M' },
        { path: 'src/other/file.ts', status: 'M' },
      ]
      const result = generateCommitMessage(files)
      expect(result).toContain('src/components/deep/nested/Component.tsx')
    })
  })
})
