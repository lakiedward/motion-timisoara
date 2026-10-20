import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FILTER_SELECT_CLASS } from '@/features/public/courses/CourseFilters'
import type { CoachCourseFilters, CoachStatusFilter } from './coach-course-filters'

const STATUS_OPTIONS: { value: CoachStatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

const PILL = 'h-touch-target min-h-touch-target shrink-0 rounded-full lg:h-9 lg:min-h-9'

function Count({ n }: { n: number }) {
  return <span className="tabular-nums opacity-75">{n}</span>
}

export function CoachCourseFilterBar({
  filters,
  statusCounts,
  sports,
  onChange,
}: {
  filters: CoachCourseFilters
  statusCounts: Record<CoachStatusFilter, number>
  sports: { id: string; name: string; count: number }[]
  onChange: (next: CoachCourseFilters) => void
}) {
  const { status, sport, query } = filters
  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută curs sau locație"
          aria-label="Caută cursuri după nume sau locație"
          className="pl-9"
        />
      </div>
      <div
        role="group"
        aria-label="Status"
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
      >
        {STATUS_OPTIONS.map((o) => {
          const on = status === o.value
          return (
            <Button
              key={o.value}
              type="button"
              variant={on ? 'default' : 'outline'}
              aria-pressed={on}
              className={PILL}
              onClick={() => onChange({ ...filters, status: o.value })}
            >
              {o.label} <Count n={statusCounts[o.value]} />
            </Button>
          )
        })}
      </div>
      {sports.length > 1 && (
        <div className="flex items-center gap-3 md:hidden">
          <Label htmlFor="coach-course-sport" className="shrink-0">
            Sport
          </Label>
          <select
            id="coach-course-sport"
            value={sport}
            onChange={(e) => onChange({ ...filters, sport: e.target.value })}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">Toate sporturile</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>
      )}
      {sports.length > 1 && (
        <div role="group" aria-label="Sport" className="hidden flex-wrap gap-2 md:flex">
          <Button
            type="button"
            variant={sport ? 'outline' : 'default'}
            aria-pressed={!sport}
            className={PILL}
            onClick={() => onChange({ ...filters, sport: '' })}
          >
            Toate sporturile
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
                onClick={() => onChange({ ...filters, sport: on ? '' : s.id })}
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
