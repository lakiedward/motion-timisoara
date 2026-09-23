import { zonedCivilTimeToUtc } from '@/lib/course-program/occurrences'

export const COMPETITION_TIME_ZONE = 'Europe/Bucharest'

const publicDateTime = new Intl.DateTimeFormat('ro-RO', {
  timeZone: COMPETITION_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatCompetitionDateTime(value: string): string {
  return publicDateTime.format(new Date(value))
}

export type CompetitionScheduleFields = {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  registrationDeadlineDate: string
  registrationDeadlineTime: string
}

export type CompetitionSchedule = {
  start_at: string
  end_at: string
  registration_deadline_at: string
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function partsInBucharest(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: COMPETITION_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

function instantFromFields(date: string, time: string): Date {
  if (!validDate(date) || !validTime(time)) {
    throw new Error('Completează datele și orele concursului.')
  }
  const instant = zonedCivilTimeToUtc(date, time, COMPETITION_TIME_ZONE)
  const roundTrip = partsInBucharest(instant)
  if (roundTrip.date !== date || roundTrip.time !== time) {
    throw new Error('Ora aleasă nu există în fusul orar București.')
  }
  return instant
}

export function competitionScheduleFromFields(
  fields: CompetitionScheduleFields,
): CompetitionSchedule {
  const start = instantFromFields(fields.startDate, fields.startTime)
  const end = instantFromFields(fields.endDate, fields.endTime)
  const registrationDeadline = instantFromFields(
    fields.registrationDeadlineDate,
    fields.registrationDeadlineTime,
  )
  if (end <= start) throw new Error('Sfârșitul concursului trebuie să fie după început.')
  if (registrationDeadline > start) {
    throw new Error('Înscrierile trebuie să se închidă cel târziu la începutul concursului.')
  }
  return {
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    registration_deadline_at: registrationDeadline.toISOString(),
  }
}

export function competitionScheduleToFields(schedule: {
  start_at?: string | null
  end_at?: string | null
  registration_deadline_at?: string | null
}): CompetitionScheduleFields {
  const start = schedule.start_at ? partsInBucharest(new Date(schedule.start_at)) : null
  const end = schedule.end_at ? partsInBucharest(new Date(schedule.end_at)) : null
  const deadline = schedule.registration_deadline_at
    ? partsInBucharest(new Date(schedule.registration_deadline_at))
    : null
  return {
    startDate: start?.date ?? '',
    startTime: start?.time ?? '',
    endDate: end?.date ?? '',
    endTime: end?.time ?? '',
    registrationDeadlineDate: deadline?.date ?? '',
    registrationDeadlineTime: deadline?.time ?? '',
  }
}
