import type { AdminSession } from '@/api/attendance/admin-sessions'
import { Badge } from '@/components/ui/badge'
import { SessionOpensNotice } from '@/features/admin/attendance/SessionOpensNotice'
import { SessionRoster } from '@/features/admin/attendance/SessionRoster'
import { useAttendanceOpen } from '@/features/admin/attendance/use-attendance-open'
import { AttendanceScanner } from './AttendanceScanner'
import { isRetroactive, sessionWhen } from './coach-session-list'

export function CoachSessionCatalog({ session }: { session: AdminSession }) {
  const attendanceOpen = useAttendanceOpen(session.startsAt)
  return (
    <div className="space-y-3">
      {isRetroactive(session) && <Badge variant="outline">Pontare retroactivă</Badge>}
      {!attendanceOpen && <SessionOpensNotice startsAt={session.startsAt} />}
      <AttendanceScanner
        occurrenceId={session.id}
        label={`${session.courseName} · ${sessionWhen(session)}`}
        locked={!attendanceOpen}
      />
      <SessionRoster
        courseId={session.courseId}
        occurrenceId={session.id}
        startsAt={session.startsAt}
        listKey="coach-sessions"
        locked={!attendanceOpen}
        qrLinks
      />
    </div>
  )
}
