import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import type { DayRange, PeriodPreset } from './payment-history'

const PILL = 'h-touch-target min-h-touch-target shrink-0 rounded-full lg:h-9 lg:min-h-9'

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Azi' },
  { value: '7d', label: '7 zile' },
  { value: 'month', label: 'Luna asta' },
  { value: 'last-month', label: 'Luna trecută' },
  { value: 'custom', label: 'Interval' },
]

export function PaymentPeriod({
  preset,
  days,
  error,
  onPreset,
  onDays,
}: {
  preset: PeriodPreset
  days: DayRange
  error: string | null
  onPreset: (preset: PeriodPreset) => void
  onDays: (days: DayRange) => void
}) {
  return (
    <div className="mb-4 space-y-3">
      <div
        role="group"
        aria-label="Perioadă"
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
      >
        {PRESETS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={preset === option.value ? 'default' : 'outline'}
            aria-pressed={preset === option.value}
            className={PILL}
            onClick={() => onPreset(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="payments-from">De la</Label>
            <DatePicker
              id="payments-from"
              value={days.start}
              max={days.end}
              onValueChange={(start) => onDays({ ...days, start })}
              className="sm:w-44"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payments-to">Până la</Label>
            <DatePicker
              id="payments-to"
              value={days.end}
              min={days.start}
              onValueChange={(end) => onDays({ ...days, end })}
              className="sm:w-44"
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive col-span-2 text-sm sm:pb-2">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
