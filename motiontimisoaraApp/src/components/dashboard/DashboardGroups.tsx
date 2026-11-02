import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function DashboardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">{children}</div>
}

export function DashboardGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card min-w-0 rounded-xl border">
      <h2 className="font-display text-foreground border-b px-5 py-4 text-base font-bold">
        {title}
      </h2>
      <ul className="divide-y">{children}</ul>
    </section>
  )
}

export type DashboardRowProps = {
  to: string
  testId: string
  icon: LucideIcon
  label: string
  hint?: ReactNode
  value?: ReactNode
  ariaLabel?: string
  loading?: boolean
  error?: string
  valueClassName?: string
}

export function DashboardRow({
  to,
  testId,
  icon: Icon,
  label,
  hint,
  value,
  ariaLabel,
  loading = false,
  error,
  valueClassName,
}: DashboardRowProps) {
  return (
    <li>
      <Link
        to={to}
        data-testid={testId}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        className="group hover:bg-muted/60 focus-visible:outline-ring flex min-h-touch-target items-center gap-4 px-5 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-sm font-medium break-words">{label}</div>
          {hint ? <div className="text-muted-foreground text-xs break-words">{hint}</div> : null}
          {error ? <p className="text-destructive mt-1 text-xs break-words">{error}</p> : null}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-14" role="status" aria-label={`Se încarcă: ${label}`} />
        ) : value !== undefined ? (
          <div
            className={cn('font-display text-foreground text-2xl font-extrabold', valueClassName)}
          >
            {value}
          </div>
        ) : null}
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-primary size-5 shrink-0 transition-colors"
        />
      </Link>
    </li>
  )
}
