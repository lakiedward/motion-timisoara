import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteClubAnnouncement,
  setAnnouncementActive,
  type ClubAnnouncement,
  type ClubAudience,
} from '@/api/club'
import { stergeFisiereleAnuntului, type AtasamentAfisabil } from '@/api/attachments'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { ClubAnnouncementCard } from './ClubAnnouncementCard'
import { ClubAnnouncementFilterBar } from './ClubAnnouncementFilterBar'
import { grupeazaPeStare, numeleTintei } from './announcement-list'
import {
  NO_FILTERS,
  filterClubAnnouncements,
  hasFilters,
  statusCounts,
  targetCounts,
  type ClubAnnouncementFilters,
} from './club-announcement-filters'

type Props = {
  items: ClubAnnouncement[]
  tinte: ClubAudience[]
  tinteNecunoscute: boolean
  atasamente: Record<string, AtasamentAfisabil[]>
  onChanged: () => void
}

export function ClubAnnouncementList({
  items,
  tinte,
  tinteNecunoscute,
  atasamente,
  onChanged,
}: Props) {
  const [filters, setFilters] = useState<ClubAnnouncementFilters>(NO_FILTERS)
  const [deSters, setDeSters] = useState<ClubAnnouncement | null>(null)
  const [seAscund, setSeAscund] = useState<string[]>([])
  const [deEditat, setDeEditat] = useState<string | null>(null)
  const termina = (saved: boolean) => {
    setDeEditat(null)
    if (saved) onChanged()
  }
  const tinta = (a: ClubAnnouncement) => numeleTintei(a, tinte, tinteNecunoscute)
  const filtreVizibile = items.length > 1
  const randuri = filtreVizibile ? filterClubAnnouncements(items, filters, tinta) : items

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setAnnouncementActive(id, active),
    onMutate: ({ id }) => setSeAscund((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setSeAscund((l) => l.filter((x) => x !== id)),
    onSuccess: (a) => {
      onChanged()
      toast.success(
        a.is_active ? 'Anunțul se vede din nou la părinți.' : 'Anunț ascuns de părinți.',
      )
    },
    onError: () => toast.error('Nu am putut schimba vizibilitatea anunțului.'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => {
      await stergeFisiereleAnuntului(id)
      return deleteClubAnnouncement(id)
    },
    onSuccess: () => {
      setDeSters(null)
      onChanged()
      toast.success('Anunț șters.')
    },
    onError: () => toast.error('Nu am putut șterge anunțul.'),
  })

  const props = (a: ClubAnnouncement) => ({
    anunt: a,
    tinta: tinta(a),
    atasamente: atasamente[a.id] ?? [],
    seAscunde: seAscund.includes(a.id),
    seSterge: del.isPending && del.variables === a.id,
    onToggle: () => toggle.mutate({ id: a.id, active: !a.is_active }),
    editezAici: deEditat === a.id,
    onEdit: () => setDeEditat(a.id),
    onEditDone: termina,
    onDelete: () => setDeSters(a),
  })

  return (
    <section aria-labelledby="anunturi-publicate" className="space-y-4">
      <h2 id="anunturi-publicate" className="font-display text-lg font-semibold">
        Anunțuri publicate
      </h2>
      {filtreVizibile && (
        <ClubAnnouncementFilterBar
          filters={filters}
          statusCounts={statusCounts(items)}
          targets={targetCounts(items, tinte)}
          onChange={setFilters}
        />
      )}
      {filtreVizibile && hasFilters(filters) && (
        <p className="text-muted-foreground text-sm" role="status">
          {randuri.length} din {items.length}
        </p>
      )}

      {randuri.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun anunț pentru filtrele alese."
          text="Schimbă căutarea sau filtrele."
          action={
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-touch-target min-h-touch-target"
              onClick={() => setFilters(NO_FILTERS)}
            >
              Șterge filtrele
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grupeazaPeStare(randuri).map((g) => (
            <section key={g.key} aria-label={g.title}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-base font-semibold">{g.title}</h3>
                <span className="text-muted-foreground text-sm">
                  {plural(g.items.length, 'anunț', 'anunțuri')}
                </span>
              </div>
              <ul className="space-y-3" aria-label={`Anunțuri ${g.title}`}>
                {g.items.map((a) => (
                  <li key={a.id} className="min-w-0">
                    <ClubAnnouncementCard {...props(a)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deSters !== null}
        onOpenChange={(open) => !open && setDeSters(null)}
        title={deSters ? `Ștergi anunțul „${deSters.title}”?` : ''}
        description="Anunțul dispare definitiv, inclusiv pentru părinți, împreună cu pozele și filmarea lui. Acțiunea este ireversibilă."
        confirmLabel="Șterge"
        destructive
        pending={del.isPending}
        onConfirm={() => deSters && del.mutate(deSters.id)}
      />
    </section>
  )
}
