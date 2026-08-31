import { beforeEach, expect, test, vi } from 'vitest'

import { loadAppUser, loadAppUserResult, PROFILE_LOAD_ERROR } from './auth'

const getSession = vi.fn()
// Profilul propriu se citește prin `my_profile()`, nu din tabel: din migrarea
// 00036 rolul `authenticated` nu mai are grant pe email/phone.
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
  rpc.mockResolvedValue({ data: null, error: { message: '500', code: '500' } })
  expect(await loadAppUserResult()).toEqual({ status: 'error', message: PROFILE_LOAD_ERROR })
  expect(await loadAppUser()).toBeNull()
})

test('an empty my_profile() result is an error, not a signed-out session', async () => {
  // `my_profile()` întoarce o listă, nu un rând. Zero rânduri înseamnă că
  // profilul nu a putut fi citit — nu că omul nu e logat. Fără cazul ăsta,
  // regresia ar fi trecut drept deconectare și ar fi trimis omul la /login.
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  rpc.mockResolvedValue({ data: [], error: null })
  expect(await loadAppUserResult()).toEqual({ status: 'error', message: PROFILE_LOAD_ERROR })
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
