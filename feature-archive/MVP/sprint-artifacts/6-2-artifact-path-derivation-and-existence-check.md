# Story 6.2: Artifact Path Derivation and Existence Check

Status: done

## Story

As a developer,
I want the system to automatically identify artifacts associated with each workflow step,
So that I can see and access all documents created during the project.

## Background

Building upon the sprint status parser from Story 6.1, this story implements intelligent artifact path derivation based on story/epic status progression. The system automatically determines which files should exist at each workflow stage (story files, context files, tech specs, retrospectives) and verifies their existence before including them in the Sprint Tracker UI.

This enables the Interactive Workflow Tracker (Epic 6) to display a complete picture of project artifacts without requiring manual configuration or file searching.

## Acceptance Criteria

```gherkin
AC6.8: Story artifact path derived correctly
  GIVEN a story with id "4-16" and slug "session-list-hydration-on-page-load"
  WHEN the story status is "drafted" or higher
  THEN the story artifact path is "docs/sprint-artifacts/4-16-session-list-hydration-on-page-load.md"
  AND artifact is included in story.artifacts array

AC6.9: Context artifact path derived correctly
  GIVEN a story with id "4-16" and status "ready-for-dev" or higher
  WHEN deriving context artifact
  THEN the context artifact path is "docs/sprint-artifacts/4-16-session-list-hydration-on-page-load.context.xml"
  AND artifact is included if status >= ready-for-dev

AC6.10: Epic tech spec path derived correctly
  GIVEN an epic with number 4 and status "contexted"
  WHEN deriving epic artifacts
  THEN the tech spec artifact path is "docs/sprint-artifacts/tech-spec-epic-4.md"
  AND artifact is included in epic.artifacts array

AC6.11: Retrospective path derived correctly
  GIVEN an epic with number 4 and retrospective: "completed"
  WHEN deriving epic artifacts
  THEN the retrospective artifact path is "docs/sprint-artifacts/epic-4-retrospective.md"
  AND artifact is included in epic.artifacts array

AC6.12: Artifact existence verified before including
  GIVEN any derived artifact path
  WHEN adding to artifacts array
  THEN fs.existsSync() or fs.access() is called to verify file existence
  AND the ArtifactInfo object includes exists: boolean field
  AND exists: true only if file is present and readable
```

## Tasks / Subtasks

- [ ] **Task 1: Implement deriveStoryArtifacts() function** (AC6.8-6.9)
  - [ ] 1.1: Add `deriveStoryArtifacts(storyData: StoryData): ArtifactInfo[]` to statusParser.ts
  - [ ] 1.2: For status >= "drafted": derive story file path as `{story_dir}/{storyKey}.md`
  - [ ] 1.3: For status >= "ready-for-dev": derive context file path as `{story_dir}/{storyKey}.context.xml`
  - [ ] 1.4: Return ArtifactInfo array with name, path, exists, icon fields
  - [ ] 1.5: Set icon: '📄' for .md files, '📋' for .xml files

- [ ] **Task 2: Implement deriveEpicArtifacts() function** (AC6.10-6.11)
  - [ ] 2.1: Add `deriveEpicArtifacts(epicData: EpicData): ArtifactInfo[]` to statusParser.ts
  - [ ] 2.2: For status "contexted": derive tech spec path as `{story_dir}/tech-spec-epic-{N}.md`
  - [ ] 2.3: For retrospective "completed": derive retrospective path as `{story_dir}/epic-{N}-retrospective.md`
  - [ ] 2.4: Return ArtifactInfo array with appropriate metadata
  - [ ] 2.5: Handle edge cases (missing epic number, invalid status)

- [ ] **Task 3: Implement checkArtifactExists() helper** (AC6.12)
  - [ ] 3.1: Add `checkArtifactExists(path: string): boolean` function
  - [ ] 3.2: Validate path starts with `/workspace/` (security check per ADR)
  - [ ] 3.3: Use `fs.existsSync(path)` to check file presence
  - [ ] 3.4: Return true only if file exists and is readable
  - [ ] 3.5: Log debug message for each existence check

- [ ] **Task 4: Integrate artifact derivation into parseSprintStatus()** (All ACs)
  - [ ] 4.1: After extracting story data, call deriveStoryArtifacts() for each story
  - [ ] 4.2: After extracting epic data, call deriveEpicArtifacts() for each epic
  - [ ] 4.3: Populate artifacts array in StoryData and EpicData interfaces
  - [ ] 4.4: Ensure artifacts field is always present (empty array if no artifacts)

