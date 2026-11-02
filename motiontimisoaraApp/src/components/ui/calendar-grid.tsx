import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  WEEKDAY_SHORT,
  addDays,
  cursorFor,
  formatDateLong,
  monthGrid,
  monthLabel,
  shiftMonth,
  todayIso,
} from '@/lib/date-picker'
import { cn } from '@/lib/utils'

const NAV_BUTTON =
  'hover:bg-accent focus-visible:outline-ring flex size-touch-target items-center justify-center rounded-lg focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-40'

const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
}

export function CalendarGrid({
  value,
  min,
  max,
  onPick,
}: {
  value: string
  min?: string
  max?: string
  onPick: (iso: string) => void
}) {
  const today = todayIso()
  const [focused, setFocused] = useState(() => value || (min && min > today ? min : today))
  const [cursor, setCursor] = useState(() => cursorFor(focused))
  const gridRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (!moved.current) return
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)?.focus()
  }, [focused, cursor])

  const outOfRange = (iso: string) => (!!min && iso < min) || (!!max && iso > max)

  const moveTo = (iso: string) => {
    moved.current = true
    setFocused(iso)
    setCursor(cursorFor(iso))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key]
    if (step !== undefined) {
      event.preventDefault()
      moveTo(addDays(focused, step))
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      moveTo(addDays(focused, event.key === 'PageUp' ? -30 : 30))
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Luna anterioară"
          className={NAV_BUTTON}
          onClick={() => setCursor((current) => shiftMonth(current, -1))}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <span aria-live="polite" className="font-display text-sm font-semibold">
          {monthLabel(cursor)}
        </span>
        <button
          type="button"
          aria-label="Luna următoare"
          className={NAV_BUTTON}
          onClick={() => setCursor((current) => shiftMonth(current, 1))}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div
        ref={gridRef}
        role="grid"
        aria-label={monthLabel(cursor)}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-0.5 text-center"
      >
        {WEEKDAY_SHORT.map((day) => (
          <span key={day} role="columnheader" className="text-muted-foreground py-1 text-xs font-medium">
            {day}
          </span>
        ))}
        {monthGrid(cursor).map((day) => {
          const selected = day.iso === value
          const disabled = outOfRange(day.iso)
          const tabbable = day.iso === focused || (!monthHas(cursor, focused) && day.day === 1 && day.inMonth)
          return (
            <button
              key={day.iso}
              type="button"
              role="gridcell"
              data-iso={day.iso}
              tabIndex={tabbable ? 0 : -1}
              disabled={disabled}
              aria-selected={selected}
              aria-current={day.iso === today ? 'date' : undefined}
              aria-label={formatDateLong(day.iso)}
              onClick={() => onPick(day.iso)}
              onFocus={() => setFocused(day.iso)}
              className={cn(
                'focus-visible:outline-ring flex h-10 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-35',
                !day.inMonth && 'text-muted-foreground',
                !selected && 'hover:bg-accent',
                day.iso === today && !selected && 'border-primary text-primary border font-semibold',
                selected && 'bg-primary text-primary-foreground font-semibold'
              )}
            >
              {day.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function monthHas(cursor: { year: number; month: number }, iso: string) {
  const current = cursorFor(iso)
  return current.year === cursor.year && current.month === cursor.month
}
