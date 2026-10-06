import { beforeEach, expect, test, vi } from 'vitest'

import {
  clearSportDefaultPhoto,
  createSport,
  deleteSport,
  normalizeSportCode,
  setSportDefaultPhoto,
  sportNameError,
} from './admin-sports'

type Response = { data: unknown; error: { code?: string; message: string } | null }
let responses: Response[] = []
let events: { method: string; args: unknown[] }[] = []
let uploadError: Response['error'] = null
let removeError: Response['error'] = null
let removeThrows = false

function builder() {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop: string) {
      if (prop === 'then')
        return (resolve: (value: Response) => unknown) =>
          Promise.resolve(resolve(responses.shift() ?? { data: {}, error: null }))
      return (...args: unknown[]) => {
        events.push({ method: prop, args })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => builder(),
    storage: {
      from: () => ({
        upload: async (...args: unknown[]) => {
          events.push({ method: 'upload', args })
          return { error: uploadError }
        },
        remove: async (...args: unknown[]) => {
          events.push({ method: 'remove', args })
          if (removeThrows) throw new Error('Storage network failure')
          return { error: removeError }
        },
      }),
    },
  },
}))

const previous = 'sport-1/default.jpg'
const photo = () => new File(['image'], 'photo.png', { type: 'image/png' })
const read = (path: string | null = previous): Response => ({
  data: { default_photo_storage_path: path },
  error: null,
})
const saved: Response = { data: { id: 'sport-1' }, error: null }

beforeEach(() => {
  responses = [read(), saved]
  events = []
  uploadError = null
  removeError = null
  removeThrows = false
})

test('normalizes Romanian names and refuses names without a usable code', () => {
  expect(normalizeSportCode('  Înot în apă  ')).toBe('inot_in_apa')
  expect(sportNameError(' a ')).toMatch(/minimum două/)
  expect(sportNameError('  🎾🎾  ')).toMatch(/literă sau o cifră/)
  expect(sportNameError('  Tenis  ')).toBeNull()
})

test.each(['', ' a ', '🎾🎾'])('invalid name %s sends no insert', async (name) => {
  await expect(createSport(normalizeSportCode(name), name)).rejects.toThrow()
  expect(events).toHaveLength(0)
})

test('creates trimmed name and distinguishes duplicate codes from network failure', async () => {
  responses = [saved]
  await createSport('inot', '  Înot  ')
  expect(events).toContainEqual({ method: 'insert', args: [{ code: 'inot', name: 'Înot' }] })
  responses = [{ data: null, error: { code: '23505', message: 'unique code' } }]
  await expect(createSport('inot', 'Înot')).rejects.toThrow(/acest cod/)
  responses = [{ data: null, error: { message: 'fetch failed' } }]
  await expect(createSport('inot', 'Înot')).rejects.toMatchObject({ message: 'fetch failed' })
})

test('foreign key failure explains all usages while a network failure is not relabeled', async () => {
  responses = [{ data: null, error: { code: '23503', message: 'referenced sport' } }]
  await expect(deleteSport('sport-1')).rejects.toThrow(/cursuri, activități, antrenori sau cluburi/)
  expect(events).toContainEqual({ method: 'eq', args: ['id', 'sport-1'] })
  responses = [{ data: null, error: { message: 'network offline' } }]
  await expect(deleteSport('sport-1')).rejects.toMatchObject({ message: 'network offline' })
})

test.each([
  new File(['text'], 'file.txt', { type: 'text/plain' }),
  new File([], 'photo.png', { type: 'image/png' }),
])('refused file sends no database or storage request', async (file) => {
  await expect(setSportDefaultPhoto('sport-1', file)).rejects.toThrow(/imagine/)
  expect(events).toHaveLength(0)
})

test('failed upload preserves the old association and storage object', async () => {
  uploadError = { message: 'upload rejected' }
  await expect(setSportDefaultPhoto('sport-1', photo())).rejects.toMatchObject(uploadError)
  expect(events.some((event) => event.method === 'update')).toBe(false)
  expect(events.some((event) => event.method === 'remove')).toBe(false)
})

test('unconfirmed database save reports the uploaded file and never deletes either image', async () => {
  responses = [read(), { data: null, error: { message: 'response lost' } }]
  await expect(setSportDefaultPhoto('sport-1', photo())).rejects.toThrow(
    /Storage.*asocierii nu a fost confirmată/,
  )
  const upload = events.find((event) => event.method === 'upload')!
  expect(upload.args[0]).not.toBe(previous)
  expect(upload.args[2]).toEqual({ upsert: false, contentType: 'image/png' })
  expect(events.some((event) => event.method === 'remove')).toBe(false)
})

test('replacement compares the old path and removes it only after the database confirms save', async () => {
  const result = await setSportDefaultPhoto('sport-1', photo())
  expect(result.path).toMatch(/^sport-1\/[a-f0-9-]+\.png$/)
  expect(result.warning).toBeNull()
  expect(events).toContainEqual({ method: 'eq', args: ['default_photo_storage_path', previous] })
  expect(events).toContainEqual({ method: 'remove', args: [[previous]] })
  expect(events.findIndex((event) => event.method === 'remove')).toBeGreaterThan(
    events.findIndex((event) => event.method === 'update'),
  )
})

test('each upload gets a new key and the first photo uses a null association comparison', async () => {
  responses = [read(null), saved, read(null), saved]
  const first = await setSportDefaultPhoto('sport-1', photo())
  const second = await setSportDefaultPhoto('sport-1', photo())
  expect(first.path).not.toBe(second.path)
  expect(events).toContainEqual({ method: 'is', args: ['default_photo_storage_path', null] })
  expect(events.some((event) => event.method === 'remove')).toBe(false)
})

test('concurrent association change does not delete the competing image', async () => {
  responses = [read(), { data: null, error: { code: 'PGRST116', message: 'no matching old path' } }]
  await expect(setSportDefaultPhoto('sport-1', photo())).rejects.toThrow(/nu a fost confirmată/)
  expect(events.some((event) => event.method === 'remove')).toBe(false)
})

test('confirmed replacement with failed storage cleanup returns a truthful warning', async () => {
  removeError = { message: 'remove rejected' }
  await expect(setSportDefaultPhoto('sport-1', photo())).resolves.toMatchObject({
    warning: expect.stringMatching(/Noua poză este salvată.*vechi/),
  })
})

test('clear confirms database removal before deleting the original managed storage path', async () => {
  await expect(clearSportDefaultPhoto('sport-1')).resolves.toEqual({ path: null, warning: null })
  expect(events).toContainEqual({ method: 'update', args: [{ default_photo_storage_path: null }] })
  expect(events.findIndex((event) => event.method === 'remove')).toBeGreaterThan(
    events.findIndex((event) => event.method === 'update'),
  )
})

test('clear database failure never deletes the original object', async () => {
  responses = [read(), { data: null, error: { message: 'write failed' } }]
  await expect(clearSportDefaultPhoto('sport-1')).rejects.toMatchObject({ message: 'write failed' })
  expect(events.some((event) => event.method === 'remove')).toBe(false)
})

test('clear storage network failure is reported after confirmed database removal', async () => {
  removeThrows = true
  await expect(clearSportDefaultPhoto('sport-1')).resolves.toMatchObject({
    path: null,
    warning: expect.stringMatching(/scoasă.*Storage/),
  })
})

test('external fallback photos are never passed to managed storage deletion', async () => {
  responses = [read('https://example.test/photo.jpg'), saved]
  await clearSportDefaultPhoto('sport-1')
  expect(events.some((event) => event.method === 'remove')).toBe(false)
})
