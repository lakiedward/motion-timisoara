import { beforeEach, expect, test, vi } from 'vitest'

import {
  activitateSAincheiat,
  activitatiVizibile,
  activityHeroUrl,
  getActivitateDetaliu,
  getActivitatiPublice,
} from './public'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}
let apeluriRpc: { nume: string; argumente: unknown }[] = []
let rpcPentru: (id: string) => { data: unknown; error: unknown } = () => ({
  data: 11,
  error: null,
})

function tabela(nume: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[nume] ?? { data: [], error: null }))
      }
      return () => proxy
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (nume: string) => tabela(nume),
    rpc: async (nume: string, argumente: { p_activity_id: string }) => {
      apeluriRpc.push({ nume, argumente })
      return rpcPentru(argumente.p_activity_id)
    },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://public/${bucket}/${path}` },
        }),
      }),
    },
  },
}))

const ACUM = new Date('2026-09-24T12:00:00Z')

function rand(
  peste: Partial<{
    id: string
    name: string
    activity_date: string
    start_time: string
    end_time: string
    price: number
    currency: string
    hero_photo_storage_path: string | null
    sport: {
      id: string
      code: string
      name: string
      default_photo_storage_path: string | null
    } | null
    location: { name: string } | null
    club: { name: string } | null
    coach: { name: string } | null
  }> = {},
) {
  return {
    id: 'viitoare',
    name: 'DEMO — Atelier de ciclism',
    activity_date: '2026-09-26',
    start_time: '10:00:00',
    end_time: '12:00:00',
    price: 2000,
    currency: 'EUR',
    hero_photo_storage_path: null,
    sport: {
      id: 's',
      code: 'ciclism',
      name: 'Ciclism',
      default_photo_storage_path: 'ciclism.jpg',
    },
    location: { name: 'DEMO — Parc de antrenament' },
    club: { name: 'DEMO — Club Sportiv Motion' },
    coach: { name: 'Antrenor Demo' },
    ...peste,
  }
}

beforeEach(() => {
  raspuns = {}
  apeluriRpc = []
  rpcPentru = () => ({ data: 11, error: null })
})

test('o activitate se încheie la ora de final, în Europa/București', () => {
  expect(activitateSAincheiat('2026-06-25', '12:00:00', ACUM)).toBe(true)
  expect(activitateSAincheiat('2026-09-26', '12:00:00', ACUM)).toBe(false)
  expect(activitateSAincheiat('2026-09-24', '12:00:00', new Date('2026-09-24T08:59:59Z'))).toBe(
    false,
  )
  expect(activitateSAincheiat('2026-09-24', '12:00:00', new Date('2026-09-24T09:00:00Z'))).toBe(
    true,
  )
  expect(activitateSAincheiat('2026-01-10', '12:00:00', new Date('2026-01-10T09:59:00Z'))).toBe(
    false,
  )
  expect(activitateSAincheiat('2026-01-10', '12:00:00', new Date('2026-01-10T10:00:00Z'))).toBe(
    true,
  )
})

test('lista ține doar activitățile neîncheiate, cea mai apropiată prima', () => {
  expect(
    activitatiVizibile(
      [
        { activity_date: '2026-07-05', start_time: '09:00:00', end_time: '11:00:00', name: 'cros' },
        {
          activity_date: '2026-09-26',
          start_time: '10:00:00',
          end_time: '12:00:00',
          name: 'seara',
        },
        { activity_date: '2026-06-25', start_time: '10:00:00', end_time: '12:00:00', name: 'inot' },
        {
          activity_date: '2026-09-26',
          start_time: '08:00:00',
          end_time: '09:00:00',
          name: 'dimineata',
        },
      ],
      ACUM,
    ).map((rand) => rand.name),
  ).toEqual(['dimineata', 'seara'])
})

test('poza activității câștigă, apoi poza sportului', () => {
  expect(
    activityHeroUrl({
      hero_photo_storage_path: 'a/hero.jpg',
      sport: { default_photo_storage_path: 's.jpg' },
    }),
  ).toBe('https://public/activity-photos/a/hero.jpg')
  expect(
    activityHeroUrl({
      hero_photo_storage_path: null,
      sport: { default_photo_storage_path: 's.jpg' },
    }),
  ).toBe('https://public/sport-photos/s.jpg')
  expect(activityHeroUrl({ hero_photo_storage_path: null, sport: null })).toBeNull()
})

test('cererea publică scoate zilele trecute și cere locurile doar pentru ce rămâne', async () => {
  raspuns.activities = {
    data: [rand({ id: 'trecuta', name: 'Workshop de înot', activity_date: '2026-06-25' }), rand()],
    error: null,
  }
  const lista = await getActivitatiPublice(ACUM)
  expect(lista.map((a) => a.name)).toEqual(['DEMO — Atelier de ciclism'])
  expect(apeluriRpc).toEqual([
    { nume: 'activity_spots_remaining', argumente: { p_activity_id: 'viitoare' } },
  ])
  expect(lista[0]).toMatchObject({
    locationName: 'DEMO — Parc de antrenament',
    sportName: 'Ciclism',
    heroUrl: 'https://public/sport-photos/ciclism.jpg',
    organizator: 'DEMO — Club Sportiv Motion',
    locuriRamase: 11,
    price: 2000,
    currency: 'EUR',
  })
})

test('fără club, organizatorul este antrenorul', async () => {
  raspuns.activities = { data: [rand({ club: null })], error: null }
  const lista = await getActivitatiPublice(ACUM)
  expect(lista[0]?.organizator).toBe('Antrenor Demo')
})

