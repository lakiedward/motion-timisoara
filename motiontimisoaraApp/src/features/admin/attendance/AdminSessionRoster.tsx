import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { childAge } from '@/api/account'
import { AttendanceError, markAttendance, markManyPresent } from '@/api/attendance'
import type { AdminSession } from '@/api/attendance/admin-sessions'
import { getSessionRoster, type RosterEntry } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'

export function AdminSessionRoster({ session }: { session: AdminSession }) {
  const qc = useQueryClient()
  const roster = useQuery({
    queryKey: ['roster', session.id],
    queryFn: () => getSessionRoster(session.courseId, session.id),
    retry: false,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['roster', session.id] })
    qc.invalidateQueries({ queryKey: ['admin-sessions'] })
  }

  const mark = useMutation({
    mutationFn: ({
      childId,
      status,
    }: {
      childId: string
      childName: string
      status: RosterEntry['status']
    }) => markAttendance(session.id, childId, status),
    onSuccess: refresh,
    onError: (error, v) =>
      toast.error(
        `Nu am putut salva prezența pentru ${v.childName}.${error instanceof AttendanceError ? ` ${error.message}` : ''}`,
      ),
  })
  const markAll = useMutation({
    mutationFn: (childIds: string[]) => markManyPresent(session.id, childIds),
    onSuccess: refresh,
    onError: () => toast.error('Nu am putut marca toți copiii prezenți.'),
  })

  const rows = roster.data ?? []
  const busy = mark.isPending || markAll.isPending
  const unmarked = rows.filter((r) => r.status === null)

  if (roster.isLoading)
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
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
        Niciun copil înscris la acest curs încă.
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
        {rows.map((r) => (
          <li
            key={r.child_id}
            className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium wrap-anywhere">{r.child_name}</div>
              <div className="text-muted-foreground text-sm">
                {childAge(r.child_birth_date)} ani
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
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
                    className="h-touch-target min-h-touch-target flex-1 sm:flex-none lg:h-9 lg:min-h-9"
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
        ))}
      </ul>
    </div>
  )
}
