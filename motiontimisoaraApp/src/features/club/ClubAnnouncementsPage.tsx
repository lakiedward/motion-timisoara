import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteClubAnnouncement,
  getClubAnnouncements,
  getClubAudiences,
  getMyClub,
  setAnnouncementActive,
  type ClubAnnouncement,
  type ClubAudience,
} from '@/api/club'
import { getAtasamente, stergeFisiereleAnuntului } from '@/api/attachments'
import AnnouncementComposeForm from './announcements/AnnouncementComposeForm'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
const PRIORITY: Record<
  string,
  {
    label: string
    variant: 'secondary' | 'default' | 'highlight' | 'destructive'
  }
> = {
  LOW: { label: 'Scăzută', variant: 'secondary' },
  NORMAL: { label: 'Normală', variant: 'default' },
  HIGH: { label: 'Ridicată', variant: 'highlight' },
  URGENT: { label: 'Urgentă', variant: 'destructive' },
}
const campCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
const TOT_CLUBUL = 'CLUB'
const TOATE = 'TOATE'
const scrieTinta = (a: ClubAudience) => `${a.kind}:${a.id}`
const ETICHETA_TINTA: Record<string, string> = {
  COURSE: 'Curs',
  ACTIVITY: 'Activitate',
  CAMP: 'Tabără',
}
const INDISPONIBIL: Record<string, string> = {
  COURSE: 'Curs indisponibil',
  ACTIVITY: 'Activitate indisponibilă',
  CAMP: 'Tabără indisponibilă',
}
function numeleTintei(
  a: ClubAnnouncement,
  tinte: ClubAudience[],
  tinteNecunoscute: boolean,
): string {
  if (a.audience_kind === 'CLUB') return 'Toți părinții clubului'
  const fel = ETICHETA_TINTA[a.audience_kind] ?? a.audience_kind
  const gasita = tinte.find((t) => t.kind === a.audience_kind && t.id === a.audience_id)
  if (gasita) return `${fel}: ${gasita.name}`
  if (tinteNecunoscute) return `${fel} — nu am putut încărca numele`
  return INDISPONIBIL[a.audience_kind] ?? `${fel} indisponibil`
}
function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
export default function ClubAnnouncementsPage() {
  const qc = useQueryClient()
  const {
    data: club,
    isPending: seIncarcaClubul,
    isError: aEsuatClubul,
    refetch: reincarcaClubul,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['club-announcements', clubId],
    queryFn: () => getClubAnnouncements(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const { data: tinte = [], isError: aEsuatTintele } = useQuery({
    queryKey: ['club-audiences', clubId],
    queryFn: () => getClubAudiences(clubId),
    enabled: !!clubId,
  })
  const tinteActive = tinte.filter((t) => t.active)
  const [filtru, setFiltru] = useState(TOATE)
  const filtruVizibil = items.length > 1
  const filtruActiv = filtruVizibil ? filtru : TOATE
  const randuri =
    filtruActiv === TOATE
      ? items
      : filtruActiv === TOT_CLUBUL
        ? items.filter((a) => a.audience_kind === 'CLUB')
        : items.filter((a) => `${a.audience_kind}:${a.audience_id}` === filtruActiv)
  const aEsuatIncarcarea = aEsuatClubul || (isError && !items.length)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())
  const { data: atasamente = {} } = useQuery({
    queryKey: ['club-announcement-media', items.map((a) => a.id).join(',')],
    queryFn: () => getAtasamente(items.map((a) => a.id)),
    enabled: items.length > 0,
  })
  const invalideaza = () => {
    qc.invalidateQueries({ queryKey: ['club-announcements', clubId] })
    qc.invalidateQueries({ queryKey: ['club-announcement-media'] })
  }
  const [seAscund, setSeAscund] = useState<string[]>([])
  const [seSterg, setSeSterg] = useState<string[]>([])
  const adauga = (set: typeof setSeAscund, id: string) => set((l) => [...l, id])
  const scoate = (set: typeof setSeAscund, id: string) => set((l) => l.filter((x) => x !== id))
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setAnnouncementActive(id, active),
    onMutate: ({ id }) => adauga(setSeAscund, id),
    onSettled: (_d, _e, { id }) => scoate(setSeAscund, id),
    onSuccess: invalideaza,
    onError: () => toast.error('Nu am putut schimba vizibilitatea anunțului.'),
  })
  const del = useMutation({
    mutationFn: async (id: string) => {
      await stergeFisiereleAnuntului(id)
      return deleteClubAnnouncement(id)
    },
    onMutate: (id) => adauga(setSeSterg, id),
    onSettled: (_d, _e, id) => scoate(setSeSterg, id),
    onSuccess: () => {
      invalideaza()
      toast.success('Anunț șters.')
    },
    onError: () => toast.error('Nu am putut șterge anunțul.'),
  })
  const cereStergerea = (a: ClubAnnouncement) => {
    if (confirm(`Ștergi anunțul „${a.title}”? Acțiunea este ireversibilă.`)) del.mutate(a.id)
  }
  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">
        Anunțuri
        {!!items.length && (
          <span className="text-muted-foreground ml-2 text-base font-normal">({items.length})</span>
        )}
      </h1>

      <AnnouncementComposeForm clubId={clubId} audiences={tinteActive} onPublished={invalideaza} />

      {seIncarcaClubul || isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : aEsuatIncarcarea ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca anunțurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={reincearca}>
            Reîncearcă
          </Button>
        </div>
      ) : !club ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
          Niciun club asociat contului.
        </div>
      ) : items.length ? (
        <>
          {filtruVizibil && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Label htmlFor="filtru" className="text-muted-foreground text-sm font-normal">
                Arată
              </Label>
              <select
                id="filtru"
                className={`${campCls} h-11 w-auto lg:h-9`}
                value={filtru}
                onChange={(e) => setFiltru(e.target.value)}
              >
                <option value={TOATE}>Toate anunțurile</option>
                <option value={TOT_CLUBUL}>Doar către tot clubul</option>
                {tinte.map((t) => (
                  <option key={t.id} value={scrieTinta(t)}>
                    {ETICHETA_TINTA[t.kind]}: {t.name}
                  </option>
                ))}
              </select>
              {filtruActiv !== TOATE && (
                <span className="text-muted-foreground text-sm">
                  {randuri.length} din {items.length}
                </span>
              )}
            </div>
          )}

          {randuri.length === 0 ? (
            <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
              Niciun anunț către ținta aleasă.
            </div>
          ) : (
            <ul className="space-y-3">
              {randuri.map((a) => {
                const p = PRIORITY[a.priority] ?? PRIORITY.NORMAL
                const seAscunde = seAscund.includes(a.id)
                const seSterge = seSterg.includes(a.id)
                return (
                  <li key={a.id} className="bg-card shadow-card rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{a.title}</h3>
                      <Badge variant={p.variant}>{p.label}</Badge>
                      {!a.is_active && <Badge variant="outline">Ascuns</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-xs">
                      <span>{formatData(a.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Trimis către: {numeleTintei(a, tinte, aEsuatTintele)}</span>
                    </p>

                    <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                      {a.content}
                    </p>
                    <AnnouncementMedia atasamente={atasamente[a.id] ?? []} />
                    {!a.is_active && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Ascuns — nu ajunge la părinți.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-11 lg:h-9"
                        disabled={seAscunde}
                        aria-label={`${a.is_active ? 'Ascunde' : 'Afișează'} anunțul „${a.title}”`}
                        onClick={() => toggle.mutate({ id: a.id, active: !a.is_active })}
                      >
                        {a.is_active ? 'Ascunde' : 'Afișează'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-11 lg:h-9"
                        disabled={seSterge}
                        aria-label={`Șterge anunțul „${a.title}”`}
                        onClick={() => cereStergerea(a)}
                      >
                        <Trash2 /> Șterge
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
          Niciun anunț încă.
        </div>
      )}
    </div>
  )
}
