export const WEEKDAY_SHORT = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'] as const

export const MONTH_NAMES = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
] as const

export type MonthCursor = { year: number; month: number }

export type CalendarDay = { iso: string; day: number; inMonth: boolean }

const pad = (value: number) => String(value).padStart(2, '0')

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getMonth() === Number(match[2]) - 1 ? date : null
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

export function cursorFor(value: string | null | undefined, now: Date = new Date()): MonthCursor {
  const date = parseIsoDate(value) ?? now
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const index = cursor.year * 12 + cursor.month + delta
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 }
}

export function monthLabel(cursor: MonthCursor): string {
  return `${MONTH_NAMES[cursor.month]} ${cursor.year}`
}

export function monthGrid(cursor: MonthCursor): CalendarDay[] {
  const first = new Date(cursor.year, cursor.month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(cursor.year, cursor.month, 1 - offset)
  const weeks = Math.ceil((offset + new Date(cursor.year, cursor.month + 1, 0).getDate()) / 7)
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return {
      iso: toIsoDate(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === cursor.month,
    }
  })
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDateLabel(value: string | null | undefined): string {
  const date = parseIsoDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('ro-RO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateLong(value: string | null | undefined): string {
  const date = parseIsoDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function normalizeTime(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec((value ?? '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${pad(hours)}:${pad(minutes)}`
}

export function timeSlots(stepMinutes: number, from = '00:00', to = '23:59'): string[] {
  const start = toMinutes(from)
  const end = toMinutes(to)
  const slots: string[] = []
  for (let minutes = start; minutes <= end; minutes += stepMinutes) {
    slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  }
  return slots
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function splitDateTime(value: string | null | undefined): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value ?? '')
  return match ? { date: match[1], time: match[2] } : { date: '', time: '' }
}

export function joinDateTime(date: string, time: string): string {
  return date ? `${date}T${time}` : ''
}
