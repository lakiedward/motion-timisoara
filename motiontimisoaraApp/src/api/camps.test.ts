import { beforeEach, expect, test, vi } from 'vitest'

import { formatZi, getTabaraDetaliu, getTaberePublice, sAIncheiat, sumaCategoriilor } from './camps'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}
let rpcRaspuns: { data: unknown; error: unknown } = { data: null, error: null }
let cereri: Record<string, string[]> = {}
let apeluriRpc: { nume: string; argumente: unknown }[] = []

function tabela(nume: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[nume] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        ;(cereri[nume] ??= []).push(`${prop}(${args.map(String).join(',')})`)
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (nume: string) => tabela(nume),
    rpc: async (nume: string, argumente: unknown) => {
      apeluriRpc.push({ nume, argumente })
      return rpcRaspuns
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

const TABARA = {
  id: 'camp-1',
  slug: 'tabara-inot',
  title: 'Tabără de înot',
  price: 90000,
  capacity: 20,
  allow_cash: false,
  period_start: '2026-09-13',
  period_end: '2026-09-18',
  hero_photo_storage_path: null,
}

beforeEach(() => {
  raspuns = {}
  rpcRaspuns = { data: null, error: null }
  cereri = {}
  apeluriRpc = []
})
test('o tabără s-a încheiat abia după ultima ei zi', () => {
  expect(sAIncheiat('2026-09-18', new Date(2026, 8, 18, 8, 0))).toBe(false)
  expect(sAIncheiat('2026-09-18', new Date(2026, 8, 18, 23, 59))).toBe(false)
  expect(sAIncheiat('2026-09-18', new Date(2026, 8, 19, 0, 30))).toBe(true)
  expect(sAIncheiat('2026-08-21', new Date(2026, 7, 27, 10, 0))).toBe(true)
})
test('ultima zi se socotește în fusul celui care se uită, nu în UTC', () => {
  expect(sAIncheiat('2026-09-18', new Date(2026, 8, 18, 10, 0))).toBe(false)
  const caMoment = new Date('2026-09-18')
  expect(caMoment.getTime()).toBe(Date.UTC(2026, 8, 18))
})
test('data se scrie ca ziua din bază, nu decalată cu una', () => {
  expect(formatZi('2026-09-13')).toBe('13.09.2026')
  expect(formatZi('2026-01-01')).toBe('01.01.2026')
})
test('locurile se cer de la funcția taberei, cu parametrul ei', async () => {
  raspuns = { camps: { data: TABARA, error: null } }
  await getTabaraDetaliu('tabara-inot')
  expect(apeluriRpc).toEqual([{ nume: 'camp_spots_remaining', argumente: { p_camp_id: 'camp-1' } }])
})

test('suma categoriilor adună toate sumele', () => {
  expect(
    sumaCategoriilor([
      { id: 'a', name: 'Monitorizare', description: null, amount: 25000, display_order: 0 },
      { id: 'b', name: 'Cazare', description: null, amount: 45000, display_order: 1 },
    ]),
  ).toBe(70000)
  expect(sumaCategoriilor([])).toBe(0)
})

test('o tabără inexistentă întoarce gol, nu aruncă', async () => {
  raspuns = { camps: { data: null, error: null } }
  expect(await getTabaraDetaliu('nu-exista')).toBeNull()
})
test('o citire căzută aruncă, ca ecranul să poată deosebi eroarea de lipsă', async () => {
  raspuns = { camps: { data: null, error: { message: 'network' } } }
  await expect(getTabaraDetaliu('tabara-inot')).rejects.toBeTruthy()
})

test('o cădere pe categorii, antrenori sau poze se propagă', async () => {
  raspuns = {
    camps: { data: TABARA, error: null },
    camp_price_items: { data: null, error: { message: 'boom' } },
  }
  await expect(getTabaraDetaliu('tabara-inot')).rejects.toBeTruthy()
})

test('detaliul adună categoriile, antrenorii, pozele și locurile rămase', async () => {
  raspuns = {
    camps: { data: TABARA, error: null },
    camp_price_items: {
      data: [
        {
          id: 'p1',
          name: 'Monitorizare',
          description: 'Doi antrenori',
          amount: 25000,
          display_order: 0,
        },
      ],
      error: null,
    },
    camp_coaches: {
      data: [
        {
          coach_profile: {
            id: 'cp1',
            photo_storage_path: 'antrenor.jpg',
            profile: { name: 'Audit Antrenor' },
          },
        },
      ],
      error: null,
    },
    camp_photos: {
      data: [{ storage_path: 'camp-1/gallery/a.jpg', display_order: 0 }],
      error: null,
    },
  }
  rpcRaspuns = { data: 12, error: null }

  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.categorii).toHaveLength(1)
  expect(d!.antrenori).toEqual([
    { id: 'cp1', nume: 'Audit Antrenor', pozaUrl: 'https://public/coach-photos/antrenor.jpg' },
  ])
  expect(d!.galerieUrls).toEqual(['https://public/camp-photos/camp-1/gallery/a.jpg'])
  expect(d!.locuriRamase).toBe(12)
})
test('fără poză hero aleasă, prima din galerie îi ține locul', async () => {
  raspuns = {
    camps: { data: TABARA, error: null },
    camp_photos: {
      data: [
        { storage_path: 'camp-1/gallery/prima.jpg', display_order: 0 },
        { storage_path: 'camp-1/gallery/a-doua.jpg', display_order: 1 },
      ],
      error: null,
    },
  }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.heroUrl).toBe('https://public/camp-photos/camp-1/gallery/prima.jpg')
})

