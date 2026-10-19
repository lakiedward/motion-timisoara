import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { getMyEnrollments } from '@/api/account'
import { getCurrentLocationOccurrences } from '@/api/live-location'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { LocationViewer } from './LocationViewer'

const TZ = 'Europe/Bucharest'
const zi = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', timeZone: TZ })
const ziSaptamana = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', timeZone: TZ })
const ora = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

export function CurrentLocationSessions({
  courseIds,
  courseNames,
  courseSource,
}: {
  courseIds?: string[]
  courseNames?: Record<string, string>
  courseSource?: { isLoading: boolean; isError: boolean; retry: () => void }
}) {
  const { user } = useAuth()
  const parent = user?.role === 'PARENT'
  const [selection, setSelection] = useState<{ actor: string; occurrence: string } | null>(null)
  const enrollmentQuery = useQuery({
    queryKey: ['live-location-enrollments', user?.id],
    queryFn: getMyEnrollments,
    enabled: parent,
    retry: false,
  })
  const activeCourses =
    enrollmentQuery.data?.filter((entry) => entry.kind === 'COURSE' && entry.status === 'ACTIVE') ??
    []
  const ids = [...new Set(courseIds ?? activeCourses.map((entry) => entry.entity_id))].sort()
  const names =
    courseNames ??
    Object.fromEntries(
      activeCourses.flatMap((entry) =>
        entry.offerTitle ? [[entry.entity_id, entry.offerTitle]] : [],
      ),
    )
  const occurrences = useQuery({
    queryKey: ['live-location-occurrences', user?.id, ids],
    queryFn: () => getCurrentLocationOccurrences(ids),
    enabled: !!user && ids.length > 0 && !courseSource?.isLoading && !courseSource?.isError,
    retry: false,
    refetchInterval: 30_000,
  })
  if (!user || !['PARENT', 'CLUB'].includes(user.role)) return null
  const selected = selection?.actor === user.id ? selection.occurrence : null
  const loading =
    courseSource?.isLoading || (parent && enrollmentQuery.isLoading) || occurrences.isLoading
  const error = courseSource?.isError || (parent && enrollmentQuery.isError) || occurrences.isError
  const list = occurrences.data ?? []
  const live = list.length > 0
  return (
    <section
      className="bg-card mb-6 overflow-hidden rounded-xl border"
      aria-label="Ședințe cu locație în timp real"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:px-6">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          <MapPin className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Locația antrenorului</h2>
          {!loading && !error && !live ? (
            <>
              <p className="text-sm font-medium">Nicio ședință în desfășurare.</p>
              <p className="text-muted-foreground text-sm">
                Când antrenorul pornește partajarea locației la o ședință, o deschizi de aici.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {live
                ? 'Alege ședința ca să vezi unde este antrenorul acum.'
                : 'Vezi unde este antrenorul în timpul ședinței.'}
            </p>
          )}
        </div>
      </div>
      {loading ? (
        <div role="status" aria-label="Se încarcă ședințele" className="px-4 pb-4 sm:px-6">
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : error ? (
        <StatusView
          state="error"
          title="Nu am putut încărca ședințele pentru locație."
          text="Verifică conexiunea și încearcă din nou."
          retryLabel="Reîncearcă ședințele"
          className="border-t py-8"
          onRetry={() => {
            if (courseSource?.isError) courseSource.retry()
            else if (parent && enrollmentQuery.isError) void enrollmentQuery.refetch()
            else void occurrences.refetch()
          }}
        />
      ) : null}
      {!loading && !error && live && (
        <ul className="divide-y border-t">
          {list.map((occurrence) => {
            const start = new Date(occurrence.starts_at)
            const open = selected === occurrence.id
            const Icon = open ? ChevronDown : ChevronRight
            return (
              <li key={occurrence.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  className="hover:bg-muted/50 focus-visible:outline-ring flex min-h-touch-target w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-6"
                  onClick={() =>
                    setSelection(open ? null : { actor: user.id, occurrence: occurrence.id })
                  }
                >
                  <span
                    aria-hidden="true"
                    className="bg-secondary flex size-12 shrink-0 flex-col items-center justify-center rounded-lg text-center leading-none"
                  >
                    <span className="font-display text-lg font-extrabold">{zi.format(start)}</span>
                    <span className="text-muted-foreground text-[0.6875rem] uppercase">
                      {ziSaptamana.format(start).replace('.', '')}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {names[occurrence.course_id] ?? 'Ședință'}
                    </span>
                    <span className="text-muted-foreground block text-sm">
                      A început la {ora.format(start)}
                    </span>
                  </span>
                  <span className="text-primary flex shrink-0 items-center gap-1 text-sm font-semibold">
                    <span className="hidden sm:inline">{open ? 'Ascunde' : 'Vezi locația'}</span>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                </button>
                {open && (
                  <LocationViewer
                    key={`${user.id}:${selected}`}
                    occurrenceId={selected}
                    className="px-4 pt-1 pb-4 sm:px-6 sm:pb-6"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
      {selected && !list.some((occurrence) => occurrence.id === selected) && (
        <LocationViewer
          key={`${user.id}:${selected}`}
          occurrenceId={selected}
          className="border-t px-4 py-4 sm:px-6 sm:pb-6"
        />
      )}
    </section>
  )
}
