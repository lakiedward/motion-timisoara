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
