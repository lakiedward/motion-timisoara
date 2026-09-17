import {
  COURSE_TIME_ZONE,
  type RecurrenceRule,
  type DaySchedule,
  normalizeTime,
  isEndAfterStart,
  parseRecurrenceRule,
  serializeRecurrenceRule,
} from './recurrence'

export const OCCURRENCE_HORIZON_WEEKS = 8

export type OccurrenceSlot = {
  startsAt: Date
  endsAt: Date
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const hour = map.hour === '24' ? 0 : Number(map.hour)
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = zoneParts(new Date(instantMs), timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return asUtc - instantMs
}

export function civilDateInZone(instant: Date, timeZone: string): string {
  const parts = zoneParts(instant, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function addCivilDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
}

export function isoWeekdayFromCivilDate(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

export function zonedCivilTimeToUtc(isoDate: string, time: string, timeZone: string): Date {
  const normalized = normalizeTime(time)
  const [year, month, day] = isoDate.split('-').map(Number)
  const [hour, minute] = normalized.split(':').map(Number)
  const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offset = zoneOffsetMs(wantedAsUtc, timeZone)
  let instant = wantedAsUtc - offset
  const adjusted = zoneOffsetMs(instant, timeZone)
  if (adjusted !== offset) instant = wantedAsUtc - adjusted
  return new Date(instant)
}

export function parseRecurrenceRuleJson(raw: string): RecurrenceRule {
  const program = parseRecurrenceRule(raw)
  const serialized = serializeRecurrenceRule(program)
  const parsed = JSON.parse(serialized) as RecurrenceRule
  if (!parsed.daySchedules || Object.keys(parsed.daySchedules).length === 0) {
    throw new Error('Selectează cel puțin o zi și completează orele.')
  }
  for (const [iso, slot] of Object.entries(parsed.daySchedules)) {
    if (!slot?.start || !slot?.end || !isEndAfterStart(slot.start, slot.end)) {
      throw new Error(`Program invalid pentru ziua ${iso}.`)
    }
  }
  return parsed
}

function slotForIso(rule: RecurrenceRule, iso: number): DaySchedule | null {
  return rule.daySchedules[String(iso)] ?? null
}

export function generateOccurrenceSlots(
  rule: RecurrenceRule,
  now: Date,
  timeZone = COURSE_TIME_ZONE,
  horizonWeeks = OCCURRENCE_HORIZON_WEEKS,
): OccurrenceSlot[] {
  const startDate = civilDateInZone(now, timeZone)
  const endDate = addCivilDays(startDate, horizonWeeks * 7)
  const slots: OccurrenceSlot[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const slot = slotForIso(rule, isoWeekdayFromCivilDate(cursor))
    if (slot) {
      const startsAt = zonedCivilTimeToUtc(cursor, slot.start, timeZone)
      const endsAt = zonedCivilTimeToUtc(cursor, slot.end, timeZone)
      if (startsAt.getTime() > now.getTime()) {
        slots.push({ startsAt, endsAt })
      }
    }
    cursor = addCivilDays(cursor, 1)
  }
  return slots
}
