/**
 * BMAD Workflow Status YAML Parser
 * Story 3.1: BMAD Workflow Status YAML Parser
 *
 * Parses BMAD workflow status YAML files and extracts workflow step information.
 * This module provides a pure function that safely parses YAML content and converts
 * it to a WorkflowState object for frontend consumption.
 *
 * Expected BMAD YAML Schema (actual BMM format):
 * ```yaml
 * generated: "2025-11-24"
 * project: "claude-container"
 * project_type: "software"
 * selected_track: "bmad-method"
 * field_type: "greenfield"
 * workflow_path: "method-greenfield.yaml"
 *
 * workflow_status:
 *   brainstorm-project: "docs/brainstorming-session-results-2025-11-23.md"  # completed (file path)
 *   research: skipped
 *   prd: "docs/prd.md"  # completed (file path)
 *   create-architecture: required  # pending
 * ```
 *
 * Status values:
 * - File path (e.g., "docs/prd.md") = completed
 * - "skipped" = skipped (distinct status, counts toward progress but displays differently)
 * - "required" | "optional" | "recommended" | "conditional" = pending
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { WorkflowState, WorkflowStep, SprintStatus, EpicData, StoryData, ArtifactInfo } from './types';
import { logger } from './utils/logger';

/**
 * Standard BMAD workflow phases and their order
 * Used to determine current step and ordering
 */
const BMAD_WORKFLOW_ORDER = [
  // Phase 0: Discovery (Optional)
  'brainstorm-project',
  'research',
  'product-brief',
  // Phase 1: Planning
  'prd',
  'validate-prd',
  'create-design',
  // Phase 2: Solutioning
  'create-architecture',
  'create-epics-and-stories',
  'test-design',
  'validate-architecture',
  'implementation-readiness',
  // Phase 3: Implementation
  'sprint-planning',
];

/**
 * Human-readable display names for workflow steps
 */
const DISPLAY_NAMES: Record<string, string> = {
  'brainstorm-project': 'Brainstorming',
  'research': 'Research',
  'product-brief': 'Product Brief',
  'prd': 'PRD Creation',
  'validate-prd': 'PRD Validation',
  'create-design': 'UX Design',
  'create-architecture': 'Architecture',
  'create-epics-and-stories': 'Epics & Stories',
  'test-design': 'Test Design',
  'validate-architecture': 'Architecture Validation',
  'implementation-readiness': 'Implementation Readiness',
  'sprint-planning': 'Sprint Planning',
};

/**
 * Check if a status value indicates completion
 */
function isCompletedStatus(status: string): boolean {
  // Completed if it's a file path (contains "/" or ends with ".md", ".yaml", etc.)
  // Note: "skipped" is handled separately as its own status
  if (status.includes('/') || status.includes('.')) return true;
  return false;
}

/**
 * Check if a status value indicates pending
 */
function isPendingStatus(status: string): boolean {
  const pendingStatuses = ['required', 'optional', 'recommended', 'conditional'];
  return pendingStatuses.includes(status.toLowerCase());
}

/**
 * Parse BMAD workflow status YAML content into a WorkflowState object.
 *
 * This is a pure function with no side effects (except logging).
 * It safely handles malformed YAML, missing fields, and invalid data types.
 *
 * @param yamlContent - The raw YAML file content as a string
 * @returns WorkflowState object if parsing succeeds, null if parsing fails
 *
 * @example
 * ```typescript
 * const yamlContent = fs.readFileSync('bmm-workflow-status.yaml', 'utf-8');
 * const workflowState = parseWorkflowStatus(yamlContent);
 * if (workflowState) {
 *   console.log('Current step:', workflowState.currentStep);
 * } else {
 *   console.log('Failed to parse workflow status');
 * }
 * ```
 */
