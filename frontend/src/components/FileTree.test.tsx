/**
 * FileTree Component Tests
 * Story 3.4: File Tree Component with Workspace Navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileTree } from './FileTree'
import type { FileTreeNode } from '@/types'

// Mock useWebSocket hook
const mockOn = vi.fn()
const mockSend = vi.fn()

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    on: mockOn,
    send: mockSend,
    isConnected: true,
    reconnecting: false,
    connectionStatus: 'connected' as const,
    sendInput: vi.fn(),
    sendInterrupt: vi.fn(),
    sendAttach: vi.fn(),
    sendDetach: vi.fn(),
    sendResume: vi.fn(),
    retryConnection: vi.fn(),
  }),
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('FileTree', () => {
  const mockFileTree: FileTreeNode[] = [
    {
      name: 'docs',
      path: '/workspace/docs',
      type: 'directory',
      lastModified: '2025-11-25T10:00:00.000Z',
      children: [
        {
          name: 'prd.md',
          path: '/workspace/docs/prd.md',
          type: 'file',
          lastModified: '2025-11-25T10:00:00.000Z',
        },
        {
          name: 'architecture.md',
          path: '/workspace/docs/architecture.md',
          type: 'file',
          lastModified: '2025-11-25T10:00:00.000Z',
        },
      ],
    },
    {
      name: 'README.md',
      path: '/workspace/README.md',
      type: 'file',
      lastModified: '2025-11-25T10:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Default successful fetch response
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tree: mockFileTree }),
    })
    // Default WebSocket on mock
    mockOn.mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial render and data loading', () => {
    it('should render loading state initially', async () => {
      render(<FileTree />)
      expect(screen.getByText('Loading files...')).toBeInTheDocument()
    })

    it('should fetch file tree from API on mount', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/documents/tree')
      })
    })

    it('should render file tree structure correctly', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
        expect(screen.getByText('README.md')).toBeInTheDocument()
      })
    })

    it('should show error state when fetch fails', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      })

      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load file tree')).toBeInTheDocument()
        expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument()
      })
    })

    it('should show retry button on error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        statusText: 'Error',
      })

      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('should show empty state when no files exist', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ tree: [] }),
      })

      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('No files found')).toBeInTheDocument()
        expect(screen.getByText('The workspace is empty')).toBeInTheDocument()
      })
    })
  })

  describe('Expand/collapse functionality', () => {
    it('should start with all folders collapsed', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      // Children should not be visible initially
      expect(screen.queryByText('prd.md')).not.toBeInTheDocument()
      expect(screen.queryByText('architecture.md')).not.toBeInTheDocument()
    })

    it('should expand folder when clicked', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      // Click to expand
      await user.click(screen.getByText('docs'))

      // Children should now be visible
      await waitFor(() => {
        expect(screen.getByText('prd.md')).toBeInTheDocument()
        expect(screen.getByText('architecture.md')).toBeInTheDocument()
      })
    })

    it('should collapse folder when clicked again', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      // Expand
      await user.click(screen.getByText('docs'))
      await waitFor(() => {
        expect(screen.getByText('prd.md')).toBeInTheDocument()
      })

      // Collapse
      await user.click(screen.getByText('docs'))
      await waitFor(() => {
        expect(screen.queryByText('prd.md')).not.toBeInTheDocument()
      })
    })

    it('should support keyboard navigation for folders', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      const docsFolder = screen.getByText('docs').closest('[role="button"]')
      expect(docsFolder).toBeInTheDocument()

      // Focus and press Enter
      docsFolder!.focus()
      await user.keyboard('{Enter}')

      // Should expand
      await waitFor(() => {
        expect(screen.getByText('prd.md')).toBeInTheDocument()
      })
    })
  })

  describe('File selection', () => {
    it('should call onFileSelect callback when file is clicked', async () => {
      const user = userEvent.setup()
      const onFileSelect = vi.fn()
      render(<FileTree onFileSelect={onFileSelect} />)

      await waitFor(() => {
        expect(screen.getByText('README.md')).toBeInTheDocument()
      })

      await user.click(screen.getByText('README.md'))

      expect(onFileSelect).toHaveBeenCalledWith('/workspace/README.md')
    })

    it('should highlight selected file', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('README.md')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('README.md').closest('[role="option"]')

      // Not selected initially
      expect(fileElement).not.toHaveClass('bg-[#88C0D0]/20')

      // Click to select
      await user.click(screen.getByText('README.md'))

      // Should be highlighted
      await waitFor(() => {
        expect(fileElement).toHaveClass('bg-[#88C0D0]/20')
      })
    })

    it('should not call onFileSelect when folder is clicked', async () => {
      const user = userEvent.setup()
      const onFileSelect = vi.fn()
      render(<FileTree onFileSelect={onFileSelect} />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      await user.click(screen.getByText('docs'))

      expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('should support keyboard selection for files', async () => {
      const user = userEvent.setup()
      const onFileSelect = vi.fn()
      render(<FileTree onFileSelect={onFileSelect} />)

      await waitFor(() => {
        expect(screen.getByText('README.md')).toBeInTheDocument()
      })

      const fileElement = screen.getByText('README.md').closest('[role="option"]')
      fileElement!.focus()
      await user.keyboard('{Enter}')

      expect(onFileSelect).toHaveBeenCalledWith('/workspace/README.md')
    })
  })

  describe('Real-time updates via WebSocket', () => {
    it('should subscribe to file.changed WebSocket messages', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalledWith('file.changed', expect.any(Function))
      })
    })

    it('should reload tree when file.changed message is received', async () => {
      let fileChangeHandler: ((message: any) => void) | null = null
      mockOn.mockImplementation((type: string, handler: (message: any) => void) => {
        if (type === 'file.changed') {
          fileChangeHandler = handler
        }
        return () => {}
      })

      render(<FileTree />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // Simulate file.changed WebSocket message
      if (fileChangeHandler) {
        fileChangeHandler({
          type: 'file.changed',
          path: '/workspace/new-file.md',
          event: 'add',
          timestamp: new Date().toISOString(),
        })
      }

      // Should trigger another fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should unsubscribe from WebSocket on unmount', async () => {
      const unsubscribe = vi.fn()
      mockOn.mockReturnValue(unsubscribe)

      const { unmount } = render(<FileTree />)

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('Icons', () => {
    it('should show chevron icons for folders', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      const docsRow = screen.getByText('docs').closest('div')
      expect(docsRow).toBeInTheDocument()

      // Should have SVG elements (icons have aria-hidden="true" so they don't have role="img")
      const svgs = docsRow!.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })

    it('should show folder icons for directories', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      // Initially should show FolderClosed
      const docsRow = screen.getByText('docs').closest('div')
      const svgs = docsRow!.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)

      // After expanding, should show FolderOpen
      await user.click(screen.getByText('docs'))

      await waitFor(() => {
        expect(screen.getByText('prd.md')).toBeInTheDocument()
      })
    })

    it('should show file icon for files', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('README.md')).toBeInTheDocument()
      })

      const fileRow = screen.getByText('README.md').closest('div')
      expect(fileRow).toBeInTheDocument()

      // Should have SVG element (FileText icon)
      const svgs = fileRow!.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA roles', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByRole('tree')).toBeInTheDocument()
      })
    })

    it('should set aria-expanded on folders', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      const docsFolder = screen.getByText('docs').closest('[role="button"]')

      // Initially collapsed
      expect(docsFolder).toHaveAttribute('aria-expanded', 'false')

      // Click to expand
      await user.click(screen.getByText('docs'))

      // Should be expanded
      await waitFor(() => {
        expect(docsFolder).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('should set aria-selected on files', async () => {
      const user = userEvent.setup()
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('README.md')).toBeInTheDocument()
      })

      const fileOption = screen.getByText('README.md').closest('[role="option"]')

      // Initially not selected
      expect(fileOption).toHaveAttribute('aria-selected', 'false')

      // Click to select
      await user.click(screen.getByText('README.md'))

      // Should be selected
      await waitFor(() => {
        expect(fileOption).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('should be keyboard navigable', async () => {
      render(<FileTree />)

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument()
      })

      const docsFolder = screen.getByText('docs').closest('[role="button"]')
      expect(docsFolder).toHaveAttribute('tabIndex', '0')

      const readmeFile = screen.getByText('README.md').closest('[role="option"]')
      expect(readmeFile).toHaveAttribute('tabIndex', '0')
    })
  })
})
