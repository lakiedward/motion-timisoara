import { useState } from 'react'
import { Clock } from 'lucide-react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ScheduleFields } from './announcement-schedule'

type Props = {
  idPrefix: string
  register: UseFormRegister<ScheduleFields>
  errors: FieldErrors<ScheduleFields>
  disabled?: boolean
  collapsible?: boolean
}

const FIELDS: { name: keyof ScheduleFields; label: string; type: 'date' | 'time' }[] = [
  { name: 'publishDate', label: 'Ziua publicării', type: 'date' },
  { name: 'publishTime', label: 'Ora publicării', type: 'time' },
  { name: 'expiresDate', label: 'Ziua expirării', type: 'date' },
  { name: 'expiresTime', label: 'Ora expirării', type: 'time' },
]

export function AnnouncementScheduleFields({
  idPrefix,
  register,
  errors,
  disabled,
  collapsible = false,
}: Props) {
  const hint = `${idPrefix}-schedule-hint`
  const [open, setOpen] = useState(!collapsible)
  if (!open) {
    return (
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 lg:h-9"
          disabled={disabled}
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <Clock aria-hidden="true" /> Programează publicarea
        </Button>
        <span className="text-muted-foreground text-xs">Implicit apare acum și nu expiră.</span>
      </div>
    )
  }
  return (
    <fieldset className="space-y-3" aria-describedby={hint}>
      <legend className="text-sm leading-none font-medium select-none">
        Programare (opțional)
      </legend>
      <p id={hint} className="text-muted-foreground text-xs">
        Orele sunt pentru București. Lasă gol ca anunțul să apară acum și să rămână vizibil.
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
        {FIELDS.map(({ name, label, type }) => {
          const id = `${idPrefix}-${name}`
          const error = errors[name]?.message
          return (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type={type}
                className="md:text-base"
                disabled={disabled}
                aria-invalid={!!error}
                aria-describedby={fieldDescription(id, undefined, error)}
                {...register(name)}
              />
              <FieldMessage id={id} error={error} />
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
