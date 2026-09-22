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
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  createClubActivity,
  getClubActivities,
  getClubActivityById,
  getClubRosterForSelect,
  getClubSelectableLocations,
  getMyClub,
  setClubActivityActive,
  updateClubActivity,
} from '@/api/club'
import { incarcaRegulamentActivitate, stergeRegulamentActivitate } from '@/api/camp-rules-file'
import { fetchSports } from '@/api/sports'
import { OfferRulesFieldset } from '@/components/RulesFileField'
import { campRulesFileFromRow, type CampRulesFileMeta } from '@/lib/camp-rules'
import { baniToRon, formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9'

const schema = z
  .object({
    ...offerCurrencyShape,
    name: z.string().min(3, 'Minim 3 caractere'),
    sport_id: z.string().min(1, 'Alege un sport'),
    location_id: z.string().min(1, 'Alege o locație'),
    coach_id: z.string().min(1, 'Alege un antrenor'),
    activity_date: z.string().min(1, 'Obligatoriu'),
    start_time: z.string().min(1, 'Obligatoriu'),
    end_time: z.string().min(1, 'Obligatoriu'),
    price_lei: offerAmountSchema,
    capacity: z.string().optional(),
    description: z.string().optional(),
  })
  .superRefine(validateOfferCurrency)
type Values = z.infer<typeof schema>

function dataActivitate(zi: string) {
  const [an, luna, ziua] = zi.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, ziua ?? 1).toLocaleDateString('ro-RO')
}

