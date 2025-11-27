# Story 4.9: Keyboard Shortcuts and Accessibility Enhancements

Status: drafted

## Story

As a developer using Claude Container,
I want complete keyboard navigation and accessibility compliance,
so that I can navigate efficiently without a mouse and ensure the tool is usable by developers with disabilities.

## Acceptance Criteria

1. **AC4.28**: Cmd+1-4 switches sessions
   - Given: Frontend has 2+ sessions created
   - When: User presses Cmd+1 (macOS) or Ctrl+1 (Windows/Linux)
   - Then: First session tab activates
   - And: Terminal receives focus
   - When: User presses Cmd+2-4 (or Ctrl+2-4)
   - Then: Corresponding session activates (if exists)
   - And: If session doesn't exist, no action taken
   - And: Shortcut works globally except when terminal has focus (terminal raw mode intercepts)

2. **AC4.29**: Cmd+N opens new session modal
   - Given: Frontend loaded
   - When: User presses Cmd+N (macOS) or Ctrl+N (Windows/Linux)
   - Then: SessionModal opens with focus on session name input
   - And: Shortcut works globally except when terminal has focus
   - And: If modal already open, no action taken

3. **AC4.30**: Cmd+T/A/W changes layout
   - Given: Frontend loaded with session active
   - When: User presses Cmd+T (Ctrl+T on Windows/Linux)
   - Then: Layout shifts to 100% terminal view
   - And: MainContentArea updates immediately (<20ms)
   - When: User presses Cmd+A (Ctrl+A)
   - Then: Layout shifts to 70/30 artifact/terminal split
   - And: ArtifactViewer receives focus
   - When: User presses Cmd+W (Ctrl+W)
   - Then: Left sidebar toggles between 'files' and 'workflow' view
   - And: LeftSidebar updates tab selection

4. **AC4.31**: ESC closes modals
   - Given: SessionModal or other dismissible modal is open
   - When: User presses ESC key
   - Then: Modal closes immediately
   - And: Focus returns to previous active element (if tracked)
   - And: Non-destructive modals only (destructive actions require explicit confirmation)
   - Given: Terminal has focus
   - When: User presses ESC
   - Then: Modal behavior does NOT trigger (terminal intercepts for SIGINT)

5. **AC4.32**: Focus ring visible on all interactive elements
   - Given: User navigates with Tab key
   - When: Any interactive element receives focus (:focus-visible state)
   - Then: 2px solid outline displayed with color #88C0D0 (Oceanic Calm blue)
   - And: Outline offset 2px from element border
   - And: Focus ring visible on: buttons, inputs, tabs, file tree items, session list items
   - And: No focus ring on mouse click (only keyboard focus)

6. **AC4.33**: Screen reader announces status changes
   - Given: Session status changes (active → idle, active → waiting, etc.)
   - When: Status update occurs
   - Then: ARIA live region announces: "Session [name] is now [status]"
   - And: Announcement is polite (aria-live="polite"), not assertive
   - And: Critical errors use assertive (aria-live="assertive"): "Session [name] crashed"
   - Given: Workflow phase changes
   - When: BMAD workflow advances step
   - Then: ARIA live region announces: "Workflow step: [step name] completed"

7. **AC4.34**: Reduced motion preference respected
   - Given: User has prefers-reduced-motion enabled in OS settings
   - When: Frontend renders any animation (toast slide-in, layout shift, modal fade)
   - Then: All animations disabled or replaced with instant transitions
   - And: CSS media query `@media (prefers-reduced-motion: reduce)` applies
   - And: React animations (if any) check `window.matchMedia('(prefers-reduced-motion: reduce)')`

