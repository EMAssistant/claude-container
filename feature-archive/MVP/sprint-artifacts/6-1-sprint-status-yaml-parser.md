# Story 6.1: Sprint Status YAML Parser

Status: done

## Story

As a developer,
I want the backend to parse sprint-status.yaml and expose epic/story data,
So that the UI can display my current development progress.

## Background

The current workflow visualization shows the 4 BMAD phases (Discovery, Planning, Solutioning, Implementation) based on `bmm-workflow-status.yaml`. However, the Implementation phase is undersized - it shows only "Sprint Planning" with a checkmark, when in reality this is where 80% of the work happens across multiple epics and stories.

Story 6.1 extends the existing `statusParser.ts` module (from Epic 3) to parse `sprint-status.yaml` and extract real-time epic/story progress data. This provides the data foundation for the Interactive Workflow Tracker (Epic 6), enabling the UI to show which epic is active, which stories are complete/in-progress/backlog, and automatically derive artifact paths for each step.

## Acceptance Criteria

```gherkin
AC6.1: Backend parses sprint-status.yaml development_status section
  GIVEN sprint-status.yaml exists at docs/sprint-artifacts/sprint-status.yaml
  WHEN statusParser.parseSprintStatus() is called
  THEN return SprintStatus object with epics and stories arrays

AC6.2: Epic data extracted with correct structure
  GIVEN development_status contains "epic-4: contexted"
  WHEN parsing
  THEN extract { epicNumber: 4, epicKey: "epic-4", status: "contexted", retrospective: null }

AC6.3: Story data extracted with correct structure
  GIVEN development_status contains "4-16-session-list-hydration: review"
  WHEN parsing
  THEN extract { storyId: "4-16", epicNumber: 4, storyNumber: 16, slug: "session-list-hydration", status: "review" }

AC6.4: currentEpic calculated as highest epic with non-done stories
  GIVEN Epic 4 has stories in "review" and "done"
  WHEN calculating currentEpic
  THEN return 4 (highest epic with incomplete work)

AC6.5: currentStory calculated as first non-done story in current epic
  GIVEN stories 4-1 to 4-15 are "done", 4-16 is "review"
  WHEN calculating currentStory
  THEN return "4-16" (first non-done by story number)

AC6.6: GET /api/sprint/status returns SprintStatus
  GIVEN backend has parsed sprint-status.yaml
  WHEN GET /api/sprint/status is called
  THEN return { sprintStatus: SprintStatus } with all fields populated

AC6.7: sprint.updated WebSocket broadcast on file change
  GIVEN sprint-status.yaml is being watched by fileWatcher
  WHEN file changes (status update from BMAD workflow)
  THEN broadcast { type: 'sprint.updated', sprintStatus, changedStories: [...] } within 1 second
```

## Tasks / Subtasks

- [ ] **Task 1: Extend statusParser.ts with parseSprintStatus()** (AC6.1-6.5)
  - [ ] 1.1: Add `parseSprintStatus(yamlContent: string): SprintStatus | null` function
  - [ ] 1.2: Parse `development_status` section using js-yaml
  - [ ] 1.3: Implement `extractEpicData()` - parse epic-N entries, extract epicNumber, status, retrospective
  - [ ] 1.4: Implement `extractStoryData()` - parse N-M-slug entries, extract storyId, epicNumber, storyNumber, slug, status
  - [ ] 1.5: Implement `calculateCurrentEpic()` - find highest epic with non-done stories
  - [ ] 1.6: Implement `calculateCurrentStory()` - find first non-done story in current epic (sorted by storyNumber)
  - [ ] 1.7: Return complete SprintStatus object with lastUpdated timestamp

- [ ] **Task 2: Add GET /api/sprint/status endpoint** (AC6.6)
  - [ ] 2.1: Add route in `server.ts`: `app.get('/api/sprint/status', ...)`
  - [ ] 2.2: Read sprint-status.yaml from workspace (default path: docs/sprint-artifacts/sprint-status.yaml)
  - [ ] 2.3: Call `parseSprintStatus(fileContent)` and return result
  - [ ] 2.4: Handle file not found gracefully: return { error: { type: 'not_found', message: '...' } }
  - [ ] 2.5: Handle malformed YAML gracefully: return { error: { type: 'parse_error', message: '...' } }

