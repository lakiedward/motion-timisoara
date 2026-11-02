import type { MouseEventHandler, ReactNode, Ref } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  count,
  headingRef,
  className,
  children,
}: {
  title: ReactNode
  count?: number
  headingRef?: Ref<HTMLHeadingElement>
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-3', className)}>
      <h1
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="font-display text-foreground mr-auto min-w-0 text-2xl font-bold break-words outline-none"
      >
        {title}
        {count ? (
          <span className="text-muted-foreground ml-2 text-base font-normal">({count})</span>
        ) : null}
      </h1>
      {children}
    </div>
  )
}

export function PageNewLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
      <Link to={to}>
        <Plus aria-hidden="true" /> {children}
      </Link>
    </Button>
  )
}

export function PageNewButton({
  onClick,
  children,
}: {
  onClick: MouseEventHandler<HTMLButtonElement>
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9"
    >
      <Plus aria-hidden="true" /> {children}
    </Button>
  )
}

export function BackLink({
  to,
  onClick,
  children,
}: {
  to: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground h-touch-target inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft aria-hidden="true" className="size-4" /> {children}
    </Link>
  )
}
