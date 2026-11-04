import { Link } from 'react-router-dom'
import { ChevronRight, CircleAlert, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { daysLeftLabel } from './subscription-banner'
import { useCoachSubscription } from './use-coach-subscription'

const noticeClass = cn(
  'bg-card flex items-center gap-4 rounded-xl border p-6 transition-colors',
  'hover:border-primary/40 hover:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
)

export function CoachSubscriptionBanner() {
  const state = useCoachSubscription()
  const { view, coverSettled, coveringClubs } = state
  if (!state.isCoach || !view || !coverSettled || coveringClubs.length > 0) return null

  const content = daysLeftLabel(view)
  if (!content) return null
  const Icon = content.urgent ? CircleAlert : Clock

  return (
    <Link to="/coach/abonament" data-testid="subscription-banner" className={noticeClass}>
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl',
          content.urgent ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg font-bold">{content.title}</div>
        <p className="text-muted-foreground mt-1 text-sm">{content.text}</p>
      </div>
      <ChevronRight aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
    </Link>
  )
}