export function parseWorkflowStatus(yamlContent: string): WorkflowState | null {
  // Handle null/undefined input
  if (yamlContent === null || yamlContent === undefined || typeof yamlContent !== 'string') {
    logger.warn('BMAD status YAML content invalid', {
      error: 'Input is null, undefined, or not a string',
      inputType: typeof yamlContent
    });
    return null;
  }

  // Handle empty string
  if (yamlContent.trim().length === 0) {
    logger.warn('BMAD status YAML content empty', {
      error: 'Input string is empty or whitespace-only'
    });
    return null;
  }

  try {
    // Parse YAML content with safe mode (no code execution)
    const parsed = yaml.load(yamlContent, { schema: yaml.DEFAULT_SCHEMA }) as any;

    // Validate parsed content is an object
    if (!parsed || typeof parsed !== 'object') {
      logger.warn('BMAD status YAML invalid structure', {
        error: 'Parsed content is not an object',
        parsedType: typeof parsed
      });
      return null;
    }

    // Extract workflow_status section (required for BMM format)
    const workflowStatus = parsed.workflow_status;
    if (!workflowStatus || typeof workflowStatus !== 'object') {
      logger.warn('BMAD status YAML missing workflow_status section', {
        error: 'workflow_status section not found or invalid'
      });
      return null;
    }

    // Build steps array from workflow_status
    const completedSteps: string[] = [];
    const steps: WorkflowStep[] = [];
    let currentStep = 'unknown';
    let foundCurrentStep = false;

    // Process workflows in standard order
    for (const workflowId of BMAD_WORKFLOW_ORDER) {
      const status = workflowStatus[workflowId];

      // Skip workflows not in this project's status file
      if (status === undefined) continue;

      const statusStr = String(status);
      let stepStatus: 'completed' | 'in_progress' | 'pending' | 'skipped';

      if (statusStr === 'skipped') {
        // Skipped is its own status - still counts as "done" but displays differently
        stepStatus = 'skipped';
        completedSteps.push(workflowId);
      } else if (isCompletedStatus(statusStr)) {
        stepStatus = 'completed';
        completedSteps.push(workflowId);
      } else if (isPendingStatus(statusStr)) {
        if (!foundCurrentStep) {
          // First pending step is the current step
          stepStatus = 'in_progress';
          currentStep = workflowId;
          foundCurrentStep = true;
        } else {
          stepStatus = 'pending';
        }
      } else {
        // Unknown status - treat as pending
        stepStatus = 'pending';
      }

      // Include artifact paths if step is completed
      // Supports both single string and array of paths in YAML
      let artifactPaths: string[] | undefined;
      if (stepStatus === 'completed') {
        if (Array.isArray(status)) {
          // YAML array: brainstorm-project: ["docs/file1.md", "docs/file2.md"]
          artifactPaths = status.map(String).filter(p => p.includes('/') || p.includes('.'));
        } else {
          // Single path: brainstorm-project: "docs/file.md"
          artifactPaths = [statusStr];
        }
      }

      steps.push({
        name: workflowId,
        status: stepStatus,
        displayName: DISPLAY_NAMES[workflowId] || workflowId,
        artifactPaths
      });
    }

    // If all steps are completed, set currentStep to the last completed step
    if (!foundCurrentStep && completedSteps.length > 0) {
      currentStep = completedSteps[completedSteps.length - 1];
    }

    // Log successful parse with metadata
    logger.debug('BMAD status YAML parsed successfully', {
      project: parsed.project,
      currentStep,
      completedStepsCount: completedSteps.length,
      stepsCount: steps.length
    });

    return {
      currentStep,
      completedSteps,
      steps
    };

  } catch (error) {
    // Catch YAML parsing errors (syntax errors, invalid UTF-8, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.warn('BMAD status YAML parse error', {
      error: errorMessage,
      stack: errorStack
    });

    return null;
  }
}

/**
 * Check if an artifact file exists at the given path.
 * Story 6.2 Task 3: Artifact Existence Verification
 *
 * Security: All paths must start with /workspace/ for container security.
 * Returns false for any path validation failure or file access error.
 *
 * @param artifactPath - Absolute path to check (must start with /workspace/)
 * @returns true if file exists and is readable, false otherwise
 */
