// WebSocket Message Types for Terminal Streaming Protocol
// Story 1.5: WebSocket Terminal Streaming Protocol

/**
 * Base WebSocket message structure
 * All messages follow the pattern: { type: 'resource.action', sessionId: string, ...fields }
 */
export interface BaseMessage {
  type: string;
  sessionId?: string;
}

/**
 * Client -> Server: Terminal input message
 * Sent when user types in the terminal
 */
export interface TerminalInputMessage extends BaseMessage {
  type: 'terminal.input';
  sessionId: string;
  data: string;
}

/**
 * Client -> Server: Terminal interrupt message
 * Sent when user presses Ctrl+C or ESC key or clicks STOP button
 */
export interface TerminalInterruptMessage extends BaseMessage {
  type: 'terminal.interrupt';
  sessionId: string;
}

/**
 * Client -> Server: Terminal resize message
 * Sent when terminal dimensions change (window resize, panel resize)
 */
export interface TerminalResizeMessage extends BaseMessage {
  type: 'terminal.resize';
  sessionId: string;
  cols: number;
  rows: number;
}

/**
 * Server -> Client: Terminal output message
 * Sent when PTY process generates output
 */
export interface TerminalOutputMessage extends BaseMessage {
  type: 'terminal.output';
  sessionId: string;
  data: string;
}

/**
 * Client -> Server: Session attach message
 * Story 2.6: Multiple WebSocket Connections per Client
 * Sent when client wants to subscribe to a session's output
 */
export interface SessionAttachMessage extends BaseMessage {
  type: 'session.attach';
  sessionId: string;
}

/**
 * Client -> Server: Session detach message
 * Story 2.6: Multiple WebSocket Connections per Client
 * Sent when client wants to unsubscribe from a session's output
 */
export interface SessionDetachMessage extends BaseMessage {
  type: 'session.detach';
  sessionId: string;
}

/**
 * Client -> Server: Session resume message
 * Story 2.10: Session Resume After Container Restart
 * Sent when user clicks to resume an idle session
 */
export interface SessionResumeMessage extends BaseMessage {
  type: 'session.resume';
  sessionId: string;
}

/**
 * Server -> Client: Session attached confirmation
 * Story 2.6: Multiple WebSocket Connections per Client
 * Sent to confirm successful attachment to a session
 */
export interface SessionAttachedMessage extends BaseMessage {
  type: 'session.attached';
  sessionId: string;
}

/**
 * Server -> Client: Session status update message
 * Story 2.10: Session Resume After Container Restart
 * Story 4.1: Session Status Tracking with Idle Detection
 * Sent when session status changes (e.g., idle -> active, active -> idle)
 */
export interface SessionStatusMessage extends BaseMessage {
  type: 'session.status';
  sessionId: string;
  status: SessionStatus;
  lastActivity: string;       // ISO 8601
  isStuck: boolean;
  reason?: string;
}

/**
 * Server -> Client: Terminal exit message
 * Story 2.9: Crash Isolation Between Sessions
 * Sent when PTY process exits (crash or normal termination)
 */
export interface TerminalExitMessage extends BaseMessage {
  type: 'terminal.exit';
  sessionId: string;
  exitCode: number;
  signal?: number;
}

/**
 * Server -> Client: Session destroyed message
 * Story 2.7: Session Destruction with Cleanup Options
 * Sent when session is successfully destroyed
 */
export interface SessionDestroyedMessage extends BaseMessage {
  type: 'session.destroyed';
  sessionId: string;
}

/**
 * Server -> Client: Session created message
 * Story 4.17: Cross-Tab Session Synchronization
 * Sent when a new session is created (broadcast to all clients)
 */
export interface SessionCreatedMessage extends BaseMessage {
  type: 'session.created';
  session: Session;
}

/**
 * Server -> Client: Session updated message
 * Story 4.17: Cross-Tab Session Synchronization
 * Sent when a session's data is updated (broadcast to all clients)
 */
export interface SessionUpdatedMessage extends BaseMessage {
  type: 'session.updated';
  session: Session;
}

/**
 * Bidirectional: Heartbeat message
 * Sent every 30 seconds to keep connection alive
 */
export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  timestamp: number;
}

/**
 * Server -> Client: Error message
 * Sent when an error occurs processing a message
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
  code?: string;
  sessionId?: string;
}

/**
 * Server -> Client: Workflow status update message
 * Story 3.1: BMAD Workflow Status YAML Parser
 * Sent when BMAD workflow status YAML file changes
 */
