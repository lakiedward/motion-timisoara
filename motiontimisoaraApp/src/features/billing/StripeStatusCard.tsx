import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StripeNotice } from './StripeNotice'
import type { StripeOnboardingState } from './useStripeOnboarding'

export function StripeActions({ state }: { state: StripeOnboardingState }) {
  const { complete, unavailable, phase, busy, startOnboarding, openDashboard, config } = state
  const working = busy || phase === 'redirecting' || phase === 'verifying'
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {!unavailable &&
        (complete ? (
          <Button
            type="button"
            className="h-11 min-h-11"
            disabled={working}
            onClick={() => void openDashboard()}
          >
            Deschide dashboard Stripe
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 min-h-11"
            disabled={working}
            onClick={() => void startOnboarding()}
          >
            {phase === 'verified' ? 'Continuă configurarea' : 'Configurează Stripe'}
          </Button>
        ))}
      <Button asChild variant="outline" className="h-11 min-h-11">
        <Link to={config.backTo}>Înapoi la panou</Link>
      </Button>
    </div>
  )
}

export function StripeStatusCard({ state }: { state: StripeOnboardingState }) {
  const { complete, unavailable, config } = state
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-display text-lg">Plăți cu cardul prin Stripe</CardTitle>
          {unavailable ? (
            <Badge variant="highlight">În așteptare</Badge>
          ) : complete ? (
            <Badge variant="success">Configurat</Badge>
          ) : (
            <Badge variant="outline">Neconfigurat</Badge>
          )}
        </div>
        <CardDescription>
          {complete
            ? 'Părinții pot plăti înscrierile cu cardul. Banii ajung în contul tău Stripe.'
            : config.setupHint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <StripeNotice state={state} />
        <StripeActions state={state} />
      </CardContent>
    </Card>
  )
}
