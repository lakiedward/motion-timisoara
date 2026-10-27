import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'

import { getToateTaberele } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { CampListSkeleton } from '@/features/camps/list/CampListSkeleton'
import { statusCounts, type CampStatusFilter } from '@/features/camps/list/camp-list'
import { CampOrganizerCard } from './CampOrganizerCard'
import {
  NO_ADMIN_CAMP_FILTERS,
  countCamps,
  filterAdminCamps,
  groupCampsByOrganizer,
  hasAdminCampFilters,
  organizerCounts,
  overviewLine,
  type AdminCampFilters,
  type CampOrganizerGroup,
} from './admin-camp-list'

const BAZA = '/admin/camps'

const STATUS_OPTIONS: FilterOption<CampStatusFilter>[] = [
  { value: 'ongoing', label: 'În desfășurare' },
  { value: 'upcoming', label: 'Viitoare' },
  { value: 'ended', label: 'Încheiate' },
  { value: 'all', label: 'Toate' },
]

const SECTION_LABEL = { club: 'Cluburi', coach: 'Antrenori independenți' } as const

export default function AdminCampsPage() {
  const [filters, setFilters] = useState<AdminCampFilters>(NO_ADMIN_CAMP_FILTERS)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const {
    data: camps = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['taberele-mele', 'admin'], queryFn: getToateTaberele })

  const { query, status } = filters
  const searching = query.trim().length > 0
  const counts = useMemo(() => statusCounts(camps), [camps])
  const organizers = useMemo(
    () => organizerCounts(filterAdminCamps(camps, { status, organizer: '', query: '' })),
    [camps, status],
  )
  const visible = useMemo(() => filterAdminCamps(camps, filters), [camps, filters])
  const elsewhere = searching
    ? filterAdminCamps(camps, { ...filters, status: 'all' }).length - visible.length
    : 0
  const groups = useMemo(() => groupCampsByOrganizer(camps, visible), [camps, visible])
  const firstOfKind = new Set(
    (['club', 'coach'] as const).map((k) => groups.find((g) => g.kind === k)?.key),
  )

  const toggleKey = (g: CampOrganizerGroup) => `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: CampOrganizerGroup) =>
    toggled[toggleKey(g)] ?? (searching || firstOfKind.has(g.key))
  const set = (patch: Partial<AdminCampFilters>) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">
          Tabere
          {camps.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({camps.length})
            </span>
          )}
        </h1>
        <div className="relative order-last w-full md:order-none md:w-80">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Caută tabără sau organizator"
            aria-label="Caută tabere după nume, locație, club sau antrenor"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
        <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
          <Link to={`${BAZA}/new`}>
            <Plus aria-hidden="true" /> Tabără nouă
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <CampListSkeleton />
      ) : isError && !camps.length ? (
        <StatusView
          state="error"
          title="Nu am putut încărca taberele."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={isFetching ? undefined : () => void refetch()}
        />
      ) : !camps.length ? (
        <StatusView
          state="empty"
          title="Nicio tabără încă."
          text="Taberele cluburilor și ale antrenorilor apar aici."
          action={
            <Button asChild className="mt-3 h-touch-target min-h-touch-target">
              <Link to={`${BAZA}/new`}>
                <Plus aria-hidden="true" /> Creează prima tabără
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <CourseFilterBar
            status={status}
            sport={filters.organizer}
            statusCounts={counts}
            sports={organizers}
            statusOptions={STATUS_OPTIONS}
            selectId="admin-camp-organizer"
            sportLabel="Organizator"
            allSportsLabel="Toți organizatorii"
            onStatus={(s) => set({ status: s })}
            onSport={(o) => set({ organizer: o as AdminCampFilters['organizer'] })}
          />
          <p role="status" className="text-muted-foreground text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countCamps(camps.length)}`
                : overviewLine(groups, visible.length))}
            {elsewhere > 0 && (
              <>
                {visible.length > 0 && ' · '}
                <button
                  type="button"
                  onClick={() => set({ status: 'all' })}
                  className="text-primary inline-flex min-h-touch-target items-center font-semibold lg:min-h-0"
                >
                  {elsewhere === 1 ? 'Încă 1 rezultat' : `Încă ${elsewhere} rezultate`} în alte
                  filtre
                </button>
              </>
            )}
          </p>

          {!visible.length ? (
            <StatusView
              state="empty"
              title="Nicio tabără pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasAdminCampFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={() => setFilters(NO_ADMIN_CAMP_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            (['club', 'coach'] as const).map((kind) => {
              const ofKind = groups.filter((g) => g.kind === kind)
              if (!ofKind.length) return null
              return (
                <section key={kind} aria-label={SECTION_LABEL[kind]}>
                  <h2 className="text-muted-foreground mt-6 mb-2 text-xs font-semibold tracking-wider uppercase">
                    {SECTION_LABEL[kind]} · {ofKind.length}
                  </h2>
                  <div className="grid gap-3">
                    {ofKind.map((g) => (
                      <CampOrganizerCard
                        key={g.key}
                        group={g}
                        query={query}
                        open={isOpen(g)}
                        expanded={expanded.has(g.key)}
                        onOpenChange={(open) => setToggled((t) => ({ ...t, [toggleKey(g)]: open }))}
                        onExpand={() => setExpanded((e) => new Set(e).add(g.key))}
                      />
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
