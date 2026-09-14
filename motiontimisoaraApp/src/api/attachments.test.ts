import { beforeEach, expect, test, vi } from 'vitest'

import { getAtasamente, incarcaAtasamente, stergeAtasament } from './attachments'
import type { FisierPregatit } from '@/lib/media'

let storage: { apel: string; argumente: unknown[] }[] = []

let eroareUpload: { message: string } | null = null
let randuriAtasamente: unknown[] = []
let filtreTabela: string[] = []
let argumenteTabela: Record<string, unknown[]> = {}
let tableError: { message: string } | null = null
let signingError: { message: string } | null = null

function tabela() {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve({ data: randuriAtasamente, error: tableError }))
      }
      return (...args: unknown[]) => {
        filtreTabela.push(`${prop}(${args.map(String).join(',')})`)
        argumenteTabela[prop] = args
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => tabela(),
    storage: {
      from: () => ({
        upload: async (...a: unknown[]) => {
          storage.push({ apel: 'upload', argumente: a })
          return { error: eroareUpload }
        },
        remove: async (...a: unknown[]) => {
          storage.push({ apel: 'remove', argumente: a })
          return { error: null }
        },
        createSignedUrls: async (cai: string[]) => {
          storage.push({ apel: 'createSignedUrls', argumente: [cai] })
          return {
            data: cai.map((path) => ({ path, signedUrl: `https://semnat/${path}`, error: null })),
            error: signingError,
          }
        },
      }),
    },
  },
}))

const poza: FisierPregatit = {
  fel: 'IMAGE',
  continut: new Blob(['x'], { type: 'image/jpeg' }),
  numeOriginal: 'antrenament.jpg',
  contentType: 'image/jpeg',
}
const film: FisierPregatit = {
  fel: 'VIDEO',
  continut: new Blob(['x'], { type: 'video/mp4' }),
  numeOriginal: 'start.mp4',
  contentType: 'video/mp4',
}

beforeEach(() => {
  storage = []
  eroareUpload = null
  randuriAtasamente = []
  filtreTabela = []
  argumenteTabela = {}
  tableError = null
  signingError = null
  vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-3333-4444-555555555555' })
})

test('calea începe cu id-ul anunțului, cum cere politica bucketului', async () => {
  await incarcaAtasamente('anunt-1', [poza])
  const cale = storage[0].argumente[0] as string
  expect(cale.startsWith('anunt-1/')).toBe(true)
  expect(cale.endsWith('.jpg')).toBe(true)
})

test('filmarea primește termen, poza nu', async () => {
  await incarcaAtasamente('anunt-1', [poza, film])
  const randuri = argumenteTabela.insert?.[0] as Record<string, unknown>[]
  expect(randuri).toHaveLength(2)
  expect(randuri[0]).toMatchObject({ type: 'IMAGE', expires_at: null, display_order: 0 })
  expect(randuri[1]).toMatchObject({ type: 'VIDEO', display_order: 1 })
  expect(randuri[1].expires_at).toBeTruthy()
})

test('atașamentele se leagă de anunțul de club, nu de cel de curs', async () => {
  await incarcaAtasamente('anunt-1', [poza])
  const randuri = argumenteTabela.insert?.[0] as Record<string, unknown>[]
  expect(randuri[0]).toMatchObject({ club_announcement_id: 'anunt-1' })
  expect(randuri[0].announcement_id).toBeUndefined()
})

test('o încărcare picată la mijloc scoate înapoi ce apucase să urce', async () => {
  let apel = 0
  const supabase = (await import('@/lib/supabase')).supabase
  const bucket = supabase.storage.from('announcement-media')
  vi.spyOn(supabase.storage, 'from').mockReturnValue({
    ...bucket,
    upload: async (...a: unknown[]) => {
      apel += 1
      storage.push({ apel: 'upload', argumente: a })
      return apel === 2 ? { error: { message: 'boom' } } : { error: null }
    },
  } as ReturnType<typeof supabase.storage.from>)

  await expect(incarcaAtasamente('anunt-1', [poza, film])).rejects.toBeTruthy()
  const stergeri = storage.filter((s) => s.apel === 'remove')
  expect(stergeri).toHaveLength(1)
  expect(stergeri[0].argumente[0] as string[]).toHaveLength(1)
  vi.restoreAllMocks()
})

