/**
 * FileTree Component
 * Story 3.4: File Tree Component with Workspace Navigation
 *
 * Features:
 * - Hierarchical tree view of workspace files
 * - Folder expand/collapse with state persistence
 * - File selection with highlighting
 * - Real-time updates via WebSocket file.changed messages
 * - Icons: lucide-react folder/file icons
 */

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, FileText, FolderClosed, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { FileTreeNode } from '@/types'

/**
 * FileTree component props
 */
export interface FileTreeProps {
  /** Callback when a file is selected */
  onFileSelect?: (filePath: string) => void
  /** Optional additional CSS classes */
  className?: string
}

/**
 * TreeNode component props (internal recursive component)
 */
interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  selectedFile: string | null
  expandedFolders: Set<string>
  onFileClick: (filePath: string) => void
  onFolderToggle: (folderPath: string) => void
}

/**
 * Recursive TreeNode component
 * Renders a single node (file or directory) and its children
 */
function TreeNode({
  node,
  depth,
  selectedFile,
  expandedFolders,
  onFileClick,
  onFolderToggle,
}: TreeNodeProps) {
  const isDirectory = node.type === 'directory'
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedFile === node.path

  // Handle click on node
  const handleClick = useCallback(() => {
    if (isDirectory) {
      onFolderToggle(node.path)
    } else {
      onFileClick(node.path)
    }
  }, [isDirectory, node.path, onFileClick, onFolderToggle])

  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer select-none',
          'hover:bg-[#4C566A] transition-colors duration-200',
          isSelected && 'bg-[#88C0D0]/20 hover:bg-[#88C0D0]/30',
          'text-[#ECEFF4] text-sm'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        role={isDirectory ? 'button' : 'option'}
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={!isDirectory ? isSelected : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {/* Expand/collapse icon for directories */}
        {isDirectory && (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#81A1C1]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#81A1C1]" />
            )}
          </span>
        )}

        {/* File/folder icon */}
        <span className="flex-shrink-0">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-[#88C0D0]" />
            ) : (
              <FolderClosed className="w-4 h-4 text-[#88C0D0]" />
            )
          ) : (
            <FileText className="w-4 h-4 text-[#81A1C1]" />
          )}
        </span>

        {/* Node name */}
        <span className="truncate flex-1">{node.name}</span>
      </div>

      {/* Children (only rendered if directory is expanded) */}
      {isDirectory && isExpanded && node.children && (
        <div
          className={cn('transition-all duration-350 ease-out')}
          style={{
            maxHeight: isExpanded ? '10000px' : '0',
            overflow: 'hidden',
          }}
        >
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onFileClick={onFileClick}
              onFolderToggle={onFolderToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * FileTree component
 * Main component that fetches and displays the file tree
 */
export function FileTree({ onFileSelect, className }: FileTreeProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const { on } = useWebSocket(
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  )

  // Load file tree (with optional showLoading flag for initial load vs refresh)
  const loadFileTree = useCallback(async (showLoading = false) => {
    try {
      // Only show loading spinner on initial load, not on refreshes
      if (showLoading) {
        setLoading(true)
      }
      setError(null)

      const response = await fetch('/api/documents/tree')
      if (!response.ok) {
        throw new Error(`Failed to fetch file tree: ${response.statusText}`)
      }

      const data = await response.json()
      setTree(data.tree || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Failed to load file tree:', err)
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }, [])

  // Load file tree on mount (with loading spinner)
  useEffect(() => {
    loadFileTree(true) // Show loading spinner only on initial load
  }, [loadFileTree])

  // Subscribe to file.changed WebSocket messages with debouncing
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let pendingRefresh = false

    const unsubscribe = on('file.changed', (message) => {
      // Debounce file changes to avoid excessive refreshes
      // Only log in development to reduce noise
      if (import.meta.env.DEV) {
        console.log('File changed:', message)
      }

      // Mark that we need a refresh
      pendingRefresh = true

      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Set new timer - wait 2 seconds after last change before refreshing
      debounceTimer = setTimeout(() => {
        if (pendingRefresh) {
          loadFileTree(false) // Silent refresh (no loading spinner)
          pendingRefresh = false
        }
      }, 2000)
    })

    return () => {
      unsubscribe()
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [on, loadFileTree])

  // Handle file click
  const handleFileClick = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath)
      if (onFileSelect) {
        onFileSelect(filePath)
      }
    },
    [onFileSelect]
  )

  // Handle folder toggle
  const handleFolderToggle = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }, [])

  // Loading state - only show on initial load, not on background refreshes
  if (loading && isInitialLoad) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-sm text-foreground-secondary">Loading files...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-4 text-center', className)}>
        <p className="text-sm text-red-400 mb-2">Failed to load file tree</p>
        <p className="text-xs text-foreground-secondary mb-4">{error}</p>
        <button
          onClick={() => loadFileTree()}
          className="px-3 py-1 text-xs bg-[#88C0D0] text-[#2E3440] rounded hover:bg-[#81A1C1] transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-4 text-center', className)}>
        <FolderClosed className="w-12 h-12 text-[#4C566A] mb-3" />
        <p className="text-sm text-foreground-secondary">No files found</p>
        <p className="text-xs text-foreground-secondary mt-1">The workspace is empty</p>
      </div>
    )
  }

  // Render tree
  return (
    <div className={cn('h-full overflow-auto', className)} role="tree">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          expandedFolders={expandedFolders}
          onFileClick={handleFileClick}
          onFolderToggle={handleFolderToggle}
        />
      ))}
    </div>
  )
}
