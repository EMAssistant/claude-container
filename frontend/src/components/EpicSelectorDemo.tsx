/**
 * EpicSelectorDemo Component
 * Story 6.7: Epic Navigation and Selection
 *
 * Demo component showing EpicSelector functionality
 * This will be integrated into SprintTracker component in Story 6.3
 *
 * For now, this serves as a standalone demonstration of the EpicSelector
 * component with mock epic data.
 */

import { useState } from 'react'
import { EpicSelector } from './EpicSelector'
import type { EpicData } from '@/types'
import { loadSelectedEpic, saveSelectedEpic } from '@/lib/utils'

// Mock epic data for demonstration
const MOCK_EPICS: EpicData[] = [
  {
    epicNumber: 1,
    epicKey: 'epic-1',
    status: 'contexted',
    retrospective: 'completed',
    title: 'Foundation',
    storyCount: 12,
    completedCount: 12,
    artifacts: [],
  },
  {
    epicNumber: 2,
    epicKey: 'epic-2',
    status: 'contexted',
    retrospective: 'completed',
    title: 'Multi-Session',
    storyCount: 12,
    completedCount: 12,
    artifacts: [],
  },
  {
    epicNumber: 3,
    epicKey: 'epic-3',
    status: 'contexted',
    retrospective: 'completed',
    title: 'Workflow Visibility',
    storyCount: 12,
    completedCount: 12,
    artifacts: [],
  },
  {
    epicNumber: 4,
    epicKey: 'epic-4',
    status: 'contexted',
    retrospective: 'optional',
    title: 'Production Stability',
    storyCount: 19,
    completedCount: 15,
    artifacts: [],
  },
  {
    epicNumber: 5,
    epicKey: 'epic-5',
    status: 'backlog',
    retrospective: null,
    title: 'Git Integration',
    storyCount: 11,
    completedCount: 0,
    artifacts: [],
  },
  {
    epicNumber: 6,
    epicKey: 'epic-6',
    status: 'contexted',
    retrospective: 'optional',
    title: 'Interactive Workflow Tracker',
    storyCount: 10,
    completedCount: 6,
    artifacts: [],
  },
]

/**
 * Demo component showing EpicSelector in action
 */
export function EpicSelectorDemo() {
  // Load selected epic from localStorage, default to current epic (4)
  const [selectedEpicNumber, setSelectedEpicNumber] = useState<number>(() => {
    return loadSelectedEpic() ?? 4
  })

  const handleEpicSelect = (epicNumber: number) => {
    setSelectedEpicNumber(epicNumber)
    saveSelectedEpic(epicNumber)
  }

  const selectedEpic = MOCK_EPICS.find((e) => e.epicNumber === selectedEpicNumber)

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header with epic selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Implementation -</span>
          <EpicSelector
            epics={MOCK_EPICS}
            selectedEpicNumber={selectedEpicNumber}
            onEpicSelect={handleEpicSelect}
          />
        </div>
        <span className="text-xs text-foreground-secondary">
          ({selectedEpic?.completedCount}/{selectedEpic?.storyCount})
        </span>
      </div>

      {/* Selected epic info */}
      {selectedEpic && (
        <div className="p-3 bg-[#434C5E] rounded-lg">
          <div className="text-sm font-medium text-foreground mb-1">
            Epic {selectedEpic.epicNumber}: {selectedEpic.title}
          </div>
          <div className="text-xs text-foreground-secondary">
            Status: {selectedEpic.status} | Progress: {selectedEpic.completedCount}/
            {selectedEpic.storyCount} stories
          </div>
        </div>
      )}

      {/* Placeholder for story list */}
      <div className="flex-1 p-3 bg-[#3B4252] rounded-lg">
        <div className="text-xs text-foreground-secondary">
          Story list for Epic {selectedEpicNumber} will appear here
          <br />
          (Implemented in Story 6.3: Sprint Tracker Component)
        </div>
      </div>
    </div>
  )
}
