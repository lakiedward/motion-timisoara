import { FilterSearch } from '@/components/catalog-filters/FilterSearch'
import { Label } from '@/components/ui/label'
import { SelectMenu } from '@/components/ui/select-menu'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CoachActivityStatus } from '@/features/coach/activities/coach-activity-overview'
import type { ClubActivityFilters } from './club-activity-filters'

const STATUS_OPTIONS: FilterOption<CoachActivityStatus>[] = [
  { value: 'upcoming', label: 'Viitoare' },
  { value: 'past', label: 'Încheiate' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

type Option = { id: string; name: string; count: number }

export function ClubActivityFilterBar({
  filters,
  statusCounts,
  sports,
  coaches,
  onChange,
}: {
  filters: ClubActivityFilters
  statusCounts: Record<CoachActivityStatus, number>
  sports: Option[]
  coaches: Option[]
  onChange: (next: ClubActivityFilters) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-col gap-2 md:flex-row">
        <FilterSearch
          className="flex-1"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută activitate, locație sau antrenor"
          aria-label="Caută activități după nume, locație sau antrenor"
        />
        {coaches.length > 1 && (
          <div className="flex items-center gap-3 md:w-72">
            <Label htmlFor="club-activity-coach" className="shrink-0">
              Antrenor
            </Label>
            <SelectMenu
              id="club-activity-coach"
              value={filters.coach}
              onValueChange={(coach) => onChange({ ...filters, coach })}
              emptyLabel="Toți antrenorii"
              options={coaches.map((c) => ({ value: c.id, label: `${c.name} (${c.count})` }))}
            />
          </div>
        )}
      </div>
      <CourseFilterBar
        status={filters.status}
        sport={filters.sport}
        statusCounts={statusCounts}
        sports={sports}
        statusOptions={STATUS_OPTIONS}
        selectId="club-activity-sport"
        onStatus={(status) => onChange({ ...filters, status })}
        onSport={(sport) => onChange({ ...filters, sport })}
      />
    </div>
  )
}