test('un lot gol nu atinge nici bucketul, nici tabela', async () => {
  const rezultat = await incarcaAtasamente('anunt-1', [])
  expect(rezultat).toEqual([])
  expect(storage).toEqual([])
  expect(filtreTabela).toEqual([])
})

test('linkurile semnate se cer o singură dată, pentru toate fișierele', async () => {
  randuriAtasamente = [
    {
      id: 'a1',
      club_announcement_id: 'an-1',
      type: 'IMAGE',
      storage_path: 'an-1/x.jpg',
      content_type: 'image/jpeg',
      expires_at: null,
      display_order: 0,
    },
    {
      id: 'a2',
      club_announcement_id: 'an-1',
      type: 'VIDEO',
      storage_path: 'an-1/y.mp4',
      content_type: 'video/mp4',
      expires_at: '2026-09-25T09:00:00Z',
      display_order: 1,
    },
  ]
  const pe = await getAtasamente(['an-1'])
  const semnari = storage.filter((s) => s.apel === 'createSignedUrls')
  expect(semnari).toHaveLength(1)
  expect(semnari[0].argumente[0] as string[]).toHaveLength(2)
  expect(pe['an-1']).toHaveLength(2)
  expect(pe['an-1'][0].link).toBe('https://semnat/an-1/x.jpg')
  expect(pe['an-1'][1].expiraLa).toBe('2026-09-25T09:00:00Z')
})

test('un lot gol nu cere linkuri degeaba', async () => {
  const pe = await getAtasamente([])
  expect(pe).toEqual({})
  expect(storage).toEqual([])
})

test.each([
  ['club', 'club_announcement_id'],
  ['coach', 'announcement_id'],
] as const)('loads %s attachments under their announcement identifiers', async (source, column) => {
  randuriAtasamente = [
    {
      id: 'image',
      [column]: 'announcement-1',
      type: 'IMAGE',
      storage_path: 'announcement-1/image.jpg',
      content_type: 'image/jpeg',
      expires_at: null,
      display_order: 0,
    },
    {
      id: 'external-link',
      [column]: 'announcement-2',
      type: 'URL',
      storage_path: null,
      url: 'https://motion.example/program.pdf',
      content_type: null,
      expires_at: null,
      display_order: 1,
    },
  ]

  const attachments = await getAtasamente(['announcement-1', 'announcement-2'], source)

  expect(argumenteTabela.in).toEqual([column, ['announcement-1', 'announcement-2']])
  expect(attachments['announcement-1']).toEqual([
    {
      id: 'image',
      fel: 'IMAGE',
      link: 'https://semnat/announcement-1/image.jpg',
      contentType: 'image/jpeg',
      expiraLa: null,
    },
  ])
  expect(attachments['announcement-2']).toEqual([
    {
      id: 'external-link',
      fel: 'URL',
      link: 'https://motion.example/program.pdf',
      contentType: null,
      expiraLa: null,
    },
  ])
  expect(storage.filter((call) => call.apel === 'createSignedUrls')).toEqual([
    { apel: 'createSignedUrls', argumente: [['announcement-1/image.jpg']] },
  ])
})

test('defaults to the club attachment relation', async () => {
  await getAtasamente(['club-announcement'])
  expect(argumenteTabela.in).toEqual(['club_announcement_id', ['club-announcement']])
})

test.each(['club', 'coach'] as const)('propagates %s attachment query failures', async (source) => {
  tableError = { message: 'Connection interrupted' }
  await expect(getAtasamente(['announcement'], source)).rejects.toEqual(tableError)
  expect(storage).toEqual([])
})

test('propagates a batch signing failure so the caller can offer retry', async () => {
  randuriAtasamente = [
    {
      id: 'image',
      club_announcement_id: 'announcement',
      type: 'IMAGE',
      storage_path: 'announcement/image.jpg',
    },
  ]
  signingError = { message: 'Storage unavailable' }
  await expect(getAtasamente(['announcement'])).rejects.toEqual(signingError)
})

test('ștergerea scoate întâi fișierul, apoi rândul', async () => {
  randuriAtasamente = { id: 'a1' } as unknown as unknown[]
  await stergeAtasament('a1', 'an-1/x.jpg')
  expect(storage[0].apel).toBe('remove')
  expect(filtreTabela).toContain('delete()')
  expect(filtreTabela).toContain('eq(id,a1)')

  expect(filtreTabela).toContain('single()')
})
