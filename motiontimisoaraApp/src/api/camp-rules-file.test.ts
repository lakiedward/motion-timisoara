import { beforeEach, expect, test, vi } from 'vitest'

import { incarcaRegulamentFisier, stergeRegulamentFisier } from './camp-rules-file'

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

const pdf = (nume = 'regulament.pdf', size = 1200) =>
  new File(['x'.repeat(size)], nume, { type: 'application/pdf' })

beforeEach(() => {
  jurnal = []
  raspunsuri = {}
  raspunsUpload = { error: null }
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-nou' })
})

test('fișierul se urcă înainte să fie pus pe tabără', async () => {
  raspunsuri.camps = { data: { rules_file_storage_path: null }, error: null }
  await incarcaRegulamentFisier('c1', pdf())
  expect(jurnal.indexOf('storage.upload uuid-nou.pdf')).toBeLessThan(jurnal.indexOf('db.camps.update'))
})

test('fișierul vechi se scoate abia după ce rândul arată spre cel nou', async () => {
  raspunsuri.camps = { data: { rules_file_storage_path: 'c1/vechi.pdf' }, error: null }
  await incarcaRegulamentFisier('c1', pdf())
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(jurnal.indexOf('db.camps.update'))
})

test('dacă rândul nu se poate scrie, fișierul urcat nu rămâne orfan', async () => {
  raspunsuri['camps.select'] = { data: { rules_file_storage_path: null }, error: null }
  raspunsuri['camps.update'] = { data: null, error: { message: 'refuzat' } }
  await expect(incarcaRegulamentFisier('c1', pdf())).rejects.toBeTruthy()
  expect(jurnal.indexOf('storage.upload uuid-nou.pdf')).toBeGreaterThanOrEqual(0)
  expect(jurnal.lastIndexOf('storage.remove 1')).toBeGreaterThan(jurnal.indexOf('db.camps.update'))
})

test('un video e refuzat înainte de urcare', async () => {
  const film = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
  await expect(incarcaRegulamentFisier('c1', film)).rejects.toThrow(/PDF, imagine, Word sau Excel/)
  expect(jurnal).toEqual([])
})

test('un fișier peste 10 MB e refuzat înainte de urcare', async () => {
  const mare = new File(['x'], 'mare.pdf', { type: 'application/pdf' })
  Object.defineProperty(mare, 'size', { value: 10 * 1024 * 1024 + 1 })
  await expect(incarcaRegulamentFisier('c1', mare)).rejects.toThrow(/10 MB/)
  expect(jurnal).toEqual([])
})

test('ștergerea golește rândul înainte de fișier', async () => {
  raspunsuri.camps = { data: { rules_file_storage_path: 'c1/vechi.pdf' }, error: null }
  await stergeRegulamentFisier('c1')
  expect(jurnal.indexOf('db.camps.update')).toBeLessThan(jurnal.indexOf('storage.remove 1'))
})