function Lista() {
  const qc = useQueryClient()
  const {
    data: club,
    isLoading: clubLoading,
    isError: clubError,
    refetch: refetchClub,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    isError: activitiesError,
    refetch,
  } = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => getClubActivities(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const isLoading = clubLoading || (!!clubId && activitiesLoading)
  const isError = clubError || activitiesError
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setClubActivityActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-activities', clubId] }),
    onError: (e: unknown) =>
      toast.error(
        (e as { code?: string })?.code === '42501'
          ? 'Nu poți modifica această activitate: antrenorul ei nu face parte din club.'
          : 'Nu am putut actualiza activitatea.',
      ),
  })

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Activitățile clubului</h1>
        <Button asChild>
          <Link to="/club/activities/new">
            <Plus /> Activitate nouă
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca activitățile.</p>
          <Button
            className="mt-4 h-11 min-h-11"
            type="button"
            onClick={() => {
              if (clubError) void refetchClub()
              if (clubId) void refetch()
            }}
          >
            Reîncearcă
          </Button>
        </div>
      ) : activities.length ? (
        <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{activity.name}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {dataActivitate(activity.activity_date)}
                    {activity.location?.name ? ` · ${activity.location.name}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activity.sport && <Badge>{activity.sport.name}</Badge>}
                    <Badge variant={activity.active ? 'success' : 'outline'}>
                      {activity.active ? 'Activă' : 'Inactivă'}
                    </Badge>
                  </div>
                </div>
                <span className="font-display font-bold">
                  {formatMoney(activity.price, activity.currency)}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{activity.coach?.name ?? '—'}</p>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/club/activities/${activity.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: activity.id, active: !activity.active })}
                >
                  {activity.active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Nicio activitate încă.{' '}
          <Link to="/club/activities/new" className="text-primary font-semibold">
            Creează prima activitate
          </Link>
        </div>
      )}
    </div>
  )
}

function Formular() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const { data: coaches = [], isSuccess: coachesReady } = useQuery({
    queryKey: ['club-roster-select', clubId],
    queryFn: () => getClubRosterForSelect(clubId),
    enabled: !!clubId,
  })
  const {
    data: existing,
    isLoading: existingLoading,
    isFetched: existingFetched,
  } = useQuery({
    queryKey: ['club-activity', id],
    queryFn: () => getClubActivityById(id as string),
    enabled: isEdit,
  })
  const { data: locations = [], isSuccess: locationsReady } = useQuery({
    queryKey: ['club-selectable-locations', clubId, existing?.location_id ?? null],
    queryFn: () => getClubSelectableLocations(clubId, existing?.location_id ?? null),
    enabled: !!clubId && (!isEdit || !!existing),
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
        activity_date: existing.activity_date,
        start_time: existing.start_time?.slice(0, 5),
        end_time: existing.end_time?.slice(0, 5),
        price_lei: String(baniToRon(existing.price)),
        capacity: existing.capacity?.toString() ?? '',
        description: existing.description ?? '',
      })
    }
  }, [existing, coachesReady, locationsReady, reset])

  const onSubmit = async (v: Values) => {
    if (!club) {
      toast.error('Clubul nu a fost găsit.')
      return
    }
    const payload = {
      ...offerCurrencyInput(v),
      name: v.name,
      description: v.description || null,
      sport_id: v.sport_id,
      location_id: v.location_id,
      coach_id: v.coach_id,
      activity_date: v.activity_date,
      start_time: v.start_time,
      end_time: v.end_time,
      price: parseScaledDecimal(v.price_lei, 2)!,
      capacity: v.capacity && v.capacity.trim() ? Number(v.capacity) : null,
    }
    try {
      if (isEdit) await updateClubActivity(id as string, payload)
      else {
        const creata = await createClubActivity(club.id, payload)
        if (fisierLocal) {
          try {
            await incarcaRegulamentActivitate(creata.id, fisierLocal)
          } catch {
            toast.error(
              'Activitatea a fost creată, dar fișierul regulamentului nu a putut fi urcat.',
            )
            qc.invalidateQueries({ queryKey: ['club-activities'] })
            navigate('/club/activities')
            return
          }
        }
      }
      qc.invalidateQueries({ queryKey: ['club-activities'] })
      toast.success(isEdit ? 'Activitate actualizată.' : 'Activitate creată.')
      navigate('/club/activities')
    } catch {
      toast.error('Nu am putut salva activitatea.')
    }
  }

  if (isEdit && existingLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    )
  }

  if (isEdit && existingFetched && (!existing || (club && existing.club_id !== club.id))) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to="/club/activities"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi
        </Link>
        <p className="text-muted-foreground mt-6">Activitatea nu aparține clubului.</p>
      </div>
    )
  }

  const noCoaches = coachesReady && !coaches.length
  const noLocations = locationsReady && !locations.length

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/club/activities"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează activitate' : 'Activitate nouă'}
      </h1>
      {(noCoaches || noLocations) && !isEdit && (
        <div className="bg-highlight/10 text-foreground/80 mt-4 rounded-2xl border p-4 text-sm">
          {noCoaches && (
            <p>
              Nu ai antrenori în club.{' '}
              <Link to="/club/coaches" className="text-primary font-semibold">
                Adaugă un antrenor
              </Link>{' '}
              înainte de a crea o activitate.
            </p>
          )}
          {noLocations && (
            <p>
              Nu ai locații.{' '}
              <Link to="/club/locations/new" className="text-primary font-semibold">
                Adaugă o locație
              </Link>{' '}
              înainte de a crea o activitate.
            </p>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume</Label>
          <Input
            id="name"
            className="h-11 lg:h-9"
            {...register('name')}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <OfferCurrencyFields
            currency={currency}
            currencyField={register('currency')}
            setValue={setValue}
          />
          <div className="space-y-1.5">
            <Label htmlFor="coach_id">Antrenor</Label>
            <select
              id="coach_id"
              className={cn(selectCls)}
              {...register('coach_id')}
              aria-invalid={!!errors.coach_id}
            >
              <option value="">—</option>
              {coaches.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.coach_id && (
              <p className="text-destructive text-xs">{errors.coach_id.message}</p>
            )}
          </div>
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
              className="h-11 lg:h-9"
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
              className="h-11 lg:h-9"
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
              className="h-11 lg:h-9"
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
              className="h-11 lg:h-9"
              {...register('end_time')}
              aria-invalid={!!errors.end_time}
            />
            {errors.end_time && (
              <p className="text-destructive text-xs">{errors.end_time.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input id="capacity" type="number" className="h-11 lg:h-9" {...register('capacity')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descriere</Label>
          <textarea
            id="description"
            rows={3}
            {...register('description')}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </div>
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
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" className="h-11 lg:h-9" disabled={isSubmitting || faraCurs}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" className="h-11 lg:h-9" asChild>
            <Link to="/club/activities">Anulează</Link>
          </Button>
          {isEdit && (
            <Link
              to={`/activitati/${id}`}
              className="text-primary inline-flex h-11 items-center font-semibold lg:h-9"
            >
              Vezi pagina publică
            </Link>
          )}
        </div>
      </form>
    </div>
  )
}

export default function ClubActivitiesPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/new') || pathname.endsWith('/edit')) return <Formular />
  return <Lista />
}