test('poza hero aleasă are întâietate față de galerie', async () => {
  raspuns = {
    camps: { data: { ...TABARA, hero_photo_storage_path: 'camp-1/hero/aleasa.jpg' }, error: null },
    camp_photos: {
      data: [{ storage_path: 'camp-1/gallery/prima.jpg', display_order: 0 }],
      error: null,
    },
  }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.heroUrl).toBe('https://public/camp-photos/camp-1/hero/aleasa.jpg')
})

test('un antrenor fără nume nu lasă cardul gol', async () => {
  raspuns = {
    camps: { data: TABARA, error: null },
    camp_coaches: {
      data: [{ coach_profile: { id: 'cp1', photo_storage_path: null, profile: null } }],
      error: null,
    },
  }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.antrenori[0]).toEqual({ id: 'cp1', nume: 'Antrenor', pozaUrl: null })
})
test('pagina publică cere doar antrenorii care au acceptat', async () => {
  raspuns = { camps: { data: TABARA, error: null } }
  await getTabaraDetaliu('tabara-inot')
  expect(cereri.camp_coaches).toContain('eq(status,accepted)')
})
test('capacitatea nelimitată vine ca gol, nu ca zero', async () => {
  raspuns = { camps: { data: { ...TABARA, capacity: null }, error: null } }
  rpcRaspuns = { data: null, error: null }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.locuriRamase).toBeNull()
})
test('clubul organizator devine link către pagina clubului', async () => {
  raspuns = {
    camps: {
      data: { ...TABARA, club: { id: 'club-9', name: 'Club Audit Motion' }, coach: null },
      error: null,
    },
  }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.organizator).toEqual({
    fel: 'club',
    nume: 'Club Audit Motion',
    link: '/cluburi/club-9',
  })
})

test('antrenorul organizator devine link către pagina lui', async () => {
  raspuns = {
    camps: {
      data: { ...TABARA, club: null, coach: { id: 'user-9', name: 'Audit Antrenor' } },
      error: null,
    },
  }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.organizator).toEqual({
    fel: 'antrenor',
    nume: 'Audit Antrenor',
    link: '/antrenori/user-9',
  })
})

