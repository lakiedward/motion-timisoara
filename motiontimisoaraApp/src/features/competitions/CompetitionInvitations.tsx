import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  getMyCompetitionInvitations,
  respondToCompetitionInvitation,
} from '@/api/competition/competition-coaches'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { competitionWhen } from './list/competition-list'

export function CompetitionInvitations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [toDecline, setToDecline] = useState<{ competitionId: string; title: string } | null>(null)
  const invitationsQuery = useQuery({
    queryKey: ['competition-invitations', user?.id],
    queryFn: () => getMyCompetitionInvitations(user!.id),
    enabled: Boolean(user?.id),
  })
  const respond = useMutation({
    mutationFn: ({ competitionId, accept }: { competitionId: string; accept: boolean }) =>
      respondToCompetitionInvitation(competitionId, accept),
    onSuccess: (_data, variables) => {
      setToDecline(null)
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
    onError: () => {
      setToDecline(null)
      toast.error('Nu am putut trimite răspunsul.')
    },
  })

  if (!user?.id) return null

  if (invitationsQuery.isPending) {
    return <Skeleton className="mb-6 h-28 w-full rounded-xl" />
  }

  if (invitationsQuery.isError) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca invitațiile la concursuri."
        onRetry={invitationsQuery.isFetching ? undefined : () => void invitationsQuery.refetch()}
        className="mb-6"
      />
    )
  }

  const answering = respond.isPending || invitationsQuery.isFetching
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
            const when = invitation.startAt
              ? competitionWhen({ start_at: invitation.startAt, end_at: invitation.endAt })
              : null
            return (
              <li
                key={invitation.competitionId}
                className="bg-card space-y-3 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/concursuri/${invitation.slug}`}
                      className="font-medium hover:underline"
                    >
                      {invitation.title}
                    </Link>
                    {(when || invitation.locationText) && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {[when, invitation.locationText].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {invitation.status === 'invited' && (
                    <Badge variant="highlight">Așteaptă răspunsul tău</Badge>
                  )}
                  {invitation.status === 'accepted' && <Badge>Ai acceptat</Badge>}
                  {invitation.status === 'declined' && (
                    <Badge variant="secondary">Ai refuzat</Badge>
                  )}
                </div>
                {invitation.status === 'invited' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-touch-target"
                      disabled={answering}
                      aria-label={`Acceptă invitația la ${invitation.title}`}
                      onClick={() =>
                        respond.mutate({ competitionId: invitation.competitionId, accept: true })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-touch-target"
                      disabled={answering}
                      aria-label={`Refuză invitația la ${invitation.title}`}
                      onClick={() =>
                        setToDecline({
                          competitionId: invitation.competitionId,
                          title: invitation.title,
                        })
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
                    className="text-primary inline-flex min-h-touch-target items-center text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Completează podiumul după concurs
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDecline}
        onOpenChange={(open) => !open && setToDecline(null)}
        title={`Refuzi invitația la „${toDecline?.title ?? ''}”?`}
        description="Răspunsul nu se mai poate schimba după ce îl trimiți."
        confirmLabel="Refuz invitația"
        destructive
        pending={respond.isPending}
        onConfirm={() =>
          toDecline && respond.mutate({ competitionId: toDecline.competitionId, accept: false })
        }
      />
    </section>
  )
}
