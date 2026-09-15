import { registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { isNative, platform } from '@/lib/platform'
import { EMPTY_PUSH_STATE, isUuid, type PushPermission, type PushStoredState } from './types'

interface MotionPushPlugin {
  configure(input: { bindingId: string }): Promise<{
    installationId: string
    token: string
    bindingId: string
  }>
  clear(): Promise<void>
  status(): Promise<{
    bindingId: string | null
    installationId: string
    permission: PushPermission
  }>
}

export const MotionPush = registerPlugin<MotionPushPlugin>('MotionPush')
const STORAGE_KEY = 'motion-push-binding'
let storageQueue = Promise.resolve()

export function supportsPush() {
  return isNative() && platform() === 'android'
}

export async function readPushState(): Promise<PushStoredState> {
  await storageQueue
  const { value } = await Preferences.get({ key: STORAGE_KEY })
  if (!value) return { ...EMPTY_PUSH_STATE }
  try {
    const item = JSON.parse(value) as PushStoredState
    if (!item || typeof item !== 'object') return { ...EMPTY_PUSH_STATE }
    const binding = item.binding
    return {
      binding:
        binding && isUuid(binding.userId) && isUuid(binding.sessionId) && isUuid(binding.bindingId)
          ? binding
          : null,
      pendingDisableUserId: isUuid(item.pendingDisableUserId) ? item.pendingDisableUserId : null,
    }
  } catch {
    return { ...EMPTY_PUSH_STATE }
  }
}

export function writePushState(state: PushStoredState) {
  const value = JSON.stringify(state)
  const next = storageQueue.then(() => Preferences.set({ key: STORAGE_KEY, value }))
  storageQueue = next.catch(() => undefined)
  return next
}

export async function clearNativePush() {
  try {
    await MotionPush.clear()
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'TOKEN_DELETE_FAILED'
    )
      throw error
  }
}

export async function requestPushPermission(): Promise<PushPermission> {
  const current = await PushNotifications.checkPermissions()
  if (current.receive === 'granted' || current.receive === 'denied') return current.receive
  const result = await PushNotifications.requestPermissions()
  return result.receive === 'granted' ? 'granted' : 'denied'
}
