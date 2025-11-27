# Epic 2 Validation Guide
## How to Validate the Multi-Session Architecture

This guide explains how to execute the validation for Story 2.12: Validation with 4 Parallel BMAD Workflows.

---

## Overview

Epic 2 implemented a multi-session architecture that allows running 4 concurrent Claude CLI sessions with isolated git worktrees. Story 2.12 is a comprehensive validation story that provides tools and procedures to manually test this architecture under realistic load with real BMAD workflows.

**This is NOT an automated test suite** - it requires human observation and interaction.

---

## Prerequisites

Before starting validation:

1. **All Epic 2 Stories Implemented**
   - Stories 2.1 through 2.11 must be completed
   - Session Manager, PTY Manager, Worktree Manager operational
   - Frontend UI with SessionList, SessionTabs, Terminal components functional

2. **Docker Container Running**
   ```bash
   docker ps | grep claude-container
   ```

3. **Backend Server Accessible**
   ```bash
   curl http://localhost:3000/health
   # or
   curl http://localhost:3000
   ```

4. **Frontend UI Accessible**
   - Open browser to http://localhost:3000
   - Verify UI loads correctly

5. **BMAD Workflows Available**
   - Claude CLI installed in container
   - BMAD workflows accessible: `/bmad:bmm:workflows:*`

---

## Validation Artifacts

Story 2.12 created 4 key artifacts:

### 1. Test Script (`test-epic-2-validation.sh`)
**Location:** `/workspace/test-epic-2-validation.sh`

**Purpose:** Automated session creation and interactive validation prompts

**Features:**
- Creates 4 sessions via REST API
- Assigns unique names and branches
- Guides tester through acceptance criteria
- Provides cleanup commands

**Usage:**
```bash
./test-epic-2-validation.sh
```

### 2. Validation Checklist (`epic-2-validation-checklist.md`)
**Location:** `docs/sprint-artifacts/epic-2-validation-checklist.md`

**Purpose:** Structured checklist for documenting validation results

**Features:**
- All 11 tasks broken down into validation steps
- All 8 acceptance criteria mapped
- Fill-in-the-blank format for session IDs, measurements, notes
- Issue tracking sections (Critical/Major/Minor)
- Sign-off section

**Usage:**
- Print or open in editor
- Fill in as you complete validation steps
- Attach screenshots
- Sign off when complete

### 3. Resource Monitoring Script (`monitor-resources.sh`)
**Location:** `/workspace/monitor-resources.sh`

**Purpose:** Monitor Docker container resources during concurrent workflows

**Features:**
- Tracks CPU, memory, PIDs, network I/O, block I/O
- Samples every 5 seconds (configurable)
- Generates statistics (peak, average, minimum)
- Validates NFR-SCALE-2 (4-8GB memory bounds)
- Detects memory leaks
- Checks for zombie processes
- Outputs CSV log file

**Usage:**
```bash
# Monitor for 10 minutes (600 seconds)
./monitor-resources.sh 600

# Monitor for 5 minutes (default)
./monitor-resources.sh

# Monitor indefinitely (Ctrl+C to stop)
./monitor-resources.sh 9999
```

### 4. Test Report Template (`epic-2-test-report-template.md`)
**Location:** `docs/sprint-artifacts/epic-2-test-report-template.md`

**Purpose:** Comprehensive report template for documenting results

**Features:**
- Executive summary
- Detailed AC results (PASS/FAIL)
- Non-functional requirements validation
- Issue tracking with severity levels
- Performance observations
- Screenshot placeholders
- Recommendations section
- Approval sign-offs

**Usage:**
- Copy template to new file: `epic-2-test-report-YYYYMMDD.md`
- Fill in as validation progresses
- Attach screenshots
- Submit for review

---

## Validation Workflow

### Step 1: Prepare Environment

```bash
# Verify Docker container is running
docker ps | grep claude-container

# Verify backend is accessible
curl http://localhost:3000/health

# Open frontend in browser
open http://localhost:3000  # macOS
# or visit http://localhost:3000 in browser

# Navigate to test script directory
cd claude-container
```

