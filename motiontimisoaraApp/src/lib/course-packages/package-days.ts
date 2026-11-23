import { dateLabel } from './package-month'

export function bucharestDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const { year, month, day } = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${year}-${month}-${day}`
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function daysPackageLastDay(days: number, now: Date = new Date()): string {
  return dateLabel(addDays(bucharestDate(now), days - 1))
}
