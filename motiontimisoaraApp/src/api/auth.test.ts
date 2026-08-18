import { beforeEach, expect, test, vi } from 'vitest'

import { loadAppUser, loadAppUserResult, PROFILE_LOAD_ERROR } from './auth'

const getSession = vi.fn()
const single = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: (...args: unknown[]) => single(...args),
        }),
      }),
    }),
  },
}))

beforeEach(() => {
  getSession.mockReset()
  single.mockReset()
})

test('signed out is distinct from a failed profile fetch', async () => {
  getSession.mockResolvedValue({ data: { session: null } })
  expect(await loadAppUserResult()).toEqual({ status: 'signed_out' })
  expect(await loadAppUser()).toBeNull()
})

test('HTTP error on profiles returns the visible load error', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  single.mockResolvedValue({ data: null, error: { message: '500', code: '500' } })
  expect(await loadAppUserResult()).toEqual({ status: 'error', message: PROFILE_LOAD_ERROR })
  expect(await loadAppUser()).toBeNull()
})
