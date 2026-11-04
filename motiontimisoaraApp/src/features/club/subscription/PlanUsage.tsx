import { cn } from '@/lib/utils'
import { coachUsageText } from './plan-actions'

export function PlanUsage({
  coachCount,
  coachLimit,
  className,
}: {
  coachCount: number
  coachLimit: number | null
  className?: string
}) {
  const ratio = coachLimit === null ? 0 : Math.min(1, coachCount / coachLimit)
  const full = coachLimit !== null && coachCount >= coachLimit
  return (
    <div className={cn('space-y-1.5', className)}>
      <p
        className={cn('text-sm', full ? 'text-foreground font-semibold' : 'text-muted-foreground')}
      >
        {coachUsageText(coachCount, coachLimit)}
      </p>
      {coachLimit !== null && (
        <div
          role="meter"
          aria-label="Antrenori folosiți din limită"
          aria-valuemin={0}
          aria-valuemax={coachLimit}
          aria-valuenow={Math.min(coachCount, coachLimit)}
          className="bg-secondary h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={cn('h-full rounded-full', full ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
