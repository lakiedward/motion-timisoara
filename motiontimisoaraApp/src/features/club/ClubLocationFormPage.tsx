import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { locationWriteErrorMessage } from '@/lib/geography/shared-location-guard'
import { toast } from 'sonner'

import { createClubLocation, updateClubLocation } from '@/api/club'
import { createLocation, updateLocation } from '@/api/coach'
import { createAdminLocation } from '@/api/locations/admin-locations'
import LocationPicker from '@/components/LocationPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'
import LocationTypeOptions from '@/components/location-form/LocationTypeOptions'
import { cityForCounty, countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import NearbyLocations from './location-form/NearbyLocations'
import LocationAddressFields, {
  locationSelectClassName,
} from './location-form/LocationAddressFields'
import {
  isOwnLocation,
  locationPointKey,
  NEARBY_OWNER_COPY,
  type LocationChoice,
  type NearbyLocation,
} from './location-form/nearby-locations'
import { useNearbyLocations } from './location-form/useNearbyLocations'
import { LocationOwnerField } from './location-form/LocationOwnerField'
import {
  parseOwner,
  useLocationFormOwner,
  type LocationFormPortal,
} from './location-form/useLocationFormOwner'

const schema = z
  .object({
    name: z.string().min(2, 'Minim 2 caractere'),
    type: z.string().min(1, 'Alege un tip'),
    address: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    description: z.string().optional(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })
  .refine((v) => v.lat !== null && v.lng !== null, {
    message: 'Pune punctul pe hartă',
    path: ['lat'],
  })
type Values = z.infer<typeof schema>

export default function ClubLocationFormPage({ portal = 'club' }: { portal?: LocationFormPortal }) {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(null)
  const [pickerVersion, setPickerVersion] = useState(0)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const activePickerVersion = useRef(0)
  const [ownerError, setOwnerError] = useState<string | null>(null)
  const form = useLocationFormOwner(portal, id)
  const { club, isAdmin, isCoach, owner, listPath } = form
  const ownerScope = form.nearbyScope
  const {
    data: existing,
    isPending: seIncarca,
    isError: aEsuatCitirea,
    refetch,
  } = form.existingQuery

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
        description: existing.description ?? '',
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
  const nearbyQuery = useNearbyLocations(punct, ownerScope, !isEdit)
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
    if (isOwnLocation(location, ownerScope)) return
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
    const target = parseOwner(owner)
    if (isAdmin && !isEdit && !target) {
      setOwnerError('Alege organizatorul')
      return
    }
    if (!isAdmin && !isCoach && !club) {
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
      description: v.description || null,
      lat: v.lat,
      lng: v.lng,
    }
    try {
      if (isEdit && isCoach) await updateLocation(id as string, payload)
      else if (isEdit) await updateClubLocation(id as string, payload)
      else if (isCoach) await createLocation(payload)
      else if (isAdmin && target) await createAdminLocation(target, payload)
      else if (club) await createClubLocation(club.id, payload)
      qc.invalidateQueries({ queryKey: [form.listQueryKey] })
      qc.invalidateQueries({ queryKey: ['club-nearby-locations'] })
      toast.success(isEdit ? 'Locație actualizată.' : 'Locație creată.')
      navigate(listPath)
    } catch (e) {
      toast.error(locationWriteErrorMessage(e, 'Nu am putut salva locația.'))
    }
  }
  const backLink = (
    <Link
      to={listPath}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> Înapoi
    </Link>
  )

  if (isEdit && form.readyToRead && aEsuatCitirea) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <StatusView
          state="error"
          title="Nu am putut încărca locația."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
          className="mt-4"
        />
      </div>
    )
  }

  if (isEdit && form.readyToRead && !seIncarca && !existing) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <StatusView
          state="empty"
          title="Locația nu a fost găsită."
          text="Poate a fost ștearsă sau linkul nu mai este valabil."
          className="mt-4"
        />
      </div>
    )
  }

  if (isEdit && !existing) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div role="status" aria-label="Se încarcă locația" className="mt-4 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează locație' : 'Locație nouă'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Despre locație</CardTitle>
            <CardDescription>
              Numele și tipul apar la cursuri, activități și pe hartă.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <LocationOwnerField
                value={owner}
                clubs={form.clubs}
                coaches={form.coaches}
                locked={isEdit}
                lockedName={existing?.club?.name ?? existing?.creator?.name ?? '—'}
                error={ownerError}
                selectClassName={locationSelectClassName}
                onChange={(next) => {
                  form.setOwner(next)
                  setOwnerError(null)
                }}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nume</Label>
                <Input
                  id="name"
                  className="h-11 scroll-mt-24 lg:h-9"
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
                <Label htmlFor="type">Tip</Label>
                <select id="type" className={locationSelectClassName} {...register('type')}>
                  <LocationTypeOptions />
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descriere</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Intrarea, parcarea sau alte repere pentru părinți"
                {...register('description')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Unde se află</CardTitle>
            <CardDescription>
              Punctul de pe hartă arată unde vin copiii la antrenament.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              onAddressChange={(nextAddress) =>
                setValue('address', nextAddress, { shouldDirty: true })
              }
              invalid={!!errors.lat}
              errorId={errors.lat ? 'punct-error' : undefined}
              error={errors.lat?.message}
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
            {!isEdit && punct && (
              <NearbyLocations
                locations={nearbyLocations}
                ownerId={ownerScope}
                copy={NEARBY_OWNER_COPY[portal]}
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
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            type="submit"
            className="h-11 lg:h-9"
            disabled={isSubmitting || nearbyCheckRequired || isResolvingAddress}
          >
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" className="h-11 lg:h-9" asChild>
            <Link to={listPath}>Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
