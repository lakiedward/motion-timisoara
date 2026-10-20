import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { LocationFilters, LocationStatusFilter } from './location-list'

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
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută locație sau adresă"
          aria-label="Caută locații după nume sau adresă"
          className="pl-9"
        />
      </div>
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