test('o tabără veche, fără proprietar, întoarce gol în loc să inventeze unul', async () => {
  raspuns = { camps: { data: { ...TABARA, club: null, coach: null }, error: null } }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.organizator).toBeNull()
})
test('cheile de legătură nu se scurg în obiectul taberei', async () => {
  raspuns = {
    camps: { data: { ...TABARA, club: { id: 'club-9', name: 'X' }, coach: null }, error: null },
  }
  const d = await getTabaraDetaliu('tabara-inot')
  expect('club' in d!.tabara).toBe(false)
  expect('coach' in d!.tabara).toBe(false)
})

test('categoriile se cer în ordinea lor, nu la nimereală', async () => {
  raspuns = { camps: { data: TABARA, error: null } }
  await getTabaraDetaliu('tabara-inot')
  expect(cereri.camp_price_items).toContain('order(display_order)')
  expect(cereri.camp_price_items).toContain('eq(camp_id,camp-1)')
})

const TREI_TABERE = [
  {
    id: 'a',
    slug: 'vara',
    title: 'Vară',
    period_start: '2026-08-14',
    period_end: '2026-08-21',
    location_text: 'Brașov',
    price: 150000,
    allow_cash: true,
    capacity: 30,
    hero_photo_storage_path: null,
    club: null,
    coach: null,
  },
  {
    id: 'b',
    slug: 'inot',
    title: 'Înot',
    period_start: '2026-09-13',
    period_end: '2026-09-18',
    location_text: 'Timișoara',
    price: 90000,
    allow_cash: false,
    capacity: 20,
    hero_photo_storage_path: 'b/hero/x.jpg',
    club: { id: 'c1', name: 'Club Test' },
    coach: null,
  },
  {
    id: 'c',
    slug: 'mtb',
    title: 'MTB',
    period_start: '2027-07-10',
    period_end: '2027-07-17',
    location_text: 'Alpi',
    price: 320000,
    allow_cash: true,
    capacity: null,
    hero_photo_storage_path: null,
    club: null,
    coach: { id: 'u1', name: 'Antrenor Test' },
  },
]
test('lista publică lasă afară taberele încheiate', async () => {
  raspuns = { camps: { data: TREI_TABERE, error: null }, enrollments: { data: [], error: null } }
  const lista = await getTaberePublice(new Date(2026, 7, 28, 10, 0))
  expect(lista.map((t) => t.slug)).toEqual(['inot', 'mtb'])
})
test('o tabără care se termină azi rămâne în listă', async () => {
  raspuns = { camps: { data: TREI_TABERE, error: null }, enrollments: { data: [], error: null } }
  const lista = await getTaberePublice(new Date(2026, 7, 21, 9, 0))
  expect(lista.map((t) => t.slug)).toEqual(['vara', 'inot', 'mtb'])
})

test('locurile rămase scad cu înscrierile, iar capacitatea goală rămâne goală', async () => {
  raspuns = {
    camps: { data: TREI_TABERE, error: null },
    enrollments: { data: [{ entity_id: 'b' }, { entity_id: 'b' }], error: null },
  }
  const lista = await getTaberePublice(new Date(2026, 7, 28))
  expect(lista.find((t) => t.slug === 'inot')!.locuriRamase).toBe(18)
  expect(lista.find((t) => t.slug === 'mtb')!.locuriRamase).toBeNull()
})

test('organizatorul iese și din club, și din antrenor', async () => {
  raspuns = { camps: { data: TREI_TABERE, error: null }, enrollments: { data: [], error: null } }
  const lista = await getTaberePublice(new Date(2026, 7, 28))
  expect(lista.find((t) => t.slug === 'inot')!.organizator).toEqual({
    fel: 'club',
    nume: 'Club Test',
    link: '/cluburi/c1',
  })
  expect(lista.find((t) => t.slug === 'mtb')!.organizator).toEqual({
    fel: 'antrenor',
    nume: 'Antrenor Test',
    link: '/antrenori/u1',
  })
})
test('când nu rămâne nicio tabără, nu se mai cer înscrierile', async () => {
  raspuns = { camps: { data: TREI_TABERE, error: null } }
  const lista = await getTaberePublice(new Date(2030, 0, 1))
  expect(lista).toEqual([])
  expect(cereri.enrollments).toBeUndefined()
})

