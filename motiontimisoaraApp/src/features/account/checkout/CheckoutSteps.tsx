import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CheckoutSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Pașii înscrierii" className="flex items-start">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2',
                  i <= current ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                'relative grid size-8 place-items-center rounded-full border-2 text-sm font-semibold',
                done && 'bg-primary border-primary text-primary-foreground',
                active && 'border-primary bg-card text-primary',
                !done && !active && 'bg-card text-muted-foreground border-border',
              )}
            >
              {done ? <Check aria-hidden="true" className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                'text-xs sm:text-sm',
                active ? 'text-foreground font-semibold' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function CheckoutStepList({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Pașii înscrierii" className="space-y-1">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm',
              active && 'bg-primary/10 text-foreground font-semibold',
              !active && 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                done && 'bg-primary border-primary text-primary-foreground',
                active && 'border-primary text-primary bg-card',
              )}
            >
              {done ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
            </span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

export function CheckoutProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div>
      <p className="text-sm">
        <span className="text-muted-foreground">
          Pasul {current + 1} din {steps.length} ·{' '}
        </span>
        <span className="font-semibold">{steps[current]}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Progresul înscrierii"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  )
}
