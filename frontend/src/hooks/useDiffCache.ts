/**
 * useDiffCache Hook
 * Story 3.7: Diff View for Document Changes
 *
 * Manages localStorage-based caching of "last viewed" content for diff tracking.
 * Implements session-specific isolation and graceful error handling.
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * Represents a cached diff entry for a file
 */
export interface DiffCacheEntry {
  /** File path (relative to /workspace) */
  filePath: string
  /** Session ID for isolation */
  sessionId: string
  /** Content when last viewed */
  lastViewedContent: string
  /** ISO 8601 timestamp of last view */
  lastViewedAt: string
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total number of cached entries */
  totalEntries: number
  /** Number of entries for current session */
  sessionEntries: number
  /** Estimated cache size in bytes */
  estimatedSize: number
}

const CACHE_KEY_PREFIX = 'diff-cache:'
const MAX_CACHE_ENTRIES = 50 // Per session
// const CACHE_VERSION = '1.0' // Reserved for future versioning

/**
 * Generate cache key for a file path and session
 */
function getCacheKey(sessionId: string, filePath: string): string {
  return `${CACHE_KEY_PREFIX}${sessionId}:${filePath}`
}

/**
 * Safely parse JSON from localStorage
 */
function safeJSONParse<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue
  try {
    return JSON.parse(json) as T
  } catch (error) {
    console.warn('Failed to parse cached JSON, resetting:', error)
    return defaultValue
  }
}

/**
 * Safely write to localStorage with error handling
 */
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, attempting to free space')
      // Try to clear old entries
      return false
    }
    console.error('Failed to write to localStorage:', error)
    return false
  }
}

/**
 * Get all cache keys for a specific session
 */
function getSessionCacheKeys(sessionId: string): string[] {
  const prefix = `${CACHE_KEY_PREFIX}${sessionId}:`
  const keys: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keys.push(key)
      }
    }
  } catch (error) {
    console.error('Failed to enumerate localStorage keys:', error)
  }

  return keys
}

/**
 * Custom hook for managing diff cache with localStorage
 *
 * @param sessionId - Current session ID for cache isolation
 * @returns Cache management functions
 *
 * @example
 * const cache = useDiffCache(activeSessionId)
 *
 * // Save content when file is closed
 * cache.setCachedContent('docs/prd.md', fileContent)
 *
 * // Load cached content when showing diff
 * const cached = cache.getCachedContent('docs/prd.md')
 * if (cached) {
 *   const diff = calculateDiff(cached.lastViewedContent, currentContent)
 * }
 */
export function useDiffCache(sessionId: string) {
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalEntries: 0,
    sessionEntries: 0,
    estimatedSize: 0,
  })

  /**
   * Get cached content for a file path
   */
  const getCachedContent = useCallback(
    (filePath: string): DiffCacheEntry | null => {
      const key = getCacheKey(sessionId, filePath)
      const cached = localStorage.getItem(key)
      if (!cached) return null

      const entry = safeJSONParse<DiffCacheEntry | null>(cached, null)
      if (!entry) {
        // Corrupted entry, remove it
        try {
          localStorage.removeItem(key)
        } catch (error) {
          console.error('Failed to remove corrupted cache entry:', error)
        }
        return null
      }

      // Validate entry structure
      if (
        !entry.filePath ||
        !entry.sessionId ||
        !entry.lastViewedContent ||
        !entry.lastViewedAt
      ) {
        console.warn('Invalid cache entry structure, removing:', entry)
        try {
          localStorage.removeItem(key)
        } catch (error) {
          console.error('Failed to remove invalid cache entry:', error)
        }
        return null
      }

      return entry
    },
    [sessionId]
  )

  /**
   * Set cached content for a file path
   */
  const setCachedContent = useCallback(
    (filePath: string, content: string): boolean => {
      const key = getCacheKey(sessionId, filePath)
      const entry: DiffCacheEntry = {
        filePath,
        sessionId,
        lastViewedContent: content,
        lastViewedAt: new Date().toISOString(),
      }

      const success = safeLocalStorageSet(key, JSON.stringify(entry))

      if (!success) {
        // Try to free space by evicting oldest entries
        const evicted = evictOldestEntries(sessionId, 10)
        if (evicted > 0) {
          console.log(`Evicted ${evicted} old cache entries, retrying...`)
          return safeLocalStorageSet(key, JSON.stringify(entry))
        }
        return false
      }

      // Check if we've exceeded max entries for this session
      const sessionKeys = getSessionCacheKeys(sessionId)
      if (sessionKeys.length > MAX_CACHE_ENTRIES) {
        evictOldestEntries(sessionId, sessionKeys.length - MAX_CACHE_ENTRIES)
      }

      return true
    },
    [sessionId]
  )

  /**
   * Clear cache for a specific file or entire session
   */
  const clearCache = useCallback(
    (filePath?: string): void => {
      if (filePath) {
        // Clear specific file
        const key = getCacheKey(sessionId, filePath)
        try {
          localStorage.removeItem(key)
        } catch (error) {
          console.error('Failed to clear cache for file:', error)
        }
      } else {
        // Clear all entries for this session
        const sessionKeys = getSessionCacheKeys(sessionId)
        sessionKeys.forEach((key) => {
          try {
            localStorage.removeItem(key)
          } catch (error) {
            console.error('Failed to remove cache key:', error)
          }
        })
      }
    },
    [sessionId]
  )

  /**
   * Evict oldest cache entries (LRU eviction)
   */
  const evictOldestEntries = useCallback(
    (sessionId: string, count: number): number => {
      const sessionKeys = getSessionCacheKeys(sessionId)
      const entries: Array<{ key: string; timestamp: string }> = []

      // Get all entries with timestamps
      sessionKeys.forEach((key) => {
        const cached = localStorage.getItem(key)
        if (cached) {
          const entry = safeJSONParse<DiffCacheEntry | null>(cached, null)
          if (entry && entry.lastViewedAt) {
            entries.push({
              key,
              timestamp: entry.lastViewedAt,
            })
          }
        }
      })

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

      // Remove oldest entries
      let evicted = 0
      for (let i = 0; i < Math.min(count, entries.length); i++) {
        try {
          localStorage.removeItem(entries[i].key)
          evicted++
        } catch (error) {
          console.error('Failed to evict cache entry:', error)
        }
      }

      return evicted
    },
    []
  )

  /**
   * Update cache statistics
   */
  const updateCacheStats = useCallback(() => {
    try {
      let totalEntries = 0
      let sessionEntries = 0
      let estimatedSize = 0

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          totalEntries++
          const value = localStorage.getItem(key)
          if (value) {
            estimatedSize += value.length
          }

          if (key.startsWith(`${CACHE_KEY_PREFIX}${sessionId}:`)) {
            sessionEntries++
          }
        }
      }

      setCacheStats({
        totalEntries,
        sessionEntries,
        estimatedSize,
      })
    } catch (error) {
      console.error('Failed to update cache stats:', error)
    }
  }, [sessionId])

  /**
   * Update stats when sessionId changes
   */
  useEffect(() => {
    updateCacheStats()
  }, [sessionId, updateCacheStats])

  return {
    getCachedContent,
    setCachedContent,
    clearCache,
    cacheStats,
    updateCacheStats,
  }
}

/**
 * Clear all diff cache entries (all sessions)
 * Useful for cleanup or debugging
 */
export function clearAllDiffCache(): void {
  const keysToRemove: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error('Failed to remove cache key:', error)
      }
    })

    console.log(`Cleared ${keysToRemove.length} diff cache entries`)
  } catch (error) {
    console.error('Failed to clear all diff cache:', error)
  }
}
