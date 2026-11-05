import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  getCoachRatingSummary,
  getCourseRatingSummary,
  getMyCoachRating,
  getMyCourseRating,
  submitCoachRating,
  submitCourseRating,
} from './ratings'

type Raspuns = { data: unknown; error: unknown }
type Apel = { tabel: string; metoda: string; argumente: unknown[] }

let raspunsuri: Record<string, Raspuns> = {}
let apeluri: Apel[] = []
let sesiune: { user: { id: string } } | null = null

function builder(tabel: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, metoda: string) {
      if (metoda === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspunsuri[tabel] ?? { data: [], error: null }))
      }
      return (...argumente: unknown[]) => {
        apeluri.push({ tabel, metoda, argumente })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabel: string) => builder(tabel),
    auth: {
      getSession: () => Promise.resolve({ data: { session: sesiune } }),
    },
  },
}))

const ok = (data: unknown): Raspuns => ({ data, error: null })
const eroare = (mesaj: string): Raspuns => ({ data: null, error: new Error(mesaj) })

function metoda(tabel: string, nume: string) {
  return apeluri.filter((a) => a.tabel === tabel && a.metoda === nume)
}

beforeEach(() => {
  raspunsuri = {}
  apeluri = []
  sesiune = null
})

describe.each([
  {
    nume: 'curs',
    tabel: 'course_ratings',
    coloana: 'course_id',
    rezumat: getCourseRatingSummary,
    alMeu: getMyCourseRating,
    trimite: submitCourseRating,
  },
  {
    nume: 'antrenor',
    tabel: 'coach_ratings',
    coloana: 'coach_id',
    rezumat: getCoachRatingSummary,
    alMeu: getMyCoachRating,
    trimite: submitCoachRating,
  },
])('evaluări pentru $nume', ({ tabel, coloana, rezumat, alMeu, trimite }) => {
  test('rezumatul face media și numără evaluările din tabelul potrivit', async () => {
    raspunsuri[tabel] = ok([{ rating: 5 }, { rating: 4 }, { rating: 3 }])
    const rezultat = await rezumat('e1')
    expect(rezultat).toEqual({ avg: 4, count: 3 })
    expect(metoda(tabel, 'select')[0].argumente).toEqual(['rating'])
    expect(metoda(tabel, 'eq')[0].argumente).toEqual([coloana, 'e1'])
  })

  test('rezumatul păstrează media fracționară', async () => {
    raspunsuri[tabel] = ok([{ rating: 5 }, { rating: 4 }])
    expect(await rezumat('e1')).toEqual({ avg: 4.5, count: 2 })
  })

  test('fără evaluări rezumatul este zero, nu NaN', async () => {
    raspunsuri[tabel] = ok([])
    expect(await rezumat('e1')).toEqual({ avg: 0, count: 0 })
  })

  test('un răspuns fără date (null) este tratat ca listă goală', async () => {
    raspunsuri[tabel] = ok(null)
    expect(await rezumat('e1')).toEqual({ avg: 0, count: 0 })
  })

  test('rezumatul aruncă eroarea primită de la bază', async () => {
    raspunsuri[tabel] = eroare('rls')
    await expect(rezumat('e1')).rejects.toThrow('rls')
  })

  test('evaluarea mea este null când nu există sesiune și nu interoghează baza', async () => {
    expect(await alMeu('e1')).toBeNull()
    expect(apeluri).toEqual([])
  })

  test('evaluarea mea filtrează după entitate și după părintele din sesiune', async () => {
    sesiune = { user: { id: 'p1' } }
    raspunsuri[tabel] = ok({ rating: 4 })
    expect(await alMeu('e1')).toBe(4)
    expect(metoda(tabel, 'eq').map((a) => a.argumente)).toEqual([
      [coloana, 'e1'],
      ['parent_id', 'p1'],
    ])
    expect(metoda(tabel, 'maybeSingle')).toHaveLength(1)
  })

  test('evaluarea mea este null când părintele nu a votat încă', async () => {
    sesiune = { user: { id: 'p1' } }
    raspunsuri[tabel] = ok(null)
    expect(await alMeu('e1')).toBeNull()
  })

  test('trimiterea fără sesiune aruncă Not authenticated și nu scrie nimic', async () => {
    await expect(trimite('e1', 5)).rejects.toThrow('Not authenticated')
    expect(apeluri).toEqual([])
  })

  test('trimiterea face upsert pe perechea entitate + părinte', async () => {
    sesiune = { user: { id: 'p1' } }
    await trimite('e1', 5)
    expect(metoda(tabel, 'upsert')).toEqual([
      {
        tabel,
        metoda: 'upsert',
        argumente: [
          { [coloana]: 'e1', parent_id: 'p1', rating: 5 },
          { onConflict: `${coloana},parent_id` },
        ],
      },
    ])
  })

  test('trimiterea aruncă eroarea primită de la bază', async () => {
    sesiune = { user: { id: 'p1' } }
    raspunsuri[tabel] = eroare('constraint')
    await expect(trimite('e1', 5)).rejects.toThrow('constraint')
  })
})
