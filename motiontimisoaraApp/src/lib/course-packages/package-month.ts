const MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
]

export const MONTHLY = 'CALENDAR_MONTH'

export type PackageMonthOption = { value: string; label: string; range: string; lastDay: string }

function parts(month: string): [number, number] {
  const [year, index] = month.split('-').map(Number)
  return [year, index]
}

export function bucharestMonth(now: Date, offset = 0): string {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(formatted.find((part) => part.type === 'year')?.value)
  const month = Number(formatted.find((part) => part.type === 'month')?.value)
  const index = year * 12 + month - 1 + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export function daysInMonth(month: string): number {
  const [year, index] = parts(month)
  return new Date(Date.UTC(year, index, 0)).getUTCDate()
}

export function monthName(month: string): string {
  const [year, index] = parts(month)
  return `${MONTHS[index - 1]} ${year}`
}

export function lastDayLabel(month: string): string {
  const [year, index] = parts(month)
  return `${daysInMonth(month)} ${MONTHS[index - 1]} ${year}`
}

export function monthRange(month: string): string {
  const [year, index] = parts(month)
  return `1–${daysInMonth(month)} ${MONTHS[index - 1]} ${year}`
}

export function packageMonthOptions(now: Date = new Date()): PackageMonthOption[] {
  return [0, 1].map((offset) => {
    const value = bucharestMonth(now, offset)
    return {
      value,
      label:
        offset === 0
          ? `Luna aceasta (${monthName(value)})`
          : `Luna următoare (${monthName(value)})`,
      range: monthRange(value),
      lastDay: lastDayLabel(value),
    }
  })
}

export function dateLabel(isoDate: string): string {
  const [year, index, day] = isoDate.split('-').map(Number)
  return `${day} ${MONTHS[index - 1]} ${year}`
}
