
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { ClubAnnouncementFilters, ClubAnnouncementStatus } from './club-announcement-filters'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

const STATUS_OPTIONS: FilterOption<ClubAnnouncementStatus>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'live', label: 'Vizibile acum' },
  { value: 'scheduled', label: 'Programate' },
  { value: 'expired', label: 'Expirate' },
  { value: 'hidden', label: 'Ascunse' },
]

export function ClubAnnouncementFilterBar({
  filters,
  statusCounts,
  targets,
  onChange,
}: {
  filters: ClubAnnouncementFilters
  statusCounts: Record<ClubAnnouncementStatus, number>
  targets: { id: string; name: string; count: number }[]
  onChange: (next: ClubAnnouncementFilters) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <FilterSearch
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Caută în anunțuri"
        aria-label="Caută anunțuri după titlu, text sau țintă"
      />
      <CourseFilterBar
        status={filters.status}
        sport={filters.target}
        statusCounts={statusCounts}
        sports={targets}
        statusOptions={STATUS_OPTIONS}
        selectId="club-announcement-target"
        sportLabel="Către"
        allSportsLabel="Toate țintele"
        onStatus={(status) => onChange({ ...filters, status })}
        onSport={(target) => onChange({ ...filters, target })}
      />
    </div>
  )
}
