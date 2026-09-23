import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import {
  createConcurs,
  getConcurs,
  stergeConcurs,
  updateConcurs,
  urlHeroConcurs,
} from '@/api/competition/competitions'
import { schimbaPozaConcurs, scoatePozaConcurs } from '@/api/competition/competition-hero'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'
import { alegeDinGalerie, galeriaSeDeschideNativ } from '@/lib/galerie'
import { esteImagine } from '@/lib/media'
import {
  competitionScheduleFromFields,
  competitionScheduleToFields,
} from '@/lib/competition-schedule'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CompetitionPortalBaza } from './competition-portal'
import { useCompetitionOwner } from './useCompetitionOwner'
import {
  competitionFormDefaults,
  competitionFormSchema,
  type CompetitionFormValues,
} from './form/competition-form-schema'
import { CompetitionScheduleSection } from './form/CompetitionScheduleSection'
import { CompetitionOffersSection } from './form/CompetitionOffersSection'
import { CompetitionCoachesSection } from './form/CompetitionCoachesSection'
import { CompetitionCashPaymentsSection } from './form/CompetitionCashPaymentsSection'

function mesajSalvare(eroare: unknown): string {
  if (eroare instanceof Error && eroare.message === 'Titlul trebuie să conțină litere sau cifre.') {
    return eroare.message
  }
  if (eroare instanceof Error && eroare.message === 'Poza trebuie să fie o imagine.') {
    return eroare.message
  }
  return 'Nu am putut salva concursul.'
}

