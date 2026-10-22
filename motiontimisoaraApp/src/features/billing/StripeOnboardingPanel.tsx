import { StatusView } from '@/components/ui/status-view'
import { StripeStatusCard } from './StripeStatusCard'
import type { StripeScope } from './stripe-scopes'
import { useStripeOnboarding } from './useStripeOnboarding'

export type { StripeScope } from './stripe-scopes'

export function StripeOnboardingPanel({ scope }: { scope: StripeScope }) {
  const state = useStripeOnboarding(scope)
  const { config, query, entity } = state

  if (query.isLoading)
    return <StatusView state="loading" title="Se încarcă plățile" rows={2} className="max-w-xl" />
  if (query.isError) {
    return (
      <StatusView
        state="error"
        title={config.loadError}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className="max-w-xl"
      />
    )
  }
  if (!entity) return <StatusView state="empty" title={config.missing} className="max-w-xl" />

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Configurare plăți</h1>
        <p className="text-muted-foreground mt-1">{config.description(entity.label)}</p>
      </div>
      <StripeStatusCard state={state} />
    </div>
  )
}
