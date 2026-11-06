import { beforeEach, expect, test, vi } from 'vitest'

import { clearClubImage, setClubImage } from './club-images'

let jurnal: string[] = []
let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let raspunsUpload: { error: unknown } = { error: null }
let actualizari: unknown[] = []

function lant() {
  let verb = 'select'
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspunsuri[verb] ?? { data: null, error: null }))
      }
      return (arg: unknown) => {
        if (prop === 'update') {
          verb = 'update'
          actualizari.push(arg)
          jurnal.push('db.update')
        }
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => lant(),
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
  actualizari = []
  raspunsuri = { select: { data: { logo_storage_path: 'c1/logo/veche.jpg' }, error: null } }
  raspunsUpload = { error: null }
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-nou' })
})

test('un fișier care nu e imagine e refuzat înainte de orice cerere', async () => {
  const text = new File(['x'], 'nota.txt', { type: 'text/plain' })
  await expect(setClubImage('c1', 'logo', text)).rejects.toThrow('Poza trebuie să fie o imagine.')
  expect(jurnal).toEqual([])
})

test('sigla nouă se urcă în club-assets, se leagă de club și cea veche se șterge', async () => {
  await expect(setClubImage('c1', 'logo', poza())).resolves.toBe('c1/logo/uuid-nou.jpg')
  expect(actualizari).toEqual([{ logo_storage_path: 'c1/logo/uuid-nou.jpg' }])
  expect(jurnal).toEqual([
    'upload club-assets c1/logo/uuid-nou.jpg',
    'db.update',
    'remove club-assets c1/logo/veche.jpg',
  ])
})

test('imaginea hero folosește coloana ei', async () => {
  raspunsuri.select = { data: { hero_photo_storage_path: null }, error: null }
  await setClubImage('c1', 'hero', poza())
  expect(actualizari).toEqual([{ hero_photo_storage_path: 'c1/hero/uuid-nou.jpg' }])
  expect(jurnal.some((j) => j.startsWith('remove'))).toBe(false)
})

test('eroarea la urcare se aruncă și clubul rămâne neschimbat', async () => {
  raspunsUpload = { error: new Error('urcare') }
  await expect(setClubImage('c1', 'logo', poza())).rejects.toThrow('urcare')
  expect(actualizari).toEqual([])
})

test('dacă legarea de club eșuează, imaginea nouă se șterge și cea veche rămâne', async () => {
  raspunsuri.update = { data: null, error: new Error('RLS') }
  await expect(setClubImage('c1', 'logo', poza())).rejects.toThrow('RLS')
  expect(jurnal).toEqual([
    'upload club-assets c1/logo/uuid-nou.jpg',
    'db.update',
    'remove club-assets c1/logo/uuid-nou.jpg',
  ])
})

test('eroarea la citirea clubului oprește totul înainte de urcare', async () => {
  raspunsuri.select = { data: null, error: new Error('citire') }
  await expect(setClubImage('c1', 'logo', poza())).rejects.toThrow('citire')
  expect(jurnal).toEqual([])
})

test('clearClubImage golește coloana și șterge fișierul vechi', async () => {
  await clearClubImage('c1', 'logo')
  expect(actualizari).toEqual([{ logo_storage_path: null }])
  expect(jurnal).toEqual(['db.update', 'remove club-assets c1/logo/veche.jpg'])
})

test('clearClubImage cu scriere refuzată aruncă și nu șterge fișierul', async () => {
  raspunsuri.update = { data: null, error: { code: 'PGRST116', message: 'zero rânduri' } }
  await expect(clearClubImage('c1', 'logo')).rejects.toMatchObject({ code: 'PGRST116' })
  expect(jurnal).toEqual(['db.update'])
})

test('clearClubImage fără fișier vechi nu apelează storage', async () => {
  raspunsuri.select = { data: { logo_storage_path: null }, error: null }
  await clearClubImage('c1', 'logo')
  expect(jurnal).toEqual(['db.update'])
})
