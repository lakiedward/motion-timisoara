import { civilDateInZone, isoWeekdayFromCivilDate } from '@/lib/course-program/occurrences'
import {
  COURSE_TIME_ZONE,
  COURSE_WEEKDAYS,
  parseRecurrenceRule,
  selectedCourseProgramDays,
} from '@/lib/course-program/recurrence'

export type CourseSlot = { iso: number; start: string }

export type CatalogCourseFields = {
  recurrence_rule: string | null
  occurrences: { starts_at: string }[] | null
  price: number
  currency: string
  eur_ron_rate_micros: number | null
  sport: { code: string; name: string } | null
  location: { name: string } | null
}

export type CourseCatalogFilters = {
  sport: string
  day: string
  maxPrice: string
  location: string
}

export const EMPTY_COURSE_FILTERS: CourseCatalogFilters = {
  sport: '',
  day: '',
  maxPrice: '',
  location: '',
}

export const COURSE_PAGE_SIZE = 12

export const COURSE_PRICE_LIMITS = [20_000, 40_000, 60_000, 100_000]

const SHORT_WEEKDAYS: Record<number, string> = {
  1: 'Lu',
  2: 'Ma',
  3: 'Mi',
  4: 'Jo',
  5: 'Vi',
  6: 'Sâ',
  7: 'Du',
}

export const COURSE_DAY_OPTIONS = COURSE_WEEKDAYS.map((day) => ({
  value: String(day.iso),
  label: day.label,
}))

function startInZone(instant: Date): string {
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: COURSE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
}

export function courseSlots(
  course: Pick<CatalogCourseFields, 'recurrence_rule' | 'occurrences'>,
  now = new Date(),
): CourseSlot[] {
  const fromRule = selectedCourseProgramDays(parseRecurrenceRule(course.recurrence_rule)).map(
    (day) => ({ iso: day.iso, start: day.start }),
  )
  if (fromRule.length) return fromRule

  const unique = new Map<string, CourseSlot>()
  for (const occurrence of course.occurrences ?? []) {
    const instant = new Date(occurrence.starts_at)
    if (Number.isNaN(+instant) || instant < now) continue
    const iso = isoWeekdayFromCivilDate(civilDateInZone(instant, COURSE_TIME_ZONE))
    const start = startInZone(instant)
    unique.set(`${iso} ${start}`, { iso, start })
  }
  return [...unique.values()].sort((a, b) => a.iso - b.iso || a.start.localeCompare(b.start))
}

export function formatCourseSchedule(slots: CourseSlot[]): string | null {
  if (!slots.length) return null
  const byStart = new Map<string, number[]>()
  for (const slot of [...slots].sort((a, b) => a.iso - b.iso)) {
    const days = byStart.get(slot.start) ?? []
    if (!days.includes(slot.iso)) days.push(slot.iso)
    byStart.set(slot.start, days)
  }
  return [...byStart.entries()]
    .sort(([, a], [, b]) => a[0]! - b[0]!)
    .map(([start, days]) => `${days.map((iso) => SHORT_WEEKDAYS[iso]).join(', ')} · ${start}`)
    .join('; ')
}

export function monthlyPriceInRonBani(
  course: Pick<CatalogCourseFields, 'price' | 'currency' | 'eur_ron_rate_micros'>,
): number | null {
  if (course.currency === 'RON') return course.price
  if (course.currency === 'EUR' && course.eur_ron_rate_micros && course.eur_ron_rate_micros > 0)
    return Math.round((course.price * course.eur_ron_rate_micros) / 1_000_000)
  return null
}

export function courseLocationName(course: Pick<CatalogCourseFields, 'location'>): string | null {
  return course.location?.name.trim() || null
}

export function countActiveCourseFilters(filters: CourseCatalogFilters): number {
  return Object.values(filters).filter(Boolean).length
}

export function courseMatchesFilters(
  course: CatalogCourseFields,
  filters: CourseCatalogFilters,
  now = new Date(),
): boolean {
  if (filters.sport && course.sport?.code !== filters.sport) return false
  if (filters.location && courseLocationName(course) !== filters.location) return false
  if (filters.day && !courseSlots(course, now).some((slot) => String(slot.iso) === filters.day))
    return false
  if (filters.maxPrice) {
    const price = monthlyPriceInRonBani(course)
    if (price === null || price > Number(filters.maxPrice)) return false
  }
  return true
}

export function courseSportOptions(courses: CatalogCourseFields[]) {
  const sports = new Map<string, string>()
  for (const course of courses) if (course.sport) sports.set(course.sport.code, course.sport.name)
  return [...sports.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ro'))
}

export function courseLocationOptions(courses: CatalogCourseFields[]) {
  const names = new Set<string>()
  for (const course of courses) {
    const name = courseLocationName(course)
    if (name) names.add(name)
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'ro'))
    .map((name) => ({ value: name, label: name }))
}
