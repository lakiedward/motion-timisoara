import { beforeEach, expect, test, vi } from 'vitest'

import {
  MAX_POZE_GALERIE,
  adaugaInGalerie,
  mutaInGalerie,
  schimbaPozaHero,
  stergeDinGalerie,
} from './camp-photos'

/** Jurnalul tuturor apelurilor, în ordine — ordinea e chiar ce se verifică aici. */
let jurnal: string[] = []
let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let raspunsUpload: { error: unknown } = { error: null }

/**
 * Fiecare lanț își ține minte verbul cu care a început, ca citirea și scrierea
 * de pe aceeași tabelă să poată primi răspunsuri diferite. Fără asta, un test
 * care vrea „update-ul eșuează" ar face să pice și `select`-ul de dinaintea lui,
 * iar codul n-ar mai ajunge niciodată la partea verificată.
 */
function lant(tabela: string) {
  let verb = 'select'
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            resolve(raspunsuri[`${tabela}.${verb}`] ?? raspunsuri[tabela] ?? { data: {}, error: null }),
          )
      }
      return () => {
        if (prop === 'update' || prop === 'insert' || prop === 'delete') {
          verb = prop
          jurnal.push(`db.${tabela}.${prop}`)
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
      from: () => ({
        getPublicUrl: (cale: string) => ({ data: { publicUrl: `https://public/${cale}` } }),
        upload: async (cale: string) => {
          jurnal.push(`storage.upload ${cale.split('/')[1]}`)
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

// Micșorarea are testele ei în media.test.ts; aici doar nu vrem un canvas.
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  micsoreazaPoza: async (f: File) => f,
}))

const poza = (nume: string) => new File(['x'], nume, { type: 'image/jpeg' })

beforeEach(() => {
  jurnal = []
  raspunsuri = {}
  raspunsUpload = { error: null }
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-nou' })
})

// Invers, un rând șters ar lăsa fișierul în bucket fără nimic care să-l
// pomenească — deci fără nimeni care să-l mai poată găsi ca să-l scoată.
test('ștergerea din galerie scoate FIȘIERUL înainte de rând', async () => {
  await stergeDinGalerie({
    id: 'p1',
    camp_id: 'c1',
    storage_path: 'c1/gallery/a.jpg',
    display_order: 0,
    created_at: '',
  })
  expect(jurnal.indexOf('storage.remove 1')).toBeLessThan(jurnal.indexOf('db.camp_photos.delete'))
})

test('poza din cap se urcă înainte să fie pusă pe tabără', async () => {
  raspunsuri.camps = { data: { hero_photo_storage_path: 'c1/hero/vechi.jpg' }, error: null }
  await schimbaPozaHero('c1', poza('noua.jpg'))
  expect(jurnal.indexOf('storage.upload hero')).toBeLessThan(jurnal.indexOf('db.camps.update'))
})

// Altfel o eroare la urcare ar lăsa tabăra fără poză deloc.
test('poza veche se scoate abia după ce rândul arată spre cea nouă', async () => {
  raspunsuri.camps = { data: { hero_photo_storage_path: 'c1/hero/vechi.jpg' }, error: null }
  await schimbaPozaHero('c1', poza('noua.jpg'))
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(jurnal.indexOf('db.camps.update'))
})

// Regresia care a costat patru fișiere orfane pe tabăra de înot.
test('dacă rândul nu se poate scrie, fișierul urcat nu rămâne orfan', async () => {
  raspunsuri['camps.select'] = { data: { hero_photo_storage_path: null }, error: null }
  raspunsuri['camps.update'] = { data: null, error: { message: 'refuzat' } }
  await expect(schimbaPozaHero('c1', poza('noua.jpg'))).rejects.toBeTruthy()
  // Fișierul e sus, dar nimic nu arată spre el: trebuie scos în aceeași mișcare.
  expect(jurnal.indexOf('storage.upload hero')).toBeGreaterThanOrEqual(0)
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(jurnal.indexOf('db.camps.update'))
})

test('o poză care nu e imagine e refuzată pe nume, nu în tăcere', async () => {
  const rezultat = await adaugaInGalerie('c1', [new File(['x'], 'doc.pdf', { type: 'application/pdf' })], 0)
  expect(rezultat.adaugate).toBe(0)
  expect(rezultat.refuzate[0]).toContain('doc.pdf')
})

test('galeria nu trece de limită, iar ce nu încape spune de ce', async () => {
  const prea_multe = Array.from({ length: 3 }, (_, i) => poza(`p${i}.jpg`))
  const rezultat = await adaugaInGalerie('c1', prea_multe, MAX_POZE_GALERIE - 1)
  expect(rezultat.adaugate).toBe(1)
  expect(rezultat.refuzate).toHaveLength(2)
  expect(rezultat.refuzate[0]).toContain(String(MAX_POZE_GALERIE))
})

test('mutarea în afara listei nu scrie nimic', async () => {
  const poze = [
    { id: 'a', camp_id: 'c1', storage_path: 'x', display_order: 0, created_at: '' },
    { id: 'b', camp_id: 'c1', storage_path: 'y', display_order: 1, created_at: '' },
  ]
  await mutaInGalerie(poze, 0, -1)
  await mutaInGalerie(poze, 1, 1)
  expect(jurnal).toEqual([])
})

test('mutarea schimbă ordinea între vecini, nu renumerotează tot', async () => {
  const poze = [
    { id: 'a', camp_id: 'c1', storage_path: 'x', display_order: 0, created_at: '' },
    { id: 'b', camp_id: 'c1', storage_path: 'y', display_order: 1, created_at: '' },
    { id: 'c', camp_id: 'c1', storage_path: 'z', display_order: 2, created_at: '' },
  ]
  await mutaInGalerie(poze, 0, 1)
  expect(jurnal.filter((l) => l === 'db.camp_photos.update')).toHaveLength(2)
})
