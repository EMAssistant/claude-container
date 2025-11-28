/**
 * WorkflowDiagram Component
 * Full swim lane diagram view for the main content area
 *
 * Features:
 * - 4-phase swim lane diagram: Discovery, Planning, Solutioning, Implementation
 * - Flow diagram within each phase column
 * - Role-based color coding (Analyst=cyan, PM=green, UX=purple, Architect=orange, etc.)
 * - Status indicators with visual completion states
 * - Connecting arrows between workflow steps
 * - Decision diamonds for conditional flows
 */

import { useWorkflow } from '@/context/WorkflowContext'
import { useLayout } from '@/context/LayoutContext'
import { GitBranch, Check, ArrowRight, Circle, ArrowDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRef, useState, useEffect, useCallback } from 'react'

// Phase definitions matching BMAD Method greenfield workflow
const PHASES = [
  {
    id: 'discovery',
    name: 'Discovery',
    subtitle: '(Optional)',
    color: '#b2ebf2',
    bgColor: 'bg-cyan-950/30',
    borderColor: 'border-cyan-700/50',
    headerBg: 'bg-cyan-900/50',
  },
  {
    id: 'planning',
    name: 'Planning',
    subtitle: '',
    color: '#c8e6c9',
    bgColor: 'bg-green-950/30',
    borderColor: 'border-green-700/50',
    headerBg: 'bg-green-900/50',
  },
  {
    id: 'solutioning',
    name: 'Solutioning',
    subtitle: '',
    color: '#ffccbc',
    bgColor: 'bg-orange-950/30',
    borderColor: 'border-orange-700/50',
    headerBg: 'bg-orange-900/50',
  },
  {
    id: 'implementation',
    name: 'Implementation',
    subtitle: '',
    color: '#bbdefb',
    bgColor: 'bg-blue-950/30',
    borderColor: 'border-blue-700/50',
    headerBg: 'bg-blue-900/50',
  },
] as const

// Role color definitions
const ROLE_COLORS = {
  Analyst: { color: '#00acc1', bg: 'bg-cyan-900/50' },
  PM: { color: '#66bb6a', bg: 'bg-green-900/50' },
  'UX Designer': { color: '#ab47bc', bg: 'bg-purple-900/50' },
  Architect: { color: '#ff7043', bg: 'bg-orange-900/50' },
  TEA: { color: '#f06292', bg: 'bg-pink-900/50' },
  SM: { color: '#42a5f5', bg: 'bg-blue-900/50' },
  Dev: { color: '#7e57c2', bg: 'bg-violet-900/50' },
} as const

type RoleName = keyof typeof ROLE_COLORS

interface WorkflowStepDef {
  id: string
  name: string
  role: RoleName
  optional?: boolean
  optionalLabel?: string // Custom label instead of "(optional)"
  isDecision?: boolean
  decisionLabel?: string
  isEnd?: boolean // For terminal "End" node
}

// Workflow steps organized by phase with role colors
const WORKFLOW_STEPS: Record<string, WorkflowStepDef[]> = {
  discovery: [
    { id: 'brainstorm-project', name: 'Brainstorm', role: 'Analyst', optional: true },
    { id: 'research', name: 'Research', role: 'Analyst', optional: true },
    { id: 'product-brief', name: 'Product Brief', role: 'Analyst', optional: true },
  ],
  planning: [
    { id: 'prd', name: 'PRD Creation', role: 'PM' },
    { id: 'validate-prd', name: 'Validate PRD', role: 'PM', optional: true },
    { id: 'has-ui-decision', name: 'Has UI?', role: 'PM', isDecision: true },
    { id: 'create-design', name: 'UX Design', role: 'UX Designer' },
  ],
  solutioning: [
    { id: 'create-architecture', name: 'Architecture', role: 'Architect' },
    { id: 'validate-architecture', name: 'Validate Arch', role: 'Architect', optional: true },
    { id: 'create-epics-and-stories', name: 'Epics & Stories', role: 'PM' },
    { id: 'test-design', name: 'Test Design', role: 'TEA' },
    { id: 'implementation-readiness', name: 'Impl. Readiness', role: 'Architect' },
  ],
  implementation: [
    { id: 'sprint-planning', name: 'Sprint Planning', role: 'SM' },
    { id: 'create-story', name: 'Create Story', role: 'SM' },
    { id: 'validate-story', name: 'Validate Story', role: 'SM', optional: true },
    { id: 'develop-story', name: 'Develop Story', role: 'Dev' },
    { id: 'code-review', name: 'Code Review', role: 'Dev', optional: true, optionalLabel: 'use different llm' },
    { id: 'code-review-pass', name: 'Code Review\nPass?', role: 'Dev', isDecision: true },
    { id: 'more-stories', name: 'More stories\nin epic?', role: 'SM', isDecision: true },
    { id: 'retrospective', name: 'Retrospective', role: 'SM' },
    { id: 'more-epics', name: 'More\nEpics?', role: 'SM', isDecision: true },
    { id: 'end', name: 'End', role: 'SM', isEnd: true },
  ],
}

