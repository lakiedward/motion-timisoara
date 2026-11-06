import { beforeEach, expect, test, vi } from 'vitest'

import { renuntaLaOfertaFaraHero, schimbaPozaOferta } from './offer-hero'

let jurnal: string[] = []
let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let raspunsUpload: { error: unknown } = { error: null }

function lant(tabel: string) {
  let verb = 'select'
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspunsuri[`${tabel}.${verb}`] ?? { data: null, error: null }))
      }
      return () => {
        if (prop === 'update' || prop === 'delete') {
          verb = prop
          jurnal.push(`db.${tabel}.${prop}`)
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
        upload: async (cale: string) => {
          jurnal.push(`upload ${bucket} ${cale}`)
          return raspunsUpload
        },
        remove: async (cai: string[]) => {
          jurnal.push(`remove ${bucket} ${cai.join(',')}`)
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

const poza = () => new File(['x'], 'poza.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  jurnal = []
  raspunsuri = {
    'courses.select': { data: { hero_photo_storage_path: 'c1/hero/veche.jpg' }, error: null },
  }
  raspunsUpload = { error: null }
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-nou' })
})

test('un fișier care nu e imagine e refuzat înainte de orice cerere', async () => {
  const text = new File(['x'], 'nota.txt', { type: 'text/plain' })
  await expect(schimbaPozaOferta('courses', 'course-photos', 'c1', text)).rejects.toThrow(
    'Poza trebuie să fie o imagine.',
  )
  expect(jurnal).toEqual([])
})

test('urcă poza nouă, o leagă de ofertă și șterge poza veche', async () => {
  const cale = await schimbaPozaOferta('courses', 'course-photos', 'c1', poza())
  expect(cale).toBe('c1/hero/uuid-nou.jpg')
  expect(jurnal).toEqual([
    'upload course-photos c1/hero/uuid-nou.jpg',
    'db.courses.update',
    'remove course-photos c1/hero/veche.jpg',
  ])
})

test('fără poză veche nu șterge nimic din bucket', async () => {
  raspunsuri['activities.select'] = { data: { hero_photo_storage_path: null }, error: null }
  await schimbaPozaOferta('activities', 'activity-photos', 'a1', poza())
  expect(jurnal.some((j) => j.startsWith('remove'))).toBe(false)
})

test('eroarea la citirea ofertei oprește totul înainte de urcare', async () => {
  raspunsuri['courses.select'] = { data: null, error: new Error('citire') }
  await expect(schimbaPozaOferta('courses', 'course-photos', 'c1', poza())).rejects.toThrow(
    'citire',
  )
  expect(jurnal).toEqual([])
})

test('eroarea la urcare se aruncă și nu atinge oferta', async () => {
  raspunsUpload = { error: new Error('urcare') }
  await expect(schimbaPozaOferta('courses', 'course-photos', 'c1', poza())).rejects.toThrow(
    'urcare',
  )
  expect(jurnal).toEqual(['upload course-photos c1/hero/uuid-nou.jpg'])
})

test('dacă legarea de ofertă eșuează, poza nouă urcată se șterge și poza veche rămâne', async () => {
  raspunsuri['courses.update'] = { data: null, error: new Error('RLS') }
  await expect(schimbaPozaOferta('courses', 'course-photos', 'c1', poza())).rejects.toThrow('RLS')
  expect(jurnal).toEqual([
    'upload course-photos c1/hero/uuid-nou.jpg',
    'db.courses.update',
    'remove course-photos c1/hero/uuid-nou.jpg',
  ])
})

test('renuntaLaOfertaFaraHero șterge oferta și aruncă eroarea bazei', async () => {
  await renuntaLaOfertaFaraHero('courses', 'c1')
  expect(jurnal).toEqual(['db.courses.delete'])
  raspunsuri['courses.delete'] = { data: null, error: new Error('refuzat') }
  await expect(renuntaLaOfertaFaraHero('courses', 'c1')).rejects.toThrow('refuzat')
})
