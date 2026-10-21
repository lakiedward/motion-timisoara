import { CircleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FILTER_SELECT_CLASS } from '@/features/public/courses/CourseFilters'
import { cn } from '@/lib/utils'
import type { StatusFilter } from './course-overview'

export type FilterOption<S extends string> = { value: S; label: string }

const STATUS_OPTIONS: FilterOption<StatusFilter>[] = [
  { value: 'active', label: 'Active' },
  { value: 'attention', label: 'De verificat' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

const PILL = 'h-touch-target min-h-touch-target shrink-0 rounded-full lg:h-9 lg:min-h-9'

function Count({ n }: { n: number }) {
  return <span className="tabular-nums opacity-75">{n}</span>
}

export function CourseFilterBar<S extends string = StatusFilter>({
  status,
  sport,
  statusCounts,
  sports,
  onStatus,
  onSport,
  statusOptions = STATUS_OPTIONS as FilterOption<S>[],
  selectId = 'admin-course-sport',
  sportLabel = 'Sport',
  allSportsLabel = 'Toate sporturile',
  statusLabel = 'Status',
}: {
  status: S
  sport: string
  statusCounts: Record<S, number>
  sports: { id: string; name: string; count: number }[]
  onStatus: (s: S) => void
  onSport: (id: string) => void
  statusOptions?: FilterOption<S>[]
  selectId?: string
  sportLabel?: string
  allSportsLabel?: string
  statusLabel?: string
}) {
  return (
    <div className="mb-3 space-y-2">
      <div
        role="group"
        aria-label={statusLabel}
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
      >
        {statusOptions.map((o) => {
          const on = status === o.value
          const attention = o.value === 'attention' && statusCounts[o.value] > 0
          return (
            <Button
              key={o.value}
              type="button"
              variant={on ? 'default' : 'outline'}
              aria-pressed={on}
              className={PILL}
              onClick={() => onStatus(o.value)}
            >
              {attention && (
                <CircleAlert aria-hidden="true" className={cn(!on && 'text-highlight-ink')} />
              )}
              {o.label} <Count n={statusCounts[o.value]} />
            </Button>
          )
        })}
      </div>
      {sports.length > 1 && (
        <div className="flex items-center gap-3 md:hidden">
          <Label htmlFor={selectId} className="shrink-0">
            {sportLabel}
          </Label>
          <select
            id={selectId}
            value={sport}
            onChange={(e) => onSport(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">{allSportsLabel}</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>
      )}
      {sports.length > 1 && (
        <div role="group" aria-label={sportLabel} className="hidden flex-wrap gap-2 md:flex">
          <Button
            type="button"
            variant={sport ? 'outline' : 'default'}
            aria-pressed={!sport}
            className={PILL}
            onClick={() => onSport('')}
          >
            {allSportsLabel}
          </Button>
          {sports.map((s) => {
            const on = sport === s.id
            return (
              <Button
                key={s.id}
                type="button"
                variant={on ? 'default' : 'outline'}
                aria-pressed={on}
                className={PILL}
                onClick={() => onSport(on ? '' : s.id)}
              >
                {s.name} <Count n={s.count} />
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
