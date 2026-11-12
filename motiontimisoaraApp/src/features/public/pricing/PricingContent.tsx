import { Link } from 'react-router-dom'
import { ChevronDown, Gift } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/SectionHeader'
import { cn } from '@/lib/utils'
import { ClubPlansCompact } from './ClubPlansCompact'
import { PlanFeatureList, PlanPrice } from './PlanFeatureList'
import {
  CLUB_FEATURES,
  CLUB_PLANS,
  COACH_PLAN,
  PRICE_NOTE,
  PRICING_FAQ,
  PROMO,
  type PricingPlan,
} from './pricing-content'

function PlanCard({
  plan,
  features,
  group,
  to,
  cta,
  className,
}: {
  plan: PricingPlan
  features?: string[]
  group: string
  to: string
  cta: string
  className?: string
  key?: string
}) {
  return (
    <Card className={cn('gap-5 px-6', className)} data-plan={plan.code}>
      <div className="space-y-1">
        <Badge variant={group === 'Antrenor' ? 'success' : 'secondary'}>{group}</Badge>
        <h3 className="font-display pt-2 text-xl font-bold text-foreground">{plan.name}</h3>
        <p className="text-muted-foreground text-sm">{plan.audience}</p>
      </div>
      <PlanPrice priceBani={plan.priceBani} />
      <p className="text-sm font-semibold text-foreground">{plan.coaches}</p>
      {features && <PlanFeatureList items={features} className="flex-1" />}
      <Link to={to} className="btn-cta btn-cta--outline mt-auto w-full">
        {cta}
      </Link>
    </Card>
  )
}

export function PricingContent() {
  return (
    <div>
      <section className="from-primary/8 to-transparent border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Prețuri</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
            Un abonament <span className="text-primary">simplu</span>, fără surprize
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
            Antrenorii și cluburile plătesc un abonament lunar ca să apară pe Motion România și să
            primească înscrieri noi. Părinții nu plătesc abonament.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-8 md:pt-12">
        <div
          className="flex flex-col gap-4 rounded-3xl px-6 py-6 text-white md:flex-row md:items-center md:px-8"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Gift className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-xl font-extrabold md:text-2xl">{PROMO.title}</h2>
            <p className="mt-1 max-w-3xl text-white">{PROMO.text}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 md:py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <PlanCard
            plan={COACH_PLAN}
            features={COACH_PLAN.features}
            group="Antrenor"
            to="/register-coach"
            cta="Creează cont"
          />
          {CLUB_PLANS.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              features={CLUB_FEATURES}
              group="Club"
              to="/register-club"
              cta="Înregistrează clubul"
              className="hidden md:flex"
            />
          ))}
          <ClubPlansCompact className="md:hidden" />
        </div>
        <p className="text-muted-foreground mt-6 max-w-3xl text-sm">{PRICE_NOTE}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <SectionHeader eyebrow="Întrebări frecvente" title="Ce trebuie să știi" />
        <div className="divide-border bg-card divide-y rounded-xl border">
          {PRICING_FAQ.map((item) => (
            <details key={item.question} className="group px-6">
              <summary className="min-h-touch-target flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p className="text-muted-foreground pb-5">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl px-8 py-12 text-center" style={{ background: 'var(--gradient-primary)' }}>
          <h2 className="font-display text-2xl font-extrabold text-white md:text-3xl">
            Ai întrebări despre abonamente?
          </h2>
          <Link to="/contact" className="btn-cta btn-cta--white mt-6">
            Contactează-ne
          </Link>
        </div>
      </section>
    </div>
  )
}
