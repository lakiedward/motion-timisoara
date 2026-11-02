import { FormSection } from '@/components/FormSection'
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form'
import { Controller, useWatch } from 'react-hook-form'

import { formatZi } from '@/api/camps'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  addCampInclusiveDays,
  campIsoDate,
  campPeriodDurationLabel,
} from '@/lib/camp-period'
import { plural } from '@/lib/plural'
import CampFormField, { CampFormRand } from './CampFormField'
import type { Values } from './camp-form-schema'

const DURATE = [7, 8, 14] as const

export default function CampPeriodSection({
  control,
  setValue,
  errors,
}: {
  control: Control<Values>
  setValue: UseFormSetValue<Values>
  errors: FieldErrors<Values>
}) {
  const start = useWatch({ control, name: 'period_start' }) ?? ''
  const end = useWatch({ control, name: 'period_end' }) ?? ''
  const durata = campPeriodDurationLabel(start, end)
  const rezumat =
    durata && campIsoDate(start) && campIsoDate(end)
      ? `${formatZi(start)} – ${formatZi(end)} · ${durata}`
      : null
  const poateAlegeDurata = campIsoDate(start)

  return (
    <FormSection
      title="Perioada taberei"
      description="Alegi prima și ultima zi. Durata apare imediat, iar sfârșitul nu poate fi înaintea începutului."
    >
      {rezumat && (
        <p className="mt-3 text-sm font-medium" aria-live="polite">
          {rezumat}
        </p>
      )}
      <CampFormRand columns="two" className="mt-3 flex-none">
        <CampFormField rand obligatoriu eticheta="Începe" eroare={errors.period_start?.message}>
          <PeriodDate
            control={control}
            name="period_start"
            invalid={!!errors.period_start}
            onPicked={(urmatoarea) => {
              if (campIsoDate(urmatoarea) && (!end || end < urmatoarea)) {
                setValue('period_end', urmatoarea, { shouldDirty: true, shouldValidate: true })
              }
            }}
          />
        </CampFormField>
        <CampFormField rand obligatoriu eticheta="Se termină" eroare={errors.period_end?.message}>
          <PeriodDate
            control={control}
            name="period_end"
            invalid={!!errors.period_end}
            min={campIsoDate(start) ? start : undefined}
          />
        </CampFormField>
      </CampFormRand>
      <div className="mt-3 flex flex-wrap gap-2">
        {DURATE.map((zile) => (
          <Button
            key={zile}
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            disabled={!poateAlegeDurata}
            onClick={() =>
              setValue('period_end', addCampInclusiveDays(start, zile), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            {plural(zile, 'zi', 'zile')}
          </Button>
        ))}
      </div>
    </FormSection>
  )
}

function PeriodDate({
  id,
  control,
  name,
  invalid,
  min,
  onPicked,
}: {
  id?: string
  control: Control<Values>
  name: 'period_start' | 'period_end'
  invalid: boolean
  min?: string
  onPicked?: (value: string) => void
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DatePicker
          id={id}
          ref={field.ref}
          name={field.name}
          value={field.value}
          onBlur={field.onBlur}
          min={min}
          aria-invalid={invalid}
          onValueChange={(value) => {
            field.onChange(value)
            onPicked?.(value)
          }}
        />
      )}
    />
  )
}