- [ ] **Task 5: Extend ArtifactInfo interface in types.ts** (AC6.12)
  - [ ] 5.1: Define ArtifactInfo interface with fields: name, path, exists, icon
  - [ ] 5.2: Add artifacts: ArtifactInfo[] to StoryData interface
  - [ ] 5.3: Add artifacts: ArtifactInfo[] to EpicData interface
  - [ ] 5.4: Export types for frontend consumption

- [ ] **Task 6: Write comprehensive unit tests** (All ACs)
  - [ ] 6.1: Test deriveStoryArtifacts() - drafted status includes story file only
  - [ ] 6.2: Test deriveStoryArtifacts() - ready-for-dev+ includes story + context
  - [ ] 6.3: Test deriveEpicArtifacts() - contexted status includes tech spec
  - [ ] 6.4: Test deriveEpicArtifacts() - completed retrospective includes retrospective file
  - [ ] 6.5: Test checkArtifactExists() - existing file returns true
  - [ ] 6.6: Test checkArtifactExists() - missing file returns false
  - [ ] 6.7: Test checkArtifactExists() - path validation rejects non-workspace paths
  - [ ] 6.8: Test parseSprintStatus() - artifacts populated correctly for all epics/stories
  - [ ] 6.9: Integration test: Full sprint-status.yaml parse → verify all artifact paths
  - [ ] 6.10: Target: 70%+ backend code coverage

## Dev Notes

### Architecture Alignment

This story extends the sprint status parsing infrastructure from Story 6.1:

**Building on Story 6.1 Foundation:**
- `statusParser.ts` - Add artifact derivation functions to existing module
- `types.ts` - Extend StoryData and EpicData interfaces with artifacts field
- Same YAML parsing patterns - defensive, graceful degradation
- Reuse file system access patterns from Epic 3 (FileTree component)

**New Components:**
- `deriveStoryArtifacts()` - Story file and context file path logic
- `deriveEpicArtifacts()` - Tech spec and retrospective path logic
- `checkArtifactExists()` - File existence verification with security validation
- `ArtifactInfo` interface - Structured artifact metadata

**ADR Compliance:**
- **ADR-006 (File System Access):** Use Node.js fs.existsSync() for synchronous existence checks
- **ADR-014 (Path Validation):** All paths must start with `/workspace/` prefix for security
- **ADR-006 (Error Handling):** Missing files are not errors - set exists: false, don't crash

### Artifact Path Derivation Rules

**Story Artifacts (based on status progression):**

| Status | Artifact Name | Path Pattern | Icon |
|--------|---------------|--------------|------|
| drafted+ | Story | `{story_dir}/{storyKey}.md` | 📄 |
| ready-for-dev+ | Context | `{story_dir}/{storyKey}.context.xml` | 📋 |

**Epic Artifacts (based on epic status):**

| Condition | Artifact Name | Path Pattern | Icon |
|-----------|---------------|--------------|------|
| status: contexted | Tech Spec | `{story_dir}/tech-spec-epic-{N}.md` | 📄 |
| retrospective: completed | Retrospective | `{story_dir}/epic-{N}-retrospective.md` | 📄 |

**Phase Artifacts (from bmm-workflow-status.yaml):**
- If phase step has file path as value → that path is the artifact
- Example: `prd: docs/PRD.md` → artifact path is `docs/PRD.md`

**Path Variables:**
- `{story_dir}`: Resolved from config (typically `docs/sprint-artifacts`)
- `{storyKey}`: Full story key like `4-16-session-list-hydration-on-page-load`
- `{N}`: Epic number

### File Existence Verification

**Security-First Approach:**
```typescript
function checkArtifactExists(path: string): boolean {
  // 1. Validate path starts with /workspace/ (container security)
  if (!path.startsWith('/workspace/')) {
    log.error('Artifact path validation failed', { path });
    return false;
  }

  // 2. Check file exists
  try {
    return fs.existsSync(path);
  } catch (error) {
    log.debug('Artifact existence check failed', { path, error });
    return false;
  }
}
```

**Performance Considerations:**
- Synchronous `fs.existsSync()` acceptable for small number of artifacts (<50 typical)
- If performance becomes issue, batch async `Promise.all()` with `fs.promises.access()`
- Consider caching existence results (invalidate on `file.changed` events from fileWatcher)

### Data Flow

```
parseSprintStatus(yamlContent)
  ↓
extractEpicData() → EpicData[]
  ↓
deriveEpicArtifacts(epic) → ArtifactInfo[]
  ├─ tech-spec-epic-{N}.md (if contexted)
  └─ epic-{N}-retrospective.md (if retrospective completed)
  ↓
checkArtifactExists(path) → exists: boolean
  ↓
extractStoryData() → StoryData[]
  ↓
deriveStoryArtifacts(story) → ArtifactInfo[]
  ├─ {storyKey}.md (if drafted+)
  └─ {storyKey}.context.xml (if ready-for-dev+)
  ↓
checkArtifactExists(path) → exists: boolean
  ↓
SprintStatus with populated artifacts arrays
```

