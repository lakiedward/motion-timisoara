
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CampFilters, CampStatusFilter } from './camp-list'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

const STATUS_OPTIONS: FilterOption<CampStatusFilter>[] = [
  { value: 'ongoing', label: 'În desfășurare' },
  { value: 'upcoming', label: 'Viitoare' },
  { value: 'ended', label: 'Încheiate' },
  { value: 'all', label: 'Toate' },
]

export function CampFilterBar({
  filters,
  statusCounts,
  onChange,
}: {
  filters: CampFilters
  statusCounts: Record<CampStatusFilter, number>
  onChange: (next: CampFilters) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <FilterSearch
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Caută tabără sau locație"
        aria-label="Caută tabere după nume sau locație"
      />
      <CourseFilterBar
        status={filters.status}
        sport=""
        statusCounts={statusCounts}
        sports={[]}
        statusOptions={STATUS_OPTIONS}
        onStatus={(status) => onChange({ ...filters, status })}
        onSport={() => {}}
      />
    </div>
  )
}
