import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createClubLocation, getClubLocationById, getMyClub, updateClubLocation } from '@/api/club'
import { LocationMapPicker, type MapPin, type ResolvedPlace } from '@/components/LocationMapPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

const PIN_REQUIRED_MESSAGE = 'Lipsește locul pe hartă. Caută o adresă sau pune pinul.'

const numOrNull = (s: string | undefined) =>
  s && s.trim() && !Number.isNaN(Number(s)) ? Number(s) : null

const schema = z
  .object({
    name: z.string().min(2, 'Minim 2 caractere'),
    type: z.string().min(1, 'Alege un tip'),
    address: z.string().optional(),
    city: z.string().optional(),
    lat: z.string().optional(),
    lng: z.string().optional(),
    description: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (numOrNull(v.lat) == null || numOrNull(v.lng) == null) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: PIN_REQUIRED_MESSAGE })
    }
  })
type Values = z.infer<typeof schema>

export default function ClubLocationFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const { data: existing } = useQuery({
    queryKey: ['club-location-edit', id],
    queryFn: () => getClubLocationById(id as string),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'POOL',
      name: '',
      address: '',
      city: '',
      lat: '',
      lng: '',
      description: '',
    },
  })
  const [placed, setPlaced] = useState<MapPin | null>(null)
  const loadedPin =
    existing?.lat != null && existing?.lng != null ? { lat: existing.lat, lng: existing.lng } : null
  const pin = placed ?? loadedPin

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

  const onPlace = (place: ResolvedPlace) => {
    setPlaced({ lat: place.lat, lng: place.lng })
    setValue('lat', place.lat.toFixed(6), { shouldValidate: true, shouldDirty: true })
    setValue('lng', place.lng.toFixed(6), { shouldValidate: true, shouldDirty: true })
    if (place.address) setValue('address', place.address, { shouldDirty: true })
    if (place.city) setValue('city', place.city, { shouldDirty: true })
  }

  const onSubmit = async (v: Values) => {
    if (!club) {
      toast.error('Clubul nu a fost găsit.')
      return
    }
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
      if (isEdit) await updateClubLocation(id as string, payload)
      else await createClubLocation(club.id, payload)
      qc.invalidateQueries({ queryKey: ['club-locations'] })
      toast.success(isEdit ? 'Locație actualizată.' : 'Locație creată.')
      navigate('/club/locations')
    } catch {
      toast.error('Nu am putut salva locația.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl min-w-0">
      <Link
        to="/club/locations"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează locație' : 'Locație nouă'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
        </div>

        <LocationMapPicker pin={pin} onPinChange={onPlace} error={errors.lat?.message} />

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
            <Link to="/club/locations">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
