import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock } from 'lucide-react'
import { toast } from 'sonner'

import { approveClub } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { plural } from '@/lib/plural'
import { ClubRow } from './ClubGroupCard'
import type { ClubSummary } from './club-overview'

export function PendingClubsCard({
  clubs,
  query,
  coursesKnown,
}: {
  clubs: ClubSummary[]
  query: string
  coursesKnown: boolean
}) {
  const qc = useQueryClient()
  const [target, setTarget] = useState<ClubSummary | null>(null)
  const approve = useMutation({
    mutationFn: (club: ClubSummary) => approveClub(club.id),
    onSuccess: (_res, club) => {
      setTarget(null)
      void qc.invalidateQueries({ queryKey: ['admin-clubs'] })
      toast.success(`Clubul ${club.name} a fost aprobat.`)
    },
    onError: () => toast.error('Nu am putut aproba clubul.'),
  })

  if (clubs.length === 0) return null

  return (
    <section
      aria-labelledby="pending-clubs-title"
      className="bg-card border-primary/40 overflow-hidden rounded-xl border"
    >
      <div className="flex min-h-16 items-center gap-3 px-4 py-3 md:px-5">
        <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full">
          <Clock aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <h2 id="pending-clubs-title" className="font-display text-foreground font-semibold">
            De aprobat
          </h2>
          <span className="text-muted-foreground block text-sm">
            <strong className="text-foreground tabular-nums">{clubs.length}</strong>{' '}
            {clubs.length === 1
              ? 'club nou, ascuns de pe site până îl aprobi'
              : `${plural(clubs.length, 'club nou', 'cluburi noi', true)}, ascunse de pe site până le aprobi`}
          </span>
        </span>
      </div>
      <ul className="divide-y border-t">
        {clubs.map((club) => (
          <ClubRow
            key={club.id}
            club={club}
            query={query}
            coursesKnown={coursesKnown}
            action={
              <Button
                type="button"
                size="sm"
                className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9"
                onClick={() => setTarget(club)}
              >
                <Check aria-hidden="true" /> Aprobă
              </Button>
            }
          />
        ))}
      </ul>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Aprobi clubul ${target?.name ?? ''}?`}
        description="Clubul apare pe paginile publice și își poate publica cursurile, taberele și activitățile."
        confirmLabel={approve.isPending ? 'Se aprobă…' : 'Aprobă clubul'}
        onConfirm={() => target && approve.mutate(target)}
        pending={approve.isPending}
      />
    </section>
  )
}
