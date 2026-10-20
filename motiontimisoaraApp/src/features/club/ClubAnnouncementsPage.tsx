import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createClubAnnouncement,
  getClubAnnouncements,
  getClubAudiences,
  getMyClub,
  type AudienceKind,
  type ClubAudience,
} from '@/api/club'
import { getAtasamente, incarcaAtasamente } from '@/api/attachments'
import {
  MAX_FILM_MB,
  MAX_FILM_SECUNDE,
  MAX_FILME,
  MAX_POZE,
  marime,
  pregatesteFisiere,
  RETENTIE_FILM_ZILE,
  type FisierPregatit,
} from '@/lib/media'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import { ClubAnnouncementList } from './announcements/ClubAnnouncementList'
const campCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
const TOT_CLUBUL = 'CLUB'
function citesteTinta(v: string): {
  kind: AudienceKind
  id: string | null
} {
  if (v === TOT_CLUBUL) return { kind: 'CLUB', id: null }
  const [kind, id] = v.split(':')
  return { kind: kind as AudienceKind, id: id ?? null }
}
const scrieTinta = (a: ClubAudience) => `${a.kind}:${a.id}`
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
  const aEsuatIncarcarea = aEsuatClubul || (isError && !items.length)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: FORMULAR_GOL })
  const [fisiere, setFisiere] = useState<FisierPregatit[]>([])
  const [sePregatesc, setSePregatesc] = useState(false)
  const numarPoze = fisiere.filter((f) => f.fel === 'IMAGE').length
  const numarFilme = fisiere.filter((f) => f.fel === 'VIDEO').length
  const alegeFisiere = async (lista: File[]) => {
    if (!lista.length) return
    setSePregatesc(true)
    try {
      const { pregatite, refuzate } = await pregatesteFisiere(lista, {
        poze: numarPoze,
        filme: numarFilme,
      })
      if (pregatite.length) setFisiere((f) => [...f, ...pregatite])
      for (const motiv of refuzate) toast.error(motiv)
    } finally {
      setSePregatesc(false)
    }
  }
  const deschideGaleria = async () => {
    setSePregatesc(true)
    try {
      const alese = await alegeDinGalerie(MAX_POZE + MAX_FILME - fisiere.length)
      setSePregatesc(false)
      await alegeFisiere(alese)
    } catch {
      setSePregatesc(false)
      toast.error('Nu am putut deschide galeria.')
    }
  }
  const { data: atasamente = {} } = useQuery({
    queryKey: ['club-announcement-media', items.map((a) => a.id).join(',')],
    queryFn: () => getAtasamente(items.map((a) => a.id)),
    enabled: items.length > 0,
  })
  const invalideaza = () => {
    qc.invalidateQueries({ queryKey: ['club-announcements', clubId] })
    qc.invalidateQueries({ queryKey: ['club-announcement-media'] })
  }
  const create = useMutation({
    mutationFn: async (v: Values) => {
      const tinta = citesteTinta(v.audience)
      const anunt = await createClubAnnouncement({
        club_id: clubId,
        title: v.title.trim(),
        content: v.content.trim(),
        priority: v.priority,
        audience_kind: tinta.kind,
        audience_id: tinta.id,
      })
      if (fisiere.length) await incarcaAtasamente(anunt.id, fisiere)
      return anunt
    },
    onSuccess: () => {
      reset(FORMULAR_GOL)
      setFisiere([])
      invalideaza()
      toast.success('Anunț publicat.')
    },
    onError: () => toast.error('Nu am putut publica anunțul.'),
  })
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
          <Label htmlFor="media">Poze și filmare</Label>

          {galeriaSeDeschideNativ() ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full lg:h-9"
              disabled={sePregatesc}
              onClick={() => void deschideGaleria()}
            >
              <ImagePlus /> Alege din galerie
            </Button>
          ) : (
            <input
              id="media"
              type="file"
              multiple
              accept="image/*,video/*"
              disabled={sePregatesc}
              className="text-muted-foreground file:bg-secondary file:text-secondary-foreground block w-full text-sm file:mr-3 file:h-11 file:rounded-md file:border-0 file:px-4 file:text-sm file:font-medium lg:file:h-9"
              onChange={(e) => {
                void alegeFisiere(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          )}
          <p className="text-muted-foreground text-xs">
            Cel mult {MAX_POZE} poze și {MAX_FILME} filmare de {MAX_FILM_SECUNDE} de secunde (
            {MAX_FILM_MB} MB). Pozele rămân; filmarea se șterge după {RETENTIE_FILM_ZILE} de zile.
          </p>
          {sePregatesc && <p className="text-muted-foreground text-xs">Se pregătesc fișierele…</p>}
          {!!fisiere.length && (
            <ul className="space-y-1">
              {fisiere.map((f, i) => (
                <li
                  key={`${f.numeOriginal}-${i}`}
                  className="bg-muted/50 flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm"
                >
                  <span className="truncate">
                    {f.fel === 'VIDEO' ? '🎬' : '🖼️'} {f.numeOriginal}{' '}
                    <span className="text-muted-foreground">({marime(f.continut.size)})</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-11 shrink-0 lg:h-9"
                    aria-label={`Scoate ${f.numeOriginal}`}
                    onClick={() => setFisiere((l) => l.filter((_, j) => j !== i))}
                  >
                    Scoate
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audience">Cine primește</Label>
          <select id="audience" className={`${campCls} h-11 lg:h-9`} {...register('audience')}>
            <option value={TOT_CLUBUL}>Toți părinții clubului</option>

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
            {tinteActive.filter((t) => t.kind === 'CAMP').length > 0 && (
              <optgroup label="Tabere">
                {tinteActive
                  .filter((t) => t.kind === 'CAMP')
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

          <Button type="submit" className="h-11 lg:h-9" disabled={create.isPending || !clubId}>
            Publică
          </Button>
        </div>
      </form>

      {seIncarcaClubul || isLoading ? (
        <StatusView state="loading" title="Se încarcă anunțurile" rows={2} rowHeight={160} />
      ) : aEsuatIncarcarea ? (
        <StatusView
          state="error"
          title="Nu am putut încărca anunțurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void reincearca()}
        />
      ) : !club ? (
        <StatusView state="empty" title="Niciun club asociat contului." />
      ) : items.length ? (
        <ClubAnnouncementList
          items={items}
          tinte={tinte}
          tinteNecunoscute={aEsuatTintele}
          atasamente={atasamente}
          onChanged={invalideaza}
        />
      ) : (
        <StatusView
          state="empty"
          title="Niciun anunț încă."
          text="Anunțurile pe care le publici apar aici, iar părinții le văd în contul lor."
        />
      )}
    </div>
  )
}
