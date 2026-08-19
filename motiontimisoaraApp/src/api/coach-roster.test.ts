import { beforeEach, expect, test, vi } from 'vitest'

import { getSessionRoster } from './coach'

/** Ce întoarce fiecare tabel la următoarea interogare. */
let raspuns: Record<string, { data: unknown; error: unknown }> = {}

function builder(table: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[table] ?? { data: [], error: null }))
      }
      return () => proxy
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'coach-1' } } } }) },
    from: (table: string) => builder(table),
  },
}))

const inscris = (id: string, name: string) => ({ child: { id, name, birth_date: '2016-05-01' } })

beforeEach(() => {
  raspuns = {}
})

// Criteriul 651: interogarea nu cere nicio ordine, deci ordonarea trebuie făcută
// explicit — altfel copiii pot apărea altfel la fiecare încărcare.
test('copiii vin alfabetic, cu diacriticele românești la locul lor', async () => {
  raspuns = {
    enrollments: {
      data: [
        inscris('c1', 'Ștefan Marinescu'),
        inscris('c2', 'Ana Dumitrescu'),
        inscris('c3', 'Luca Georgescu'),
        inscris('c4', 'Andrei Popescu'),
      ],
      error: null,
    },
    attendance: { data: [], error: null },
  }
  const roster = await getSessionRoster('curs', 'sedinta')
  expect(roster.map((r) => r.child_name)).toEqual([
    'Ana Dumitrescu',
    'Andrei Popescu',
    'Luca Georgescu',
    'Ștefan Marinescu',
  ])
})

test('ordinea nu depinde de ordinea în care vin rândurile din bază', async () => {
  const copii = [inscris('c1', 'Zoe Radu'), inscris('c2', 'Ana Dumitrescu')]
  raspuns = { enrollments: { data: copii, error: null }, attendance: { data: [], error: null } }
  const prima = await getSessionRoster('curs', 'sedinta')
  raspuns = {
    enrollments: { data: [...copii].reverse(), error: null },
    attendance: { data: [], error: null },
  }
  const aDoua = await getSessionRoster('curs', 'sedinta')
  expect(prima.map((r) => r.child_name)).toEqual(aDoua.map((r) => r.child_name))
})

// Criteriul 652: aici prezența e tot conținutul ecranului, nu un marcaj secundar —
// o eroare înghițită ar arăta ca o grupă goală.
test('eroarea la citirea înscrierilor nu e înghițită', async () => {
  raspuns = {
    enrollments: { data: null, error: { message: 'boom' } },
    attendance: { data: [], error: null },
  }
  await expect(getSessionRoster('curs', 'sedinta')).rejects.toBeTruthy()
})

test('eroarea la citirea prezențelor nu e înghițită', async () => {
  raspuns = {
    enrollments: { data: [inscris('c1', 'Ana Dumitrescu')], error: null },
    attendance: { data: null, error: { message: 'boom' } },
  }
  await expect(getSessionRoster('curs', 'sedinta')).rejects.toBeTruthy()
})

test('starea de pontare a fiecărui copil vine din prezențele ședinței', async () => {
  raspuns = {
    enrollments: {
      data: [inscris('c1', 'Ana Dumitrescu'), inscris('c2', 'Bogdan Ilie')],
      error: null,
    },
    attendance: { data: [{ child_id: 'c1', status: 'PRESENT' }], error: null },
  }
  const roster = await getSessionRoster('curs', 'sedinta')
  expect(roster.find((r) => r.child_id === 'c1')?.status).toBe('PRESENT')
  expect(roster.find((r) => r.child_id === 'c2')?.status).toBeNull()
  expect(roster[0].child_birth_date).toBe('2016-05-01')
})
