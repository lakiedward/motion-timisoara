import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AttendanceError, markAttendance, markManyPresent } from '@/api/attendance'
import { getSessionRoster, type RosterEntry } from '@/api/coach'
import { RosterList } from './RosterList'

export function SessionRoster({
  courseId,
  occurrenceId,
  listKey,
  qrLinks = false,
}: {
  courseId: string
  occurrenceId: string
  listKey: string
  qrLinks?: boolean
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

  return (
    <RosterList
      rows={roster.data ?? []}
      loading={roster.isLoading}
      error={roster.isError}
      onRetry={() => roster.refetch()}
      busy={mark.isPending || markAll.isPending}
      qrLinks={qrLinks}
      emptyText="Niciun copil înscris la acest curs încă. Înscrierile le fac părinții din contul lor."
      onMark={(r, status) =>
        mark.mutate({ childId: r.child_id, childName: r.child_name, status })
      }
      onMarkAll={(ids) => markAll.mutate(ids)}
    />
  )
}
