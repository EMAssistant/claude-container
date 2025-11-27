# Claude Container - Testing Guide

## Overview

This guide covers the testing strategy, infrastructure, and practices for the Claude Container project. The test suite includes unit tests, integration tests, and (planned) end-to-end tests to ensure reliability and stability.

### Testing Philosophy

- **Unit tests**: Fast, isolated tests for individual functions/components
- **Integration tests**: Test interactions between modules (WebSocket flows, shutdown sequences)
- **E2E tests** (planned): Full user journey validation with Playwright
- **Coverage targets**: 70% backend, 50% frontend

### Current Status

**Backend Coverage** (as of 2025-11-26):
- Statements: 52.74%
- Branches: 40.72%
- Functions: 60.66%
- Lines: 52.8%
- **Status**: Below 70% target

**Frontend Coverage**:
- Configuration added to vitest.config.ts
- 25 test files, 451 passing tests
- 8 failing tests in SessionModal.test.tsx
- **Status**: Coverage reporting configured but needs fixing failing tests

---

## Running Tests

### Backend Unit Tests

```bash
# Run all tests
cd backend && npm test

# Run with coverage
cd backend && npm run test:coverage

# Run specific test file
cd backend && npm test -- sessionManager.test.ts

# Run in watch mode
cd backend && npm test -- --watch

# View coverage report
open backend/coverage/index.html
```

### Frontend Unit Tests

```bash
# Run all tests
cd frontend && npm test

# Run with coverage
cd frontend && npm run test:coverage

# Run specific test file
cd frontend && npm test -- SessionList.test.tsx

# Run in watch mode
cd frontend && npm test -- --watch

# View coverage report (after running with coverage)
open frontend/coverage/index.html
```

### Integration Tests

```bash
# Backend integration tests
cd backend && npm test -- --testPathPattern=integration

# Specific integration test
cd backend && npm test -- shutdown.integration.test.ts
```

### E2E Tests (Not Yet Implemented)

E2E tests with Playwright are planned but not yet implemented. See "Roadmap" section below.

---

## Test Infrastructure

### Backend Testing Stack

- **Framework**: Jest 29.x
- **TypeScript**: ts-jest
- **Mocking**: Built-in Jest mocks
- **Coverage**: Istanbul (via Jest)

### Frontend Testing Stack

- **Framework**: Vitest
- **React Testing**: @testing-library/react
- **User Events**: @testing-library/user-event
- **Environment**: jsdom
- **Coverage**: v8 provider

### Configuration Files

- `backend/jest.config.js` - Jest configuration
- `frontend/vitest.config.ts` - Vitest configuration (updated with coverage thresholds)

---

## Writing Tests

### Backend Test Patterns

#### Service/Manager Testing

```typescript
// Example: sessionManager.test.ts
import { sessionManager } from '../sessionManager';

describe('SessionManager', () => {
  beforeEach(() => {
    sessionManager.clearAllSessions();
  });

  it('should create a session with correct properties', async () => {
    const session = await sessionManager.createSession({
      name: 'test-session',
      branch: 'feature/test'
    });

    expect(session).toMatchObject({
      name: 'test-session',
      status: 'active',
      branch: 'feature/test',
    });
  });
});
```

#### WebSocket Message Testing

```typescript
// Example: Testing WebSocket messages
it('should send session.status message on status change', (done) => {
  const mockWs = createMockWebSocket();

  mockWs.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'session.status') {
      expect(message).toMatchObject({
        type: 'session.status',
        sessionId: expect.any(String),
        status: 'idle',
      });
      done();
    }
  });

  // Trigger status change...
});
```

### Frontend Test Patterns

#### Component Testing

