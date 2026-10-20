import { beforeEach, expect, test, vi } from 'vitest'

import { getAdminSessions } from './admin-sessions'

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[] = []
let rows: Record<string, unknown[]> = {}

function builder(table: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then')
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve({ data: rows[table] ?? [], error: null }))
      return (...args: unknown[]) => {
        calls.push({ table, method: prop, args })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => builder(table) } }))

const named = (id: string, name: string) => ({ id, name })

beforeEach(() => {
  calls = []
  rows = {}
})

test('reads a 30-day window and attributes sessions to clubs or independent coaches', async () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  rows = {
    course_occurrences: [
      {
        id: 'o1',
        starts_at: '2026-10-19T15:00:00Z',
        ends_at: '2026-10-19T16:00:00Z',
        course: {
          id: 'k1',
          name: 'Înot',
          location: { name: 'Bazin' },
          sport: named('s1', 'Înot'),
          club: named('c1', 'Delfinul'),
          coach: named('u1', 'Radu Stan'),
        },
      },
      {
        id: 'o2',
        starts_at: '2026-10-21T15:00:00Z',
        ends_at: '2026-10-21T16:00:00Z',
        course: {
          id: 'k2',
          name: 'Tenis',
          location: null,
          sport: null,
          club: null,
          coach: named('u2', ' Ana Rusu '),
        },
      },
    ],
    enrollments: [{ entity_id: 'k1' }, { entity_id: 'k1' }, { entity_id: 'k2' }],
    attendance: [{ occurrence_id: 'o1' }],
  }
  const sessions = await getAdminSessions(now)

  const window = calls.filter((c) => c.table === 'course_occurrences')
  expect(window.find((c) => c.method === 'gte')?.args).toEqual([
    'starts_at',
    '2026-09-20T12:00:00.000Z',
  ])
  expect(window.find((c) => c.method === 'lt')?.args).toEqual([
    'starts_at',
    '2026-11-19T12:00:00.000Z',
  ])
  expect(
    sessions.map((s) => [s.organizerKey, s.organizerName, s.enrolledCount, s.markedCount]),
  ).toEqual([
    ['club:c1', 'Delfinul', 2, 1],
    ['coach:u2', 'Ana Rusu', 1, 0],
  ])
  expect(sessions[1]).toMatchObject({ sportId: null, locationName: null, organizerKind: 'coach' })
})

test('skips the count queries when there are no sessions', async () => {
  expect(await getAdminSessions()).toEqual([])
  expect(calls.some((c) => c.table === 'enrollments')).toBe(false)
})
