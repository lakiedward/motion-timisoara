import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

interface StarRatingProps {
  /** 0..5, supports decimals for display. */
  value: number
  /** When provided, the control is interactive (whole-star selection). */
  onChange?: (value: number) => void
  readOnly?: boolean
  /** Star size in px. */
  size?: number
  className?: string
}

export function StarRating({
  value,
  onChange,
  readOnly = !onChange,
  size = 20,
  className,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value))

  if (readOnly) {
    const pct = (clamped / 5) * 100
    return (
      <div
        className={cn('relative inline-flex', className)}
        role="img"
        aria-label={`${clamped} din 5 stele`}
      >
        <div className="text-muted-foreground/35 flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} style={{ width: size, height: size }} className="fill-current" />
          ))}
        </div>
        <div
          className="text-highlight absolute inset-0 flex overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className="shrink-0 fill-current"
            />
          ))}
        </div>
      </div>
    )
  }

  const active = Math.round(clamped)
  return (
    <div className={cn('inline-flex', className)} role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-label={`${i} stele`}
          aria-checked={i === active}
          onClick={() => onChange?.(i)}
          className="text-muted-foreground/35 hover:text-highlight cursor-pointer transition-colors"
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(i <= active && 'text-highlight fill-current')}
          />
        </button>
      ))}
    </div>
  )
}
