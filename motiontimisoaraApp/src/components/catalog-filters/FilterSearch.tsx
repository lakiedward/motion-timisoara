import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function FilterSearch({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input type="search" className="pl-9 lg:h-9" {...props} />
    </div>
  )
}
