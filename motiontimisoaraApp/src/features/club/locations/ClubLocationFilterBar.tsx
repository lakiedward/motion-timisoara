
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { LocationFilters, LocationStatusFilter } from './location-list'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

const STATUS_OPTIONS: FilterOption<LocationStatusFilter>[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

export function ClubLocationFilterBar({
  filters,
  statusCounts,
  onChange,
}: {
  filters: LocationFilters
  statusCounts: Record<LocationStatusFilter, number>
  onChange: (next: LocationFilters) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <FilterSearch
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Caută locație sau adresă"
        aria-label="Caută locații după nume sau adresă"
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
