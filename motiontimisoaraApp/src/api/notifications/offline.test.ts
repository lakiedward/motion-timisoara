import { afterEach, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { queryClient } from '@/lib/query'
import { pushNotifications } from './index'

const mocks = vi.hoisted(() => ({ preferences: vi.fn(), clear: vi.fn() }))
vi.mock('./backend', () => ({
  getPushSession: async (userId: string) => ({ userId, sessionId: 'session', accessToken: 'test' }),
  getPushPreferences: mocks.preferences,
  setPushEnabled: vi.fn(),
  registerPushDevice: vi.fn(),
  revokePushDevice: vi.fn(),
}))
vi.mock('./native', () => ({
  supportsPush: () => true,
  MotionPush: { status: async () => ({ permission: 'granted' }) },
  clearNativePush: mocks.clear,
  readPushState: async () => ({ binding: null, pendingDisableUserId: null }),
  writePushState: async () => undefined,
  requestPushPermission: vi.fn(),
}))

afterEach(() => {
  onlineManager.setOnline(true)
  queryClient.clear()
})

it('settles an offline restore into retry feedback and recovers on reconnection', async () => {
  onlineManager.setOnline(false)
  mocks.clear.mockResolvedValue(undefined)
  mocks.preferences.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const restoring = pushNotifications.restore('parent')
  await vi.waitFor(() => expect(pushNotifications.getSnapshot().status).toBe('error'))
  await restoring
  expect(mocks.preferences).toHaveBeenCalledOnce()
  expect(mocks.clear).toHaveBeenCalled()
  expect(pushNotifications.getSnapshot().busy).toBe(false)
  onlineManager.setOnline(true)
  mocks.preferences.mockResolvedValueOnce({ enabled: false })
  await pushNotifications.restore('parent')
  expect(pushNotifications.getSnapshot()).toMatchObject({
    status: 'disabled',
    error: null,
    busy: false,
  })
})
