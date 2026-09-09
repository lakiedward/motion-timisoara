import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMyEnrollments } from '@/api/account'
import { getCurrentLocationOccurrences } from '@/api/live-location'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { LocationViewer } from './LocationViewer'

export function CurrentLocationSessions({
  courseIds,
  courseNames = {},
}: {
  courseIds?: string[]
  courseNames?: Record<string, string>
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
  const ids = [
    ...new Set(
      courseIds ??
        enrollmentQuery.data
          ?.filter((entry) => entry.kind === 'COURSE')
          .map((entry) => entry.entity_id) ??
        [],
    ),
  ].sort()
  const occurrences = useQuery({
    queryKey: ['live-location-occurrences', user?.id, ids],
    queryFn: () => getCurrentLocationOccurrences(ids),
    enabled: !!user && ids.length > 0,
    retry: false,
    refetchInterval: 30_000,
  })
  if (!user || !['PARENT', 'CLUB'].includes(user.role)) return null
  const selected = selection?.actor === user.id ? selection.occurrence : null
  const loading = (parent && enrollmentQuery.isLoading) || occurrences.isLoading
  const error = (parent && enrollmentQuery.isError) || occurrences.isError
  return (
    <section
      className="bg-card mb-6 space-y-3 rounded-2xl border p-4"
      aria-label="Ședințe cu locație în timp real"
    >
      <h2 className="font-semibold">Ședințe cu locație în timp real</h2>
      <p className="text-muted-foreground text-sm">
        Alege ședința pentru a verifica dacă antrenorul partajează locația.
      </p>
      {loading ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : error ? (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-sm">Nu am putut încărca ședințele pentru locație.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (parent) void enrollmentQuery.refetch()
              void occurrences.refetch()
            }}
          >
            Reîncearcă ședințele
          </Button>
        </div>
      ) : occurrences.data?.length ? (
        <div className="flex flex-wrap gap-2">
          {occurrences.data.map((occurrence) => (
            <Button
              key={occurrence.id}
              type="button"
              variant={selected === occurrence.id ? 'default' : 'outline'}
              className="h-auto min-h-11 whitespace-normal text-left"
              aria-pressed={selected === occurrence.id}
              onClick={() => setSelection({ actor: user.id, occurrence: occurrence.id })}
            >
              {courseNames[occurrence.course_id] ?? 'Ședință'} ·{' '}
              {new Date(occurrence.starts_at).toLocaleString('ro-RO', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Nicio ședință în desfășurare.</p>
      )}
      {selected && <LocationViewer key={`${user.id}:${selected}`} occurrenceId={selected} />}
    </section>
  )
}
