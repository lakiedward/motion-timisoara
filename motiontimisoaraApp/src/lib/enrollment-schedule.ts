import type { OfferSchedule } from '@/api/enrollment-offers'

const TZ = 'Europe/Bucharest'
const dayTime = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})
const dayOnly = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const shortDay = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const fullDay = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function utcDay(iso: string): Date | null {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

export function scheduleLabel(schedule: OfferSchedule | null): string | null {
  if (!schedule) return null
  if (schedule.type === 'session' || schedule.type === 'moment') {
    const date = new Date(schedule.startsAt)
    if (Number.isNaN(date.getTime())) return null
    const text = capitalize(dayTime.format(date).replace(' la ', ', '))
    return schedule.type === 'session' ? `Următoarea ședință: ${text}` : text
  }
  if (schedule.type === 'period') {
    const start = utcDay(schedule.start)
    const end = utcDay(schedule.end)
    if (!start || !end) return null
    return `${shortDay.format(start)} – ${fullDay.format(end)}`
  }
  const day = utcDay(schedule.date)
  if (!day) return null
  const hours =
    schedule.startTime && schedule.endTime
      ? `, ${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)}`
      : ''
  return `${capitalize(dayOnly.format(day))}${hours}`
}
