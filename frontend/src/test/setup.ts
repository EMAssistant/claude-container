import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Story 4.16/4.19: Mock fetch for /api/sessions endpoint
// This is needed because tests run in Node environment without a real server
const mockFetch = vi.fn((url: string | URL | Request) => {
  const urlString = url.toString()

  // Mock /api/sessions endpoint
  if (urlString.includes('/api/sessions')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ sessions: [] }),
    } as Response)
  }

  // Default mock for other endpoints
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
  } as Response)
})

// Assign to globalThis for cross-environment compatibility
globalThis.fetch = mockFetch as typeof fetch

// Cleanup after each test
afterEach(() => {
  cleanup()
  // Reset fetch mock
  mockFetch.mockClear()
})