```typescript
// Example: Component with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionList } from './SessionList';

describe('SessionList', () => {
  it('should render sessions', () => {
    const sessions = [
      { id: '1', name: 'Session 1', status: 'active' },
      { id: '2', name: 'Session 2', status: 'idle' },
    ];

    render(<SessionList sessions={sessions} />);

    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('should call onSelectSession when clicked', () => {
    const onSelectSession = vi.fn();
    const sessions = [{ id: '1', name: 'Session 1', status: 'active' }];

    render(
      <SessionList
        sessions={sessions}
        onSelectSession={onSelectSession}
      />
    );

    fireEvent.click(screen.getByText('Session 1'));
    expect(onSelectSession).toHaveBeenCalledWith('1');
  });
});
```

#### Hook Testing

```typescript
// Example: Testing custom hooks
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

describe('useWebSocket', () => {
  it('should connect to WebSocket on mount', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3001'));

    expect(result.current.isConnected).toBe(true);
  });

  it('should handle disconnection', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3001'));

    act(() => {
      // Simulate disconnect
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });
});
```

### Test Utilities and Helpers

#### Backend Test Utilities

```typescript
// backend/src/__tests__/utils/testUtils.ts
export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-1',
    name: 'test-session',
    status: 'active',
    branch: 'main',
    worktreePath: '/workspace/.worktrees/test-session',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockPTY() {
  return {
    on: jest.fn(),
    write: jest.fn(),
    kill: jest.fn(),
    pid: 12345,
  };
}

export function createMockWebSocket(): any {
  const ws = new EventEmitter();
  (ws as any).send = jest.fn();
  (ws as any).close = jest.fn();
  (ws as any).readyState = 1; // OPEN
  return ws;
}
```

#### Frontend Test Utilities

```typescript
// frontend/src/__tests__/utils/testUtils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Mock providers wrapper
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider>
      <LayoutProvider>
        {children}
      </LayoutProvider>
    </SessionProvider>
  );
};

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: 'mock-session-1',
    name: 'Mock Session',
    status: 'active',
    branch: 'main',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

---

## Coverage Analysis

### Current Backend Coverage Gaps

Files with coverage below 70% target:

1. **server.ts** (17.32%) - Main Express server
   - Most routes not covered by unit tests
   - Requires integration tests

2. **ptyManager.ts** (65.28%) - PTY process management
   - Complex error handling not fully tested
   - Need more edge case tests

3. **fileWatcher.ts** (13.48%) - File system watching
   - Recently added, needs comprehensive tests

4. **routes/sessions.endpoint.ts** (0%) - Session REST endpoints
   - No tests exist yet

5. **utils/atomicWrite.ts** (26.31%) - Atomic file operations
   - Error paths not tested

6. **utils/logger.ts** (62.5%) - Winston logger setup
   - Some initialization paths not covered

### Well-Tested Backend Modules (>80%)

- **backpressureHandler.ts** (94.52%) - WebSocket backpressure handling
- **performanceMonitor.ts** (95.83%) - Performance metrics tracking
- **resourceMonitor.ts** (83.33%) - Memory and process monitoring
- **sessionManager.ts** (82.62%) - Core session management
- **shutdownManager.ts** (95.45%) - Graceful shutdown orchestration
- **statusChecker.ts** (98.07%) - Session status detection
- **statusParser.ts** (100%) - YAML status parsing
- **worktreeManager.ts** (81.75%) - Git worktree operations
- **zombieCleanup.ts** (90%) - Process cleanup
- **errorHandler.ts** (100%) - Error response formatting
- **sanitizeLog.ts** (100%) - Log sanitization

### Frontend Coverage Status

**Current State**:
- 25 test files exist
- 451 tests passing
- 8 tests failing in SessionModal.test.tsx
- Coverage configuration added (50% thresholds)

**Needs**:
- Fix SessionModal.test.tsx failures
- Run coverage to get baseline metrics
- Add tests for uncovered components

---

## Known Issues

### Failing Tests

#### Backend
1. **zombieCleanup.test.ts** (3 failures)
   - Mock logger not being called as expected
   - Needs investigation of module mocking

2. **server.bmad-update.test.ts** (9 failures)
   - Logger mock not capturing calls
   - Timeout issues on one test
   - May need refactoring

#### Frontend
1. **SessionModal.test.tsx** (8 failures)
   - Cannot find "Create" button text
   - Button text may have changed to "Create Session"
   - Easy fix: update test selectors

---

## Test Best Practices

### General Principles

1. **AAA Pattern**: Arrange, Act, Assert
2. **One assertion per test** (when possible)
3. **Descriptive test names**: "should [expected behavior] when [condition]"
4. **Avoid test interdependence**: Each test should run independently
5. **Use beforeEach/afterEach** for setup/cleanup

### Mocking Guidelines

1. **Mock external dependencies**: File system, network, processes
2. **Don't mock what you're testing**
3. **Use test doubles sparingly**: Prefer real implementations when fast enough
4. **Clear mocks between tests**: `jest.clearAllMocks()` in beforeEach

### Async Testing

```typescript
// Good: Use async/await
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toEqual(expectedData);
});

