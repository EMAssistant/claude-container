/**
 * Tests for useDiffCache hook
 * Story 3.7: Diff View for Document Changes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiffCache, clearAllDiffCache } from './useDiffCache'

describe('useDiffCache', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('setCachedContent', () => {
    it('should save content to localStorage with timestamp', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Content version 1')
      })

      const cached = result.current.getCachedContent('docs/prd.md')

      expect(cached).toBeTruthy()
      expect(cached?.filePath).toBe('docs/prd.md')
      expect(cached?.sessionId).toBe('session-1')
      expect(cached?.lastViewedContent).toBe('Content version 1')
      expect(cached?.lastViewedAt).toBeTruthy()
    })

    it('should update cache when content changes', async () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Version 1')
      })

      const firstTimestamp = result.current.getCachedContent('docs/prd.md')?.lastViewedAt

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Version 2')
      })

      const cached = result.current.getCachedContent('docs/prd.md')

      expect(cached?.lastViewedContent).toBe('Version 2')
      expect(cached?.lastViewedAt).not.toBe(firstTimestamp)
    })

    it('should isolate cache by session ID', () => {
      const { result: session1 } = renderHook(() => useDiffCache('session-1'))
      const { result: session2 } = renderHook(() => useDiffCache('session-2'))

      act(() => {
        session1.current.setCachedContent('docs/prd.md', 'Session 1 content')
        session2.current.setCachedContent('docs/prd.md', 'Session 2 content')
      })

      const cached1 = session1.current.getCachedContent('docs/prd.md')
      const cached2 = session2.current.getCachedContent('docs/prd.md')

      expect(cached1?.lastViewedContent).toBe('Session 1 content')
      expect(cached2?.lastViewedContent).toBe('Session 2 content')
    })
  })

  describe('getCachedContent', () => {
    it('should return null for non-existent cache', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      const cached = result.current.getCachedContent('docs/nonexistent.md')

      expect(cached).toBeNull()
    })

    it('should return cached content if exists', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Cached content')
      })

      const cached = result.current.getCachedContent('docs/prd.md')

      expect(cached).toBeTruthy()
      expect(cached?.lastViewedContent).toBe('Cached content')
    })

    it('should handle corrupted localStorage gracefully', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      // Manually corrupt the cache
      localStorage.setItem('diff-cache:session-1:docs/prd.md', 'invalid json {')

      const cached = result.current.getCachedContent('docs/prd.md')

      // Should return null and remove corrupted entry
      expect(cached).toBeNull()
    })

    it('should validate cache entry structure', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      // Save invalid entry (missing required fields)
      localStorage.setItem(
        'diff-cache:session-1:docs/prd.md',
        JSON.stringify({ filePath: 'docs/prd.md' }) // Missing other fields
      )

      const cached = result.current.getCachedContent('docs/prd.md')

      // Should return null for invalid structure
      expect(cached).toBeNull()
    })
  })

  describe('clearCache', () => {
    it('should clear specific file cache', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Content 1')
        result.current.setCachedContent('docs/architecture.md', 'Content 2')
      })

      act(() => {
        result.current.clearCache('docs/prd.md')
      })

      const cached1 = result.current.getCachedContent('docs/prd.md')
      const cached2 = result.current.getCachedContent('docs/architecture.md')

      expect(cached1).toBeNull()
      expect(cached2).toBeTruthy()
    })

    it('should clear all cache for session when no filePath provided', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Content 1')
        result.current.setCachedContent('docs/architecture.md', 'Content 2')
      })

      act(() => {
        result.current.clearCache()
      })

      const cached1 = result.current.getCachedContent('docs/prd.md')
      const cached2 = result.current.getCachedContent('docs/architecture.md')

      expect(cached1).toBeNull()
      expect(cached2).toBeNull()
    })

    it('should only clear cache for current session', () => {
      const { result: session1 } = renderHook(() => useDiffCache('session-1'))
      const { result: session2 } = renderHook(() => useDiffCache('session-2'))

      act(() => {
        session1.current.setCachedContent('docs/prd.md', 'Session 1')
        session2.current.setCachedContent('docs/prd.md', 'Session 2')
      })

      act(() => {
        session1.current.clearCache()
      })

      const cached1 = session1.current.getCachedContent('docs/prd.md')
      const cached2 = session2.current.getCachedContent('docs/prd.md')

      expect(cached1).toBeNull()
      expect(cached2).toBeTruthy()
    })
  })

  describe('cacheStats', () => {
    it('should track total entries', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Content 1')
        result.current.setCachedContent('docs/architecture.md', 'Content 2')
      })

      act(() => {
        result.current.updateCacheStats()
      })

      expect(result.current.cacheStats.sessionEntries).toBe(2)
    })

    it('should track entries per session', () => {
      const { result: session1 } = renderHook(() => useDiffCache('session-1'))
      const { result: session2 } = renderHook(() => useDiffCache('session-2'))

      act(() => {
        session1.current.setCachedContent('docs/prd.md', 'Content')
        session2.current.setCachedContent('docs/prd.md', 'Content')
        session2.current.setCachedContent('docs/architecture.md', 'Content')
      })

      act(() => {
        session1.current.updateCacheStats()
        session2.current.updateCacheStats()
      })

      expect(session1.current.cacheStats.sessionEntries).toBe(1)
      expect(session2.current.cacheStats.sessionEntries).toBe(2)
      expect(session1.current.cacheStats.totalEntries).toBe(3)
    })
  })

  describe('clearAllDiffCache', () => {
    it('should clear all diff cache entries across all sessions', () => {
      const { result: session1 } = renderHook(() => useDiffCache('session-1'))
      const { result: session2 } = renderHook(() => useDiffCache('session-2'))

      act(() => {
        session1.current.setCachedContent('docs/prd.md', 'Content 1')
        session2.current.setCachedContent('docs/prd.md', 'Content 2')
      })

      clearAllDiffCache()

      const cached1 = session1.current.getCachedContent('docs/prd.md')
      const cached2 = session2.current.getCachedContent('docs/prd.md')

      expect(cached1).toBeNull()
      expect(cached2).toBeNull()
    })

    it('should not affect non-diff cache entries', () => {
      localStorage.setItem('other-key', 'other-value')

      const { result } = renderHook(() => useDiffCache('session-1'))

      act(() => {
        result.current.setCachedContent('docs/prd.md', 'Content')
      })

      clearAllDiffCache()

      expect(localStorage.getItem('other-key')).toBe('other-value')
    })
  })

  describe('error handling', () => {
    it('should handle localStorage quota exceeded gracefully', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      // Fill up cache first to test eviction
      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.setCachedContent(`docs/file-${i}.md`, `Content ${i}`)
        }
      })

      // At this point we should have hit the max and some eviction should occur
      // The hook should handle this gracefully without crashing
      let success: boolean
      act(() => {
        success = result.current.setCachedContent('docs/extra.md', 'Extra content')
      })

      // Should succeed or fail gracefully without throwing
      expect(typeof success!).toBe('boolean')
    })

    it('should handle localStorage unavailable', () => {
      const { result } = renderHook(() => useDiffCache('session-1'))

      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage unavailable')
      })

      // Should not crash, just return null
      expect(() => {
        result.current.getCachedContent('docs/prd.md')
      }).not.toThrow()

      // Restore original
      localStorage.getItem = originalGetItem
    })
  })
})
