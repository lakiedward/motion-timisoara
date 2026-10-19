import * as React from 'react'
import { CircleAlert, CircleCheck, Inbox, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StatusViewProps {
  state: 'loading' | 'error' | 'empty' | 'success'
  title?: string
  text?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  action?: React.ReactNode
  rows?: number
  rowHeight?: number
  className?: string
}

function StatusView({
  state,
  title,
  text,
  onRetry,
  retryLabel = 'Reîncearcă',
  action,
  rows = 3,
  rowHeight = 88,
  className,
}: StatusViewProps) {
  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-label={title ?? 'Se încarcă'}
        className={cn('grid w-full gap-3', className)}
      >
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="rounded-xl" style={{ height: rowHeight }} />
        ))}
      </div>
    )
  }
  const isError = state === 'error'
  const isSuccess = state === 'success'
  const Icon = isError ? CircleAlert : isSuccess ? CircleCheck : Inbox
  return (
    <div
      role={isError ? 'alert' : isSuccess ? 'status' : undefined}
      className={cn(
        'grid justify-items-center gap-2 rounded-xl px-6 py-12 text-center',
        state === 'empty' && 'border border-dashed border-input',
        className,
      )}
    >
      <span
        className={cn(
          'mb-2 grid size-12 place-items-center rounded-full',
          isError
            ? 'bg-destructive/14 text-destructive'
            : isSuccess
              ? 'bg-success/14 text-success-ink'
              : 'bg-accent text-accent-foreground',
        )}
      >
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <p className="text-foreground text-base font-semibold">
        {title ??
          (isError ? 'Nu am putut încărca datele.' : isSuccess ? 'Gata.' : 'Nimic aici încă.')}
      </p>
      {text ? <p className="text-muted-foreground max-w-100 text-sm">{text}</p> : null}
      {isError && onRetry ? (
        <Button type="button" className="mt-3" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
      {!isError && action ? action : null}
    </div>
  )
}

export { StatusView }
