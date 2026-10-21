import type { ClubAnnouncement } from '@/api/club'
import { zonedCivilTimeToUtc } from '@/lib/course-program/occurrences'

const TZ = 'Europe/Bucharest'

export type ScheduleFields = {
  publishDate: string
  publishTime: string
  expiresDate: string
  expiresTime: string
}

export type Schedule = { publish_at: string | null; expires_at: string | null }

export type ScheduleState = 'scheduled' | 'expired' | 'live'

export const EMPTY_SCHEDULE: ScheduleFields = {
  publishDate: '',
  publishTime: '',
  expiresDate: '',
  expiresTime: '',
}

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const displayFormat = new Intl.DateTimeFormat('ro-RO', {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatMoment = (iso: string) => displayFormat.format(new Date(iso))

function inBucharest(iso: string): { date: string; time: string } {
  const v = Object.fromEntries(
    partsFormat.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]),
  )
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` }
}

export function scheduleToFields(a: Pick<ClubAnnouncement, 'publish_at' | 'expires_at'>) {
  const publish = a.publish_at ? inBucharest(a.publish_at) : null
  const expires = a.expires_at ? inBucharest(a.expires_at) : null
  return {
    publishDate: publish?.date ?? '',
    publishTime: publish?.time ?? '',
    expiresDate: expires?.date ?? '',
    expiresTime: expires?.time ?? '',
  }
}

function instant(date: string, time: string): Date | null {
  if (!date || !time) return null
  const at = zonedCivilTimeToUtc(date, time, TZ)
  return Number.isNaN(at.getTime()) ? null : at
}

export function scheduleFromFields(f: ScheduleFields): Schedule {
  return {
    publish_at: instant(f.publishDate, f.publishTime)?.toISOString() ?? null,
    expires_at: instant(f.expiresDate, f.expiresTime)?.toISOString() ?? null,
  }
}

export type ScheduleIssue = { field: keyof ScheduleFields; message: string }

export function scheduleIssues(
  f: ScheduleFields,
  { now = new Date(), initial = EMPTY_SCHEDULE }: { now?: Date; initial?: ScheduleFields } = {},
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = []
  if (f.publishTime && !f.publishDate) {
    issues.push({ field: 'publishDate', message: 'Alege și ziua publicării' })
  }
  if (f.publishDate && !f.publishTime) {
    issues.push({ field: 'publishTime', message: 'Alege și ora publicării' })
  }
  if (f.expiresTime && !f.expiresDate) {
    issues.push({ field: 'expiresDate', message: 'Alege și ziua expirării' })
  }
  if (f.expiresDate && !f.expiresTime) {
    issues.push({ field: 'expiresTime', message: 'Alege și ora expirării' })
  }
  if (issues.length) return issues
  const { publish_at, expires_at } = scheduleFromFields(f)
  if (!expires_at) return issues
  const expires = new Date(expires_at)
  const changed = f.expiresDate !== initial.expiresDate || f.expiresTime !== initial.expiresTime
  if (publish_at && expires <= new Date(publish_at)) {
    issues.push({ field: 'expiresDate', message: 'Expirarea trebuie să fie după publicare' })
  } else if (changed && expires <= now) {
    issues.push({ field: 'expiresDate', message: 'Alege un moment din viitor' })
  }
  return issues
}

export function scheduleState(
  a: Pick<ClubAnnouncement, 'publish_at' | 'expires_at'>,
  now = new Date(),
): ScheduleState {
  if (a.expires_at && new Date(a.expires_at) <= now) return 'expired'
  if (a.publish_at && new Date(a.publish_at) > now) return 'scheduled'
  return 'live'
}
