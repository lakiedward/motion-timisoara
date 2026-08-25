import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createClubLocation, getClubLocationById, getMyClub, updateClubLocation } from '@/api/club'
import LocationPicker from '@/components/LocationPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9'

const schema = z
  .object({
    name: z.string().min(2, 'Minim 2 caractere'),
    type: z.string().min(1, 'Alege un tip'),
    address: z.string().optional(),
    city: z.string().optional(),
    // Coordonatele nu se mai tastează: vin din pinul de pe hartă, prin căutare
    // sau prin apăsare, deci sunt numere sau lipsesc cu totul.
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    description: z.string().optional(),
  })
  .refine((v) => v.lat !== null && v.lng !== null, {
    message: 'Pune punctul pe hartă',
    path: ['lat'],
  })
type Values = z.infer<typeof schema>

export default function ClubLocationFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const { data: existing, isPending: seIncarca } = useQuery({
    queryKey: ['club-location-edit', clubId, id],
    queryFn: () => getClubLocationById(id as string, clubId),
    enabled: isEdit && !!clubId,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'POOL', lat: null, lng: null },
  })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        type: existing.type,
        address: existing.address ?? '',
        city: existing.city ?? '',
        lat: existing.lat,
        lng: existing.lng,
        description: existing.description ?? '',
      })
    }
  }, [existing, reset])

  // `useWatch`, nu `watch()`: al doilea întoarce o funcție pe care React
  // Compiler nu o poate memoiza, așa că sare peste tot componentul.
  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const punct = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null

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
      lat: v.lat,
      lng: v.lng,
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

  // Un id străin sau inexistent nu are voie să ajungă într-un formular
  // precompletat: politica RLS lasă un utilizator CLUB să CITEASCĂ orice
  // locație, dar îi refuză salvarea, așa că altfel clubul ar edita datele altui
  // club și ar primi un fals „am salvat”.
  if (isEdit && !!clubId && !seIncarca && !existing) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to="/club/locations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi
        </Link>
        <p className="text-muted-foreground mt-6">Locația nu a fost găsită.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
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
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume</Label>
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
            <Input id="city" className="h-11 lg:h-9" {...register('city')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Adresă</Label>
          <Input id="address" className="h-11 lg:h-9" {...register('address')} />
        </div>

        <LocationPicker
          value={punct}
          invalid={!!errors.lat}
          errorId={errors.lat ? 'punct-error' : undefined}
          onChange={(p) => {
            setValue('lat', p.lat)
            setValue('lng', p.lng)
            // Verificarea „lipsește punctul” stă pe obiect, cu mesajul pus pe
            // `lat`. Validarea la fiecare `setValue` ar rula-o cu `lng` încă gol
            // și ar lăsa eroarea aprinsă după ce pinul e deja pe hartă, așa că
            // se cere o singură dată, după ce ambele coordonate sunt puse.
            void trigger('lat')
            // Adresa și orașul urmează pinul. Ce a scris utilizatorul cu mâna
            // rămâne până la următoarea mutare de pin sau alegere din căutare;
            // când locul nou nu are adresă cunoscută, nu ștergem ce era.
            if (p.address) setValue('address', p.address)
            if (p.city) setValue('city', p.city)
          }}
        />
        {errors.lat && (
          <p id="punct-error" className="text-destructive text-xs">
            {errors.lat.message}
          </p>
        )}

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
          <Button type="submit" className="h-11 lg:h-9" disabled={isSubmitting}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" className="h-11 lg:h-9" asChild>
            <Link to="/club/locations">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
