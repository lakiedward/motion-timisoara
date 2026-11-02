import { forwardRef } from 'react'

import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { joinDateTime, splitDateTime } from '@/lib/date-picker'

export const DateTimePicker = forwardRef<
  HTMLButtonElement,
  {
    id: string
    name?: string
    value: string | null | undefined
    onValueChange: (value: string) => void
    onBlur?: () => void
    min?: string
    defaultTime?: string
    disabled?: boolean
    'aria-invalid'?: boolean
    'aria-describedby'?: string
  }
>(function DateTimePicker(
  { id, name, value, onValueChange, onBlur, min, defaultTime = '23:59', disabled, ...aria },
  ref
) {
  const { date, time } = splitDateTime(value)
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DatePicker
        ref={ref}
        id={id}
        value={date}
        min={min}
        clearable
        disabled={disabled}
        onBlur={onBlur}
        onValueChange={(next) => onValueChange(joinDateTime(next, time || defaultTime))}
        {...aria}
      />
      <TimePicker
        value={time}
        disabled={disabled || !date}
        aria-label="Ora"
        aria-invalid={aria['aria-invalid']}
        onBlur={onBlur}
        onValueChange={(next) => onValueChange(joinDateTime(date, next))}
      />
      {name ? <input type="hidden" name={name} value={joinDateTime(date, time)} /> : null}
    </div>
  )
})