function checkArtifactExists(artifactPath: string): boolean {
  // Security validation: path must start with /workspace/
  if (!artifactPath.startsWith('/workspace/')) {
    logger.error('Artifact path validation failed', { path: artifactPath });
    return false;
  }

  // Check file existence
  try {
    const exists = fs.existsSync(artifactPath);
    logger.debug('Artifact existence check', { path: artifactPath, exists });
    return exists;
  } catch (error) {
    logger.debug('Artifact existence check failed', {
      path: artifactPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Derive artifact paths for a story based on its status.
 * Story 6.2 Task 1: Story Artifact Derivation
 *
 * Derivation rules:
 * - drafted+: docs/sprint-artifacts/{storyKey}.md
 * - ready-for-dev+: docs/sprint-artifacts/{storyKey}.context.xml
 *
 * @param storyData - Story data with status and key
 * @returns Array of artifact info objects
 */
function deriveStoryArtifacts(storyData: StoryData): ArtifactInfo[] {
  const artifacts: ArtifactInfo[] = [];
  const storyDir = '/workspace/docs/sprint-artifacts';

  // Story file: exists if status >= drafted
  const statusOrder = ['backlog', 'drafted', 'ready-for-dev', 'in-progress', 'review', 'done'];
  const currentStatusIndex = statusOrder.indexOf(storyData.status);
  const draftedIndex = statusOrder.indexOf('drafted');
  const readyForDevIndex = statusOrder.indexOf('ready-for-dev');

  if (currentStatusIndex >= draftedIndex) {
    const storyFilePath = path.join(storyDir, `${storyData.storyKey}.md`);
    artifacts.push({
      name: 'Story',
      path: storyFilePath,
      exists: checkArtifactExists(storyFilePath),
      icon: '📄'
    });
  }

  // Context file: exists if status >= ready-for-dev
  if (currentStatusIndex >= readyForDevIndex) {
    const contextFilePath = path.join(storyDir, `${storyData.storyKey}.context.xml`);
    artifacts.push({
      name: 'Context',
      path: contextFilePath,
      exists: checkArtifactExists(contextFilePath),
      icon: '📋'
    });
  }

  return artifacts;
}

/**
 * Derive artifact paths for an epic based on its status.
 * Story 6.2 Task 2: Epic Artifact Derivation
 *
 * Derivation rules:
 * - status=contexted: docs/sprint-artifacts/tech-spec-epic-{N}.md
 * - retrospective=completed: docs/sprint-artifacts/epic-{N}-retrospective.md
 *
 * @param epicData - Epic data with status and retrospective
 * @returns Array of artifact info objects
 */
function deriveEpicArtifacts(epicData: EpicData): ArtifactInfo[] {
  const artifacts: ArtifactInfo[] = [];
  const storyDir = '/workspace/docs/sprint-artifacts';

  // Tech spec: exists if status is contexted
  if (epicData.status === 'contexted') {
    const techSpecPath = path.join(storyDir, `tech-spec-epic-${epicData.epicNumber}.md`);
    artifacts.push({
      name: 'Tech Spec',
      path: techSpecPath,
      exists: checkArtifactExists(techSpecPath),
      icon: '📄'
    });
  }

  // Retrospective: exists if retrospective is completed
  if (epicData.retrospective === 'completed') {
    const retroPath = path.join(storyDir, `epic-${epicData.epicNumber}-retrospective.md`);
    artifacts.push({
      name: 'Retrospective',
      path: retroPath,
      exists: checkArtifactExists(retroPath),
      icon: '📄'
    });
  }

  return artifacts;
}

/**
 * Merge artifact review state into artifact info
 * Story 5.10 AC #7: Review state merged into artifact data for Sprint Tracker
 *
 * @param artifact Artifact info from derive functions
 * @param sessionArtifactReviews Session artifact reviews map (relative path -> ArtifactReview)
 * @param worktreePath Session worktree path for resolving relative paths
 * @returns Artifact info enriched with review metadata
 */
function mergeArtifactReviewState(
  artifact: ArtifactInfo,
  sessionArtifactReviews: Record<string, any> | undefined,
  worktreePath: string
): ArtifactInfo {
  if (!sessionArtifactReviews || !artifact.path) {
    return artifact;
  }

  // Convert absolute artifact path to relative path from worktree
  const relativePath = artifact.path.replace(worktreePath + '/', '');

  // Look up review state
  const review = sessionArtifactReviews[relativePath];
  if (review) {
    return {
      ...artifact,
      reviewStatus: review.reviewStatus,
      modifiedBy: review.modifiedBy,
      revision: review.revision,
      lastModified: review.lastModified
    };
  }

  return artifact;
}

/**
 * Parse Sprint Status YAML content into a SprintStatus object.
 * Story 6.1: Sprint Status YAML Parser
 * Story 5.10: Merge artifact review state into artifacts
 *
 * Expected YAML Schema:
 * ```yaml
 * development_status:
 *   epic-4: contexted
 *   epic-4-retrospective: completed
 *   4-1-session-status-tracking: done
 *   4-16-session-list-hydration: review
 *   6-1-sprint-status-yaml-parser: backlog
 * ```
 *
 * @param yamlContent - The raw YAML file content as a string
 * @param sessionId - Optional session ID to enrich artifacts with review state
 * @returns SprintStatus object if parsing succeeds, null if parsing fails
 */
export function parseSprintStatus(yamlContent: string, sessionId?: string): SprintStatus | null {
  // Handle null/undefined/invalid input
  if (yamlContent === null || yamlContent === undefined || typeof yamlContent !== 'string') {
    logger.warn('Sprint status YAML content invalid', {
      error: 'Input is null, undefined, or not a string',
      inputType: typeof yamlContent
    });
    return null;
  }

  // Handle empty string
  if (yamlContent.trim().length === 0) {
    logger.warn('Sprint status YAML content empty', {
      error: 'Input string is empty or whitespace-only'
    });
    return null;
  }

  try {
    // Parse YAML content with safe mode
    const parsed = yaml.load(yamlContent, { schema: yaml.DEFAULT_SCHEMA }) as any;

    // Validate parsed content is an object
    if (!parsed || typeof parsed !== 'object') {
      logger.warn('Sprint status YAML invalid structure', {
        error: 'Parsed content is not an object',
        parsedType: typeof parsed
      });
      return null;
    }

    // Extract development_status section (required)
    const developmentStatus = parsed.development_status;
    if (!developmentStatus || typeof developmentStatus !== 'object') {
      logger.warn('Sprint status YAML missing development_status section', {
        error: 'development_status section not found or invalid'
      });
      return null;
    }

    // Extract epic and story data
    const epics = extractEpicData(developmentStatus);
    const stories = extractStoryData(developmentStatus);

    // Calculate current epic and story
    const currentEpic = calculateCurrentEpic(epics, stories);
    const currentStory = calculateCurrentStory(stories, currentEpic);

    // Story 5.10: Merge artifact review state if sessionId provided
    if (sessionId) {
      try {
        const { sessionManager } = require('./sessionManager');
        const session = sessionManager.getSession(sessionId);
        if (session?.artifactReviews && session.worktreePath) {
          // Enrich story artifacts with review state
          for (const story of stories) {
            story.artifacts = story.artifacts.map(artifact =>
              mergeArtifactReviewState(artifact, session.artifactReviews, session.worktreePath)
            );
          }
          // Enrich epic artifacts with review state
          for (const epic of epics) {
            epic.artifacts = epic.artifacts.map(artifact =>
              mergeArtifactReviewState(artifact, session.artifactReviews, session.worktreePath)
            );
          }
          logger.debug('Merged artifact review state into sprint status', {
            sessionId,
            reviewCount: Object.keys(session.artifactReviews).length
          });
        }
      } catch (error) {
        // Log error but don't fail the parse
        logger.warn('Failed to merge artifact review state', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Log successful parse
    logger.debug('Sprint status YAML parsed successfully', {
      epicCount: epics.length,
      storyCount: stories.length,
      currentEpic,
      currentStory
    });

    return {
      epics,
      stories,
      currentEpic,
      currentStory,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    // Catch YAML parsing errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.warn('Sprint status YAML parse error', {
      error: errorMessage,
      stack: errorStack
    });

    return null;
  }
}

/**
 * Extract epic data from development_status section
 * Story 6.1 Task 1.3
 */
function extractEpicData(developmentStatus: Record<string, any>): EpicData[] {
  const epics: EpicData[] = [];
  const epicPattern = /^epic-(\d+)$/;
  const retrospectivePattern = /^epic-(\d+)-retrospective$/;

  // First pass: collect epic entries
  const epicEntries = new Map<number, { status: 'backlog' | 'contexted', retrospective: 'optional' | 'completed' | null }>();

  for (const [key, value] of Object.entries(developmentStatus)) {
    const epicMatch = key.match(epicPattern);
    if (epicMatch) {
      const epicNumber = parseInt(epicMatch[1], 10);
      const status = String(value) === 'contexted' ? 'contexted' : 'backlog';
      epicEntries.set(epicNumber, { status, retrospective: null });
    }
  }

  // Second pass: add retrospective status
  for (const [key, value] of Object.entries(developmentStatus)) {
    const retroMatch = key.match(retrospectivePattern);
    if (retroMatch) {
      const epicNumber = parseInt(retroMatch[1], 10);
      const entry = epicEntries.get(epicNumber);
      if (entry) {
        entry.retrospective = String(value) === 'completed' ? 'completed' : 'optional';
      }
    }
  }

  // Convert to EpicData array and derive artifacts (Story 6.2 Task 4.2)
  for (const [epicNumber, { status, retrospective }] of epicEntries) {
    const epicKey = `epic-${epicNumber}`;
    const epicData: EpicData = {
      epicNumber,
      epicKey,
      status,
      retrospective,
      storyCount: 0,
      completedCount: 0,
      artifacts: [] // Initialize empty, will be populated below
    };

    // Derive and populate artifacts
    epicData.artifacts = deriveEpicArtifacts(epicData);
    epics.push(epicData);
  }

  // Sort by epic number
  epics.sort((a, b) => a.epicNumber - b.epicNumber);

  return epics;
}

/**
 * Extract story data from development_status section
 * Story 6.1 Task 1.4
 * Story 6.2 Task 4.1: Added artifact derivation
 */
function extractStoryData(developmentStatus: Record<string, any>): StoryData[] {
  const stories: StoryData[] = [];
  const storyPattern = /^(\d+)-(\d+)-(.+)$/;

  for (const [key, value] of Object.entries(developmentStatus)) {
    const storyMatch = key.match(storyPattern);
    if (storyMatch) {
      const epicNumber = parseInt(storyMatch[1], 10);
      const storyNumber = parseInt(storyMatch[2], 10);
      const slug = storyMatch[3];
      const storyId = `${epicNumber}-${storyNumber}`;
      const status = String(value) as StoryData['status'];

      const storyData: StoryData = {
        storyId,
        storyKey: key,
        epicNumber,
        storyNumber,
        slug,
        status,
        artifacts: [] // Initialize empty, will be populated below
      };

      // Derive and populate artifacts (Story 6.2 Task 4.1)
      storyData.artifacts = deriveStoryArtifacts(storyData);
      stories.push(storyData);
    }
  }

  // Sort by epic number, then story number
  stories.sort((a, b) => {
    if (a.epicNumber !== b.epicNumber) {
      return a.epicNumber - b.epicNumber;
    }
    return a.storyNumber - b.storyNumber;
  });

  return stories;
}

/**
 * Calculate current epic (highest epic with non-done stories)
 * Story 6.1 Task 1.5
 */
function calculateCurrentEpic(epics: EpicData[], stories: StoryData[]): number {
  // Count stories per epic
  const epicStoryCounts = new Map<number, { total: number, completed: number }>();

  for (const story of stories) {
    const counts = epicStoryCounts.get(story.epicNumber) || { total: 0, completed: 0 };
    counts.total++;
    if (story.status === 'done') {
      counts.completed++;
    }
    epicStoryCounts.set(story.epicNumber, counts);
  }

  // Update epic story counts
  for (const epic of epics) {
    const counts = epicStoryCounts.get(epic.epicNumber);
    if (counts) {
      epic.storyCount = counts.total;
      epic.completedCount = counts.completed;
    }
  }

  // Find highest epic with incomplete stories
  let currentEpic = epics.length > 0 ? epics[0].epicNumber : 0;

  for (let i = epics.length - 1; i >= 0; i--) {
    const epic = epics[i];
    const counts = epicStoryCounts.get(epic.epicNumber);
    if (counts && counts.completed < counts.total) {
      currentEpic = epic.epicNumber;
      break;
    }
  }

  return currentEpic;
}

/**
 * Calculate current story (first non-done story in current epic)
 * Story 6.1 Task 1.6
 */
function calculateCurrentStory(stories: StoryData[], currentEpic: number): string | null {
  // Find first non-done story in current epic
  for (const story of stories) {
    if (story.epicNumber === currentEpic && story.status !== 'done') {
      return story.storyId;
    }
  }

  return null;
}
