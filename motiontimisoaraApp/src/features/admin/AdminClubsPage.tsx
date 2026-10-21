import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'

import { getAllClubs, getAllCourses } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { CourseFilterBar } from './courses/CourseFilterBar'
import { ClubGroupCard } from './clubs/ClubGroupCard'
import { PendingClubsCard } from './clubs/PendingClubsCard'
import {
  NO_CLUB_FILTERS,
  clubCityCounts,
  filterClubs,
  groupClubs,
  hasClubFilters,
  summarizeClubs,
  type ClubGroup,
} from './clubs/club-overview'

const countClubs = (n: number) => plural(n, 'club', 'cluburi')

function LoadingState() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-4 h-5 w-64" />
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function AdminClubsPage() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [filters, setFilters] = useState(NO_CLUB_FILTERS)
  const [retrying, setRetrying] = useState(false)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const clubsQuery = useQuery({ queryKey: ['admin-clubs'], queryFn: getAllClubs, retry: false })
  const coursesQuery = useQuery({
    queryKey: ['admin-courses'],
    queryFn: getAllCourses,
    retry: false,
  })
  const clubs = useMemo(() => clubsQuery.data ?? [], [clubsQuery.data])
  const coursesKnown = coursesQuery.isSuccess

  const summaries = useMemo(
    () => summarizeClubs(clubs, coursesQuery.data ?? []),
    [clubs, coursesQuery.data],
  )
  const visible = useMemo(() => filterClubs(summaries, filters), [summaries, filters])
  const pending = useMemo(() => visible.filter((c) => !c.approved_at), [visible])
  const approved = useMemo(() => visible.filter((c) => c.approved_at), [visible])
  const cities = useMemo(() => clubCityCounts(summaries), [summaries])
  const groups = useMemo<ClubGroup[]>(
    () =>
      coursesKnown
        ? groupClubs(approved)
        : approved.length
          ? [{ key: 'all', name: 'Toate cluburile', clubs: approved }]
          : [],
    [approved, coursesKnown],
  )
  const withCourses = summaries.filter((c) => c.activeCourses > 0).length
  const query = filters.query
  const searching = query.trim().length > 0
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }))
  const toggleKey = (g: ClubGroup) => `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: ClubGroup, i: number) => toggled[toggleKey(g)] ?? (searching || i === 0)

  async function onRetry() {
    setRetrying(true)
    try {
      const result = await clubsQuery.refetch()
      if (!result.error) headingRef.current?.focus()
    } finally {
      setRetrying(false)
    }
  }

  const showError = clubs.length === 0 && (clubsQuery.isError || retrying)
  const loading = (clubsQuery.isLoading || coursesQuery.isLoading) && !showError

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-foreground mr-auto text-2xl font-bold break-words outline-none"
        >
          Cluburi
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
            placeholder="Caută după nume, oraș sau email"
            aria-label="Caută cluburi după nume, oraș sau email"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
        <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
          <Link to="/admin/codes">
            <Plus aria-hidden="true" /> Adaugă club
          </Link>
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : showError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca cluburile."
          onRetry={() => void onRetry()}
          retrying={retrying}
        />
      ) : clubs.length === 0 ? (
        <StatusView state="empty" title="Niciun club înregistrat." />
      ) : (
        <>
          <CourseFilterBar
            status="all"
            sport={filters.city}
            statusCounts={{ all: clubs.length }}
            sports={cities}
            statusOptions={[]}
            onStatus={() => {}}
            onSport={(city) => set({ city })}
            selectId="admin-club-city"
            sportLabel="Oraș"
            allSportsLabel="Toate orașele"
          />
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {visible.length > 0 &&
              (hasClubFilters(filters)
                ? `${visible.length} din ${countClubs(clubs.length)}`
                : coursesKnown
                  ? `${countClubs(clubs.length)}, ${withCourses} cu cursuri active`
                  : countClubs(clubs.length))}
          </p>

          {visible.length === 0 ? (
            <StatusView
              state="empty"
              title="Niciun club găsit."
              text="Schimbă căutarea sau filtrele."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="h-touch-target min-h-touch-target mt-3"
                  onClick={() => setFilters(NO_CLUB_FILTERS)}
                >
                  Șterge filtrele
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              <PendingClubsCard clubs={pending} query={query} coursesKnown={coursesKnown} />
              {groups.map((g, i) => (
                <ClubGroupCard
                  key={g.key}
                  group={g}
                  query={query}
                  coursesKnown={coursesKnown}
                  open={isOpen(g, i)}
                  expanded={expanded.has(g.key)}
                  onOpenChange={(open) => setToggled((t) => ({ ...t, [toggleKey(g)]: open }))}
                  onExpand={() => setExpanded((e) => new Set(e).add(g.key))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
