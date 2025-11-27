/**
 * PhaseOverview Component - Collapsible BMAD Phase Display
 * Story 6.6: Collapsible Phase Overview
 *
 * Displays BMAD workflow phases (Discovery, Planning, Solutioning) as collapsible
 * sections above the Implementation phase (current epic from SprintTracker).
 *
 * Features:
 * - Phases shown as collapsible headers with completion status
 * - Steps shown with status icons and artifacts
 * - Skipped steps shown with strikethrough
 * - Implementation section shows current epic expanded by default
 * - Collapse state persists to localStorage
 */

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflow } from '@/context/WorkflowContext'
import { useSprint } from '@/context/SprintContext'
import { SprintTracker } from '@/components/SprintTracker'
import { useLayout } from '@/context/LayoutContext'
import type { WorkflowStep } from '@/types'

// localStorage key for collapse state
const STORAGE_KEY = 'sprintTrackerCollapsedSections'

// Phase definitions with step mappings
interface PhaseDefinition {
  id: string
  name: string
  steps: string[] // Step names that belong to this phase
}

const PHASES: PhaseDefinition[] = [
  {
    id: 'discovery',
    name: 'Discovery',
    // Step IDs must match workflow data (hyphenated format)
    steps: ['brainstorm-project', 'research', 'product-brief'],
  },
  {
    id: 'planning',
    name: 'Planning',
    steps: ['prd', 'validate-prd', 'create-design'],
  },
  {
    id: 'solutioning',
    name: 'Solutioning',
    steps: ['create-architecture', 'create-epics-and-stories', 'test-design', 'validate-architecture', 'implementation-readiness'],
  },
]

/**
 * Extract display name from file path
 * e.g., "docs/brainstorming-session-results-2025-11-23.md" -> "brainstorming-session-results-2025-11-23.md"
 */
