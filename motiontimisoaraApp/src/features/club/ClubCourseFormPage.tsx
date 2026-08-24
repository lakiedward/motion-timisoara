import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import {
  createClubCourse,
  getClubCourseById,
  getClubSelectableLocations,
  getClubRosterForSelect,
  getMyClub,
  updateClubCourse,
} from '@/api/club'
import { fetchSports } from '@/api/sports'
import { baniToRon, ronToBani } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  sport_id: z.string().min(1, 'Alege un sport'),
  location_id: z.string().min(1, 'Alege o locație'),
  coach_id: z.string().min(1, 'Alege un antrenor'),
  level: z.string().optional(),
  age_from: z.string().optional(),
  age_to: z.string().optional(),
  capacity: z.string().optional(),
  price_per_session_lei: z
    .string()
    .refine((s) => s.trim() !== '' && !Number.isNaN(Number(s)) && Number(s) >= 0, 'Preț invalid'),
  description: z.string().optional(),
})
type Values = z.infer<typeof schema>

const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

export default function ClubCourseFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const { data: locations = [], isSuccess: locationsReady } = useQuery({
    queryKey: ['club-selectable-locations', clubId],
    queryFn: () => getClubSelectableLocations(clubId),
    enabled: !!clubId,
  })
  const { data: coaches = [], isSuccess: coachesReady } = useQuery({
    queryKey: ['club-roster-select', clubId],
    queryFn: () => getClubRosterForSelect(clubId),
    enabled: !!clubId,
  })
  const { data: existing } = useQuery({
    queryKey: ['club-course-edit', id],
    queryFn: () => getClubCourseById(id as string),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  // `reset` pune in select o valoare care are nevoie de `<option>`-ul ei. Cursul
  // si listele vin din cereri diferite: daca reseteaza primul, select-urile cad
  // pe „—” si nu se mai corecteaza, fiindca efectul nu se relua. Asteptam ca
  // ambele liste sa se aseze — pe `isSuccess`, nu pe lungime, ca sa mearga si
  // pentru un club fara antrenori sau fara locatii proprii.
  useEffect(() => {
    if (existing && coachesReady && locationsReady) {
      reset({
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
      })
    }
  }, [existing, coachesReady, locationsReady, reset])

  const onSubmit = async (v: Values) => {
    if (!club) {
      toast.error('Clubul nu a fost găsit.')
      return
    }
    const payload = {
      name: v.name,
      sport_id: v.sport_id,
      location_id: v.location_id,
      coach_id: v.coach_id,
      level: v.level || null,
      age_from: num(v.age_from),
      age_to: num(v.age_to),
      capacity: num(v.capacity),
      price_per_session: ronToBani(Number(v.price_per_session_lei)),
      description: v.description || null,
    }
    try {
      if (isEdit) await updateClubCourse(id as string, payload)
      else await createClubCourse(club.id, payload)
      qc.invalidateQueries({ queryKey: ['club-courses'] })
      toast.success(isEdit ? 'Curs actualizat.' : 'Curs creat.')
      navigate('/club/courses')
    } catch {
      toast.error('Nu am putut salva cursul.')
    }
  }

  const noCoaches = !coaches.length
  // „fara locatii” inseamna acum „nicio locatie UTILIZABILA”: de cand selectul
  // include si salile comune ale platformei, un club fara sali proprii poate
  // crea cursuri, deci nu mai are de ce sa fie oprit.
  const noLocations = !locations.length

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/club/courses" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">{isEdit ? 'Editează curs' : 'Curs nou'}</h1>

      {(noCoaches || noLocations) && !isEdit && (
        <div className="bg-highlight/10 text-foreground/80 mt-4 rounded-2xl border p-4 text-sm">
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

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume curs</Label>
          <Input
            id="name"
            className="h-11 lg:h-9"
            {...register('name')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
              <p id="name-error" className="text-destructive text-xs">
                {errors.name.message}
              </p>
            )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="coach_id">Antrenor</Label>
            <select
              id="coach_id"
              className={cn(selectCls)}
              {...register('coach_id')}
              aria-invalid={!!errors.coach_id}
              aria-describedby={errors.coach_id ? 'coach_id-error' : undefined}
            >
              <option value="">—</option>
              {coaches.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.coach_id && (
              <p id="coach_id-error" className="text-destructive text-xs">
                {errors.coach_id.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sport_id">Sport</Label>
            <select
              id="sport_id"
              className={cn(selectCls)}
              {...register('sport_id')}
              aria-invalid={!!errors.sport_id}
              aria-describedby={errors.sport_id ? 'sport_id-error' : undefined}
            >
              <option value="">—</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.sport_id && (
              <p id="sport_id-error" className="text-destructive text-xs">
                {errors.sport_id.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location_id">Locație</Label>
            <select
              id="location_id"
              className={cn(selectCls)}
              {...register('location_id')}
              aria-invalid={!!errors.location_id}
              aria-describedby={errors.location_id ? 'location_id-error' : undefined}
            >
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {errors.location_id && (
              <p id="location_id-error" className="text-destructive text-xs">
                {errors.location_id.message}
              </p>
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
            <Label htmlFor="price_per_session_lei">Preț / ședință (lei)</Label>
            <Input
              id="price_per_session_lei"
              type="number"
              step="0.01"
              className="h-11 lg:h-9"
              {...register('price_per_session_lei')}
              aria-invalid={!!errors.price_per_session_lei}
              aria-describedby={errors.price_per_session_lei ? 'price_per_session_lei-error' : undefined}
            />
            {errors.price_per_session_lei && (
              <p id="price_per_session_lei-error" className="text-destructive text-xs">
                {errors.price_per_session_lei.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input id="capacity" type="number" className="h-11 lg:h-9" {...register('capacity')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age_from">Vârstă minimă</Label>
            <Input id="age_from" type="number" className="h-11 lg:h-9" {...register('age_from')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age_to">Vârstă maximă</Label>
            <Input id="age_to" type="number" className="h-11 lg:h-9" {...register('age_to')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descriere</Label>
          <textarea
            id="description"
            rows={4}
            {...register('description')}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="h-11 lg:h-9" disabled={isSubmitting}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" className="h-11 lg:h-9" asChild>
            <Link to="/club/courses">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
