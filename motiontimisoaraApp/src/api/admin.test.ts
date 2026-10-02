import { beforeEach, expect, test, vi } from 'vitest'

import { countCreatedSince, getAdminStats, isActiveInviteCode, NEW_USERS_WINDOW_MS } from './admin'

let raspuns: Record<string, { data: unknown; error: unknown; count?: number | null }> = {}
let cereri: Record<string, string[]> = {}

function tabela(nume: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[nume] ?? { data: [], error: null, count: 0 }))
      }
      return (...args: unknown[]) => {
        ;(cereri[nume] ??= []).push(`${prop}(${args.map(String).join(',')})`)
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (nume: string) => tabela(nume),
    rpc: async (nume: string) => raspuns[nume] ?? { data: [], error: null },
  },
}))

beforeEach(() => {
  raspuns = {}
  cereri = {}
})

test('isActiveInviteCode exclude codurile epuizate sau expirate', () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  expect(isActiveInviteCode({ current_uses: 0, max_uses: 1, expires_at: null }, now)).toBe(true)
  expect(isActiveInviteCode({ current_uses: 1, max_uses: 1, expires_at: null }, now)).toBe(false)
  expect(
    isActiveInviteCode({ current_uses: 0, max_uses: 2, expires_at: '2026-10-02T11:00:00Z' }, now),
  ).toBe(false)
  expect(
    isActiveInviteCode({ current_uses: 1, max_uses: 3, expires_at: '2026-10-03T00:00:00Z' }, now),
  ).toBe(true)
})

test('countCreatedSince numără doar rândurile din fereastra de 7 zile', () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  const since = now - NEW_USERS_WINDOW_MS
  expect(
    countCreatedSince(
      [
        { created_at: new Date(since - 1).toISOString() },
        { created_at: new Date(since).toISOString() },
        { created_at: new Date(now).toISOString() },
      ],
      since,
    ),
  ).toBe(2)
})

test('getAdminStats citește contoarele din tabelele reale și codurile active', async () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  raspuns = {
    profiles: { data: null, error: null, count: 11 },
    coach_profiles: { data: null, error: null, count: 4 },
    clubs: { data: null, error: null, count: 3 },
    courses: { data: null, error: null, count: 7 },
    camps: { data: null, error: null, count: 2 },
    competitions: { data: null, error: null, count: 1 },
    admin_users: {
      data: [
        { created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      error: null,
    },
    coach_invitation_codes: {
      data: [
        { current_uses: 0, max_uses: 1, expires_at: null },
        { current_uses: 1, max_uses: 1, expires_at: null },
      ],
      error: null,
    },
  }

  await expect(getAdminStats(now)).resolves.toEqual({
    users: 11,
    coaches: 4,
    clubs: 3,
    courses: 7,
    camps: 2,
    competitions: 1,
    newUsers7d: 1,
    activeInviteCodes: 1,
  })
  expect(cereri.profiles.some((c) => c.startsWith('select('))).toBe(true)
  expect(cereri.camps.some((c) => c.startsWith('select('))).toBe(true)
  expect(cereri.competitions.some((c) => c.startsWith('select('))).toBe(true)
})

test('getAdminStats aruncă dacă o numărătoare eșuează', async () => {
  raspuns = {
    profiles: { data: null, error: { message: 'boom' }, count: null },
  }
  await expect(getAdminStats()).rejects.toMatchObject({ message: 'boom' })
})
