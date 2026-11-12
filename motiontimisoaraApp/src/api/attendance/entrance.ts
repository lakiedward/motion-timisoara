import { supabase } from '@/lib/supabase'

type JsonObject = Record<string, unknown>

export type CoachEntranceCode = {
  coachId: string
  coachName: string
  token: string
  rotatedAt: string
}

export class EntranceCodeError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export type EntranceOptionState =
  | 'AVAILABLE'
  | 'ALREADY_PRESENT'
  | 'MANUAL_OVERRIDE'
  | 'NO_REMAINING_SESSIONS'
  | 'AMBIGUOUS_ENROLLMENT'

export type EntranceOption = {
  occurrenceId: string
  courseId: string
  courseName: string
  startsAt: string
  endsAt: string
  childId: string
  childName: string
  remainingSessions: number | null
  state: EntranceOptionState
}

export type EntranceOptionsResult =
  | { success: true; coachName: string; serverTime: string; options: EntranceOption[] }
  | {
      success: false
      code: string
      coachName: string | null
      serverTime: string | null
      nextOpensAt: string | null
    }

export type EntranceCheckinRequest = {
  token: string
  occurrenceId: string
  childId: string
  requestId: string
}

export type EntranceCheckinResult =
  | {
      success: true
      outcome: 'recorded' | 'duplicate'
      occurrenceId: string
      childId: string
      childName: string
      courseName: string
      startsAt: string
      remainingSessions: number | null
    }
  | { success: false; code: string }

function asObject(data: unknown): JsonObject {
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as JsonObject) : {}
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const textOrNull = (value: unknown) => (typeof value === 'string' ? value : null)
const count = (value: unknown) => (typeof value === 'number' ? value : null)
const failureCode = (body: JsonObject) => text(body.code) || 'UNKNOWN'

function readCoachCode(data: unknown): CoachEntranceCode {
  const body = asObject(data)
  if (body.success !== true) throw new EntranceCodeError(failureCode(body))
  return {
    coachId: text(body.coachId),
    coachName: text(body.coachName),
    token: text(body.token),
    rotatedAt: text(body.rotatedAt),
  }
}

export async function getCoachEntranceCode(): Promise<CoachEntranceCode> {
  const { data, error } = await supabase.rpc('get_coach_entrance_code', {})
  if (error) throw error
  return readCoachCode(data)
}

export async function rotateCoachEntranceCode(): Promise<CoachEntranceCode> {
  const { data, error } = await supabase.rpc('rotate_coach_entrance_code', {})
  if (error) throw error
  return readCoachCode(data)
}

function readOption(value: unknown): EntranceOption {
  const row = asObject(value)
  return {
    occurrenceId: text(row.occurrenceId),
    courseId: text(row.courseId),
    courseName: text(row.courseName),
    startsAt: text(row.startsAt),
    endsAt: text(row.endsAt),
    childId: text(row.childId),
    childName: text(row.childName),
    remainingSessions: count(row.remainingSessions),
    state: text(row.state) as EntranceOptionState,
  }
}

export async function getEntranceCheckinOptions(token: string): Promise<EntranceOptionsResult> {
  const { data, error } = await supabase.rpc('entrance_checkin_options', { p_token: token })
  if (error) throw error
  const body = asObject(data)
  if (body.success === true) {
    return {
      success: true,
      coachName: text(body.coachName),
      serverTime: text(body.serverTime),
      options: Array.isArray(body.options) ? body.options.map(readOption) : [],
    }
  }
  return {
    success: false,
    code: failureCode(body),
    coachName: textOrNull(body.coachName),
    serverTime: textOrNull(body.serverTime),
    nextOpensAt: textOrNull(body.nextOpensAt),
  }
}

export async function entranceCheckin(
  request: EntranceCheckinRequest,
): Promise<EntranceCheckinResult> {
  const { data, error } = await supabase.rpc('entrance_checkin', {
    p_token: request.token,
    p_occurrence_id: request.occurrenceId,
    p_child_id: request.childId,
    p_request_id: request.requestId,
  })
  if (error) throw error
  const body = asObject(data)
  if (body.success !== true) return { success: false, code: failureCode(body) }
  return {
    success: true,
    outcome: body.outcome === 'duplicate' ? 'duplicate' : 'recorded',
    occurrenceId: text(body.occurrenceId),
    childId: text(body.childId),
    childName: text(body.childName),
    courseName: text(body.courseName),
    startsAt: text(body.startsAt),
    remainingSessions: count(body.remainingSessions),
  }
}
