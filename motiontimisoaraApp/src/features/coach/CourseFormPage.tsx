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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

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
  const { data: existing } = useQuery({
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

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/coach/courses"
        onClick={pleaca}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează curs' : 'Curs nou'}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setEroareHero(mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)),
        )}
        className="mt-6 space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume curs</Label>
          <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
            disabled={campuriBlocate}
          />
          <div className="space-y-1.5">
            <Label htmlFor="sport_id">Sport</Label>
            <select
              id="sport_id"
              key={cheieSport}
              className={cn(selectCls)}
              aria-describedby={campuriBlocate ? 'sport-blocat' : undefined}
              {...register('sport_id')}
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
            {errors.sport_id && (
              <p className="text-destructive text-xs">{errors.sport_id.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location_id">Locație</Label>
            <select
              id="location_id"
              key={cheieLocatie}
              className={cn(selectCls)}
              aria-describedby={campuriBlocate ? 'locatie-blocata' : undefined}
              {...register('location_id')}
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
            {errors.location_id && (
              <p className="text-destructive text-xs">{errors.location_id.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level">Nivel</Label>
            <select id="level" className={cn(selectCls)} {...register('level')}>
              <option value="">—</option>
              <option value="incepator">Începător</option>
              <option value="intermediar">Intermediar</option>
              <option value="avansat">Avansat</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price_per_session_lei">
              Preț / ședință ({currency === 'EUR' ? 'EUR' : 'lei'})
            </Label>
            <Input
              id="price_per_session_lei"
              type="number"
              step="0.01"
              aria-describedby={campuriBlocate ? 'pret-blocat' : undefined}
              {...register('price_per_session_lei')}
              disabled={campuriBlocate}
              aria-invalid={!!errors.price_per_session_lei}
            />
            {campuriBlocate && (
              <p id="pret-blocat" className="text-muted-foreground text-sm">
                {NOTA_PRET}
              </p>
            )}
            {errors.price_per_session_lei && (
              <p className="text-destructive text-xs">{errors.price_per_session_lei.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age_from">Vârstă minimă</Label>
            <Input id="age_from" type="number" {...register('age_from')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age_to">Vârstă maximă</Label>
            <Input id="age_to" type="number" {...register('age_to')} />
          </div>
          <p className="text-muted-foreground text-sm sm:col-span-2">
            Lasă gol dacă nu ai limită. Poți completa doar una.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input
              id="capacity"
              type="number"
              {...register('capacity')}
              aria-invalid={!!errors.capacity}
            />
            {errors.capacity && (
              <p className="text-destructive text-xs">{errors.capacity.message}</p>
            )}
          </div>
        </div>
        <CourseProgramFields
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
        />
        <div className="space-y-1.5">
          <Label htmlFor="description">Descriere</Label>
          <textarea
            id="description"
            rows={4}
            {...register('description')}
            aria-invalid={!!errors.description}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
          {errors.description && (
            <p className="text-destructive text-xs">{errors.description.message}</p>
          )}
        </div>
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
        <div className="flex gap-2 pt-2">
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
