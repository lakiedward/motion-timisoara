import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function InfoTile({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  to?: string
}) {
  const body = (
    <>
      <span aria-hidden="true" className="text-primary shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs leading-tight">{label}</div>
        <div
          className={
            to
              ? 'text-primary text-sm leading-snug font-bold break-words underline-offset-2 group-hover:underline'
              : 'text-foreground text-sm leading-snug font-bold break-words'
          }
        >
          {value}
        </div>
        {hint && <div className="text-muted-foreground text-xs leading-snug">{hint}</div>}
      </div>
    </>
  )
  const layout =
    'flex min-w-0 flex-1 flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-2.5 sm:p-4'

  if (to) {
    return (
      <Link to={to} className={`group focus-visible:rounded-lg ${layout} ${FOCUS_RING}`}>
        {body}
      </Link>
    )
  }

  return <div className={layout}>{body}</div>
}
