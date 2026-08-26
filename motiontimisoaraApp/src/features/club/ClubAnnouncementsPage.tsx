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
  getMyClub,
  setAnnouncementActive,
  type ClubAnnouncement,
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

// Verificarea se facea in tacere, direct in onSubmit: daca titlul sau continutul
// erau prea scurte, functia iesea fara sa spuna nimic, deci apasarea pe „Publica”
// nu producea absolut niciun efect vizibil. Acum lipsa are un mesaj, pe camp.
const schema = z.object({
  title: z.string().trim().min(2, 'Scrie un titlu de cel puțin 2 caractere'),
  content: z.string().trim().min(2, 'Scrie conținutul anunțului'),
  priority: z.string(),
})
type Values = z.infer<typeof schema>

const FORMULAR_GOL: Values = { title: '', content: '', priority: 'NORMAL' }

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
  const { data: club, isPending: seIncarcaClubul } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
  })
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: FORMULAR_GOL })

  const invalideaza = () => qc.invalidateQueries({ queryKey: ['club-announcements', clubId] })

  const create = useMutation({
    mutationFn: (v: Values) =>
      createClubAnnouncement({
        club_id: clubId,
        title: v.title.trim(),
        content: v.content.trim(),
        priority: v.priority,
      }),
    onSuccess: () => {
      reset(FORMULAR_GOL)
      invalideaza()
      toast.success('Anunț publicat.')
    },
    onError: () => toast.error('Nu am putut publica anunțul.'),
  })

  // Cele doua mutatii de mai jos nu aveau tratare de eroare, deci un refuz al
  // bazei pleca in tacere si ecranul ramanea neschimbat, ca dupa o reusita.
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setAnnouncementActive(id, active),
    onSuccess: invalideaza,
    onError: () => toast.error('Nu am putut schimba vizibilitatea anunțului.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteClubAnnouncement(id),
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
            {...register('title')}
          />
          {errors.title && (
            <p role="alert" className="text-destructive text-sm">
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
            className={`${campCls} py-2`}
            {...register('content')}
          />
          {errors.content && (
            <p role="alert" className="text-destructive text-sm">
              {errors.content.message}
            </p>
          )}
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
          <Button type="submit" className="h-11 lg:h-9" disabled={create.isPending}>
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
      ) : isError && !items.length ? (
        // Garda pe lungime conteaza la fel de mult ca ramura: publicarea si
        // comutarea invalideaza lista, iar un refetch picat trecator n-are voie
        // sa stearga de pe ecran anunturile deja incarcate.
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca anunțurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : items.length ? (
        <ul className="space-y-3">
          {items.map((a) => {
            const p = PRIORITY[a.priority] ?? PRIORITY.NORMAL
            const seAscunde = toggle.isPending && toggle.variables?.id === a.id
            const seSterge = del.isPending && del.variables === a.id
            return (
              <li key={a.id} className="bg-card shadow-card rounded-2xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <Badge variant={p.variant}>{p.label}</Badge>
                  {!a.is_active && <Badge variant="outline">Ascuns</Badge>}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{formatData(a.created_at)}</p>
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
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
          Niciun anunț încă.
        </div>
      )}
    </div>
  )
}
