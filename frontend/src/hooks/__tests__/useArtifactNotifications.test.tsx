// Story 5.8: useArtifactNotifications hook tests
// AC#1, AC#5, AC#6, AC#8

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useArtifactNotifications } from '../useArtifactNotifications'
import { useToast } from '@/components/ui/use-toast'
import { useLayout } from '@/context/LayoutContext'
import type { UseWebSocketReturn } from '../useWebSocket'
import type { ArtifactInfo } from '@/types'

// Mock dependencies
vi.mock('@/components/ui/use-toast')
vi.mock('@/context/LayoutContext')

describe('useArtifactNotifications', () => {
  let mockWs: UseWebSocketReturn
  let mockToast: ReturnType<typeof vi.fn>
  let mockSetSelectedFile: ReturnType<typeof vi.fn>
  let mockSetMainContentMode: ReturnType<typeof vi.fn>
  let wsSubscribers: Map<string, (message: any) => void>

  beforeEach(() => {
    wsSubscribers = new Map()

    mockToast = vi.fn(() => ({ id: 'toast-123', dismiss: vi.fn(), update: vi.fn() }))
    mockSetSelectedFile = vi.fn()
    mockSetMainContentMode = vi.fn()

    mockWs = {
      isConnected: true,
      reconnecting: false,
      connectionStatus: 'connected',
      send: vi.fn(),
      sendInput: vi.fn(),
      sendInterrupt: vi.fn(),
      sendAttach: vi.fn(),
      sendDetach: vi.fn(),
      sendResume: vi.fn(),
      on: vi.fn((type, callback) => {
        wsSubscribers.set(type, callback)
        return () => wsSubscribers.delete(type)
      }),
      retryConnection: vi.fn(),
    }

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      toasts: [],
      queue: [],
      history: [],
      dismiss: vi.fn(),
    } as any)

    vi.mocked(useLayout).mockReturnValue({
      setSelectedFile: mockSetSelectedFile,
      setMainContentMode: mockSetMainContentMode,
    } as any)

    // Mock fetch for approve endpoint
    global.fetch = vi.fn()
  })

  describe('AC#1: Subscribe to artifact.updated messages', () => {
    it('should subscribe to artifact.updated WebSocket messages', () => {
      renderHook(() => useArtifactNotifications(mockWs))

      expect(mockWs.on).toHaveBeenCalledWith('artifact.updated', expect.any(Function))
    })

    it('should show toast when Claude-modified code file is updated', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'frontend/src/App.tsx',
          exists: true,
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })
    })
  })

  describe('AC#6: Filter - only Claude-modified code files', () => {
    it('should NOT show toast for approved artifacts', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'frontend/src/App.tsx',
          reviewStatus: 'approved',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should NOT show toast for user-modified files', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'frontend/src/App.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'user',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should NOT show toast for markdown docs', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'story.md',
          path: 'docs/sprint-artifacts/story.md',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should NOT show toast for files in docs/ directory', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'helper.ts',
          path: 'docs/helpers/helper.ts',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should NOT show toast for files in .bmad/ directory', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'config.ts',
          path: '.bmad/config.ts',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should NOT show toast for context.xml files', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'story.context.xml',
          path: 'stories/5-8-story.context.xml',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should show toast for TypeScript code files', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'Component.tsx',
          path: 'frontend/src/components/Component.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })
    })

    it('should show toast for Python code files', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const artifactMessage = {
        type: 'artifact.updated',
        sessionId: 'session-123',
        artifact: {
          name: 'script.py',
          path: 'backend/scripts/script.py',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      const callback = wsSubscribers.get('artifact.updated')
      callback?.(artifactMessage)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })
    })
  })

  describe('AC#5: Queue management - max 3 visible toasts', () => {
    it('should show first 3 toasts immediately', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')

      // Send 3 artifact updates
      for (let i = 1; i <= 3; i++) {
        callback?.({
          sessionId: 'session-123',
          artifact: {
            name: `File${i}.tsx`,
            path: `src/File${i}.tsx`,
            reviewStatus: 'pending',
            modifiedBy: 'claude',
          } as ArtifactInfo,
        })
      }

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(3)
      })
    })

    it('should queue 4th toast when 3 are already visible', async () => {
      const { result } = renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')

      // Send 4 artifact updates (with unique paths)
      for (let i = 1; i <= 4; i++) {
        callback?.({
          sessionId: 'session-123',
          artifact: {
            name: `File${i}.tsx`,
            path: `src/components/File${i}.tsx`, // More unique paths
            reviewStatus: 'pending',
            modifiedBy: 'claude',
          } as ArtifactInfo,
        })
      }

      await waitFor(() => {
        // First 3 toasts should be shown immediately
        expect(mockToast).toHaveBeenCalled()
        // 4th should be queued
        expect(result.current.queuedCount).toBeGreaterThan(0)
      })
    })

    it('should NOT show duplicate toast for same file path', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')

      // Send same artifact twice
      const artifactMessage = {
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'src/App.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      }

      callback?.(artifactMessage)

      // Wait for first toast to be shown
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1)
      })

      // Try to send duplicate
      callback?.(artifactMessage)

      // Wait a bit for any potential duplicate
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should still only have 1 toast (no duplicate)
      expect(mockToast).toHaveBeenCalledTimes(1)
    })
  })

  describe('AC#2: Approve functionality', () => {
    it('should call approve API endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
      global.fetch = mockFetch

      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')
      callback?.({
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'frontend/src/App.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      // Extract onApprove callback from toast call
      const toastCall = mockToast.mock.calls[0][0]
      const artifactToastProps = toastCall.description.props

      // Call onApprove
      await artifactToastProps.onApprove('frontend/src/App.tsx')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-123/artifacts/frontend%2Fsrc%2FApp.tsx/approve',
        { method: 'POST' }
      )
    })
  })

  describe('AC#3: View Diff functionality', () => {
    it('should set selected file and switch to split mode', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')
      callback?.({
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'frontend/src/App.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      // Extract onViewDiff callback from toast call
      const toastCall = mockToast.mock.calls[0][0]
      const artifactToastProps = toastCall.description.props

      // Call onViewDiff
      artifactToastProps.onViewDiff('frontend/src/App.tsx')

      expect(mockSetSelectedFile).toHaveBeenCalledWith('frontend/src/App.tsx')
      expect(mockSetMainContentMode).toHaveBeenCalledWith('split')
    })
  })

  describe('AC#8: Error handling', () => {
    it('should throw error when approve API fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Session not found' }),
      })
      global.fetch = mockFetch

      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')
      callback?.({
        sessionId: 'session-123',
        artifact: {
          name: 'App.tsx',
          path: 'frontend/src/App.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      // Extract onApprove callback from toast call
      const toastCall = mockToast.mock.calls[0][0]
      const artifactToastProps = toastCall.description.props

      // Call onApprove - should throw
      await expect(artifactToastProps.onApprove('frontend/src/App.tsx')).rejects.toThrow()
    })
  })

  describe('Edge cases', () => {
    it('should handle missing artifact in message', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')
      callback?.({
        sessionId: 'session-123',
        // Missing artifact
      })

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })

    it('should handle missing sessionId in message', async () => {
      renderHook(() => useArtifactNotifications(mockWs))

      const callback = wsSubscribers.get('artifact.updated')
      callback?.({
        artifact: {
          name: 'App.tsx',
          path: 'src/App.tsx',
          reviewStatus: 'pending',
          modifiedBy: 'claude',
        } as ArtifactInfo,
        // Missing sessionId
      })

      await waitFor(() => {
        expect(mockToast).not.toHaveBeenCalled()
      })
    })
  })
})