export interface WorkflowUpdatedMessage extends BaseMessage {
  type: 'workflow.updated';
  sessionId: string;
  workflow: WorkflowState;
}

/**
 * Server -> Client: File system change notification
 * Story 3.4: File Tree Component with Workspace Navigation
 * Sent when chokidar detects file system changes
 */
export interface FileChangedMessage extends BaseMessage {
  type: 'file.changed';
  path: string;
  event: 'add' | 'change' | 'unlink';
  timestamp: string;
}

/**
 * Server -> Client: Layout shift suggestion message
 * Story 3.6: Context-Aware Layout Shifting (Terminal ↔ Artifacts)
 * Sent when backend detects document write events (auto-triggered)
 */
export interface LayoutShiftMessage extends BaseMessage {
  type: 'layout.shift';
  mode: 'terminal' | 'artifact' | 'split';
  trigger: 'file_write' | 'user_input';
}

/**
 * Server -> Client: Session warning message
 * Story 4.1: Session Status Tracking with Idle Detection
 * Sent when session has been stuck (30+ min idle)
 */
export interface SessionWarningMessage extends BaseMessage {
  type: 'session.warning';
  sessionId: string;
  message: string;
  severity: 'warning' | 'error';
}

/**
 * Server -> Client: Session needs input message
 * Story 4.1: Session Status Tracking with Idle Detection
 * Sent when session is waiting for user input (detected question)
 */
export interface SessionNeedsInputMessage extends BaseMessage {
  type: 'session.needsInput';
  sessionId: string;
  message: string;
}

/**
 * Server -> Client: Server shutdown message
 * Story 4.7: Graceful Container Shutdown and Cleanup
 * Sent when server receives SIGTERM and begins graceful shutdown
 */
export interface ServerShutdownMessage extends BaseMessage {
  type: 'server.shutdown';
  message: string;
  gracePeriodMs: number;
}

/**
 * Server -> Client: Resource warning message
 * Story 4.8: Resource Monitoring and Limits
 * Sent when memory usage crosses thresholds (87% warning, 93% critical)
 */
export interface ResourceWarningMessage extends BaseMessage {
  type: 'resource.warning';
  message: string;
  memoryUsagePercent: number;
  isAcceptingNewSessions: boolean;
}

/**
 * Union type of all client -> server messages
 */
export type ClientMessage =
  | TerminalInputMessage
  | TerminalInterruptMessage
  | TerminalResizeMessage
  | SessionAttachMessage
  | SessionDetachMessage
  | SessionResumeMessage
  | HeartbeatMessage;

/**
 * Union type of all server -> client messages
 */
export type ServerMessage =
  | TerminalOutputMessage
  | SessionAttachedMessage
  | SessionStatusMessage
  | TerminalExitMessage
  | SessionDestroyedMessage
  | SessionCreatedMessage
  | SessionUpdatedMessage
  | HeartbeatMessage
  | ErrorMessage
  | WorkflowUpdatedMessage
  | FileChangedMessage
  | LayoutShiftMessage
  | SessionWarningMessage
  | SessionNeedsInputMessage
  | ServerShutdownMessage
  | ResourceWarningMessage
  | SprintUpdatedMessage
  | GitStatusUpdatedMessage
  | ArtifactUpdatedMessage;

/**
 * Session data structure
 * Tracks WebSocket connection and PTY process for a session
 */
