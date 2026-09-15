import { beforeEach, expect, it, vi } from 'vitest'
import { getPushPreferences, getPushSession, registerPushDevice, setPushEnabled } from './backend'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), header: vi.fn(), getSession: vi.fn() }))
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
  mocks.header.mockResolvedValue({ data: { enabled: false }, error: null })
})

it('binds preference reads and writes to the captured session token', async () => {
  expect(await getPushPreferences(session)).toEqual({ enabled: false })
  expect(mocks.rpc).toHaveBeenCalledWith('get_my_push_preferences')
  expect(mocks.header).toHaveBeenCalledWith('Authorization', `Bearer ${accessToken}`)
  mocks.header.mockResolvedValueOnce({ data: { enabled: true }, error: null })
  expect(await setPushEnabled(session, true)).toEqual({ enabled: true })
  expect(mocks.rpc).toHaveBeenLastCalledWith('set_my_push_enabled', { p_enabled: true })
})

it('does not turn an invalid response or unsaved preference into false success', async () => {
  mocks.header.mockResolvedValueOnce({ data: { enabled: 'true' }, error: null })
  await expect(getPushPreferences(session)).rejects.toThrow('Invalid push preferences')
  mocks.header.mockResolvedValueOnce({ data: { enabled: false }, error: null })
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
  mocks.header.mockResolvedValueOnce({ data: null, error: null })
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
