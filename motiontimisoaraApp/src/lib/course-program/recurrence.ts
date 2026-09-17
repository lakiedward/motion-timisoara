import { z } from 'zod'

export const COURSE_TIME_ZONE = 'Europe/Bucharest'

export const COURSE_WEEKDAYS = [
  { iso: 1, label: 'Luni' },
  { iso: 2, label: 'Marți' },
  { iso: 3, label: 'Miercuri' },
  { iso: 4, label: 'Joi' },
  { iso: 5, label: 'Vineri' },
  { iso: 6, label: 'Sâmbătă' },
  { iso: 7, label: 'Duminică' },
] as const

export type WeekdayIso = (typeof COURSE_WEEKDAYS)[number]['iso']

export type CourseProgramDay = {
  iso: number
  enabled: boolean
  start: string
  end: string
}

export type DaySchedule = {
  start: string
  end: string
}

export type RecurrenceRule = {
  daySchedules: Record<string, DaySchedule>
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

export function emptyCourseProgram(): CourseProgramDay[] {
  return COURSE_WEEKDAYS.map((day) => ({
    iso: day.iso,
    enabled: false,
    start: '',
    end: '',
  }))
}

export function weekdayLabel(iso: number): string {
  return COURSE_WEEKDAYS.find((day) => day.iso === iso)?.label ?? `Ziua ${iso}`
}

export function normalizeTime(value: string): string {
  const match = value.trim().match(TIME_RE)
  if (!match) return ''
  return `${match[1]}:${match[2]}`
}

export function isValidTime(value: string): boolean {
  return normalizeTime(value) !== ''
}

export function timeToMinutes(value: string): number | null {
  const normalized = normalizeTime(value)
  if (!normalized) return null
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

export function isEndAfterStart(start: string, end: string): boolean {
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)
  if (startMinutes == null || endMinutes == null) return false
  return endMinutes > startMinutes
}

function isWeekdayIso(value: number): value is WeekdayIso {
  return Number.isInteger(value) && value >= 1 && value <= 7
}

export function serializeRecurrenceRule(program: CourseProgramDay[]): string {
  const daySchedules: Record<string, DaySchedule> = {}
  for (const day of program) {
    if (!day.enabled) continue
    const start = normalizeTime(day.start)
    const end = normalizeTime(day.end)
    if (!start || !end) continue
    daySchedules[String(day.iso)] = { start, end }
  }
  return JSON.stringify({ daySchedules })
}

function slotFromUnknown(value: unknown): DaySchedule | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const start = typeof record.start === 'string' ? normalizeTime(record.start) : ''
  const end = typeof record.end === 'string' ? normalizeTime(record.end) : ''
  if (!start || !end) return null
  return { start, end }
}

export function parseRecurrenceRule(raw: string | null | undefined): CourseProgramDay[] {
  const program = emptyCourseProgram()
  if (!raw?.trim()) return program

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return program
  }
  if (!parsed || typeof parsed !== 'object') return program
  const root = parsed as Record<string, unknown>
  const daySchedulesNode = root.daySchedules

  if (
    daySchedulesNode &&
    typeof daySchedulesNode === 'object' &&
    !Array.isArray(daySchedulesNode)
  ) {
    for (const [key, value] of Object.entries(daySchedulesNode as Record<string, unknown>)) {
      const iso = Number(key)
      if (!isWeekdayIso(iso)) continue
      const slot = slotFromUnknown(value)
      if (!slot) continue
      const day = program.find((item) => item.iso === iso)
      if (!day) continue
      day.enabled = true
      day.start = slot.start
      day.end = slot.end
    }
    return program
  }

  const daysNode = root.days
  const shared = slotFromUnknown(root)
  if (Array.isArray(daysNode) && shared) {
    for (const entry of daysNode) {
      const iso = typeof entry === 'number' ? entry : Number(entry)
      if (!isWeekdayIso(iso)) continue
      const day = program.find((item) => item.iso === iso)
      if (!day) continue
      day.enabled = true
      day.start = shared.start
      day.end = shared.end
    }
  }
  return program
}

export function selectedCourseProgramDays(program: CourseProgramDay[]): CourseProgramDay[] {
  return program.filter((day) => day.enabled)
}

export function formatCourseProgramPreview(program: CourseProgramDay[]): string | null {
  const parts = selectedCourseProgramDays(program)
    .map((day) => {
      const start = normalizeTime(day.start)
      const end = normalizeTime(day.end)
      if (!start || !end) return null
      return `${weekdayLabel(day.iso)} ${start}–${end}`
    })
    .filter((part): part is string => Boolean(part))
  return parts.length ? parts.join(', ') : null
}

export function courseProgramIssue(program: CourseProgramDay[]): string | null {
  const selected = selectedCourseProgramDays(program)
  if (!selected.length) {
    return 'Selectează cel puțin o zi și completează orele.'
  }
  for (const day of selected) {
    const label = weekdayLabel(day.iso)
    if (!normalizeTime(day.start) || !normalizeTime(day.end)) {
      return `Completează orele pentru ${label}.`
    }
    if (!isEndAfterStart(day.start, day.end)) {
      return `Ora de final trebuie să fie după ora de început pentru ${label}.`
    }
  }
  return null
}

export const courseProgramDaySchema = z.object({
  iso: z.number().int().min(1).max(7),
  enabled: z.boolean(),
  start: z.string(),
  end: z.string(),
})

export const courseProgramSchema = z.array(courseProgramDaySchema)

export function validateCourseProgramFields(
  value: { program: CourseProgramDay[] },
  ctx: z.RefinementCtx,
) {
  const program = value.program ?? []
  const selected = selectedCourseProgramDays(program)
  if (!selected.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['program'],
      message: 'Selectează cel puțin o zi și completează orele.',
    })
    return
  }
  for (const day of selected) {
    const index = program.findIndex((item) => item.iso === day.iso)
    const label = weekdayLabel(day.iso)
    const start = normalizeTime(day.start)
    const end = normalizeTime(day.end)
    if (!start) {
      ctx.addIssue({
        code: 'custom',
        path: ['program', index, 'start'],
        message: `Completează orele pentru ${label}.`,
      })
    }
    if (!end) {
      ctx.addIssue({
        code: 'custom',
        path: ['program', index, 'end'],
        message: `Completează orele pentru ${label}.`,
      })
    }
    if (start && end && !isEndAfterStart(start, end)) {
      ctx.addIssue({
        code: 'custom',
        path: ['program', index, 'end'],
        message: `Ora de final trebuie să fie după ora de început pentru ${label}.`,
      })
    }
  }
}

export function requireSerializedProgram(program: CourseProgramDay[]): string {
  const issue = courseProgramIssue(program)
  if (issue) throw new Error(issue)
  return serializeRecurrenceRule(program)
}