type StepStatus = 'completed' | 'in_progress' | 'pending' | 'skipped'

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <Check className="w-4 h-4" />
    case 'skipped':
      return <span className="text-sm font-medium">—</span>
    case 'in_progress':
      return <ArrowRight className="w-4 h-4" />
    case 'pending':
      return <Circle className="w-4 h-4" />
  }
}

function getStatusStyles(status: StepStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'completed':
      return { border: 'border-green-500', bg: 'bg-green-500/20', text: 'text-green-400' }
    case 'skipped':
      return { border: 'border-gray-500', bg: 'bg-gray-500/20', text: 'text-gray-400' }
    case 'in_progress':
      return { border: 'border-cyan-400 border-[5px]', bg: 'bg-cyan-500/20', text: 'text-cyan-400' }
    case 'pending':
      return { border: 'border-gray-600', bg: 'bg-gray-800/50', text: 'text-gray-500' }
  }
}

interface WorkflowStepProps {
  step: WorkflowStepDef
  status: StepStatus
  showArrow: boolean
  arrowLabel?: string
  stepRef?: React.RefObject<HTMLDivElement | null>
}

// Decision diamond component - wider to match box width
function DecisionDiamond({ step, status, stepRef, showArrow }: { step: WorkflowStepDef; status: StepStatus; stepRef?: React.RefObject<HTMLDivElement | null>; showArrow?: boolean }) {
  const styles = getStatusStyles(status)

  // Determine branch labels and layout based on step type
  // Implementation loop decisions have the "negative" path going LEFT, not right
  const isLoopDecision = ['code-review-pass', 'more-stories', 'more-epics'].includes(step.id)

  const getBranchLabels = () => {
    if (step.id === 'code-review-pass') {
      return { down: 'Pass', other: 'Fail' }
    }
    return { down: 'Yes', other: 'No' }
  }
  const labels = getBranchLabels()

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative flex flex-col items-center w-full max-w-[120px]">
        <div
          ref={stepRef}
          data-step-id={step.id}
          className={cn(
            'relative border-2 flex items-center justify-center transition-all duration-200 w-full',
            styles.border,
            styles.bg,
            status === 'in_progress' && 'ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20'
          )}
          style={{
            aspectRatio: '2 / 1',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          }}
        >
          <div className={cn('text-[10px] font-semibold text-center whitespace-pre-line leading-tight', styles.text)}>
            {step.name}
          </div>
        </div>
        {/* Branch label for "Yes/Pass" is now rendered with the arrow below */}
        {/* Branch label for "No/Fail" (horizontal path) - sits above the line */}
        <span className={cn(
          "absolute top-1/2 -translate-y-full -mt-1 text-[11px] font-medium text-gray-400",
          isLoopDecision ? "-left-4" : "-right-1"
        )}>{labels.other}</span>
      </div>

      {/* Connector arrow with stem - same as regular boxes */}
      {showArrow && (
        <div className="pt-1 text-gray-500 flex flex-col items-center relative">
          {/* Vertical stem line */}
          <div className="w-0.5 h-4 bg-gray-500" />
          <ArrowDown className="w-4 h-4 -mt-1" />
          {/* Yes/Pass label - left of arrow, vertically centered */}
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-1 text-[11px] font-medium text-green-400">
            {labels.down}
          </span>
        </div>
      )}
    </div>
  )
}

