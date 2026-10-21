import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CoachActivityFilters, CoachActivityStatus } from './coach-activity-overview'

const STATUS_OPTIONS: FilterOption<CoachActivityStatus>[] = [
  { value: 'upcoming', label: 'Viitoare' },
  { value: 'past', label: 'Încheiate' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

export function CoachActivityFilterBar({
  filters,
  statusCounts,
  sports,
  onChange,
}: {
  filters: CoachActivityFilters
  statusCounts: Record<CoachActivityStatus, number>
  sports: { id: string; name: string; count: number }[]
  onChange: (next: CoachActivityFilters) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută activitate sau locație"
          aria-label="Caută activități după nume sau locație"
          className="pl-9"
        />
      </div>
      <CourseFilterBar
        status={filters.status}
        sport={filters.sport}
        statusCounts={statusCounts}
        sports={sports}
        statusOptions={STATUS_OPTIONS}
        selectId="coach-activity-sport"
        onStatus={(status) => onChange({ ...filters, status })}
        onSport={(sport) => onChange({ ...filters, sport })}
      />
    </div>
  )
}
