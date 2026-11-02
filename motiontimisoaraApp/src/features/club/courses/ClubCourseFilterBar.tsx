
import { Label } from '@/components/ui/label'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { SelectMenu } from '@/components/ui/select-menu'
import type { ClubCourseFilters, ClubStatusFilter } from './club-course-filters'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

const STATUS_OPTIONS: FilterOption<ClubStatusFilter>[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

type Option = { id: string; name: string; count: number }

export function ClubCourseFilterBar({
  filters,
  statusCounts,
  sports,
  coaches,
  onChange,
}: {
  filters: ClubCourseFilters
  statusCounts: Record<ClubStatusFilter, number>
  sports: Option[]
  coaches: Option[]
  onChange: (next: ClubCourseFilters) => void
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-col gap-2 md:flex-row">
        <FilterSearch
          className="flex-1"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Caută curs, locație sau antrenor"
          aria-label="Caută cursuri după nume, locație sau antrenor"
        />
        {coaches.length > 1 && (
          <div className="flex items-center gap-3 md:w-72">
            <Label htmlFor="club-course-coach" className="shrink-0">
              Antrenor
            </Label>
            <SelectMenu
              id="club-course-coach"
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
        selectId="club-course-sport"
        onStatus={(status) => onChange({ ...filters, status })}
        onSport={(sport) => onChange({ ...filters, sport })}
      />
    </div>
  )
}