// End node component - oval shape
function EndNode({ step, status, stepRef }: { step: WorkflowStepDef; status: StepStatus; stepRef?: React.RefObject<HTMLDivElement | null> }) {
  const styles = getStatusStyles(status)

  return (
    <div className="flex flex-col items-center">
      <div
        ref={stepRef}
        data-step-id={step.id}
        className={cn(
          'px-6 py-2 rounded-full border-2 text-center transition-all duration-200',
          styles.border,
          styles.bg,
          status === 'in_progress' && 'ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20'
        )}
      >
        <div className={cn('text-xs font-semibold', styles.text)}>
          {step.name}
        </div>
      </div>
    </div>
  )
}

function WorkflowStep({ step, status, showArrow, arrowLabel, stepRef }: WorkflowStepProps) {
  const styles = getStatusStyles(status)
  const isSkipped = status === 'skipped'
  const roleColors = ROLE_COLORS[step.role]

  // Render decision diamond
  if (step.isDecision) {
    return <DecisionDiamond step={step} status={status} stepRef={stepRef} showArrow={showArrow} />
  }

  // Render end oval
  if (step.isEnd) {
    return <EndNode step={step} status={status} stepRef={stepRef} />
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Step box - constrained width for breathing room */}
      <div
        ref={stepRef}
        data-step-id={step.id}
        className={cn(
          'w-full max-w-[120px] px-2 py-2 rounded-lg border-2 text-center transition-all duration-200',
          styles.border,
          styles.bg,
          status === 'in_progress' && 'ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20'
        )}
      >
        {/* Step name - strikethrough if skipped */}
        <div className={cn(
          'text-xs font-semibold',
          styles.text,
          isSkipped && 'line-through opacity-60'
        )}>
          {step.name}
        </div>
        {/* Optional badge with custom label support */}
        {step.optional && (
          <div className="text-[9px] text-gray-500 italic">
            ({step.optionalLabel || 'optional'})
          </div>
        )}
        {/* Role badge */}
        <div
          className={cn(
            'text-[10px] mt-1 rounded px-1.5 py-0.5 inline-block',
            roleColors.bg,
            isSkipped ? 'opacity-40' : 'opacity-80'
          )}
          style={{ color: roleColors.color }}
        >
          {step.role}
        </div>
        {/* Status indicator */}
        <div className={cn('mt-1 flex justify-center', styles.text)}>
          <StatusIcon status={status} />
        </div>
      </div>

      {/* Connector arrow with stem */}
      {showArrow && (
        <div className="pt-1 text-gray-500 flex flex-col items-center">
          {arrowLabel && (
            <span className="text-[9px] text-cyan-400 italic mb-0.5">{arrowLabel}</span>
          )}
          {/* Vertical stem line */}
          <div className="w-0.5 h-4 bg-gray-500" />
          <ArrowDown className="w-4 h-4 -mt-1" />
        </div>
      )}
    </div>
  )
}

interface PhaseColumnProps {
  phase: (typeof PHASES)[number]
  steps: WorkflowStepDef[]
  stepStatuses: Map<string, StepStatus>
  stepRefs?: Map<string, React.RefObject<HTMLDivElement | null>>
  arrowLabels?: Map<string, string>
  extraLeftPadding?: number  // Extra left padding in px for loop arrows
}

function PhaseColumn({ phase, steps, stepStatuses, stepRefs, arrowLabels, extraLeftPadding }: PhaseColumnProps) {
  // Calculate phase completion
  const completedCount = steps.filter(s => {
    const status = stepStatuses.get(s.id)
    return status === 'completed' || status === 'skipped'
  }).length
  const totalCount = steps.length
  const isComplete = completedCount === totalCount

  return (
    <div className={cn('flex flex-col rounded-xl border-2 overflow-hidden h-full', phase.bgColor, phase.borderColor)}>
      {/* Phase header */}
      <div className={cn('text-center py-2 px-3', phase.headerBg)}>
        <div className="text-sm font-bold" style={{ color: phase.color }}>
          {phase.name}
        </div>
        {phase.subtitle && (
          <div className="text-[10px] text-gray-400 mt-0.5">{phase.subtitle}</div>
        )}
        <div className="text-[10px] text-gray-500 mt-0.5">
          {completedCount}/{totalCount} {isComplete ? '✓' : ''}
        </div>
      </div>

      {/* Steps flow */}
      <div
        className="flex-1 flex flex-col gap-1 py-2 pr-4"
        style={{ paddingLeft: extraLeftPadding ? `${extraLeftPadding}px` : '16px' }}
      >
        {steps.map((step, index) => (
          <WorkflowStep
            key={step.id}
            step={step}
            status={stepStatuses.get(step.id) || 'pending'}
            showArrow={index < steps.length - 1}
            arrowLabel={arrowLabels?.get(step.id)}
            stepRef={stepRefs?.get(step.id)}
          />
        ))}
      </div>
    </div>
  )
}

