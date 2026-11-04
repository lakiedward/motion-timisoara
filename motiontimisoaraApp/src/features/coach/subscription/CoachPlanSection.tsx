import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PlanFeatureList } from '@/features/public/pricing/PlanFeatureList'
import { COACH_PLAN, formatPlanPrice } from '@/features/public/pricing/pricing-content'
import { cn } from '@/lib/utils'
import type { CoachSubscriptionState } from './use-coach-subscription'

export function CoachPlanSection({ state }: { state: CoachSubscriptionState }) {
  const { plan, checkoutAllowed, manageAllowed, billing } = state
  const name = plan?.name ?? COACH_PLAN.name
  const priceBani = plan?.priceBani ?? COACH_PLAN.priceBani
  const working = billing.busy?.kind === 'checkout'
  return (
    <section className="space-y-3" aria-labelledby="coach-plan-title">
      <div>
        <h2 id="coach-plan-title" className="font-display text-foreground text-xl font-bold">
          Pachet
        </h2>
        <p className="text-muted-foreground text-sm">
          Un singur pachet pentru antrenorii independenți. Ofertele făcute prin club sunt acoperite
          de abonamentul clubului.
        </p>
      </div>
      <Card className="gap-0 py-0">
        <ul>
          <li
            data-plan={COACH_PLAN.code}
            className={cn(
              'grid gap-4 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start',
              manageAllowed && 'bg-primary/6',
            )}
          >
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-foreground font-semibold">{name}</p>
                {manageAllowed ? <Badge variant="success">Pachetul tău</Badge> : null}
              </div>
              <PlanFeatureList items={COACH_PLAN.features} />
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <p className="whitespace-nowrap sm:text-right">
                <span className="font-display text-foreground text-2xl font-extrabold">
                  {formatPlanPrice(priceBani)}
                </span>{' '}
                <span className="text-muted-foreground text-sm">lei / lună</span>
              </p>
              {checkoutAllowed && plan ? (
                <Button
                  type="button"
                  className="sm:min-w-44"
                  disabled={billing.busy !== null}
                  onClick={() => void billing.checkout(plan.code)}
                  data-testid={`plan-action-${plan.code}`}
                >
                  {working ? 'Se deschide plata…' : `Alege ${plan.name}`}
                </Button>
              ) : null}
            </div>
          </li>
        </ul>
      </Card>
    </section>
  )
}
