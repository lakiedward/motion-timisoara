import { beforeEach, expect, test, vi } from 'vitest'

import { loadAppUser, loadAppUserResult, PROFILE_LOAD_ERROR } from './auth'

const getSession = vi.fn()
const rpc = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

beforeEach(() => {
  getSession.mockReset()
  rpc.mockReset()
})

test('signed out is distinct from a failed profile fetch', async () => {
  getSession.mockResolvedValue({ data: { session: null } })
  expect(await loadAppUserResult()).toEqual({ status: 'signed_out' })
  expect(await loadAppUser()).toBeNull()
})

test('HTTP error on profiles returns the visible load error', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  rpc.mockResolvedValue({ data: null, error: { message: '500', code: '500' }, status: 500 })
  expect(await loadAppUserResult()).toEqual({
    status: 'error',
    message: PROFILE_LOAD_ERROR,
    sessionUserId: 'u1',
    retryable: true,
  })
  expect(await loadAppUser()).toBeNull()
})

test('an empty my_profile() result is an error, not a signed-out session', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  rpc.mockResolvedValue({ data: [], error: null })
  expect(await loadAppUserResult()).toEqual({
    status: 'error',
    message: PROFILE_LOAD_ERROR,
    sessionUserId: 'u1',
    retryable: false,
  })
})

test.each([0, 408, 429, 503])(
  'network/temporary profile status %s identifies the existing session for recovery',
  async (status) => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'coach-a' } } } })
    rpc.mockResolvedValue({ data: null, error: { message: 'Unavailable', code: '' }, status })
    expect(await loadAppUserResult()).toEqual({
      status: 'error',
      message: PROFILE_LOAD_ERROR,
      sessionUserId: 'coach-a',
      retryable: true,
    })
  },
)

test.each([401, 403, 404, 422])(
  'definitive profile status %s never permits warm-session recovery',
  async (status) => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'coach-a' } } } })
    rpc.mockResolvedValue({ data: null, error: { message: 'Rejected', code: '' }, status })
    expect(await loadAppUserResult()).toMatchObject({ status: 'error', retryable: false })
  },
)

test('a permission error cannot be treated as a transient failure', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'coach-a' } } } })
  rpc.mockResolvedValue({ data: null, error: { message: 'Forbidden', code: '42501' }, status: 500 })
  expect(await loadAppUserResult()).toMatchObject({ status: 'error', retryable: false })
})

test.each([{ enabled: false }, { id: 'another-user' }, { role: 'UNKNOWN' }])(
  'disabled, mismatched or invalid profiles are definitive failures: %j',
  async (override) => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'coach-a' } } } })
    rpc.mockResolvedValue({
      data: [{ id: 'coach-a', enabled: true, name: 'Audit', role: 'COACH', ...override }],
      error: null,
      status: 200,
    })
    expect(await loadAppUserResult()).toMatchObject({
      status: 'error',
      sessionUserId: 'coach-a',
      retryable: false,
    })
  },
)

test('session errors never claim a verified session identity', async () => {
  getSession.mockResolvedValue({
    data: { session: { user: { id: 'coach-a' } } },
    error: new Error('Session error'),
  })
  expect(await loadAppUserResult()).toEqual({ status: 'error', message: PROFILE_LOAD_ERROR })
  expect(rpc).not.toHaveBeenCalled()
})

test('my_profile() returns the row, and the app user is built from it', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  rpc.mockResolvedValue({
    data: [
      { id: 'u1', email: 'a@b.ro', name: 'Ana', role: 'PARENT', phone: null, avatar_url: null },
    ],
    error: null,
  })
  const result = await loadAppUserResult()
  expect(result).toEqual({
    status: 'ok',
    user: {
      id: 'u1',
      email: 'a@b.ro',
      name: 'Ana',
      role: 'PARENT',
      phone: null,
      avatarUrl: null,
      needsProfileCompletion: true,
    },
  })
})
