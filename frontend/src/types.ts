// Shared TypeScript interfaces and types for Claude Container frontend

export interface Session {
  id: string
  name: string
  status: 'active' | 'idle' | 'waiting' | 'error' | 'stopped' | string
  branch: string
  worktreePath: string
  ptyPid?: number
  createdAt: string
  lastActivity: string
  currentPhase?: string
  branchType?: 'new' | 'existing'
  metadata?: {
    epicName?: string
    storyProgress?: { completed: number; total: number }
    stuckSince?: string        // ISO 8601 - when stuck detection triggered
    lastWarning?: string        // ISO 8601 - when last warning was sent
    sharedBranch?: boolean     // Story 4.15 - whether multiple sessions share this branch
    branchSessionCount?: number // Story 4.15 - number of sessions on this branch
    [key: string]: any
  }
}

export interface TerminalMessage {
  type: 'terminal.output' | 'terminal.input' | 'terminal.ready' | 'terminal.interrupt' | 'error' | 'heartbeat' | 'layout.shift' | 'server.shutdown' | 'resource.warning' | 'artifact.updated'
  data?: string
  message?: string
  code?: string
  timestamp?: number
  // Story 3.6: Layout shift message fields
  mode?: 'terminal' | 'artifact' | 'split'
  trigger?: 'file_write' | 'user_input'
  // Story 4.7: Server shutdown message fields
  gracePeriodMs?: number
  // Story 4.8: Resource warning message fields
  memoryUsagePercent?: number
  isAcceptingNewSessions?: boolean
  // Story 5.5: Artifact updated message fields
  sessionId?: string
  storyId?: string
  artifact?: ArtifactInfo
}

export type LayoutMode = 'terminal-only' | 'terminal-with-sidebar' | 'full-layout'

// Workflow Visibility Types (Epic 3)
// Story 3.1: BMAD Workflow Status YAML Parser

/**
 * Workflow step information
 * Represents a single step in the BMAD workflow
 */
export interface WorkflowStep {
  /** Step identifier (e.g., "brainstorming", "prd_creation") */
  name: string
  /** Step status: completed (✓), in_progress (→), pending (○), skipped (-) */
  status: 'completed' | 'in_progress' | 'pending' | 'skipped'
  /** Optional human-readable display name */
  displayName?: string
  /** Optional artifact paths from workflow status YAML - supports multiple files per step */
  artifactPaths?: string[]
}

/**
 * Complete workflow state for a session
 * Extracted from BMAD status YAML files
 */
export interface WorkflowState {
  /** Current workflow step identifier (e.g., "prd_creation") */
  currentStep: string
  /** Array of completed step identifiers (e.g., ["brainstorming", "product_brief"]) */
  completedSteps: string[]
  /** Full list of workflow steps with status indicators */
  steps: WorkflowStep[]
}

/**
 * File tree node for workspace file hierarchy
 * Story 3.4: File Tree Component with Workspace Navigation
 */
export interface FileTreeNode {
  /** File or folder name (not full path) */
  name: string
  /** Absolute path to the file or directory */
  path: string
  /** Type of node */
  type: 'file' | 'directory'
  /** Children nodes (only present for directories) */
  children?: FileTreeNode[]
  /** Last modified timestamp (ISO 8601) */
  lastModified: string
}

/**
 * Toast notification type
 * Story 4.4: Toast Notifications for User Feedback
 */
export interface ToastNotification {
  /** Unique identifier for the toast */
  id: string
  /** Toast type determines styling and auto-dismiss behavior */
  type: 'success' | 'error' | 'warning' | 'info'
  /** Main toast message */
  message: string
  /** Whether to auto-dismiss (false for warnings) */
  autoDismiss: boolean
  /** Auto-dismiss delay in milliseconds (success: 4000, error: 8000, info: 5000) */
  dismissDelay: number
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
  }
  /** Timestamp when toast was created (ISO 8601) */
  timestamp: string
}

