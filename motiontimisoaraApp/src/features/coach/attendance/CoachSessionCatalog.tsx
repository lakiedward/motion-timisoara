import type { AdminSession } from '@/api/attendance/admin-sessions'
import { Badge } from '@/components/ui/badge'
import { SessionOpensNotice } from '@/features/admin/attendance/SessionOpensNotice'
import { SessionRoster } from '@/features/admin/attendance/SessionRoster'
import { useSessionStarted } from '@/features/admin/attendance/use-session-started'
import { AttendanceScanner } from './AttendanceScanner'
import { isRetroactive, sessionWhen } from './coach-session-list'

export function CoachSessionCatalog({ session }: { session: AdminSession }) {
  const started = useSessionStarted(session.startsAt)
  return (
    <div className="space-y-3">
      {isRetroactive(session) && <Badge variant="outline">Pontare retroactivă</Badge>}
      {!started && <SessionOpensNotice startsAt={session.startsAt} />}
      <AttendanceScanner
        occurrenceId={session.id}
        label={`${session.courseName} · ${sessionWhen(session)}`}
        locked={!started}
      />
      <SessionRoster
        courseId={session.courseId}
        occurrenceId={session.id}
        listKey="coach-sessions"
        locked={!started}
        qrLinks
      />
    </div>
  )
}
