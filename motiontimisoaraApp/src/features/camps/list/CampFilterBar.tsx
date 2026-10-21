import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CampFilters, CampStatusFilter } from './camp-list'

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
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută tabără sau locație"
          aria-label="Caută tabere după nume sau locație"
          className="h-touch-target pl-9"
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
