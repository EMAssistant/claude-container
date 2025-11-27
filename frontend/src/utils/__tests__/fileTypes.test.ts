// Story 5.8: File type utility tests
// AC#6: Test filtering logic for code files and excluded paths

import { describe, it, expect } from 'vitest'
import { isCodeFile, isExcludedPath, getFileIcon } from '../fileTypes'

describe('fileTypes utilities', () => {
  describe('isCodeFile', () => {
    it('should return true for TypeScript files', () => {
      expect(isCodeFile('src/components/App.tsx')).toBe(true)
      expect(isCodeFile('backend/server.ts')).toBe(true)
    })

    it('should return true for JavaScript files', () => {
      expect(isCodeFile('src/utils/helper.js')).toBe(true)
      expect(isCodeFile('frontend/index.jsx')).toBe(true)
    })

    it('should return true for Python files', () => {
      expect(isCodeFile('scripts/deploy.py')).toBe(true)
    })

    it('should return true for various code file extensions', () => {
      expect(isCodeFile('Main.java')).toBe(true)
      expect(isCodeFile('main.go')).toBe(true)
      expect(isCodeFile('app.rs')).toBe(true)
      expect(isCodeFile('component.vue')).toBe(true)
      expect(isCodeFile('Widget.swift')).toBe(true)
    })

    it('should return false for markdown files', () => {
      expect(isCodeFile('README.md')).toBe(false)
      expect(isCodeFile('docs/architecture.md')).toBe(false)
    })

    it('should return false for documentation files', () => {
      expect(isCodeFile('story.xml')).toBe(false)
      expect(isCodeFile('config.json')).toBe(false)
      expect(isCodeFile('package.yaml')).toBe(false)
      expect(isCodeFile('notes.txt')).toBe(false)
    })

    it('should return false for files without code extensions', () => {
      expect(isCodeFile('image.png')).toBe(false)
      expect(isCodeFile('styles.css')).toBe(false)
      expect(isCodeFile('index.html')).toBe(false)
    })
  })

  describe('isExcludedPath', () => {
    it('should return true for docs/ path', () => {
      expect(isExcludedPath('docs/story.md')).toBe(true)
      expect(isExcludedPath('docs/sprint-artifacts/epic-5.md')).toBe(true)
    })

    it('should return true for .bmad/ path', () => {
      expect(isExcludedPath('.bmad/config.yaml')).toBe(true)
      expect(isExcludedPath('.bmad/core/workflows/dev-story.yaml')).toBe(true)
    })

    it('should return true for stories/ path', () => {
      expect(isExcludedPath('stories/5-8-quick-approve.md')).toBe(true)
    })

    it('should return true for context.xml files', () => {
      expect(isExcludedPath('5-8-quick-approve.context.xml')).toBe(true)
      expect(isExcludedPath('stories/epic-5.context.xml')).toBe(true)
    })

    it('should return true for .git/ path', () => {
      expect(isExcludedPath('.git/config')).toBe(true)
      expect(isExcludedPath('.git/hooks/pre-commit')).toBe(true)
    })

    it('should return true for node_modules/ path', () => {
      expect(isExcludedPath('node_modules/react/index.js')).toBe(true)
    })

    it('should return true for build artifacts', () => {
      expect(isExcludedPath('dist/bundle.js')).toBe(true)
      expect(isExcludedPath('build/index.html')).toBe(true)
    })

    it('should return false for code files in src/', () => {
      expect(isExcludedPath('src/components/App.tsx')).toBe(false)
      expect(isExcludedPath('frontend/src/utils/helper.ts')).toBe(false)
    })

    it('should return false for backend code files', () => {
      expect(isExcludedPath('backend/src/server.ts')).toBe(false)
      expect(isExcludedPath('backend/routes/api.ts')).toBe(false)
    })
  })

  describe('getFileIcon', () => {
    it('should return document icon for markdown files', () => {
      expect(getFileIcon('README.md')).toBe('📋')
      expect(getFileIcon('docs/story.md')).toBe('📋')
    })

    it('should return document icon for text files', () => {
      expect(getFileIcon('notes.txt')).toBe('📋')
    })

    it('should return file icon for code files', () => {
      expect(getFileIcon('src/App.tsx')).toBe('📄')
      expect(getFileIcon('backend/server.ts')).toBe('📄')
      expect(getFileIcon('script.py')).toBe('📄')
    })

    it('should return file icon for other file types', () => {
      expect(getFileIcon('package.json')).toBe('📄')
      expect(getFileIcon('config.yaml')).toBe('📄')
    })
  })
})
