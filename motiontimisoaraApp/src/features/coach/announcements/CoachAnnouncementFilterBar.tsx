import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CoachAnnouncementFilters, SourceFilter } from './coach-announcement-filters'

const SOURCE_OPTIONS: FilterOption<SourceFilter>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'coach', label: 'Ale mele' },
  { value: 'club', label: 'De la club' },
]

export function CoachAnnouncementFilterBar({
  filters,
  sourceCounts,
  courses,
  onChange,
}: {
  filters: CoachAnnouncementFilters
  sourceCounts: Record<SourceFilter, number>
  courses: { id: string; name: string; count: number }[]
  onChange: (next: CoachAnnouncementFilters) => void
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
          placeholder="Caută în anunțuri"
          aria-label="Caută anunțuri după text, curs sau club"
          className="pl-9"
        />
      </div>
      <CourseFilterBar
        status={filters.source}
        sport={filters.course}
        statusCounts={sourceCounts}
        sports={courses}
        statusOptions={SOURCE_OPTIONS}
        selectId="coach-announcement-course"
        sportLabel="Curs"
        allSportsLabel="Toate cursurile"
        onStatus={(source) => onChange({ ...filters, source })}
        onSport={(course) => onChange({ ...filters, course })}
      />
    </div>
  )
}
