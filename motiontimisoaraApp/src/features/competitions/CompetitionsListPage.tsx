import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { getCompetitionList } from '@/api/competition/competition-list'
import { FilterSearch } from '@/components/catalog-filters/FilterSearch'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import type { CompetitionPortalBaza } from './competition-portal'
import { useCompetitionOwner } from './useCompetitionOwner'
import { CompetitionInvitations } from './CompetitionInvitations'
import { AdminCompetitionGroups } from './list/AdminCompetitionGroups'
import { CompetitionListSkeleton } from './list/CompetitionListSkeleton'
import { CompetitionRows } from './list/CompetitionRows'
import {
  NO_COMPETITION_FILTERS,
  countCompetitions,
  filterCompetitions,
  hasCompetitionFilters,
  organizerCounts,
  statusCounts,
  type CompetitionFilters,
  type CompetitionStatusFilter,
} from './list/competition-list'

const STATUS_OPTIONS: FilterOption<CompetitionStatusFilter>[] = [
  { value: 'ongoing', label: 'În desfășurare' },
  { value: 'upcoming', label: 'Viitoare' },
  { value: 'ended', label: 'Încheiate' },
  { value: 'all', label: 'Toate' },
]

export default function CompetitionsListPage({ baza }: { baza: CompetitionPortalBaza }) {
  const { owner, gata, eroare, reincearca } = useCompetitionOwner()
  const isAdmin = owner.role === 'ADMIN'
  const [filters, setFilters] = useState<CompetitionFilters>(NO_COMPETITION_FILTERS)
  const {
    data: items = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['concursurile-mele', 'lista', owner.role, owner.clubId, owner.coachUserId],
    queryFn: () => getCompetitionList(owner),
    enabled: gata,
  })

  const counts = useMemo(() => statusCounts(items), [items])
  const organizers = useMemo(
    () => organizerCounts(filterCompetitions(items, { ...filters, organizer: '', query: '' })),
    [items, filters],
  )
  const visible = useMemo(() => filterCompetitions(items, filters), [items, filters])
  const set = (patch: Partial<CompetitionFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const searching = filters.query.trim().length > 0

  const search = (
    <FilterSearch
      className={isAdmin ? 'order-last w-full md:order-none md:w-80' : undefined}
      value={filters.query}
      onChange={(e) => set({ query: e.target.value })}
      placeholder={isAdmin ? 'Caută concurs sau organizator' : 'Caută concurs sau locație'}
      aria-label={
        isAdmin
          ? 'Caută concursuri după nume, locație, club sau antrenor'
          : 'Caută concursuri după nume sau locație'
      }
    />
  )

  return (
    <div>
      {owner.role === 'COACH' && <CompetitionInvitations />}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">
          Concursuri
          {items.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({items.length})
            </span>
          )}
        </h1>
        {isAdmin && items.length > 0 && search}
        <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
          <Link to={`${baza}/new`}>
            <Plus aria-hidden="true" /> Concurs nou
          </Link>
        </Button>
      </div>

      {eroare || (isError && !items.length) ? (
        <StatusView
          state="error"
          title="Nu am putut încărca concursurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={eroare ? reincearca : isFetching ? undefined : () => void refetch()}
        />
      ) : !gata || isLoading ? (
        <CompetitionListSkeleton />
      ) : !items.length ? (
        <StatusView
          state="empty"
          title="Niciun concurs încă."
          text="Adaugă programul și locația, apoi traseele GPX și categoriile de vârstă."
          action={
            <Button asChild className="mt-3 h-touch-target min-h-touch-target">
              <Link to={`${baza}/new`}>
                <Plus aria-hidden="true" /> Creează primul concurs
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {!isAdmin && <div className="mb-2">{search}</div>}
          <CourseFilterBar
            status={filters.status}
            sport={filters.organizer}
            statusCounts={counts}
            sports={isAdmin ? organizers : []}
            statusOptions={STATUS_OPTIONS}
            selectId="competition-organizer"
            sportLabel="Organizator"
            allSportsLabel="Toți organizatorii"
            onStatus={(status) => set({ status })}
            onSport={(o) => set({ organizer: o as CompetitionFilters['organizer'] })}
          />
          {searching && visible.length > 0 && (
            <p role="status" className="text-muted-foreground mb-3 text-sm">
              {visible.length} din {countCompetitions(items.length)}
            </p>
          )}
          {!visible.length ? (
            <StatusView
              state="empty"
              title="Niciun concurs pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasCompetitionFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={() => setFilters(NO_COMPETITION_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : isAdmin ? (
            <AdminCompetitionGroups
              all={items}
              visible={visible}
              query={filters.query}
              baza={baza}
            />
          ) : (
            <CompetitionRows items={visible} baza={baza} />
          )}
        </>
      )}
    </div>
  )
}
