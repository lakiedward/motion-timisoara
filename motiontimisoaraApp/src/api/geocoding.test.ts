import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { geocoding } from './geocoding'

/** Ce răspunde Photon la următoarea cerere, în ordinea în care se cer. */
let raspunsuri: unknown[] = []
/** URL-urile cerute, ca să putem verifica ce s-a trimis serverului. */
let cereri: string[] = []

const fetchFals = vi.fn(async (url: string) => {
  cereri.push(url)
  const body = raspunsuri.shift() ?? { features: [] }
  return { ok: true, json: async () => body } as unknown as Response
})

/** Un rezultat Photon: coordonatele sunt [longitudine, latitudine]. */
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

// Photon răspunde GeoJSON, deci [lon, lat] — invers față de cum scriem noi peste
// tot. Inversarea lor e greșeala clasică pe furnizorul ăsta: pinul ar ateriza în
// Somalia în loc de Timișoara, iar harta ar părea pur și simplu goală.
test('latitudinea și longitudinea nu se inversează la citirea răspunsului', async () => {
  raspunsuri = [{ features: [feature({ name: 'Test', city: 'Timișoara' }, 21.2408, 45.7601)] }]
  const [loc] = await geocoding.search('test')
  expect(loc.lat).toBe(45.7601)
  expect(loc.lng).toBe(21.2408)
})

// Pentru o stradă Photon lasă `street` gol și pune numele străzii în `name`.
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
        feature({ street: 'Bulevardul Take Ionescu', housenumber: '46C', city: 'Timișoara' }, 21.24, 45.76),
      ],
    },
  ]
  const [loc] = await geocoding.search('take ionescu 46')
  expect(loc.address).toBe('Bulevardul Take Ionescu 46C')
})

// Când rezultatul e chiar orașul, `name` e numele orașului. Fără garda asta,
// „Timișoara” ar ajunge scris în câmpul Adresă ca și cum ar fi o stradă.
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

// Photon poate întoarce același obiect OSM de două ori într-un răspuns, cu texte
// diferite — deci strângerea duplicatelor nu le unește, iar id-ul construit doar
// din osm_type + osm_id ar da două chei React identice. Verificat pe „Piața
// Victoriei”, unde eroarea chiar a apărut în consolă.
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

// `lang=ro` nu e o limbă suportată de Photon: întoarce un obiect de eroare în loc
// de rezultate, adică zero sugestii, în tăcere. `default` dă numele locale.
test('cererea cere lang=default, niciodată lang=ro', async () => {
  raspunsuri = [{ features: [] }]
  await geocoding.search('test')
  expect(cereri[0]).toContain('lang=default')
  expect(cereri[0]).not.toContain('lang=ro')
})

// Fără cutia din jurul Timișoarei, „Strada Alba Iulia” aduce și Aradul.
test('cererea limitează rezultatele la zona Timișoarei', async () => {
  raspunsuri = [{ features: [] }]
  await geocoding.search('alba iulia')
  expect(cereri[0]).toContain('bbox=21.13,45.68,21.33,45.82')
  expect(cereri[0]).toContain('lat=45.7489')
})

test('sub trei litere nu se întreabă serverul deloc', async () => {
  const rezultate = await geocoding.search('ta')
  expect(rezultate).toEqual([])
  expect(fetchFals).not.toHaveBeenCalled()
})

// Fără `layer=house`, un punct lângă centrul orașului întoarce poligonul
// orașului, deci un rezultat fără stradă. Dar dacă nu e nicio casă în apropiere,
// a doua încercare, fără filtru, măcar completează orașul.
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
    { features: [feature({ street: 'Strada Versului', housenumber: '10', city: 'Timișoara' }, 21.241, 45.733)] },
  ]
  const loc = await geocoding.reverse(45.733, 21.241)
  expect(cereri).toHaveLength(1)
  expect(loc?.address).toBe('Strada Versului 10')
})

test('un rezultat fără coordonate e aruncat, nu produce un punct invalid', async () => {
  raspunsuri = [{ features: [{ properties: { name: 'Fără geometrie' } }] }]
  expect(await geocoding.search('fara')).toEqual([])
})

// OSM taie un bulevard lung în segmente, iar Photon le întoarce pe toate: trei
// rânduri „Bulevardul Take Ionescu” deosebite doar prin codul poștal. Pe telefon
// umpleau lista și împingeau rezultatele utile afară.
test('segmentele aceleiași străzi se strâng într-un singur rând', async () => {
  const segment = (postcode: string) =>
    feature({ name: 'Bulevardul Take Ionescu', city: 'Timișoara', postcode }, 21.24, 45.76)
  raspunsuri = [
    {
      features: [
        segment('300050'),
        segment('300054'),
        segment('300065'),
        feature({ name: 'ISHO Offices', street: 'Bulevardul Take Ionescu', city: 'Timișoara' }, 21.242, 45.76),
      ],
    },
  ]
  const rezultate = await geocoding.search('take ionescu')
  expect(rezultate.map((r) => r.label)).toEqual(['Bulevardul Take Ionescu', 'ISHO Offices'])
})

// Locuri diferite cu același nume în orașe diferite rămân amândouă: strângerea e
// pe text vizibil, iar orașul face parte din el.
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

// Cerem furnizorului mai multe decât arătăm: cu limita egală, o căutare pe o
// stradă lungă ar rămâne cu două rezultate din cinci după strângere.
test('se cer mai multe rezultate decât se afișează, dar se arată cel mult cinci', async () => {
  raspunsuri = [
    { features: Array.from({ length: 10 }, (_, i) => feature({ name: `Locul ${i}`, city: 'Timișoara' }, 21.2 + i / 100, 45.7)) },
  ]
  const rezultate = await geocoding.search('locul')
  expect(cereri[0]).toContain('limit=10')
  expect(rezultate).toHaveLength(5)
})
