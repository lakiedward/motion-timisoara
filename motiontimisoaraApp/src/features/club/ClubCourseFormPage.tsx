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
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createClubCourse, getClubCourseById, updateClubCourse } from '@/api/club'
import { incarcaRegulamentCurs, stergeRegulamentCurs } from '@/api/camp-rules-file'
import { renuntaLaOfertaFaraHero, schimbaPozaOferta } from '@/api/offer-hero'
import { publicUrl } from '@/api/public'
import { HeroPhotoField } from '@/components/HeroPhotoField'
import { mesajHeroLipsa } from '@/lib/hero-photo'
import { fetchSports } from '@/api/sports'
import { OfferRulesFieldset } from '@/components/RulesFileField'
import { campRulesFileFromRow, type CampRulesFileMeta } from '@/lib/camp-rules'
import { baniToRon } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormSection, RequiredMark } from '@/components/FormSection'
import { CourseOwnerField } from './course-form/CourseOwnerField'
import { useCourseFormOwner, type CourseFormPortal } from './course-form/useCourseFormOwner'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-2 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

const schema = z
  .object({
    ...offerCurrencyShape,
    name: z.string().min(3, 'Minim 3 caractere'),
    sport_id: z.string().min(1, 'Alege un sport'),
    location_id: z.string().min(1, 'Alege o locație'),
    coach_id: z.string().min(1, 'Alege un antrenor'),
    level: z.string().optional(),
    age_from: z.string().optional(),
    age_to: z.string().optional(),
    capacity: z.string().optional(),
    price_per_session_lei: offerAmountSchema,
    description: z.string().optional(),
    program: courseProgramSchema,
  })
  .superRefine((value, ctx) => {
    validateOfferCurrency(value, ctx)
    validateCourseProgramFields(value, ctx)
  })
type Values = z.infer<typeof schema>

const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

