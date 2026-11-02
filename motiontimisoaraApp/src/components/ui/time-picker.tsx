import { forwardRef, useState, type KeyboardEvent } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, Clock } from 'lucide-react'

import { pickerPanelClassName, pickerTriggerClassName } from '@/components/ui/field-styles'
import { normalizeTime, timeSlots } from '@/lib/date-picker'
import { cn } from '@/lib/utils'

export type TimePickerProps = {
  id?: string
  name?: string
  value: string | null | undefined
  onValueChange: (value: string) => void
  onBlur?: () => void
  step?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-label'?: string
}

const OPTION_CLASS =
  'hover:bg-accent focus-visible:bg-accent aria-selected:text-primary aria-selected:font-semibold flex min-h-touch-target w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm tabular-nums outline-hidden'

export function timeOptions(step: number, current: string): string[] {
  const slots = timeSlots(step)
  if (!current || slots.includes(current)) return slots
  return [...slots, current].sort()
}

export const TimePicker = forwardRef<HTMLButtonElement, TimePickerProps>(function TimePicker(
  {
    id,
    name,
    value,
    onValueChange,
    onBlur,
    step = 15,
    placeholder = 'Alege ora',
    disabled,
    className,
    ...aria
  },
  ref
) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const current = normalizeTime(value) ?? ''
  const typedTime = normalizeTime(typed)
  const options = timeOptions(step, current)

  const pick = (time: string) => {
    onValueChange(time)
    setOpen(false)
  }

  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const list = Array.from(
      event.currentTarget.closest('[data-time-panel]')?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []
    )
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    const start = list.findIndex((option) => option.getAttribute('aria-selected') === 'true')
    const fallback = start >= 0 ? start : list.findIndex((option) => option.dataset.time === '08:00')
    const next = index < 0 ? fallback : event.key === 'ArrowDown' ? index + 1 : index - 1
    list[Math.max(0, Math.min(list.length - 1, next))]?.focus()
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setTyped('')
        if (!next) onBlur?.()
      }}
    >
      <PopoverPrimitive.Trigger
        ref={ref}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-invalid={aria['aria-invalid']}
        aria-describedby={aria['aria-describedby']}
        aria-label={aria['aria-label']}
        className={cn(pickerTriggerClassName, className)}
      >
        <span className={cn('min-w-0 flex-1 truncate tabular-nums', !current && 'text-muted-foreground')}>
          {current || placeholder}
        </span>
        <Clock aria-hidden="true" className="size-4 shrink-0 opacity-70" />
      </PopoverPrimitive.Trigger>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          data-time-panel=""
          className={cn(
            pickerPanelClassName,
            'flex max-h-[min(20rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-44 flex-col p-1.5'
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const panel = event.currentTarget as HTMLElement | null
            panel?.querySelector<HTMLInputElement>('input')?.focus()
            requestAnimationFrame(() => {
              const list = panel?.querySelector<HTMLElement>('[role="listbox"]')
              const anchor =
                list?.querySelector<HTMLElement>('[aria-selected="true"]') ??
                list?.querySelector<HTMLElement>('[data-time="08:00"]')
              if (list && anchor) list.scrollTop = anchor.offsetTop - list.offsetTop - 8
            })
          }}
        >
          <form
            className="p-1 pb-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (typedTime) pick(typedTime)
            }}
          >
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={moveFocus}
              inputMode="numeric"
              placeholder="Scrie ora, ex. 10:10"
              aria-label="Scrie ora"
              className="border-input bg-background focus-visible:outline-ring h-10 w-full rounded-lg border px-3 text-base tabular-nums focus-visible:outline-2 md:text-sm"
            />
            {typed && (
              <button
                type="submit"
                disabled={!typedTime}
                className="text-primary mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium disabled:text-muted-foreground"
              >
                {typedTime ? `Folosește ${typedTime}` : 'Scrie ora ca 10:10'}
              </button>
            )}
          </form>
          <div role="listbox" aria-label="Ore" className="min-h-0 flex-1 overflow-y-auto" onKeyDown={moveFocus}>
            {options.map((time) => (
              <button
                key={time}
                type="button"
                role="option"
                data-time={time}
                aria-selected={time === current}
                className={OPTION_CLASS}
                onClick={() => pick(time)}
              >
                {time}
                {time === current && <Check aria-hidden="true" className="size-4" />}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
})
