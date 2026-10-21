import type { AttendanceRow, CampAttendanceRow } from '@/api/account'
import type { ActivityAttendanceRow } from '@/api/attendance/activity-attendance'
import { plural } from '@/lib/plural'

export type AttendanceKind = 'COURSE' | 'CAMP' | 'ACTIVITY'

interface EntryBase {
  id: string
  childId: string
  date: Date | null
  title: string
  present: boolean
}

export interface CourseEntry extends EntryBase {
  kind: 'COURSE'
  note: string | null
}

export interface CampEntry extends EntryBase {
  kind: 'CAMP'
  periodStart: string
  periodEnd: string
  departedAt: Date | null
}

export interface ActivityEntry extends EntryBase {
  kind: 'ACTIVITY'
}

export type AttendanceEntry = CourseEntry | CampEntry | ActivityEntry

export function courseEntry(r: AttendanceRow): CourseEntry {
  return {
    kind: 'COURSE',
    id: r.id,
    childId: r.child_id,
    date: r.occurrence?.starts_at ? new Date(r.occurrence.starts_at) : null,
    title: r.occurrence?.course?.name ?? 'Ședință',
    present: r.status === 'PRESENT',
    note: r.note,
  }
}

export function campEntry(r: CampAttendanceRow): CampEntry {
  return {
    kind: 'CAMP',
    id: r.id,
    childId: r.child_id,
    date: new Date(r.arrived_at),
    title: r.camp_title || 'Tabără',
    present: true,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    departedAt: r.departed_at ? new Date(r.departed_at) : null,
  }
}

export function bucharestDate(day: string, time: string) {
  const guess = new Date(`${day}T${time.slice(0, 8)}Z`)
  const shown = new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(guess.getTime() - (shown.getTime() - utc.getTime()))
}

export function activityEntry(r: ActivityAttendanceRow): ActivityEntry {
  return {
    kind: 'ACTIVITY',
    id: r.id,
    childId: r.child_id,
    date: r.activity ? bucharestDate(r.activity.activity_date, r.activity.start_time) : null,
    title: r.activity?.name || 'Activitate',
    present: r.status === 'PRESENT',
  }
}

export function attendanceEntries(
  courses: AttendanceRow[],
  camps: CampAttendanceRow[],
  from: Date | null,
  activities: ActivityAttendanceRow[] = [],
): AttendanceEntry[] {
  return [...courses.map(courseEntry), ...camps.map(campEntry), ...activities.map(activityEntry)]
    .filter((e) => !from || (e.date !== null && e.date >= from))
    .sort((a, b) => +(b.date ?? 0) - +(a.date ?? 0))
}

const KIND_COUNT: Record<AttendanceKind, [string, string]> = {
  COURSE: ['ședință de curs', 'ședințe de curs'],
  CAMP: ['tabără', 'tabere'],
  ACTIVITY: ['activitate', 'activități'],
}

export function kindBreakdown(entries: AttendanceEntry[]): string {
  const order: AttendanceKind[] = ['COURSE', 'ACTIVITY', 'CAMP']
  return order
    .map((kind) => {
      const n = entries.filter((e) => e.kind === kind).length
      return n ? plural(n, KIND_COUNT[kind][0], KIND_COUNT[kind][1]) : null
    })
    .filter(Boolean)
    .join(', ')
}
