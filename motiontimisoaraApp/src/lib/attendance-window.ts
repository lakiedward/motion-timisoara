const ATTENDANCE_LEAD_MS = 60 * 60_000

export function attendanceOpensAt(startsAt: string) {
  return Date.parse(startsAt) - ATTENDANCE_LEAD_MS
}