- [ ] **Task 3: Add fileWatcher for sprint-status.yaml** (AC6.7)
  - [ ] 3.1: Extend `fileWatcher.ts` to watch docs/sprint-artifacts/sprint-status.yaml
  - [ ] 3.2: On file change (500ms debounce), re-parse sprint-status.yaml
  - [ ] 3.3: Calculate changed stories by diffing previous/current SprintStatus
  - [ ] 3.4: Broadcast WebSocket message: { type: 'sprint.updated', sprintStatus, changedStories }
  - [ ] 3.5: Update all connected WebSocket clients

- [ ] **Task 4: Update types.ts with Sprint data models** (All ACs)
  - [ ] 4.1: Define `SprintStatus` interface (epics, stories, currentEpic, currentStory, lastUpdated)
  - [ ] 4.2: Define `EpicData` interface (epicNumber, epicKey, status, retrospective, storyCount, completedCount)
  - [ ] 4.3: Define `StoryData` interface (storyId, storyKey, epicNumber, storyNumber, slug, status)
  - [ ] 4.4: Export types for frontend consumption

- [ ] **Task 5: Write comprehensive unit tests** (All ACs)
  - [ ] 5.1: Test parseSprintStatus() with valid YAML → correct SprintStatus
  - [ ] 5.2: Test parseSprintStatus() with missing development_status → empty result
  - [ ] 5.3: Test parseSprintStatus() with malformed YAML → null, warning logged
  - [ ] 5.4: Test extractEpicData() - multiple epics with various statuses
  - [ ] 5.5: Test extractStoryData() - multiple stories, sorted by storyNumber
  - [ ] 5.6: Test calculateCurrentEpic() - correct epic identification
  - [ ] 5.7: Test calculateCurrentStory() - first non-done story
  - [ ] 5.8: Test GET /api/sprint/status - happy path
  - [ ] 5.9: Test GET /api/sprint/status - file not found
  - [ ] 5.10: Test sprint.updated WebSocket broadcast on file change
  - [ ] 5.11: Target: 70%+ backend code coverage

## Dev Notes

### Architecture Alignment

This story extends the existing workflow status infrastructure from Epic 3:

**Reuse Patterns from Epic 3:**
- `statusParser.ts` - Extend with `parseSprintStatus()` function (already has `parseWorkflowStatus()`)
- `fileWatcher.ts` - Add sprint-status.yaml to watched files (already watches bmm-workflow-status.yaml)
- WebSocket protocol - Use existing `resource.action` naming (add `sprint.updated` message type)
- `js-yaml` library - Already installed and used for workflow status parsing

**New Components:**
- `SprintStatus`, `EpicData`, `StoryData` interfaces in `types.ts`
- `/api/sprint/status` REST endpoint in `server.ts`
- Sprint status broadcast logic in `fileWatcher.ts`

**ADR Compliance:**
- **ADR-006 (YAML Parsing):** Use js-yaml for sprint-status.yaml parsing
- **ADR-006 (File Watching):** Use chokidar with 500ms debounce for sprint-status.yaml
- **WebSocket Protocol:** Use `sprint.updated` message type following `resource.action` convention

### Sprint Status YAML Structure

**Expected format** (from docs/sprint-artifacts/sprint-status.yaml):

```yaml
development_status:
  # Epic entries (key pattern: "epic-{N}")
  epic-4: contexted                              # Epic status: backlog | contexted
  epic-4-retrospective: completed                # Retrospective: optional | completed

  # Story entries (key pattern: "{epicNum}-{storyNum}-{slug}")
  4-1-session-status-tracking: done
  4-16-session-list-hydration: review
  4-17-cross-tab-sync: review
  6-1-sprint-status-yaml-parser: backlog         # This story!
```

**Parsing Rules:**
1. Epic keys: Match `/^epic-(\d+)$/` → Extract epicNumber
2. Epic retrospective keys: Match `/^epic-(\d+)-retrospective$/` → Extract retrospective status
3. Story keys: Match `/^(\d+)-(\d+)-(.+)$/` → Extract epicNumber, storyNumber, slug
4. Story status values: `backlog | drafted | ready-for-dev | in-progress | review | done`

### Data Flow

