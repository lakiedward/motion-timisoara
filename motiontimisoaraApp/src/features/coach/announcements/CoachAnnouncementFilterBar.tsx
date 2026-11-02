
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CoachAnnouncementFilters, SourceFilter } from './coach-announcement-filters'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

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
      <FilterSearch
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Caută în anunțuri"
        aria-label="Caută anunțuri după text, curs sau club"
      />
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