/**
 * Git branch information with metadata
 * Story 4.14: Existing Branch Selection for Sessions
 * Story 4.15: Multiple Sessions on Same Branch (added sessionCount, activeSessions)
 */
export interface Branch {
  /** Branch name (e.g., "main", "feature/auth") */
  name: string
  /** Full reference name (e.g., "refs/heads/main") */
  fullName: string
  /** Whether this branch has an active session/worktree */
  hasActiveSession: boolean
  /** Number of sessions using this branch (Story 4.15) */
  sessionCount: number
  /** Array of session names using this branch (Story 4.15) */
  activeSessions: string[]
  /** Last commit metadata */
  lastCommit: {
    /** Commit hash (short) */
    hash: string
    /** Commit message (first line, max 72 chars) */
    message: string
    /** Commit author name */
    author: string
    /** Commit date (ISO 8601 UTC) */
    date: string
  }
}

// Interactive Workflow Tracker Types (Epic 6)
// Story 6.1: Sprint Status YAML Parser
// Story 6.7: Epic Navigation and Selection

/**
 * Artifact information
 * Story 6.2: Artifact Path Derivation and Existence Check
 * Story 5.5: Added review status fields for artifact review workflow
 */
export interface ArtifactInfo {
  /** Artifact display name (e.g., "Story", "Context", "Tech Spec") */
  name: string
  /** Relative path from workspace root */
  path: string
  /** Whether the file exists and is readable */
  exists: boolean
  /** Icon representing file type */
  icon: '📄' | '📋' | '📊'
  /** Review status (Story 5.5) - null for non-reviewable artifacts (Story/Context docs) */
  reviewStatus?: 'pending' | 'approved' | 'changes-requested' | null
  /** Who modified this artifact (Story 5.4) */
  modifiedBy?: 'claude' | 'user'
  /** Revision number for tracking changes (Story 5.4) */
  revision?: number
  /** Last modification timestamp (Story 5.4) */
  lastModified?: string
}

/**
 * Epic data structure
 * Story 6.1: Sprint Status YAML Parser
 * Story 6.2: Added artifacts field
 * Story 6.7: Used in EpicSelector component
 */
export interface EpicData {
  /** Epic number (e.g., 4) */
  epicNumber: number
  /** Epic key (e.g., "epic-4") */
  epicKey: string
  /** Epic status: backlog or contexted */
  status: 'backlog' | 'contexted'
  /** Retrospective status: null, optional, or completed */
  retrospective: 'optional' | 'completed' | null
  /** Optional epic title extracted from epic file */
  title?: string
  /** Total number of stories in this epic */
  storyCount: number
  /** Number of completed stories in this epic */
  completedCount: number
  /** Artifacts associated with this epic (tech spec, retrospective) */
  artifacts: ArtifactInfo[]
}

/**
 * Story data structure
 * Story 6.1: Sprint Status YAML Parser
 * Story 6.2: Added artifacts field
 */
export interface StoryData {
  /** Story ID (e.g., "4-16") */
  storyId: string
  /** Story key (full slug, e.g., "4-16-session-list-hydration") */
  storyKey: string
  /** Epic number this story belongs to */
  epicNumber: number
  /** Story number within the epic */
  storyNumber: number
  /** Story slug (e.g., "session-list-hydration") */
  slug: string
  /** Story status in workflow progression */
  status: 'backlog' | 'drafted' | 'ready-for-dev' | 'in-progress' | 'review' | 'done'
  /** Artifacts associated with this story (story file, context file) */
  artifacts: ArtifactInfo[]
}

/**
 * Sprint status data structure
 * Story 6.1: Sprint Status YAML Parser
 * Extracted from docs/sprint-artifacts/sprint-status.yaml
 */
export interface SprintStatus {
  /** Array of epic data with status and metadata */
  epics: EpicData[]
  /** Array of story data with status and metadata */
  stories: StoryData[]
  /** Current epic number (highest epic with non-done stories) */
  currentEpic: number
  /** Current story ID (first non-done story in current epic) */
  currentStory: string | null
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string
}
