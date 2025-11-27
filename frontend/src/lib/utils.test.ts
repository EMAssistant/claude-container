import { describe, it, expect } from 'vitest'
import { relativeTime } from './utils'

describe('relativeTime', () => {
  describe('seconds', () => {
    it('formats 0 seconds correctly', () => {
      const now = new Date().toISOString()
      const result = relativeTime(now)
      expect(result).toBe('0s ago')
    })

    it('formats 30 seconds correctly', () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
      const result = relativeTime(thirtySecondsAgo)
      expect(result).toBe('30s ago')
    })

    it('formats 59 seconds correctly', () => {
      const fiftyNineSecondsAgo = new Date(Date.now() - 59 * 1000).toISOString()
      const result = relativeTime(fiftyNineSecondsAgo)
      expect(result).toBe('59s ago')
    })
  })

  describe('minutes', () => {
    it('formats 1 minute correctly', () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
      const result = relativeTime(oneMinuteAgo)
      expect(result).toBe('1m ago')
    })

    it('formats 5 minutes correctly', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const result = relativeTime(fiveMinutesAgo)
      expect(result).toBe('5m ago')
    })

    it('formats 30 minutes correctly', () => {
      const thirtyMinutesAgo = new Date(
        Date.now() - 30 * 60 * 1000
      ).toISOString()
      const result = relativeTime(thirtyMinutesAgo)
      expect(result).toBe('30m ago')
    })

    it('formats 59 minutes correctly', () => {
      const fiftyNineMinutesAgo = new Date(
        Date.now() - 59 * 60 * 1000
      ).toISOString()
      const result = relativeTime(fiftyNineMinutesAgo)
      expect(result).toBe('59m ago')
    })
  })

  describe('hours', () => {
    it('formats 1 hour correctly', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const result = relativeTime(oneHourAgo)
      expect(result).toBe('1h ago')
    })

    it('formats 2 hours correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const result = relativeTime(twoHoursAgo)
      expect(result).toBe('2h ago')
    })

    it('formats 23 hours correctly', () => {
      const twentyThreeHoursAgo = new Date(
        Date.now() - 23 * 60 * 60 * 1000
      ).toISOString()
      const result = relativeTime(twentyThreeHoursAgo)
      expect(result).toBe('23h ago')
    })
  })

  describe('days', () => {
    it('formats 1 day correctly', () => {
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString()
      const result = relativeTime(oneDayAgo)
      expect(result).toBe('1d ago')
    })

    it('formats 2 days correctly', () => {
      const twoDaysAgo = new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000
      ).toISOString()
      const result = relativeTime(twoDaysAgo)
      expect(result).toBe('2d ago')
    })

    it('formats 7 days correctly', () => {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString()
      const result = relativeTime(sevenDaysAgo)
      expect(result).toBe('7d ago')
    })

    it('formats 30 days correctly', () => {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString()
      const result = relativeTime(thirtyDaysAgo)
      expect(result).toBe('30d ago')
    })
  })

  describe('edge cases', () => {
    it('handles future timestamps', () => {
      const fiveSecondsInFuture = new Date(Date.now() + 5 * 1000).toISOString()
      const result = relativeTime(fiveSecondsInFuture)
      expect(result).toBe('just now')
    })

    it('handles future timestamps by several minutes', () => {
      const fiveMinutesInFuture = new Date(
        Date.now() + 5 * 60 * 1000
      ).toISOString()
      const result = relativeTime(fiveMinutesInFuture)
      expect(result).toBe('just now')
    })

    it('handles very small time differences (milliseconds)', () => {
      const almostNow = new Date(Date.now() - 500).toISOString()
      const result = relativeTime(almostNow)
      expect(result).toBe('0s ago')
    })
  })

  describe('boundary values', () => {
    it('handles exactly 60 seconds (1 minute boundary)', () => {
      const exactly60Seconds = new Date(Date.now() - 60000).toISOString()
      const result = relativeTime(exactly60Seconds)
      expect(result).toBe('1m ago')
    })

    it('handles exactly 3600 seconds (1 hour boundary)', () => {
      const exactly3600Seconds = new Date(Date.now() - 3600000).toISOString()
      const result = relativeTime(exactly3600Seconds)
      expect(result).toBe('1h ago')
    })

    it('handles exactly 86400 seconds (1 day boundary)', () => {
      const exactly86400Seconds = new Date(Date.now() - 86400000).toISOString()
      const result = relativeTime(exactly86400Seconds)
      expect(result).toBe('1d ago')
    })
  })
})
