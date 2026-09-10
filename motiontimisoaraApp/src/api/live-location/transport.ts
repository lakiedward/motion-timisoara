import { CapacitorHttp } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { isNative } from '@/lib/platform'

export async function locationAccessToken(actorId?: string) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error || !session || (actorId && session.user.id !== actorId)) {
    throw new LocationError('UNAUTHORIZED', 'Autentifică-te din nou pentru a continua.')
  }
  return session.access_token
}

export class LocationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'LocationError'
  }
}

export async function sendLocationPayload(
  body: object,
  accessToken: string,
): Promise<Record<string, unknown>> {
  let data: unknown
  let status = 200
  if (isNative()) {
    const response = await CapacitorHttp.post({
      url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-live-location`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      data: body,
      connectTimeout: 15000,
      readTimeout: 15000,
    }).catch(() => {
      throw new LocationError('NETWORK', 'Conexiunea s-a întrerupt. Reîncearcă.')
    })
    status = response.status
    try {
      data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    } catch {
      throw new LocationError('INVALID_RESPONSE', 'Răspunsul serverului nu poate fi verificat.')
    }
  } else {
    const response = await supabase.functions.invoke('coach-live-location', {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    })
    data = response.data
    if (response.error) {
      const context = response.error.context instanceof Response ? response.error.context : null
      status = context?.status ?? 503
      data = context ? await context.json().catch(() => null) : null
    }
  }
  const result = data as
    | ({ success?: boolean; code?: string; message?: string } & Record<string, unknown>)
    | null
  if (status >= 400 || result?.success !== true) {
    throw new LocationError(
      result?.code ?? (status === 401 ? 'UNAUTHORIZED' : 'NETWORK'),
      result?.message ?? 'Locația nu este disponibilă momentan. Reîncearcă.',
    )
  }
  return result
}
