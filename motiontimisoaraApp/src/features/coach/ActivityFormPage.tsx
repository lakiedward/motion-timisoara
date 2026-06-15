import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createActivity, getActivityById, getSelectableLocations, updateActivity } from '@/api/coach'
import { fetchSports } from '@/api/sports'
import { baniToRon, ronToBani } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  sport_id: z.string().min(1, 'Alege un sport'),
  location_id: z.string().min(1, 'Alege o locație'),
  activity_date: z.string().min(1, 'Obligatoriu'),
  start_time: z.string().min(1, 'Obligatoriu'),
  end_time: z.string().min(1, 'Obligatoriu'),
  price_lei: z.string().refine((s) => s.trim() !== '' && !Number.isNaN(Number(s)) && Number(s) >= 0, 'Preț invalid'),
  capacity: z.string().optional(),
  description: z.string().optional(),
})
type Values = z.infer<typeof schema>

export default function ActivityFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const { data: locations = [] } = useQuery({ queryKey: ['sel-locations'], queryFn: getSelectableLocations })
  const { data: existing } = useQuery({
    queryKey: ['activity-edit', id],
    queryFn: () => getActivityById(id as string),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        sport_id: existing.sport_id,
        location_id: existing.location_id,
        activity_date: existing.activity_date,
        start_time: existing.start_time?.slice(0, 5),
        end_time: existing.end_time?.slice(0, 5),
        price_lei: String(baniToRon(existing.price)),
        capacity: existing.capacity?.toString() ?? '',
        description: existing.description ?? '',
      })
    }
  }, [existing, reset])

  const onSubmit = async (v: Values) => {
    const payload = {
      name: v.name,
      description: v.description || null,
      sport_id: v.sport_id,
      location_id: v.location_id,
      activity_date: v.activity_date,
      start_time: v.start_time,
      end_time: v.end_time,
      price: ronToBani(Number(v.price_lei)),
      capacity: v.capacity && v.capacity.trim() ? Number(v.capacity) : null,
    }
    try {
      if (isEdit) await updateActivity(id as string, payload)
      else await createActivity(payload)
      qc.invalidateQueries({ queryKey: ['my-activities'] })
      toast.success(isEdit ? 'Activitate actualizată.' : 'Activitate creată.')
      navigate('/coach/activities')
    } catch {
      toast.error('Nu am putut salva activitatea.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/coach/activities" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">{isEdit ? 'Editează activitate' : 'Activitate nouă'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume</Label>
          <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            {errors.sport_id && <p className="text-destructive text-xs">{errors.sport_id.message}</p>}
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
            {errors.location_id && <p className="text-destructive text-xs">{errors.location_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity_date">Data</Label>
            <Input id="activity_date" type="date" {...register('activity_date')} aria-invalid={!!errors.activity_date} />
            {errors.activity_date && <p className="text-destructive text-xs">{errors.activity_date.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price_lei">Preț (lei)</Label>
            <Input id="price_lei" type="number" step="0.01" {...register('price_lei')} aria-invalid={!!errors.price_lei} />
            {errors.price_lei && <p className="text-destructive text-xs">{errors.price_lei.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Ora început</Label>
            <Input id="start_time" type="time" {...register('start_time')} aria-invalid={!!errors.start_time} />
            {errors.start_time && <p className="text-destructive text-xs">{errors.start_time.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Ora final</Label>
            <Input id="end_time" type="time" {...register('end_time')} aria-invalid={!!errors.end_time} />
            {errors.end_time && <p className="text-destructive text-xs">{errors.end_time.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input id="capacity" type="number" {...register('capacity')} />
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
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting}>
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
