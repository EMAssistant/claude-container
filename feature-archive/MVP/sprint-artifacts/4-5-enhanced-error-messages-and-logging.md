# Story 4.5: Enhanced Error Messages and Logging

Status: drafted

## Story

As a developer using Claude Container,
I want comprehensive error messages that explain what went wrong and how to fix it, along with detailed backend logging for debugging,
so that I can quickly resolve issues without guessing root causes and support can diagnose problems efficiently.

## Acceptance Criteria

1. **AC4.15**: Error messages include suggestion
   - Given: A validation error occurs (invalid session name, branch exists, etc.)
   - When: Error response is returned to frontend
   - Then: Error message follows pattern "What happened" + "Why" + "How to fix"
   - And: Error includes `suggestion` field with actionable guidance (e.g., "Example: feature-auth")
   - And: Error includes `type` field for categorization (validation, git, pty, resource, internal)

2. **AC4.16**: Backend logs include session context
   - Given: Any backend operation occurs
   - When: Log entry is written
   - Then: Log includes `sessionId` field (if session-related)
   - And: Log includes `timestamp` field (ISO 8601 UTC)
   - And: Log includes structured metadata (level, message, context)
   - And: Logs use Winston JSON format for structured parsing

3. **AC4.17**: PTY crash logged with last 100 lines
   - Given: A PTY process crashes unexpectedly
   - When: Crash is detected
   - Then: Error log includes last 100 lines of PTY output
   - And: Log includes exit code, signal, and session context
   - And: Log level is `error`
   - And: Crash triggers session status change to 'error'

4. **Error response structure standardized**: All API error responses follow consistent schema
   - Given: Any REST API endpoint returns an error (4xx or 5xx)
   - When: Error response is sent
   - Then: Response follows ErrorResponse interface (type, message, details, suggestion, code)
   - And: HTTP status code matches error type (400 validation, 409 conflict, 503 resource, 500 internal)
   - And: Frontend displays error message with suggestion

5. **Sensitive data filtering**: No secrets or credentials appear in logs
   - Given: Log entry contains API keys, tokens, or passwords
   - When: Log is written
   - Then: Sensitive fields are redacted (replaced with `[REDACTED]`)
   - And: Filter catches patterns: `api_key`, `token`, `password`, `secret`, `credential`
   - And: Environment variables containing secrets are not logged

6. **Frontend error handling**: User-friendly error messages displayed in UI
   - Given: Backend returns error response
   - When: Frontend receives error
   - Then: Toast notification shows error message (from `message` field)
   - And: If `suggestion` exists, show in toast or dialog
   - And: Console.error logs full error details for debugging (not user-visible)
   - And: XSS prevention: error messages sanitized before rendering

7. **Log levels appropriately used**: Logs categorized by severity
   - Given: Different types of events occur
   - When: Logs are written
   - Then: Log levels used correctly:
     - `error`: Crashes, API failures, unrecoverable errors
     - `warn`: Resource warnings, deprecated features, stuck sessions
     - `info`: Session lifecycle, status changes, normal operations
     - `debug`: Detailed WebSocket messages, PTY output samples (verbose)
   - And: Production uses `info` level minimum (no debug logs)

8. **Git operation errors**: Git errors translated to user-friendly messages
   - Given: Git operation fails (branch exists, worktree conflict, etc.)
   - When: Error is caught
   - Then: Generic git error transformed to specific message
   - And: Suggestion provided (e.g., "Delete existing worktree first")
   - And: Error type set to 'git'

9. **Frontend unit tests**: Error handling tested
   - Test: Toast notification shows error message from API
   - Test: Error messages sanitized (XSS prevention)
   - Test: Suggestion field displayed when present
   - Coverage: ≥50% for error-handling code

10. **Backend unit tests**: Logging and error formatting tested
    - Test: Winston logger includes sessionId and timestamp
    - Test: Sensitive data filtered from logs
    - Test: ErrorResponse structure matches interface
    - Test: PTY crash logging includes last 100 lines
    - Coverage: ≥70% for logging/error utilities

