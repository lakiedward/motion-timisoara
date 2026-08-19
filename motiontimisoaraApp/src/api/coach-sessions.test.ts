import { beforeEach, expect, test, vi } from 'vitest'

import { getCoachSessions } from './coach'

/** Ce a cerut fiecare interogare, pe tabel. */
type Call = { table: string; method: string; args: unknown[] }
let calls: Call[] = []
/** Rândurile pe care le întoarce fiecare tabel, pe pagini. */
let pages: Record<string, unknown[][]> = {}
const pageCursor: Record<string, number> = {}

function builder(table: string) {
  const target = () => undefined
  const proxy: unknown = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) => {
          const queue = pages[table] ?? [[]]
          const idx = pageCursor[table] ?? 0
          pageCursor[table] = idx + 1
          return Promise.resolve(resolve({ data: queue[idx] ?? [], error: null }))
        }
      }
      return (...args: unknown[]) => {
        calls.push({ table, method: prop, args })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'coach-1' } } } }),
    },
    from: (table: string) => builder(table),
  },
}))

const occurrence = (id: string) => ({
  id,
  course_id: 'c1',
  starts_at: '2026-08-20T14:00:00.000Z',
  ends_at: '2026-08-20T15:00:00.000Z',
  course: { id: 'c1', name: 'Înot', coach_id: 'coach-1', location: { name: 'Bazin' } },
})

beforeEach(() => {
  calls = []
  pages = {}
  for (const k of Object.keys(pageCursor)) delete pageCursor[k]
})

function callsFor(table: string, method: string) {
  return calls.filter((c) => c.table === table && c.method === method)
}

// Regresie (Bugbot): `range` este LIMIT/OFFSET. Fără `order` pe o coloană unică,
// Postgres nu garantează aceeași ordine între cereri, deci paginile următoare pot
// sări sau repeta rânduri — exact când paginarea contează.
test('citirile paginate cer o ordine stabilă pe coloană unică', async () => {
  pages = {
    course_occurrences: [[occurrence('o1')], [occurrence('o2')]],
    enrollments: [[{ entity_id: 'c1' }]],
    attendance: [[{ occurrence_id: 'o1' }]],
  }
  await getCoachSessions()

  for (const table of ['enrollments', 'attendance']) {
    const orders = callsFor(table, 'order')
    expect(orders, `${table} trebuie să ceară o ordine`).toHaveLength(1)
    expect(orders[0].args[0]).toBe('id')
    const ranges = callsFor(table, 'range')
    expect(ranges.length, `${table} trebuie să pagineze`).toBeGreaterThan(0)
  }
})

test('paginarea continuă cât timp pagina vine plină și se oprește când nu mai e', async () => {
  const full = Array.from({ length: 1000 }, (_, i) => ({ occurrence_id: `o${i}` }))
  pages = {
    course_occurrences: [[occurrence('o1')], []],
    enrollments: [[{ entity_id: 'c1' }]],
    attendance: [full, [{ occurrence_id: 'ultima' }]],
  }
  const groups = await getCoachSessions()

  expect(callsFor('attendance', 'range')).toHaveLength(2)
  expect(callsFor('attendance', 'range')[0].args).toEqual([0, 999])
  expect(callsFor('attendance', 'range')[1].args).toEqual([1000, 1999])
  expect(groups.upcoming[0].attendance_recorded).toBe(true)
})

test('o eroare pe marcaje nu doboară lista de ședințe', async () => {
  pages = {
    course_occurrences: [[occurrence('o1')], []],
    enrollments: [[{ entity_id: 'c1' }]],
    attendance: [[]],
  }
  await expect(getCoachSessions()).resolves.toMatchObject({
    upcoming: [expect.objectContaining({ id: 'o1', attendance_recorded: false })],
  })
})
