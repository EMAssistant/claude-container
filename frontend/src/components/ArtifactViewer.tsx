/**
 * ArtifactViewer Component
 * Story 3.5: Artifact Viewer with Markdown Rendering
 * Story 3.7: Diff View for Document Changes
 *
 * Features:
 * - Render markdown with GitHub Flavored Markdown support (tables, task lists, strikethrough)
 * - Syntax highlighting for code blocks with Oceanic Calm theme
 * - Auto-refresh on file changes via WebSocket file.changed events
 * - Scroll position preservation during refresh
 * - File content loading from backend API
 * - Diff view with toggle between current/diff modes
 * - "Updated" badge when file changes detected
 * - localStorage-based "last viewed" tracking for diffs
 */

import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { X, FileText, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { isContentIdentical, calculateDiff, countChanges } from '@/lib/diffUtils'
import type { UseWebSocketReturn } from '@/hooks/useWebSocket'
import '@/styles/highlight-oceanic-calm.css'

/**
 * Story 4.10 AC#8: Lazy load DiffView for code splitting
 * DiffView is only needed when viewing document diffs, not on initial page load
 */
const DiffView = lazy(() => import('@/components/DiffView').then(module => ({ default: module.DiffView })))

/**
 * ArtifactViewer component props
 */
export interface ArtifactViewerProps {
  /** Path to file to display (relative to /workspace) */
  filePath?: string
  /** Callback when user closes viewer */
  onClose?: () => void
  /** WebSocket hook for file.changed events */
  ws: UseWebSocketReturn
  /** Current session ID for diff cache isolation */
  sessionId: string
  /** Optional additional CSS classes */
  className?: string
}

/**
 * ArtifactViewer component
 * Displays rendered markdown files with syntax highlighting and diff view
 */
export function ArtifactViewer({ filePath, onClose, ws, sessionId, className }: ArtifactViewerProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [isUpdated, setIsUpdated] = useState(false)
  const [headContent, setHeadContent] = useState<string | null>(null)
  const [headContentLoading, setHeadContentLoading] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number>(0)

  const { on } = ws

  // Track previous sessionId to detect session changes
  const prevSessionIdRef = useRef<string | undefined>(undefined)

  // Reset state when sessionId changes
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      // Session changed - reset all state
      setContent('')
      setError(null)
      setShowDiff(false)
      setIsUpdated(false)
      setHeadContent(null)
      prevFilePathRef.current = undefined
      prevSessionIdRef.current = sessionId
    }
  }, [sessionId])

  // Load file content from backend
  const loadFileContent = useCallback(async (path: string, isFileChange: boolean = false) => {
    try {
      setLoading(true)
      setError(null)

      // Store current scroll position before refresh
      if (scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop
      }

      // Strip /workspace/ prefix if present - backend expects relative paths
      const relativePath = path.startsWith('/workspace/') ? path.slice('/workspace/'.length) : path
      const response = await fetch(`/api/documents/${encodeURIComponent(relativePath)}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('File not found')
        }
        throw new Error(`Failed to load file: ${response.statusText}`)
      }

      const text = await response.text()

      // If this is a file change event, mark as updated
      if (isFileChange) {
        setIsUpdated(true)
      }

      setContent(text)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Failed to load file content:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Track previous filePath to detect actual changes
  const prevFilePathRef = useRef<string | undefined>(undefined)

  // Load file content when filePath changes
  useEffect(() => {
    if (filePath) {
      loadFileContent(filePath)
      // Only reset states when filePath actually changes, not on every render
      if (prevFilePathRef.current !== filePath) {
        setShowDiff(false)
        setIsUpdated(false)
        setHeadContent(null)
        prevFilePathRef.current = filePath
      }
    } else {
      setContent('')
      setError(null)
      setHeadContent(null)
      prevFilePathRef.current = undefined
    }
  }, [filePath, loadFileContent])

  // Restore scroll position after content loads
  useEffect(() => {
    if (!loading && content && scrollContainerRef.current && scrollPositionRef.current > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current
        }
      })
    }
  }, [loading, content])

  // Subscribe to file.changed WebSocket messages
  useEffect(() => {
    if (!filePath) return

    const unsubscribe = on('file.changed', (message) => {
      // Check if the changed file matches the currently displayed file
      // message.path is absolute (e.g., /workspace/docs/test.md)
      // filePath is relative to /workspace (e.g., docs/test.md)
      const messagePath = (message as any).path
      if (messagePath && typeof messagePath === 'string') {
        // Precise path matching: strip /workspace/ prefix and compare exactly
        const normalizedMessagePath = messagePath.replace(/^\/workspace\//, '')
        if (normalizedMessagePath === filePath || messagePath.endsWith(`/${filePath}`)) {
          if (import.meta.env.DEV) {
            console.log('File changed, reloading:', filePath)
          }
          loadFileContent(filePath, true) // Mark as file change event
        }
      }
    })

    return unsubscribe
  }, [filePath, on, loadFileContent])

  // Fetch file content at HEAD for Git diff
  const fetchHeadContent = useCallback(async (path: string) => {
    if (!sessionId) return

    try {
      setHeadContentLoading(true)
      // Strip /workspace/ prefix if present - backend expects relative paths
      const relativePath = path.startsWith('/workspace/') ? path.slice('/workspace/'.length) : path
      const response = await fetch(`/api/sessions/${sessionId}/git/show/${encodeURIComponent(relativePath)}`)

      if (!response.ok) {
        console.error('Failed to fetch HEAD content:', response.statusText)
        setHeadContent(null)
        return
      }

      const data = await response.json()
      setHeadContent(data.content)
    } catch (err) {
      console.error('Failed to fetch HEAD content:', err)
      setHeadContent(null)
    } finally {
      setHeadContentLoading(false)
    }
  }, [sessionId])

  // Toggle diff view
  const handleToggleDiff = useCallback(async () => {
    if (!showDiff && filePath) {
      // Turning on diff view - fetch HEAD content
      await fetchHeadContent(filePath)
    }
    setShowDiff((prev) => !prev)
    setIsUpdated(false) // Clear update badge when viewing diff
  }, [showDiff, filePath, fetchHeadContent])

  // Calculate diff stats for header display
  const diffStats = useMemo(() => {
    if (!showDiff || headContent === null || isContentIdentical(headContent, content)) {
      return null
    }
    const changes = calculateDiff(headContent, content)
    return countChanges(changes)
  }, [showDiff, headContent, content])

  // Empty state - no file selected
  if (!filePath) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-8 text-center', className)}>
        <FileText className="w-16 h-16 text-[#4C566A] mb-4" />
        <p className="text-lg text-[#D8DEE9] mb-2">No file selected</p>
        <p className="text-sm text-[#616E88]">
          Select a file from the file tree to view its contents
        </p>
      </div>
    )
  }

  // Loading state
  if (loading && !content) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-8', className)}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88C0D0]"></div>
        <p className="text-sm text-[#D8DEE9] mt-4">Loading file...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        {/* Header with close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#4C566A] bg-[#3B4252]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="w-4 h-4 text-[#81A1C1] flex-shrink-0" />
            <span className="text-sm text-[#D8DEE9] truncate">{filePath}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 p-1 rounded hover:bg-[#4C566A] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[#D8DEE9]" />
            </button>
          )}
        </div>

        {/* Error content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[#BF616A] mb-4" />
          <p className="text-lg text-[#D8DEE9] mb-2">Failed to load file</p>
          <p className="text-sm text-[#616E88] mb-4">{error}</p>
          <button
            onClick={() => filePath && loadFileContent(filePath)}
            className="px-4 py-2 text-sm bg-[#88C0D0] text-[#2E3440] rounded hover:bg-[#81A1C1] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Main content view
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with file name, diff stats, toggle, badge, and close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#4C566A] bg-[#3B4252]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-[#81A1C1] flex-shrink-0" />
          <span className="text-sm text-[#D8DEE9] truncate" title={filePath}>
            {filePath}
          </span>

          {/* Diff stats - show when in diff mode with actual changes */}
          {diffStats && (
            <div className="flex items-center gap-2 ml-2 text-xs">
              {diffStats.additions > 0 && (
                <span className="text-[#A3BE8C]">+{diffStats.additions}</span>
              )}
              {diffStats.deletions > 0 && (
                <span className="text-[#BF616A]">-{diffStats.deletions}</span>
              )}
            </div>
          )}

          {/* Updated badge */}
          {isUpdated && !showDiff && (
            <Badge
              variant="default"
              className="bg-[#88C0D0] text-[#2E3440] hover:bg-[#81A1C1] ml-2 animate-pulse"
            >
              Updated
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 ml-2">
          {/* Diff toggle button - always show to allow checking Git diff */}
          <button
            onClick={handleToggleDiff}
            disabled={headContentLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#4C566A] text-[#D8DEE9] rounded hover:bg-[#434C5E] transition-colors disabled:opacity-50"
            aria-label={showDiff ? "Show Current" : "Show Diff"}
          >
            {headContentLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </>
            ) : showDiff ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                Show Current
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Show Diff
              </>
            )}
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#4C566A] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[#D8DEE9]" />
            </button>
          )}
        </div>
      </div>

      {/* Content - either diff view or markdown view */}
      {showDiff ? (
        headContent === null ? (
          /* New file - no HEAD content to compare */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#2E3440] p-8 text-center">
            <FileText className="w-12 h-12 text-[#A3BE8C] mb-4" />
            <p className="text-lg text-[#D8DEE9] mb-2">New file</p>
            <p className="text-sm text-[#616E88]">
              This file does not exist in the last commit (HEAD).
            </p>
          </div>
        ) : isContentIdentical(headContent, content) ? (
          /* No changes detected */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#2E3440] p-8 text-center">
            <FileText className="w-12 h-12 text-[#88C0D0] mb-4" />
            <p className="text-lg text-[#D8DEE9] mb-2">No changes</p>
            <p className="text-sm text-[#616E88]">
              This file is identical to the last commit (HEAD).
            </p>
          </div>
        ) : (
          /* Diff view - lazy loaded with Suspense */
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center bg-[#2E3440]">
              <div className="text-[#D8DEE9]">Loading diff view...</div>
            </div>
          }>
            <DiffView
              oldContent={headContent}
              newContent={content}
              fileName={filePath}
              showLineNumbers={true}
              contextLines={3}
              hideHeader={true}
            />
          </Suspense>
        )
      ) : (
        /* Normal markdown view */
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto p-6 bg-[#2E3440]"
        >
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Custom styling for markdown elements
                h1: ({ node, ...props }) => (
                  <h1 className="text-3xl font-bold text-[#ECEFF4] mb-4 mt-6 first:mt-0" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-2xl font-bold text-[#ECEFF4] mb-3 mt-5" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-xl font-bold text-[#ECEFF4] mb-2 mt-4" {...props} />
                ),
                h4: ({ node, ...props }) => (
                  <h4 className="text-lg font-semibold text-[#ECEFF4] mb-2 mt-3" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="text-[#D8DEE9] mb-4 leading-relaxed" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside text-[#D8DEE9] mb-4 space-y-1" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside text-[#D8DEE9] mb-4 space-y-1" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="text-[#D8DEE9] ml-4" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="text-[#88C0D0] hover:text-[#81A1C1] underline" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-[#88C0D0] pl-4 py-2 mb-4 text-[#D8DEE9] italic bg-[#3B4252]" {...props} />
                ),
                code: ({ node, ...props }: any) => {
                  const inline = props.inline
                  return inline ? (
                    <code className="bg-[#3B4252] text-[#EBCB8B] px-1.5 py-0.5 rounded text-sm" {...props} />
                  ) : (
                    <code {...props} />
                  )
                },
                pre: ({ node, ...props }) => (
                  <pre className="mb-4 rounded-md overflow-x-auto" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full border-collapse border border-[#4C566A]" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-[#3B4252]" {...props} />
                ),
                tbody: ({ node, ...props }) => (
                  <tbody {...props} />
                ),
                tr: ({ node, ...props }) => (
                  <tr className="border-b border-[#4C566A]" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-[#4C566A] px-4 py-2 text-left text-[#ECEFF4] font-semibold" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-[#4C566A] px-4 py-2 text-[#D8DEE9]" {...props} />
                ),
                hr: ({ node, ...props }) => (
                  <hr className="border-t border-[#4C566A] my-6" {...props} />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
