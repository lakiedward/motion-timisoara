const TZ = 'Europe/Bucharest'

const instantDate = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
})

const instantTime = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatShortDate(value: string): string {
  const civil = CIVIL_DATE.exec(value)
  if (civil) return `${civil[3]}.${civil[2]}.${civil[1]}`
  return instantDate.format(new Date(value))
}

export function formatShortDateTime(value: string): string {
  return `${formatShortDate(value)}, ${instantTime.format(new Date(value))}`
}

export function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`
}

export function activityWhen(a: { activity_date: string; start_time: string; end_time: string }) {
  return `${formatShortDate(a.activity_date)} · ${formatTimeRange(a.start_time, a.end_time)}`
}
