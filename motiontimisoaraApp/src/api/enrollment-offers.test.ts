import { beforeEach, expect, test, vi } from 'vitest'

import { enrollmentOffers } from './enrollment-offers'

type Raspuns = { data: unknown; error: unknown }
type Apel = { tabel: string; metoda: string; argumente: unknown[] }

let raspunsuri: Record<string, Raspuns> = {}
let apeluri: Apel[] = []

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
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (cale: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${cale}` } }),
      }),
    },
  },
}))

const acum = new Date('2026-11-05T10:00:00Z')

const ok = (data: unknown): Raspuns => ({ data, error: null })

function interogari(tabel: string) {
  return apeluri.filter((a) => a.tabel === tabel)
}

beforeEach(() => {
  raspunsuri = {}
  apeluri = []
})

test('fără înscrieri nu pornește nicio interogare și întoarce o hartă goală', async () => {
  const rezultat = await enrollmentOffers([], acum)
  expect(rezultat.size).toBe(0)
  expect(apeluri).toEqual([])
})

test('un tip necunoscut de înscriere este ignorat', async () => {
  const rezultat = await enrollmentOffers([{ kind: 'WORKSHOP', entity_id: 'x' }], acum)
  expect(rezultat.size).toBe(0)
  expect(apeluri).toEqual([])
})

test('concursul primește ruta, imaginea din bucket și momentul de start', async () => {
  raspunsuri.competitions = ok([
    {
      id: 'c1',
      title: '  Cupa Timișoarei  ',
      slug: 'cupa-timisoarei',
      hero_photo_storage_path: 'c1/hero.jpg',
      start_at: '2026-12-01T08:00:00Z',
    },
  ])
  const rezultat = await enrollmentOffers([{ kind: 'COMPETITION', entity_id: 'c1' }], acum)
  expect(rezultat.get('COMPETITION:c1')).toEqual({
    title: 'Cupa Timișoarei',
    path: '/concursuri/cupa-timisoarei',
    imageUrl: 'https://cdn.test/competition-photos/c1/hero.jpg',
    sportCode: null,
    sportName: null,
    schedule: { type: 'moment', startsAt: '2026-12-01T08:00:00Z' },
  })
})

test('concursul fără dată de start nu are program', async () => {
  raspunsuri.competitions = ok([
    { id: 'c1', title: 'Cupa', slug: 'cupa', hero_photo_storage_path: null, start_at: null },
  ])
  const rezultat = await enrollmentOffers([{ kind: 'COMPETITION', entity_id: 'c1' }], acum)
  const oferta = rezultat.get('COMPETITION:c1')
  expect(oferta?.schedule).toBeNull()
  expect(oferta?.imageUrl).toBeNull()
})

test('tabăra are perioadă când ambele capete sunt setate', async () => {
  raspunsuri.camps = ok([
    {
      id: 'k1',
      title: 'Tabăra de vară ',
      slug: 'vara',
      hero_photo_storage_path: 'k1.jpg',
      period_start: '2026-07-01',
      period_end: '2026-07-07',
    },
    {
      id: 'k2',
      title: 'Tabăra de iarnă',
      slug: 'iarna',
      hero_photo_storage_path: null,
      period_start: '2026-12-20',
      period_end: null,
    },
  ])
  const rezultat = await enrollmentOffers(
    [
      { kind: 'CAMP', entity_id: 'k1' },
      { kind: 'CAMP', entity_id: 'k2' },
    ],
    acum,
  )
  expect(rezultat.get('CAMP:k1')).toMatchObject({
    title: 'Tabăra de vară',
    path: '/tabere/vara',
    imageUrl: 'https://cdn.test/camp-photos/k1.jpg',
    schedule: { type: 'period', start: '2026-07-01', end: '2026-07-07' },
  })
  expect(rezultat.get('CAMP:k2')?.schedule).toBeNull()
})

test('cursul primește prima ședință viitoare, sportul și imaginea sportului ca rezervă', async () => {
  raspunsuri.courses = ok([
    {
      id: 'a',
      name: ' Înot începători ',
      hero_photo_storage_path: null,
      course_photos: [],
      sport: { code: 'SWIM', name: 'Înot', default_photo_storage_path: 'inot.jpg' },
    },
    {
      id: 'b',
      name: 'Atletism',
      hero_photo_storage_path: null,
      course_photos: [],
      sport: null,
    },
  ])
  raspunsuri.course_occurrences = ok([
    { course_id: 'a', starts_at: '2026-11-06T16:00:00Z' },
    { course_id: 'a', starts_at: '2026-11-13T16:00:00Z' },
  ])
  const rezultat = await enrollmentOffers(
    [
      { kind: 'COURSE', entity_id: 'a' },
      { kind: 'COURSE', entity_id: 'b' },
    ],
    acum,
  )
  expect(rezultat.get('COURSE:a')).toEqual({
    title: 'Înot începători',
    path: '/cursuri/a',
    imageUrl: 'https://cdn.test/sport-photos/inot.jpg',
    sportCode: 'SWIM',
    sportName: 'Înot',
    schedule: { type: 'session', startsAt: '2026-11-06T16:00:00Z' },
  })
  expect(rezultat.get('COURSE:b')).toMatchObject({
    sportCode: null,
    sportName: null,
    imageUrl: null,
    schedule: null,
  })
})

test('ședințele se cer doar din momentul curent, în ordine cronologică', async () => {
  raspunsuri.courses = ok([
    { id: 'a', name: 'Curs', hero_photo_storage_path: null, course_photos: [], sport: null },
  ])
  await enrollmentOffers([{ kind: 'COURSE', entity_id: 'a' }], acum)
  const ocurente = interogari('course_occurrences')
  expect(ocurente.find((a) => a.metoda === 'gte')?.argumente).toEqual([
    'starts_at',
    '2026-11-05T10:00:00.000Z',
  ])
  expect(ocurente.find((a) => a.metoda === 'order')?.argumente).toEqual([
    'starts_at',
    { ascending: true },
  ])
})

test('imaginea cursului preferă poza de copertă, apoi prima poză din galerie', async () => {
  raspunsuri.courses = ok([
    {
      id: 'a',
      name: 'Cu copertă',
      hero_photo_storage_path: 'coperta.jpg',
      course_photos: [{ storage_path: 'g1.jpg', display_order: 1 }],
      sport: null,
    },
    {
      id: 'b',
      name: 'Doar galerie',
      hero_photo_storage_path: null,
      course_photos: [
        { storage_path: 'g2.jpg', display_order: 2 },
        { storage_path: 'g1.jpg', display_order: 1 },
      ],
      sport: null,
    },
  ])
  const rezultat = await enrollmentOffers(
    [
      { kind: 'COURSE', entity_id: 'a' },
      { kind: 'COURSE', entity_id: 'b' },
    ],
    acum,
  )
  expect(rezultat.get('COURSE:a')?.imageUrl).toBe('https://cdn.test/course-photos/coperta.jpg')
  expect(rezultat.get('COURSE:b')?.imageUrl).toBe('https://cdn.test/course-photos/g1.jpg')
})

test('activitatea are program pe zi, cu orele din rând', async () => {
  raspunsuri.activities = ok([
    {
      id: 'x',
      name: 'Aquathlon ',
      hero_photo_storage_path: 'x.jpg',
      activity_date: '2026-11-20',
      start_time: '10:00:00',
      end_time: '12:00:00',
      sport: { code: 'TRI', name: 'Triatlon', default_photo_storage_path: null },
    },
    {
      id: 'y',
      name: 'Fără dată',
      hero_photo_storage_path: null,
      activity_date: null,
      start_time: null,
      end_time: null,
      sport: null,
    },
  ])
  const rezultat = await enrollmentOffers(
    [
      { kind: 'ACTIVITY', entity_id: 'x' },
      { kind: 'ACTIVITY', entity_id: 'y' },
    ],
    acum,
  )
  expect(rezultat.get('ACTIVITY:x')).toEqual({
    title: 'Aquathlon',
    path: '/activitati/x',
    imageUrl: 'https://cdn.test/activity-photos/x.jpg',
    sportCode: 'TRI',
    sportName: 'Triatlon',
    schedule: { type: 'day', date: '2026-11-20', startTime: '10:00:00', endTime: '12:00:00' },
  })
  expect(rezultat.get('ACTIVITY:y')?.schedule).toBeNull()
})

test('același id de oferte repetat se cere o singură dată, iar tipurile nu se amestecă', async () => {
  raspunsuri.camps = ok([
    {
      id: 'same',
      title: 'Tabără',
      slug: 't',
      hero_photo_storage_path: null,
      period_start: null,
      period_end: null,
    },
  ])
  raspunsuri.competitions = ok([
    { id: 'same', title: 'Concurs', slug: 'c', hero_photo_storage_path: null, start_at: null },
  ])
  const rezultat = await enrollmentOffers(
    [
      { kind: 'CAMP', entity_id: 'same' },
      { kind: 'CAMP', entity_id: 'same' },
      { kind: 'COMPETITION', entity_id: 'same' },
    ],
    acum,
  )
  expect(interogari('camps').find((a) => a.metoda === 'in')?.argumente).toEqual(['id', ['same']])
  expect([...rezultat.keys()].sort()).toEqual(['CAMP:same', 'COMPETITION:same'])
  expect(rezultat.get('CAMP:same')?.title).toBe('Tabără')
  expect(rezultat.get('COMPETITION:same')?.title).toBe('Concurs')
})

test('nu interoghează tabelele tipurilor care nu apar în înscrieri', async () => {
  raspunsuri.camps = ok([])
  await enrollmentOffers([{ kind: 'CAMP', entity_id: 'k' }], acum)
  expect(interogari('camps').length).toBeGreaterThan(0)
  expect(interogari('courses')).toEqual([])
  expect(interogari('activities')).toEqual([])
  expect(interogari('competitions')).toEqual([])
})

test('o eroare de la bază se propagă', async () => {
  raspunsuri.activities = { data: null, error: new Error('rls') }
  await expect(enrollmentOffers([{ kind: 'ACTIVITY', entity_id: 'x' }], acum)).rejects.toThrow('rls')
})

test('o eroare la ședințele cursului se propagă', async () => {
  raspunsuri.courses = ok([])
  raspunsuri.course_occurrences = { data: null, error: new Error('occ') }
  await expect(enrollmentOffers([{ kind: 'COURSE', entity_id: 'a' }], acum)).rejects.toThrow('occ')
})
