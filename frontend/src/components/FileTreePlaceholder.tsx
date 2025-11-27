/**
 * FileTreePlaceholder Component
 * Temporary placeholder for Story 3.4: File Tree Navigation
 *
 * This component will be replaced by the full FileTree implementation.
 */

import { FileText, Folder } from 'lucide-react'

export function FileTreePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="flex gap-2 mb-4 opacity-50">
        <Folder className="w-8 h-8 text-[#81A1C1]" />
        <FileText className="w-8 h-8 text-[#88C0D0]" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-2">File Tree</h3>
      <p className="text-xs text-foreground-secondary max-w-xs">
        File tree navigation will be implemented in Story 3.4. This view will show your workspace documents in a hierarchical tree structure.
      </p>
    </div>
  )
}
