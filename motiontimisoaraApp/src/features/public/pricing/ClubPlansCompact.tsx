import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PlanFeatureList } from './PlanFeatureList'
import { CLUB_FEATURES, CLUB_PLANS, formatPlanPrice } from './pricing-content'

export function ClubPlansCompact({ className }: { className?: string }) {
  return (
    <Card className={cn('gap-5 px-6', className)}>
      <div className="space-y-1">
        <Badge variant="secondary">Club</Badge>
        <h3 className="font-display pt-2 text-xl font-bold text-foreground">Pachete pentru cluburi</h3>
      </div>
      <ul className="divide-border divide-y border-y">
        {CLUB_PLANS.map((plan) => (
          <li key={plan.code} data-plan={plan.code} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-semibold text-foreground">{plan.name}</p>
              <p className="text-muted-foreground text-sm">{plan.coaches}</p>
            </div>
            <p className="text-right whitespace-nowrap">
              <span className="font-display text-2xl font-extrabold text-foreground">
                {formatPlanPrice(plan.priceBani)}
              </span>{' '}
              <span className="text-muted-foreground text-sm">lei / lună</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Toate pachetele includ</p>
        <PlanFeatureList items={CLUB_FEATURES} />
      </div>
      <Link to="/register-club" className="btn-cta btn-cta--outline w-full">
        Înregistrează clubul
      </Link>
    </Card>
  )
}
