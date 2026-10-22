import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, CalendarDays, Check, MapPin, X } from 'lucide-react'

import { raspundeInvitatie, type InvitatieDeRaspuns } from '@/api/camp-coaches'
import { formatZi } from '@/api/camps'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { plural } from '@/lib/plural'
import { pendingInvitations } from './list/camp-list'
import { INVITATIONS_KEY, useCampInvitations } from './useCampInvitations'

function InvitationCard({
  invitation,
  busy,
  onAnswer,
}: {
  key?: string
  invitation: InvitatieDeRaspuns
  busy: boolean
  onAnswer: (accept: boolean) => void
}) {
  return (
    <li className="bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="space-y-1">
        <Link
          to={`/tabere/${invitation.slug}`}
          className="font-display min-h-touch-target inline-flex items-center font-semibold wrap-anywhere underline-offset-4 hover:underline"
        >
          {invitation.titlu}
        </Link>
        <ul className="text-muted-foreground space-y-1 text-sm">
          {invitation.invitatDe && (
            <li className="flex items-center gap-1">
              <Building2 aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="sr-only">Invitat de </span>
              {invitation.invitatDe}
            </li>
          )}
          <li className="flex items-center gap-1">
            <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
            {formatZi(invitation.perioadaStart)} – {formatZi(invitation.perioadaEnd)}
          </li>
          {invitation.loc && (
            <li className="flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{invitation.loc}</span>
            </li>
          )}
        </ul>
      </div>
      <div className="mt-auto flex gap-2">
        <Button
          type="button"
          className="h-touch-target min-h-touch-target flex-1"
          disabled={busy}
          aria-label={`Accept invitația la ${invitation.titlu}`}
          onClick={() => onAnswer(true)}
        >
          <Check aria-hidden="true" /> Accept
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-touch-target min-h-touch-target flex-1"
          disabled={busy}
          aria-label={`Refuz invitația la ${invitation.titlu}`}
          onClick={() => onAnswer(false)}
        >
          <X aria-hidden="true" /> Refuz
        </Button>
      </div>
    </li>
  )
}

export default function CampInvitations() {
  const qc = useQueryClient()
  const { data = [], isPending, isError } = useCampInvitations()

  const answer = useMutation({
    mutationFn: ({ campId, accept }: { campId: string; accept: boolean }) =>
      raspundeInvitatie(campId, accept),
    onSuccess: (_d, v) => {
      toast.success(
        v.accept
          ? 'Ai acceptat. Tabăra apare acum în lista ta și pe pagina taberei.'
          : 'Ai refuzat invitația.',
      )
      void qc.invalidateQueries({ queryKey: [INVITATIONS_KEY] })
    },
    onError: () => toast.error('Nu am putut trimite răspunsul.'),
  })

  if (isPending) return <Skeleton className="mb-8 h-40 w-full rounded-2xl" />

  if (isError) return null

  const pending = pendingInvitations(data)
  if (!pending.length) return null

  return (
    <section
      aria-labelledby="camp-invitations-title"
      className="bg-accent/60 border-primary/30 mb-8 min-w-0 space-y-3 rounded-2xl border p-4 sm:p-5"
    >
      <h2
        id="camp-invitations-title"
        className="font-display text-foreground text-lg font-semibold"
      >
        Ai{' '}
        {pending.length === 1
          ? 'o invitație nouă'
          : plural(pending.length, 'invitație nouă', 'invitații noi')}{' '}
        la tabere
      </h2>
      <p className="text-muted-foreground text-sm">
        Numele și poza ta apar pe pagina publică a taberei doar dacă accepți. După ce accepți,
        tabăra intră în lista de mai jos.
      </p>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pending.map((i) => (
          <InvitationCard
            key={i.campId}
            invitation={i}
            busy={answer.isPending}
            onAnswer={(accept) => answer.mutate({ campId: i.campId, accept })}
          />
        ))}
      </ul>
    </section>
  )
}
