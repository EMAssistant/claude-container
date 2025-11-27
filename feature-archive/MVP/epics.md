# claude-container - Epic Breakdown

**Author:** Kyle
**Date:** 2025-11-24
**Project Level:** Low Complexity
**Target Scale:** Web Application - Developer Tool

---

## Overview

This document provides the complete epic and story breakdown for **claude-container**, decomposing the requirements from the [PRD](./prd.md) into implementable stories.

**Living Document Notice:** This document incorporates context from PRD + UX Design + Architecture for complete implementation guidance.

---

## Epic Summary

| Epic | Stories | FRs Covered | Primary Value | Document |
|------|---------|-------------|---------------|----------|
| **Epic 1: Foundation & Single-Session Terminal** | 12 | 23 FRs | Browser-based Claude CLI with zero approvals | [epic-1-foundation.md](./epics/epic-1-foundation.md) |
| **Epic 2: Multi-Session Parallel Development** | 12 | 30 FRs | 4 parallel features in isolated worktrees | [epic-2-multi-session.md](./epics/epic-2-multi-session.md) |
| **Epic 3: Workflow Visibility & Document Review** | 12 | 12 FRs | Monitor sessions and review artifacts at a glance | [epic-3-workflow-visibility.md](./epics/epic-3-workflow-visibility.md) |
| **Epic 4: Production Stability & Polish** | 13 | 7 FRs + enhancements | Rock-solid reliability for daily use | [epic-4-production-stability.md](./epics/epic-4-production-stability.md) |
| **Epic 5: Git Integration & BMAD Review** | 11 | 16 FRs | One-click artifact approval and git operations | [epic-5-git-review.md](./epics/epic-5-git-review.md) |
| **Epic 6: Interactive Workflow Tracker** | 10 | FR37-FR42 enhanced | One-click workflow execution from visual tracker | [epic-6-interactive-workflow-tracker.md](./epics/epic-6-interactive-workflow-tracker.md) |

**Total:** 6 epics, 70 stories, 88+ FRs

---

## Functional Requirements Inventory

**Container & Environment Management (FR1-FR7):**
- FR1: Complete development environment in Docker (Ubuntu 22.04, Python 3.13, Java 21, Node.js, git, jq, build-essential)
- FR2: Mount host project directory to `/workspace` with read-write access
- FR3: Mount host `~/.config/claude-code` to `/config/.claude-code` with read-only access
- FR4: Install BMAD Method within workspace directory
- FR5: Update BMAD Method installation via UI button
- FR6: Mark all CLI tools as safe within container (no approval prompts)
- FR7: Isolate container filesystem from host system

**Session Management (FR8-FR15):**
- FR8: Create new Claude CLI sessions with user-defined or auto-generated names
- FR9: Support up to 4 concurrent Claude CLI sessions
- FR10: Persist session metadata to JSON file in workspace
- FR11: Sessions survive container restarts through persistent JSON storage
- FR12: Manually resume sessions after container restart
- FR13: Spawn each session as independent Claude CLI process using node-pty
- FR14: Destroy/terminate sessions
- FR15: Optionally clean up git worktrees when sessions are destroyed

**Git Worktree Management (FR16-FR20):**
- FR16: Create isolated git worktree for each Claude session on separate branch
- FR17: Specify branch name or accept auto-generated branch name
- FR18: Each session operates exclusively within its own worktree directory
- FR19: Execute `git worktree add` command with proper branch creation
- FR20: User responsible for merging/rebasing worktrees (system does not auto-merge)

**Web Interface - Terminal Emulation (FR21-FR28):**
- FR21: Serve browser-based UI accessible at `localhost:3000`
- FR22: Display full terminal emulator using xterm.js for each session
- FR23: Stream Claude CLI stdout/stderr to browser terminal in real-time via WebSocket
- FR24: Send input from browser to Claude CLI stdin
- FR25: Support full TTY features (colors, cursor control, screen clearing)
- FR26: Interrupt current Claude operation using ESC key
- FR27: Interrupt current Claude operation using visible STOP button in UI
- FR28: ESC key and STOP button send SIGINT (Ctrl+C) to Claude PTY process

