
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { TIPURI_ALERTA } from './child-alerts'
import type { AlertFilter, ArrivalFilter, ParticipantFilters } from './participant-list'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'

const ARRIVAL_LABELS: Record<Exclude<ArrivalFilter, ''>, string> = {
  pending: 'Neconfirmați',
  arrived: 'Sosiți',
  departed: 'Plecați',
}

export function ParticipantFilterBar({
  filters,
  alertCounts,
  arrivalCounts,
  onChange,
}: {
  filters: ParticipantFilters
  alertCounts: Record<AlertFilter, number>
  arrivalCounts: Record<Exclude<ArrivalFilter, ''>, number> | null
  onChange: (next: ParticipantFilters) => void
}) {
  const alertOptions: FilterOption<AlertFilter>[] = [
    { value: 'all', label: 'Toți' },
    ...TIPURI_ALERTA.filter((t) => alertCounts[t.cheie] > 0 || filters.alert === t.cheie).map(
      (t) => ({ value: t.cheie, label: t.eticheta }),
    ),
  ]
  const arrivals = arrivalCounts
    ? (Object.keys(ARRIVAL_LABELS) as Exclude<ArrivalFilter, ''>[]).map((k) => ({
        id: k,
        name: ARRIVAL_LABELS[k],
        count: arrivalCounts[k],
      }))
    : []

  return (
    <div className="mb-4 space-y-2">
      <FilterSearch
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Caută participant sau contact"
        aria-label="Caută participanți după nume, contact sau telefon"
      />
      <CourseFilterBar
        status={filters.alert}
        sport={filters.arrival}
        statusCounts={alertCounts}
        sports={arrivals}
        statusOptions={alertOptions}
        onStatus={(alert) => onChange({ ...filters, alert })}
        onSport={(arrival) => onChange({ ...filters, arrival: arrival as ArrivalFilter })}
        selectId="camp-participant-arrival"
        sportLabel="Sosire"
        allSportsLabel="Oricare sosire"
        statusLabel="De știut"
      />
    </div>
  )
}
