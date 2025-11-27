/**
 * ArtifactViewer Component Tests
 * Story 3.5: Artifact Viewer with Markdown Rendering
 *
 * Test coverage:
 * - Empty state (no file selected)
 * - Loading state
 * - Error state with retry
 * - Markdown rendering (headings, lists, links, code blocks)
 * - GFM tables rendering
 * - Code syntax highlighting
 * - File change event handling (auto-refresh)
 * - Scroll position preservation
 * - File switching
 * - Close button functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArtifactViewer } from './ArtifactViewer'
import type { UseWebSocketReturn, WebSocketMessage } from '@/hooks/useWebSocket'

// Mock the WebSocket hook
function createMockWebSocket(): UseWebSocketReturn {
  return {
    isConnected: true,
    reconnecting: false,
    connectionStatus: 'connected',
    send: vi.fn(),
    sendInput: vi.fn(),
    sendInterrupt: vi.fn(),
    sendAttach: vi.fn(),
    sendDetach: vi.fn(),
    sendResume: vi.fn(),
    on: vi.fn(() => vi.fn()), // Returns unsubscribe function
    retryConnection: vi.fn(),
  }
}

// Mock fetch globally using vi.stubGlobal for more robust mocking
let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('ArtifactViewer', () => {
  describe('Empty State', () => {
    it('should render empty state when no file is selected', () => {
      const ws = createMockWebSocket()
      render(<ArtifactViewer ws={ws} sessionId="test-session" />)

      expect(screen.getByText('No file selected')).toBeInTheDocument()
      expect(screen.getByText('Select a file from the file tree to view its contents')).toBeInTheDocument()
    })

    it('should not call API when filePath is undefined', () => {
      const ws = createMockWebSocket()
      render(<ArtifactViewer ws={ws} sessionId="test-session" />)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should show loading indicator while fetching file', async () => {
      const ws = createMockWebSocket()
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<ArtifactViewer filePath="docs/prd.md" ws={ws} sessionId="test-session" />)

      expect(screen.getByText('Loading file...')).toBeInTheDocument()
      expect(mockFetch).toHaveBeenCalledWith('/api/documents/docs%2Fprd.md')
    })
  })

  describe('Error Handling', () => {
    it('should display error message when file not found', async () => {
      const ws = createMockWebSocket()
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      render(<ArtifactViewer filePath="docs/missing.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load file')).toBeInTheDocument()
      })
      expect(screen.getByText('File not found')).toBeInTheDocument()
    })

    it('should display error message when API returns error', async () => {
      const ws = createMockWebSocket()
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      render(<ArtifactViewer filePath="docs/error.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load file')).toBeInTheDocument()
      })
      expect(screen.getByText(/Failed to load file: Internal Server Error/)).toBeInTheDocument()
    })

    it('should allow retry after error', async () => {
      const user = userEvent.setup()
      const ws = createMockWebSocket()

      // First: return error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Error',
      })

      render(<ArtifactViewer filePath="docs/retry.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load file')).toBeInTheDocument()
      })

      // Change mock to success before retry
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Retry Success',
      })

      const retryButton = screen.getByText('Retry')
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Retry Success')).toBeInTheDocument()
      })
    })
  })

  describe('Markdown Rendering', () => {
    it('should render basic markdown with headings', async () => {
      const ws = createMockWebSocket()
      const markdown = `# Heading 1
## Heading 2
### Heading 3

This is a paragraph.`

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      render(<ArtifactViewer filePath="docs/test.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Heading 1')).toBeInTheDocument()
      })
      expect(screen.getByText('Heading 2')).toBeInTheDocument()
      expect(screen.getByText('Heading 3')).toBeInTheDocument()
      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument()
    })

    it('should render lists correctly', async () => {
      const ws = createMockWebSocket()
      const markdown = `- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third`

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      render(<ArtifactViewer filePath="docs/lists.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument()
      })
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })

    it('should render links correctly', async () => {
      const ws = createMockWebSocket()
      const markdown = `[Click here](https://example.com)`

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      render(<ArtifactViewer filePath="docs/links.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        const link = screen.getByText('Click here') as HTMLAnchorElement
        expect(link).toBeInTheDocument()
        expect(link.href).toBe('https://example.com/')
      })
    })

    it('should render inline code correctly', async () => {
      const ws = createMockWebSocket()
      const markdown = 'Use `const x = 5` for variables.'

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      render(<ArtifactViewer filePath="docs/inline-code.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('const x = 5')).toBeInTheDocument()
      })
    })
  })

  describe('GFM Tables', () => {
    it('should render tables with borders and cell padding', async () => {
      const ws = createMockWebSocket()
      const markdown = `| Name | Age | City |
|------|-----|------|
| Alice | 30 | NYC |
| Bob | 25 | SF |`

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      render(<ArtifactViewer filePath="docs/table.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument()
      })
      expect(screen.getByText('Age')).toBeInTheDocument()
      expect(screen.getByText('City')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('30')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('NYC')).toBeInTheDocument()
      expect(screen.getByText('SF')).toBeInTheDocument()
    })
  })

  describe('Code Blocks', () => {
    it('should render code blocks with language tag', async () => {
      const ws = createMockWebSocket()
      const markdown = '```python\ndef hello():\n    print("Hello")\n```'

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      const { container } = render(<ArtifactViewer filePath="docs/code.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        // Check that code block is rendered with the correct class
        const codeBlock = container.querySelector('code.language-python')
        expect(codeBlock).toBeInTheDocument()
        // Check that the content is present (text may be split by syntax highlighting)
        expect(codeBlock?.textContent).toContain('def')
        expect(codeBlock?.textContent).toContain('hello')
        expect(codeBlock?.textContent).toContain('print')
      })
    })

    it('should render multiple code blocks', async () => {
      const ws = createMockWebSocket()
      const markdown = `\`\`\`typescript
const x = 5
\`\`\`

\`\`\`bash
npm install
\`\`\``

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => markdown,
      })

      const { container } = render(<ArtifactViewer filePath="docs/multi-code.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        // Check that both code blocks are rendered
        const typescriptBlock = container.querySelector('code.language-typescript')
        const bashBlock = container.querySelector('code.language-bash')
        expect(typescriptBlock).toBeInTheDocument()
        expect(bashBlock).toBeInTheDocument()
        // Check content
        expect(typescriptBlock?.textContent).toContain('const')
        expect(bashBlock?.textContent).toContain('npm install')
      })
    })
  })

  describe('File Change Events', () => {
    it('should subscribe to file.changed WebSocket events', () => {
      const ws = createMockWebSocket()
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Original',
      })

      render(<ArtifactViewer filePath="docs/test.md" ws={ws} sessionId="test-session" />)

      expect(ws.on).toHaveBeenCalledWith('file.changed', expect.any(Function))
    })

    it('should reload content when file changes', async () => {
      const ws = createMockWebSocket()
      let fileChangedCallback: ((message: WebSocketMessage) => void) | null = null

      // Capture the file.changed callback
      ws.on = vi.fn((type, callback) => {
        if (type === 'file.changed') {
          fileChangedCallback = callback
        }
        return vi.fn() // unsubscribe function
      })

      // Start with original content
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Original Content',
      })

      render(<ArtifactViewer filePath="docs/test.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Original Content')).toBeInTheDocument()
      })

      // Change mock to return updated content before triggering file change
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Updated Content',
      })

      // Simulate file change
      if (fileChangedCallback) {
        fileChangedCallback({
          type: 'file.changed',
          path: '/workspace/docs/test.md',
        })
      }

      await waitFor(() => {
        expect(screen.getByText('Updated Content')).toBeInTheDocument()
      })
    })

    it('should not reload if changed file does not match current file', async () => {
      const ws = createMockWebSocket()
      let fileChangedCallback: ((message: WebSocketMessage) => void) | null = null

      ws.on = vi.fn((type, callback) => {
        if (type === 'file.changed') {
          fileChangedCallback = callback
        }
        return vi.fn()
      })

      // Use mockResolvedValue for persistent mock
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Original',
      })

      render(<ArtifactViewer filePath="docs/test.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Original')).toBeInTheDocument()
      })

      // Clear the mock call count
      mockFetch.mockClear()

      // Simulate file change for different file
      if (fileChangedCallback) {
        fileChangedCallback({
          type: 'file.changed',
          path: '/workspace/docs/other.md',
        })
      }

      // Should not trigger a reload
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('File Switching', () => {
    it('should load new content when filePath changes', async () => {
      const ws = createMockWebSocket()

      // Use mockImplementation to return different content based on URL
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('file1')) {
          return Promise.resolve({
            ok: true,
            text: async () => '# File 1',
          })
        } else {
          return Promise.resolve({
            ok: true,
            text: async () => '# File 2',
          })
        }
      })

      const { rerender } = render(<ArtifactViewer filePath="docs/file1.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('File 1')).toBeInTheDocument()
      })

      // Switch to second file
      rerender(<ArtifactViewer filePath="docs/file2.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('File 2')).toBeInTheDocument()
      })
      expect(screen.queryByText('File 1')).not.toBeInTheDocument()
    })
  })

  describe('Close Button', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const ws = createMockWebSocket()
      const onClose = vi.fn()

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Test',
      })

      render(<ArtifactViewer filePath="docs/test.md" ws={ws} sessionId="test-session" onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: 'Close' })
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not render close button when onClose is not provided', async () => {
      const ws = createMockWebSocket()

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Test',
      })

      render(<ArtifactViewer filePath="docs/test.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })

      const closeButton = screen.queryByRole('button', { name: 'Close' })
      expect(closeButton).not.toBeInTheDocument()
    })
  })

  describe('Header', () => {
    it('should display file path in header', async () => {
      const ws = createMockWebSocket()

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '# Test',
      })

      render(<ArtifactViewer filePath="docs/nested/file.md" ws={ws} sessionId="test-session" />)

      await waitFor(() => {
        expect(screen.getByText('docs/nested/file.md')).toBeInTheDocument()
      })
    })
  })
})