// Good: Use done callback for event-driven code
it('should emit event', (done) => {
  emitter.on('event', (data) => {
    expect(data).toEqual(expectedData);
    done();
  });
  emitter.trigger();
});

// Bad: Using setTimeout
it('should complete eventually', (done) => {
  setTimeout(() => {
    expect(something).toBe(true);
    done();
  }, 1000); // Flaky!
});
```

### Fake Timers

```typescript
// Use Jest fake timers for time-dependent tests
it('should transition to idle after 5 minutes', () => {
  jest.useFakeTimers();

  const session = createSession();

  // Fast-forward 5 minutes
  jest.advanceTimersByTime(5 * 60 * 1000);

  expect(session.status).toBe('idle');

  jest.useRealTimers();
});
```

---

## CI/CD Integration (Planned)

### GitHub Actions Workflow

**Location**: `.github/workflows/ci.yml` (not yet created)

**Proposed workflow**:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install backend dependencies
        run: cd backend && npm ci

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Backend unit tests
        run: cd backend && npm run test:coverage

      - name: Frontend unit tests
        run: cd frontend && npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info

      - name: Bundle size check
        run: |
          cd frontend && npm run build
          BUNDLE_SIZE=$(du -sk dist/assets/*.js | awk '{sum+=$1} END {print sum}')
          if [ $BUNDLE_SIZE -gt 500 ]; then
            echo "ERROR: Bundle exceeds 500KB"
            exit 1
          fi
```

---

## E2E Testing Roadmap (Playwright)

### Planned Setup

1. **Install Playwright**:
   ```bash
   cd frontend
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Create playwright.config.ts**:
   ```typescript
   import { defineConfig } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',
     use: {
       baseURL: 'http://localhost:3000',
       screenshot: 'only-on-failure',
       video: 'retain-on-failure',
     },
   });
   ```

3. **Critical E2E Test Paths**:

   a. **Session Lifecycle**
      - Create session
      - Simulate idle (5 min)
      - Verify badge change
      - Simulate stuck (30 min)
      - Verify warning banner

   b. **Toast Notifications**
      - Session creation → success toast
      - Error simulation → error toast
      - Verify auto-dismiss timing

   c. **Keyboard Shortcuts**
      - Cmd+1-4 navigation
      - Cmd+N modal open
      - ESC close

   d. **Browser Notifications** (if permissions)
      - Background session question
      - Notification appears
      - Click focuses session

   e. **Container Restart**
      - 3 sessions active
      - docker stop
      - docker start
      - Sessions restore

---

## Troubleshooting

### Common Issues

#### "Cannot find module" errors
- Ensure dependencies are installed: `npm install`
- Check tsconfig.json paths configuration

#### Tests timeout
- Increase timeout: `jest.setTimeout(10000)`
- Check for unresolved promises
- Ensure proper cleanup in afterEach

#### Flaky tests
- Use fake timers instead of real delays
- Avoid race conditions with proper async/await
- Use `waitFor` from @testing-library for UI updates

#### Mock not working
- Ensure mock is set up before import
- Use `jest.mock()` at top of file
- Clear mocks between tests

### Debugging Tests

```bash
# Run single test in debug mode (Node.js debugger)
node --inspect-brk node_modules/.bin/jest --runInBand sessionManager.test.ts

