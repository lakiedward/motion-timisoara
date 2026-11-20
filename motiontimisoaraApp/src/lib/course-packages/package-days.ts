import { dateLabel } from './package-month'

export function bucharestDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(now)
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function daysPackageLastDay(days: number, now: Date = new Date()): string {
  return dateLabel(addDays(bucharestDate(now), days - 1))
}
