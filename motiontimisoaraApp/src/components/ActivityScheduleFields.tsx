import { Controller, type Control, type FieldErrors, type FieldValues, type Path } from 'react-hook-form'

import { FormSection, RequiredMark } from '@/components/FormSection'
import { DatePicker } from '@/components/ui/date-picker'
import { FieldMessage } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'

type ScheduleName = 'activity_date' | 'start_time' | 'end_time'

const FIELDS: { name: ScheduleName; label: string; kind: 'date' | 'time' }[] = [
  { name: 'activity_date', label: 'Data', kind: 'date' },
  { name: 'start_time', label: 'Ora început', kind: 'time' },
  { name: 'end_time', label: 'Ora final', kind: 'time' },
]

export function ActivityScheduleFields<T extends FieldValues>({
  control,
  errors,
  describe,
}: {
  control: Control<T>
  errors: FieldErrors<T>
  describe: (
    name: ScheduleName,
    note?: string
  ) => { 'aria-invalid': boolean; 'aria-describedby': string | undefined }
}) {
  return (
    <FormSection title="Când are loc" description="Ziua și intervalul orar al activității.">
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map(({ name, label, kind }) => {
          const Picker = kind === 'date' ? DatePicker : TimePicker
          const error = errors[name]?.message
          return (
            <div key={name} className="min-w-0 space-y-1.5">
              <Label htmlFor={name}>
                {label} <RequiredMark />
              </Label>
              <Controller
                control={control}
                name={name as Path<T>}
                render={({ field }) => (
                  <Picker
                    id={name}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    {...describe(name, kind === 'time' ? 'ore-hint' : undefined)}
                  />
                )}
              />
              <FieldMessage id={name} error={typeof error === 'string' ? error : undefined} />
            </div>
          )
        })}
      </div>
      <p id="ore-hint" className="text-muted-foreground text-sm">
        Orele sunt în fusul României.
      </p>
    </FormSection>
  )
}
