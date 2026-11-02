import { beforeEach, expect, test, vi } from 'vitest'

import { schimbaPozaHero } from './camp-photos'

let jurnal: string[] = []
let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let raspunsUpload: { error: unknown } = { error: null }

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

test('poza din cap se urcă înainte să fie pusă pe tabără', async () => {
  raspunsuri.camps = { data: { hero_photo_storage_path: 'c1/hero/vechi.jpg' }, error: null }
  await schimbaPozaHero('c1', poza('noua.jpg'))
  expect(jurnal.indexOf('storage.upload hero')).toBeLessThan(jurnal.indexOf('db.camps.update'))
})

test('poza veche se scoate abia după ce rândul arată spre cea nouă', async () => {
  raspunsuri.camps = { data: { hero_photo_storage_path: 'c1/hero/vechi.jpg' }, error: null }
  await schimbaPozaHero('c1', poza('noua.jpg'))
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(jurnal.indexOf('db.camps.update'))
})

test('dacă rândul nu se poate scrie, fișierul urcat nu rămâne orfan', async () => {
  raspunsuri['camps.select'] = { data: { hero_photo_storage_path: null }, error: null }
  raspunsuri['camps.update'] = { data: null, error: { message: 'refuzat' } }
  await expect(schimbaPozaHero('c1', poza('noua.jpg'))).rejects.toBeTruthy()
  expect(jurnal.indexOf('storage.upload hero')).toBeGreaterThanOrEqual(0)
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(jurnal.indexOf('db.camps.update'))
})