### Step 2: Start Resource Monitoring

In a **separate terminal window**, start resource monitoring:

```bash
cd claude-container
./monitor-resources.sh 600  # 10 minutes
```

This will run in the background and generate a log file. Keep this terminal visible to observe resource usage.

### Step 3: Execute Test Script

In your **main terminal window**, run the test script:

```bash
./test-epic-2-validation.sh
```

The script will:
1. Verify Docker container is running
2. Create 4 sessions via API
3. Display session IDs
4. Prompt you to start workflows in each session
5. Guide you through manual validation steps for each acceptance criterion

### Step 4: Start Workflows

When prompted by the test script, switch to the browser and start these workflows:

**Session 1 (epic-auth):**
```
/bmad:bmm:workflows:brainstorm-project
```
Then after completion:
```
/bmad:bmm:workflows:prd
/bmad:bmm:workflows:architecture
```

**Session 2 (epic-payments):**
```
/bmad:bmm:workflows:prd
```

**Session 3 (epic-ui-polish):**
```
/bmad:bmm:workflows:create-ux-design
```

**Session 4 (epic-notifications):**
```
/bmad:bmm:workflows:dev-story
```
(Note: Requires existing story file to implement)

### Step 5: Follow Interactive Prompts

The test script will guide you through validating:
- AC1: Parallel terminal streaming
- AC2: Tab switching performance (<50ms)
- AC3: No output cross-contamination
- AC4: Git worktree isolation
- AC5: Status indicators ("!" badge)
- AC6: Session autonomy
- AC7: Workflow completion & artifact isolation
- AC8: Container restart recovery

Press ENTER after completing each validation step.

### Step 6: Document Results

While validating, fill in the checklist:

```bash
# Open checklist in your editor
code docs/sprint-artifacts/epic-2-validation-checklist.md
# or
vim docs/sprint-artifacts/epic-2-validation-checklist.md
```

Record:
- Session IDs
- Observations (Yes/No)
- Measurements (latency, memory, CPU)
- Notes and issues
- Screenshot file names

### Step 7: Capture Screenshots

During validation, capture screenshots of:
1. All 4 sessions running concurrently
2. Status indicators (especially "!" badge in Session 2)
3. Git worktree isolation (terminal showing git status)
4. Docker stats (resource usage)
5. Container restart recovery (sessions restored)

Save screenshots to `docs/sprint-artifacts/screenshots/` or similar.

### Step 8: Review Resource Monitoring

After workflows complete, check the resource monitoring output:

```bash
# The monitoring script will generate a summary report
# Review the log file
cat resource-monitoring-*.log

# Check for:
# - Peak memory within 4-8GB
# - Stable memory (no leaks)
# - CPU distribution across cores
# - No zombie processes
```

### Step 9: Generate Test Report

Create a final test report:

```bash
# Copy template
cp docs/sprint-artifacts/epic-2-test-report-template.md \
   docs/sprint-artifacts/epic-2-test-report-$(date +%Y%m%d).md

# Edit with your results
code docs/sprint-artifacts/epic-2-test-report-$(date +%Y%m%d).md
```

Fill in:
- Executive summary (PASS/FAIL)
- All AC results
- Resource measurements
- Issues discovered
- Screenshots
- Recommendations

### Step 10: Cleanup

After validation complete, clean up test sessions:

```bash
# Use session IDs from test script output
curl -X DELETE "http://localhost:3000/api/sessions/<session-1-id>?cleanup=true"
curl -X DELETE "http://localhost:3000/api/sessions/<session-2-id>?cleanup=true"
curl -X DELETE "http://localhost:3000/api/sessions/<session-3-id>?cleanup=true"
curl -X DELETE "http://localhost:3000/api/sessions/<session-4-id>?cleanup=true"

# Or use UI to delete sessions with cleanup checkbox
```

---

## Acceptance Criteria Quick Reference

