import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pause: vi.fn(),
  resume: vi.fn(),
  restore: vi.fn(),
  clear: vi.fn(),
  session: vi.fn(),
  supported: true,
}))
vi.mock('./coordinator', () => ({
  createPushCoordinator: () => ({
    pauseForAuthentication: mocks.pause,
    restore: mocks.restore,
    clearForSignOut: mocks.clear,
  }),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }))
vi.mock('./native', () => ({
  supportsPush: () => mocks.supported,
  MotionPush: {},
  clearNativePush: vi.fn(),
  readPushState: vi.fn(),
  writePushState: vi.fn(),
  requestPushPermission: vi.fn(),
}))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.supported = true
  mocks.pause.mockResolvedValue(mocks.resume)
  mocks.resume.mockResolvedValue(undefined)
  mocks.restore.mockResolvedValue(undefined)
  mocks.clear.mockResolvedValue(undefined)
})

it('clears the local binding before authentication and settles a successful same-account login', async () => {
  const { authenticateWithPushIsolation } = await import('./index')
  const order: string[] = []
  mocks.pause.mockImplementation(async () => {
    order.push('pause')
    return mocks.resume
  })
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: 'same-parent' } } },
    error: null,
  })
  const result = await authenticateWithPushIsolation(async () => {
    order.push('login')
    return { error: null }
  })
  expect(order).toEqual(['pause', 'login'])
  expect(result.error).toBeNull()
  expect(mocks.restore).toHaveBeenCalledExactlyOnceWith('same-parent')
  expect(mocks.resume).not.toHaveBeenCalled()
})

it('resumes the previous binding when credentials are rejected', async () => {
  const { authenticateWithPushIsolation } = await import('./index')
  const error = { message: 'Invalid credentials' }
  expect(await authenticateWithPushIsolation(async () => ({ error }))).toEqual({ error })
  expect(mocks.resume).toHaveBeenCalledOnce()
  expect(mocks.restore).not.toHaveBeenCalled()
})

it('does not invoke native isolation on web', async () => {
  const { authenticateWithPushIsolation } = await import('./index')
  mocks.supported = false
  expect(await authenticateWithPushIsolation(async () => ({ error: null }))).toEqual({
    error: null,
  })
  expect(mocks.pause).not.toHaveBeenCalled()
})
