import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createCourse, getCourseById, getSelectableLocations, updateCourse } from '@/api/coach'
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

export default function CourseFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const { data: locations = [] } = useQuery({ queryKey: ['sel-locations'], queryFn: getSelectableLocations })
  const { data: existing } = useQuery({
    queryKey: ['course-edit', id],
    queryFn: () => getCourseById(id as string),
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
        level: existing.level ?? '',
        age_from: existing.age_from?.toString() ?? '',
        age_to: existing.age_to?.toString() ?? '',
        capacity: existing.capacity?.toString() ?? '',
        price_per_session_lei: String(baniToRon(existing.price_per_session)),
        description: existing.description ?? '',
      })
    }
  }, [existing, reset])

  const onSubmit = async (v: Values) => {
    const payload = {
      name: v.name,
      sport_id: v.sport_id,
      location_id: v.location_id,
      level: v.level || null,
      age_from: num(v.age_from),
      age_to: num(v.age_to),
      capacity: num(v.capacity),
      price_per_session: ronToBani(Number(v.price_per_session_lei)),
      description: v.description || null,
    }
    try {
      if (isEdit) await updateCourse(id as string, payload)
      else await createCourse(payload)
      qc.invalidateQueries({ queryKey: ['my-courses'] })
      toast.success(isEdit ? 'Curs actualizat.' : 'Curs creat.')
      navigate('/coach/courses')
    } catch {
      toast.error('Nu am putut salva cursul.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/coach/courses" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">{isEdit ? 'Editează curs' : 'Curs nou'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume curs</Label>
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
            <Input id="price_per_session_lei" type="number" step="0.01" {...register('price_per_session_lei')} aria-invalid={!!errors.price_per_session_lei} />
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
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacitate</Label>
            <Input id="capacity" type="number" {...register('capacity')} />
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/coach/courses">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
