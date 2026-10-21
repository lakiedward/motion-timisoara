import type { AttendanceRow, CampAttendanceRow } from '@/api/account'
import { plural } from '@/lib/plural'

export type AttendanceKind = 'COURSE' | 'CAMP'

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

export type AttendanceEntry = CourseEntry | CampEntry

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

export function attendanceEntries(
  courses: AttendanceRow[],
  camps: CampAttendanceRow[],
  from: Date | null,
): AttendanceEntry[] {
  return [...courses.map(courseEntry), ...camps.map(campEntry)]
    .filter((e) => !from || (e.date !== null && e.date >= from))
    .sort((a, b) => +(b.date ?? 0) - +(a.date ?? 0))
}

const KIND_COUNT: Record<AttendanceKind, [string, string]> = {
  COURSE: ['ședință de curs', 'ședințe de curs'],
  CAMP: ['tabără', 'tabere'],
}

export function kindBreakdown(entries: AttendanceEntry[]): string {
  const order: AttendanceKind[] = ['COURSE', 'CAMP']
  return order
    .map((kind) => {
      const n = entries.filter((e) => e.kind === kind).length
      return n ? plural(n, KIND_COUNT[kind][0], KIND_COUNT[kind][1]) : null
    })
    .filter(Boolean)
    .join(', ')
}
