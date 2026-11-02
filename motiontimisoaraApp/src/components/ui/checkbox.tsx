import * as React from 'react'
import { Check } from 'lucide-react'

import { fieldFocusClassName } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'

function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <span data-slot="checkbox" className={cn('relative inline-flex size-5 shrink-0', className)}>
      <input
        type="checkbox"
        className={cn(
          'peer border-input dark:bg-input/30 hover:border-muted-foreground checked:border-primary checked:hover:border-primary checked:bg-primary dark:checked:bg-primary aria-invalid:border-destructive size-5 cursor-pointer appearance-none rounded border-2 bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          fieldFocusClassName,
        )}
        {...props}
      />
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="text-primary-foreground pointer-events-none absolute inset-0 m-auto size-3.5 opacity-0 peer-checked:opacity-100"
      />
    </span>
  )
}

export { Checkbox }
