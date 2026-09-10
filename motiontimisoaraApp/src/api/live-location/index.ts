import { supabase } from '@/lib/supabase'
import { LocationError, sendLocationPayload, locationAccessToken } from './transport'
import { locationTarget } from './target'
export { LocationError } from './transport'

export type LocationPoint = {
  latitude: number
  longitude: number
  accuracy: number
  capturedAt: string
  updatedAt: string
}
export type LocationResponse = {
  success: true
  sessionId: string
  expiresAt: string
  location?: LocationPoint | null
  consentVersion?: number
  consentGranted?: boolean
}
export type LocationRequest =
  | { action: 'status'; occurrenceId: string }
  | { action: 'start'; occurrenceId: string; requestId: string; consent: true }
  | { action: 'read' | 'stop'; occurrenceId: string; sessionId: string }
  | {
      action: 'consent'
      occurrenceId: string
      sessionId: string
      consent: boolean
      expectedVersion: number
    }
  | ({ action: 'update'; occurrenceId: string; sessionId: string } & Omit<
      LocationPoint,
      'updatedAt'
    >)

async function sendLocation(body: LocationRequest, accessToken: string): Promise<LocationResponse> {
  const { occurrenceId, ...action } = body
  const result = (await sendLocationPayload(
    { ...action, ...locationTarget(occurrenceId) },
    accessToken,
  )) as Partial<LocationResponse>
  if (
    typeof result.sessionId !== 'string' ||
    (body.action !== 'stop' && !Number.isFinite(Date.parse(result.expiresAt ?? '')))
  ) {
    throw new LocationError('INVALID_RESPONSE', 'Nu am putut verifica starea partajării.')
  }
  if (body.action === 'read' && result.location != null) {
    const point = result.location
    if (
      !Number.isFinite(point.latitude) ||
      Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point.longitude) ||
      Math.abs(point.longitude) > 180 ||
      !Number.isFinite(point.accuracy) ||
      point.accuracy < 0 ||
      !Number.isFinite(Date.parse(point.capturedAt)) ||
      !Number.isFinite(Date.parse(point.updatedAt))
    ) {
      throw new LocationError('INVALID_RESPONSE', 'Poziția primită nu poate fi verificată.')
    }
  }
  return result as LocationResponse
}

export async function locationRequest(
  body: LocationRequest,
  actorId?: string,
): Promise<LocationResponse> {
  return sendLocation(body, await locationAccessToken(actorId))
}

export async function prepareLocationStop(occurrenceId: string, actorId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || session.user.id !== actorId)
    throw new LocationError('UNAUTHORIZED', 'Sesiunea a expirat.')
  const token = session.access_token
  return async (sessionId: string) => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession()
    return sendLocation(
      { action: 'stop', occurrenceId, sessionId },
      current?.user.id === actorId ? current.access_token : token,
    ).catch((error: unknown) => {
      if (
        error instanceof LocationError &&
        ['SESSION_EXPIRED', 'SESSION_NOT_FOUND'].includes(error.code)
      )
        return
      throw error
    })
  }
}

export type CurrentLocationOccurrence = {
  id: string
  course_id: string
  starts_at: string
  ends_at: string
}
export async function getCurrentLocationOccurrences(
  courseIds: string[],
): Promise<CurrentLocationOccurrence[]> {
  if (!courseIds.length) return []
  const now = Date.now()
  const { data, error } = await supabase
    .from('course_occurrences')
    .select('id,course_id,starts_at,ends_at')
    .in('course_id', [...new Set(courseIds)])
    .lte('starts_at', new Date(now).toISOString())
    .gte('ends_at', new Date(now - 15 * 60000).toISOString())
    .order('starts_at', { ascending: false })
  if (error) throw new Error('Nu am putut încărca ședințele curente.')
  return data ?? []
}

export function subscribeToLocation(sessionId: string, onInvalidate: () => void): () => void {
  let closed = false
  const channel = supabase
    .channel(`coach-live-location:${sessionId}`, { config: { private: true } })
    .on('broadcast', { event: 'invalidate' }, () => {
      if (!closed) onInvalidate()
    })
    .subscribe(() => {
      if (!closed) onInvalidate()
    })
  return () => {
    closed = true
    void supabase.removeChannel(channel)
  }
}