## Tasks / Subtasks

- [ ] Task 1: Define ErrorResponse interface and error types (AC: #1, #4)
  - [ ] Create `backend/src/types.ts` error types (if not already present, extend existing)
  - [ ] Define ErrorResponse interface:
    - `type: 'validation' | 'git' | 'pty' | 'resource' | 'internal'`
    - `message: string` (user-friendly)
    - `details?: string` (technical details)
    - `suggestion?: string` (how to fix)
    - `code?: string` (machine-readable code like 'BRANCH_EXISTS')
  - [ ] Export interface for use in error handlers

- [ ] Task 2: Create centralized error handler utility (AC: #1, #4, #8)
  - [ ] Create `backend/src/utils/errorHandler.ts`
  - [ ] Implement `createErrorResponse()` function:
    - Input: error type, message, details, suggestion, code
    - Output: ErrorResponse object
  - [ ] Implement git error translator `translateGitError()`:
    - Detect common git errors (branch exists, worktree in use, etc.)
    - Return user-friendly message + suggestion
  - [ ] Add unit tests for error handler (10+ test cases)

- [ ] Task 3: Update all API endpoints to use ErrorResponse (AC: #1, #4)
  - [ ] Update `backend/src/server.ts` session creation endpoint:
    - Validation errors → 400 with ErrorResponse
    - Git errors → 409 with ErrorResponse
    - PTY errors → 500 with ErrorResponse
  - [ ] Update session destroy endpoint with ErrorResponse
  - [ ] Update file tree endpoint with ErrorResponse
  - [ ] Update BMAD update endpoint with ErrorResponse
  - [ ] Add example error responses to API documentation

- [ ] Task 4: Configure Winston logger with structured JSON format (AC: #2, #7)
  - [ ] Install Winston if not present: `npm install winston`
  - [ ] Create `backend/src/utils/logger.ts`
  - [ ] Configure Winston with JSON format:
    - Timestamp: ISO 8601 UTC
    - Levels: error, warn, info, debug
    - Metadata fields: sessionId, userId, operation
  - [ ] Set production log level to `info` (via NODE_ENV check)
  - [ ] Export logger singleton for use across backend

- [ ] Task 5: Implement sensitive data filtering (AC: #5)
  - [ ] Create `backend/src/utils/sanitizeLog.ts`
  - [ ] Implement filter for sensitive patterns:
    - Redact fields: `api_key`, `token`, `password`, `secret`, `credential`
    - Use regex to catch variations (case-insensitive)
  - [ ] Apply filter to Winston log transport (as middleware)
  - [ ] Add unit tests for sensitive data filtering (5+ test cases)

- [ ] Task 6: Add session context to all log entries (AC: #2)
  - [ ] Update sessionManager to include sessionId in all logs
  - [ ] Update PTY handlers to include sessionId in logs
  - [ ] Update WebSocket handlers to include sessionId in logs
  - [ ] Verify all session-related operations log with sessionId
  - [ ] Add timestamp to all log entries (handled by Winston config)

- [ ] Task 7: Implement PTY crash logging with output buffer (AC: #3)
  - [ ] Update `backend/src/ptyManager.ts` (or sessionManager):
    - Maintain circular buffer of last 100 PTY output lines per session
    - On PTY exit event, check if unexpected (non-zero exit or signal)
    - If crash detected, log error with buffer contents
  - [ ] Log PTY crash with:
    - sessionId, exit code, signal
    - Last 100 lines of output
    - Timestamp
  - [ ] Update session status to 'error' on crash
  - [ ] Add unit test for crash logging (mock PTY exit)

- [ ] Task 8: Update frontend to display error messages with suggestions (AC: #6)
  - [ ] Update useWebSocket hook to parse ErrorResponse
  - [ ] Update SessionModal to show error suggestion in toast
  - [ ] Update TopBar BMAD update to show error suggestion
  - [ ] Sanitize error messages before rendering (XSS prevention):
    - Use `textContent` or sanitize HTML
  - [ ] Console.error log full error details (for developer debugging)
  - [ ] Add unit tests for error display (frontend)

- [ ] Task 9: Write comprehensive unit tests (AC: #9, #10)
  - [ ] Backend tests (`errorHandler.test.ts`):
    - Test createErrorResponse() structure
    - Test git error translation (5+ error types)
    - Test ErrorResponse matches interface
  - [ ] Backend tests (`logger.test.ts`):
    - Test Winston JSON format output
    - Test sessionId included in logs
    - Test sensitive data filtering
  - [ ] Backend tests (`ptyManager.test.ts`):
    - Test PTY crash logging with buffer
    - Test exit code and signal logged
  - [ ] Frontend tests:
    - Test error toast displays message + suggestion
    - Test XSS prevention in error messages
  - [ ] Verify ≥70% backend coverage, ≥50% frontend coverage

- [ ] Task 10: Update documentation with error codes and troubleshooting (AC: #1)
  - [ ] Create or update `docs/error-codes.md`:
    - List all error types and codes (BRANCH_EXISTS, etc.)
    - Document common errors with solutions
  - [ ] Update README troubleshooting section with error examples
  - [ ] Add API error response examples to websocket-protocol.md

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**ErrorResponse Interface (AC4.15)**:
```typescript
interface ErrorResponse {
  error: {
    type: 'validation' | 'git' | 'pty' | 'resource' | 'internal';
    message: string;           // User-friendly message
    details?: string;          // Technical details
    suggestion?: string;       // How to fix
    code?: string;             // Machine-readable code (e.g., 'BRANCH_EXISTS')
  }
}
```

**Error Message Pattern (Architecture "User-Facing Error Messages")**:
- **What happened**: "Branch already exists"
- **Why**: "A worktree already exists for branch 'feature/feature-auth'."
- **How to fix**: "Choose a different branch name or delete the existing worktree."

**Example Error Responses**:
```typescript
// 400 Bad Request - Validation error
{
  "error": {
    "type": "validation",
    "message": "Invalid session name",
    "details": "Session names must be alphanumeric with dashes only (max 50 characters).",
    "suggestion": "Example: 'feature-auth'"
  }
}

// 409 Conflict - Branch exists
{
  "error": {
    "type": "git",
    "message": "Branch already exists",
    "details": "A worktree already exists for branch 'feature/feature-auth'.",
    "suggestion": "Choose a different branch name or delete the existing worktree.",
    "code": "BRANCH_EXISTS"
  }
}

// 503 Service Unavailable - Resource exhaustion
{
  "error": {
    "type": "resource",
    "message": "Maximum resource capacity reached",
    "details": "Memory usage is at 93%. Cannot create new sessions.",
    "suggestion": "Close idle sessions before creating new ones."
  }
}
```

**From Architecture (docs/architecture.md)**:

**Logging Strategy (ADR - Logging)**:
- Winston structured JSON logging
- Levels: error, warn, info, debug
- Session context included in all logs
- Production minimum level: `info`

**Winston Configuration Pattern**:
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'claude-container' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

**Log Format (Winston JSON)**:
```json
{
  "level": "info",
  "message": "Session status changed",
  "sessionId": "abc123",
  "from": "active",
  "to": "waiting",
  "timestamp": "2025-11-25T10:30:00.000Z"
}
```

**Sensitive Data Filtering (Security)**:
```typescript
// Redact sensitive fields before logging
const sensitivePatterns = [
  /api_key/i,
  /token/i,
  /password/i,
  /secret/i,
  /credential/i,
  /authorization/i
];

function sanitizeLog(obj: any): any {
  if (typeof obj === 'string') {
    for (const pattern of sensitivePatterns) {
      if (pattern.test(obj)) return '[REDACTED]';
    }
    return obj;
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitivePatterns.some(p => p.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLog(value);
      }
    }
    return sanitized;
  }
  return obj;
}
```

**PTY Crash Logging with Buffer (AC4.17)**:
```typescript
// Maintain circular buffer of last 100 PTY output lines
class PTYOutputBuffer {
  private buffer: string[] = [];
  private maxSize = 100;

  add(line: string): void {
    this.buffer.push(line);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): string[] {
    return [...this.buffer];
  }
}

// On PTY exit
pty.onExit(({ exitCode, signal }) => {
  if (exitCode !== 0 || signal) {
    logger.error('PTY crashed', {
      sessionId,
      exitCode,
      signal,
      lastOutput: outputBuffer.getAll()
    });
    sessionManager.updateStatus(sessionId, 'error');
  }
});
```

### Project Structure Notes

**Files to Create:**
```
backend/src/
├── utils/errorHandler.ts          # ErrorResponse creation and git error translation
├── utils/logger.ts                 # Winston logger singleton
├── utils/sanitizeLog.ts            # Sensitive data filtering
├── utils/errorHandler.test.ts      # Unit tests for error handler
├── utils/logger.test.ts            # Unit tests for logger
└── utils/sanitizeLog.test.ts       # Unit tests for sanitizer

docs/
└── error-codes.md                  # Error code documentation (optional)
```

**Files to Modify:**
```
backend/src/
├── server.ts                       # Update all endpoints to use ErrorResponse
├── sessionManager.ts               # Add logger with sessionId context
├── ptyManager.ts                   # Add PTY crash logging with buffer
├── types.ts                        # Add ErrorResponse interface

frontend/src/
├── components/SessionModal.tsx     # Display error suggestions in toast
├── components/TopBar.tsx           # Display error suggestions for BMAD update
└── hooks/useWebSocket.ts           # Parse ErrorResponse, show toast
```

**New Dependencies:**
```json
{
  "backend": {
    "winston": "^3.11.0"  // Structured logging (may already be installed)
  }
}
```

### Implementation Guidance

**Error Handler Utility Pattern**:
```typescript
// backend/src/utils/errorHandler.ts
import { ErrorResponse } from '../types';

export function createErrorResponse(
  type: ErrorResponse['error']['type'],
  message: string,
  details?: string,
  suggestion?: string,
  code?: string
): ErrorResponse {
  return {
    error: {
      type,
      message,
      ...(details && { details }),
      ...(suggestion && { suggestion }),
      ...(code && { code })
    }
  };
}

export function translateGitError(gitError: Error): ErrorResponse {
  const message = gitError.message.toLowerCase();

  if (message.includes('already exists') && message.includes('branch')) {
    return createErrorResponse(
      'git',
      'Branch already exists',
      gitError.message,
      'Choose a different branch name or delete the existing worktree.',
      'BRANCH_EXISTS'
    );
  }

  if (message.includes('worktree') && message.includes('locked')) {
    return createErrorResponse(
      'git',
      'Worktree is locked',
      gitError.message,
      'Another process may be using this worktree. Wait or force unlock.',
      'WORKTREE_LOCKED'
    );
  }

  // Generic git error
  return createErrorResponse(
    'git',
    'Git operation failed',
    gitError.message,
    'Check git configuration and try again.'
  );
}
```

**Usage in API Endpoints**:
```typescript
// backend/src/server.ts
import { createErrorResponse, translateGitError } from './utils/errorHandler';
import { logger } from './utils/logger';

app.post('/api/sessions', async (req, res) => {
  try {
    const { name, branch } = req.body;

    // Validation
    if (!name || !/^[a-zA-Z0-9-]+$/.test(name) || name.length > 50) {
      const error = createErrorResponse(
        'validation',
        'Invalid session name',
        'Session names must be alphanumeric with dashes only (max 50 characters).',
        'Example: feature-auth'
      );
      logger.warn('Session creation validation failed', { name, error });
      return res.status(400).json(error);
    }

    // Git operation
    const session = await sessionManager.createSession(name, branch);
    logger.info('Session created', { sessionId: session.id, name, branch });
    res.json({ session });

  } catch (error) {
    // Check if git error
    if (error.message?.includes('git')) {
      const errorResponse = translateGitError(error);
      logger.error('Git error during session creation', { error: errorResponse });
      return res.status(409).json(errorResponse);
    }

    // Generic error
    const errorResponse = createErrorResponse(
      'internal',
      'Failed to create session',
      error.message,
      'Try again or check server logs for details.'
    );
    logger.error('Session creation failed', { error: errorResponse, stack: error.stack });
    res.status(500).json(errorResponse);
  }
});
```

**Frontend Error Handling**:
```typescript
// frontend/src/components/SessionModal.tsx
import { useToast } from '@/components/ToastProvider';

const handleCreate = async () => {
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, branch })
    });

    if (!response.ok) {
      const errorData = await response.json();
      const { error } = errorData;

      // Show user-friendly error message with suggestion
      showToast({
        type: 'error',
        message: error.suggestion
          ? `${error.message}\n\n${error.suggestion}`
          : error.message,
        autoDismiss: true,
        dismissDelay: 8000
      });

      // Log full error for debugging
      console.error('Session creation failed:', errorData);
      return;
    }

    const { session } = await response.json();
    showToast({
      type: 'success',
      message: `Session created: ${session.name}`,
      autoDismiss: true,
      dismissDelay: 4000
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    showToast({
      type: 'error',
      message: 'An unexpected error occurred. Please try again.',
      autoDismiss: true,
      dismissDelay: 8000
    });
  }
};
```

**Testing Considerations:**
- Mock Winston logger in tests to verify log calls
- Test error handler with various git error messages
- Test sensitive data filtering with mock log objects containing secrets
- Test PTY crash logging by simulating exit events with non-zero codes
- Test frontend error display with mock API error responses
- Verify XSS prevention by testing error messages with HTML/script tags

### Learnings from Previous Story

**From Story 4-4 (Toast Notifications for User Feedback)**

**Status**: drafted

**Integration Points for This Story:**
- **ToastProvider** will be used to display error messages from ErrorResponse
  - File: `frontend/src/components/ToastProvider.tsx` (to be created in Story 4.4)
  - This story uses `showToast()` with type 'error' to display error messages
  - Error messages should be sanitized before passing to toast (XSS prevention)

**Patterns to Follow:**
- **Toast for error feedback**: All error messages should trigger error toasts
- **Longer auto-dismiss for errors**: Use 8s dismissDelay for error toasts (per Story 4.4 spec)
- **Error message structure**: Pass `error.message` + `error.suggestion` (if present) to toast
- **Console logging**: Use `console.error()` for full error details (developer debugging)

**Dependencies:**
- Story 4.4 creates ToastProvider component (not yet implemented)
- This story assumes ToastProvider will be available
- If Story 4.4 incomplete, temporarily use console.error() for error display

**Files Created in Story 4.4 (to be used here):**
- `frontend/src/components/ToastProvider.tsx` - Toast context + Radix integration
- `frontend/src/types.ts` - ToastNotification interface
- Toast integration in `App.tsx`, `SessionModal.tsx`, `useWebSocket.ts`

**Error Handling Pattern from Story 4.4:**
```typescript
// SessionModal example from Story 4.4
showToast({
  type: 'error',
  message: `Failed to create session: ${error.message}`,
  autoDismiss: true,
  dismissDelay: 8000
});
```

**Enhancements for This Story:**
- Extend error toast pattern to include `error.suggestion` field
- Add XSS sanitization before rendering error messages
- Ensure all API error responses use standardized ErrorResponse structure

**No Files to Reuse from Story 4.4:**
- Story 4.4 is not yet implemented (status: drafted)
- This story creates backend error handling infrastructure (independent of toast UI)
- Both stories will integrate when Story 4.4 is implemented (error toasts will use ErrorResponse)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#APIs-and-Interfaces] - ErrorResponse interface schema
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.15-AC4.17 error requirements
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Observability] - Winston JSON log format
- [Source: docs/architecture.md#Error-Handling] - Error handling strategy and patterns
- [Source: docs/architecture.md#Logging-Strategy] - Winston configuration and log levels
- [Source: docs/sprint-artifacts/4-4-toast-notifications-for-user-feedback.md#Dev-Notes] - Toast notification integration

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-4 (ToastProvider pattern)
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
