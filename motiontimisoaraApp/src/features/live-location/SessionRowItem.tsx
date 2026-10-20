import { ChevronDown, ChevronRight, Info } from 'lucide-react'

import { cn } from '@/lib/utils'
import { LocationViewer } from './LocationViewer'
import { timeRange, type SessionRow } from './current-sessions'

export function SharingStatus({ sharing, className }: { sharing: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-sm font-medium',
        className,
        sharing ? 'text-success-ink' : 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-2.5 rounded-full', sharing ? 'bg-success' : 'border-input border-2')}
      />
      {sharing ? 'Partajează acum' : 'Nu partajează'}
    </span>
  )
}

export function SessionRowItem({
  row,
  open,
  viewerKey,
  onToggle,
}: {
  key?: string
  row: SessionRow
  open: boolean
  viewerKey: string
  onToggle: () => void
}) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        className="hover:bg-muted/50 focus-visible:outline-ring flex min-h-touch-target w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-6"
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{row.courseName}</span>
          <span className="text-muted-foreground block text-sm">
            {[row.coachName, timeRange(row.occurrence.starts_at, row.occurrence.ends_at)]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <SharingStatus sharing={row.sharing} className="mt-1 sm:hidden" />
        </span>
        <SharingStatus sharing={row.sharing} className="hidden sm:flex" />
        <Icon aria-hidden="true" className="text-primary size-5 shrink-0" />
      </button>
      {open &&
        (row.sharing ? (
          <LocationViewer
            key={viewerKey}
            occurrenceId={row.occurrence.id}
            className="px-4 pt-1 pb-4 sm:px-6 sm:pb-6"
          />
        ) : (
          <p
            role="status"
            className="bg-muted text-muted-foreground mx-4 mb-4 flex items-start gap-2 rounded-lg p-4 text-sm sm:mx-6"
          >
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Antrenorul nu partajează locația la această ședință. Când pornește partajarea, harta
            apare aici.
          </p>
        ))}
    </li>
  )
}
