import { supabase } from '@/lib/supabase'
import { pushSessionId, type PushSession } from './types'

async function requestPush<T>(work: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Push request timed out'))
      controller.abort()
    }, 10_000)
  })
  try {
    return await Promise.race([work(controller.signal), deadline])
  } finally {
    clearTimeout(timeout)
  }
}

export async function getPushSession(userId: string): Promise<PushSession> {
  const { data, error } = await requestPush(() => supabase.auth.getSession())
  const sessionId = data.session && pushSessionId(data.session.access_token)
  if (error || !data.session || data.session.user.id !== userId || !sessionId)
    throw new Error('Push session unavailable')
  return { userId, sessionId, accessToken: data.session.access_token }
}

function preference(value: unknown): { enabled: boolean } {
  if (
    !value ||
    typeof value !== 'object' ||
    !('enabled' in value) ||
    typeof value.enabled !== 'boolean'
  )
    throw new Error('Invalid push preferences')
  return { enabled: value.enabled }
}

export async function getPushPreferences(session: PushSession) {
  const { data, error } = await requestPush((signal) =>
    supabase
      .rpc('get_my_push_preferences')
      .setHeader('Authorization', `Bearer ${session.accessToken}`)
      .abortSignal(signal),
  )
  if (error) throw error
  return preference(data)
}

export async function setPushEnabled(session: PushSession, enabled: boolean) {
  const { data, error } = await requestPush((signal) =>
    supabase
      .rpc('set_my_push_enabled', { p_enabled: enabled })
      .setHeader('Authorization', `Bearer ${session.accessToken}`)
      .abortSignal(signal),
  )
  if (error) throw error
  const result = preference(data)
  if (result.enabled !== enabled) throw new Error('Push preference was not saved')
  return result
}

export async function registerPushDevice(
  session: PushSession,
  device: { installationId: string; bindingId: string; token: string },
) {
  const { error } = await requestPush((signal) =>
    supabase
      .rpc('register_push_device', {
        p_installation_id: device.installationId,
        p_binding_id: device.bindingId,
        p_token: device.token,
      })
      .setHeader('Authorization', `Bearer ${session.accessToken}`)
      .abortSignal(signal),
  )
  if (error) throw error
}

export async function revokePushDevice(session: PushSession, bindingId: string) {
  const { error } = await requestPush((signal) =>
    supabase
      .rpc('revoke_push_device', { p_binding_id: bindingId })
      .setHeader('Authorization', `Bearer ${session.accessToken}`)
      .abortSignal(signal),
  )
  if (error) throw error
}