# Run with verbose output
npm test -- --verbose

# Run with coverage for specific file
npm test -- --coverage --collectCoverageFrom=src/sessionManager.ts
```

---

## Test Maintenance

### When to Update Tests

1. **API changes**: Update tests to match new signatures
2. **Behavior changes**: Modify assertions to match new behavior
3. **UI text changes**: Update selectors and text matchers
4. **New features**: Add new test cases

### Keeping Tests Fast

1. **Mock slow operations**: File I/O, network, external processes
2. **Use fake timers**: Don't wait for real delays
3. **Parallel execution**: Jest/Vitest run tests in parallel by default
4. **Focused tests**: Use `.only` during development, remove before commit

### Reducing Test Maintenance Burden

1. **Test behavior, not implementation**: Focus on outputs, not internals
2. **Use test utilities**: Share common setup/mocking logic
3. **Keep tests simple**: Complex tests are hard to maintain
4. **Group related tests**: Use `describe` blocks for organization

---

## Next Steps

### To Reach 70% Backend Coverage

1. Fix failing tests:
   - zombieCleanup.test.ts logger mocking
   - server.bmad-update.test.ts logger mocking

2. Add tests for low-coverage files:
   - server.ts: Create integration tests for main routes
   - ptyManager.ts: Add edge case tests for error handling
   - fileWatcher.ts: Comprehensive unit tests
   - routes/sessions.endpoint.ts: Full endpoint testing
   - utils/atomicWrite.ts: Error path testing

3. Improve existing test suites:
   - Add more branch coverage (currently 40.72%)
   - Test error paths and edge cases

### To Reach 50% Frontend Coverage

1. Fix SessionModal.test.tsx:
   - Update button text selectors to match actual UI
   - Verify modal rendering logic

2. Run coverage report to get baseline

3. Identify uncovered components/hooks

4. Add missing tests prioritizing:
   - Critical user flows
   - Business logic
   - Error handling

### To Add E2E Testing

1. Install Playwright
2. Create playwright.config.ts
3. Set up frontend/e2e/ directory
4. Implement 5 critical paths (listed above)
5. Add to CI pipeline

### To Add CI/CD

1. Create .github/workflows/ci.yml
2. Configure GitHub Actions
3. Add Codecov integration
4. Set up automated checks on PRs

---

## Resources

### Testing Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)

### Internal References
- `docs/architecture.md` - System architecture overview
- `docs/sprint-artifacts/tech-spec-epic-4.md` - Epic 4 testing requirements
- `docs/sprint-artifacts/4-11-comprehensive-testing-suite.md` - This story

---

## Appendix: Test Coverage Metrics Explained

### Coverage Types

- **Statement coverage**: % of code statements executed
- **Branch coverage**: % of if/else branches taken
- **Function coverage**: % of functions called
- **Line coverage**: % of lines executed

### Coverage Thresholds

| Metric | Backend Target | Frontend Target | Current Backend | Current Frontend |
|--------|---------------|-----------------|-----------------|------------------|
| Statements | 70% | 50% | 52.74% | TBD |
| Branches | 70% | 50% | 40.72% | TBD |
| Functions | 70% | 50% | 60.66% | TBD |
| Lines | 70% | 50% | 52.8% | TBD |

### Interpreting Coverage Reports

- **Green**: Well tested
- **Yellow**: Partially tested, gaps exist
- **Red**: Not tested or minimal coverage

**Note**: High coverage doesn't guarantee quality tests. Focus on testing behavior and edge cases, not just reaching a number.
