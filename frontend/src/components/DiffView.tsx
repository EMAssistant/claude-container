/**
 * DiffView Component
 * Story 3.7: Diff View for Document Changes
 *
 * Features:
 * - Line-by-line diff visualization with color coding
 * - Deleted lines: Red background (#BF616A 20% opacity) with strikethrough
 * - Added lines: Green background (#A3BE8C 20% opacity)
 * - Unchanged lines: Normal rendering for context
 * - Optional line numbers for navigation
 * - Context preservation (3 lines before/after changes)
 */

import { useMemo } from 'react'
import { FileText, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateDiff,
  groupDiffBlocks,
  countChanges,
  type DiffChange,
  type DiffBlock,
} from '@/lib/diffUtils'

/**
 * DiffView component props
 */
export interface DiffViewProps {
  /** Original content (last viewed) */
  oldContent: string
  /** Updated content (current) */
  newContent: string
  /** File name for display */
  fileName: string
  /** Whether to show line numbers (default: true) */
  showLineNumbers?: boolean
  /** Number of context lines to show (default: 3) */
  contextLines?: number
  /** Whether to hide the header (default: false) */
  hideHeader?: boolean
  /** Optional additional CSS classes */
  className?: string
}

/**
 * DiffLine component - renders a single line in the diff
 */
function DiffLine({
  change,
  showLineNumbers,
}: {
  change: DiffChange
  showLineNumbers: boolean
}) {
  const lineClasses = cn(
    'flex items-start font-mono text-sm leading-relaxed',
    change.type === 'add' && 'bg-[#A3BE8C]/20',
    change.type === 'delete' && 'bg-[#BF616A]/20'
  )

  const textClasses = cn(
    'flex-1 px-4 py-1 whitespace-pre-wrap break-words',
    change.type === 'delete' && 'line-through text-[#D8DEE9]/70',
    change.type === 'add' && 'text-[#D8DEE9]',
    change.type === 'unchanged' && 'text-[#D8DEE9]/80'
  )

  const lineNumberClasses = cn(
    'flex-shrink-0 w-12 px-2 py-1 text-right text-[#4C566A] select-none',
    change.type === 'add' && 'bg-[#A3BE8C]/10',
    change.type === 'delete' && 'bg-[#BF616A]/10'
  )

  return (
    <div className={lineClasses}>
      {showLineNumbers && (
        <div className={lineNumberClasses}>
          {change.type !== 'delete' ? change.lineNumber : ''}
        </div>
      )}
      <div className={textClasses}>{change.line || ' '}</div>
    </div>
  )
}

/**
 * DiffBlockSeparator component - shows collapsed unchanged lines
 */
function DiffBlockSeparator({ lineCount }: { lineCount: number }) {
  return (
    <div className="flex items-center justify-center py-2 bg-[#3B4252] border-y border-[#4C566A]">
      <div className="text-xs text-[#616E88] font-mono">
        <Info className="inline w-3 h-3 mr-1" />
        {lineCount} unchanged line{lineCount !== 1 ? 's' : ''} hidden
      </div>
    </div>
  )
}

/**
 * DiffBlock component - renders a block of changes with context
 */
function DiffBlockComponent({
  block,
  showLineNumbers,
}: {
  block: DiffBlock
  showLineNumbers: boolean
}) {
  return (
    <div className="border-b border-[#4C566A] last:border-b-0">
      {block.changes.map((change, index) => (
        <DiffLine
          key={`${change.lineNumber}-${index}`}
          change={change}
          showLineNumbers={showLineNumbers}
        />
      ))}
    </div>
  )
}

/**
 * DiffView component
 * Displays line-by-line diff between old and new content
 */
export function DiffView({
  oldContent,
  newContent,
  fileName,
  showLineNumbers = true,
  contextLines = 3,
  hideHeader = false,
  className,
}: DiffViewProps) {
  // Calculate diff and group into blocks
  const { blocks, stats } = useMemo(() => {
    const changes = calculateDiff(oldContent, newContent)
    const blocks = groupDiffBlocks(changes, contextLines)
    const stats = countChanges(changes)
    return { blocks, stats }
  }, [oldContent, newContent, contextLines])

  // Check if there are no changes
  const hasNoChanges = stats.additions === 0 && stats.deletions === 0

  return (
    <div className={cn('flex flex-col h-full bg-[#2E3440]', className)}>
      {/* Diff Stats Header - only show if not hidden */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#3B4252] border-b border-[#4C566A]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#81A1C1]" />
            <span className="text-sm text-[#D8DEE9] font-medium">Diff View</span>
            <span className="text-xs text-[#616E88]">{fileName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {stats.additions > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[#A3BE8C]">+{stats.additions}</span>
                <span className="text-[#616E88]">additions</span>
              </div>
            )}
            {stats.deletions > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[#BF616A]">-{stats.deletions}</span>
                <span className="text-[#616E88]">deletions</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No changes state */}
      {hasNoChanges ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Info className="w-12 h-12 text-[#88C0D0] mb-4" />
          <p className="text-lg text-[#D8DEE9] mb-2">No changes detected</p>
          <p className="text-sm text-[#616E88]">
            The document content is identical to the last viewed version
          </p>
        </div>
      ) : (
        /* Diff content */
        <div className="flex-1 overflow-auto">
          {blocks.map((block, blockIndex) => {
            const nextBlock = blocks[blockIndex + 1]
            const hasGap = nextBlock && nextBlock.startLine - block.endLine > 1

            return (
              <div key={`block-${blockIndex}`}>
                <DiffBlockComponent block={block} showLineNumbers={showLineNumbers} />
                {hasGap && (
                  <DiffBlockSeparator
                    lineCount={nextBlock.startLine - block.endLine - 1}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      {!hasNoChanges && (
        <div className="flex items-center gap-4 px-4 py-2 bg-[#3B4252] border-t border-[#4C566A] text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#A3BE8C]/20 border border-[#A3BE8C]/40 rounded"></div>
            <span className="text-[#D8DEE9]">Added</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#BF616A]/20 border border-[#BF616A]/40 rounded"></div>
            <span className="text-[#D8DEE9]">Deleted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#2E3440] border border-[#4C566A] rounded"></div>
            <span className="text-[#D8DEE9]">Unchanged (context)</span>
          </div>
        </div>
      )}
    </div>
  )
}
