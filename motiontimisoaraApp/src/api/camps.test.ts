import { beforeEach, expect, test, vi } from 'vitest'

import { getTabaraDetaliu, sAIncheiat, sumaCategoriilor } from './camps'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}
let rpcRaspuns: { data: unknown; error: unknown } = { data: null, error: null }
let cereri: Record<string, string[]> = {}

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
    rpc: async () => rpcRaspuns,
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://public/${bucket}/${path}` } }),
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
})

// Ziua de final se numara: o tabara care se termina azi nu s-a incheiat inca.
test('o tabără s-a încheiat abia după ultima ei zi', () => {
  expect(sAIncheiat('2026-09-18', new Date('2026-09-18T08:00:00'))).toBe(false)
  expect(sAIncheiat('2026-09-18', new Date('2026-09-18T23:59:00'))).toBe(false)
  expect(sAIncheiat('2026-09-18', new Date('2026-09-19T00:30:00'))).toBe(true)
  expect(sAIncheiat('2026-08-21', new Date('2026-08-27T10:00:00'))).toBe(true)
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

// „Nu am putut incarca" si „nu exista" trebuie sa fie doua situatii diferite pe
// ecran, deci nu au voie sa vina amandoua ca `null`.
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
        { id: 'p1', name: 'Monitorizare', description: 'Doi antrenori', amount: 25000, display_order: 0 },
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
    camp_photos: { data: [{ storage_path: 'camp-1/gallery/a.jpg', display_order: 0 }], error: null },
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

// Mai bine o poza din tabara decat un fond gol in capul paginii.
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
    camp_photos: { data: [{ storage_path: 'camp-1/gallery/prima.jpg', display_order: 0 }], error: null },
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

// Capacitate nelimitata inseamna NULL, nu zero locuri — apelantul trebuie sa le
// deosebeasca, altfel o tabara fara limita ar aparea ca plina.
test('capacitatea nelimitată vine ca gol, nu ca zero', async () => {
  raspuns = { camps: { data: { ...TABARA, capacity: null }, error: null } }
  rpcRaspuns = { data: null, error: null }
  const d = await getTabaraDetaliu('tabara-inot')
  expect(d!.locuriRamase).toBeNull()
})

test('categoriile se cer în ordinea lor, nu la nimereală', async () => {
  raspuns = { camps: { data: TABARA, error: null } }
  await getTabaraDetaliu('tabara-inot')
  expect(cereri.camp_price_items).toContain('order(display_order)')
  expect(cereri.camp_price_items).toContain('eq(camp_id,camp-1)')
})