| AC | Description | How to Validate |
|----|-------------|-----------------|
| AC1 | All 4 terminals show real-time output | Observe all terminals streaming simultaneously |
| AC2 | Tab switching <50ms | Measure in DevTools or observe perceived latency |
| AC3 | No output cross-contamination | Verify each terminal shows only its own workflow |
| AC4 | Git worktrees isolated | Check git status in each session's worktree |
| AC5 | "!" badge when Claude asks question | Wait for Session 2 to pause, verify badge appears |
| AC6 | Other sessions continue autonomously | Verify Sessions 1,3,4 run while Session 2 waiting |
| AC7 | Session 3 UX spec in its worktree only | Verify file exists in Session 3, not in others |
| AC8 | Sessions restore after container restart | Stop/start container, verify sessions restored |

---

## Troubleshooting

### Container Not Running
```bash
# Start container
docker start claude-container

# Check logs if issues
docker logs claude-container
```

### Backend Not Accessible
```bash
# Check if backend process is running
docker exec claude-container ps aux | grep node

# Restart container
docker restart claude-container
```

### Sessions Not Creating
```bash
# Check backend logs
docker logs claude-container

# Verify API endpoint
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"test","branch":"test/branch"}'
```

### Workflows Not Available
```bash
# Verify Claude CLI installed in container
docker exec claude-container which claude

# Verify BMAD workflows
docker exec claude-container ls -la ~/.claude/commands/
# or check for BMAD installation
```

### Resource Monitoring Fails
```bash
# Check Docker daemon is running
docker info

# Try manual stats
docker stats claude-container --no-stream
```

---

## Success Criteria

Validation is **SUCCESSFUL** when:
- ✅ All 8 acceptance criteria PASS
- ✅ No critical issues discovered
- ✅ Memory usage within 4-8GB bounds
- ✅ Tab switching <50ms
- ✅ No terminal cross-contamination
- ✅ Sessions properly isolated
- ✅ Container restart recovery works

Validation is **CONDITIONAL PASS** when:
- ✅ All 8 acceptance criteria PASS
- ⚠️ Minor issues discovered (log for Epic 4)
- ✅ Core functionality works correctly

Validation is **FAILED** when:
- ❌ One or more acceptance criteria FAIL
- ❌ Critical issues discovered
- ❌ Memory exceeds 8GB consistently
- ❌ Sessions not isolated
- ❌ Terminal output cross-contaminated

---

## Next Steps After Validation

### If Validation Passes
1. Update Story 2.12 to "done" status
2. Mark Epic 2 as complete
3. Log minor issues (if any) for Epic 4
4. Proceed to Epic 3 or Epic 4

### If Validation Fails
1. Document failures in test report
2. Keep Story 2.12 in "in-progress"
3. Identify root causes
4. Fix issues in Epic 2 stories (2.1-2.11)
5. Re-run validation after fixes

---

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| Test Script | `/workspace/test-epic-2-validation.sh` | Automated session creation + interactive prompts |
| Monitoring Script | `/workspace/monitor-resources.sh` | Resource usage tracking |
| Validation Checklist | `docs/sprint-artifacts/epic-2-validation-checklist.md` | Structured checklist for results |
| Test Report Template | `docs/sprint-artifacts/epic-2-test-report-template.md` | Comprehensive report template |
| Story File | `docs/sprint-artifacts/2-12-validation-with-4-parallel-bmad-workflows.md` | Story definition and completion notes |
| Story Context | `docs/sprint-artifacts/2-12-validation-with-4-parallel-bmad-workflows.context.xml` | Story context for implementation |

---

## Questions?

If you encounter issues or have questions:
1. Review the story file: `docs/sprint-artifacts/2-12-validation-with-4-parallel-bmad-workflows.md`
2. Check completion notes in Dev Agent Record section
3. Review Epic 2 Tech Spec: `docs/sprint-artifacts/tech-spec-epic-2.md`
4. Check Architecture doc: `docs/architecture.md`
5. Review PRD: `docs/prd.md`

---

**Document Version:** 1.0
**Created:** 2025-11-24
**Story:** 2.12 Validation with 4 Parallel BMAD Workflows