test('age-price detail reads the existing ordered categories only in by_age mode', async () => {
  const agePrices = [{ id: 'age-1', age_from: 6, age_to: 8, amount: 60000, display_order: 0 }]
  raspuns = {
    camps: { data: { ...TABARA, pricing_mode: 'by_age' }, error: null },
    camp_age_prices: { data: agePrices, error: null },
  }
  expect((await getTabaraDetaliu('tabara-inot'))!.agePrices).toEqual(agePrices)
  expect(cereri.camp_age_prices).toContain('eq(camp_id,camp-1)')
  expect(cereri.camp_age_prices).toContain('order(display_order)')
  cereri = {}
  raspuns.camps.data = { ...TABARA, pricing_mode: 'single' }
  expect((await getTabaraDetaliu('tabara-inot'))!.agePrices).toEqual([])
  expect(cereri.camp_age_prices).toBeUndefined()
})

test('age-price read errors propagate instead of showing the single amount', async () => {
  raspuns = {
    camps: { data: { ...TABARA, pricing_mode: 'by_age' }, error: null },
    camp_age_prices: { data: null, error: new Error('age prices unavailable') },
  }
  await expect(getTabaraDetaliu('tabara-inot')).rejects.toThrow('age prices unavailable')
})

const CAMP_LOCATION = {
  id: 'location-1',
  name: 'Baza sportivă',
  lat: 45.75,
  lng: 21.23,
  address: 'Strada Test',
  city: 'Timișoara',
}

test('public camps expose the associated location while preserving arrival instructions', async () => {
  raspuns = {
    camps: {
      data: [
        {
          ...TABARA,
          location_id: CAMP_LOCATION.id,
          location: CAMP_LOCATION,
          location_text: 'Intrarea din parc',
        },
      ],
      error: null,
    },
  }
  const [camp] = await getTaberePublice(new Date(2026, 8, 18, 23, 59, 59, 999))
  expect(camp).toMatchObject({
    location_id: CAMP_LOCATION.id,
    location: CAMP_LOCATION,
    location_text: 'Intrarea din parc',
  })
  expect(
    cereri.camps.some((request) =>
      request.replace(/\s+/g, '').includes('location:locations(id,name,lat,lng,address,city)'),
    ),
  ).toBe(true)
  expect(await getTaberePublice(new Date(2026, 8, 19))).toEqual([])
  expect(cereri.camps.some((request) => /^(gte|lte)\(/.test(request))).toBe(false)
})

test('camp detail exposes its location separately from the camp database row', async () => {
  raspuns = {
    camps: {
      data: { ...TABARA, location_id: CAMP_LOCATION.id, location: CAMP_LOCATION },
      error: null,
    },
  }
  const detail = await getTabaraDetaliu(TABARA.slug)
  expect(detail?.location).toEqual(CAMP_LOCATION)
  expect(detail?.tabara.location_id).toBe(CAMP_LOCATION.id)
  expect(detail?.tabara).not.toHaveProperty('location')
  expect(
    cereri.camps.some((request) =>
      request.replace(/\s+/g, '').includes('location:locations(id,name,lat,lng,address,city)'),
    ),
  ).toBe(true)
})

test.each([null, undefined])(
  'missing location joins retain legacy text and normalize to null',
  async (location) => {
    const legacy = {
      ...TABARA,
      location_id: null,
      location,
      location_text: 'Brașov, loc de întâlnire',
    }
    raspuns = { camps: { data: [legacy], error: null } }
    const [camp] = await getTaberePublice(new Date(2026, 8, 15))
    expect(camp).toMatchObject({
      location_id: null,
      location: null,
      location_text: legacy.location_text,
    })
    raspuns.camps.data = legacy
    const detail = await getTabaraDetaliu(TABARA.slug)
    expect(detail?.location).toBeNull()
    expect(detail?.tabara.location_text).toBe(legacy.location_text)
  },
)
