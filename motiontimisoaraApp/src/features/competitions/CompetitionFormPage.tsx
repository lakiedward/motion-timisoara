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
import { schimbaPozaConcurs } from '@/api/competition/competition-hero'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'
import { HeroPhotoField } from '@/components/HeroPhotoField'
import { mesajHeroLipsa } from '@/lib/hero-photo'
import {
  competitionScheduleFromFields,
  competitionScheduleToFields,
} from '@/lib/competition-schedule'
import { FormSection, RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import { BackLink } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'
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
  const [eroareHero, setEroareHero] = useState<string | null>(null)
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
    control,
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

  const sterge = useMutation({
    mutationFn: () => stergeConcurs(id as string),
    onSuccess: () => {
      toast.success('Concursul a fost șters.')
      void qc.invalidateQueries({ queryKey: ['concursurile-mele'] })
      void qc.invalidateQueries({ queryKey: ['concursuri-publice'] })
      navigate(baza)
    },
    onError: (error) => {
      setConfirmaStergerea(false)
      toast.error(error instanceof Error ? error.message : 'Nu am putut șterge concursul.')
    },
  })

  const salveaza = handleSubmit(
    async (valori) => {
      const lipsa = mesajHeroLipsa(fisier, existent.data?.hero_photo_storage_path ?? null)
      setEroareHero(lipsa)
      if (lipsa) return
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
        } else {
          const creat = await createConcurs(input, owner)
          destination = `${baza}/${creat.id}/edit`
          try {
            await schimbaPozaConcurs(creat.id, fisier as File)
          } catch {
            await stergeConcurs(creat.id)
            toast.error('Fără poza din capul paginii concursul nu se salvează.')
            return
          }
        }
        toast.success('Concursul a fost salvat.')
        void qc.invalidateQueries({ queryKey: ['concursurile-mele'] })
        void qc.invalidateQueries({ queryKey: ['concursuri-publice'] })
        navigate(destination)
      } catch (eroareSalvare) {
        toast.error(mesajSalvare(eroareSalvare))
      }
    },
    () => {
      setEroareHero(mesajHeroLipsa(fisier, existent.data?.hero_photo_storage_path ?? null))
    },
  )

  const backLink = <BackLink to={baza}>Înapoi la concursuri</BackLink>

  if (eroare || existent.isError || (id && existent.data === null)) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div className="mt-6">
          {eroare || existent.isError ? (
            <StatusView
              state="error"
              title="Nu am putut încărca concursul."
              onRetry={() => (eroare ? reincearca() : void existent.refetch())}
            />
          ) : (
            <StatusView
              state="empty"
              title="Concursul nu a fost găsit."
              text="Poate a fost șters sau linkul nu mai este valabil."
            />
          )}
        </div>
      </div>
    )
  }

  if (!gata || (id && existent.isLoading)) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div role="status" aria-label="Se încarcă concursul" className="mt-4 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  const heroSalvat = existent.data?.hero_photo_storage_path ?? null

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <h1 className="font-display mt-4 text-2xl font-bold">
        {id ? 'Editează concursul' : 'Concurs nou'}
      </h1>
      <RequiredFieldsNote />
      {!id && (
        <p className="text-muted-foreground mt-1 text-sm">
          Traseele, categoriile și antrenorii se adaugă după prima salvare.
        </p>
      )}

      <form className="mt-6 space-y-6" onSubmit={(e) => void salveaza(e)} noValidate>
        <FormSection
          title="Despre concurs"
          description="Ce văd participanții și părinții pe pagina concursului."
        >
          <div className="space-y-1.5">
            <Label htmlFor="titlu-concurs">
              Titlu <RequiredMark />
            </Label>
            <Input
              id="titlu-concurs"
              required
              aria-invalid={!!errors.title}
              aria-describedby={fieldDescription('titlu-concurs', undefined, errors.title?.message)}
              {...register('title')}
            />
            <FieldMessage id="titlu-concurs" error={errors.title?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descriere-concurs">
              Descriere <RequiredMark />
            </Label>
            <Textarea
              id="descriere-concurs"
              rows={6}
              required
              aria-invalid={!!errors.description}
              aria-describedby={fieldDescription(
                'descriere-concurs',
                undefined,
                errors.description?.message,
              )}
              {...register('description')}
            />
            <FieldMessage id="descriere-concurs" error={errors.description?.message} />
          </div>
        </FormSection>

        <CompetitionScheduleSection
          register={register}
          control={control}
          errors={errors}
          locations={locatii.data ?? []}
          locationError={locatii.isError}
          base={baza}
        />

        <HeroPhotoField
          savedUrl={urlHeroConcurs(heroSalvat)}
          error={eroareHero}
          onFile={(ales) => {
            setFisier(ales)
            setEroareHero(null)
          }}
        />

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || sterge.isPending}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={baza}>Anulează</Link>
          </Button>
          {id && (
            <Button type="button" variant="outline" onClick={() => setConfirmaStergerea(true)}>
              Șterge concursul
            </Button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={confirmaStergerea}
        onOpenChange={setConfirmaStergerea}
        title="Ștergi concursul?"
        description="Concursul dispare din liste și de pe pagina publică. Acțiunea nu poate fi anulată."
        confirmLabel="Șterge concursul"
        destructive
        pending={sterge.isPending}
        onConfirm={() => sterge.mutate()}
      />
      {id && (
        <div className="mt-10 space-y-6">
          <CompetitionOffersSection competitionId={id} />
          <CompetitionCoachesSection competitionId={id} />
          <CompetitionCashPaymentsSection competitionId={id} />
          <Button asChild variant="outline">
            <Link to={`${baza}/${id}/results`}>Completează podiumul după concurs</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