**Web Interface - Session Navigation (FR29-FR36):**
- FR29: Display tabbed interface for switching between multiple sessions
- FR30: Switch between active sessions via tab selection
- FR31: Display "+" tab button for creating new sessions
- FR32: Each tab shows session name/identifier
- FR33: Tabs display visual indicators for session status
- FR34: Show "last activity" timestamp per session tab
- FR35: Display prominent banner when Claude is waiting for user input
- FR36: Show warning indicator for sessions with no output for extended period

**Web Interface - Workflow Visualization (FR37-FR42):**
- FR37: Parse BMAD workflow status from YAML/markdown files
- FR38: Display visual workflow progress panel showing current step
- FR39: Show completed steps with checkmark indicator
- FR40: Show current step with arrow indicator and highlighting
- FR41: Show upcoming steps with circle indicator
- FR42: Clickable workflow steps for navigation

**Web Interface - Document Viewing (FR43-FR48):**
- FR43: Provide document browser for navigating workspace files
- FR44: Browse folder structures (stories, PRDs, architecture docs)
- FR45: View markdown files rendered in browser
- FR46: Support toggling between current state and diff view
- FR47: Diff view shows changes since last user viewing
- FR48: View documents without leaving the UI

**Web Interface - Notifications & Status (FR49-FR52):**
- FR49: Send browser notifications when Claude asks questions
- FR50: Tab badges indicate sessions requiring attention
- FR51: Display idle timer showing time since last session activity
- FR52: Prioritize status information: stuck warnings > input requests > current workflow step

**Backend Architecture (FR53-FR58):**
- FR53: Use Express.js for HTTP server and static file serving
- FR54: Use WebSocket (ws library) for bidirectional real-time communication
- FR55: Use node-pty for spawning Claude CLI with proper TTY emulation
- FR56: Maintain separate WebSocket connection per session
- FR57: Handle stdin/stdout/stderr streaming for all active sessions concurrently
- FR58: Implement graceful shutdown when container stops

**State & Persistence (FR59-FR63):**
- FR59: Store session state in `/workspace/.claude-container-sessions.json`
- FR60: Use atomic write operations to prevent JSON corruption
- FR61: Handle corrupted session file gracefully
- FR62: Preserve all session metadata across container restarts
- FR63: BMAD workflow state persists in workspace YAML files

**Error Handling & Recovery (FR64-FR68):**
- FR64: Gracefully handle Claude CLI process crashes without affecting other sessions
- FR65: Implement WebSocket reconnection logic for dropped connections
- FR66: Recover from container crashes by reading persisted session state on restart
- FR67: Users can analyze incomplete work and resume sessions manually after crashes
- FR68: Provide error messages and logging for debugging

**Resource Management (FR69-FR72):**
- FR69: Optimize for 4 concurrent sessions
- FR70: Monitor memory and CPU usage per session (optional)
- FR71: Clean up terminated Claude CLI processes
- FR72: Handle resource limits gracefully

**Git Operations (FR73-FR78):**
- FR73: Display git status (modified, staged, untracked files) per session/worktree
- FR74: Stage individual files or all files via UI
- FR75: Unstage files via UI
- FR76: Commit staged files with user-provided or auto-generated message
- FR77: Push commits to remote repository
- FR78: Pull changes from remote repository

**BMAD Artifact Review (FR79-FR84):**
- FR79: Detect BMAD-generated files (files in `.bmad/`, `docs/`, `stories/` paths)
- FR80: Queue detected BMAD files in "Pending Review" state
- FR81: Display pending files with preview, approve, and request changes actions
- FR82: Show diff view for pending files (new content vs empty or previous version)
- FR83: Support batch approval ("Approve All" button)
- FR84: Auto-stage approved files for git commit

**Request Changes Flow (FR85-FR88):**
- FR85: Capture user feedback text when requesting changes
- FR86: Inject feedback message into originating Claude session
- FR87: Track revision count for files that cycle through review multiple times
- FR88: Display inline quick-approve notification when Claude creates files in chat

**Total: 88 Functional Requirements**

---

## FR Coverage Map

