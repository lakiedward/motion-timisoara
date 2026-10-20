import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { ADMIN_SESSION_WINDOW_DAYS, getAdminSessions } from '@/api/attendance/admin-sessions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { plural } from '@/lib/plural'
import { SessionGroupCard } from './SessionGroupCard'
import {
  NO_SESSION_FILTERS,
  countSessions,
  filterSessions,
  groupSessionsByOrganizer,
  hasSessionFilters,
  sessionStatusCounts,
  sportCounts,
  type SessionGroup,
  type SessionStatus,
} from './attendance-overview'

const STATUS_OPTIONS: FilterOption<SessionStatus>[] = [
  { value: 'unmarked', label: 'Nepontate' },
  { value: 'today', label: 'Azi' },
  { value: 'upcoming', label: 'Următoare' },
  { value: 'past', label: 'Trecute' },
  { value: 'all', label: 'Toate' },
]

const SECTION_LABEL = { club: 'Cluburi', coach: 'Antrenori independenți' } as const

export default function AdminAttendancePage() {
  const [filters, setFilters] = useState(NO_SESSION_FILTERS)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => getAdminSessions(),
    retry: false,
  })

  const { query, status } = filters
  const searching = query.trim().length > 0
  const counts = useMemo(() => sessionStatusCounts(items), [items])
  const sports = useMemo(
    () => sportCounts(filterSessions(items, { status, sport: '', query: '' })),
    [items, status],
  )
  const visible = useMemo(() => filterSessions(items, filters), [items, filters])
  const elsewhere = searching
    ? filterSessions(items, { ...filters, status: 'all' }).length - visible.length
    : 0
  const groups = useMemo(
    () => groupSessionsByOrganizer(items, visible, status),
    [items, visible, status],
  )
  const firstOpen = new Set(
    (['club', 'coach'] as const).map((k) => groups.find((g) => g.kind === k)?.key),
  )

  const toggleKey = (g: SessionGroup) => `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: SessionGroup) => toggled[toggleKey(g)] ?? (searching || firstOpen.has(g.key))
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }))
  const clear = () => set({ ...NO_SESSION_FILTERS, status: 'all' })

  const card = (g: SessionGroup) => (
    <SessionGroupCard
      key={g.key}
      group={g}
      query={query}
      open={isOpen(g)}
      expanded={expanded.has(g.key)}
      onOpenChange={(open) => setToggled((t) => ({ ...t, [toggleKey(g)]: open }))}
      onExpand={() => setExpanded((e) => new Set(e).add(g.key))}
    />
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">
          Prezență
          {items.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({items.length})
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
            placeholder="Caută curs, organizator sau locație"
            aria-label="Caută ședințe după curs, organizator, antrenor sau locație"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <ClubLocationListSkeleton />
      ) : isError && items.length === 0 ? (
        <StatusView
          state="error"
          title="Nu am putut încărca ședințele."
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <StatusView
          state="empty"
          title="Nicio ședință în ultimele și următoarele 30 de zile."
          text="Ședințele apar aici după ce cluburile și antrenorii își programează cursurile."
        />
      ) : (
        <>
          <CourseFilterBar
            status={status}
            sport={filters.sport}
            statusCounts={counts}
            sports={sports}
            statusOptions={STATUS_OPTIONS}
            selectId="admin-attendance-sport"
            onStatus={(s) => set({ status: s })}
            onSport={(sport) => set({ sport })}
          />
          <p role="status" className="text-muted-foreground text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countSessions(items.length)}`
                : `${countSessions(visible.length)} la ${plural(groups.length, 'organizator', 'organizatori')}`)}
            {visible.length > 0 &&
              ` · ultimele și următoarele ${ADMIN_SESSION_WINDOW_DAYS} de zile`}
            {elsewhere > 0 && (
              <>
                {' · '}
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

          {visible.length === 0 ? (
            <StatusView
              state="empty"
              title="Nicio ședință pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasSessionFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={clear}
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
                  <div className="grid gap-3">{ofKind.map(card)}</div>
                </section>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
