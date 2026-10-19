import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CheckoutSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Pașii înscrierii" className="mt-6 mb-8 flex flex-wrap gap-2">
      {steps.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
            i === current
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <span className="grid size-5 place-items-center rounded-full border text-xs">
            {i < current ? <Check aria-hidden="true" className="size-3" /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  )
}
