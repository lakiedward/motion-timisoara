import { vi } from 'vitest'
import {
  addCompetitionRoutePhotos,
  competitionRoutePhotoUrl,
  deleteCompetitionRoutePhoto,
  listCompetitionRoutePhotos,
  moveCompetitionRoutePhoto,
  type CompetitionRoutePhoto,
} from './competition-route-photos'

const state = vi.hoisted(() => ({
  replies: [] as Array<{ data: unknown; error: { message: string } | null }>,
  queries: [] as Array<{ table: string; action: string; payload?: unknown }>,
  uploads: [] as Array<{ path: string; contentType: string }>,
  removed: [] as string[][],
  removeError: false,
}))

vi.mock('@/lib/media', () => ({
  esteImagine: (file: File) => file.type.startsWith('image/'),
  micsoreazaPoza: async (file: File) => file,
}))

vi.mock('@/lib/supabase', () => {
  function tableQuery(table: string) {
    let action = 'select'
    let payload: unknown
    const nextReply = () => {
      state.queries.push({ table, action, payload })
      return state.replies.shift() ?? { data: [], error: null }
    }
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      insert: (value: unknown) => {
        action = 'insert'
        payload = value
        return query
      },
      update: (value: unknown) => {
        action = 'update'
        payload = value
        return query
      },
      delete: () => {
        action = 'delete'
        return query
      },
      single: async () => nextReply(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(nextReply()).then(resolve),
    }
    return query
  }

  return {
    supabase: {
      from: tableQuery,
      storage: {
        from: () => ({
          upload: async (path: string, _content: Blob, options: { contentType: string }) => {
            state.uploads.push({ path, contentType: options.contentType })
            return { error: null }
          },
          remove: async (paths: string[]) => {
            state.removed.push(paths)
            return { error: state.removeError ? { message: 'remove failed' } : null }
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://example.test/${path}` },
          }),
        }),
      },
    },
  }
})

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const routeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const photoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const path = `${competitionId}/routes/${routeId}/gallery/${photoId}.png`
const photo: CompetitionRoutePhoto = {
  id: photoId,
  competition_id: competitionId,
  route_id: routeId,
  storage_path: path,
  display_order: 0,
  created_at: '2026-09-23T12:00:00Z',
  url: `https://example.test/${path}`,
}

beforeEach(() => {
  state.replies = []
  state.queries = []
  state.uploads = []
  state.removed = []
  state.removeError = false
  vi.stubGlobal('crypto', { randomUUID: () => photoId })
})

afterEach(() => vi.unstubAllGlobals())

test('lists route gallery photos with public URLs', async () => {
  state.replies = [{ data: [{ ...photo, url: undefined }], error: null }]
  const photos = await listCompetitionRoutePhotos(competitionId)
  expect(photos).toEqual([photo])
  expect(competitionRoutePhotoUrl(path)).toBe(photo.url)
})

test('uploads a small PNG with a matching extension and MIME type before writing its row', async () => {
  state.replies = [
    { data: [], error: null },
    { data: photo, error: null },
  ]
  const png = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    'traseu.png',
    { type: 'image/png' },
  )
  const result = await addCompetitionRoutePhotos(competitionId, routeId, [png], 0)
  expect(result).toEqual({ added: 1, rejected: [] })
  expect(state.uploads).toEqual([{ path, contentType: 'image/png' }])
  expect(state.queries[1]).toMatchObject({
    table: 'competition_route_photos',
    action: 'insert',
    payload: {
      competition_id: competitionId,
      route_id: routeId,
      storage_path: path,
      display_order: 0,
    },
  })
})

test('appends after the highest order when an earlier photo was deleted', async () => {
  state.replies = [
    { data: [{ display_order: 2 }], error: null },
    { data: photo, error: null },
  ]
  const png = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    'noua.png',
    { type: 'image/png' },
  )
  const result = await addCompetitionRoutePhotos(competitionId, routeId, [png], 2)
  expect(result.added).toBe(1)
  expect(state.queries[1].payload).toMatchObject({ display_order: 3 })
})

test('rejects unrecognized image bytes and excess photos without uploading', async () => {
  const corrupt = new File(['not an image'], 'bad.png', { type: 'image/png' })
  const result = await addCompetitionRoutePhotos(competitionId, routeId, [corrupt], 0)
  expect(result).toEqual({ added: 0, rejected: ['bad.png: formatul imaginii nu este compatibil.'] })
  const full = await addCompetitionRoutePhotos(competitionId, routeId, [corrupt], 12)
  expect(full.rejected[0]).toContain('cel mult 12')
  expect(state.uploads).toEqual([])
  expect(state.queries).toEqual([])
})

test('removes an uploaded file when its gallery row cannot be inserted', async () => {
  state.replies = [
    { data: [], error: null },
    { data: null, error: { message: 'insert failed' } },
  ]
  const png = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    'traseu.png',
    { type: 'image/png' },
  )
  const result = await addCompetitionRoutePhotos(competitionId, routeId, [png], 0)
  expect(result.added).toBe(0)
  expect(result.rejected).toHaveLength(1)
  expect(state.removed).toEqual([[path]])
})

test('reports Storage cleanup failure after deleting the gallery row', async () => {
  state.replies = [{ data: { storage_path: path }, error: null }]
  state.removeError = true
  await expect(deleteCompetitionRoutePhoto(photo)).resolves.toEqual({ cleanupFailed: true })
  expect(state.queries[0].action).toBe('delete')
  expect(state.removed).toEqual([[path]])
})

test('moves only neighboring photos from the same route', async () => {
  const neighbor = {
    ...photo,
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    display_order: 1,
  }
  state.replies = [
    { data: { ...photo, display_order: 1 }, error: null },
    { data: { ...neighbor, display_order: 0 }, error: null },
  ]
  await moveCompetitionRoutePhoto([photo, neighbor], 0, 1)
  expect(state.queries.map((query) => query.payload)).toEqual([
    { display_order: 1 },
    { display_order: 0 },
  ])
  state.queries = []
  await moveCompetitionRoutePhoto([photo, { ...neighbor, route_id: 'other' }], 0, 1)
  expect(state.queries).toEqual([])
})
