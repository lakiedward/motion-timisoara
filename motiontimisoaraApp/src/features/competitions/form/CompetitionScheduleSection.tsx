import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CompetitionFormValues } from './competition-form-schema'

type LocationOption = { id: string; name: string; city: string | null }

type Props = {
  register: UseFormRegister<CompetitionFormValues>
  errors: FieldErrors<CompetitionFormValues>
  locations: LocationOption[]
  locationError: boolean
  base: string
}

export function CompetitionScheduleSection({
  register,
  errors,
  locations,
  locationError,
  base,
}: Props) {
  const locationLink = base.startsWith('/club') ? '/club/locations/new' : '/coach/locations/new'

  return (
    <fieldset className="space-y-5 rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Program și înscrieri</legend>
      <p className="text-muted-foreground text-sm">
        Orele sunt pentru București. Înscrierile se închid cel târziu la începutul concursului.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="competition-start-date">Data de început</Label>
          <Input
            id="competition-start-date"
            type="date"
            className="h-11 lg:h-9"
            {...register('startDate')}
          />
          {errors.startDate && (
            <p className="text-destructive text-sm">{errors.startDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="competition-start-time">Ora de început</Label>
          <Input
            id="competition-start-time"
            type="time"
            className="h-11 lg:h-9"
            {...register('startTime')}
          />
          {errors.startTime && (
            <p className="text-destructive text-sm">{errors.startTime.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="competition-end-date">Data de final</Label>
          <Input
            id="competition-end-date"
            type="date"
            className="h-11 lg:h-9"
            {...register('endDate')}
          />
          {errors.endDate && <p className="text-destructive text-sm">{errors.endDate.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="competition-end-time">Ora de final</Label>
          <Input
            id="competition-end-time"
            type="time"
            className="h-11 lg:h-9"
            {...register('endTime')}
          />
          {errors.endTime && <p className="text-destructive text-sm">{errors.endTime.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="competition-deadline-date">Ultima zi de înscriere</Label>
          <Input
            id="competition-deadline-date"
            type="date"
            className="h-11 lg:h-9"
            {...register('registrationDeadlineDate')}
          />
          {errors.registrationDeadlineDate && (
            <p className="text-destructive text-sm">{errors.registrationDeadlineDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="competition-deadline-time">Ora închiderii înscrierilor</Label>
          <Input
            id="competition-deadline-time"
            type="time"
            className="h-11 lg:h-9"
            {...register('registrationDeadlineTime')}
          />
          {errors.registrationDeadlineTime && (
            <p className="text-destructive text-sm">{errors.registrationDeadlineTime.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="competition-location-text">Locația concursului</Label>
        <Input
          id="competition-location-text"
          className="h-11 lg:h-9"
          {...register('locationText')}
        />
        {errors.locationText && (
          <p className="text-destructive text-sm">{errors.locationText.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="competition-location-map">Locație pe hartă (opțional)</Label>
        <select
          id="competition-location-map"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9"
          {...register('locationId')}
        >
          <option value="">Fără pin pe hartă</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
              {location.city ? ` · ${location.city}` : ''}
            </option>
          ))}
        </select>
        {locationError && (
          <p className="text-destructive text-sm">Nu am putut încărca locațiile de pe hartă.</p>
        )}
        <Link
          to={locationLink}
          className="text-primary inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        >
          Adaugă o locație cu pin pe hartă
        </Link>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" {...register('allowCash')} className="size-4" />
        Acceptă plata cash pentru categoriile cu taxă
      </label>
    </fieldset>
  )
}
