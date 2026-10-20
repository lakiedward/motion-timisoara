import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { CoachShareCard } from './coach-share/CoachShareCard'
import { useLiveLocationSharing } from './live-location-context'

export function CoachLocationPanel({
  occurrenceId,
  startsAt,
  endsAt,
  context = 'course',
}: {
  occurrenceId: string | null
  startsAt?: string
  endsAt?: string
  context?: 'course' | 'camp'
}) {
  const { user } = useAuth()
  const sharing = useLiveLocationSharing()
  const [consentedFor, setConsentedFor] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  if (user?.role !== 'COACH') return null
  const camp = context === 'camp'
  const eligibleTime =
    !!startsAt &&
    !!endsAt &&
    now >= Date.parse(startsAt) &&
    now < Date.parse(endsAt) + (camp ? 0 : 15 * 60_000)
  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Nu am putut actualiza partajarea.')
    }
  }
  return (
    <CoachShareCard
      camp={camp}
      occurrenceId={occurrenceId}
      eligibleTime={eligibleTime}
      checked={occurrenceId !== null && consentedFor === occurrenceId}
      error={actionError || sharing.error}
      sharing={sharing}
      onConsent={(checked) => setConsentedFor(checked ? occurrenceId : null)}
      onStart={() => {
        if (!occurrenceId) return
        setConsentedFor(null)
        void run(() => sharing.start(occurrenceId))
      }}
      onStop={() => void run(sharing.stop)}
    />
  )
}
