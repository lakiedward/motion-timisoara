import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { geocoding } from './geocoding'

let raspunsuri: unknown[] = []

let cereri: string[] = []

const fetchFals = vi.fn(async (url: string) => {
  cereri.push(url)
  const body = raspunsuri.shift() ?? { features: [] }
  return { ok: true, json: async () => body } as unknown as Response
})

const feature = (properties: Record<string, unknown>, lng: number, lat: number) => ({
  properties,
  geometry: { type: 'Point', coordinates: [lng, lat] },
})

beforeEach(() => {
  raspunsuri = []
  cereri = []
  fetchFals.mockClear()
  vi.stubGlobal('fetch', fetchFals)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
test('latitudinea și longitudinea nu se inversează la citirea răspunsului', async () => {
  raspunsuri = [{ features: [feature({ name: 'Test', city: 'Timișoara' }, 21.2408, 45.7601)] }]
  const [loc] = await geocoding.search('test')
  expect(loc.lat).toBe(45.7601)
  expect(loc.lng).toBe(21.2408)
})
test('numele străzii e luat din name când street lipsește', async () => {
  raspunsuri = [
    { features: [feature({ name: 'Strada Alba Iulia', city: 'Timișoara' }, 21.22, 45.75)] },
  ]
  const [loc] = await geocoding.search('alba iulia')
  expect(loc.address).toBe('Strada Alba Iulia')
})

test('numărul casei se lipește de stradă', async () => {
  raspunsuri = [
    {
      features: [
        feature(
          { street: 'Bulevardul Take Ionescu', housenumber: '46C', city: 'Timișoara' },
          21.24,
          45.76,
        ),
      ],
    },
  ]
  const [loc] = await geocoding.search('take ionescu 46')
  expect(loc.address).toBe('Bulevardul Take Ionescu 46C')
})
test('un rezultat care e chiar orașul nu devine adresă', async () => {
  raspunsuri = [{ features: [feature({ name: 'Timișoara', city: 'Timișoara' }, 21.22, 45.75)] }]
  const [loc] = await geocoding.search('timisoara')
  expect(loc.address).toBeNull()
  expect(loc.city).toBe('Timișoara')
})

test('orașul cade pe town, apoi pe village, când city lipsește', async () => {
  raspunsuri = [{ features: [feature({ name: 'Sala', village: 'Dumbrăvița' }, 21.24, 45.79)] }]
  const [loc] = await geocoding.search('sala')
  expect(loc.city).toBe('Dumbrăvița')
})
test('două rezultate cu același obiect OSM primesc id-uri diferite', async () => {
  const acelasi = { osm_type: 'R', osm_id: 2637452, street: 'Piața Victoriei', city: 'Timișoara' }
  raspunsuri = [
    {
      features: [
        feature({ ...acelasi, housenumber: '1' }, 21.22, 45.75),
        feature({ ...acelasi, housenumber: '2' }, 21.221, 45.751),
      ],
    },
  ]
  const rezultate = await geocoding.search('piata victoriei')
  expect(rezultate).toHaveLength(2)
  expect(rezultate[0].id).not.toBe(rezultate[1].id)
})
test('cererea cere lang=default, niciodată lang=ro', async () => {
  raspunsuri = [{ features: [] }]
  await geocoding.search('test')
  expect(cereri[0]).toContain('lang=default')
  expect(cereri[0]).not.toContain('lang=ro')
})
test('cererea limitează rezultatele la România și păstrează bias-ul Timișoara', async () => {
  raspunsuri = [{ features: [] }]
  await geocoding.search('alba iulia')
  expect(cereri[0]).toContain('countrycode=RO')
  expect(cereri[0]).not.toContain('bbox=')
  expect(cereri[0]).toContain('lat=45.7489')
})

test('sub trei litere nu se întreabă serverul deloc', async () => {
  const rezultate = await geocoding.search('ta')
  expect(rezultate).toEqual([])
  expect(fetchFals).not.toHaveBeenCalled()
})

test('județul este separat de localitate și normalizat din state sau county', async () => {
  raspunsuri = [
    {
      features: [
        feature({ street: 'Strada Test', city: 'Arad', state: 'Județul Arad' }, 21.32, 46.17),
      ],
    },
  ]
  const [place] = await geocoding.search('test')
  expect(place.city).toBe('Arad')
  expect(place.county).toBe('Arad')
  raspunsuri = [{ features: [feature({ name: 'Timiș', county: 'Timiș' }, 21.2, 45.7)] }]
  const [county] = await geocoding.search('timis')
  expect(county.city).toBeNull()
  expect(county.address).toBeNull()
  expect(county.county).toBe('Timiș')
})

test('căutarea include localitatea și județul selectate fără limitarea Timișoara', async () => {
  await geocoding.search('Strada Sportului', undefined, { city: 'Arad', county: 'Arad' })
  expect(new URL(cereri[0]).searchParams.get('q')).toBe('Strada Sportului, Arad, Arad')
  expect(cereri[0]).not.toContain('bbox=')
})
test('reverse încearcă întâi casa, apoi orice, când nu găsește casă', async () => {
  raspunsuri = [
    { features: [] },
    { features: [feature({ name: 'Pădurea Verde', city: 'Timișoara' }, 21.27, 45.77)] },
  ]
  const loc = await geocoding.reverse(45.77, 21.27)
  expect(cereri[0]).toContain('layer=house')
  expect(cereri[1]).not.toContain('layer=house')
  expect(loc?.city).toBe('Timișoara')
})

test('reverse se oprește la prima încercare când găsește o casă', async () => {
  raspunsuri = [
    {
      features: [
        feature(
          { street: 'Strada Versului', housenumber: '10', city: 'Timișoara' },
          21.241,
          45.733,
        ),
      ],
    },
  ]
  const loc = await geocoding.reverse(45.733, 21.241)
  expect(cereri).toHaveLength(1)
  expect(loc?.address).toBe('Strada Versului 10')
})

test('un rezultat fără coordonate e aruncat, nu produce un punct invalid', async () => {
  raspunsuri = [{ features: [{ properties: { name: 'Fără geometrie' } }] }]
  expect(await geocoding.search('fara')).toEqual([])
})
test('segmentele aceleiași străzi se strâng într-un singur rând', async () => {
  const segment = (postcode: string) =>
    feature({ name: 'Bulevardul Take Ionescu', city: 'Timișoara', postcode }, 21.24, 45.76)
  raspunsuri = [
    {
      features: [
        segment('300050'),
        segment('300054'),
        segment('300065'),
        feature(
          { name: 'ISHO Offices', street: 'Bulevardul Take Ionescu', city: 'Timișoara' },
          21.242,
          45.76,
        ),
      ],
    },
  ]
  const rezultate = await geocoding.search('take ionescu')
  expect(rezultate.map((r) => r.label)).toEqual(['Bulevardul Take Ionescu', 'ISHO Offices'])
})
test('același nume în orașe diferite nu se strânge', async () => {
  raspunsuri = [
    {
      features: [
        feature({ name: 'Sala Sporturilor', city: 'Timișoara' }, 21.22, 45.75),
        feature({ name: 'Sala Sporturilor', city: 'Dumbrăvița' }, 21.24, 45.79),
      ],
    },
  ]
  expect(await geocoding.search('sala sporturilor')).toHaveLength(2)
})
test('se cer mai multe rezultate decât se afișează, dar se arată cel mult cinci', async () => {
  raspunsuri = [
    {
      features: Array.from({ length: 10 }, (_, i) =>
        feature({ name: `Locul ${i}`, city: 'Timișoara' }, 21.2 + i / 100, 45.7),
      ),
    },
  ]
  const rezultate = await geocoding.search('locul')
  expect(cereri[0]).toContain('limit=10')
  expect(rezultate).toHaveLength(5)
})
