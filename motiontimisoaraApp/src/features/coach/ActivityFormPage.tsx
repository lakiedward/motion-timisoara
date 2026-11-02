import { OfferCurrencyFields } from '@/components/OfferCurrencyFields'
import {
  offerAmountSchema,
  offerCurrencyShape,
  validateOfferCurrency,
  offerCurrencyInput,
  offerCurrencyValues,
  parseScaledDecimal,
  eurFaraCurs,
} from '@/lib/pricing/offer-currency'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { incarcaRegulamentActivitate, stergeRegulamentActivitate } from '@/api/camp-rules-file'
import { renuntaLaOfertaFaraHero, schimbaPozaOferta } from '@/api/offer-hero'
import {
  activitateaAreInscrieri,
  createActivity,
  getActivityById,
  updateActivity,
} from '@/api/coach'
import { createAdminActivity, updateAdminActivity } from '@/api/activities/admin-activities'
import { HeroPhotoField } from '@/components/HeroPhotoField'
import GalleryPhotosSection from '@/features/photo-gallery/GalleryPhotosSection'
import { MESAJ_POZA_HERO, mesajHeroLipsa } from '@/lib/hero-photo'
import { publicUrl } from '@/api/public'
import { fetchSports } from '@/api/sports'
import { OfferRulesFieldset } from '@/components/RulesFileField'
import { campRulesFileFromRow, type CampRulesFileMeta } from '@/lib/camp-rules'
import { baniToRon } from '@/lib/money'
import { BackLink } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import { ActivityScheduleFields } from '@/components/ActivityScheduleFields'
import { FormSection, RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'
import { FormSelectMenu } from '@/components/ui/form-select-menu'
import { INDEPENDENT_OWNER } from '@/features/club/course-form/useCourseFormOwner'
import { ActivityOwnerFields } from './activity-form/ActivityOwnerFields'
import { LeaveFormDialog } from '@/components/leave-form/LeaveFormDialog'
import { useActivityFormOwner, type ActivityFormPortal } from './activity-form/useActivityFormOwner'

const NOTA_SPORT = 'Sportul rămâne cel salvat: activitatea are înscrieri.'
const NOTA_LOCATIE = 'Locația rămâne cea salvată: activitatea are înscrieri.'
const NOTA_PRET = 'Prețul rămâne cel salvat: activitatea are înscrieri.'

function minuteDinOra(ora: string) {
  const [ore, minute] = ora.split(':')
  if (ore === undefined || minute === undefined) return null
  const h = Number(ore)
  const m = Number(minute)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  return h * 60 + m
}

const schema = z
  .object({
    ...offerCurrencyShape,
    name: z.string().trim().min(3, 'Numele are cel puțin 3 caractere.'),
    coach_id: z.string().optional(),
    sport_id: z.string().min(1, 'Alege un sport'),
    location_id: z.string().min(1, 'Alege o locație'),
    activity_date: z.string().min(1, 'Alege data.'),
    start_time: z.string().min(1, 'Alege ora de început.'),
    end_time: z.string().min(1, 'Alege ora de final.'),
    price_lei: offerAmountSchema,
    capacity: z.string().optional(),
    age_from: z.string().optional(),
    age_to: z.string().optional(),
    description: z.string().trim().min(1, 'Descrierea este obligatorie.'),
  })
  .superRefine((value, ctx) => {
    validateOfferCurrency(value, ctx)
    const start = minuteDinOra(value.start_time)
    const end = minuteDinOra(value.end_time)
    if (start === null || end === null || end > start) return
    ctx.addIssue({
      code: 'custom',
      path: ['end_time'],
      message: 'Ora final trebuie să fie după ora de început.',
    })
  })
type Values = z.infer<typeof schema>

const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

export default function ActivityFormPage({ portal = 'coach' }: { portal?: ActivityFormPortal }) {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: sports = [], isPending: sporturiSeIncarca } = useQuery({
    queryKey: ['sports'],
    queryFn: fetchSports,
  })
  const {
    data: existing,
    isPending: seIncarca,
    isError: existingError,
    refetch: refetchExisting,
  } = useQuery({
    queryKey: ['activity-edit', id],
    queryFn: () => getActivityById(id as string),
    enabled: isEdit,
  })
  const { data: areInscrieri = false } = useQuery({
    queryKey: ['activity-has-enrollments', id],
    queryFn: () => activitateaAreInscrieri(id as string),
    enabled: isEdit,
  })
  const campuriBlocate = isEdit && areInscrieri
  const form = useActivityFormOwner(portal, existing, isEdit)
  const { isAdmin, locations, listPath, listQueryKey } = form
  const [eroareOrganizator, setEroareOrganizator] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'RON',
      eur_ron_rate: '',
      activity_date: '',
      start_time: '',
      end_time: '',
    },
  })
  const [fisierLocal, setFisierLocal] = useState<File | null>(null)
  const [pozaHero, setPozaHero] = useState<File | null>(null)
  const [eroareHero, setEroareHero] = useState<string | null>(null)
  const [fisierSuprascris, setFisierSuprascris] = useState<CampRulesFileMeta | null | undefined>(
    undefined,
  )
  const fisierSalvat =
    fisierSuprascris !== undefined
      ? fisierSuprascris
      : existing
        ? campRulesFileFromRow(existing)
        : null
  const currency = useWatch({ control, name: 'currency' })
  const cursEur = useWatch({ control, name: 'eur_ron_rate' })
  const faraCurs = eurFaraCurs(currency, cursEur)
  const [intrebarePlecare, setIntrebarePlecare] = useState(false)
  const areModificari = isEdit && (isDirty || pozaHero !== null)
  const pleaca = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!areModificari) return
    event.preventDefault()
    setIntrebarePlecare(true)
  }

  useEffect(() => {
    if (existing && form.coachesReady && form.locationsReady) {
      reset({
        ...offerCurrencyValues(existing),
        name: existing.name,
        sport_id: existing.sport_id,
        location_id: existing.location_id,
        activity_date: existing.activity_date,
        start_time: existing.start_time?.slice(0, 5),
        end_time: existing.end_time?.slice(0, 5),
        price_lei: String(baniToRon(existing.price)),
        capacity: existing.capacity?.toString() ?? '',
        age_from: existing.age_from?.toString() ?? '',
        age_to: existing.age_to?.toString() ?? '',
        description: existing.description ?? '',
        coach_id: existing.coach_id,
      })
    }
  }, [existing, form.coachesReady, form.locationsReady, reset])

  const verificaOrganizator = () => {
    const lipsa = isAdmin && !form.hasOwner ? 'Alege organizatorul' : null
    setEroareOrganizator(lipsa)
    return !lipsa
  }

  const schimbaOrganizator = (urmator: string) => {
    form.setOwner(urmator)
    setEroareOrganizator(null)
    setValue('coach_id', '')
    setValue('location_id', '')
  }

  const onSubmit = async (v: Values) => {
    if (!verificaOrganizator()) return
    if (isAdmin && !v.coach_id) {
      setError('coach_id', { message: 'Alege un antrenor' })
      return
    }
    const lipsa = mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)
    setEroareHero(lipsa)
    if (lipsa) return
    const payload = {
      ...offerCurrencyInput(v),
      name: v.name,
      description: v.description,
      sport_id: v.sport_id,
      location_id: v.location_id,
      activity_date: v.activity_date,
      start_time: v.start_time,
      end_time: v.end_time,
      price: parseScaledDecimal(v.price_lei, 2)!,
      capacity: v.capacity && v.capacity.trim() ? Number(v.capacity) : null,
      age_from: num(v.age_from),
      age_to: num(v.age_to),
    }
    try {
      if (isEdit) {
        if (isAdmin) await updateAdminActivity(id as string, v.coach_id as string, payload)
        else await updateActivity(id as string, payload)
        if (pozaHero)
          await schimbaPozaOferta('activities', 'activity-photos', id as string, pozaHero)
      } else {
        const creata = isAdmin
          ? await createAdminActivity(
              {
                clubId: form.owner === INDEPENDENT_OWNER ? null : form.owner,
                coachId: v.coach_id as string,
              },
              payload,
            )
          : await createActivity(payload)
        try {
          await schimbaPozaOferta('activities', 'activity-photos', creata.id, pozaHero as File)
        } catch {
          await renuntaLaOfertaFaraHero('activities', creata.id)
          toast.error('Fără poza din capul paginii activitatea nu se salvează.')
          return
        }
        if (fisierLocal) {
          try {
            await incarcaRegulamentActivitate(creata.id, fisierLocal)
          } catch {
            toast.error(
              'Activitatea a fost creată, dar fișierul regulamentului nu a putut fi urcat.',
            )
            qc.invalidateQueries({ queryKey: [listQueryKey] })
            navigate(listPath)
            return
          }
        }
      }
      qc.invalidateQueries({ queryKey: [listQueryKey] })
      toast.success(isEdit ? 'Activitate actualizată.' : 'Activitate creată.')
      navigate(listPath)
    } catch {
      toast.error('Nu am putut salva activitatea.')
    }
  }

  const camp = (nume: keyof Values, nota?: string) => ({
    'aria-invalid': !!errors[nume],
    'aria-describedby':
      [nota, fieldDescription(nume, undefined, errors[nume]?.message)].filter(Boolean).join(' ') ||
      undefined,
  })

  const noCoaches = form.coachesReady && !form.coaches.length
  const noLocations = form.locationsReady && !locations.length
  const backLink = (
    <BackLink to={listPath} onClick={pleaca}>
      Înapoi la activități
    </BackLink>
  )

  if (isEdit && !seIncarca && !existing) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div className="mt-6">
          {existingError ? (
            <StatusView
              state="error"
              title="Nu am putut încărca activitatea."
              onRetry={() => refetchExisting()}
            />
          ) : (
            <StatusView
              state="empty"
              title="Activitatea nu a fost găsită."
              text="Poate a fost ștearsă sau linkul nu mai este valabil."
            />
          )}
        </div>
      </div>
    )
  }

  if (isEdit && (seIncarca || sporturiSeIncarca || !form.coachesReady || !form.locationsReady)) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div role="status" aria-label="Se încarcă activitatea" className="mt-4 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează activitatea' : 'Activitate nouă'}
      </h1>
      <RequiredFieldsNote />

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setEroareHero(mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)),
        )}
        onSubmitCapture={verificaOrganizator}
        className="mt-6 space-y-6"
        noValidate
      >
        {isAdmin && (
          <FormSection
            title="Cine o organizează"
            description="Clubul sau antrenorul care ține activitatea."
          >
            <ActivityOwnerFields
              owner={form.owner}
              clubs={form.clubs}
              locked={isEdit}
              ownerError={eroareOrganizator}
              coaches={form.coaches}
              control={control}
              coachError={errors.coach_id?.message}
              noCoaches={noCoaches}
              noLocations={noLocations}
              onOwner={schimbaOrganizator}
            />
          </FormSection>
        )}
        <FormSection
          title="Despre activitate"
          description="Ce vede părintele pe pagina activității."
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nume <RequiredMark />
            </Label>
            <Input id="name" required {...register('name')} {...camp('name')} />
            <FieldMessage id="name" error={errors.name?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="sport_id">
                Sport <RequiredMark />
              </Label>
              <FormSelectMenu
                control={control}
                name="sport_id"
                id="sport_id"
                {...camp('sport_id', campuriBlocate ? 'sport-blocat' : undefined)}
                disabled={campuriBlocate}
                emptyLabel="—"
                options={sports.map((s) => ({ value: s.id, label: s.name }))}
              />
              {campuriBlocate && (
                <p id="sport-blocat" className="text-muted-foreground text-sm">
                  {NOTA_SPORT}
                </p>
              )}
              <FieldMessage id="sport_id" error={errors.sport_id?.message} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="location_id">
                Locație <RequiredMark />
              </Label>
              <FormSelectMenu
                control={control}
                name="location_id"
                id="location_id"
                {...camp('location_id', campuriBlocate ? 'locatie-blocata' : undefined)}
                disabled={campuriBlocate}
                searchable={locations.length > 8}
                emptyLabel="—"
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
              />
              {campuriBlocate && (
                <p id="locatie-blocata" className="text-muted-foreground text-sm">
                  {NOTA_LOCATIE}
                </p>
              )}
              <FieldMessage id="location_id" error={errors.location_id?.message} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">
              Descriere <RequiredMark />
            </Label>
            <Textarea
              id="description"
              rows={4}
              required
              {...register('description')}
              {...camp('description')}
            />
            <FieldMessage id="description" error={errors.description?.message} />
          </div>
        </FormSection>
        <ActivityScheduleFields control={control} errors={errors} describe={camp} />
        <FormSection
          title="Copii și locuri"
          description="Pentru cine e activitatea și câți copii primești."
        >
          <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input
              id="capacity"
              type="number"
              aria-describedby="capacitate-hint"
              {...register('capacity')}
            />
            <p id="capacitate-hint" className="text-muted-foreground text-sm">
              Lasă gol dacă nu ai limită.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="age_from">Vârstă minimă</Label>
              <Input
                id="age_from"
                type="number"
                aria-describedby="varste-hint"
                {...register('age_from')}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="age_to">Vârstă maximă</Label>
              <Input
                id="age_to"
                type="number"
                aria-describedby="varste-hint"
                {...register('age_to')}
              />
            </div>
            <p id="varste-hint" className="text-muted-foreground text-sm sm:col-span-2">
              Lasă gol dacă nu ai limită. Poți completa doar una.
            </p>
          </div>
        </FormSection>
        <FormSection title="Preț" description="Cât plătește părintele pentru activitate.">
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
            disabled={campuriBlocate}
          />
          <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor="price_lei">
              Preț ({currency === 'EUR' ? 'EUR' : 'lei'}) <RequiredMark />
            </Label>
            <Input
              id="price_lei"
              type="number"
              step="0.01"
              required
              {...register('price_lei')}
              {...camp('price_lei', campuriBlocate ? 'pret-blocat' : undefined)}
              disabled={campuriBlocate}
            />
            {campuriBlocate && (
              <p id="pret-blocat" className="text-muted-foreground text-sm">
                {NOTA_PRET}
              </p>
            )}
            <FieldMessage id="price_lei" error={errors.price_lei?.message} />
          </div>
        </FormSection>
        <HeroPhotoField
          hint={MESAJ_POZA_HERO}
          savedUrl={publicUrl('activity-photos', existing?.hero_photo_storage_path)}
          error={eroareHero}
          onFile={(fisier) => {
            setPozaHero(fisier)
            setEroareHero(null)
          }}
        />
        <GalleryPhotosSection
          fel="activitate"
          id={isEdit ? (id as string) : null}
          invalidate={[['activitate-detaliu', id]]}
        />
        <OfferRulesFieldset
          entityId={isEdit ? id : undefined}
          saved={fisierSalvat}
          localFile={fisierLocal}
          onLocalFile={setFisierLocal}
          onSaved={setFisierSuprascris}
          upload={incarcaRegulamentActivitate}
          remove={stergeRegulamentActivitate}
          intro="Fișierul apare pe pagina publică a activității. Părinții îl pot deschide; nu trebuie să îl accepte la înscriere."
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || faraCurs}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={listPath} onClick={pleaca}>
              Anulează
            </Link>
          </Button>
        </div>
      </form>
      <LeaveFormDialog
        open={intrebarePlecare}
        onOpenChange={setIntrebarePlecare}
        onLeave={() => navigate(listPath)}
      />
    </div>
  )
}
