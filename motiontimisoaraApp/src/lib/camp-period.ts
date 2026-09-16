import { plural } from '@/lib/plural'

const ISO = /^\d{4}-\d{2}-\d{2}$/

function toLocal(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toIso(date: Date): string {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function campIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = toLocal(value)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function campInclusiveDayCount(start: string, end: string): number | null {
  if (!campIsoDate(start) || !campIsoDate(end) || end < start) return null
  return Math.round((toLocal(end).getTime() - toLocal(start).getTime()) / 86_400_000) + 1
}

export function addCampInclusiveDays(start: string, days: number): string {
  const date = toLocal(start)
  date.setDate(date.getDate() + (days - 1))
  return toIso(date)
}

export function campPeriodDurationLabel(start: string, end: string): string | null {
  const zile = campInclusiveDayCount(start, end)
  if (zile == null) return null
  return plural(zile, 'zi', 'zile')
}
