import { useEffect, useRef, useState } from 'react'
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
import LocationTypeOptions from '@/components/location-form/LocationTypeOptions'
import { cityForCounty, countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import NearbyLocations from './location-form/NearbyLocations'
import LocationAddressFields, {
  locationSelectClassName,
} from './location-form/LocationAddressFields'
import {
  locationPointKey,
  type LocationChoice,
  type NearbyLocation,
} from './location-form/nearby-locations'
import { useNearbyLocations } from './location-form/useNearbyLocations'

const schema = z
  .object({
    name: z.string().min(2, 'Minim 2 caractere'),
    type: z.string().min(1, 'Alege un tip'),
    address: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
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
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(null)
  const [pickerVersion, setPickerVersion] = useState(0)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const activePickerVersion = useRef(0)
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: existing,
    isPending: seIncarca,
    isError: aEsuatCitirea,
    refetch,
  } = useQuery({
    queryKey: ['club-location-edit', clubId, id],
    queryFn: () => getClubLocationById(id as string, clubId),
    enabled: isEdit && !!clubId,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
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
        county:
          normalizeCounty(existing.county) ?? existing.county ?? countyForCity(existing.city) ?? '',
        lat: existing.lat,
        lng: existing.lng,
      })
    }
  }, [existing, reset])
  const lat = useWatch({ control, name: 'lat' })
  const lng = useWatch({ control, name: 'lng' })
  const address = useWatch({ control, name: 'address' }) ?? ''
  const county = useWatch({ control, name: 'county' }) ?? ''
  const city = useWatch({ control, name: 'city' }) ?? ''
  const punct = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  const nearbyQuery = useNearbyLocations(punct, clubId, !isEdit)
  const nearbyLocations = nearbyQuery.data ?? []
  const currentChoice =
    punct && locationChoice?.pointKey === locationPointKey(punct) ? locationChoice : null
  const nearbyCheckRequired =
    !isEdit &&
    punct !== null &&
    (nearbyQuery.isPending ||
      nearbyQuery.isFetching ||
      nearbyQuery.isError ||
      (nearbyLocations.length > 0 && currentChoice === null))

  const chooseNearbyLocation = (location: NearbyLocation) => {
    if (location.club_id === clubId) return
    setLocationChoice({ pointKey: locationPointKey(location), sourceId: location.id })
    activePickerVersion.current += 1
    setPickerVersion(activePickerVersion.current)
    setValue('name', location.name, { shouldDirty: true })
    setValue('type', location.type, { shouldDirty: true })
    setValue('address', location.address ?? '', { shouldDirty: true })
    setValue('city', location.city ?? '', { shouldDirty: true })
    setValue(
      'county',
      normalizeCounty(location.county) ?? location.county ?? countyForCity(location.city) ?? '',
      { shouldDirty: true },
    )
    setValue('lat', location.lat, { shouldDirty: true })
    setValue('lng', location.lng, { shouldDirty: true })
    void trigger()
  }

  const onSubmit = async (v: Values) => {
    if (!club) {
      toast.error('Clubul nu a fost găsit.')
      return
    }
    if (nearbyCheckRequired) {
      toast.error('Verifică locațiile din apropiere și alege locul înainte de salvare.')
      return
    }
    const payload = {
      name: v.name,
      type: v.type,
      address: v.address || null,
      city: v.city || null,
      county: v.county || null,
      lat: v.lat,
      lng: v.lng,
    }
    try {
      if (isEdit) await updateClubLocation(id as string, payload)
      else await createClubLocation(club.id, payload)
      qc.invalidateQueries({ queryKey: ['club-locations'] })
      qc.invalidateQueries({ queryKey: ['club-nearby-locations'] })
      toast.success(isEdit ? 'Locație actualizată.' : 'Locație creată.')
      navigate('/club/locations')
    } catch {
      toast.error('Nu am putut salva locația.')
    }
  }
  if (isEdit && !!clubId && aEsuatCitirea) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to="/club/locations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi
        </Link>
        <div role="alert" className="mt-6 rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca locația.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      </div>
    )
  }
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

        <div className="space-y-1.5">
          <div className="space-y-1.5">
            <Label htmlFor="type">Tip</Label>
            <select id="type" className={locationSelectClassName} {...register('type')}>
              <LocationTypeOptions />
            </select>
          </div>
        </div>

        <LocationAddressFields
          county={county}
          city={city}
          onCountyChange={(nextCounty) => {
            activePickerVersion.current += 1
            setPickerVersion(activePickerVersion.current)
            setValue('county', nextCounty, { shouldDirty: true })
            setValue('city', '', { shouldDirty: true })
          }}
          onCityChange={(nextCity) => {
            activePickerVersion.current += 1
            setPickerVersion(activePickerVersion.current)
            setValue('city', nextCity, { shouldDirty: true })
          }}
        />

        <LocationPicker
          key={pickerVersion}
          value={punct}
          address={address}
          onResolvingChange={setIsResolvingAddress}
          onAddressChange={(nextAddress) => setValue('address', nextAddress, { shouldDirty: true })}
          invalid={!!errors.lat}
          errorId={errors.lat ? 'punct-error' : undefined}
          onChange={(p) => {
            if (activePickerVersion.current !== pickerVersion) return
            if (getValues('lat') !== p.lat || getValues('lng') !== p.lng) {
              setLocationChoice(null)
              if (!p.resolved) {
                setValue('address', '')
                setValue('county', '')
                setValue('city', '')
              }
            }
            setValue('lat', p.lat)
            setValue('lng', p.lng)
            void trigger('lat')
            if (p.resolved) {
              const nextCounty =
                normalizeCounty(p.county) ?? p.county ?? countyForCity(p.city) ?? ''
              setValue('county', nextCounty, { shouldDirty: true })
              setValue('city', p.city ? cityForCounty(p.city, nextCounty) : '', {
                shouldDirty: true,
              })
              setValue('address', p.address ?? '', { shouldDirty: true })
            }
          }}
        />
        {errors.lat && (
          <p id="punct-error" className="text-destructive text-xs">
            {errors.lat.message}
          </p>
        )}
        {!isEdit && punct && (
          <NearbyLocations
            locations={nearbyLocations}
            clubId={clubId}
            isPending={nearbyQuery.isPending || nearbyQuery.isFetching}
            isError={nearbyQuery.isError}
            isFetching={nearbyQuery.isFetching}
            choice={currentChoice}
            onRetry={() => void nearbyQuery.refetch()}
            onChoose={chooseNearbyLocation}
            onCreateNew={() =>
              setLocationChoice({ pointKey: locationPointKey(punct), sourceId: null })
            }
          />
        )}

        <div className="flex gap-2 pt-2">
          <Button
            type="submit"
            className="h-11 lg:h-9"
            disabled={isSubmitting || nearbyCheckRequired || isResolvingAddress}
          >
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
