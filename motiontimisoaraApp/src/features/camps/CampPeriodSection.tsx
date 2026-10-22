import { FormSection } from '@/components/FormSection'
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { useWatch } from 'react-hook-form'

import { formatZi } from '@/api/camps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  register,
  control,
  setValue,
  errors,
}: {
  register: UseFormRegister<Values>
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
  const startReg = register('period_start')
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
          <Input
            type="date"
           
            aria-invalid={!!errors.period_start}
            {...startReg}
            onChange={(e) => {
              startReg.onChange(e)
              const urmatoarea = e.target.value
              if (campIsoDate(urmatoarea) && (!end || end < urmatoarea)) {
                setValue('period_end', urmatoarea, { shouldDirty: true, shouldValidate: true })
              }
            }}
          />
        </CampFormField>
        <CampFormField rand obligatoriu eticheta="Se termină" eroare={errors.period_end?.message}>
          <Input
            type="date"
            min={campIsoDate(start) ? start : undefined}
           
            aria-invalid={!!errors.period_end}
            {...register('period_end')}
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
