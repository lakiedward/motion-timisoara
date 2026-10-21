import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AttendanceError } from '@/api/attendance'
import {
  getActivityRoster,
  markActivityAttendance,
  type ActivityAttendanceStatus,
} from '@/api/attendance/activity-attendance'
import { RosterList } from '@/features/admin/attendance/RosterList'

export function ActivityRoster({
  activityId,
  opensOn,
}: {
  activityId: string
  opensOn: string | null
}) {
  const qc = useQueryClient()
  const roster = useQuery({
    queryKey: ['activity-roster', activityId],
    queryFn: () => getActivityRoster(activityId),
    retry: false,
  })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['activity-roster', activityId] })
    void qc.invalidateQueries({ queryKey: ['activity-marks'] })
  }
  const mark = useMutation({
    mutationFn: (v: {
      childIds: string[]
      childName?: string
      status: ActivityAttendanceStatus | null
      onlyUnmarked?: boolean
    }) => markActivityAttendance(activityId, v.childIds, v.status, v.onlyUnmarked),
    onSuccess: refresh,
    onError: (error, v) =>
      toast.error(
        `${v.childName ? `Nu am putut salva prezența pentru ${v.childName}.` : 'Nu am putut marca toți copiii prezenți.'}${error instanceof AttendanceError ? ` ${error.message}` : ''}`,
      ),
  })

  return (
    <div className="space-y-3">
      {opensOn && (
        <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">
          Pontajul se deschide în ziua activității, {opensOn}.
        </p>
      )}
      <RosterList
        rows={roster.data ?? []}
        loading={roster.isLoading}
        error={roster.isError}
        onRetry={() => roster.refetch()}
        busy={mark.isPending || !!opensOn}
        emptyText="Niciun copil înscris la această activitate încă. Înscrierile le fac părinții din contul lor."
        onMark={(r, status) =>
          mark.mutate({ childIds: [r.child_id], childName: r.child_name, status })
        }
        onMarkAll={(childIds) => mark.mutate({ childIds, status: 'PRESENT', onlyUnmarked: true })}
      />
    </div>
  )
}
