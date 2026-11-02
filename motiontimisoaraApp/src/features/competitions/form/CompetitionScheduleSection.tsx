import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelectMenu } from '@/components/ui/form-select-menu'
import { TimePicker } from '@/components/ui/time-picker'
import type { CompetitionFormValues } from './competition-form-schema'
import { Checkbox } from '@/components/ui/checkbox'

type LocationOption = { id: string; name: string; city: string | null }

const SCHEDULE_FIELDS = [
  { name: 'startDate', id: 'competition-start-date', label: 'Data de început', kind: 'date' },
  { name: 'startTime', id: 'competition-start-time', label: 'Ora de început', kind: 'time' },
  { name: 'endDate', id: 'competition-end-date', label: 'Data de final', kind: 'date' },
  { name: 'endTime', id: 'competition-end-time', label: 'Ora de final', kind: 'time' },
  {
    name: 'registrationDeadlineDate',
    id: 'competition-deadline-date',
    label: 'Ultima zi de înscriere',
    kind: 'date',
  },
  {
    name: 'registrationDeadlineTime',
    id: 'competition-deadline-time',
    label: 'Ora închiderii înscrierilor',
    kind: 'time',
  },
] as const

type Props = {
  register: UseFormRegister<CompetitionFormValues>
  control: Control<CompetitionFormValues>
  errors: FieldErrors<CompetitionFormValues>
  locations: LocationOption[]
  locationError: boolean
  base: string
}

export function CompetitionScheduleSection({
  register,
  control,
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
        {SCHEDULE_FIELDS.map(({ name, id, label, kind }) => {
          const Picker = kind === 'date' ? DatePicker : TimePicker
          const error = errors[name]?.message
          return (
            <div key={name} className="space-y-2">
              <Label htmlFor={id}>{label}</Label>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <Picker
                    id={id}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                )}
              />
              {error && (
                <p id={`${id}-error`} className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
          )
        })}
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
        <FormSelectMenu
          control={control}
          name="locationId"
          id="competition-location-map"
          searchable={locations.length > 8}
          emptyLabel="Fără pin pe hartă"
          options={locations.map((location) => ({
            value: location.id,
            label: location.city ? `${location.name} · ${location.city}` : location.name,
          }))}
        />
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
        <Checkbox {...register('allowCash')} />
        Acceptă plata cash pentru categoriile cu taxă
      </label>
    </fieldset>
  )
}
