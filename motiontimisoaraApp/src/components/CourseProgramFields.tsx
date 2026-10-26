import type {
  Control,
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form'
import { useWatch } from 'react-hook-form'

import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  COURSE_WEEKDAYS,
  emptyCourseProgram,
  formatCourseProgramPreview,
  type CourseProgramDay,
  weekdayLabel,
} from '@/lib/course-program/recurrence'
import { cn } from '@/lib/utils'

type ProgramErrors = {
  message?: string
  [index: number]: { start?: { message?: string }; end?: { message?: string } } | undefined
}

export default function CourseProgramFields<T extends FieldValues>({
  control,
  register,
  setValue,
  errors,
  inputClassName,
  chipClassName,
}: {
  control: Control<T>
  register: UseFormRegister<T>
  setValue: UseFormSetValue<T>
  errors: FieldErrors<T>
  inputClassName?: string
  chipClassName?: string
}) {
  const program = (useWatch({ control, name: 'program' as Path<T> }) ??
    emptyCourseProgram()) as CourseProgramDay[]
  const programErrors = errors.program as ProgramErrors | undefined
  const rootError = programErrors?.message
  const preview = formatCourseProgramPreview(program)

  const toggleDay = (index: number) => {
    const current = program[index]
    if (!current) return
    const nextEnabled = !current.enabled
    setValue(`program.${index}.enabled` as Path<T>, nextEnabled as T[Path<T>], {
      shouldDirty: true,
      shouldValidate: true,
    })
    if (!nextEnabled) {
      setValue(`program.${index}.start` as Path<T>, '' as T[Path<T>], {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue(`program.${index}.end` as Path<T>, '' as T[Path<T>], {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

  return (
    <FormSection
      title="Program"
      description="Alege zilele săptămânii și orele. Fără acest program, cursul nu poate fi creat."
    >
      <fieldset
        aria-invalid={!!rootError}
        aria-describedby={rootError ? 'course-program-error' : undefined}
      >
        <legend className="sr-only">Program</legend>
        <div className="flex flex-wrap gap-2">
          {COURSE_WEEKDAYS.map((day, index) => {
            const selected = program[index]?.enabled ?? false
            return (
              <Button
                key={day.iso}
                type="button"
                size="sm"
                variant={selected ? 'default' : 'outline'}
                aria-pressed={selected}
                className={cn('min-h-11 px-3 lg:min-h-8', chipClassName)}
                onClick={() => toggleDay(index)}
              >
                {day.label}
              </Button>
            )
          })}
        </div>
        <div className="mt-4 space-y-3">
          {program.map((day, index) => {
            if (!day.enabled) return null
            const startId = `program-${day.iso}-start`
            const endId = `program-${day.iso}-end`
            const startError = programErrors?.[index]?.start?.message
            const endError = programErrors?.[index]?.end?.message
            const dayError = startError || endError
            return (
              <fieldset key={day.iso} className="rounded-xl border p-4">
                <legend className="sr-only">{weekdayLabel(day.iso)}</legend>
                <p className="mb-3 text-sm font-medium" aria-hidden="true">
                  {weekdayLabel(day.iso)}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={startId}>Ora start</Label>
                    <Input
                      id={startId}
                      type="time"
                      className={inputClassName}
                      aria-invalid={!!startError}
                      aria-describedby={startError ? `${startId}-error` : undefined}
                      {...register(`program.${index}.start` as Path<T>)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={endId}>Ora final</Label>
                    <Input
                      id={endId}
                      type="time"
                      className={inputClassName}
                      aria-invalid={!!endError}
                      aria-describedby={endError ? `${endId}-error` : undefined}
                      {...register(`program.${index}.end` as Path<T>)}
                    />
                  </div>
                </div>
                {dayError && (
                  <p
                    id={startError ? `${startId}-error` : `${endId}-error`}
                    className="text-destructive mt-2 text-xs"
                    role="alert"
                  >
                    {dayError}
                  </p>
                )}
              </fieldset>
            )
          })}
        </div>
        {preview && (
          <p className="mt-3 text-sm font-medium" aria-live="polite">
            {preview}
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          Fiecare zi poate avea un interval orar diferit. Orele sunt în fusul României.
        </p>
        {rootError && (
          <p id="course-program-error" className="text-destructive mt-2 text-xs" role="alert">
            {rootError}
          </p>
        )}
      </fieldset>
    </FormSection>
  )
}
