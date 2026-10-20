import type { AdminSession } from '@/api/attendance/admin-sessions'
import { Badge } from '@/components/ui/badge'
import { SessionRoster } from '@/features/admin/attendance/SessionRoster'
import { AttendanceScanner } from './AttendanceScanner'
import { isRetroactive, sessionWhen } from './coach-session-list'

export function CoachSessionCatalog({ session }: { session: AdminSession }) {
  return (
    <div className="space-y-3">
      {isRetroactive(session) && <Badge variant="outline">Pontare retroactivă</Badge>}
      <AttendanceScanner
        occurrenceId={session.id}
        label={`${session.courseName} · ${sessionWhen(session)}`}
      />
      <SessionRoster
        courseId={session.courseId}
        occurrenceId={session.id}
        listKey="coach-sessions"
        qrLinks
      />
    </div>
  )
}