8. **Keyboard shortcut registry**: Centralized shortcut management
   - Given: Frontend initializes
   - When: useKeyboardShortcuts hook loads
   - Then: All shortcuts registered in single registry:
     ```typescript
     const shortcuts = [
       { key: '1', modifiers: ['meta'], action: 'switchSession1', description: 'Switch to session 1' },
       { key: '2', modifiers: ['meta'], action: 'switchSession2', description: 'Switch to session 2' },
       { key: '3', modifiers: ['meta'], action: 'switchSession3', description: 'Switch to session 3' },
       { key: '4', modifiers: ['meta'], action: 'switchSession4', description: 'Switch to session 4' },
       { key: 'n', modifiers: ['meta'], action: 'newSession', description: 'Create new session' },
       { key: 't', modifiers: ['meta'], action: 'focusTerminal', description: 'Focus terminal (100% view)' },
       { key: 'a', modifiers: ['meta'], action: 'focusArtifacts', description: 'Focus artifacts (70/30 split)' },
       { key: 'w', modifiers: ['meta'], action: 'toggleSidebarView', description: 'Toggle Files/Workflow sidebar' },
       { key: 'Escape', modifiers: [], action: 'closeModal', description: 'Close modal' }
     ];
     ```
   - And: Platform detection uses navigator.platform to determine Cmd vs Ctrl
   - And: Shortcuts disabled when terminal has focus (except ESC)

9. **ARIA labels and roles**: Complete semantic HTML
   - TopBar: `<header role="banner">`
   - LeftSidebar: `<aside role="complementary" aria-label="Navigation sidebar">`
   - MainContentArea: `<main role="main">`
   - SessionList (future right sidebar): `<aside role="complementary" aria-label="Session list">`
   - SessionModal: `<dialog role="dialog" aria-labelledby="modal-title">`
   - Buttons: All have descriptive aria-label (e.g., "Create new session", "Close session", "Stop command")
   - File tree items: `role="treeitem"` with aria-expanded for folders
   - Workflow steps: `role="list"` with aria-current="step" for current phase

10. **Tab order and focus management**: Logical navigation
    - Tab order: TopBar actions → LeftSidebar tabs → LeftSidebar content → MainContentArea → SessionList (future)
    - Modal opens: Focus moves to first interactive element (session name input)
    - Modal closes: Focus returns to trigger button (if tracked) or main content
    - Session switch: Focus moves to terminal
    - Artifact viewer: Focus on file tree click

11. **Frontend unit tests**: Keyboard shortcut logic
    - Test: Cmd+1 triggers switchSession(0)
    - Test: Cmd+N opens SessionModal
    - Test: Cmd+T sets layout mode to 'terminal'
    - Test: Cmd+A sets layout mode to 'split' with artifact focus
    - Test: Cmd+W toggles leftSidebarView
    - Test: ESC closes modal when modal open
    - Test: ESC does NOT close modal when terminal has focus
    - Test: Platform detection (macOS uses 'meta', Windows/Linux use 'ctrl')
    - Test: Shortcuts disabled when terminal focused
    - Coverage: ≥50% for useKeyboardShortcuts hook

12. **Accessibility audit**: Automated and manual testing
    - Test: Run axe-core on main UI (zero critical/serious violations)
    - Test: Navigate entire UI with Tab key only (all actions reachable)
    - Test: VoiceOver (macOS) or NVDA (Windows) announces status changes
    - Test: Focus rings visible on all interactive elements
    - Test: Reduced motion: toggle OS setting, verify animations disabled
    - Test: Contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for UI components)

## Tasks / Subtasks

