import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { subscriptionCopy, type PlanLabel } from './subscription-copy'
import type { SubscriptionView } from './subscription-state'

export function SubscriptionStatusCard({
  view,
  plan,
  note,
  children,
  className,
}: {
  view: SubscriptionView
  plan: PlanLabel | null
  note?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const copy = subscriptionCopy(view, plan)
  return (
    <Card
      className={cn('gap-4 px-6', className)}
      data-testid="subscription-status"
      data-state={view.kind}
    >
      <div className="space-y-2">
        <Badge variant={copy.tone}>{copy.badge}</Badge>
        <h2 className="font-display text-foreground text-xl font-bold">{copy.title}</h2>
        <p className="text-muted-foreground text-sm">{copy.detail}</p>
        {note}
      </div>
      {children ? <div className="flex flex-col gap-3 sm:flex-row">{children}</div> : null}
    </Card>
  )
}
