import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { childAge } from '@/api/account'
import { AttendanceError, markAttendance, markManyPresent } from '@/api/attendance'
import { getSessionRoster, type RosterEntry } from '@/api/coach'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'

export type RosterLook = 'list' | 'marked'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

export function SessionRoster({
  courseId,
  occurrenceId,
  listKey,
  qrLinks = false,
  look = 'list',
}: {
  courseId: string
  occurrenceId: string
  listKey: string
  qrLinks?: boolean
  look?: RosterLook
}) {
  const qc = useQueryClient()
  const roster = useQuery({
    queryKey: ['roster', occurrenceId],
    queryFn: () => getSessionRoster(courseId, occurrenceId),
    retry: false,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['roster', occurrenceId] })
    qc.invalidateQueries({ queryKey: [listKey] })
  }

  const mark = useMutation({
    mutationFn: ({
      childId,
      status,
    }: {
      childId: string
      childName: string
      status: RosterEntry['status']
    }) => markAttendance(occurrenceId, childId, status),
    onSuccess: refresh,
    onError: (error, v) =>
      toast.error(
        `Nu am putut salva prezența pentru ${v.childName}.${error instanceof AttendanceError ? ` ${error.message}` : ''}`,
      ),
  })
  const markAll = useMutation({
    mutationFn: (childIds: string[]) => markManyPresent(occurrenceId, childIds),
    onSuccess: refresh,
    onError: () => toast.error('Nu am putut marca toți copiii prezenți.'),
  })

  const rows = roster.data ?? []
  const busy = mark.isPending || markAll.isPending
  const unmarked = rows.filter((r) => r.status === null)

  if (roster.isLoading)
    return (
      <ul
        className="divide-y rounded-xl border"
        aria-busy="true"
        aria-label="Se încarcă lista de copii"
      >
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-4 w-16" />
              {qrLinks && <Skeleton className="h-4 w-14" />}
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-touch-target flex-1 rounded-full lg:h-9 lg:w-20 lg:flex-none" />
              <Skeleton className="h-touch-target flex-1 rounded-full lg:h-9 lg:w-20 lg:flex-none" />
            </div>
          </li>
        ))}
      </ul>
    )
  if (roster.isError && !rows.length)
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca lista de copii."
        onRetry={() => roster.refetch()}
      />
    )
  if (!rows.length)
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
        Niciun copil înscris la acest curs încă. Înscrierile le fac părinții din contul lor.
      </p>
    )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm" role="status">
          {rows.length - unmarked.length} din {plural(rows.length, 'copil', 'copii')} pontați
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9"
          disabled={busy || !unmarked.length}
          onClick={() => markAll.mutate(unmarked.map((r) => r.child_id))}
        >
          Toți prezenți
        </Button>
      </div>
      <ul className="divide-y rounded-xl border">
        {rows.map((r) => {
          const marked = look === 'marked'
          const qr = qrLinks && (
            <Link
              to={`/coach/children/${r.child_id}/qr`}
              className="text-primary inline-flex min-h-touch-target items-center text-sm underline-offset-4 hover:underline lg:min-h-0"
            >
              Cod QR
            </Link>
          )
          return (
            <li
              key={r.child_id}
              className={cn(
                'relative flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:justify-between',
                marked &&
                  'before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-xl',
                marked && r.status === 'PRESENT' && 'before:bg-success',
                marked && r.status === 'ABSENT' && 'before:bg-destructive',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                {marked && (
                  <Avatar aria-hidden="true">
                    <AvatarFallback>{initials(r.child_name)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0">
                  <div
                    className={cn(
                      'truncate font-medium',
                      !marked && 'lg:line-clamp-2 lg:whitespace-normal lg:break-words',
                    )}
                  >
                    {r.child_name}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
                    <span>{childAge(r.child_birth_date)} ani</span>
                    {marked && qr}
                  </div>
                  {!marked && qr}
                </div>
              </div>
              <div className="flex gap-3 lg:shrink-0 lg:gap-2">
                {(['PRESENT', 'ABSENT'] as const).map((status) => {
                  const active = r.status === status
                  return (
                    <Button
                      key={status}
                      type="button"
                      variant={
                        active ? (status === 'PRESENT' ? 'default' : 'destructive') : 'outline'
                      }
                      aria-pressed={active}
                      aria-label={`${status === 'PRESENT' ? 'Prezent' : 'Absent'}: ${r.child_name}`}
                      disabled={busy}
                      className="h-touch-target min-h-touch-target flex-1 lg:h-9 lg:min-h-9 lg:flex-none"
                      onClick={() =>
                        mark.mutate({
                          childId: r.child_id,
                          childName: r.child_name,
                          status: active ? null : status,
                        })
                      }
                    >
                      {status === 'PRESENT' ? 'Prezent' : 'Absent'}
                    </Button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
