import * as React from 'react'

import { cn } from '@/lib/utils'

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('mx-auto mb-10 max-w-2xl text-center', className)}>
      {eyebrow && <span className="eyebrow mb-3">{eyebrow}</span>}
      <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-3 text-lg">{subtitle}</p>}
    </div>
  )
}