- [ ] Task 1: Create useKeyboardShortcuts hook (AC: #1, #2, #3, #8)
  - [ ] Create `frontend/src/hooks/useKeyboardShortcuts.ts`
  - [ ] Implement keyboard shortcut registry with KeyboardShortcut interface:
    ```typescript
    interface KeyboardShortcut {
      key: string;
      modifiers: ('meta' | 'ctrl' | 'alt' | 'shift')[];
      action: string;
      description: string;
      enabled: boolean;
    }
    ```
  - [ ] Implement platform detection:
    - Check `navigator.platform` for macOS (Darwin, Mac) → use 'meta'
    - All other platforms → use 'ctrl'
  - [ ] Register all shortcuts: Cmd/Ctrl+1-4, Cmd/Ctrl+N, Cmd/Ctrl+T, Cmd/Ctrl+A, Cmd/Ctrl+W, ESC
  - [ ] Add global keydown listener (window.addEventListener)
  - [ ] Implement shortcut matching logic:
    - Parse event.key, event.metaKey, event.ctrlKey, event.altKey, event.shiftKey
    - Match against registry
    - Call action handler if match
  - [ ] Add terminal focus detection:
    - Check if document.activeElement is within Terminal component
    - Disable shortcuts (except ESC) when terminal focused
  - [ ] Implement action handlers:
    - `switchSession1-4`: Call SessionContext.switchSession(index)
    - `newSession`: Open SessionModal
    - `focusTerminal`: LayoutContext.setMainContentMode('terminal')
    - `focusArtifacts`: LayoutContext.setMainContentMode('split') + focus artifact
    - `toggleSidebarView`: LayoutContext.toggleLeftSidebarView()
    - `closeModal`: Close active modal (if any)
  - [ ] Cleanup listener on unmount

- [ ] Task 2: Integrate useKeyboardShortcuts into App.tsx (AC: #1, #2, #3)
  - [ ] Import and call useKeyboardShortcuts() in App.tsx
  - [ ] Pass SessionContext and LayoutContext as dependencies
  - [ ] Verify shortcuts work across all app states
  - [ ] Test modal open/close with Cmd+N and ESC
  - [ ] Test session switching with Cmd+1-4
  - [ ] Test layout changes with Cmd+T, Cmd+A, Cmd+W

- [ ] Task 3: Add ESC key handler to modals (AC: #4)
  - [ ] Update SessionModal to listen for ESC key
  - [ ] Close modal on ESC keydown
  - [ ] Prevent ESC propagation to terminal when modal open
  - [ ] Track previous focus element before modal opens
  - [ ] Return focus to previous element on close
  - [ ] Verify ESC does NOT close modal when terminal has focus (terminal intercepts)

- [ ] Task 4: Implement focus ring styles (AC: #5)
  - [ ] Add global CSS for :focus-visible state:
    ```css
    *:focus-visible {
      outline: 2px solid #88C0D0;
      outline-offset: 2px;
    }
    ```
  - [ ] Apply to all interactive elements: buttons, inputs, tabs, tree items, list items
  - [ ] Remove focus ring on mouse click (use :focus-visible, not :focus)
  - [ ] Test Tab navigation across all components
  - [ ] Verify focus ring visible on keyboard focus, hidden on mouse click

- [ ] Task 5: Create ARIA live region component (AC: #6)
  - [ ] Create `frontend/src/components/AccessibilityAnnouncer.tsx`
  - [ ] Implement component with two live regions:
    - `aria-live="polite"` for status updates
    - `aria-live="assertive"` for critical errors
  - [ ] Implement announcement queue (avoid rapid-fire announcements)
  - [ ] Add useAccessibility hook:
    - `announce(message: string, priority: 'polite' | 'assertive')`
    - Update live region text content
    - Clear after 1 second (screen reader already read it)
  - [ ] Position live region off-screen (screen reader only):
    ```css
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
    ```
  - [ ] Include AccessibilityAnnouncer in App.tsx

- [ ] Task 6: Integrate announcements into status changes (AC: #6)
  - [ ] Update SessionContext.updateStatus() to call announce():
    - Session status change: "Session [name] is now [status]"
    - Session crash: "Session [name] crashed" (assertive)
  - [ ] Update WorkflowContext when phase changes:
    - "Workflow step: [step name] completed"
  - [ ] Update NotificationContext for important events:
    - "WebSocket reconnected"
    - "Memory warning: high usage"

- [ ] Task 7: Add reduced motion support (AC: #7)
  - [ ] Add global CSS media query:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    ```
  - [ ] Update ToastProvider to check reduced motion:
    - `const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;`
    - If true, disable slide-in animation
  - [ ] Update modal transitions to respect reduced motion
  - [ ] Test: Toggle OS "Reduce motion" setting, verify animations disabled

- [ ] Task 8: Add comprehensive ARIA labels and roles (AC: #9)
  - [ ] Update TopBar.tsx: Add `<header role="banner">`
  - [ ] Update LeftSidebar.tsx: Add `<aside role="complementary" aria-label="Navigation sidebar">`
  - [ ] Update MainContentArea.tsx: Add `<main role="main">`
  - [ ] Update SessionModal: Add `<dialog role="dialog" aria-labelledby="modal-title">`
  - [ ] Update all buttons with descriptive aria-label:
    - Create Session button: `aria-label="Create new session"`
    - Stop button: `aria-label="Stop current command"`
    - Close button: `aria-label="Close modal"`
  - [ ] Update FileTree: Add `role="tree"` to root, `role="treeitem"` to items
  - [ ] Update WorkflowProgress: Add `role="list"`, `aria-current="step"` for current phase
  - [ ] Verify all form inputs have associated labels (explicit or aria-label)

- [ ] Task 9: Implement focus management for modals (AC: #10)
  - [ ] Track previous active element before modal opens:
    ```typescript
    const previousActiveElement = document.activeElement as HTMLElement;
    ```
  - [ ] Move focus to first interactive element (session name input) on modal open
  - [ ] Return focus to previousActiveElement on modal close
  - [ ] Trap focus within modal (Tab at end returns to start, Shift+Tab at start goes to end)
  - [ ] Use React hook or library (e.g., `@radix-ui/react-dialog` handles this)

- [ ] Task 10: Ensure logical tab order (AC: #10)
  - [ ] Verify tab order: TopBar → LeftSidebar → MainContentArea
  - [ ] Test with Tab key: All interactive elements reachable
  - [ ] Fix any tabindex issues (avoid tabindex > 0)
  - [ ] Ensure no keyboard traps (except intentional modal focus trap)
  - [ ] Verify Shift+Tab works in reverse

- [ ] Task 11: Write comprehensive unit tests (AC: #11)
  - [ ] Create `frontend/src/hooks/useKeyboardShortcuts.test.ts`
  - [ ] Test cases:
    - Mock SessionContext and LayoutContext
    - Test Cmd+1-4 triggers switchSession with correct index
    - Test Cmd+N opens SessionModal (mock function call)
    - Test Cmd+T sets layout mode to 'terminal'
    - Test Cmd+A sets layout mode to 'split'
    - Test Cmd+W toggles leftSidebarView
    - Test ESC closes modal (when modal open)
    - Test ESC does NOT trigger modal close when terminal focused
    - Test platform detection (mock navigator.platform)
    - Test shortcuts disabled when terminal focused
  - [ ] Create `frontend/src/components/AccessibilityAnnouncer.test.tsx`
  - [ ] Test cases:
    - Announcements appear in ARIA live region
    - Polite vs assertive announcements
    - Announcements clear after delay
  - [ ] Verify ≥50% coverage for new components

- [ ] Task 12: Run accessibility audit (AC: #12)
  - [ ] Install axe-core: `npm install -D @axe-core/react`
  - [ ] Run axe in development mode (console warnings for violations)
  - [ ] Fix all critical and serious violations
  - [ ] Document minor violations (if any) with rationale to ignore
  - [ ] Manual testing checklist:
    - [ ] Navigate entire UI with Tab key (no keyboard traps)
    - [ ] Test VoiceOver (macOS) or NVDA (Windows):
      - [ ] Session status changes announced
      - [ ] Workflow phase changes announced
      - [ ] Button labels read correctly
      - [ ] Form inputs have associated labels
    - [ ] Verify focus rings visible on all interactive elements
    - [ ] Toggle OS "Reduce motion" setting:
      - [ ] Toast animations disabled
      - [ ] Modal animations disabled
      - [ ] Layout shift animations disabled
    - [ ] Check contrast ratios with browser DevTools:
      - [ ] Text: 4.5:1 minimum (WCAG AA)
      - [ ] UI components: 3:1 minimum (WCAG AA)

- [ ] Task 13: Update documentation (AC: all)
  - [ ] Update CLAUDE.md (or README.md):
    - Add "Keyboard Shortcuts" section listing all shortcuts
    - Document Cmd (macOS) vs Ctrl (Windows/Linux) modifiers
    - Note shortcuts disabled when terminal has focus
  - [ ] Update docs/architecture.md:
    - Add "Accessibility" section
    - Document ARIA patterns used
    - Note WCAG AA compliance
  - [ ] Add accessibility statement:
    - "Claude Container aims for WCAG AA compliance"
    - "Screen reader support via ARIA live regions"
    - "Full keyboard navigation with visible focus rings"
    - "Reduced motion preference respected"
    - "Report accessibility issues to [contact]"

- [ ] Task 14: Manual validation with keyboard-only navigation (AC: #1-#12)
  - [ ] Start container and frontend
  - [ ] Disconnect mouse (or don't use it)
  - [ ] Navigate entire UI with keyboard only:
    - [ ] Create new session (Cmd+N, type name, Enter)
    - [ ] Switch between sessions (Cmd+1, Cmd+2, etc.)
    - [ ] Toggle layout views (Cmd+T, Cmd+A, Cmd+W)
    - [ ] Navigate file tree with arrow keys
    - [ ] Open artifact in viewer
    - [ ] Close modal with ESC
  - [ ] Test with screen reader:
    - [ ] Enable VoiceOver (macOS) or NVDA (Windows)
    - [ ] Verify session status changes announced
    - [ ] Verify button labels read correctly
    - [ ] Verify form inputs have labels
  - [ ] Toggle OS reduced motion setting:
    - [ ] Verify animations disabled
    - [ ] Verify transitions instant
  - [ ] Check focus rings:
    - [ ] Tab through all interactive elements
    - [ ] Verify 2px blue outline visible
    - [ ] Verify no outline on mouse click
  - [ ] Document any issues or edge cases

## Dev Notes

### Architecture Patterns and Constraints

**From Tech Spec Epic 4 (docs/sprint-artifacts/tech-spec-epic-4.md)**:

**Keyboard Shortcut Registry (Data Models section)**:
```typescript
interface KeyboardShortcut {
  key: string;                 // 'n', '1', 't', etc.
  modifiers: ('meta' | 'ctrl' | 'alt' | 'shift')[];
  action: string;              // 'newSession', 'switchSession1', 'focusTerminal'
  description: string;         // 'Create new session'
  enabled: boolean;
}
```

**Platform-Aware Modifiers**:
- Tech spec notes: "Keyboard shortcuts use platform-aware modifiers (Cmd on macOS, Ctrl on Windows/Linux)"
- Detection: Use `navigator.platform` or `navigator.userAgent`
- Mapping: `'meta'` key = Cmd on macOS, Windows key on Windows, Super on Linux
- Shortcuts use 'meta' in registry, browser handles platform differences

**Terminal Focus Exclusion**:
- Tech spec: Shortcuts disabled when terminal has focus (terminal in raw mode intercepts)
- ESC key is exception: Terminal uses ESC for SIGINT, so modal close should NOT trigger
- Implementation: Check `document.activeElement` is within Terminal component DOM

**From Architecture (docs/architecture.md)**:

**WCAG AA Compliance (UX Spec 8.2)**:
- Color contrast: 4.5:1 for text, 3:1 for UI components
- Focus indicators: Visible 2px outline on all interactive elements
- Keyboard navigation: All functionality accessible without mouse
- Screen reader support: ARIA labels, live regions, semantic HTML
- Reduced motion: Respect `prefers-reduced-motion` media query

**Oceanic Calm Color Palette**:
- Focus ring: #88C0D0 (Nord10 - blue)
- Text: #ECEFF4 (Nord6 - light)
- Background: #2E3440 (Nord0 - dark)
- Success: #A3BE8C (Nord14 - green)
- Error: #BF616A (Nord11 - red)
- Warning: #EBCB8B (Nord13 - yellow)

**Testing Strategy**:
- Frontend unit tests: Vitest with @testing-library/react
- Accessibility tests: axe-core for automated checks, manual VoiceOver/NVDA testing
- Focus management: Test Tab order, focus rings, modal focus trap
- Reduced motion: Test with OS setting toggled

**From ADR-014: Layout Context and State Management**:
- LayoutContext already exists with state management
- Keyboard shortcuts integrate with existing context actions
- No new state needed, shortcuts trigger existing LayoutContext methods

**From ADR-017: Browser Notification Permission Flow**:
- NotificationContext exists for permission management
- Accessibility announcements complement notifications (different purposes)
- ARIA live regions for screen readers, browser notifications for visual alerts

### Project Structure Notes

**Files to Create:**
```
frontend/src/
├── hooks/
│   ├── useKeyboardShortcuts.ts      # Keyboard shortcut hook
│   └── useAccessibility.ts          # ARIA live region hook
├── components/
│   └── AccessibilityAnnouncer.tsx   # ARIA live region component
└── styles/
    └── accessibility.css            # Focus ring, reduced motion styles
```

**Files to Modify:**
```
frontend/src/
├── App.tsx                          # Integrate useKeyboardShortcuts
├── components/
│   ├── TopBar.tsx                   # Add ARIA role, labels
│   ├── LeftSidebar.tsx              # Add ARIA role, labels
│   ├── MainContentArea.tsx          # Add ARIA role
│   ├── SessionModal.tsx             # Add ESC handler, focus management, ARIA attributes
│   ├── FileTree.tsx                 # Add ARIA tree roles
│   └── WorkflowProgress.tsx         # Add ARIA list roles, aria-current
├── context/
│   ├── SessionContext.tsx           # Add announce() calls on status change
│   └── WorkflowContext.tsx          # Add announce() calls on phase change
└── styles/
    └── globals.css                  # Add focus-visible styles, reduced motion query
```

**New Dependencies:**
```json
{
  "devDependencies": {
    "@axe-core/react": "^4.x"         // Accessibility testing (development only)
  }
}
```

**Note:** axe-core only runs in development mode for console warnings. No production bundle impact.

### Implementation Guidance

**useKeyboardShortcuts Hook Pattern**:
```typescript
// frontend/src/hooks/useKeyboardShortcuts.ts
import { useEffect, useContext } from 'react';
import { SessionContext } from '@/context/SessionContext';
import { LayoutContext } from '@/context/LayoutContext';

interface KeyboardShortcut {
  key: string;
  modifiers: ('meta' | 'ctrl' | 'alt' | 'shift')[];
  action: string;
  description: string;
  enabled: boolean;
}

export function useKeyboardShortcuts() {
  const { switchSession } = useContext(SessionContext);
  const { setMainContentMode, toggleLeftSidebarView } = useContext(LayoutContext);

  // Platform detection
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? 'meta' : 'ctrl';

  // Shortcut registry
  const shortcuts: KeyboardShortcut[] = [
    { key: '1', modifiers: [modifierKey], action: 'switchSession1', description: 'Switch to session 1', enabled: true },
    { key: '2', modifiers: [modifierKey], action: 'switchSession2', description: 'Switch to session 2', enabled: true },
    { key: '3', modifiers: [modifierKey], action: 'switchSession3', description: 'Switch to session 3', enabled: true },
    { key: '4', modifiers: [modifierKey], action: 'switchSession4', description: 'Switch to session 4', enabled: true },
    { key: 'n', modifiers: [modifierKey], action: 'newSession', description: 'Create new session', enabled: true },
    { key: 't', modifiers: [modifierKey], action: 'focusTerminal', description: 'Focus terminal', enabled: true },
    { key: 'a', modifiers: [modifierKey], action: 'focusArtifacts', description: 'Focus artifacts', enabled: true },
    { key: 'w', modifiers: [modifierKey], action: 'toggleSidebarView', description: 'Toggle sidebar view', enabled: true },
    { key: 'Escape', modifiers: [], action: 'closeModal', description: 'Close modal', enabled: true }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if terminal has focus (exclude shortcuts except ESC)
      const terminalHasFocus = document.activeElement?.closest('.terminal-wrapper') !== null;
      if (terminalHasFocus && e.key !== 'Escape') {
        return; // Let terminal handle input
      }

      // Match shortcut
      for (const shortcut of shortcuts) {
        if (!shortcut.enabled) continue;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const modifiersMatch =
          (shortcut.modifiers.includes('meta') ? e.metaKey : !e.metaKey) &&
          (shortcut.modifiers.includes('ctrl') ? e.ctrlKey : !e.ctrlKey) &&
          (shortcut.modifiers.includes('alt') ? e.altKey : !e.altKey) &&
          (shortcut.modifiers.includes('shift') ? e.shiftKey : !e.shiftKey);

        if (keyMatch && modifiersMatch) {
          e.preventDefault();
          handleAction(shortcut.action);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [switchSession, setMainContentMode, toggleLeftSidebarView]);

  const handleAction = (action: string) => {
    switch (action) {
      case 'switchSession1': switchSession(0); break;
      case 'switchSession2': switchSession(1); break;
      case 'switchSession3': switchSession(2); break;
      case 'switchSession4': switchSession(3); break;
      case 'newSession': /* Open SessionModal */ break;
      case 'focusTerminal': setMainContentMode('terminal'); break;
      case 'focusArtifacts': setMainContentMode('split'); break;
      case 'toggleSidebarView': toggleLeftSidebarView(); break;
      case 'closeModal': /* Close active modal */ break;
    }
  };
}
```

**AccessibilityAnnouncer Component**:
```typescript
// frontend/src/components/AccessibilityAnnouncer.tsx
import { useState, useEffect } from 'react';

interface AccessibilityAnnouncerProps {
  message?: string;
  priority?: 'polite' | 'assertive';
}

export function AccessibilityAnnouncer() {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  // Global announce function (exposed via context or hook)
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage(message);
      setTimeout(() => setAssertiveMessage(''), 1000);
    } else {
      setPoliteMessage(message);
      setTimeout(() => setPoliteMessage(''), 1000);
    }
  };

  // Expose announce function globally (or via context)
  useEffect(() => {
    (window as any).__announce = announce;
    return () => delete (window as any).__announce;
  }, []);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </>
  );
}
```

**Focus Ring Global Styles**:
```css
/* frontend/src/styles/accessibility.css */

/* Focus ring for keyboard navigation only */
*:focus-visible {
  outline: 2px solid #88C0D0; /* Oceanic Calm blue */
  outline-offset: 2px;
}

/* Remove default browser focus styles */
*:focus {
  outline: none;
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Modal Focus Management (Radix UI)**:
Radix UI Dialog component already handles:
- Focus trap within modal
- Return focus on close
- ESC key to close

If using custom modal, implement focus trap manually:
```typescript
// Track previous active element
const previousActiveElement = useRef<HTMLElement>();

useEffect(() => {
  if (isOpen) {
    previousActiveElement.current = document.activeElement as HTMLElement;
    // Focus first input
    modalRef.current?.querySelector('input')?.focus();
  } else {
    // Return focus
    previousActiveElement.current?.focus();
  }
}, [isOpen]);
```

**Testing Considerations:**
- Mock SessionContext and LayoutContext for useKeyboardShortcuts tests
- Mock navigator.platform for platform detection tests
- Mock window.matchMedia for reduced motion tests
- Mock document.activeElement for terminal focus tests
- Use @testing-library/user-event for keyboard interaction tests
- Manual VoiceOver/NVDA testing (automated screen reader testing unreliable)

**WCAG AA Requirements:**
- Color contrast: Use browser DevTools to verify 4.5:1 for text, 3:1 for UI
- Keyboard navigation: All functionality must work without mouse
- Focus indicators: Visible 2px outline on all focusable elements
- Screen reader: ARIA labels, roles, live regions for dynamic content
- No keyboard traps: Except intentional modal focus traps (with ESC escape)
- Form labels: All inputs have associated labels (explicit <label> or aria-label)

**Accessibility Testing Tools:**
- axe-core: Automated accessibility testing (critical/serious violations)
- Browser DevTools: Accessibility tree, contrast ratios, ARIA attributes
- VoiceOver (macOS): Screen reader testing
- NVDA (Windows): Screen reader testing
- Keyboard navigation: Tab through entire UI, verify all actions reachable

### Learnings from Previous Story

**From Story 4-8-resource-monitoring-and-limits (Status: drafted)**

**Integration Points for This Story:**
- **TopBar Component** will display resource warnings (Story 4.8)
  - This story adds ARIA labels to TopBar and resource warning banner
  - File: `frontend/src/components/TopBar.tsx` (modified in Story 4.8)
  - Add `<header role="banner">` wrapper
  - Add `aria-label="High memory usage warning"` to resource banner

**Patterns to Follow:**
- **Singleton hook pattern**: useKeyboardShortcuts follows same pattern as useNotificationPermission
- **Context integration**: Shortcuts trigger existing SessionContext and LayoutContext methods
- **Global event listener**: Follow pattern from useWebSocket (cleanup on unmount)
- **localStorage persistence**: No new persistence needed (shortcuts are global)

**Dependencies:**
- Story 4.4 creates ToastProvider (this story adds reduced motion support to toasts)
- Story 4.2 creates TopBar component (this story extends with ARIA labels)
- Story 3.3 creates LeftSidebar component (this story extends with ARIA labels)
- Story 3.6 creates MainContentArea component (this story extends with ARIA role)

**SessionContext Extensions Needed:**
- **No new methods**: Story uses existing `switchSession(index)` method
- **Add announcement**: On status change, call `announce('Session [name] is now [status]')`

**LayoutContext Extensions Needed:**
- **No new methods**: Story uses existing `setMainContentMode()`, `toggleLeftSidebarView()`
- **Keyboard shortcut integration**: Shortcuts call existing context methods

**Files Created in Previous Stories (to be extended here):**
- `frontend/src/components/TopBar.tsx` - Add ARIA role, labels (Story 4.2)
- `frontend/src/components/LeftSidebar.tsx` - Add ARIA role, labels (Story 3.3)
- `frontend/src/components/MainContentArea.tsx` - Add ARIA role (Story 3.6)
- `frontend/src/components/SessionModal.tsx` - Add ESC handler, ARIA attributes (Story 2.3)
- `frontend/src/components/FileTree.tsx` - Add ARIA tree roles (Story 3.4)
- `frontend/src/components/WorkflowProgress.tsx` - Add ARIA list roles (Story 3.2)
- `frontend/src/components/ToastProvider.tsx` - Add reduced motion support (Story 4.4)

**Keyboard Shortcut Conflicts:**
- Tech spec notes potential browser conflicts (Cmd+N for new window, Cmd+W for close tab)
- Solution: Shortcuts only active when Claude Container has focus
- Prevention: `e.preventDefault()` on matched shortcuts
- Future: Allow customization if conflicts reported

**No Direct Code Reuse from Story 4.8:**
- Story 4.8 focuses on backend resource monitoring
- Story 4.9 is frontend-only (keyboard shortcuts, accessibility)
- Both integrate into TopBar component (different aspects)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Data-Models-and-Contracts] - KeyboardShortcut interface
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Acceptance-Criteria] - AC4.28-AC4.34 accessibility requirements
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Non-Functional-Requirements] - NFR-USE-2 keyboard navigation
- [Source: docs/architecture.md#Testing-Strategy] - WCAG AA compliance, axe-core testing
- [Source: docs/sprint-artifacts/4-8-resource-monitoring-and-limits.md#Dev-Notes] - TopBar component integration, singleton pattern

## Change Log

**2025-11-25**:
- Story created from Epic 4 tech spec
- Status: drafted
- Previous story learnings integrated from Story 4-8 (TopBar component, singleton pattern)
- SessionContext/LayoutContext integration identified (use existing methods)
- Ready for story-context generation and development

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
