import type { ReactNode } from 'react'

import { PageHeader } from '@/components/page-header/PageHeader'
import { StatusView } from '@/components/ui/status-view'
import { CoachSubscriptionContent } from './CoachSubscriptionContent'
import { useCoachSubscription } from './use-coach-subscription'

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-5xl">
      <PageHeader title="Abonament" />
      {children}
    </div>
  )
}

export default function CoachSubscriptionPage() {
  const state = useCoachSubscription()
  const { data, isCoach } = state

  if (!isCoach) {
    return (
      <Frame>
        <StatusView state="empty" title="Abonamentul este doar pentru conturile de antrenor" />
      </Frame>
    )
  }
  if (data.isLoading) {
    return (
      <Frame>
        <StatusView state="loading" title="Se încarcă abonamentul" rows={3} />
      </Frame>
    )
  }
  if (data.isError || !state.view) {
    return (
      <Frame>
        <StatusView
          state="error"
          title="Nu am putut încărca abonamentul"
          onRetry={() => void data.refetch()}
          retrying={data.isFetching}
        />
      </Frame>
    )
  }
  return <CoachSubscriptionContent state={state} />
}
