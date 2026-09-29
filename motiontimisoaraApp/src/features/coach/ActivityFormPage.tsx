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
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { incarcaRegulamentActivitate, stergeRegulamentActivitate } from '@/api/camp-rules-file'
import { renuntaLaOfertaFaraHero, schimbaPozaOferta } from '@/api/offer-hero'
import {
  createActivity,
  getActivityById,
  getSelectableLocations,
  updateActivity,
} from '@/api/coach'
import { HeroPhotoField } from '@/components/HeroPhotoField'
import { MESAJ_POZA_HERO, mesajHeroLipsa } from '@/lib/hero-photo'
import { publicUrl } from '@/api/public'
import { fetchSports } from '@/api/sports'
import { OfferRulesFieldset } from '@/components/RulesFileField'
import { campRulesFileFromRow, type CampRulesFileMeta } from '@/lib/camp-rules'
import { baniToRon } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

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
    name: z.string().min(3, 'Minim 3 caractere'),
    sport_id: z.string().min(1, 'Alege un sport'),
    location_id: z.string().min(1, 'Alege o locație'),
    activity_date: z.string().min(1, 'Obligatoriu'),
    start_time: z.string().min(1, 'Obligatoriu'),
    end_time: z.string().min(1, 'Obligatoriu'),
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

export default function ActivityFormPage() {
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
    queryKey: ['activity-edit', id],
    queryFn: () => getActivityById(id as string),
    enabled: isEdit,
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'RON', eur_ron_rate: '' },
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
    if (existing) {
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
        await updateActivity(id as string, payload)
        if (pozaHero)
          await schimbaPozaOferta('activities', 'activity-photos', id as string, pozaHero)
      } else {
        const creata = await createActivity(payload)
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
            qc.invalidateQueries({ queryKey: ['my-activities'] })
            navigate('/coach/activities')
            return
          }
        }
      }
      qc.invalidateQueries({ queryKey: ['my-activities'] })
      toast.success(isEdit ? 'Activitate actualizată.' : 'Activitate creată.')
      navigate('/coach/activities')
    } catch {
      toast.error('Nu am putut salva activitatea.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/coach/activities"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează activitate' : 'Activitate nouă'}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setEroareHero(mesajHeroLipsa(pozaHero, existing?.hero_photo_storage_path ?? null)),
        )}
        className="mt-6 space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume</Label>
          <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
          />
          <div className="space-y-1.5">
            <Label htmlFor="sport_id">Sport</Label>
            <select id="sport_id" className={cn(selectCls)} {...register('sport_id')}>
              <option value="">—</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.sport_id && (
              <p className="text-destructive text-xs">{errors.sport_id.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location_id">Locație</Label>
            <select id="location_id" className={cn(selectCls)} {...register('location_id')}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {errors.location_id && (
              <p className="text-destructive text-xs">{errors.location_id.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity_date">Data</Label>
            <Input
              id="activity_date"
              type="date"
              {...register('activity_date')}
              aria-invalid={!!errors.activity_date}
            />
            {errors.activity_date && (
              <p className="text-destructive text-xs">{errors.activity_date.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price_lei">Preț ({currency === 'EUR' ? 'EUR' : 'lei'})</Label>
            <Input
              id="price_lei"
              type="number"
              step="0.01"
              {...register('price_lei')}
              aria-invalid={!!errors.price_lei}
            />
            {errors.price_lei && (
              <p className="text-destructive text-xs">{errors.price_lei.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Ora început</Label>
            <Input
              id="start_time"
              type="time"
              {...register('start_time')}
              aria-invalid={!!errors.start_time}
            />
            {errors.start_time && (
              <p className="text-destructive text-xs">{errors.start_time.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Ora final</Label>
            <Input
              id="end_time"
              type="time"
              {...register('end_time')}
              aria-invalid={!!errors.end_time}
            />
            {errors.end_time && (
              <p className="text-destructive text-xs">{errors.end_time.message}</p>
            )}
          </div>
          <p className="text-muted-foreground text-sm sm:col-span-2">
            Orele sunt în fusul României.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input id="capacity" type="number" {...register('capacity')} />
            <p className="text-muted-foreground text-sm">Lasă gol dacă nu ai limită.</p>
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descriere</Label>
          <textarea
            id="description"
            rows={3}
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
          savedUrl={publicUrl('activity-photos', existing?.hero_photo_storage_path)}
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
          upload={incarcaRegulamentActivitate}
          remove={stergeRegulamentActivitate}
          intro="Fișierul apare pe pagina publică a activității. Părinții îl pot deschide; nu trebuie să îl accepte la înscriere."
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || faraCurs}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/coach/activities">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
