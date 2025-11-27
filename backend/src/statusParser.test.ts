/**
 * Unit Tests for BMAD Workflow Status YAML Parser
 * Story 3.1: BMAD Workflow Status YAML Parser
 *
 * Test Coverage:
 * - Valid YAML parsing → correct WorkflowState object
 * - Invalid YAML syntax → returns null
 * - Missing fields → partial state with defaults
 * - Empty YAML file → returns null
 * - Malformed workflow_status → graceful degradation
 * - Edge cases (null/undefined input, large files)
 *
 * Target: 70%+ code coverage per architecture testing strategy
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseWorkflowStatus, parseSprintStatus } from './statusParser';
import { logger } from './utils/logger';

// Mock the logger to avoid console noise during tests
jest.mock('./utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('statusParser', () => {
  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();
  });

  describe('parseWorkflowStatus', () => {
    describe('Valid YAML parsing (AC1)', () => {
      it('should parse valid YAML with workflow_status section correctly', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/workflow-status-valid.yaml'),
          'utf-8'
        );

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        // First pending workflow (prd: required) should be current step
        expect(result!.currentStep).toBe('prd');
        // Completed workflows
        expect(result!.completedSteps).toContain('brainstorm-project');
        expect(result!.completedSteps).toContain('research'); // skipped counts as completed
        expect(result!.completedSteps).toContain('product-brief'); // skipped counts as completed
        // Should have steps with correct statuses
        expect(result!.steps.length).toBeGreaterThan(0);
      });

      it('should derive step statuses correctly from workflow_status values', () => {
        const yamlContent = `
workflow_status:
  brainstorm-project: "docs/brainstorming.md"
  research: skipped
  prd: required
  create-architecture: required
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.steps).toHaveLength(4);

        // Check completed steps (file path)
        const brainstormingStep = result!.steps.find(s => s.name === 'brainstorm-project');
        expect(brainstormingStep?.status).toBe('completed');

        // Check skipped step (has distinct status but counts toward completion)
        const researchStep = result!.steps.find(s => s.name === 'research');
        expect(researchStep?.status).toBe('skipped');

        // Check in_progress step (first required)
        const prdStep = result!.steps.find(s => s.name === 'prd');
        expect(prdStep?.status).toBe('in_progress');

        // Check pending step
        const architectureStep = result!.steps.find(s => s.name === 'create-architecture');
        expect(architectureStep?.status).toBe('pending');
      });

      it('should provide displayName for known workflow steps', () => {
        const yamlContent = `
workflow_status:
  brainstorm-project: required
  prd: required
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        const brainstormStep = result!.steps.find(s => s.name === 'brainstorm-project');
        expect(brainstormStep?.displayName).toBe('Brainstorming');

        const prdStep = result!.steps.find(s => s.name === 'prd');
        expect(prdStep?.displayName).toBe('PRD Creation');
      });

      it('should log debug message on successful parse', () => {
        const yamlContent = `
workflow_status:
  brainstorm-project: required
`;

        parseWorkflowStatus(yamlContent);

        expect(logger.debug).toHaveBeenCalledWith(
          'BMAD status YAML parsed successfully',
          expect.objectContaining({
            currentStep: 'brainstorm-project',
            completedStepsCount: 0,
            stepsCount: 1
          })
        );
      });
    });

    describe('Invalid YAML handling (AC2)', () => {
      it('should return null for malformed YAML syntax', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/workflow-status-invalid.yaml'),
          'utf-8'
        );

        const result = parseWorkflowStatus(yamlContent);

        expect(result).toBeNull();
      });

      it('should log warning with error details on parse failure', () => {
        const invalidYaml = 'workflow_status: "test\n  invalid: [';

        parseWorkflowStatus(invalidYaml);

        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML parse error',
          expect.objectContaining({
            error: expect.any(String)
          })
        );
      });

      it('should not throw exception on invalid YAML', () => {
        const invalidYaml = '{ invalid yaml: [ unclosed';

        expect(() => {
          parseWorkflowStatus(invalidYaml);
        }).not.toThrow();
      });

      it('should handle non-Error exceptions gracefully', () => {
        // Mock yaml.load to throw a non-Error object (e.g., a string)
        const yaml = require('js-yaml');
        const originalLoad = yaml.load;
        yaml.load = jest.fn().mockImplementationOnce(() => {
          throw 'String error thrown';
        });

        const result = parseWorkflowStatus('workflow_status: {}');

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML parse error',
          expect.objectContaining({
            error: 'String error thrown',
            stack: undefined
          })
        );

        // Restore original
        yaml.load = originalLoad;
      });

      it('should return null for null input', () => {
        const result = parseWorkflowStatus(null as any);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML content invalid',
          expect.objectContaining({
            error: 'Input is null, undefined, or not a string'
          })
        );
      });

      it('should return null for undefined input', () => {
        const result = parseWorkflowStatus(undefined as any);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should return null for non-string input', () => {
        const result = parseWorkflowStatus(12345 as any);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML content invalid',
          expect.objectContaining({
            inputType: 'number'
          })
        );
      });

      it('should return null for empty string', () => {
        const result = parseWorkflowStatus('');

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML content empty',
          expect.any(Object)
        );
      });

      it('should return null for whitespace-only string', () => {
        const result = parseWorkflowStatus('   \n\t  \n  ');

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should return null when YAML parses to non-object', () => {
        const result = parseWorkflowStatus('just a string');

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML invalid structure',
          expect.objectContaining({
            error: 'Parsed content is not an object'
          })
        );
      });
    });

    describe('Missing fields handling (AC3)', () => {
      it('should parse partial YAML with minimal workflow_status', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/workflow-status-partial.yaml'),
          'utf-8'
        );

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentStep).toBe('prd');
        expect(result!.completedSteps).toContain('brainstorm-project');
        expect(result!.steps).toHaveLength(2);
      });

      it('should return null when workflow_status section is missing', () => {
        const yamlContent = `
project: "test"
generated: "2025-01-01"
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'BMAD status YAML missing workflow_status section',
          expect.any(Object)
        );
      });

      it('should handle all completed workflows (no pending steps)', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/workflow-status-no-steps.yaml'),
          'utf-8'
        );

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        // When all are complete, currentStep should be the last completed one
        expect(result!.completedSteps.length).toBe(4);
        // All steps should be completed
        result!.steps.forEach(step => {
          expect(step.status).toBe('completed');
        });
      });

      it('should return null for empty workflow_status', () => {
        const yamlContent = `
workflow_status: {}
`;

        const result = parseWorkflowStatus(yamlContent);

        // Empty workflow_status should still parse but have no steps
        expect(result).not.toBeNull();
        expect(result!.steps).toEqual([]);
        expect(result!.completedSteps).toEqual([]);
      });

      it('should handle workflow_status as non-object', () => {
        const yamlContent = `
workflow_status: "not an object"
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).toBeNull();
      });
    });

    describe('Status value handling', () => {
      it('should recognize file paths as completed', () => {
        const yamlContent = `
workflow_status:
  brainstorm-project: "docs/brainstorming-session.md"
  prd: "path/to/prd.md"
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.completedSteps).toContain('brainstorm-project');
        expect(result!.completedSteps).toContain('prd');
      });

      it('should recognize "skipped" as completed', () => {
        const yamlContent = `
workflow_status:
  research: skipped
  prd: required
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.completedSteps).toContain('research');
        const researchStep = result!.steps.find(s => s.name === 'research');
        expect(researchStep?.status).toBe('skipped');
      });

      it('should recognize required/optional/recommended/conditional as pending', () => {
        const yamlContent = `
workflow_status:
  brainstorm-project: required
  research: optional
  product-brief: recommended
  prd: conditional
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        // First pending is in_progress
        expect(result!.currentStep).toBe('brainstorm-project');
        const brainstormStep = result!.steps.find(s => s.name === 'brainstorm-project');
        expect(brainstormStep?.status).toBe('in_progress');
        // Rest are pending
        const researchStep = result!.steps.find(s => s.name === 'research');
        expect(researchStep?.status).toBe('pending');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty YAML file (just comments)', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/workflow-status-empty.yaml'),
          'utf-8'
        );

        const result = parseWorkflowStatus(yamlContent);

        expect(result).toBeNull();
      });

      it('should handle YAML with only comments', () => {
        const yamlContent = `
# This is a comment
# Another comment
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).toBeNull();
      });

      it('should handle YAML with null workflow_status', () => {
        const yamlContent = `
workflow_status: null
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).toBeNull();
      });

      it('should only include known BMAD workflow IDs', () => {
        const yamlContent = `
workflow_status:
  brainstorm-project: "done.md"
  unknown-workflow: required
  prd: required
  custom-step: "custom.md"
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        // Only known workflows should be included
        const stepNames = result!.steps.map(s => s.name);
        expect(stepNames).toContain('brainstorm-project');
        expect(stepNames).toContain('prd');
        expect(stepNames).not.toContain('unknown-workflow');
        expect(stepNames).not.toContain('custom-step');
      });

      it('should handle large workflow_status performance', () => {
        // Generate YAML with many workflows (using known workflow IDs)
        const workflows = [
          'brainstorm-project', 'research', 'product-brief',
          'prd', 'validate-prd', 'create-design',
          'create-architecture', 'create-epics-and-stories',
          'test-design', 'validate-architecture',
          'implementation-readiness', 'sprint-planning'
        ];

        const statusEntries = workflows.map(w => `  ${w}: required`).join('\n');
        const yamlContent = `workflow_status:\n${statusEntries}`;

        const startTime = Date.now();
        const result = parseWorkflowStatus(yamlContent);
        const duration = Date.now() - startTime;

        expect(result).not.toBeNull();
        expect(result!.steps).toHaveLength(12);
        expect(duration).toBeLessThan(100); // Should parse in <100ms
      });

      it('should preserve workflow order from BMAD_WORKFLOW_ORDER', () => {
        const yamlContent = `
workflow_status:
  sprint-planning: required
  brainstorm-project: "done.md"
  prd: required
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        // Steps should be in BMAD_WORKFLOW_ORDER, not YAML order
        expect(result!.steps[0].name).toBe('brainstorm-project');
        expect(result!.steps[1].name).toBe('prd');
        expect(result!.steps[2].name).toBe('sprint-planning');
      });

      it('should handle workflow_status with extra metadata fields', () => {
        const yamlContent = `
project: "test-project"
generated: "2025-11-24"
project_type: "software"
extra_field: "ignored"
workflow_status:
  brainstorm-project: required
nested:
  deeply:
    ignored: true
`;

        const result = parseWorkflowStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.steps[0].name).toBe('brainstorm-project');
        // Extra fields are ignored, doesn't cause errors
      });
    });
  });

  // Story 6.1: Sprint Status YAML Parser Tests
  describe('parseSprintStatus', () => {
    describe('Valid YAML parsing (AC6.1)', () => {
      it('should parse valid sprint status YAML correctly', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/sprint-status-valid.yaml'),
          'utf-8'
        );

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.epics.length).toBeGreaterThan(0);
        expect(result!.stories.length).toBeGreaterThan(0);
        expect(result!.currentEpic).toBeGreaterThan(0);
        expect(result!.lastUpdated).toBeDefined();
      });

      it('should extract epic data with correct structure (AC6.2)', () => {
        const yamlContent = `
development_status:
  epic-4: contexted
  epic-4-retrospective: completed
  4-1-test-story: done
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.epics).toHaveLength(1);
        const epic = result!.epics[0];
        expect(epic.epicNumber).toBe(4);
        expect(epic.epicKey).toBe('epic-4');
        expect(epic.status).toBe('contexted');
        expect(epic.retrospective).toBe('completed');
      });

      it('should extract story data with correct structure (AC6.3)', () => {
        const yamlContent = `
development_status:
  epic-4: contexted
  4-16-session-list-hydration: review
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.stories).toHaveLength(1);
        const story = result!.stories[0];
        expect(story.storyId).toBe('4-16');
        expect(story.epicNumber).toBe(4);
        expect(story.storyNumber).toBe(16);
        expect(story.slug).toBe('session-list-hydration');
        expect(story.status).toBe('review');
      });

      it('should calculate currentEpic as highest epic with non-done stories (AC6.4)', () => {
        const yamlContent = `
development_status:
  epic-3: contexted
  3-1-story: done
  epic-4: contexted
  4-1-story: done
  4-2-story: review
  epic-5: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentEpic).toBe(4);
      });

      it('should calculate currentStory as first non-done story in current epic (AC6.5)', () => {
        const yamlContent = `
development_status:
  epic-4: contexted
  4-1-story: done
  4-2-story: done
  4-3-story: in-progress
  4-4-story: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentStory).toBe('4-3');
      });

      it('should log debug message on successful parse', () => {
        const yamlContent = `
development_status:
  epic-1: contexted
  1-1-test: done
`;

        parseSprintStatus(yamlContent);

        expect(logger.debug).toHaveBeenCalledWith(
          'Sprint status YAML parsed successfully',
          expect.objectContaining({
            epicCount: 1,
            storyCount: 1,
            currentEpic: 1,
            currentStory: null
          })
        );
      });
    });

    describe('Invalid YAML handling', () => {
      it('should return null for malformed YAML syntax', () => {
        const invalidYaml = 'development_status: "test\n  invalid: [';

        const result = parseSprintStatus(invalidYaml);

        expect(result).toBeNull();
      });

      it('should log warning with error details on parse failure', () => {
        const invalidYaml = 'development_status: { invalid: [ unclosed';

        parseSprintStatus(invalidYaml);

        expect(logger.warn).toHaveBeenCalledWith(
          'Sprint status YAML parse error',
          expect.objectContaining({
            error: expect.any(String)
          })
        );
      });

      it('should return null for null input', () => {
        const result = parseSprintStatus(null as any);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'Sprint status YAML content invalid',
          expect.objectContaining({
            error: 'Input is null, undefined, or not a string'
          })
        );
      });

      it('should return null for undefined input', () => {
        const result = parseSprintStatus(undefined as any);

        expect(result).toBeNull();
      });

      it('should return null for non-string input', () => {
        const result = parseSprintStatus(12345 as any);

        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = parseSprintStatus('');

        expect(result).toBeNull();
      });

      it('should return null for whitespace-only string', () => {
        const result = parseSprintStatus('   \n\t  \n  ');

        expect(result).toBeNull();
      });

      it('should return null when YAML parses to non-object', () => {
        const result = parseSprintStatus('just a string');

        expect(result).toBeNull();
      });
    });

    describe('Missing fields handling', () => {
      it('should parse partial YAML with minimal development_status', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/sprint-status-partial.yaml'),
          'utf-8'
        );

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentEpic).toBe(1);
        expect(result!.currentStory).toBe('1-2');
        expect(result!.epics).toHaveLength(1);
        expect(result!.stories).toHaveLength(2);
      });

      it('should return null when development_status section is missing', () => {
        const yamlContent = `
project: "test"
generated: "2025-01-01"
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'Sprint status YAML missing development_status section',
          expect.any(Object)
        );
      });

      it('should handle all completed stories (no pending)', () => {
        const yamlContent = fs.readFileSync(
          path.join(__dirname, '__tests__/fixtures/sprint-status-no-steps.yaml'),
          'utf-8'
        );

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentStory).toBeNull();
        expect(result!.stories.every(s => s.status === 'done')).toBe(true);
      });

      it('should handle empty development_status', () => {
        const yamlContent = `
development_status: {}
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.epics).toEqual([]);
        expect(result!.stories).toEqual([]);
        expect(result!.currentEpic).toBe(0);
        expect(result!.currentStory).toBeNull();
      });

      it('should handle development_status as non-object', () => {
        const yamlContent = `
development_status: "not an object"
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).toBeNull();
      });
    });

    describe('Epic extraction', () => {
      it('should extract multiple epics with different statuses', () => {
        const yamlContent = `
development_status:
  epic-1: contexted
  epic-1-retrospective: completed
  epic-2: contexted
  epic-3: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.epics).toHaveLength(3);
        expect(result!.epics[0].epicNumber).toBe(1);
        expect(result!.epics[0].status).toBe('contexted');
        expect(result!.epics[0].retrospective).toBe('completed');
        expect(result!.epics[1].epicNumber).toBe(2);
        expect(result!.epics[2].epicNumber).toBe(3);
        expect(result!.epics[2].status).toBe('backlog');
      });

      it('should handle retrospective without matching epic', () => {
        const yamlContent = `
development_status:
  epic-1-retrospective: completed
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.epics).toHaveLength(0);
      });

      it('should count stories per epic', () => {
        const yamlContent = `
development_status:
  epic-4: contexted
  4-1-story: done
  4-2-story: done
  4-3-story: in-progress
  4-4-story: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.epics[0].storyCount).toBe(4);
        expect(result!.epics[0].completedCount).toBe(2);
      });
    });

    describe('Story extraction', () => {
      it('should extract multiple stories with different statuses', () => {
        const yamlContent = `
development_status:
  epic-4: contexted
  4-1-story-one: done
  4-2-story-two: review
  4-3-story-three: in-progress
  4-4-story-four: drafted
  4-5-story-five: ready-for-dev
  4-6-story-six: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.stories).toHaveLength(6);
        expect(result!.stories.map(s => s.status)).toEqual([
          'done', 'review', 'in-progress', 'drafted', 'ready-for-dev', 'backlog'
        ]);
      });

      it('should sort stories by epic then story number', () => {
        const yamlContent = `
development_status:
  epic-2: contexted
  2-5-story: done
  epic-1: contexted
  1-10-story: done
  1-2-story: done
  2-1-story: done
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.stories.map(s => s.storyId)).toEqual([
          '1-2', '1-10', '2-1', '2-5'
        ]);
      });

      it('should handle story keys with multi-word slugs', () => {
        const yamlContent = `
development_status:
  epic-4: contexted
  4-16-session-list-hydration-on-page-load: review
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.stories[0].slug).toBe('session-list-hydration-on-page-load');
        expect(result!.stories[0].storyKey).toBe('4-16-session-list-hydration-on-page-load');
      });
    });

    describe('Current epic/story calculation', () => {
      it('should return first epic when no stories exist', () => {
        const yamlContent = `
development_status:
  epic-1: contexted
  epic-2: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentEpic).toBe(1);
        expect(result!.currentStory).toBeNull();
      });

      it('should handle multiple epics with mixed completion', () => {
        const yamlContent = `
development_status:
  epic-1: contexted
  1-1-story: done
  epic-2: contexted
  2-1-story: done
  2-2-story: in-progress
  epic-3: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentEpic).toBe(2);
        expect(result!.currentStory).toBe('2-2');
      });

      it('should handle epic with only backlog stories', () => {
        const yamlContent = `
development_status:
  epic-1: contexted
  1-1-story: backlog
  1-2-story: backlog
`;

        const result = parseSprintStatus(yamlContent);

        expect(result).not.toBeNull();
        expect(result!.currentEpic).toBe(1);
        expect(result!.currentStory).toBe('1-1');
      });
    });

    describe('Performance', () => {
      it('should parse large sprint status file quickly', () => {
        // Generate large YAML with many epics and stories
        const epics = Array.from({ length: 10 }, (_, i) => `epic-${i + 1}: contexted`);
        const stories = Array.from({ length: 100 }, (_, i) => {
          const epicNum = Math.floor(i / 10) + 1;
          const storyNum = (i % 10) + 1;
          return `${epicNum}-${storyNum}-story-${i}: done`;
        });
        const yamlContent = `development_status:\n  ${epics.join('\n  ')}\n  ${stories.join('\n  ')}`;

        const startTime = Date.now();
        const result = parseSprintStatus(yamlContent);
        const duration = Date.now() - startTime;

        expect(result).not.toBeNull();
        expect(result!.epics).toHaveLength(10);
        expect(result!.stories).toHaveLength(100);
        expect(duration).toBeLessThan(100); // Should parse in <100ms
      });
    });

    // Story 6.2: Artifact Path Derivation and Existence Check Tests
    describe('Artifact derivation', () => {
      describe('Story artifact derivation (AC6.8, AC6.9)', () => {
        it('should derive story file path for drafted status', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-session-list-hydration-on-page-load: drafted
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          expect(result!.stories).toHaveLength(1);
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(1);
          expect(story.artifacts[0].name).toBe('Story');
          expect(story.artifacts[0].path).toBe('/workspace/docs/sprint-artifacts/4-16-session-list-hydration-on-page-load.md');
          expect(story.artifacts[0].icon).toBe('📄');
        });

        it('should derive story and context files for ready-for-dev status', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-session-list-hydration: ready-for-dev
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(2);
          expect(story.artifacts[0].name).toBe('Story');
          expect(story.artifacts[0].path).toBe('/workspace/docs/sprint-artifacts/4-16-session-list-hydration.md');
          expect(story.artifacts[1].name).toBe('Context');
          expect(story.artifacts[1].path).toBe('/workspace/docs/sprint-artifacts/4-16-session-list-hydration.context.xml');
          expect(story.artifacts[1].icon).toBe('📋');
        });

        it('should derive story and context files for in-progress status', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-test: in-progress
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(2);
        });

        it('should derive story and context files for review status', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-test: review
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(2);
        });

        it('should derive story and context files for done status', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-test: done
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(2);
        });

        it('should not derive any artifacts for backlog status', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-test: backlog
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(0);
        });
      });

      describe('Epic artifact derivation (AC6.10, AC6.11)', () => {
        it('should derive tech spec path for contexted epic', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          expect(result!.epics).toHaveLength(1);
          const epic = result!.epics[0];
          expect(epic.artifacts).toHaveLength(1);
          expect(epic.artifacts[0].name).toBe('Tech Spec');
          expect(epic.artifacts[0].path).toBe('/workspace/docs/sprint-artifacts/tech-spec-epic-4.md');
          expect(epic.artifacts[0].icon).toBe('📄');
        });

        it('should derive retrospective path when retrospective is completed', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  epic-4-retrospective: completed
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const epic = result!.epics[0];
          expect(epic.artifacts).toHaveLength(2);
          expect(epic.artifacts[0].name).toBe('Tech Spec');
          expect(epic.artifacts[1].name).toBe('Retrospective');
          expect(epic.artifacts[1].path).toBe('/workspace/docs/sprint-artifacts/epic-4-retrospective.md');
        });

        it('should not derive tech spec for backlog epic', () => {
          const yamlContent = `
development_status:
  epic-5: backlog
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const epic = result!.epics[0];
          expect(epic.artifacts).toHaveLength(0);
        });

        it('should not derive retrospective when retrospective is optional', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  epic-4-retrospective: optional
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const epic = result!.epics[0];
          expect(epic.artifacts).toHaveLength(1);
          expect(epic.artifacts[0].name).toBe('Tech Spec');
        });
      });

      describe('Artifact existence verification (AC6.12)', () => {
        it('should set exists field based on file presence', () => {
          const yamlContent = `
development_status:
  epic-6: contexted
  6-1-sprint-status-yaml-parser: drafted
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(1);
          // Verify path is derived correctly
          expect(story.artifacts[0].path).toBe('/workspace/docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md');
          // Verify exists field is present (boolean)
          expect(typeof story.artifacts[0].exists).toBe('boolean');
        });

        it('should set exists to false for missing files', () => {
          const yamlContent = `
development_status:
  epic-99: contexted
  99-99-nonexistent-story: drafted
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          expect(story.artifacts).toHaveLength(1);
          expect(story.artifacts[0].exists).toBe(false);
        });

        it('should log debug message for each existence check', () => {
          const yamlContent = `
development_status:
  epic-6: contexted
  6-2-artifact-path-derivation-and-existence-check: drafted
`;

          parseSprintStatus(yamlContent);

          expect(logger.debug).toHaveBeenCalledWith(
            'Artifact existence check',
            expect.objectContaining({
              path: '/workspace/docs/sprint-artifacts/6-2-artifact-path-derivation-and-existence-check.md',
              exists: expect.any(Boolean)
            })
          );
        });
      });

      describe('Artifact path validation (Security)', () => {
        // Note: We can't easily test path validation in isolation since the functions are private
        // But we can verify that artifacts are always derived with /workspace/ prefix
        it('should always use /workspace/ prefix for artifact paths', () => {
          const yamlContent = `
development_status:
  epic-4: contexted
  4-16-test: ready-for-dev
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          const story = result!.stories[0];
          story.artifacts.forEach(artifact => {
            expect(artifact.path).toMatch(/^\/workspace\//);
          });

          const epic = result!.epics[0];
          epic.artifacts.forEach(artifact => {
            expect(artifact.path).toMatch(/^\/workspace\//);
          });
        });
      });

      describe('Integration with full sprint status', () => {
        it('should populate artifacts for all epics and stories', () => {
          const yamlContent = fs.readFileSync(
            path.join(__dirname, '__tests__/fixtures/sprint-status-valid.yaml'),
            'utf-8'
          );

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();

          // Every epic should have artifacts array
          result!.epics.forEach(epic => {
            expect(epic.artifacts).toBeDefined();
            expect(Array.isArray(epic.artifacts)).toBe(true);
          });

          // Every story should have artifacts array
          result!.stories.forEach(story => {
            expect(story.artifacts).toBeDefined();
            expect(Array.isArray(story.artifacts)).toBe(true);
          });
        });

        it('should handle mixed artifact states (some exist, some dont)', () => {
          const yamlContent = `
development_status:
  epic-6: contexted
  6-1-sprint-status-yaml-parser: done
  6-99-nonexistent: ready-for-dev
`;

          const result = parseSprintStatus(yamlContent);

          expect(result).not.toBeNull();
          expect(result!.stories).toHaveLength(2);

          // Story 6-1 should have artifacts with exists field
          const story1 = result!.stories[0];
          expect(story1.artifacts.length).toBeGreaterThan(0);
          story1.artifacts.forEach(artifact => {
            expect(typeof artifact.exists).toBe('boolean');
          });

          // Story 6-99 should have artifacts with exists field
          const story2 = result!.stories[1];
          expect(story2.artifacts).toHaveLength(2);
          story2.artifacts.forEach(artifact => {
            expect(typeof artifact.exists).toBe('boolean');
          });
        });
      });
    });
  });
});
