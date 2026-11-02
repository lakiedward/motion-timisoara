import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatPlanPrice } from './pricing-content'

export function PlanFeatureList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-2.5 text-sm', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PlanPrice({ priceBani, size = 'lg' }: { priceBani: number; size?: 'lg' | 'xl' }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span
        className={cn(
          'font-display font-extrabold text-foreground',
          size === 'xl' ? 'text-5xl' : 'text-4xl'
        )}
      >
        {formatPlanPrice(priceBani)}
      </span>
      <span className="text-muted-foreground text-sm font-medium">lei / lună</span>
    </p>
  )
}