// Legend component
function Legend() {
  const roles = [
    { name: 'Analyst', color: '#00acc1' },
    { name: 'PM', color: '#66bb6a' },
    { name: 'UX Designer', color: '#ab47bc' },
    { name: 'Architect', color: '#ff7043' },
    { name: 'TEA', color: '#f06292' },
    { name: 'SM', color: '#42a5f5' },
    { name: 'Dev', color: '#7e57c2' },
  ]

  const statuses = [
    { name: 'Completed', icon: <Check className="w-3 h-3" />, color: 'text-green-400' },
    { name: 'In Progress', icon: <ArrowRight className="w-3 h-3" />, color: 'text-cyan-400' },
    { name: 'Pending', icon: <Circle className="w-3 h-3" />, color: 'text-gray-500' },
    { name: 'Skipped', icon: <span className="text-xs">—</span>, color: 'text-gray-400' },
  ]

  return (
    <div className="flex flex-wrap gap-6 justify-center mt-4 pt-3 border-t border-gray-700/50">
      {/* Role legend */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] text-gray-500 font-medium">Roles:</span>
        {roles.map((role) => (
          <div key={role.name} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: role.color }}
            />
            <span className="text-[10px] text-gray-400">{role.name}</span>
          </div>
        ))}
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] text-gray-500 font-medium">Status:</span>
        {statuses.map((status) => (
          <div key={status.name} className="flex items-center gap-1">
            <span className={status.color}>{status.icon}</span>
            <span className="text-[10px] text-gray-400">{status.name}</span>
          </div>
        ))}
      </div>

      {/* Decision diamond legend */}
      <div className="flex items-center gap-1">
        <div
          className="w-5 h-3 border border-gray-500 bg-gray-700/50"
          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
        />
        <span className="text-[10px] text-gray-400">Decision</span>
      </div>

      {/* End node legend */}
      <div className="flex items-center gap-1">
        <div className="w-4 h-2.5 rounded-full border border-gray-500 bg-gray-700/50" />
        <span className="text-[10px] text-gray-400">End</span>
      </div>
    </div>
  )
}

// Connector path with optional label
interface ConnectorPath {
  path: string
  label?: string
  labelPos?: { x: number; y: number }
  noArrow?: boolean  // If true, no arrowhead on this path
}