export default function CompetitionFormPage({ baza }: { baza: CompetitionPortalBaza }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { owner, gata, eroare, reincearca } = useCompetitionOwner()
  const [fisier, setFisier] = useState<File | null>(null)
  const [previzualizare, setPrevizualizare] = useState<string | null>(null)
  const [scoate, setScoate] = useState(false)
  const [confirmaStergerea, setConfirmaStergerea] = useState(false)

  const existent = useQuery({
    queryKey: ['concurs-de-editat', id],
    queryFn: () => getConcurs(id as string),
    enabled: !!id,
  })

  const locatii = useQuery({
    queryKey: ['competition-locations', owner.role, owner.clubId, existent.data?.location_id],
    queryFn: () =>
      owner.role === 'CLUB'
        ? getClubSelectableLocations(owner.clubId as string, existent.data?.location_id ?? null)
        : getSelectableLocations(),
    enabled: gata && (owner.role !== 'CLUB' || !!owner.clubId),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompetitionFormValues>({
    resolver: zodResolver(competitionFormSchema),
    defaultValues: competitionFormDefaults,
  })

  useEffect(() => {
    if (existent.data) {
      reset({
        title: existent.data.title,
        description: existent.data.description,
        ...competitionScheduleToFields(existent.data),
        locationId: existent.data.location_id ?? '',
        locationText: existent.data.location_text ?? '',
        allowCash: existent.data.allow_cash,
      })
    }
  }, [existent.data, reset])

  const inlocuiestePrevizualizarea = (ales: File | null) => {
    setPrevizualizare((veche) => {
      if (veche) URL.revokeObjectURL(veche)
      return ales ? URL.createObjectURL(ales) : null
    })
  }

  const sterge = useMutation({
    mutationFn: () => stergeConcurs(id as string),
    onSuccess: () => {
      toast.success('Concursul a fost șters.')
      void qc.invalidateQueries({ queryKey: ['concursurile-mele'] })
      void qc.invalidateQueries({ queryKey: ['concursuri-publice'] })
      navigate(baza)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Nu am putut șterge concursul.'),
  })

  const alegePoza = (ales: File | null) => {
    if (ales && !esteImagine(ales)) {
      toast.error('Poza trebuie să fie o imagine.')
      return
    }
    setFisier(ales)
    setScoate(false)
    inlocuiestePrevizualizarea(ales)
  }

  const dinGalerie = async () => {
    try {
      const alese = await alegeDinGalerie(1)
      alegePoza(alese.find(esteImagine) ?? null)
    } catch {
      toast.error('Nu am putut deschide galeria.')
    }
  }

  const salveaza = handleSubmit(async (valori) => {
    try {
      let destination: string = baza
      const input = {
        title: valori.title,
        description: valori.description,
        ...competitionScheduleFromFields(valori),
        location_id: valori.locationId || null,
        location_text: valori.locationText,
        allow_cash: valori.allowCash,
      }
      if (id) {
        await updateConcurs(id, input)
        if (fisier) await schimbaPozaConcurs(id, fisier)
        else if (scoate) await scoatePozaConcurs(id)
      } else {
        const creat = await createConcurs(input, owner)
        destination = `${baza}/${creat.id}/edit`
        if (fisier) {
          try {
            await schimbaPozaConcurs(creat.id, fisier)
          } catch {
            toast.error('Concursul a fost salvat, dar poza nu a putut fi încărcată.')
            navigate(`${baza}/${creat.id}/edit`)
            return
          }
        }
      }
      toast.success('Concursul a fost salvat.')
      void qc.invalidateQueries({ queryKey: ['concursurile-mele'] })
      void qc.invalidateQueries({ queryKey: ['concursuri-publice'] })
      navigate(destination)
    } catch (eroareSalvare) {
      toast.error(mesajSalvare(eroareSalvare))
    }
  })

  if (eroare || existent.isError) {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca concursul.</p>
        <Button
          className="mt-4 h-11 min-h-11"
          type="button"
          onClick={() => (eroare ? reincearca() : void existent.refetch())}
        >
          Reîncearcă
        </Button>
      </div>
    )
  }

  if (!gata || (id && existent.isLoading)) {
    return <p className="text-muted-foreground text-sm">Se încarcă…</p>
  }

  if (id && existent.data === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Concursul nu a fost găsit.</p>
        <Link to={baza} className="text-primary mt-4 inline-flex h-11 items-center font-semibold">
          ← Înapoi la concursuri
        </Link>
      </div>
    )
  }

  const heroSalvat = existent.data?.hero_photo_storage_path ?? null
  const heroAfisat = previzualizare ?? (scoate ? null : urlHeroConcurs(heroSalvat))

  return (
    <>
      <form className="mx-auto max-w-2xl" onSubmit={(e) => void salveaza(e)}>
        <h1 className="font-display text-2xl font-bold">
          {id ? 'Editează concursul' : 'Concurs nou'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Detaliile apar pe pagina publică după salvare. Traseele și categoriile se adaugă apoi.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="titlu-concurs">Titlu</Label>
            <Input id="titlu-concurs" className="h-11 lg:h-9" {...register('title')} />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
          </div>

          <CompetitionScheduleSection
            register={register}
            errors={errors}
            locations={locatii.data ?? []}
            locationError={locatii.isError}
            base={baza}
          />

          <div className="space-y-2">
            <Label htmlFor="descriere-concurs">Descriere</Label>
            <textarea
              id="descriere-concurs"
              rows={6}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent p-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-destructive text-sm">{errors.description.message}</p>
            )}
          </div>

          <fieldset className="rounded-2xl border p-5">
            <legend className="px-2 font-semibold">Poza din capul paginii</legend>
            <p className="text-muted-foreground text-sm">Opțională. Se vede deasupra titlului.</p>
            {heroAfisat && (
              <img src={heroAfisat} alt="" className="mt-3 h-40 w-full rounded-xl object-cover" />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {galeriaSeDeschideNativ() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11"
                  onClick={() => void dinGalerie()}
                >
                  Alege din galerie
                </Button>
              ) : (
                <Label className="border-input inline-flex h-11 min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm font-medium">
                  Alege o poză
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => alegePoza(e.target.files?.[0] ?? null)}
                  />
                </Label>
              )}
              {(heroSalvat || fisier) && !scoate && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11"
                  onClick={() => {
                    setFisier(null)
                    setScoate(true)
                    inlocuiestePrevizualizarea(null)
                  }}
                >
                  Scoate poza
                </Button>
              )}
            </div>
          </fieldset>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="submit"
            className="h-11 min-h-11"
            disabled={isSubmitting || sterge.isPending}
          >
            Salvează
          </Button>
          <Button type="button" variant="outline" className="h-11 min-h-11" asChild>
            <Link to={baza}>Renunță</Link>
          </Button>
          {id &&
            (confirmaStergerea ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11 min-h-11"
                disabled={sterge.isPending}
                onClick={() => sterge.mutate()}
              >
                Confirmă ștergerea
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                onClick={() => setConfirmaStergerea(true)}
              >
                Șterge concursul
              </Button>
            ))}
        </div>
      </form>
      {id && (
        <div className="mx-auto mt-10 max-w-2xl space-y-8">
          <CompetitionOffersSection competitionId={id} />
          <CompetitionCoachesSection competitionId={id} />
          <CompetitionCashPaymentsSection competitionId={id} />
          <Button asChild variant="outline">
            <Link to={`${baza}/${id}/results`}>Completează podiumul după concurs</Link>
          </Button>
        </div>
      )}
    </>
  )
}
