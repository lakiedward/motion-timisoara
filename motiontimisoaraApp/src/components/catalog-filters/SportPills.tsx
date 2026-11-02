import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SPORT_GLYPH, SPORT_GLYPH_FALLBACK } from '@/components/sport/sport-icons'
import type { FilterOption } from './FilterSelect'

export function SportPills({
  value,
  options,
  loading,
  onChange,
}: {
  value: string
  options: FilterOption[]
  loading: boolean
  onChange: (value: string) => void
}) {
  return (
    <div role="group" aria-label="Sport" className="flex flex-wrap gap-2">
      <Button
        type="button"
        className="shrink-0 rounded-full"
        variant={value ? 'outline' : 'default'}
        aria-pressed={!value}
        onClick={() => onChange('')}
      >
        Toate
      </Button>
      {loading
        ? [0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-touch-target w-28 shrink-0 rounded-full" />
          ))
        : options.map((sport) => {
            const Glyph = SPORT_GLYPH[sport.value] ?? SPORT_GLYPH_FALLBACK
            const active = value === sport.value
            return (
              <Button
                key={sport.value}
                type="button"
                className="shrink-0 rounded-full"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                onClick={() => onChange(active ? '' : sport.value)}
              >
                <Glyph aria-hidden="true" />
                {sport.label}
              </Button>
            )
          })}
    </div>
  )
}