test('locurile eșuate opresc lista, nu inventează un număr', async () => {
  raspuns.activities = { data: [rand()], error: null }
  rpcPentru = () => ({ data: null, error: { message: 'rpc' } })
  await expect(getActivitatiPublice(ACUM)).rejects.toEqual({ message: 'rpc' })
})

function randDetaliu(
  peste: Record<string, unknown> = {},
  club: Record<string, unknown> | null = {
    id: 'club-1',
    name: 'DEMO — Club Sportiv Motion',
    logo_storage_path: null,
  },
) {
  return {
    id: 'viitoare',
    name: 'DEMO — Atelier de ciclism',
    description: 'Atelier de mecanică și traseu scurt.',
    activity_date: '2026-09-26',
    start_time: '10:00:00',
    end_time: '12:00:00',
    price: 2000,
    currency: 'EUR',
    eur_ron_rate_micros: 5_100_000,
    hero_photo_storage_path: null,
    rules_file_storage_path: null,
    rules_file_name: null,
    rules_file_content_type: null,
    rules_file_size_bytes: null,
    sport: {
      id: 's',
      code: 'ciclism',
      name: 'Ciclism',
      default_photo_storage_path: 'ciclism.jpg',
    },
    location: { name: 'DEMO — Parc de antrenament', lat: 45.751, lng: 21.238 },
    club,
    coach: { id: 'coach-1', name: 'Antrenor Demo', avatar_url: null },
    ...peste,
  }
}

test('detaliul aruncă la eroare și întoarce null când rândul lipsește', async () => {
  raspuns.activities = { data: null, error: { message: 'down' } }
  await expect(getActivitateDetaliu('x')).rejects.toEqual({ message: 'down' })
  raspuns.activities = { data: null, error: null }
  await expect(getActivitateDetaliu('x')).resolves.toBeNull()
  expect(apeluriRpc).toEqual([])
})

test('clubul e organizatorul, antrenorul stă separat, iar galeria ia poza sportului', async () => {
  raspuns.activities = { data: randDetaliu(), error: null }
  raspuns.coach_profiles = { data: { photo_storage_path: 'demo.jpg' }, error: null }
  const detaliu = await getActivitateDetaliu('viitoare')
  expect(detaliu?.organizator).toEqual({
    id: 'club-1',
    nume: 'DEMO — Club Sportiv Motion',
    link: '/cluburi/club-1',
    pozaUrl: null,
  })
  expect(detaliu?.antrenori).toEqual([
    {
      id: 'coach-1',
      nume: 'Antrenor Demo',
      link: '/antrenori/coach-1',
      pozaUrl: 'https://public/coach-photos/demo.jpg',
    },
  ])
  expect(detaliu?.galerieUrls).toEqual(['https://public/sport-photos/ciclism.jpg'])
  expect(detaliu?.bandUrl).toBeNull()
  expect(detaliu?.locuriRamase).toBe(11)
  expect(apeluriRpc).toEqual([
    { nume: 'activity_spots_remaining', argumente: { p_activity_id: 'viitoare' } },
  ])
})

test('fără club, antrenorul e organizatorul și nu mai apare la ceilalți', async () => {
  raspuns.activities = { data: randDetaliu({}, null), error: null }
  const detaliu = await getActivitateDetaliu('viitoare')
  expect(detaliu?.organizator?.nume).toBe('Antrenor Demo')
  expect(detaliu?.organizator?.link).toBe('/antrenori/coach-1')
  expect(detaliu?.antrenori).toEqual([])
})

test('poza activității intră în galerie înaintea pozei sportului', async () => {
  raspuns.activities = {
    data: randDetaliu({ hero_photo_storage_path: 'a/hero.jpg' }),
    error: null,
  }
  const detaliu = await getActivitateDetaliu('viitoare')
  expect(detaliu?.galerieUrls).toEqual(['https://public/activity-photos/a/hero.jpg'])
  expect(detaliu?.bandUrl).toBe('https://public/activity-photos/a/hero.jpg')
})

test('activitatea din preview primește descrierea lungă și cel puțin șase poze', async () => {
  raspuns.activities = {
    data: randDetaliu({
      id: '74a9d327-fb4e-450f-866f-f24575edc204',
      description: 'Siguranță și îndemânare pe bicicletă.',
      sport: {
        id: 's',
        code: 'ciclism',
        name: 'Ciclism',
        default_photo_storage_path: '/ui/20221013_183129.webp',
      },
    }),
    error: null,
  }
  const detaliu = await getActivitateDetaliu('74a9d327-fb4e-450f-866f-f24575edc204')
  const paragrafe = detaliu?.description?.split(/\n\s*\n/) ?? []
  expect(paragrafe.length).toBeGreaterThanOrEqual(3)
  expect(paragrafe[0]).toBe('Siguranță și îndemânare pe bicicletă.')
  expect(detaliu?.bandUrl).toBeNull()
  expect(detaliu?.galerieUrls[0]).toBe('/ui/20221013_183129.webp')
  expect(detaliu?.galerieUrls.length).toBeGreaterThanOrEqual(6)
  expect(new Set(detaliu?.galerieUrls).size).toBe(detaliu?.galerieUrls.length)
})

test('locurile rămase pot fi zero sau necunoscute, fără să fie inventate', async () => {
  raspuns.activities = { data: randDetaliu(), error: null }
  rpcPentru = () => ({ data: 0, error: null })
  expect((await getActivitateDetaliu('viitoare'))?.locuriRamase).toBe(0)
  rpcPentru = () => ({ data: null, error: null })
  expect((await getActivitateDetaliu('viitoare'))?.locuriRamase).toBeNull()
  rpcPentru = () => ({ data: null, error: { message: 'rpc' } })
  await expect(getActivitateDetaliu('viitoare')).rejects.toEqual({ message: 'rpc' })
})
