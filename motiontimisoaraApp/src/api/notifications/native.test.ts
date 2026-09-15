import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  check: vi.fn(),
  request: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ clear: mocks.clear }) }))
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: mocks.set } }))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { checkPermissions: mocks.check, requestPermissions: mocks.request },
}))
vi.mock('@/lib/platform', () => ({ isNative: () => true, platform: () => 'android' }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
})

it('treats token cleanup failure as locally stopped only for the documented native error code', async () => {
  const { clearNativePush } = await import('./native')
  mocks.clear.mockRejectedValueOnce({ code: 'TOKEN_DELETE_FAILED' })
  await expect(clearNativePush()).resolves.toBeUndefined()
  mocks.clear.mockRejectedValueOnce({ code: 'LOCAL_STORAGE_FAILED' })
  await expect(clearNativePush()).rejects.toMatchObject({ code: 'LOCAL_STORAGE_FAILED' })
})

it('serializes a later opt-out write behind an earlier binding write', async () => {
  const { writePushState } = await import('./native')
  let resolve!: () => void
  const pending = new Promise<void>((done) => {
    resolve = done
  })
  mocks.set.mockReturnValueOnce(pending).mockResolvedValueOnce(undefined)
  const first = writePushState({
    binding: { userId: 'parent', sessionId: 'session', bindingId: 'binding' },
    pendingDisableUserId: null,
  })
  const second = writePushState({ binding: null, pendingDisableUserId: 'parent' })
  await Promise.resolve()
  expect(mocks.set).toHaveBeenCalledTimes(1)
  resolve()
  await Promise.all([first, second])
  expect(JSON.parse(mocks.set.mock.calls[1][0].value)).toEqual({
    binding: null,
    pendingDisableUserId: 'parent',
  })
})

it('requests Android permission only when not already decided', async () => {
  const { requestPushPermission } = await import('./native')
  mocks.check.mockResolvedValueOnce({ receive: 'denied' })
  expect(await requestPushPermission()).toBe('denied')
  expect(mocks.request).not.toHaveBeenCalled()
  mocks.check.mockResolvedValueOnce({ receive: 'prompt-with-rationale' })
  mocks.request.mockResolvedValueOnce({ receive: 'granted' })
  expect(await requestPushPermission()).toBe('granted')
  expect(mocks.request).toHaveBeenCalledOnce()
})
