import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  getMyCompetitionInvitations,
  respondToCompetitionInvitation,
} from '@/api/competition/competition-coaches'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'

const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Bucharest',
})

function formatCompetitionDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date)
}

export function CompetitionInvitations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const invitationsQuery = useQuery({
    queryKey: ['competition-invitations', user?.id],
    queryFn: () => getMyCompetitionInvitations(user!.id),
    enabled: Boolean(user?.id),
  })
  const respond = useMutation({
    mutationFn: ({ competitionId, accept }: { competitionId: string; accept: boolean }) =>
      respondToCompetitionInvitation(competitionId, accept),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.accept ? 'Ai acceptat invitația la concurs.' : 'Ai refuzat invitația.',
      )
      void queryClient.invalidateQueries({ queryKey: ['competition-invitations', user?.id] })
      void queryClient.invalidateQueries({
        queryKey: ['competition-coaches', variables.competitionId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['competition-public-coaches', variables.competitionId],
      })
      void queryClient.invalidateQueries({ queryKey: ['concurs-public'] })
    },
    onError: () => toast.error('Nu am putut trimite răspunsul.'),
  })

  if (!user?.id) return null

  if (invitationsQuery.isPending) {
    return <Skeleton className="mb-6 h-28 w-full rounded-2xl" />
  }

  if (invitationsQuery.isError) {
    return (
      <section role="alert" className="mb-6 space-y-2 rounded-2xl border p-4">
        <p>Nu am putut încărca invitațiile la concursuri.</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void invitationsQuery.refetch()}
        >
          Reîncearcă
        </Button>
      </section>
    )
  }

  const invitations = [...invitationsQuery.data].sort(
    (left, right) => Number(right.status === 'invited') - Number(left.status === 'invited'),
  )

  return (
    <section className="mb-8 space-y-3" aria-labelledby="competition-invitations-title">
      <h2 id="competition-invitations-title" className="font-display text-lg font-semibold">
        Concursuri la care ești invitat
      </h2>
      {invitations.length === 0 ? (
        <p role="status" className="text-muted-foreground text-sm">
          Nu ai invitații la concursuri.
        </p>
      ) : (
        <ul className="space-y-3">
          {invitations.map((invitation) => {
            const start = formatCompetitionDate(invitation.startAt)
            const end = formatCompetitionDate(invitation.endAt)
            return (
              <li key={invitation.competitionId} className="space-y-3 rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/concursuri/${invitation.slug}`}
                      className="font-medium hover:underline"
                    >
                      {invitation.title}
                    </Link>
                    {(start || end || invitation.locationText) && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {[
                          start && end ? `${start} – ${end}` : (start ?? end),
                          invitation.locationText,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  {invitation.status === 'accepted' && <Badge>Ai acceptat</Badge>}
                  {invitation.status === 'declined' && (
                    <Badge variant="secondary">Ai refuzat</Badge>
                  )}
                </div>
                {invitation.status === 'invited' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-11"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({ competitionId: invitation.competitionId, accept: true })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({ competitionId: invitation.competitionId, accept: false })
                      }
                    >
                      Refuz
                    </Button>
                    <p className="text-muted-foreground w-full text-xs">
                      Numele și poza ta apar pe pagina publică a concursului doar dacă accepți.
                    </p>
                  </div>
                )}
                {invitation.status === 'accepted' && (
                  <Link
                    to={`/coach/competitions/${invitation.competitionId}/results`}
                    className="text-primary inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Completează podiumul după concurs
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
