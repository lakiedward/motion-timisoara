import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getPushPreferences,
  getPushSession,
  registerPushDevice,
  revokePushDevice,
  setPushEnabled,
} from './backend'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  header: vi.fn(),
  abort: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, auth: { getSession: mocks.getSession } },
}))

const userId = '11111111-1111-4111-8111-111111111111'
const sessionId = '22222222-2222-4222-8222-222222222222'
const accessToken = `header.${btoa(JSON.stringify({ session_id: sessionId }))}.signature`
const session = { userId, sessionId, accessToken }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.rpc.mockReturnValue({ setHeader: mocks.header })
  mocks.header.mockReturnValue({ abortSignal: mocks.abort })
  mocks.abort.mockResolvedValue({ data: { enabled: false }, error: null })
})

afterEach(() => vi.useRealTimers())

it.each([
  ['preferences', () => getPushPreferences(session)],
  ['opt-out', () => setPushEnabled(session, false)],
  [
    'registration',
    () =>
      registerPushDevice(session, {
        bindingId: 'binding',
        installationId: 'installation',
        token: 'token',
      }),
  ],
  ['revocation', () => revokePushDevice(session, 'binding')],
] as const)('aborts a stalled %s request so the coordinator can settle', async (_, request) => {
  vi.useFakeTimers()
  const failure = new Error('Request aborted')
  mocks.abort.mockImplementation(
    (signal: AbortSignal) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({ data: null, error: failure }), {
          once: true,
        })
      }),
  )
  const result = expect(request()).rejects.toThrow('Push request timed out')
  await vi.advanceTimersByTimeAsync(10_000)
  await result
  expect(mocks.abort.mock.calls[0][0].aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('settles a deadline while the RPC waits for auth before starting fetch', async () => {
  vi.useFakeTimers()
  mocks.abort.mockImplementation(() => new Promise(() => undefined))
  const result = expect(getPushPreferences(session)).rejects.toThrow('Push request timed out')
  await vi.advanceTimersByTimeAsync(10_000)
  await result
  expect(mocks.abort.mock.calls[0][0].aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('settles a stalled session refresh before the coordinator starts an RPC', async () => {
  vi.useFakeTimers()
  mocks.getSession.mockImplementation(() => new Promise(() => undefined))
  const result = expect(getPushSession(userId)).rejects.toThrow('Push request timed out')
  await vi.advanceTimersByTimeAsync(10_000)
  await result
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('clears the deadline after a successful request', async () => {
  vi.useFakeTimers()
  expect(await getPushPreferences(session)).toEqual({ enabled: false })
  expect(vi.getTimerCount()).toBe(0)
  expect(mocks.abort.mock.calls[0][0].aborted).toBe(false)
})

it('binds preference reads and writes to the captured session token', async () => {
  expect(await getPushPreferences(session)).toEqual({ enabled: false })
  expect(mocks.rpc).toHaveBeenCalledWith('get_my_push_preferences')
  expect(mocks.header).toHaveBeenCalledWith('Authorization', `Bearer ${accessToken}`)
  mocks.abort.mockResolvedValueOnce({ data: { enabled: true }, error: null })
  expect(await setPushEnabled(session, true)).toEqual({ enabled: true })
  expect(mocks.rpc).toHaveBeenLastCalledWith('set_my_push_enabled', { p_enabled: true })
})

it('does not turn an invalid response or unsaved preference into false success', async () => {
  mocks.abort.mockResolvedValueOnce({ data: { enabled: 'true' }, error: null })
  await expect(getPushPreferences(session)).rejects.toThrow('Invalid push preferences')
  mocks.abort.mockResolvedValueOnce({ data: { enabled: false }, error: null })
  await expect(setPushEnabled(session, true)).rejects.toThrow('Push preference was not saved')
})

it('rejects a session belonging to another user or missing its session identifier', async () => {
  mocks.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'other-parent' }, access_token: accessToken } },
    error: null,
  })
  await expect(getPushSession(userId)).rejects.toThrow('Push session unavailable')
  mocks.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: userId }, access_token: 'invalid' } },
    error: null,
  })
  await expect(getPushSession(userId)).rejects.toThrow('Push session unavailable')
  mocks.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: userId }, access_token: accessToken } },
    error: null,
  })
  expect(await getPushSession(userId)).toEqual(session)
})

it('registers one installation and binding under the same captured auth session', async () => {
  mocks.abort.mockResolvedValueOnce({ data: null, error: null })
  await registerPushDevice(session, {
    bindingId: 'binding',
    installationId: 'installation',
    token: 'fcm-token',
  })
  expect(mocks.rpc).toHaveBeenCalledWith('register_push_device', {
    p_binding_id: 'binding',
    p_installation_id: 'installation',
    p_token: 'fcm-token',
  })
  expect(mocks.header).toHaveBeenCalledExactlyOnceWith('Authorization', `Bearer ${accessToken}`)
})
