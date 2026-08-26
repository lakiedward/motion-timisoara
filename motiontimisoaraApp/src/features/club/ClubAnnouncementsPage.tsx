import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  getClubAnnouncements,
  getClubAudiences,
  getMyClub,
  setAnnouncementActive,
  type AudienceKind,
  type ClubAnnouncement,
  type ClubAudience,
} from '@/api/club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const PRIORITY: Record<
  string,
  { label: string; variant: 'secondary' | 'default' | 'highlight' | 'destructive' }
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

/** Ținta circulă prin formular ca un singur șir, fiindcă un `<select>` are o
 *  singură valoare: „CLUB”, sau „COURSE:<id>” / „ACTIVITY:<id>”. */
function citesteTinta(v: string): { kind: AudienceKind; id: string | null } {
  if (v === TOT_CLUBUL) return { kind: 'CLUB', id: null }
  const [kind, id] = v.split(':')
  return { kind: kind as AudienceKind, id: id ?? null }
}
const scrieTinta = (a: ClubAudience) => `${a.kind}:${a.id}`

const ETICHETA_TINTA: Record<string, string> = { COURSE: 'Curs', ACTIVITY: 'Activitate', CAMP: 'Tabără' }

/** Ce scrie pe card despre cine primește anunțul. */
function numeleTintei(a: ClubAnnouncement, tinte: ClubAudience[]): string {
  if (a.audience_kind === 'CLUB') return 'Toți părinții clubului'
  const gasita = tinte.find((t) => t.id === a.audience_id)
  const fel = ETICHETA_TINTA[a.audience_kind] ?? a.audience_kind
  // Textul de rezervă contează: `activities_select` nu are clauză de club, deci o
  // activitate dezactivată nu se mai citește și numele ei nu se poate rezolva.
  return gasita ? `${fel}: ${gasita.name}` : `${fel} indisponibil`
}

// Verificarea se facea in tacere, direct in onSubmit: daca titlul sau continutul
// erau prea scurte, functia iesea fara sa spuna nimic, deci apasarea pe „Publica”
// nu producea absolut niciun efect vizibil. Acum lipsa are un mesaj, pe camp.
const schema = z.object({
  title: z.string().trim().min(2, 'Scrie un titlu de cel puțin 2 caractere'),
  content: z.string().trim().min(2, 'Scrie conținutul anunțului'),
  priority: z.string(),
  audience: z.string(),
})
type Values = z.infer<typeof schema>

const FORMULAR_GOL: Values = {
  title: '',
  content: '',
  priority: 'NORMAL',
  audience: TOT_CLUBUL,
}

