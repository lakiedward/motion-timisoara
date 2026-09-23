import { beforeEach, expect, test, vi } from 'vitest'

import {
  coloaneProprietar,
  createConcurs,
  getConcursuriPublice,
  getConcursurileMele,
  organizatorDinLegaturi,
  slugConcurs,
  stergeConcurs,
} from './competitions'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}
let cereri: Record<string, string[]> = {}
let fisiereSterse: string[] = []

function tabela(nume: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[nume] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        ;(cereri[nume] ??= []).push(
          `${prop}(${args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(',')})`,
        )
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (nume: string) => tabela(nume),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (cale: string) => ({ data: { publicUrl: `https://public/${cale}` } }),
        remove: (cai: string[]) => {
          fisiereSterse.push(`${bucket}:${cai.join(',')}`)
          return Promise.resolve({ data: null, error: null })
        },
      }),
    },
  },
}))

beforeEach(() => {
  raspuns = {}
  cereri = {}
  fisiereSterse = []
})

test('proprietarul este clubul, antrenorul sau nimeni la admin', () => {
  expect(coloaneProprietar({ role: 'CLUB', clubId: 'club-1', coachUserId: null })).toEqual({
    club_id: 'club-1',
    coach_id: null,
  })
  expect(coloaneProprietar({ role: 'COACH', clubId: null, coachUserId: 'coach-1' })).toEqual({
    club_id: null,
    coach_id: 'coach-1',
  })
  expect(coloaneProprietar({ role: 'ADMIN', clubId: null, coachUserId: null })).toEqual({
    club_id: null,
    coach_id: null,
  })
})

test('slugul liber rămâne din titlu, iar cel ocupat primește un sufix scurt', () => {
  const id = '1234abcd-0000-0000-0000-000000000000'
  expect(slugConcurs('Cupa Timișoara', false, id)).toBe('cupa-timisoara')
  expect(slugConcurs('Cupa Timișoara', true, id)).toBe('cupa-timisoara-1234abcd')
  expect(slugConcurs('!!!', false, id)).toBe('')
  expect(slugConcurs('a'.repeat(80), true, id).length).toBeLessThanOrEqual(60)
})

test('organizatorul public este clubul sau antrenorul', () => {
  expect(organizatorDinLegaturi({ id: 'c1', name: 'Club Audit' }, null)).toEqual({
    fel: 'club',
    nume: 'Club Audit',
    link: '/cluburi/c1',
  })
  expect(organizatorDinLegaturi(null, { id: 'a1', name: 'Ana' })).toEqual({
    fel: 'antrenor',
    nume: 'Ana',
    link: '/antrenori/a1',
  })
  expect(organizatorDinLegaturi(null, null)).toBeNull()
})

test('lista clubului filtrează după club, iar adminul vede tot', async () => {
  await getConcursurileMele({ role: 'CLUB', clubId: 'club-1', coachUserId: null })
  expect(cereri.competitions.join(' ')).toContain('eq(club_id,club-1)')

  cereri = {}
  await getConcursurileMele({ role: 'ADMIN', clubId: null, coachUserId: null })
  expect(cereri.competitions.join(' ')).not.toContain('eq(')
})

test('lista publică păstrează hero-ul și organizatorul', async () => {
  raspuns.competitions = {
    data: [
      {
        id: 'k1',
        slug: 'cupa',
        title: 'Cupa',
        description: 'Traseu scurt.',
        hero_photo_storage_path: 'k1/hero/a.jpg',
        club_id: 'c1',
        coach_id: null,
        created_at: '2026-09-22T00:00:00Z',
        updated_at: '2026-09-22T00:00:00Z',
        club: { id: 'c1', name: 'Club Audit' },
        coach: null,
      },
    ],
    error: null,
  }
  const [concurs] = await getConcursuriPublice()
  expect(concurs.heroUrl).toBe('https://public/k1/hero/a.jpg')
  expect(concurs.organizator?.nume).toBe('Club Audit')
})

test('un titlu fără litere nu se salvează', async () => {
  await expect(
    createConcurs(
      {
        title: '???',
        description: 'Descriere.',
        start_at: '2026-10-01T07:00:00Z',
        end_at: '2026-10-01T09:00:00Z',
        registration_deadline_at: '2026-09-30T21:00:00Z',
        location_id: null,
        location_text: 'Timișoara',
        allow_cash: false,
      },
      { role: 'CLUB', clubId: 'club-1', coachUserId: null },
    ),
  ).rejects.toThrow('Titlul trebuie să conțină litere sau cifre.')
})

test('crearea pune slugul și proprietarul clubului', async () => {
  raspuns.competitions = { data: null, error: null }
  await createConcurs(
    {
      title: 'Cupa Audit',
      description: '  Descriere scurtă.  ',
      start_at: '2026-10-01T07:00:00Z',
      end_at: '2026-10-01T09:00:00Z',
      registration_deadline_at: '2026-09-30T21:00:00Z',
      location_id: null,
      location_text: 'Timișoara',
      allow_cash: false,
    },
    { role: 'CLUB', clubId: 'club-1', coachUserId: null },
  )
  const insert = cereri.competitions.find((c) => c.startsWith('insert('))
  expect(insert).toContain('"slug":"cupa-audit"')
  expect(insert).toContain('"club_id":"club-1"')
  expect(insert).toContain('"coach_id":null')
  expect(insert).toContain('"description":"Descriere scurtă."')
  expect(insert).toContain('"location_text":"Timișoara"')
})

test('ștergerea scoate poza cât timp rândul încă există', async () => {
  raspuns.competitions = {
    data: { hero_photo_storage_path: 'id-1/hero/a.jpg' },
    error: null,
  }
  await stergeConcurs('id-1')
  expect(fisiereSterse).toEqual(['competition-photos:id-1/hero/a.jpg'])
  const jurnal = cereri.competitions.join(' ')
  expect(jurnal.indexOf('select(')).toBeLessThan(jurnal.indexOf('delete('))
})
