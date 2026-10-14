import { civilDateInZone, isoWeekdayFromCivilDate } from '@/lib/course-program/occurrences'
import {
  COURSE_TIME_ZONE,
  parseRecurrenceRule,
  selectedCourseProgramDays,
  weekdayLabel,
} from '@/lib/course-program/recurrence'

export const COURSE_SESSION_LIMIT = 8

type Occurrence = { id: string; starts_at: string; ends_at: string | null }

export type CourseSession = { id: string; weekday: string; date: string; time: string }

export type WeeklySlot = { iso: number; start: string; end: string }

const clockFormat = new Intl.DateTimeFormat('ro-RO', {
  timeZone: COURSE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dateFormat = new Intl.DateTimeFormat('ro-RO', {
  timeZone: COURSE_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function validDate(value: string | null): Date | null {
  if (!value) return null
  const instant = new Date(value)
  return Number.isNaN(+instant) ? null : instant
}

function timeRange(start: Date, end: Date | null): string {
  const from = clockFormat.format(start)
  return end && end > start ? `${from}–${clockFormat.format(end)}` : from
}

export function upcomingSessions(
  occurrences: Occurrence[] | null | undefined,
  now = new Date(),
  limit = COURSE_SESSION_LIMIT,
): CourseSession[] {
  return (occurrences ?? [])
    .map((occurrence) => ({
      id: occurrence.id,
      start: validDate(occurrence.starts_at),
      end: validDate(occurrence.ends_at),
    }))
    .filter((s): s is { id: string; start: Date; end: Date | null } => s.start !== null)
    .filter((s) => (s.end && s.end > s.start ? s.end : s.start) > now)
    .sort((a, b) => +a.start - +b.start)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      weekday: weekdayLabel(isoWeekdayFromCivilDate(civilDateInZone(s.start, COURSE_TIME_ZONE))),
      date: dateFormat.format(s.start),
      time: timeRange(s.start, s.end),
    }))
}

export function weeklyProgram(
  course: { recurrence_rule: string | null; occurrences: Occurrence[] | null | undefined },
  now = new Date(),
): WeeklySlot[] {
  const fromRule = selectedCourseProgramDays(parseRecurrenceRule(course.recurrence_rule)).map(
    (day) => ({ iso: day.iso, start: day.start, end: day.end }),
  )
  if (fromRule.length) return fromRule

  const unique = new Map<string, WeeklySlot>()
  for (const occurrence of course.occurrences ?? []) {
    const start = validDate(occurrence.starts_at)
    if (!start || start < now) continue
    const end = validDate(occurrence.ends_at)
    const slot = {
      iso: isoWeekdayFromCivilDate(civilDateInZone(start, COURSE_TIME_ZONE)),
      start: clockFormat.format(start),
      end: end && end > start ? clockFormat.format(end) : '',
    }
    unique.set(`${slot.iso} ${slot.start} ${slot.end}`, slot)
  }
  return [...unique.values()].sort((a, b) => a.iso - b.iso || a.start.localeCompare(b.start))
}

export function formatWeeklyProgram(slots: WeeklySlot[]): string | null {
  if (!slots.length) return null
  return slots
    .map((slot) => `${weekdayLabel(slot.iso)} ${slot.end ? `${slot.start}–${slot.end}` : slot.start}`)
    .join(' · ')
}

export function descriptionParagraphs(text: string): string[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : [text]
}