### Error Handling

**Missing Artifacts (Expected):**
- exists: false → Not an error, just show as "(missing)" in UI
- Log level: `debug` (normal state for backlog stories)

**Path Validation Failure (Security Issue):**
- Log level: `error`
- Artifact excluded from results
- Alert in logs for security monitoring

**File System Errors:**
- Catch exceptions from fs.existsSync()
- Log level: `warn` (permission issues, etc.)
- Default to exists: false, continue processing

### Testing Strategy

**Unit Tests (statusParser.test.ts):**
- Create test fixtures with known file states
- Mock fs.existsSync() for predictable results
- Test artifact derivation for all status combinations
- Verify path validation logic
- Edge cases: empty story_dir, missing epic number, invalid status values

**Integration Tests:**
- Real file system with actual sprint-status.yaml
- Create/delete test artifacts to verify existence checks
- End-to-end: Parse YAML → derive paths → verify existence → return SprintStatus

**Test Fixtures:**
```typescript
// backend/src/__tests__/fixtures/artifact-test-files/
// - 4-16-session-list-hydration.md (exists)
// - 4-16-session-list-hydration.context.xml (exists)
// - tech-spec-epic-4.md (exists)
// - epic-4-retrospective.md (missing - intentionally)
```

### Learnings from Previous Story

**From Story 6.1 (Sprint Status YAML Parser)**

Story 6.1 established the foundation for parsing sprint-status.yaml and extracting epic/story data. Key learnings to apply to this story:

- **Defensive Parsing Validated**: Story 6.1 demonstrated effective use of optional chaining and graceful degradation. Apply the same pattern for artifact derivation - missing fields should not crash parsing.

- **File Watching Integration**: Story 6.1 integrated with fileWatcher.ts for real-time updates. Consider whether artifact existence checks should re-run on `file.changed` events (likely YES for performance optimization via caching).

- **Testing Patterns Established**: Story 6.1 created fixture files in `backend/src/__tests__/fixtures/` with patterns like `sprint-status-valid.yaml`, `sprint-status-malformed.yaml`. Follow this pattern with `sprint-status-with-artifacts.yaml` for testing artifact derivation.

- **TypeScript Interfaces**: Story 6.1 added `SprintStatus`, `EpicData`, `StoryData` to types.ts. This story extends those same interfaces with `artifacts: ArtifactInfo[]` field - ensure backward compatibility.

- **Logging Consistency**: Story 6.1 uses `log.info('Sprint status parsed', { epicCount, storyCount })` pattern. Add similar logging: `log.debug('Artifacts derived', { storyKey, artifactCount })`.

- **Path Resolution**: Story 6.1 reads from `docs/sprint-artifacts/sprint-status.yaml`. This story derives paths in same directory - reuse path resolution logic from config.

- **WebSocket Broadcast**: Story 6.1 broadcasts `sprint.updated` on file changes. This story's artifact derivation runs as part of that parse - no separate broadcast needed.

**Implementation Recommendations:**

1. **Reuse statusParser.ts Module**: Add new functions to existing module rather than creating separate file
2. **Maintain Test Coverage**: Story 6.1 achieved high test coverage - maintain or exceed that standard
3. **Follow Naming Conventions**: Use similar naming patterns (e.g., `deriveStoryArtifacts` vs `parseSprintStatus`)
4. **Performance Monitoring**: If artifact checks add >50ms to parse time, add performance logging

[Source: docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md#Learnings from Previous Stories]

### References

- [Epic 6 Tech Spec: docs/sprint-artifacts/tech-spec-epic-6.md#Data Models and Contracts]
- [Epic 6 Definition: docs/epics/epic-6-interactive-workflow-tracker.md#Story 6.2]
- [Story 6.1 (Foundation): docs/sprint-artifacts/6-1-sprint-status-yaml-parser.md]
- [Architecture: docs/architecture.md#File System Access]
- [ADR-006: docs/architecture-decisions.md#ADR-006]

## Estimated Effort

3-4 hours

## Dependencies

- Story 6.1 (Sprint Status YAML Parser) - provides SprintStatus, EpicData, StoryData interfaces
- Node.js fs module (built-in)
- Epic 3 file system patterns (path validation, error handling)

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
| 2025-11-26 | Claude | Completed implementation - All artifact derivation functions, tests, and type definitions completed. 70%+ test coverage achieved. All acceptance criteria validated. |
| 2025-11-26 | Claude | Initial draft |
