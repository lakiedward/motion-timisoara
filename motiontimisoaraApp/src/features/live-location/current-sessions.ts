import type { CurrentLocationOccurrence } from '@/api/live-location'
import type { ActiveLocationSession } from '@/api/live-location/discovery'

export const VISIBLE_SESSIONS = 3

const TZ = 'Europe/Bucharest'
const hourFormat = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TZ,
})

export type CourseInfo = { id: string; name: string; coachName: string | null }

export type SessionRow = {
  occurrence: CurrentLocationOccurrence
  courseName: string
  coachName: string | null
  sharing: boolean
}

export function formatHour(value: string | Date) {
  return hourFormat.format(typeof value === 'string' ? new Date(value) : value)
}

export function timeRange(startsAt: string, endsAt: string) {
  return `${formatHour(startsAt)}–${formatHour(endsAt)}`
}

export function buildSessionRows(
  occurrences: CurrentLocationOccurrence[],
  courses: CourseInfo[],
  sessions: ActiveLocationSession[],
  now = Date.now(),
): SessionRow[] {
  const byCourse = new Map(courses.map((course) => [course.id, course]))
  const shared = new Map(
    sessions
      .filter((session) => session.occurrenceId && Date.parse(session.expiresAt) > now)
      .map((session) => [session.occurrenceId!, session]),
  )
  return occurrences
    .map((occurrence) => {
      const course = byCourse.get(occurrence.course_id)
      const session = shared.get(occurrence.id)
      return {
        occurrence,
        courseName: course?.name ?? 'Ședință',
        coachName: session?.coachName ?? course?.coachName ?? null,
        sharing: !!session,
      }
    })
    .sort(
      (a, b) =>
        Number(b.sharing) - Number(a.sharing) ||
        Date.parse(b.occurrence.starts_at) - Date.parse(a.occurrence.starts_at),
    )
}
