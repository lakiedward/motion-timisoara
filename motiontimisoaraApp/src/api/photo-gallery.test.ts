import { beforeEach, expect, test, vi } from 'vitest'

import {
  MAX_POZE_GALERIE,
  adaugaPozeGalerie,
  galerieActivitate,
  galerieCurs,
  galeriePublica,
  galerieTabara,
  mutaPozaGalerie,
  stergePozaGalerie,
} from './photo-gallery'

let jurnal: string[] = []
let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let raspunsUpload: { error: unknown } = { error: null }
let inserate: Record<string, unknown>[] = []

function lant(tabela: string) {
  let verb = 'select'
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            resolve(
              raspunsuri[`${tabela}.${verb}`] ?? raspunsuri[tabela] ?? { data: {}, error: null },
            ),
          )
      }
      return (...args: unknown[]) => {
        if (prop === 'update' || prop === 'insert' || prop === 'delete') {
          verb = prop
          jurnal.push(`db.${tabela}.${prop}`)
          if (prop === 'insert') inserate.push(args[0] as Record<string, unknown>)
        } else if (prop === 'select' && verb === 'select') {
          jurnal.push(`db.${tabela}.select`)
        }
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => lant(t),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (cale: string) => ({
          data: { publicUrl: `https://public/${bucket}/${cale}` },
        }),
        upload: async (cale: string) => {
          jurnal.push(`storage.upload ${bucket} ${cale}`)
          return raspunsUpload
        },
        remove: async (cai: string[]) => {
          jurnal.push(`storage.remove ${cai.length}`)
          return { error: null }
        },
      }),
    },
  },
}))

vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  micsoreazaPoza: async (f: File) => f,
}))

const poza = (nume: string) => new File(['x'], nume, { type: 'image/jpeg' })

beforeEach(() => {
  jurnal = []
  raspunsuri = {}
  raspunsUpload = { error: null }
  inserate = []
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-nou' })
})

const rand = (id: string, ordine: number) => ({
  id,
  storage_path: `c1/gallery/${id}.jpg`,
  display_order: ordine,
  caption: null,
})

test('ștergerea din galerie scoate FIȘIERUL înainte de rând', async () => {
  await stergePozaGalerie(galerieTabara('c1'), rand('p1', 0))
  expect(jurnal.indexOf('storage.remove 1')).toBeLessThan(jurnal.indexOf('db.camp_photos.delete'))
})

test('o poză care nu e imagine e refuzată pe nume, nu în tăcere', async () => {
  const rezultat = await adaugaPozeGalerie(
    galerieTabara('c1'),
    [new File(['x'], 'doc.pdf', { type: 'application/pdf' })],
    0,
  )
  expect(rezultat.adaugate).toBe(0)
  expect(rezultat.refuzate[0]).toContain('doc.pdf')
})

test('galeria nu trece de limită, iar ce nu încape spune de ce', async () => {
  const prea_multe = Array.from({ length: 3 }, (_, i) => poza(`p${i}.jpg`))
  const rezultat = await adaugaPozeGalerie(galerieTabara('c1'), prea_multe, MAX_POZE_GALERIE - 1)
  expect(rezultat.adaugate).toBe(1)
  expect(rezultat.refuzate).toHaveLength(2)
  expect(rezultat.refuzate[0]).toContain(String(MAX_POZE_GALERIE))
})

test('activitatea urcă în folderul ei din activity-photos și trimite acordul', async () => {
  await adaugaPozeGalerie(galerieActivitate('a1'), [poza('p.jpg')], 2)
  expect(jurnal).toContain('storage.upload activity-photos a1/gallery/uuid-nou.jpg')
  expect(inserate[0]).toMatchObject({
    activity_id: 'a1',
    storage_path: 'a1/gallery/uuid-nou.jpg',
    display_order: 2,
  })
  expect(inserate[0]?.consent_confirmed_at).toEqual(expect.any(String))
  expect(inserate[0]).not.toHaveProperty('content_type')
})

test('cursul păstrează content_type la inserare', async () => {
  await adaugaPozeGalerie(galerieCurs('k1'), [poza('p.jpg')], 0)
  expect(jurnal).toContain('db.course_photos.insert')
  expect(inserate[0]).toMatchObject({ course_id: 'k1', content_type: 'image/jpeg' })
})

test('dacă rândul e refuzat, fișierul urcat se scoate', async () => {
  raspunsuri['camp_photos.insert'] = { data: null, error: { message: 'fără acord' } }
  const rezultat = await adaugaPozeGalerie(galerieTabara('c1'), [poza('p.jpg')], 0)
  expect(rezultat.adaugate).toBe(0)
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(
    jurnal.indexOf('db.camp_photos.insert'),
  )
})

test('mutarea în afara listei nu scrie nimic', async () => {
  const poze = [rand('a', 0), rand('b', 1)]
  await mutaPozaGalerie('camp_photos', poze, 0, -1)
  await mutaPozaGalerie('camp_photos', poze, 1, 1)
  expect(jurnal).toEqual([])
})

test('mutarea schimbă ordinea între vecini, nu renumerotează tot', async () => {
  const poze = [rand('a', 0), rand('b', 1), rand('c', 2)]
  await mutaPozaGalerie('activity_photos', poze, 0, 1)
  expect(jurnal.filter((l) => l === 'db.activity_photos.update')).toHaveLength(2)
})

test('galeria publică ordonează, curăță descrierile goale și sare peste hero', () => {
  expect(
    galeriePublica(
      'camp-photos',
      [
        { storage_path: 'c/gallery/b.jpg', display_order: 2, caption: '  ' },
        { storage_path: '/ui/hero.webp', display_order: 0, caption: null },
        { storage_path: 'c/gallery/a.jpg', display_order: 1, caption: ' Pe munte ' },
      ],
      '/ui/hero.webp',
    ),
  ).toEqual([
    { url: 'https://public/camp-photos/c/gallery/a.jpg', caption: 'Pe munte' },
    { url: 'https://public/camp-photos/c/gallery/b.jpg', caption: null },
  ])
  expect(galeriePublica('course-photos', null)).toEqual([])
})
