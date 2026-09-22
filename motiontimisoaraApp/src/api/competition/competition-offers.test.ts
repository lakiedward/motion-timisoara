import { vi } from 'vitest'
import {
  competitionRouteGpxDownloadUrl,
  createCompetitionRoute,
  deleteCompetitionRoute,
  updateCompetitionRoute,
  validateCompetitionCategory,
  type CompetitionOffers,
} from './competition-offers'

const state = vi.hoisted(() => ({
  replies: [] as Array<{ data: unknown; error: { message: string } | null }>,
  queries: [] as Array<{ table: string; action: string; payload?: unknown }>,
  uploads: [] as Array<{ path: string; options: unknown }>,
  removed: [] as string[][],
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
          upload: async (path: string, _content: Blob, options: unknown) => {
            state.uploads.push({ path, options })
            return { error: null }
          },
          remove: async (paths: string[]) => {
            state.removed.push(paths)
            return { error: null }
          },
          getPublicUrl: (path: string, options?: { download?: boolean }) => ({
            data: {
              publicUrl: `https://example.test/${path}${options?.download ? '?download=1' : ''}`,
            },
          }),
        }),
      },
    },
  }
})

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const routeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const fileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const route = {
  id: routeId,
  competition_id: competitionId,
  name: 'Traseu scurt',
  description: 'În jurul parcului',
  gpx_storage_path: null,
  display_order: 0,
  created_at: '2026-09-22T12:00:00Z',
  updated_at: '2026-09-22T12:00:00Z',
}
const gpx = '<gpx><rte><rtept lat="45" lon="21"/><rtept lat="46" lon="22"/></rte></gpx>'

beforeEach(() => {
  state.replies = []
  state.queries = []
  state.uploads = []
  state.removed = []
  const randomUUID = vi.fn().mockReturnValueOnce(routeId).mockReturnValueOnce(fileId)
  vi.stubGlobal('crypto', { randomUUID })
})

afterEach(() => vi.unstubAllGlobals())

test('category intervals are inclusive and cannot overlap even across different routes', () => {
  const offers: CompetitionOffers = {
    routes: [{ ...route, gpx_storage_path: `${competitionId}/routes/${routeId}/${fileId}.gpx` }],
    categories: [
      {
        id: 'category-1',
        competition_id: competitionId,
        route_id: routeId,
        name: 'Copii mici',
        age_from: 6,
        age_to: 9,
        price_bani: 0,
        display_order: 0,
        created_at: '',
        updated_at: '',
      },
    ],
  }
  expect(() =>
    validateCompetitionCategory(
      { name: 'Copii mari', route_id: routeId, age_from: 9, age_to: 12, price_bani: 1000 },
      offers,
    ),
  ).toThrow('se suprapune')
  expect(
    validateCompetitionCategory(
      { name: 'Copii mari', route_id: routeId, age_from: 10, age_to: 12, price_bani: 0 },
      offers,
    ).age_from,
  ).toBe(10)
  expect(() =>
    validateCompetitionCategory(
      { name: 'Copii mari', route_id: routeId, age_from: 10, age_to: 12, price_bani: 0 },
      { ...offers, routes: [route] },
    ),
  ).toThrow('GPX salvat')
})

test('category price stays within the card charge limit', () => {
  const offers: CompetitionOffers = {
    routes: [{ ...route, gpx_storage_path: `${competitionId}/routes/${routeId}/${fileId}.gpx` }],
    categories: [],
  }
  const input = {
    name: 'Copii',
    route_id: routeId,
    age_from: 6,
    age_to: 9,
    price_bani: 99_999_999,
  }
  expect(validateCompetitionCategory(input, offers).price_bani).toBe(99_999_999)
  expect(() => validateCompetitionCategory({ ...input, price_bani: 100_000_000 }, offers)).toThrow(
    '999.999,99 lei',
  )
})

test('creates the route before uploading its bounded GPX to the path required by storage RLS', async () => {
  const path = `${competitionId}/routes/${routeId}/${fileId}.gpx`
  state.replies = [
    { data: route, error: null },
    { data: { ...route, gpx_storage_path: path }, error: null },
  ]
  const file = new File([gpx], 'route.gpx', { type: 'application/gpx+xml' })
  Object.defineProperty(file, 'text', { value: async () => gpx })
  const saved = await createCompetitionRoute(
    competitionId,
    { name: route.name, description: route.description },
    file,
  )
  expect(saved.gpx_storage_path).toBe(path)
  expect(state.queries.map((query) => query.action)).toEqual(['insert', 'update'])
  expect(state.uploads).toEqual([
    { path, options: { contentType: 'application/gpx+xml', upsert: false } },
  ])
  expect(competitionRouteGpxDownloadUrl(path)).toContain('download=1')
})

test('rejects invalid GPX before inserting a route', async () => {
  const file = new File(['<gpx/>'], 'route.gpx', { type: 'application/gpx+xml' })
  Object.defineProperty(file, 'text', { value: async () => '<gpx/>' })
  await expect(
    createCompetitionRoute(
      competitionId,
      { name: route.name, description: route.description },
      file,
    ),
  ).rejects.toThrow('nu conține un traseu')
  expect(state.queries).toEqual([])
  expect(state.uploads).toEqual([])
})

test('removes a newly uploaded GPX and its row if linking the file fails', async () => {
  const path = `${competitionId}/routes/${routeId}/${fileId}.gpx`
  state.replies = [
    { data: route, error: null },
    { data: null, error: { message: 'update failed' } },
    { data: null, error: null },
  ]
  const file = new File([gpx], 'route.gpx', { type: 'application/gpx+xml' })
  Object.defineProperty(file, 'text', { value: async () => gpx })
  await expect(
    createCompetitionRoute(
      competitionId,
      { name: route.name, description: route.description },
      file,
    ),
  ).rejects.toMatchObject({ message: 'update failed' })
  expect(state.removed).toEqual([[path]])
  expect(state.queries.map((query) => query.action)).toEqual(['insert', 'update', 'delete'])
})

test('replaces GPX only after the route row accepts the new storage path', async () => {
  const oldPath = `${competitionId}/routes/${routeId}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.gpx`
  const newPath = `${competitionId}/routes/${routeId}/${fileId}.gpx`
  state.replies = [
    { data: { ...route, gpx_storage_path: oldPath }, error: null },
    { data: { ...route, gpx_storage_path: newPath }, error: null },
  ]
  vi.stubGlobal('crypto', { randomUUID: () => fileId })
  const file = new File([gpx], 'new-route.gpx', { type: 'application/gpx+xml' })
  Object.defineProperty(file, 'text', { value: async () => gpx })
  const result = await updateCompetitionRoute(
    competitionId,
    routeId,
    { name: route.name, description: route.description },
    file,
  )
  expect(result.route.gpx_storage_path).toBe(newPath)
  expect(state.uploads[0].path).toBe(newPath)
  expect(state.removed).toEqual([[oldPath]])
  expect(result.cleanupFailed).toBe(false)
})

test('refuses route deletion while a category references it', async () => {
  state.replies = [{ data: [{ id: 'category-1' }], error: null }]
  await expect(deleteCompetitionRoute(competitionId, routeId)).rejects.toThrow('Șterge sau mută')
  expect(state.queries.map((query) => query.action)).toEqual(['select'])
})
