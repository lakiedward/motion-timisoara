import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getCampParticipants, recordCampParticipation } from '@/api/live-location/discovery'
import { campLocationKey } from '@/api/live-location/target'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { CoachLocationPanel } from '../CoachLocationPanel'

export function CampParticipationPanel({ campId }: { campId: string }) {
  const { user } = useAuth()
  if (!user || !['COACH', 'CLUB'].includes(user.role)) return null
  return <CampParticipation key={`${user.id}:${campId}`} campId={campId} actorId={user.id} />
}

function CampParticipation({ campId, actorId }: { campId: string; actorId: string }) {
  const [departure, setDeparture] = useState<string | null>(null)
  const participants = useQuery({
    queryKey: ['camp-participation', actorId, campId],
    queryFn: () => getCampParticipants(campId, actorId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
  })
  const mutation = useMutation({
    mutationFn: ({ action, enrollmentId }: { action: 'arrive' | 'depart'; enrollmentId: string }) =>
      recordCampParticipation(action, campId, enrollmentId, actorId),
    onSuccess: async () => {
      setDeparture(null)
      await participants.refetch()
    },
  })
  const data = participants.isError ? undefined : participants.data
  return (
    <div className="my-6 space-y-4">
      {data?.canShare && (
        <CoachLocationPanel
          occurrenceId={campLocationKey(campId, actorId)}
          startsAt={data.startsAt}
          endsAt={data.endsAt}
          context="camp"
        />
      )}
      <section aria-label="Prezență în tabără" className="space-y-3 rounded-2xl border p-4">
        <h2 className="font-semibold">Prezență în tabără</h2>
        <p className="text-muted-foreground text-sm">
          Confirmă sosirea o singură dată. Părintele poate vedea locația în Anunțuri când antrenorul
          o pornește. Plecarea închide accesul pentru acest copil.
        </p>
        {participants.isPending ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : participants.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-destructive text-sm">
              {participants.error instanceof Error
                ? participants.error.message
                : 'Nu am putut încărca prezența.'}
            </p>
            <Button type="button" variant="outline" onClick={() => void participants.refetch()}>
              Reîncearcă prezența
            </Button>
          </div>
        ) : !data?.participants.length ? (
          <p className="text-muted-foreground text-sm">
            Nicio înscriere activă pentru confirmarea sosirii.
          </p>
        ) : (
          <ul className="divide-y">
            {data.participants.map((participant) => (
              <li key={participant.enrollmentId} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{participant.childName}</h3>
                    <p className="text-muted-foreground text-sm" role="status">
                      {participant.departedAt
                        ? 'Plecat din tabără'
                        : participant.arrivedAt
                          ? 'Sosire confirmată'
                          : 'Sosire neconfirmată'}
                    </p>
                  </div>
                  {!participant.departedAt && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => {
                        mutation.reset()
                        if (participant.arrivedAt) setDeparture(participant.enrollmentId)
                        else
                          mutation.mutate({
                            action: 'arrive',
                            enrollmentId: participant.enrollmentId,
                          })
                      }}
                    >
                      {participant.arrivedAt ? 'Confirmă plecarea' : 'Confirmă sosirea'}
                    </Button>
                  )}
                </div>
                {departure === participant.enrollmentId && !participant.departedAt && (
                  <div className="bg-muted space-y-2 rounded-xl p-3">
                    <p className="text-sm">
                      Confirmi că {participant.childName} a părăsit tabăra? Accesul la locație
                      pentru acest copil se încheie.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            action: 'depart',
                            enrollmentId: participant.enrollmentId,
                          })
                        }
                      >
                        Da, a plecat
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => setDeparture(null)}
                      >
                        Anulează
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {mutation.isError && (
          <p role="alert" className="text-destructive text-sm">
            {mutation.error.message}
          </p>
        )}
      </section>
    </div>
  )
}