export default function ClubCourseFormPage({ portal = 'club' }: { portal?: CourseFormPortal }) {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: sports = [], isSuccess: sportsReady } = useQuery({
    queryKey: ['sports'],
    queryFn: fetchSports,
  })
  const { data: existing } = useQuery({
    queryKey: ['club-course-edit', id],
    queryFn: () => getClubCourseById(id as string),
    enabled: isEdit,
  })
  const {
    isAdmin,
    owner,
    setOwner,
    clubs,
    clubId,
    hasOwner,
    coaches,
    coachesReady,
    locations,
    locationsReady,
    listPath,
    listQueryKey,
  } = useCourseFormOwner(portal, existing, isEdit)
  const [eroareOrganizator, setEroareOrganizator] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'RON', eur_ron_rate: '', program: emptyCourseProgram() },
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
  useEffect(() => {
    if (existing && coachesReady && locationsReady) {
      reset({
        ...offerCurrencyValues(existing),
        name: existing.name,
        sport_id: existing.sport_id,
        location_id: existing.location_id,
        coach_id: existing.coach_id,
        level: existing.level ?? '',
        age_from: existing.age_from?.toString() ?? '',
        age_to: existing.age_to?.toString() ?? '',
        capacity: existing.capacity?.toString() ?? '',
        price_per_session_lei: String(baniToRon(existing.price_per_session)),
        description: existing.description ?? '',
        program: parseRecurrenceRule(existing.recurrence_rule),
      })
    }
  }, [existing, coachesReady, locationsReady, reset])

  const verificaOrganizator = () => {
    const lipsa = isAdmin && !hasOwner ? 'Alege organizatorul' : null
    setEroareOrganizator(lipsa)
    return !lipsa
  }

  const schimbaOrganizator = (urmator: string) => {
    setOwner(urmator)
    setEroareOrganizator(null)
    setValue('coach_id', '')
    setValue('location_id', '')
  }

  const onSubmit = async (v: Values) => {
    if (!verificaOrganizator()) return
    if (!hasOwner) {
      toast.error('Clubul nu a fost găsit.')
      return
    }
    const lipsa = mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)
    setEroareHero(lipsa)
    if (lipsa) return
    const payload = {
      ...offerCurrencyInput(v),
      name: v.name,
      sport_id: v.sport_id,
      location_id: v.location_id,
      coach_id: v.coach_id,
      level: v.level || null,
      age_from: num(v.age_from),
      age_to: num(v.age_to),
      capacity: num(v.capacity),
      price_per_session: parseScaledDecimal(v.price_per_session_lei, 2)!,
      description: v.description || null,
      recurrence_rule: requireSerializedProgram(v.program),
    }
    try {
      if (isEdit) {
        await updateClubCourse(id as string, payload)
        if (pozaHero) await schimbaPozaOferta('courses', 'course-photos', id as string, pozaHero)
      } else {
        const creat = await createClubCourse(clubId, payload)
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
            qc.invalidateQueries({ queryKey: [listQueryKey] })
            navigate(listPath)
            return
          }
        }
      }
      qc.invalidateQueries({ queryKey: [listQueryKey] })
      toast.success(
        isEdit
          ? 'Curs actualizat. Ședințele viitoare urmează programul.'
          : 'Curs creat. Ședințele au fost generate din program.',
      )
      navigate(listPath)
    } catch {
      toast.error('Nu am putut salva cursul.')
    }
  }

  const noCoaches = coachesReady && !coaches.length
  const noLocations = locationsReady && !locations.length
  const optiuniSeIncarca = !sportsReady || (hasOwner && (!coachesReady || !locationsReady))
  const camp = (nume: keyof Values) => ({
    'aria-invalid': !!errors[nume],
    'aria-describedby': fieldDescription(nume, undefined, errors[nume]?.message),
  })
  const optiuneGoala = (gata: boolean) => <option value="">{gata ? '—' : 'Se încarcă…'}</option>

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={listPath}
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează curs' : 'Curs nou'}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Câmpurile marcate cu <span className="text-destructive">*</span> sunt obligatorii.
      </p>

      {!isAdmin && (noCoaches || noLocations) && !isEdit && (
        <div className="bg-highlight/10 text-foreground/80 mt-4 rounded-xl border p-4 text-sm">
          {noCoaches && (
            <p>
              Nu ai antrenori în club.{' '}
              <Link to="/club/coaches" className="text-primary font-semibold">
                Adaugă un antrenor
              </Link>{' '}
              înainte de a crea un curs.
            </p>
          )}
          {noLocations && (
            <p>
              Nu ai locații.{' '}
              <Link to="/club/locations/new" className="text-primary font-semibold">
                Adaugă o locație
              </Link>{' '}
              înainte de a crea un curs.
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setEroareHero(mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)),
        )}
        onSubmitCapture={verificaOrganizator}
        className="mt-6 space-y-6"
        noValidate
      >
        <FormSection title="Despre curs" description="Cine îl ține, ce sport și unde.">
          {isAdmin && (
            <CourseOwnerField
              value={owner}
              clubs={clubs}
              locked={isEdit}
              error={eroareOrganizator}
              selectClassName={selectCls}
              onChange={schimbaOrganizator}
            />
          )}
          {isAdmin && hasOwner && (noCoaches || noLocations) && (
            <div className="bg-highlight/10 text-foreground/80 rounded-xl border p-4 text-sm">
              {noCoaches && <p>Organizatorul ales nu are antrenori.</p>}
              {noLocations && <p>Organizatorul ales nu are locații active.</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nume curs <RequiredMark />
            </Label>
            <Input id="name" required {...register('name')} {...camp('name')} />
            <FieldMessage id="name" error={errors.name?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="coach_id">
                Antrenor <RequiredMark />
              </Label>
              <select
                id="coach_id"
                className={selectCls}
                required
                {...register('coach_id')}
                {...camp('coach_id')}
              >
                {optiuneGoala(!hasOwner || coachesReady)}
                {coaches.map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldMessage id="coach_id" error={errors.coach_id?.message} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="sport_id">
                Sport <RequiredMark />
              </Label>
              <select
                id="sport_id"
                className={selectCls}
                required
                {...register('sport_id')}
                {...camp('sport_id')}
              >
                {optiuneGoala(sportsReady)}
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <FieldMessage id="sport_id" error={errors.sport_id?.message} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="location_id">
                Locație <RequiredMark />
              </Label>
              <select
                id="location_id"
                className={selectCls}
                required
                {...register('location_id')}
                {...camp('location_id')}
              >
                {optiuneGoala(!hasOwner || locationsReady)}
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <FieldMessage id="location_id" error={errors.location_id?.message} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="level">Nivel</Label>
              <select id="level" className={selectCls} {...register('level')}>
                <option value="">—</option>
                <option value="incepator">Începător</option>
                <option value="intermediar">Intermediar</option>
                <option value="avansat">Avansat</option>
              </select>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Preț și locuri"
          description="Cât plătește părintele pentru o ședință și câți copii primești."
        >
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="price_per_session_lei">
                Preț / ședință ({currency === 'EUR' ? 'EUR' : 'lei'}) <RequiredMark />
              </Label>
              <Input
                id="price_per_session_lei"
                type="number"
                step="0.01"
                required
                {...register('price_per_session_lei')}
                {...camp('price_per_session_lei')}
              />
              <FieldMessage
                id="price_per_session_lei"
                error={errors.price_per_session_lei?.message}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="capacity">Capacitate</Label>
              <Input id="capacity" type="number" {...register('capacity')} />
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

        <FormSection title="Descriere" description="Ce vede părintele pe pagina cursului.">
          <div className="space-y-1.5">
            <Label htmlFor="description">Descriere</Label>
            <Textarea id="description" rows={4} {...register('description')} />
          </div>
        </FormSection>

        <CourseProgramFields
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
        />
        <HeroPhotoField
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
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || faraCurs || optiuniSeIncarca}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={listPath}>Anulează</Link>
          </Button>
          {optiuniSeIncarca && (
            <p role="status" className="text-muted-foreground text-sm">
              Se încarcă opțiunile…
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
