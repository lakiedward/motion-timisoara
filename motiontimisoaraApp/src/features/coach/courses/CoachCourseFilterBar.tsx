import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CoachCourseFilters, CoachStatusFilter } from './coach-course-filters'

const STATUS_OPTIONS: FilterOption<CoachStatusFilter>[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

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
  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută curs sau locație"
          aria-label="Caută cursuri după nume sau locație"
          className="pl-9"
        />
      </div>
      <CourseFilterBar
        status={filters.status}
        sport={filters.sport}
        statusCounts={statusCounts}
        sports={sports}
        statusOptions={STATUS_OPTIONS}
        selectId="coach-course-sport"
        onStatus={(status) => onChange({ ...filters, status })}
        onSport={(sport) => onChange({ ...filters, sport })}
      />
    </div>
  )
}
