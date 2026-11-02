import { forwardRef, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CalendarGrid } from '@/components/ui/calendar-grid'
import { pickerPanelClassName, pickerTriggerClassName } from '@/components/ui/field-styles'
import { formatDateLabel, parseIsoDate, todayIso } from '@/lib/date-picker'
import { cn } from '@/lib/utils'

export type DatePickerProps = {
  id?: string
  name?: string
  value: string | null | undefined
  onValueChange: (value: string) => void
  onBlur?: () => void
  min?: string
  max?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  className?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  {
    id,
    name,
    value,
    onValueChange,
    onBlur,
    min,
    max,
    placeholder = 'Alege data',
    clearable,
    disabled,
    className,
    ...aria
  },
  ref
) {
  const [open, setOpen] = useState(false)
  const current = parseIsoDate(value) ? (value as string) : ''
  const today = todayIso()
  const todayAllowed = (!min || today >= min) && (!max || today <= max)

  const pick = (iso: string) => {
    onValueChange(iso)
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur?.()
      }}
    >
      <PopoverPrimitive.Trigger
        ref={ref}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-invalid={aria['aria-invalid']}
        aria-describedby={aria['aria-describedby']}
        aria-label={aria['aria-label']}
        className={cn(pickerTriggerClassName, className)}
      >
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-muted-foreground')}>
          {current ? formatDateLabel(current) : placeholder}
        </span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 opacity-70" />
      </PopoverPrimitive.Trigger>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          aria-label="Alege data"
          className={cn(pickerPanelClassName, 'w-[19.5rem] p-3')}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const target = event.currentTarget as HTMLElement | null
            target?.querySelector<HTMLButtonElement>('[role="gridcell"][tabindex="0"]')?.focus()
          }}
        >
          <CalendarGrid value={current} min={min} max={max} onPick={pick} />
          {(clearable || todayAllowed) && (
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              {clearable ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => pick('')}>
                  Șterge
                </Button>
              ) : (
                <span />
              )}
              {todayAllowed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => pick(today)}
                >
                  Azi
                </Button>
              )}
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
})
