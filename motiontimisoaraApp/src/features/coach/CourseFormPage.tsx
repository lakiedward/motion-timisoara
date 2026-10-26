import * as Dialog from '@radix-ui/react-dialog'
import { OfferCurrencyFields } from '@/components/OfferCurrencyFields'
import CourseProgramFields from '@/components/CourseProgramFields'
import {
  offerAmountSchema,
  offerCurrencyShape,
  validateOfferCurrency,
  offerCurrencyInput,
  offerCurrencyValues,
  parseScaledDecimal,
  eurFaraCurs,
} from '@/lib/pricing/offer-currency'
import {
  courseProgramSchema,
  emptyCourseProgram,
  parseRecurrenceRule,
  requireSerializedProgram,
  validateCourseProgramFields,
} from '@/lib/course-program/recurrence'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { incarcaRegulamentCurs, stergeRegulamentCurs } from '@/api/camp-rules-file'
import { renuntaLaOfertaFaraHero, schimbaPozaOferta } from '@/api/offer-hero'
import {
  createCourse,
  cursulAreInscrieri,
  getCourseById,
  getSelectableLocations,
  updateCourse,
} from '@/api/coach'
import { publicUrl } from '@/api/public'
import { HeroPhotoField } from '@/components/HeroPhotoField'
import { MESAJ_POZA_HERO, mesajHeroLipsa } from '@/lib/hero-photo'
import { fetchSports } from '@/api/sports'
import { OfferRulesFieldset } from '@/components/RulesFileField'
import { campRulesFileFromRow, type CampRulesFileMeta } from '@/lib/camp-rules'
import { baniToRon } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { FormSection, RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-2 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

const NOTA_SPORT = 'Sportul rămâne cel salvat: cursul are înscrieri.'
const NOTA_LOCATIE = 'Locația rămâne cea salvată: cursul are înscrieri.'
const NOTA_PRET = 'Prețul rămâne cel salvat: cursul are înscrieri.'

function cheieOptiuneSalvata(
  idSalvat: string | null | undefined,
  optiuni: { id: string }[],
  asteptare: string,
) {
  if (idSalvat && optiuni.some((optiune) => optiune.id === idSalvat)) return idSalvat
  return asteptare
}

const schema = z
  .object({
    ...offerCurrencyShape,
    name: z.string().min(3, 'Minim 3 caractere'),
    sport_id: z.string().min(1, 'Alege un sport'),
    location_id: z.string().min(1, 'Alege o locație'),
    level: z.string().optional(),
    age_from: z.string().optional(),
    age_to: z.string().optional(),
    capacity: z.string().trim().min(1, 'Capacitatea este obligatorie.'),
    price_per_session_lei: offerAmountSchema,
    description: z.string().trim().min(1, 'Descrierea este obligatorie.'),
    program: courseProgramSchema,
  })
  .superRefine((value, ctx) => {
    validateOfferCurrency(value, ctx)
    validateCourseProgramFields(value, ctx)
  })
type Values = z.infer<typeof schema>

const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

export default function CourseFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const { data: locations = [] } = useQuery({
    queryKey: ['sel-locations'],
    queryFn: getSelectableLocations,
  })
  const {
    data: existing,
    isPending: seIncarca,
    isError: aEsuatCitirea,
    refetch,
  } = useQuery({
    queryKey: ['course-edit', id],
    queryFn: () => getCourseById(id as string),
    enabled: isEdit,
  })
  const { data: areInscrieri = false } = useQuery({
    queryKey: ['course-has-enrollments', id],
    queryFn: () => cursulAreInscrieri(id as string),
    enabled: isEdit,
  })
  const campuriBlocate = isEdit && areInscrieri

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'RON',
      eur_ron_rate: '',
      capacity: '',
      description: '',
      program: emptyCourseProgram(),
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
  const [intrebarePlecare, setIntrebarePlecare] = useState(false)
  const currency = useWatch({ control, name: 'currency' })
  const cursEur = useWatch({ control, name: 'eur_ron_rate' })
  const faraCurs = eurFaraCurs(currency, cursEur)
  const areModificari = isEdit && (isDirty || pozaHero !== null)
  const cheieSport = cheieOptiuneSalvata(existing?.sport_id, sports, 'sport-in-asteptare')
  const cheieLocatie = cheieOptiuneSalvata(existing?.location_id, locations, 'locatie-in-asteptare')

  const camp = (nume: keyof Values, nota?: string) => ({
    'aria-invalid': !!errors[nume],
    'aria-describedby':
      [nota, fieldDescription(nume, undefined, errors[nume]?.message)].filter(Boolean).join(' ') ||
      undefined,
  })

  const pleaca = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!areModificari) return
    event.preventDefault()
    setIntrebarePlecare(true)
  }

  useEffect(() => {
    if (existing) {
      reset({
        ...offerCurrencyValues(existing),
        name: existing.name,
        sport_id: existing.sport_id,
        location_id: existing.location_id,
        level: existing.level ?? '',
        age_from: existing.age_from?.toString() ?? '',
        age_to: existing.age_to?.toString() ?? '',
        capacity: existing.capacity?.toString() ?? '',
        price_per_session_lei: String(baniToRon(existing.price_per_session)),
        description: existing.description ?? '',
        program: parseRecurrenceRule(existing.recurrence_rule),
      })
    }
  }, [existing, reset])

  const onSubmit = async (v: Values) => {
    const lipsa = mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)
    setEroareHero(lipsa)
    if (lipsa) return
    const payload = {
      ...offerCurrencyInput(v),
      name: v.name,
      sport_id: v.sport_id,
      location_id: v.location_id,
      level: v.level || null,
      age_from: num(v.age_from),
      age_to: num(v.age_to),
      capacity: Number(v.capacity),
      price_per_session: parseScaledDecimal(v.price_per_session_lei, 2)!,
      description: v.description,
      recurrence_rule: requireSerializedProgram(v.program),
    }
    try {
      if (isEdit) {
        await updateCourse(id as string, payload)
        if (pozaHero) await schimbaPozaOferta('courses', 'course-photos', id as string, pozaHero)
      } else {
        const creat = await createCourse(payload)
        try {
          await schimbaPozaOferta('courses', 'course-photos', creat.id, pozaHero as File)
        } catch {
          await renuntaLaOfertaFaraHero('courses', creat.id)
          toast.error('Fără poza din capul paginii cursul nu se salvează.')
          return
        }
        if (fisierLocal) {
          try {
            await incarcaRegulamentCurs(creat.id, fisierLocal)
          } catch {
            toast.error('Cursul a fost creat, dar fișierul regulamentului nu a putut fi urcat.')
            qc.invalidateQueries({ queryKey: ['my-courses'] })
            qc.invalidateQueries({ queryKey: ['coach-sessions'] })
            navigate('/coach/courses')
            return
          }
        }
      }
      qc.invalidateQueries({ queryKey: ['my-courses'] })
      qc.invalidateQueries({ queryKey: ['coach-sessions'] })
      toast.success(
        isEdit
          ? 'Curs actualizat. Ședințele viitoare urmează programul.'
          : 'Curs creat. Ședințele au fost generate din program.',
      )
      navigate('/coach/courses')
    } catch {
      toast.error('Nu am putut salva cursul.')
    }
  }

  if (isEdit && aEsuatCitirea) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCursuri />
        <StatusView
          state="error"
          title="Nu am putut încărca cursul."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
          className="mt-4"
        />
      </div>
    )
  }

  if (isEdit && !seIncarca && !existing) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCursuri />
        <StatusView
          state="empty"
          title="Cursul nu a fost găsit."
          text="Poate a fost șters sau linkul nu mai este valabil."
          className="mt-4"
        />
      </div>
    )
  }

  if (isEdit && seIncarca) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCursuri />
        <div role="status" aria-label="Se încarcă cursul" className="mt-4 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <InapoiLaCursuri onClick={pleaca} />
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează curs' : 'Curs nou'}
      </h1>

      <RequiredFieldsNote />

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setEroareHero(mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)),
        )}
        className="mt-6 space-y-6"
        noValidate
      >
        <FormSection title="Despre curs" description="Ce vede părintele pe pagina cursului.">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nume curs <RequiredMark />
            </Label>
            <Input id="name" required {...register('name')} {...camp('name')} />
            <FieldMessage id="name" error={errors.name?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="sport_id">
                Sport <RequiredMark />
              </Label>
              <select
                id="sport_id"
                key={cheieSport}
                className={selectCls}
                {...register('sport_id')}
                {...camp('sport_id', campuriBlocate ? 'sport-blocat' : undefined)}
                disabled={campuriBlocate}
              >
                <option value="">—</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
              <select
                id="location_id"
                key={cheieLocatie}
                className={selectCls}
                {...register('location_id')}
                {...camp('location_id', campuriBlocate ? 'locatie-blocata' : undefined)}
                disabled={campuriBlocate}
              >
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
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

        <FormSection title="Copii și locuri" description="Pentru cine e cursul și câți copii primești.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="level">Nivel</Label>
              <select id="level" className={selectCls} {...register('level')}>
                <option value="">—</option>
                <option value="incepator">Începător</option>
                <option value="intermediar">Intermediar</option>
                <option value="avansat">Avansat</option>
              </select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="capacity">
                Capacitate <RequiredMark />
              </Label>
              <Input
                id="capacity"
                type="number"
                required
                {...register('capacity')}
                {...camp('capacity')}
              />
              <FieldMessage id="capacity" error={errors.capacity?.message} />
            </div>
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

        <FormSection title="Preț" description="Cât plătește părintele pentru o ședință.">
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
            disabled={campuriBlocate}
          />
          <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor="price_per_session_lei">
              Preț / ședință ({currency === 'EUR' ? 'EUR' : 'lei'}) <RequiredMark />
            </Label>
            <Input
              id="price_per_session_lei"
              type="number"
              step="0.01"
              required
              {...register('price_per_session_lei')}
              {...camp('price_per_session_lei', campuriBlocate ? 'pret-blocat' : undefined)}
              disabled={campuriBlocate}
            />
            {campuriBlocate && (
              <p id="pret-blocat" className="text-muted-foreground text-sm">
                {NOTA_PRET}
              </p>
            )}
            <FieldMessage
              id="price_per_session_lei"
              error={errors.price_per_session_lei?.message}
            />
          </div>
        </FormSection>

        <CourseProgramFields
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
        />
        <HeroPhotoField
          hint={MESAJ_POZA_HERO}
          savedUrl={publicUrl('course-photos', existing?.hero_photo_storage_path)}
          error={eroareHero}
          onFile={(fisier) => {
            setPozaHero(fisier)
            setEroareHero(null)
          }}
        />
        <OfferRulesFieldset
          entityId={isEdit ? id : undefined}
          saved={fisierSalvat}
          localFile={fisierLocal}
          onLocalFile={setFisierLocal}
          onSaved={setFisierSuprascris}
          upload={incarcaRegulamentCurs}
          remove={stergeRegulamentCurs}
          intro="Fișierul apare pe pagina publică a cursului. Părinții îl pot deschide; nu trebuie să îl accepte la înscriere."
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || faraCurs}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/coach/courses" onClick={pleaca}>
              Anulează
            </Link>
          </Button>
        </div>
      </form>
      <Dialog.Root open={intrebarePlecare} onOpenChange={setIntrebarePlecare}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background text-foreground fixed top-1/2 right-4 left-4 z-50 mx-auto max-w-md -translate-y-1/2 rounded-lg border p-6 shadow-lg outline-none"
          >
            <Dialog.Title className="font-display text-lg font-semibold">
              Renunți la modificări?
            </Dialog.Title>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={() => setIntrebarePlecare(false)}>
                Rămân
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/coach/courses')}>
                Renunț
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

function InapoiLaCursuri({
  onClick,
}: {
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <Link
      to="/coach/courses"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> Înapoi
    </Link>
  )
}