export interface SessionData {
  sessionId: string;
  connectionId: string;
  // PTY process reference from node-pty (Story 1.4)
  ptyProcess?: import('node-pty').IPty;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * PTY output buffer for batching
 * Accumulates output chunks for 16ms before sending to reduce message overhead
 */
export interface OutputBuffer {
  sessionId: string;
  data: string;
  timer: NodeJS.Timeout | null;
  timestamp: number;
}

// Epic 2: Multi-session Management Types
// Story 2.1: Session Manager Module with State Persistence

/**
 * Session status enumeration
 * Tracks the lifecycle state of a session
 */
export type SessionStatus = 'active' | 'waiting' | 'idle' | 'error' | 'stopped';

/**
 * Artifact review state
 * Story 5.4: BMAD Artifact Detection with Story Linking
 * Tracks review status and metadata for each file modified by Claude
 */
export interface ArtifactReview {
  /** Review status: pending (needs review), approved (ready to commit), changes-requested (Claude needs to revise) */
  reviewStatus: 'pending' | 'approved' | 'changes-requested';
  /** Revision counter (increments on subsequent modifications after changes requested) */
  revision: number;
  /** Who modified the file: Claude (auto-detected via 5s window) or user (manual edit) */
  modifiedBy: 'claude' | 'user';
  /** Last modified timestamp (ISO 8601 UTC format) */
  lastModified: string;
  /** Timestamp when approved (ISO 8601) - only present when reviewStatus = 'approved' */
  approvedAt?: string;
  /** Timestamp when changes requested (ISO 8601) - only present when reviewStatus = 'changes-requested' */
  changesRequestedAt?: string;
  /** User feedback text - only present when reviewStatus = 'changes-requested' */
  feedback?: string;
}

/**
 * Session entity
 * Represents a complete session with its metadata, PTY process, and state
 *
 * Story 2.1: Session Manager Module with State Persistence
 * Story 5.4: BMAD Artifact Detection with Story Linking (added claudeLastActivity, artifactReviews)
 * This interface matches the tech spec exactly (Tech Spec Section "Data Models and Contracts - Session Entity")
 */
export interface Session {
  /** Unique session identifier (UUID v4) */
  id: string;
  /** User-provided or auto-generated session name (e.g., "feature-auth" or "feature-2025-11-24-001") */
  name: string;
  /** Current session status */
  status: SessionStatus;
  /** Git branch name (e.g., "feature/feature-auth") */
  branch: string;
  /** Absolute path to git worktree (e.g., "/workspace/.worktrees/<session-id>") */
  worktreePath: string;
  /** PTY process ID (only present when PTY is running) */
  ptyPid?: number;
  /** Session creation timestamp (ISO 8601 UTC format) */
  createdAt: string;
  /** Last activity timestamp (ISO 8601 UTC format) */
  lastActivity: string;
  /** Optional BMAD workflow phase (e.g., "planning", "implementation") */
  currentPhase?: string;
  /** Branch type: 'new' (created for this session) or 'existing' (selected from existing branches) */
  branchType?: 'new' | 'existing';
  /** Story 5.4: Last Claude stdout output timestamp (ISO 8601) - used for Claude activity detection */
  claudeLastActivity?: string;
  /** Story 5.4: Artifact review state map - key: file path (relative to worktree), value: review metadata */
  artifactReviews?: Record<string, ArtifactReview>;
  /** Optional additional metadata */
  metadata?: {
    epicName?: string;
    storyProgress?: { completed: number; total: number };
    stuckSince?: string;        // ISO 8601 - when stuck detection triggered
    lastWarning?: string;        // ISO 8601 - when last warning was sent
    sharedBranch?: boolean;     // Story 4.15 - whether multiple sessions share this branch
    branchSessionCount?: number; // Story 4.15 - number of sessions on this branch
    [key: string]: any;
  };
}

/**
 * Session persistence JSON schema
 * Format for /workspace/.claude-container-sessions.json
 */
export interface SessionPersistence {
  /** Schema version for future compatibility */
  version: string;
  /** Array of persisted sessions */
  sessions: Session[];
}

/**
 * SessionManager configuration options
 */
export interface SessionManagerOptions {
  /** Workspace root path (default: /workspace) */
  workspaceRoot: string;
  /** Maximum number of concurrent sessions (default: 4) */
  maxSessions: number;
  /** Session persistence file path (default: /workspace/.claude-container-sessions.json) */
  persistencePath: string;
}

// Epic 3: Workflow Visibility Types
// Story 3.1: BMAD Workflow Status YAML Parser

/**
 * Workflow step information
 * Represents a single step in the BMAD workflow
 *
 * Story 3.1: BMAD Workflow Status YAML Parser
 * Parsed from .bmad/bmm/status/bmm-workflow-status.yaml
 */
export interface WorkflowStep {
  /** Step identifier (e.g., "brainstorming", "prd_creation") */
  name: string;
  /** Step status: completed (✓), in_progress (→), pending (○), skipped (-) */
  status: 'completed' | 'in_progress' | 'pending' | 'skipped';
  /** Optional human-readable display name */
  displayName?: string;
  /** Optional artifact paths from workflow status YAML - supports multiple files per step */
  artifactPaths?: string[];
}

/**
 * Complete workflow state for a session
 * Extracted from BMAD status YAML files
 *
 * Story 3.1: BMAD Workflow Status YAML Parser
 * Sent to frontend via workflow.updated WebSocket message
 */
export interface WorkflowState {
  /** Current workflow step identifier (e.g., "prd_creation") */
  currentStep: string;
  /** Array of completed step identifiers (e.g., ["brainstorming", "product_brief"]) */
  completedSteps: string[];
  /** Full list of workflow steps with status indicators */
  steps: WorkflowStep[];
}

/**
 * File tree node for workspace file hierarchy
 * Story 3.4: File Tree Component with Workspace Navigation
 * Returned by GET /api/documents/tree endpoint
 */
export interface FileTreeNode {
  /** File or folder name (not full path) */
  name: string;
  /** Absolute path to the file or directory */
  path: string;
  /** Type of node */
  type: 'file' | 'directory';
  /** Children nodes (only present for directories) */
  children?: FileTreeNode[];
  /** Last modified timestamp (ISO 8601) */
  lastModified: string;
}

/**
 * Git branch information with metadata
 * Story 4.14: Existing Branch Selection for Sessions
 * Story 4.15: Multiple Sessions on Same Branch (added sessionCount, activeSessions)
 * Returned by GET /api/git/branches endpoint
 */
export interface Branch {
  /** Branch name (e.g., "main", "feature/auth") */
  name: string;
  /** Full reference name (e.g., "refs/heads/main") */
  fullName: string;
  /** Whether this branch has an active session/worktree */
  hasActiveSession: boolean;
  /** Number of sessions using this branch (Story 4.15) */
  sessionCount: number;
  /** Array of session names using this branch (Story 4.15) */
  activeSessions: string[];
  /** Last commit metadata */
  lastCommit: {
    /** Commit hash (short) */
    hash: string;
    /** Commit message (first line, max 72 chars) */
    message: string;
    /** Commit author name */
    author: string;
    /** Commit date (ISO 8601 UTC) */
    date: string;
  };
}

/**
 * Error response type enumeration
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.15: Error type categorization
 */
export type ErrorType = 'validation' | 'git' | 'pty' | 'resource' | 'internal';

/**
 * Standardized error response structure
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.15: Error messages include type, message, details, suggestion, code
 *
 * All API error responses follow this consistent schema with:
 * - type: Error category for frontend handling
 * - message: User-friendly error message (what happened)
 * - details: Technical details (why it happened)
 * - suggestion: How to fix (actionable guidance)
 * - code: Machine-readable error code (e.g., 'BRANCH_EXISTS')
 */
export interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    details?: string;
    suggestion?: string;
    code?: string;
  };
}