export function WorkflowDiagram() {
  const { workflowState, hasWorkflow } = useWorkflow()
  const { setShowWorkflowDiagram } = useLayout()

  // Empty state: no workflow data available
  if (!hasWorkflow || !workflowState) {
    return (
      <div className="flex flex-col h-full bg-[#2E3440]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#4C566A] bg-[#3B4252]">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#88C0D0]" />
            <span className="text-sm font-medium text-[#D8DEE9]">BMAD Workflow Status</span>
          </div>
          <button
            onClick={() => setShowWorkflowDiagram(false)}
            className="p-1 rounded hover:bg-[#4C566A] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#D8DEE9]" />
          </button>
        </div>

        {/* Empty content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <GitBranch className="w-16 h-16 text-[#88C0D0] mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-[#D8DEE9] mb-2">No Workflow Active</h3>
          <p className="text-sm text-[#616E88] max-w-md">
            BMAD workflow progress will appear here when a bmm-workflow-status.yaml file is detected in the workspace.
          </p>
        </div>
      </div>
    )
  }

  // Build status map from workflow state
  const stepStatuses = new Map<string, StepStatus>()
  for (const step of workflowState.steps) {
    stepStatuses.set(step.name, step.status as StepStatus)
  }

  // Calculate overall progress
  const totalSteps = workflowState.steps.length
  const completedSteps = workflowState.completedSteps.length
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  // Refs for connector lines
  const containerRef = useRef<HTMLDivElement>(null)
  const planningLaneRef = useRef<HTMLDivElement>(null)
  const solutioningLaneRef = useRef<HTMLDivElement>(null)
  const implementationLaneRef = useRef<HTMLDivElement>(null)
  const brainstormRef = useRef<HTMLDivElement>(null)
  const researchRef = useRef<HTMLDivElement>(null)
  const productBriefRef = useRef<HTMLDivElement>(null)
  const prdRef = useRef<HTMLDivElement>(null)
  const hasUiDecisionRef = useRef<HTMLDivElement>(null)
  const createDesignRef = useRef<HTMLDivElement>(null)
  const architectureRef = useRef<HTMLDivElement>(null)
  const implReadinessRef = useRef<HTMLDivElement>(null)
  const sprintPlanningRef = useRef<HTMLDivElement>(null)
  const createStoryRef = useRef<HTMLDivElement>(null)
  const developStoryRef = useRef<HTMLDivElement>(null)
  const codeReviewPassRef = useRef<HTMLDivElement>(null)
  const moreStoriesRef = useRef<HTMLDivElement>(null)
  const retrospectiveRef = useRef<HTMLDivElement>(null)
  const moreEpicsRef = useRef<HTMLDivElement>(null)

  const stepRefs = new Map<string, React.RefObject<HTMLDivElement | null>>([
    ['brainstorm-project', brainstormRef],
    ['research', researchRef],
    ['product-brief', productBriefRef],
    ['prd', prdRef],
    ['has-ui-decision', hasUiDecisionRef],
    ['create-design', createDesignRef],
    ['create-architecture', architectureRef],
    ['implementation-readiness', implReadinessRef],
    ['sprint-planning', sprintPlanningRef],
    ['create-story', createStoryRef],
    ['develop-story', developStoryRef],
    ['code-review-pass', codeReviewPassRef],
    ['more-stories', moreStoriesRef],
    ['retrospective', retrospectiveRef],
    ['more-epics', moreEpicsRef],
  ])

  // Arrow labels for specific steps
  const arrowLabels = new Map<string, string>([
    ['sprint-planning', 'story loop'],
  ])

  // State for connector paths
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([])

  // Calculate connector paths based on element positions
  const updateConnectorPaths = useCallback(() => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()

    // Helper to get element position
    const getPos = (ref: React.RefObject<HTMLDivElement | null>) => {
      if (!ref.current) return null
      const rect = ref.current.getBoundingClientRect()
      return {
        left: rect.left - containerRect.left,
        right: rect.right - containerRect.left,
        top: rect.top - containerRect.top,
        bottom: rect.bottom - containerRect.top,
        centerY: rect.top - containerRect.top + rect.height / 2,
        centerX: rect.left - containerRect.left + rect.width / 2,
      }
    }

    const _planningLane = getPos(planningLaneRef)
    void _planningLane // Reserved for future use
    const solutioningLane = getPos(solutioningLaneRef)
    const implementationLane = getPos(implementationLaneRef)
    const brainstorm = getPos(brainstormRef)
    const research = getPos(researchRef)
    const productBrief = getPos(productBriefRef)
    const prd = getPos(prdRef)
    const hasUiDecision = getPos(hasUiDecisionRef)
    const createDesign = getPos(createDesignRef)
    const architecture = getPos(architectureRef)
    const implReadiness = getPos(implReadinessRef)
    const sprintPlanning = getPos(sprintPlanningRef)
    const createStory = getPos(createStoryRef)
    const developStory = getPos(developStoryRef)
    const codeReviewPass = getPos(codeReviewPassRef)
    const moreStories = getPos(moreStoriesRef)
    const moreEpics = getPos(moreEpicsRef)

    const paths: ConnectorPath[] = []

    // Discovery → PRD: All three lines converge smoothly at the back of one arrow to PRD
    if (brainstorm && research && productBrief && prd) {
      const targetX = prd.left
      const targetY = prd.centerY
      const convergeX = targetX - 25  // Convergence point (back of arrow)
      // Vertical portion centered between the swim lanes
      const midX = brainstorm.right + (prd.left - brainstorm.right) / 2

      // Brainstorm → convergence point: smooth S-curve down
      paths.push({
        path: `M ${brainstorm.right} ${brainstorm.centerY} C ${midX} ${brainstorm.centerY}, ${midX} ${targetY}, ${convergeX} ${targetY}`,
        noArrow: true
      })

      // Research → convergence point: smooth S-curve
      paths.push({
        path: `M ${research.right} ${research.centerY} C ${midX} ${research.centerY}, ${midX} ${targetY}, ${convergeX} ${targetY}`,
        noArrow: true
      })

      // Product Brief → convergence point: smooth S-curve up
      paths.push({
        path: `M ${productBrief.right} ${productBrief.centerY} C ${midX} ${productBrief.centerY}, ${midX} ${targetY}, ${convergeX} ${targetY}`,
        noArrow: true
      })

      // Convergence point → PRD (with arrow)
      paths.push({
        path: `M ${convergeX} ${targetY} L ${targetX} ${targetY}`
      })
    }

    // Decision "No" → Architecture (horizontal curve to next column)
    if (hasUiDecision && architecture && solutioningLane) {
      const startX = hasUiDecision.right + 5
      const startY = hasUiDecision.centerY
      const targetX = architecture.left
      const targetY = architecture.centerY
      const convergeX = solutioningLane.left + 10
      // Control points: first stays horizontal longer, second ensures flat entry
      const ctrl1X = solutioningLane.left - 5
      const ctrl2X = solutioningLane.left - 25

      // Curve to convergence point (no arrow)
      paths.push({
        path: `M ${startX} ${startY} C ${ctrl1X} ${startY}, ${ctrl2X} ${targetY}, ${convergeX} ${targetY}`,
        noArrow: true
      })
      // Convergence point → Architecture (with arrow)
      paths.push({
        path: `M ${convergeX} ${targetY} L ${targetX} ${targetY}`
      })
    }

    // UX Design → Architecture (converges with Has UI "No" arrow)
    if (createDesign && architecture && solutioningLane) {
      const startX = createDesign.right
      const startY = createDesign.centerY
      const _targetX = architecture.left
      void _targetX // Reserved for future use
      const targetY = architecture.centerY
      const convergeX = solutioningLane.left + 10
      // Control points: first stays horizontal longer, second ensures flat entry
      const ctrl1X = solutioningLane.left - 5
      const ctrl2X = solutioningLane.left - 25

      // Curve to convergence point (no arrow - shares arrow with Has UI "No")
      paths.push({
        path: `M ${startX} ${startY} C ${ctrl1X} ${startY}, ${ctrl2X} ${targetY}, ${convergeX} ${targetY}`,
        noArrow: true
      })
    }

    // Impl. Readiness → Sprint Planning
    if (implReadiness && sprintPlanning && implementationLane) {
      const startX = implReadiness.right
      const startY = implReadiness.centerY
      const targetX = sprintPlanning.left
      const targetY = sprintPlanning.centerY
      const convergeX = implementationLane.left + 10
      // Control points: first stays horizontal longer, second ensures flat entry
      const ctrl1X = implementationLane.left - 5
      const ctrl2X = implementationLane.left - 25

      // Curve to convergence point (no arrow)
      paths.push({
        path: `M ${startX} ${startY} C ${ctrl1X} ${startY}, ${ctrl2X} ${targetY}, ${convergeX} ${targetY}`,
        noArrow: true
      })
      // Convergence point → Sprint Planning (with arrow)
      paths.push({
        path: `M ${convergeX} ${targetY} L ${targetX} ${targetY}`
      })
    }

    // Code Review Pass "Fail" → back to Develop Story (loop LEFT and up)
    if (codeReviewPass && developStory) {
      const startX = codeReviewPass.left - 5
      const startY = codeReviewPass.centerY
      const endX = developStory.left
      const endY = developStory.centerY
      // Loop out to the left and back up
      const loopOffset = 25
      paths.push({
        path: `M ${startX} ${startY} L ${startX - loopOffset} ${startY} L ${startX - loopOffset} ${endY} L ${endX} ${endY}`
      })
    }

    // More Stories "Yes" → back to Create Story (loop LEFT and up)
    if (moreStories && createStory) {
      const startX = moreStories.left - 5
      const startY = moreStories.centerY
      const endX = createStory.left
      const endY = createStory.centerY
      // Loop out to the left and back up (offset more to avoid overlap)
      const loopOffset = 40
      paths.push({
        path: `M ${startX} ${startY} L ${startX - loopOffset} ${startY} L ${startX - loopOffset} ${endY} L ${endX} ${endY}`
      })
    }

    // More Epics "Yes" → back to Create Story (loop LEFT and up, outermost)
    if (moreEpics && createStory) {
      const startX = moreEpics.left - 5
      const startY = moreEpics.centerY
      const endX = createStory.left
      const endY = createStory.centerY
      // Loop out further to the left and back up (outermost loop)
      const loopOffset = 55
      paths.push({
        path: `M ${startX} ${startY} L ${startX - loopOffset} ${startY} L ${startX - loopOffset} ${endY} L ${endX} ${endY}`
      })
    }

    setConnectorPaths(paths)
  }, [])

  // Update paths on mount and resize
  useEffect(() => {
    updateConnectorPaths()

    const handleResize = () => {
      requestAnimationFrame(updateConnectorPaths)
    }

    window.addEventListener('resize', handleResize)

    // Also update after a short delay to handle initial render
    const timeout = setTimeout(updateConnectorPaths, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeout)
    }
  }, [updateConnectorPaths])

  return (
    <div className="flex flex-col h-full bg-[#2E3440]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#4C566A] bg-[#3B4252]">
        <div className="flex items-center gap-3">
          <GitBranch className="w-4 h-4 text-[#88C0D0]" />
          <span className="text-sm font-medium text-[#D8DEE9]">BMAD Workflow Status</span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-[#88C0D0]">{progressPercent}% complete</span>
          <span className="text-xs text-gray-500">({completedSteps}/{totalSteps} steps)</span>
        </div>
        <button
          onClick={() => setShowWorkflowDiagram(false)}
          className="p-1 rounded hover:bg-[#4C566A] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-[#D8DEE9]" />
        </button>
      </div>

      {/* Swim lane diagram */}
      <div className="flex-1 overflow-auto p-4">
        <div ref={containerRef} className="relative max-w-6xl mx-auto">
          {/* SVG overlay for curved connectors */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 4, 0 8" fill="#88C0D0" />
              </marker>
            </defs>
            {connectorPaths.map((connector, index) => (
              <g key={index}>
                <path
                  d={connector.path}
                  fill="none"
                  stroke="#88C0D0"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  markerEnd={connector.noArrow ? undefined : "url(#arrowhead)"}
                  opacity="0.7"
                />
                {connector.label && connector.labelPos && (
                  <text
                    x={connector.labelPos.x}
                    y={connector.labelPos.y}
                    fill="#9CA3AF"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {connector.label}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* Grid of phase columns - slim lanes with wide gaps for connector arrows */}
          <div className="flex justify-center gap-7 min-h-0">
            {PHASES.map((phase) => (
              <div
                key={phase.id}
                ref={
                  phase.id === 'planning' ? planningLaneRef :
                  phase.id === 'solutioning' ? solutioningLaneRef :
                  phase.id === 'implementation' ? implementationLaneRef :
                  undefined
                }
                className={cn(
                  "flex-shrink-0",
                  // Discovery stays narrow, Planning/Solutioning wider for incoming arrows,
                  // Implementation widest to fit story loop arrows on the left
                  phase.id === 'discovery' ? "w-[160px]" :
                  phase.id === 'implementation' ? "w-[230px]" : "w-[190px]"
                )}
              >
                <PhaseColumn
                  phase={phase}
                  steps={WORKFLOW_STEPS[phase.id] || []}
                  stepStatuses={stepStatuses}
                  stepRefs={stepRefs}
                  arrowLabels={arrowLabels}
                  extraLeftPadding={phase.id === 'implementation' ? 70 : undefined}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <Legend />
      </div>
    </div>
  )
}
