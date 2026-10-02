import { beforeEach, expect, test, vi } from 'vitest'

import {
  countCreatedSince,
  formatAdminCount,
  getAdminStats,
  inviteCodeStatus,
  isActiveInviteCode,
  NEW_USERS_WINDOW_MS,
  POSTGREST_MAX_ROWS,
} from './admin'

let raspuns: Record<string, { data: unknown; error: unknown; count?: number | null }> = {}
let cereri: Record<string, string[]> = {}

function tabela(nume: string) {
  let key = nume
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[key] ?? { data: [], error: null, count: 0 }))
      }
      return (...args: unknown[]) => {
        ;(cereri[nume] ??= []).push(`${prop}(${args.map(String).join(',')})`)
        if (prop === 'gte' && String(args[0]) === 'created_at') key = `${nume}_since`
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (nume: string) => tabela(nume),
    rpc: async (nume: string) =>
      raspuns[nume] ?? { data: null, error: { message: `missing ${nume}` } },
  },
}))

beforeEach(() => {
  raspuns = {}
  cereri = {}
})

function tabeleDeBaza() {
  return {
    profiles: { data: null, error: null, count: 11 },
    coach_profiles: { data: null, error: null, count: 4 },
    clubs: { data: null, error: null, count: 3 },
    courses: { data: null, error: null, count: 7 },
    camps: { data: null, error: null, count: 2 },
    competitions: { data: null, error: null, count: 1 },
  }
}

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

test('inviteCodeStatus distinge folosit, expirat și activ', () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  expect(inviteCodeStatus({ current_uses: 1, max_uses: 1, expires_at: null }, now)).toBe('used')
  expect(
    inviteCodeStatus({ current_uses: 0, max_uses: 1, expires_at: '2026-10-02T11:00:00Z' }, now),
  ).toBe('expired')
  expect(inviteCodeStatus({ current_uses: 0, max_uses: 1, expires_at: null }, now)).toBe('active')
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

test('formatAdminCount folosește separatorul românesc și marca de plafon', () => {
  expect(formatAdminCount(1234)).toBe('1.234')
  expect(formatAdminCount(1000, true)).toBe('1.000+')
})

test('getAdminStats preferă RPC-ul admin_stats când există', async () => {
  raspuns = {
    admin_stats: {
      data: {
        users: 20,
        coaches: 8,
        clubs: 3,
        courses: 9,
        camps: 4,
        competitions: 1,
        new_users_7d: 6,
        active_invite_codes: 2,
      },
      error: null,
    },
  }
  await expect(getAdminStats()).resolves.toEqual({
    users: { value: 20, error: null, capped: false },
    coaches: { value: 8, error: null, capped: false },
    clubs: { value: 3, error: null, capped: false },
    courses: { value: 9, error: null, capped: false },
    camps: { value: 4, error: null, capped: false },
    competitions: { value: 1, error: null, capped: false },
    newUsers7d: { value: 6, error: null, capped: false },
    activeInviteCodes: { value: 2, error: null, capped: false },
  })
  expect(cereri.profiles).toBeUndefined()
})

test('getAdminStats numără utilizatorii noi pe server când created_at e permis', async () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  raspuns = {
    ...tabeleDeBaza(),
    profiles_since: { data: null, error: null, count: 5 },
    coach_invitation_codes: {
      data: [
        { current_uses: 0, max_uses: 1, expires_at: null },
        { current_uses: 1, max_uses: 1, expires_at: null },
      ],
      error: null,
    },
  }
  const result = await getAdminStats(now)
  expect(result.users).toEqual({ value: 11, error: null, capped: false })
  expect(result.newUsers7d).toEqual({ value: 5, error: null, capped: false })
  expect(result.activeInviteCodes).toEqual({ value: 1, error: null, capped: false })
  expect(cereri.profiles.some((c) => c.startsWith('gte(created_at'))).toBe(true)
  expect(raspuns.admin_users).toBeUndefined()
})

test('getAdminStats cade pe admin_users când filtrul created_at e refuzat', async () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  raspuns = {
    ...tabeleDeBaza(),
    profiles_since: { data: null, error: { message: 'permission denied for column created_at' } },
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
    users: { value: 11, error: null, capped: false },
    coaches: { value: 4, error: null, capped: false },
    clubs: { value: 3, error: null, capped: false },
    courses: { value: 7, error: null, capped: false },
    camps: { value: 2, error: null, capped: false },
    competitions: { value: 1, error: null, capped: false },
    newUsers7d: { value: 1, error: null, capped: false },
    activeInviteCodes: { value: 1, error: null, capped: false },
  })
  expect(cereri.profiles.some((c) => c.startsWith('select('))).toBe(true)
  expect(cereri.camps.some((c) => c.startsWith('select('))).toBe(true)
})

test('getAdminStats marchează plafonul de 1000 pe fallback-ul de utilizatori noi', async () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  const rows = Array.from({ length: POSTGREST_MAX_ROWS }, () => ({
    created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
  }))
  raspuns = {
    ...tabeleDeBaza(),
    profiles_since: { data: null, error: { message: 'no created_at' } },
    admin_users: { data: rows, error: null },
    coach_invitation_codes: { data: [], error: null },
  }
  const result = await getAdminStats(now)
  expect(result.newUsers7d).toEqual({ value: POSTGREST_MAX_ROWS, error: null, capped: true })
})

test('getAdminStats nu aruncă dacă o numărătoare eșuează', async () => {
  raspuns = {
    ...tabeleDeBaza(),
    camps: { data: null, error: { message: 'boom' }, count: null },
    profiles_since: { data: null, error: null, count: 2 },
    coach_invitation_codes: { data: [], error: null },
  }
  const result = await getAdminStats()
  expect(result.users).toEqual({ value: 11, error: null, capped: false })
  expect(result.camps).toEqual({
    value: null,
    error: 'Nu am putut încărca numărul de tabere.',
  })
  expect(result.newUsers7d).toEqual({ value: 2, error: null, capped: false })
})