// Epic 6: Interactive Workflow Tracker Types
// Story 6.1: Sprint Status YAML Parser

/**
 * Sprint status data structure
 * Story 6.1: Sprint Status YAML Parser
 * Extracted from docs/sprint-artifacts/sprint-status.yaml
 */
export interface SprintStatus {
  /** Array of epic data with status and metadata */
  epics: EpicData[];
  /** Array of story data with status and metadata */
  stories: StoryData[];
  /** Current epic number (highest epic with non-done stories) */
  currentEpic: number;
  /** Current story ID (first non-done story in current epic) */
  currentStory: string | null;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
}

/**
 * Artifact information
 * Story 6.2: Artifact Path Derivation and Existence Check
 * Story 5.4: BMAD Artifact Detection with Story Linking (added review fields)
 */
export interface ArtifactInfo {
  /** Artifact display name (e.g., "Story", "Context", "Tech Spec") */
  name: string;
  /** Relative path from workspace root */
  path: string;
  /** Whether the file exists and is readable */
  exists: boolean;
  /** Icon representing file type */
  icon: '📄' | '📋' | '📊';
  /** Review status for artifact review workflow (Story 5.4) */
  reviewStatus?: 'pending' | 'approved' | 'changes-requested' | null;
  /** Who modified the file: Claude or user (Story 5.4) */
  modifiedBy?: 'claude' | 'user';
  /** Revision counter for review cycles (Story 5.4) */
  revision?: number;
  /** Last modified timestamp (ISO 8601) (Story 5.4) */
  lastModified?: string;
}

/**
 * Epic data structure
 * Story 6.1: Sprint Status YAML Parser
 * Story 6.2: Added artifacts field
 */
export interface EpicData {
  /** Epic number (e.g., 4) */
  epicNumber: number;
  /** Epic key (e.g., "epic-4") */
  epicKey: string;
  /** Epic status: backlog or contexted */
  status: 'backlog' | 'contexted';
  /** Retrospective status: null, optional, or completed */
  retrospective: 'optional' | 'completed' | null;
  /** Total number of stories in this epic */
  storyCount: number;
  /** Number of completed stories in this epic */
  completedCount: number;
  /** Artifacts associated with this epic (tech spec, retrospective) */
  artifacts: ArtifactInfo[];
}