function getFileNameFromPath(filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

/**
 * Status icon configuration
 */
const STATUS_CONFIG = {
  completed: { icon: '✓', color: 'text-success' },
  in_progress: { icon: '→', color: 'text-primary' },
  pending: { icon: '○', color: 'text-foreground-secondary' },
  skipped: { icon: '⊘', color: 'text-muted' },
} as const

/**
 * Load collapsed sections from localStorage
 */
function loadCollapsedSections(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return new Set(parsed)
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  // Default: discovery, planning, solutioning collapsed; implementation expanded
  return new Set(['discovery', 'planning', 'solutioning'])
}

/**
 * Save collapsed sections to localStorage
 */
function saveCollapsedSections(collapsed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Format step name to human-readable display name
 */
function formatStepName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * PhaseStep - Individual step within a phase
 */
interface PhaseStepProps {
  step: WorkflowStep
  isLast: boolean
}

function PhaseStep({ step, isLast }: PhaseStepProps) {
  const { setSelectedFile, setMainContentMode } = useLayout()
  const { activeSessionId } = useSprint()
  const config = STATUS_CONFIG[step.status]
  const isSkipped = step.status === 'skipped'

  // Get artifact paths from step data (from YAML)
  const artifactPaths = step.artifactPaths || []

  const handleViewArtifact = (path: string) => {
    setSelectedFile(activeSessionId, path)
    setMainContentMode('artifact')
  }

  return (
    <div className="ml-4 relative">
      {/* Tree connector line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
      {!isLast && (
        <div className="absolute left-0 top-3 w-3 h-px bg-border" />
      )}
      {isLast && (
        <div className="absolute left-0 top-0 h-3 w-px bg-border" />
      )}
      {isLast && (
        <div className="absolute left-0 top-3 w-3 h-px bg-border" />
      )}

      {/* Step content */}
      <div className="pl-5 py-1">
        <div className="flex items-center gap-2">
          <span className={cn('flex-shrink-0', config.color)}>{config.icon}</span>
          <span
            className={cn(
              'text-sm',
              isSkipped
                ? 'text-muted line-through'
                : 'text-foreground'
            )}
          >
            {step.displayName || formatStepName(step.name)}
          </span>
        </div>

        {/* Artifacts under step - show actual file names from YAML */}
        {artifactPaths.length > 0 && !isSkipped && step.status === 'completed' && (
          <div className="ml-6 mt-1 space-y-0.5">
            {artifactPaths.map((artifactPath, idx) => (
              <div
                key={artifactPath}
                className="flex items-center gap-2 text-xs group"
              >
                <span className="text-muted">
                  {idx === artifactPaths.length - 1 ? '└─' : '├─'}
                </span>
                <span>📄</span>
                <button
                  onClick={() => handleViewArtifact(artifactPath)}
                  className="text-foreground-secondary hover:text-primary hover:underline flex-1 truncate text-left cursor-pointer"
                >
                  {getFileNameFromPath(artifactPath)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * PhaseHeader - Collapsible phase section header
 */
interface PhaseHeaderProps {
  phase: PhaseDefinition
  steps: WorkflowStep[]
  isCollapsed: boolean
  onToggle: () => void
}

function PhaseHeader({ phase, steps, isCollapsed, onToggle }: PhaseHeaderProps) {
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const skippedCount = steps.filter((s) => s.status === 'skipped').length
  const totalCount = steps.length - skippedCount
  const isComplete = completedCount >= totalCount && totalCount > 0

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors',
        isCollapsed ? '' : 'bg-muted/50'
      )}
      aria-expanded={!isCollapsed}
    >
      {isCollapsed ? (
        <ChevronRight className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
      ) : (
        <ChevronDown className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
      )}
      <span
        className={cn(
          'font-medium text-sm',
          isComplete ? 'text-success' : 'text-foreground'
        )}
      >
        {isComplete && <span className="mr-1">✓</span>}
        {phase.name}
      </span>
      <span className="text-xs text-foreground-secondary">
        ({completedCount}/{totalCount})
      </span>
    </button>
  )
}

/**
 * PhaseSection - A collapsible phase with steps
 */
interface PhaseSectionProps {
  phase: PhaseDefinition
  steps: WorkflowStep[]
  isCollapsed: boolean
  onToggle: () => void
}

function PhaseSection({ phase, steps, isCollapsed, onToggle }: PhaseSectionProps) {
  return (
    <div className="border-b border-border">
      <PhaseHeader
        phase={phase}
        steps={steps}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
      />
      {!isCollapsed && (
        <div className="pb-2">
          {steps.length === 0 ? (
            <div className="ml-4 pl-5 py-1 text-sm text-foreground-secondary italic">
              No steps yet
            </div>
          ) : (
            steps.map((step, idx) => (
              <PhaseStep key={step.name} step={step} isLast={idx === steps.length - 1} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ImplementationSection - Shows current epic from SprintTracker
 */
interface ImplementationSectionProps {
  isCollapsed: boolean
  onToggle: () => void
}

function ImplementationSection({ isCollapsed, onToggle }: ImplementationSectionProps) {
  const { sprintStatus } = useSprint()

  const epicData = sprintStatus?.epics.find((e) => e.epicNumber === sprintStatus.currentEpic)
  const storiesInEpic = sprintStatus?.stories.filter((s) => s.epicNumber === sprintStatus?.currentEpic) || []
  const completedCount = storiesInEpic.filter((s) => s.status === 'done').length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Implementation header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors border-b border-border',
          isCollapsed ? '' : 'bg-primary/10'
        )}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
        )}
        <span className="font-medium text-sm text-foreground">
          Implementation
          {epicData && ` - Epic ${epicData.epicNumber}`}
        </span>

        {/* Story count */}
        {epicData && (
          <span className="text-xs text-foreground-secondary ml-auto">
            ({completedCount}/{storiesInEpic.length})
          </span>
        )}
      </button>

      {/* SprintTracker content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden">
          <SprintTracker />
        </div>
      )}
    </div>
  )
}

/**
 * PhaseOverview Component - Main export
 * Story 6.6: Collapsible Phase Overview
 */
export function PhaseOverview() {
  const { workflowState } = useWorkflow()
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() =>
    loadCollapsedSections()
  )

  /**
   * Toggle section collapse state
   */
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      saveCollapsedSections(next)
      return next
    })
  }, [])

  /**
   * Group workflow steps by phase
   */
  const phaseSteps = useMemo(() => {
    if (!workflowState?.steps) return new Map<string, WorkflowStep[]>()

    const stepMap = new Map<string, WorkflowStep[]>()
    PHASES.forEach((phase) => stepMap.set(phase.id, []))

    workflowState.steps.forEach((step) => {
      for (const phase of PHASES) {
        if (phase.steps.includes(step.name)) {
          stepMap.get(phase.id)?.push(step)
          break
        }
      }
    })

    return stepMap
  }, [workflowState?.steps])

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">
      {/* Workflow phases (Discovery, Planning, Solutioning) */}
      <div className="flex-shrink-0">
        {PHASES.map((phase) => {
          const steps = phaseSteps.get(phase.id) || []
          return (
            <PhaseSection
              key={phase.id}
              phase={phase}
              steps={steps}
              isCollapsed={collapsedSections.has(phase.id)}
              onToggle={() => toggleSection(phase.id)}
            />
          )
        })}
      </div>

      {/* Implementation section with SprintTracker */}
      <ImplementationSection
        isCollapsed={collapsedSections.has('implementation')}
        onToggle={() => toggleSection('implementation')}
      />
    </div>
  )
}