/** „26 august 2026”, acelasi format ca pe pagina de anunturi a parintelui. */
function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function ClubAnnouncementsPage() {
  const qc = useQueryClient()
  // `isError` de pe clubul propriu contează la fel de mult ca cel de pe anunțuri:
  // dacă `getMyClub` pică, `isPending` devine fals, `clubId` rămâne gol, deci
  // interogarea anunțurilor stă oprită — iar o interogare oprită are `isLoading`
  // fals ȘI `isError` fals. Fără ramura de mai jos, cascada cădea pe ultima
  // ramură și un club cu anunțuri primea „Niciun anunț încă.” la o rețea picată.
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

  // Ținele se cer o dată și servesc la două lucruri: alegerea din formular (doar
  // cele active) și eticheta de pe fiecare card (și cele oprite între timp).
  const { data: tinte = [] } = useQuery({
    queryKey: ['club-audiences', clubId],
    queryFn: () => getClubAudiences(clubId),
    enabled: !!clubId,
  })
  const tinteActive = tinte.filter((t) => t.active)

  const [filtru, setFiltru] = useState(TOATE)
  const randuri =
    filtru === TOATE
      ? items
      : filtru === TOT_CLUBUL
        ? items.filter((a) => a.audience_kind === 'CLUB')
        : items.filter((a) => `${a.audience_kind}:${a.audience_id}` === filtru)

  const aEsuatIncarcarea = aEsuatClubul || (isError && !items.length)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: FORMULAR_GOL })

  const invalideaza = () => qc.invalidateQueries({ queryKey: ['club-announcements', clubId] })

  const create = useMutation({
    mutationFn: (v: Values) => {
      const tinta = citesteTinta(v.audience)
      return createClubAnnouncement({
        club_id: clubId,
        title: v.title.trim(),
        content: v.content.trim(),
        priority: v.priority,
        audience_kind: tinta.kind,
        audience_id: tinta.id,
      })
    },
    onSuccess: () => {
      reset(FORMULAR_GOL)
      invalideaza()
      toast.success('Anunț publicat.')
    },
    onError: () => toast.error('Nu am putut publica anunțul.'),
  })

  // Cele doua mutatii de mai jos nu aveau tratare de eroare, deci un refuz al
  // bazei pleca in tacere si ecranul ramanea neschimbat, ca dupa o reusita.
  //
  // Cine e in zbor se tine aici, pe id, NU prin `mutation.variables`: mutatia e
  // una singura pentru toata lista, iar `variables` pastreaza doar argumentele
  // ULTIMULUI `mutate`. Cu garda pe `variables`, o a doua apasare pe alt rand
  // muta reperul si redeschidea butonul primului rand cat timp cererea lui era
  // inca in zbor — deci a doua apasare pe el chiar pleca la server.
  const [seAscund, setSeAscund] = useState<string[]>([])
  const [seSterg, setSeSterg] = useState<string[]>([])
  const adauga = (set: typeof setSeAscund, id: string) => set((l) => [...l, id])
  const scoate = (set: typeof setSeAscund, id: string) =>
    set((l) => l.filter((x) => x !== id))

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setAnnouncementActive(id, active),
    onMutate: ({ id }) => adauga(setSeAscund, id),
    onSettled: (_d, _e, { id }) => scoate(setSeAscund, id),
    onSuccess: invalideaza,
    onError: () => toast.error('Nu am putut schimba vizibilitatea anunțului.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteClubAnnouncement(id),
    onMutate: (id) => adauga(setSeSterg, id),
    onSettled: (_d, _e, id) => scoate(setSeSterg, id),
    onSuccess: () => {
      invalideaza()
      toast.success('Anunț șters.')
    },
    onError: () => toast.error('Nu am putut șterge anunțul.'),
  })

  // Stergerea e definitiva si pleca la o singura apasare, fara nicio intrebare.
  // In aceeasi aplicatie stergerea unui copil, stergerea unui sport si eliminarea
  // unui antrenor cer toate confirmare; anunturile erau singura exceptie.
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

      <form
        onSubmit={handleSubmit((v) => create.mutate(v))}
        noValidate
        className="bg-card shadow-card mb-6 space-y-3 rounded-3xl border p-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Titlu</Label>
          <Input
            id="title"
            className="h-11 lg:h-9"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-eroare' : undefined}
            {...register('title')}
          />
          {errors.title && (
            <p id="title-eroare" role="alert" className="text-destructive text-sm">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="content">Conținut</Label>
          <textarea
            id="content"
            rows={4}
            aria-invalid={!!errors.content}
            aria-describedby={errors.content ? 'content-eroare' : undefined}
            className={`${campCls} py-2`}
            {...register('content')}
          />
          {errors.content && (
            <p id="content-eroare" role="alert" className="text-destructive text-sm">
              {errors.content.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audience">Cine primește</Label>
          <select id="audience" className={`${campCls} h-11 lg:h-9`} {...register('audience')}>
            <option value={TOT_CLUBUL}>Toți părinții clubului</option>
            {/* Doar tintele active se pot alege pentru un anunt NOU; cele oprite
                raman in `tinte` doar ca sa se poata eticheta anunturile vechi. */}
            {tinteActive.filter((t) => t.kind === 'COURSE').length > 0 && (
              <optgroup label="Cursuri">
                {tinteActive
                  .filter((t) => t.kind === 'COURSE')
                  .map((t) => (
                    <option key={t.id} value={scrieTinta(t)}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            )}
            {tinteActive.filter((t) => t.kind === 'ACTIVITY').length > 0 && (
              <optgroup label="Activități">
                {tinteActive
                  .filter((t) => t.kind === 'ACTIVITY')
                  .map((t) => (
                    <option key={t.id} value={scrieTinta(t)}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
          <p className="text-muted-foreground text-xs">
            Anunțul ajunge doar la părinții cu un copil înscris activ.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label htmlFor="priority">Prioritate</Label>
            <select id="priority" className={`${campCls} h-11 lg:h-9`} {...register('priority')}>
              <option value="LOW">Scăzută</option>
              <option value="NORMAL">Normală</option>
              <option value="HIGH">Ridicată</option>
              <option value="URGENT">Urgentă</option>
            </select>
          </div>
          {/* Fara `!clubId` publicarea pleca cu club_id gol daca omul apuca sa
              scrie si sa apese inainte ca `getMyClub` sa raspunda: Postgres
              respingea uuid-ul gol, iar clubul vedea o eroare pentru un formular
              completat corect. Codul de dinainte avea garda asta in onSubmit. */}
          <Button
            type="submit"
            className="h-11 lg:h-9"
            disabled={create.isPending || !clubId}
          >
            Publică
          </Button>
        </div>
      </form>

      {seIncarcaClubul || isLoading ? (
        // Si clubul se asteapta aici: cat timp se incarca el, interogarea
        // anunturilor e oprita, deci `isLoading` e fals si ecranul ar arata o
        // clipa „Niciun anunt inca.” pe un club care are anunturi.
        <div className="space-y-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : aEsuatIncarcarea ? (
        // Garda pe lungime conteaza la fel de mult ca ramura: publicarea si
        // comutarea invalideaza lista, iar un refetch picat trecator n-are voie
        // sa stearga de pe ecran anunturile deja incarcate.
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca anunțurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={reincearca}>
            Reîncearcă
          </Button>
        </div>
      ) : !club ? (
        // Un cont CLUB fara club asociat nu are ce lista si nu poate publica.
        // Fara ramura asta vedea „Niciun anunt inca.” si un formular care ar fi
        // esuat la trimitere. Acelasi tratament ca in panoul clubului.
        <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
          Niciun club asociat contului.
        </div>
      ) : items.length ? (
        <>
          {/* Filtrul e partea „sa vad la fiecare ce am trimis”: apare abia cand
              exista mai mult de un anunt, ca sa nu incarce ecranul degeaba. */}
          {items.length > 1 && (
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
              {filtru !== TOATE && (
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
                  <span>Trimis către: {numeleTintei(a, tinte)}</span>
                </p>
                {/* Randurile scrise de club se pastreaza: fara asta un anunt scris
                    pe trei randuri se citea ca un bloc continuu. Pagina de anunturi
                    a parintelui foloseste deja acelasi tratament. */}
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{a.content}</p>
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
                    // Doar butonul apasat se blocheaza, si doar cat timp cererea
                    // lui e in curs: pana acum niciun buton nu se dezactiva, deci
                    // doua apasari repezi trimiteau doua cereri.
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