/**
 * Story data structure
 * Story 6.1: Sprint Status YAML Parser
 * Story 6.2: Added artifacts field
 */
export interface StoryData {
  /** Story ID (e.g., "4-16") */
  storyId: string;
  /** Story key (full slug, e.g., "4-16-session-list-hydration") */
  storyKey: string;
  /** Epic number this story belongs to */
  epicNumber: number;
  /** Story number within the epic */
  storyNumber: number;
  /** Story slug (e.g., "session-list-hydration") */
  slug: string;
  /** Story status in workflow progression */
  status: 'backlog' | 'drafted' | 'ready-for-dev' | 'in-progress' | 'review' | 'done';
  /** Artifacts associated with this story (story file, context file) */
  artifacts: ArtifactInfo[];
}

/**
 * Server -> Client: Sprint status update message
 * Story 6.1: Sprint Status YAML Parser
 * Sent when sprint-status.yaml file changes
 */
export interface SprintUpdatedMessage extends BaseMessage {
  type: 'sprint.updated';
  sprintStatus: SprintStatus;
  changedStories: string[];
}

/**
 * Server -> Client: Artifact updated message
 * Story 5.4: BMAD Artifact Detection with Story Linking
 * Sent when Claude modifies a file and it's linked to a story artifact
 */
export interface ArtifactUpdatedMessage extends BaseMessage {
  type: 'artifact.updated';
  sessionId: string;
  storyId: string;
  artifact: ArtifactInfo;
}

// Epic 5: Git Integration & Artifact Review Types
// Story 5.1: Git Status API Endpoints

/**
 * Git file entry with status code
 * Story 5.1: Git Status API Endpoints
 * Represents a single file in git status output
 */
export interface GitFileEntry {
  /** Relative path to the file from worktree root */
  path: string;
  /** Git status code: M (modified), A (added), D (deleted), R (renamed), ?? (untracked), MM (staged+modified), AM (added+modified) */
  status: 'M' | 'A' | 'D' | 'R' | '??' | 'MM' | 'AM' | 'AD' | 'MD' | 'RM';
  /** Original path for renamed files (only present when status = 'R') */
  oldPath?: string;
}

/**
 * Git status response structure
 * Story 5.1: Git Status API Endpoints
 * Returned by GET /api/sessions/:sessionId/git/status
 */
export interface GitStatus {
  /** Current branch name */
  branch: string;
  /** Number of commits ahead of remote */
  ahead: number;
  /** Number of commits behind remote */
  behind: number;
  /** Staged files (ready to commit) */
  staged: GitFileEntry[];
  /** Modified files (not staged) */
  modified: GitFileEntry[];
  /** Untracked files (not in git) */
  untracked: GitFileEntry[];
}

/**
 * Server -> Client: Git status update message
 * Story 5.1: Git Status API Endpoints
 * Sent when file watcher detects changes and refreshes git status
 */
export interface GitStatusUpdatedMessage extends BaseMessage {
  type: 'git.status.updated';
  sessionId: string;
  status: GitStatus;
}

// Story 5.2: Git Operations API Endpoints - Request/Response Interfaces

/**
 * Request body for staging files
 * Story 5.2 AC #1
 */
export interface GitStageRequest {
  files: string[];
}

/**
 * Response for staging files
 * Story 5.2 AC #1
 */
export interface GitStageResponse {
  success: boolean;
  staged: string[];
}

/**
 * Request body for unstaging files
 * Story 5.2 AC #2
 */
export interface GitUnstageRequest {
  files: string[];
}

/**
 * Response for unstaging files
 * Story 5.2 AC #2
 */
export interface GitUnstageResponse {
  success: boolean;
  unstaged: string[];
}

/**
 * Request body for committing staged files
 * Story 5.2 AC #3
 */
export interface GitCommitRequest {
  message: string;
}

/**
 * Response for committing staged files
 * Story 5.2 AC #3
 */
export interface GitCommitResponse {
  success: boolean;
  commitHash: string;
  message: string;
}

/**
 * Response for pushing to remote
 * Story 5.2 AC #5
 */
export interface GitPushResponse {
  success: boolean;
  pushed: boolean;
}

/**
 * Response for pulling from remote
 * Story 5.2 AC #6
 */
export interface GitPullResponse {
  success: boolean;
  pulled: boolean;
  commits: number;
}
