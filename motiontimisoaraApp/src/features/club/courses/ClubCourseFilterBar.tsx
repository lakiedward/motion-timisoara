import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { FILTER_SELECT_CLASS } from '@/features/public/courses/CourseFilters'
import type { ClubCourseFilters, ClubStatusFilter } from './club-course-filters'

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
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Caută curs, locație sau antrenor"
            aria-label="Caută cursuri după nume, locație sau antrenor"
            className="h-touch-target pl-9"
          />
        </div>
        {coaches.length > 1 && (
          <div className="flex items-center gap-3 md:w-72">
            <Label htmlFor="club-course-coach" className="shrink-0">
              Antrenor
            </Label>
            <select
              id="club-course-coach"
              value={filters.coach}
              onChange={(e) => onChange({ ...filters, coach: e.target.value })}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">Toți antrenorii</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
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