```
sprint-status.yaml (file system)
  ↓ (file change detected by chokidar)
fileWatcher.ts
  ↓ (500ms debounce)
statusParser.parseSprintStatus(yamlContent)
  ↓ (parse + calculate)
SprintStatus { epics, stories, currentEpic, currentStory }
  ↓ (broadcast)
WebSocket: sprint.updated → All connected clients
  ↓
Frontend SprintTracker (Story 6.3)
```

### Path Handling

**Sprint status file location:**
- Primary: `docs/sprint-artifacts/sprint-status.yaml` (from `story_location` field in file)
- Fallback: `docs/sprint-status.yaml`
- Path validation: Must start with `/workspace/` (security check per ADR file system patterns)

### Error Handling

**Missing file:**
- Endpoint returns: `{ error: { type: 'not_found', message: 'Sprint status file not found', suggestion: 'Run sprint-planning workflow to initialize' } }`
- Log level: `info` (not an error, just not initialized yet)

**Malformed YAML:**
- Parser returns: `null`
- Endpoint returns: `{ error: { type: 'parse_error', message: 'Failed to parse sprint-status.yaml', details: yamlError.message } }`
- Log level: `warn` (file exists but corrupted)
- Preserve last valid state in memory

**WebSocket disconnection:**
- Frontend preserves last SprintStatus in context
- On reconnect, frontend can call GET /api/sprint/status to resync

### Testing Strategy

**Unit Tests (Jest):**
- `statusParser.test.ts` - All parsing functions with various YAML inputs
- Mock file system for fileWatcher tests
- Fixtures: `sprint-status-valid.yaml`, `sprint-status-malformed.yaml`, `sprint-status-empty.yaml`

**Integration Tests:**
- File watcher → parser → WebSocket broadcast flow
- API endpoint with real file reads

**Test Fixtures:**
- Reuse existing test fixture pattern from Epic 3 (see `backend/src/__tests__/fixtures/`)

### Performance Considerations

**Parse Performance:**
- Sprint status file is small (<1000 lines typical, ~50 stories max per epic)
- js-yaml parsing <10ms for typical file
- No optimization needed for MVP

**WebSocket Broadcast:**
- Only broadcast on file change (not periodic polling)
- Debounce prevents rapid-fire updates during BMAD workflow execution
- Changed stories array allows frontend to animate only updated rows

### Learnings from Previous Stories

**From Epic 3 (Workflow Status Parser):**

This story follows the exact same pattern as Story 3.1 (bmad-workflow-status-yaml-parser), just for a different YAML file. Key learnings to apply:

1. **Defensive Parsing:** Always validate YAML structure before accessing nested fields (use optional chaining)
2. **Graceful Degradation:** Return empty arrays if parsing fails, don't crash the entire backend
3. **Logging:** Log successful parses with counts (`log.info('Sprint status parsed', { epicCount, storyCount })`)
4. **File Watching:** Use existing chokidar watcher patterns, reuse 500ms debounce timing
5. **Testing:** Mock fs.readFileSync for unit tests, use real files for integration tests

**From Epic 4 (Production Stability):**

1. **Error Messages:** User-friendly error messages with actionable suggestions (e.g., "Run sprint-planning to initialize")
2. **Logging Levels:** Use appropriate levels (info/warn/error) for observability
3. **Performance Monitoring:** Log parse timing if >100ms (not expected, but good to track)

**No Previous Story in Epic 6:**
This is the first story in Epic 6, so no epic-specific learnings yet. The tech spec provides comprehensive guidance from Epic 6 objectives.

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#Data Models and Contracts]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.1]
- [Architecture: docs/architecture.md#Backend Stack]
- [ADR-006: docs/architecture-decisions.md#ADR-006]
- [Story 3.1 (similar pattern): docs/sprint-artifacts/3-1-bmad-workflow-status-yaml-parser.md]

## Estimated Effort

4-6 hours

## Dependencies

- Story 3.1 (BMAD Workflow Status YAML Parser) - provides statusParser.ts foundation
- Story 3.2 (File Watcher) - provides fileWatcher.ts infrastructure
- js-yaml library (already installed from Epic 3)
- chokidar library (already installed from Epic 3)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-26 | Claude | Initial draft |
| 2025-11-26 | Claude | Marked as done - All acceptance criteria implemented and tested |
