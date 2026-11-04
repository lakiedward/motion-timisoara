import { useSearchParams } from 'react-router-dom'

import { StatusView } from '@/components/ui/status-view'
import { CoachSubscriptionLayoutA } from './CoachSubscriptionLayoutA'
import { CoachSubscriptionLayoutB } from './CoachSubscriptionLayoutB'
import { useCoachSubscription } from './use-coach-subscription'

export default function CoachSubscriptionPage() {
  const state = useCoachSubscription()
  const [params] = useSearchParams()
  const { data, isCoach } = state

  if (!isCoach) {
    return (
      <StatusView
        state="empty"
        title="Abonamentul este doar pentru conturile de antrenor"
        className="max-w-xl"
      />
    )
  }
  if (data.isLoading) {
    return (
      <StatusView state="loading" title="Se încarcă abonamentul" rows={2} className="max-w-xl" />
    )
  }
  if (data.isError || !state.view) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca abonamentul"
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void data.refetch()}
        retrying={data.isFetching}
        className="max-w-xl"
      />
    )
  }
  return params.get('directie') === 'b' ? (
    <CoachSubscriptionLayoutB state={state} />
  ) : (
    <CoachSubscriptionLayoutA state={state} />
  )
}
