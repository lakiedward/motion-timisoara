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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { ClubAnnouncementCard } from './ClubAnnouncementCard'
import { ETICHETA_TINTA, grupeazaPeStare, numeleTintei } from './announcement-list'

const TOATE = 'TOATE'
const TOT_CLUBUL = 'CLUB'
const campCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] sm:w-64 lg:h-9'

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
  const [filtru, setFiltru] = useState(TOATE)
  const [deSters, setDeSters] = useState<ClubAnnouncement | null>(null)
  const [seAscund, setSeAscund] = useState<string[]>([])
  const [deEditat, setDeEditat] = useState<string | null>(null)
  const termina = (saved: boolean) => {
    setDeEditat(null)
    if (saved) onChanged()
  }
  const filtruVizibil = items.length > 1
  const filtruActiv = filtruVizibil ? filtru : TOATE
  const randuri =
    filtruActiv === TOATE
      ? items
      : filtruActiv === TOT_CLUBUL
        ? items.filter((a) => a.audience_kind === 'CLUB')
        : items.filter((a) => `${a.audience_kind}:${a.audience_id}` === filtruActiv)

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
    tinta: numeleTintei(a, tinte, tinteNecunoscute),
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="anunturi-publicate" className="font-display text-lg font-semibold">
          Anunțuri publicate
        </h2>
        {filtruVizibil && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtru" className="text-muted-foreground text-sm font-normal">
              Arată
            </Label>
            <select
              id="filtru"
              className={campCls}
              value={filtru}
              onChange={(e) => setFiltru(e.target.value)}
            >
              <option value={TOATE}>Toate anunțurile</option>
              <option value={TOT_CLUBUL}>Doar către tot clubul</option>
              {tinte.map((t) => (
                <option key={t.id} value={`${t.kind}:${t.id}`}>
                  {ETICHETA_TINTA[t.kind]}: {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {filtruActiv !== TOATE && (
        <p className="text-muted-foreground text-sm" role="status">
          {randuri.length} din {items.length}
        </p>
      )}

      {randuri.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun anunț către ținta aleasă."
          text="Alege altă țintă sau vezi toate anunțurile."
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
