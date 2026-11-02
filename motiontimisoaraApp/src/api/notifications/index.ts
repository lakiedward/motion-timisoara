import { queryClient } from '@/lib/query'
import { supabase } from '@/lib/supabase'
import {
  getPushPreferences,
  getPushSession,
  registerPushDevice,
  revokePushDevice,
  setPushEnabled,
} from './backend'
import { createPushCoordinator } from './coordinator'
import {
  MotionPush,
  clearNativePush,
  readPushState,
  requestPushPermission,
  supportsNativePush,
  writePushState,
} from './native'
import { pushSessionId } from './types'
import {
  clearWebPush,
  configureWebPush,
  requestWebPushPermission,
  supportsWebPush,
  webPushPermission,
} from './web'

export { needsHomeScreenForPush, promptWebPushPermission, supportsWebPush } from './web'

export function supportsPush() {
  return supportsNativePush() || supportsWebPush()
}

const web = !supportsNativePush()

export const pushNotifications = createPushCoordinator({
  session: getPushSession,
  preferences: (session) =>
    queryClient.fetchQuery({
      queryKey: ['push-preferences', session.userId, session.sessionId],
      queryFn: () => getPushPreferences(session),
      staleTime: 0,
      retry: false,
      networkMode: 'always',
    }),
  setEnabled: async (session, enabled) => {
    const result = await setPushEnabled(session, enabled)
    queryClient.setQueryData(['push-preferences', session.userId, session.sessionId], result)
    return result
  },
  register: (session, device) => registerPushDevice(session, device, web ? 'web' : 'android'),
  revoke: revokePushDevice,
  configure: (input) => (web ? configureWebPush(input) : MotionPush.configure(input)),
  clear: web ? clearWebPush : clearNativePush,
  permission: async () => (web ? webPushPermission() : (await MotionPush.status()).permission),
  requestPermission: web ? requestWebPushPermission : requestPushPermission,
  read: readPushState,
  write: writePushState,
  uuid: () => crypto.randomUUID(),
})

export async function clearPushBeforeSignOut() {
  if (supportsPush()) await pushNotifications.clearForSignOut()
}

export async function authenticateWithPushIsolation<T extends { error: unknown }>(
  work: () => Promise<T>,
) {
  if (!supportsPush()) return work()
  const resume = await pushNotifications.pauseForAuthentication()
  try {
    const result = await work()
    if (result.error) await resume()
    else {
      const { data, error } = await supabase.auth.getSession()
      if (!error && data.session) await pushNotifications.restore(data.session.user.id)
      else await pushNotifications.clearForSignOut()
    }
    return result
  } catch (error) {
    await resume()
    throw error
  }
}

export function observePushAuth() {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return
    pushNotifications.authChanged(
      session?.user.id ?? null,
      session ? pushSessionId(session.access_token) : null,
    )
  })
  return () => data.subscription.unsubscribe()
}
