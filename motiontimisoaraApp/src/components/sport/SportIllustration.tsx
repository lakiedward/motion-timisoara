import { cn } from '@/lib/utils'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK, SPORT_GLYPH, SPORT_GLYPH_FALLBACK } from './sport-icons'

export function SportIllustration({
  code,
  name,
  compact = false,
  className,
}: {
  code?: string | null
  name?: string | null
  compact?: boolean
  className?: string
}) {
  const Glyph = SPORT_GLYPH[code ?? ''] ?? SPORT_GLYPH_FALLBACK
  const color = SPORT_COLOR[code ?? ''] ?? SPORT_COLOR_FALLBACK
  const label = name ? `Ilustrație ${name}` : 'Ilustrație sport'

  return (
    <div
      role="img"
      aria-label={label}
      data-sport-illustration={code || 'generic'}
      className={cn(
        'flex size-full flex-col items-center justify-center gap-2 overflow-hidden',
        className,
      )}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, var(--card))` }}
    >
      <span
        className={cn(
          'text-foreground grid shrink-0 place-items-center rounded-full',
          compact ? 'size-9' : 'size-14',
        )}
        style={{ backgroundColor: `color-mix(in oklab, ${color} 38%, var(--card))` }}
      >
        <Glyph className={compact ? 'size-5' : 'size-7'} aria-hidden="true" />
      </span>
      {!compact && name ? (
        <span className="font-display text-foreground max-w-full truncate px-4 text-sm font-semibold">
          {name}
        </span>
      ) : null}
    </div>
  )
}