| Epic | FRs Covered | Count |
|------|-------------|-------|
| **Epic 1: Foundation & Single-Session Terminal** | FR1-FR7, FR13, FR21-FR28, FR53-FR58, FR71 | 23 FRs |
| **Epic 2: Multi-Session Parallel Development** | FR8-FR12, FR14-FR20, FR29-FR36, FR59-FR63, FR64-FR68, FR69-FR70, FR72 | 30 FRs |
| **Epic 3: Workflow Visibility & Document Review** | FR37-FR48 | 12 FRs |
| **Epic 4: Production Stability & Polish** | FR5, FR49-FR52 + enhancements | 7 FRs |
| **Epic 5: Git Integration & BMAD Review** | FR73-FR88 | 16 FRs |

---

## Epic Details

### Epic 1: Foundation & Single-Session Terminal

**Goal:** Deliver a working browser-based Claude CLI terminal in a sandboxed Docker environment that eliminates approval prompts

**User Value:** Developers can run Claude autonomously in browser without manual tool approvals - the core promise of the product

**Stories:** 12 total (see [epic-1-foundation.md](./epics/epic-1-foundation.md))

---

### Epic 2: Multi-Session Parallel Development

**Goal:** Enable developers to work on 4 features simultaneously with isolated git worktrees and seamless session switching

**User Value:** Developers can parallelize work across multiple epics without context-switching overhead - "getting more while doing less"

**Stories:** 12 total (see [epic-2-multi-session.md](./epics/epic-2-multi-session.md))

---

### Epic 3: Workflow Visibility & Document Review

**Goal:** Provide real-time visibility into BMAD workflow progress and generated artifacts without leaving the browser

**User Value:** Developers can monitor multiple sessions at a glance and review generated documents (PRDs, architecture, code) in-context

**Stories:** 12 total (see [epic-3-workflow-visibility.md](./epics/epic-3-workflow-visibility.md))

---

### Epic 4: Production Stability & Polish

**Goal:** Achieve rock-solid reliability for daily infrastructure use with proper error handling and user feedback

**User Value:** Developers trust Claude Container as THE PRIMARY WORKFLOW - it never crashes, always recovers, and provides clear feedback

**Stories:** 13 total (see [epic-4-production-stability.md](./epics/epic-4-production-stability.md))

---

### Epic 5: Git Integration & Artifact Review

**Goal:** Enable streamlined git operations and BMAD artifact approval directly in the UI, leveraging Epic 6's Sprint Tracker artifact infrastructure

**User Value:** Developers can review Claude-modified files in context of the current story, approve or request changes with one click, and batch-commit approved files - all without typing git commands or leaving the Sprint Tracker workflow

**Architecture:** Git operations get a dedicated sidebar tab (Files | Workflow | Git). Artifact review integrates INTO the Sprint Tracker's existing artifact display (StoryRow/ArtifactList), rather than a separate "Review Panel"

**Stories:** 11 total (see [epic-5-git-review.md](./epics/epic-5-git-review.md))

---

## Validation Criteria Met

✅ **Sprint 1:** Can run an epic in browser without approval prompts
✅ **Sprint 2:** Can develop 4 features simultaneously
✅ **Sprint 3:** Can monitor 4 sessions at a glance and view all generated artifacts
✅ **Sprint 4:** System meets "getting more while doing less" qualitative goal
✅ **Sprint 5:** Can review and approve BMAD artifacts with one click, batch git commits

---

## Story Sizing

- **Total stories:** 60 across 5 epics
- Average story size: ~1 development session (2-4 hours)
- All stories have BDD acceptance criteria (Given/When/Then)
- All stories reference PRD FRs, Architecture decisions, and UX spec patterns
- All stories include technical notes for implementation guidance

---

## Implementation Sequence

**Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 6 → Epic 5** (dependency-based)

Each epic builds on the previous, ensuring:
- Epic 1: Foundation must exist before multi-session
- Epic 2: Sessions must exist before workflow visibility
- Epic 3: Visibility must exist before stability polish
- Epic 4: All features exist before production hardening
- Epic 6: Sprint Tracker with artifact display (implemented before Epic 5)
- Epic 5: Integrates with Epic 6's Sprint Tracker for artifact review

---

**Document Status:** Complete ✓
**Ready for Implementation:** Yes ✓
**All PRD Requirements Mapped:** Yes ✓
**Architecture Alignment:** Yes ✓
**UX Spec Integration:** Yes ✓
