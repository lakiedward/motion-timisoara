import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { getCurrentLocationOccurrences } from '@/api/live-location'
import { getActiveLocationSessions } from '@/api/live-location/discovery'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { LocationViewer } from './LocationViewer'
import { SessionRowItem } from './SessionRowItem'
import { VISIBLE_SESSIONS, buildSessionRows, type CourseInfo } from './current-sessions'

export function CurrentLocationSessions({
  courses,
  courseSource,
}: {
  courses: CourseInfo[]
  courseSource: { isLoading: boolean; isError: boolean; retry: () => void }
}) {
  const { user } = useAuth()
  const [selection, setSelection] = useState<{ actor: string; occurrence: string } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const ids = [...new Set(courses.map((course) => course.id))].sort()
  const club = user?.role === 'CLUB'
  const ready = club && ids.length > 0 && !courseSource.isLoading && !courseSource.isError
  const occurrences = useQuery({
    queryKey: ['live-location-occurrences', user?.id, ids],
    queryFn: () => getCurrentLocationOccurrences(ids),
    enabled: ready,
    retry: false,
    refetchInterval: 30_000,
  })
  const hasOccurrences = (occurrences.data?.length ?? 0) > 0
  const sessions = useQuery({
    queryKey: ['active-location-sessions', user?.id],
    queryFn: () => getActiveLocationSessions(user!.id),
    enabled: ready && hasOccurrences,
    retry: false,
    refetchInterval: 15_000,
  })
  if (!club) return null
  if (!courseSource.isLoading && !courseSource.isError && ids.length === 0) return null
  const selected = selection?.actor === user.id ? selection.occurrence : null
  const loading =
    courseSource.isLoading || occurrences.isLoading || (hasOccurrences && sessions.isLoading)
  const error = courseSource.isError || occurrences.isError || sessions.isError
  const rows = buildSessionRows(occurrences.data ?? [], courses, sessions.data ?? [])
  const live = rows.length > 0
  const visible = showAll ? rows : rows.slice(0, VISIBLE_SESSIONS)
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
          className="border-t py-8"
          onRetry={() => {
            if (courseSource.isError) courseSource.retry()
            if (occurrences.isError) void occurrences.refetch()
            if (sessions.isError) void sessions.refetch()
          }}
        />
      ) : null}
      {!loading && !error && live && (
        <>
          <ul className="divide-y border-t">
            {visible.map((row) => {
              const open = selected === row.occurrence.id
              return (
                <SessionRowItem
                  key={row.occurrence.id}
                  row={row}
                  open={open}
                  viewerKey={`${user.id}:${row.occurrence.id}`}
                  onToggle={() =>
                    setSelection(open ? null : { actor: user.id, occurrence: row.occurrence.id })
                  }
                />
              )
            })}
          </ul>
          {rows.length > VISIBLE_SESSIONS && (
            <div className="border-t px-4 py-2 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                className="text-primary h-11 min-h-11 w-full sm:w-auto"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? 'Arată mai puține' : `Arată toate (${rows.length})`}
              </Button>
            </div>
          )}
        </>
      )}
      {selected && !rows.some((row) => row.occurrence.id === selected) && (
        <LocationViewer
          key={`${user.id}:${selected}`}
          occurrenceId={selected}
          className="border-t px-4 py-4 sm:px-6 sm:pb-6"
        />
      )}
    </section>
  )
}
