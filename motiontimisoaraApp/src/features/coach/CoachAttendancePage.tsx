import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'

import type { AdminSession } from '@/api/attendance/admin-sessions'
import { getCoachSessions, SESSION_GROUP_LIMIT } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import {
  NO_SESSION_FILTERS,
  countSessions,
  filterSessions,
  hasSessionFilters,
  sessionStatusCounts,
  sportCounts,
  type SessionStatus,
} from '@/features/admin/attendance/attendance-overview'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { CoachLocationPanel } from '@/features/live-location/CoachLocationPanel'
import { cn } from '@/lib/utils'
import { AttendanceOfflineQueue } from './attendance/AttendanceScanner'
import { CoachSessionCatalog } from './attendance/CoachSessionCatalog'
import { SessionDayList } from './attendance/SessionDayList'
import {
  nearestSession,
  recentPast,
  sessionWhen,
  splitByTime,
  toSessionList,
} from './attendance/coach-session-list'

const STATUS_OPTIONS: FilterOption<SessionStatus>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'unmarked', label: 'Nepontate' },
  { value: 'today', label: 'Azi' },
  { value: 'upcoming', label: 'Următoare' },
  { value: 'past', label: 'Trecute' },
]

const DEFAULT_FILTERS = { ...NO_SESSION_FILTERS, status: 'all' as SessionStatus }

export default function CoachAttendancePage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [markingOnPhone, setMarkingOnPhone] = useState(false)
  const [showOlder, setShowOlder] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['coach-sessions'],
    queryFn: getCoachSessions,
    retry: false,
  })
  const items = useMemo(() => toSessionList(data), [data])

  const { query, status } = filters
  const searching = query.trim().length > 0
  const counts = useMemo(() => sessionStatusCounts(items), [items])
  const sports = useMemo(
    () => sportCounts(filterSessions(items, { status, sport: '', query: '' })),
    [items, status],
  )
  const visible = useMemo(() => filterSessions(items, filters), [items, filters])
  const { upcoming, past } = splitByTime(visible)
  const recent = recentPast(past)
  const fold = !showOlder && !searching && status !== 'unmarked' && recent.length < past.length
  const shownPast = fold && (upcoming.length || recent.length) ? recent : past
  const olderCount = past.length - shownPast.length
  const listed = [...upcoming, ...shownPast]

  const sel = listed.find((s) => s.id === selectedId) ?? nearestSession(listed)

  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }))
  const select = (s: AdminSession) => {
    setSelectedId(s.id)
    setMarkingOnPhone(true)
  }

  const header = (
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
          placeholder="Caută curs sau locație"
          aria-label="Caută ședințe după curs sau locație"
          className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
        />
      </div>
    </div>
  )

  const filtered =
    visible.length === 0 ? (
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
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Șterge filtrele
            </Button>
          ) : null
        }
      />
    ) : (
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="min-w-0 space-y-3 lg:-mx-1.5 lg:max-h-[calc(100dvh-21rem)] lg:overflow-y-auto lg:px-1.5">
          {markingOnPhone && (
            <Button
              type="button"
              variant="ghost"
              className="h-touch-target min-h-touch-target -ml-2 md:hidden"
              onClick={() => setMarkingOnPhone(false)}
            >
              <ArrowLeft /> Înapoi la ședințe
            </Button>
          )}
          {[
            { title: 'Următoarele', list: upcoming },
            { title: 'Trecute', list: shownPast },
          ].map(({ title, list }) => (
            <SessionDayList
              key={title}
              title={title}
              items={list}
              query={query}
              selectedId={sel?.id ?? null}
              hideOthers={markingOnPhone}
              onSelect={select}
              renderInline={(s) =>
                markingOnPhone ? (
                  <div className="space-y-3 border-t p-3 md:hidden">
                    <CoachSessionCatalog session={s} />
                  </div>
                ) : null
              }
            />
          ))}
          {olderCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-touch-target min-h-touch-target w-full',
                markingOnPhone && 'hidden md:flex',
              )}
              onClick={() => setShowOlder(true)}
            >
              Vezi mai mult ({olderCount})
            </Button>
          )}
          {data?.truncated && (
            <p className="text-muted-foreground text-xs">
              Se afișează primele {SESSION_GROUP_LIMIT} de ședințe din fiecare grup. Ai mai multe
              ședințe decât atât.
            </p>
          )}
        </div>
        <div className="hidden min-w-0 md:block lg:max-h-[calc(100dvh-21rem)] lg:overflow-y-auto">
          {sel && (
            <div className="bg-card space-y-3 rounded-xl border px-4 pb-4">
              <h2 className="font-display text-foreground bg-card -mx-4 rounded-t-xl border-b px-4 py-3 font-bold lg:sticky lg:top-0 lg:z-10">
                <span className="line-clamp-2 wrap-anywhere">{sel.courseName}</span>
                <span className="text-muted-foreground block text-sm font-normal">
                  {sessionWhen(sel)}
                </span>
              </h2>
              <CoachSessionCatalog session={sel} />
            </div>
          )}
        </div>
      </div>
    )

  return (
    <div>
      {header}
      <CoachLocationPanel
        occurrenceId={sel?.id ?? null}
        startsAt={sel?.startsAt}
        endsAt={sel?.endsAt}
      />
      {!sel && !isLoading && <AttendanceOfflineQueue />}
      {isLoading ? (
        <ClubLocationListSkeleton />
      ) : isError && !items.length ? (
        <StatusView state="error" title="Nu am putut încărca ședințele." onRetry={() => refetch()} />
      ) : !items.length ? (
        <StatusView
          state="empty"
          title="Nicio ședință programată."
          text="Adaugă ședințe la cursurile tale."
          action={
            <Button asChild className="mt-3 h-touch-target min-h-touch-target">
              <Link to="/coach/courses">Mergi la Cursurile mele</Link>
            </Button>
          }
        />
      ) : (
        <>
          <CourseFilterBar
            status={status}
            sport={filters.sport}
            statusCounts={counts}
            sports={sports}
            statusOptions={STATUS_OPTIONS}
            selectId="coach-attendance-sport"
            onStatus={(s) => set({ status: s })}
            onSport={(sport) => set({ sport })}
          />
          <p role="status" className="text-muted-foreground mb-2 text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countSessions(items.length)}`
                : countSessions(listed.length))}
          </p>
          {filtered}
        </>
      )}
    </div>
  )
}
