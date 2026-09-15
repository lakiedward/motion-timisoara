export type PushPermission = 'granted' | 'denied' | 'prompt'

export interface PushSession {
  userId: string
  sessionId: string
  accessToken: string
}

export interface PushBinding {
  userId: string
  sessionId: string
  bindingId: string
}

export interface PushStoredState {
  binding: PushBinding | null
  pendingDisableUserId: string | null
}

export interface PushSnapshot {
  status: 'loading' | 'disabled' | 'enabled' | 'denied' | 'error'
  busy: boolean
  error: string | null
  pendingDisable: boolean
}

export interface PushPayload {
  eventId: string
  bindingId: string
  kind: 'announcement' | 'attendance' | 'course' | 'camp'
  entityId: string
  path: string
  title: string
  body: string
  expiresAt: string
}

export const PUSH_ERROR = 'Nu am putut actualiza notificările. Verifică internetul și reîncearcă.'
export const PUSH_DISABLE_ERROR =
  'Notificările sunt oprite pe acest telefon. Nu am putut salva dezactivarea pentru cont; reîncearcă atunci când ai internet.'

export const EMPTY_PUSH_STATE: PushStoredState = { binding: null, pendingDisableUserId: null }

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
}

export function pushSessionId(token: string): string | null {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims: unknown = JSON.parse(atob(encoded))
    return claims &&
      typeof claims === 'object' &&
      'session_id' in claims &&
      isUuid(claims.session_id)
      ? claims.session_id
      : null
  } catch {
    return null
  }
}
