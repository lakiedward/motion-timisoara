import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { ClubAnnouncementFilters, ClubAnnouncementStatus } from './club-announcement-filters'

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
          aria-label="Caută anunțuri după titlu, text sau țintă"
          className="pl-9"
        />
      </div>
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
