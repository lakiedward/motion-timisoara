import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Gift, User } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/SectionHeader'
import { cn } from '@/lib/utils'
import { PlanFeatureList, PlanPrice } from './PlanFeatureList'
import {
  CLUB_FEATURES,
  CLUB_PLANS,
  COACH_PLAN,
  PRICE_NOTE,
  PRICING_FAQ,
  PROMO,
} from './pricing-content'

type Audience = 'coach' | 'club'

const AUDIENCES: { value: Audience; label: string; icon: typeof User }[] = [
  { value: 'coach', label: 'Antrenor', icon: User },
  { value: 'club', label: 'Club', icon: Building2 },
]

function CoachPanel() {
  return (
    <Card className="gap-8 px-6 md:grid md:grid-cols-[1fr_1.2fr] md:items-center md:px-10 md:py-10">
      <div className="space-y-3">
        <h3 className="font-display text-2xl font-bold text-foreground">{COACH_PLAN.name}</h3>
        <p className="text-muted-foreground">{COACH_PLAN.audience}</p>
        <PlanPrice priceBani={COACH_PLAN.priceBani} size="xl" />
        <Link to="/register-coach" className="btn-cta btn-cta--primary mt-3">
          Creează cont de antrenor
        </Link>
      </div>
      <div className="space-y-4">
        <PlanFeatureList items={COACH_PLAN.features} className="text-base" />
        <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">
          Predai doar în cluburi? Nu plătești nimic: ofertele clubului sunt acoperite de clubul tău.
        </p>
      </div>
    </Card>
  )
}

function ClubPanel() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {CLUB_PLANS.map((plan) => (
          <Card key={plan.code} className="gap-3 px-6 text-center" data-plan={plan.code}>
            <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
            <div className="flex justify-center">
              <PlanPrice priceBani={plan.priceBani} />
            </div>
            <p className="text-primary text-sm font-semibold">{plan.coaches}</p>
            <p className="text-muted-foreground text-sm">{plan.audience}</p>
          </Card>
        ))}
      </div>
      <Card className="gap-6 px-6 md:grid md:grid-cols-[1.4fr_auto] md:items-center md:px-10">
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold text-foreground">Toate pachetele includ</h3>
          <PlanFeatureList items={CLUB_FEATURES} className="sm:grid sm:grid-cols-2 sm:gap-x-6 sm:space-y-0 sm:gap-y-2.5" />
        </div>
        <Link to="/register-club" className="btn-cta btn-cta--primary">
          Înregistrează clubul
        </Link>
      </Card>
    </div>
  )
}

export function PricingDirectionB() {
  const [audience, setAudience] = useState<Audience>('coach')

  return (
    <div>
      <section className="border-b">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <span className="eyebrow mb-3">Prețuri</span>
            <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">
              Un abonament pentru <span className="text-primary">antrenori</span> și cluburi
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl text-lg">
              Abonamentul îți aduce profilul și ofertele pe Motion România, unde părinții caută și
              înscriu copiii. Părinții nu plătesc abonament.
            </p>
          </div>
          <div
            className="rounded-3xl px-6 py-7 text-white md:px-8"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Gift className="size-7" aria-hidden="true" />
            <span className="eyebrow eyebrow--on-brand mt-4 block">Ofertă de lansare</span>
            <h2 className="font-display mt-1 text-2xl font-extrabold">{PROMO.title}</h2>
            <p className="mt-2 text-white/90">{PROMO.text}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div
          role="radiogroup"
          aria-label="Pentru cine este abonamentul"
          className="bg-muted mx-auto mb-8 grid w-full max-w-md grid-cols-2 gap-1 rounded-full p-1"
        >
          {AUDIENCES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={audience === value}
              onClick={() => setAudience(value)}
              className={cn(
                'min-h-touch-target inline-flex items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                audience === value
                  ? 'bg-card text-foreground border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {audience === 'coach' ? <CoachPanel /> : <ClubPanel />}
        <p className="text-muted-foreground mt-6 text-center text-sm">{PRICE_NOTE}</p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <SectionHeader eyebrow="Întrebări frecvente" title="Ce trebuie să știi" />
        <div className="grid gap-6 md:grid-cols-2">
          {PRICING_FAQ.map((item) => (
            <Card key={item.question} className="gap-2 px-6">
              <h3 className="font-display text-lg font-bold text-foreground">{item.question}</h3>
              <p className="text-muted-foreground">{item.answer}</p>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground mt-8 text-center">
          Altă întrebare?{' '}
          <Link to="/contact" className="text-primary font-semibold underline-offset-4 hover:underline">
            Scrie-ne
          </Link>
        </p>
      </section>
    </div>
  )
}
