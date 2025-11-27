/**
 * EmptyState Component
 * Story 3.10: Empty State UI for First-Time Users
 *
 * Displays a welcoming empty state when no sessions exist,
 * guiding users to create their first session.
 */

import { Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface EmptyStateProps {
  onCreateSession: () => void
}

/**
 * EmptyState component
 *
 * Features:
 * - 300x200px centered card
 * - Terminal icon (48px, #88C0D0)
 * - Welcoming headline and description
 * - Feature highlights
 * - "Create Session" CTA button
 */
export function EmptyState({ onCreateSession }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex w-[500px] flex-col items-center gap-6 rounded-lg bg-card p-8 text-center">
        {/* Terminal Icon */}
        <Terminal className="h-12 w-12 text-primary" aria-hidden="true" />

        {/* Heading */}
        <h2 className="text-2xl font-bold text-foreground">
          Start your first project with Claude
        </h2>

        {/* Subtext */}
        <p className="text-base text-muted-foreground">
          Create a session to begin autonomous development with Claude Container
        </p>

        {/* Feature Highlights */}
        <div className="flex w-full flex-col gap-3 text-left text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <span className="text-primary">✓</span>
            <span>Parallel Development - Work on multiple epics simultaneously</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary">✓</span>
            <span>BMAD Integration - Track workflow progress in real-time</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-primary">✓</span>
            <span>Document Viewer - Review artifacts without leaving the terminal</span>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onCreateSession}
          variant="default"
          size="lg"
          className="mt-4 w-full font-semibold"
          data-testid="create-session-btn"
        >
          Create Your First Session
        </Button>
      </div>
    </div>
  )
}
