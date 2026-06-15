import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createLocation, getLocationById, updateLocation } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  type: z.string().min(1, 'Alege un tip'),
  address: z.string().optional(),
  city: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  description: z.string().optional(),
})
type Values = z.infer<typeof schema>

const numOrNull = (s: string | undefined) =>
  s && s.trim() && !Number.isNaN(Number(s)) ? Number(s) : null

export default function LocationFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: existing } = useQuery({
    queryKey: ['location-edit', id],
    queryFn: () => getLocationById(id as string),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { type: 'POOL' } })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        type: existing.type,
        address: existing.address ?? '',
        city: existing.city ?? '',
        lat: existing.lat?.toString() ?? '',
        lng: existing.lng?.toString() ?? '',
        description: existing.description ?? '',
      })
    }
  }, [existing, reset])

  const onSubmit = async (v: Values) => {
    const payload = {
      name: v.name,
      type: v.type,
      address: v.address || null,
      city: v.city || null,
      lat: numOrNull(v.lat),
      lng: numOrNull(v.lng),
      description: v.description || null,
    }
    try {
      if (isEdit) await updateLocation(id as string, payload)
      else await createLocation(payload)
      qc.invalidateQueries({ queryKey: ['my-locations'] })
      toast.success(isEdit ? 'Locație actualizată.' : 'Locație creată.')
      navigate('/coach/locations')
    } catch {
      toast.error('Nu am putut salva locația.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/coach/locations" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">{isEdit ? 'Editează locație' : 'Locație nouă'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nume</Label>
            <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Tip</Label>
            <select id="type" className={cn(selectCls)} {...register('type')}>
              <option value="POOL">Bazin</option>
              <option value="TRACK">Pistă</option>
              <option value="GYM">Sală</option>
              <option value="OTHER">Alt tip</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Oraș</Label>
            <Input id="city" {...register('city')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresă</Label>
            <Input id="address" {...register('address')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lat">Latitudine</Label>
            <Input id="lat" type="number" step="any" {...register('lat')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lng">Longitudine</Label>
            <Input id="lng" type="number" step="any" {...register('lng')} />
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
            <Link to="/coach/locations">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
