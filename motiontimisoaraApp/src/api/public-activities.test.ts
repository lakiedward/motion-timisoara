import { beforeEach, expect, test, vi } from 'vitest'

import {
  activitateSAincheiat,
  activitatiVizibile,
  activityHeroUrl,
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
