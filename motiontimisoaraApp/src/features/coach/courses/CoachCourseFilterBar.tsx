
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CoachCourseFilters, CoachStatusFilter } from './coach-course-filters'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

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
      <FilterSearch
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Caută curs sau locație"
        aria-label="Caută cursuri după nume sau locație"
      />
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
