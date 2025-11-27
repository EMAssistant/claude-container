/**
 * ArtifactReviewBadge Component
 * Story 5.5: Artifact Review Badges in Sprint Tracker
 *
 * Displays review status badge for artifacts in the Sprint Tracker.
 * Shows status icons with tooltips:
 * - ✓ (green #A3BE8C) = approved
 * - ⏳ (yellow #EBCB8B) = pending review
 * - ⚠️ (orange #D08770) = changes requested
 * - No icon = not a Claude-modified file (reviewStatus: null)
 *
 * Props:
 * - reviewStatus: 'pending' | 'approved' | 'changes-requested' | null
 */

import { Check, Clock, AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface ArtifactReviewBadgeProps {
  reviewStatus: 'pending' | 'approved' | 'changes-requested' | null | undefined
}

export function ArtifactReviewBadge({ reviewStatus }: ArtifactReviewBadgeProps) {
  // No badge for non-reviewable artifacts (Story/Context docs)
  if (!reviewStatus) return null

  const badgeConfig = {
    approved: {
      icon: Check,
      color: 'text-[#A3BE8C]', // Green from Oceanic Calm theme
      label: 'Approved',
    },
    pending: {
      icon: Clock,
      color: 'text-[#EBCB8B]', // Yellow from Oceanic Calm theme
      label: 'Pending review',
    },
    'changes-requested': {
      icon: AlertTriangle,
      color: 'text-[#D08770]', // Orange from Oceanic Calm theme
      label: 'Changes requested',
    },
  }

  const config = badgeConfig[reviewStatus]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="status" aria-label={config.label} className="flex-shrink-0">
            <Icon className={`h-4 w-4 ${config.color}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
