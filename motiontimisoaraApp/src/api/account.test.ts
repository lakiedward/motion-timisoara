import { beforeEach, expect, test, vi } from 'vitest'

import { getMyEnrollments } from './account'

const tables: string[] = []
const responses = new Map<string, { data: unknown; error: unknown }>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(name: string) {
      tables.push(name)
      const current = name
      const api: Record<string, unknown> = {}
      const chain = () => api
      for (const method of ['select', 'order', 'in', 'eq']) api[method] = chain
      api.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve(responses.get(current) ?? { data: [], error: null }))
      return api
    },
  },
}))

const enrollment = (kind: string, entityId: string, id = entityId) => ({
  id,
  kind,
  entity_id: entityId,
  status: 'ACTIVE',
  child_id: 'child-1',
  adult_profile_id: null,
  created_at: '2026-09-22T00:00:00Z',
  child: { id: 'child-1', name: 'Copil' },
  payments: [],
})

beforeEach(() => {
  tables.length = 0
  responses.clear()
})

test('an empty enrollment list does not look up offer titles', async () => {
  responses.set('enrollments', { data: [], error: null })
  expect(await getMyEnrollments()).toEqual([])
  expect(tables).toEqual(['enrollments'])
})

test('camp, course and activity titles lead from the matching offer', async () => {
  responses.set('enrollments', {
    data: [
      enrollment('CAMP', 'camp-1', 'e-camp'),
      enrollment('COURSE', 'course-1', 'e-course'),
      enrollment('ACTIVITY', 'activity-1', 'e-activity'),
      enrollment('CAMP', 'missing', 'e-missing'),
    ],
    error: null,
  })
  responses.set('camps', {
    data: [{ id: 'camp-1', title: '  Tabără audit 152  ' }],
    error: null,
  })
  responses.set('courses', { data: [{ id: 'course-1', name: 'Curs de înot' }], error: null })
  responses.set('activities', {
    data: [{ id: 'activity-1', name: 'Activitate de ciclism' }],
    error: null,
  })
  const rows = await getMyEnrollments()
  expect(rows.map((row) => row.offerTitle)).toEqual([
    'Tabără audit 152',
    'Curs de înot',
    'Activitate de ciclism',
    null,
  ])
  expect(tables).toEqual(['enrollments', 'camps', 'courses', 'activities'])
})

test('a failed offer lookup keeps the enrollment page in its error state', async () => {
  responses.set('enrollments', { data: [enrollment('CAMP', 'camp-1')], error: null })
  responses.set('camps', { data: null, error: { message: 'unavailable' } })
  await expect(getMyEnrollments()).rejects.toMatchObject({ message: 'unavailable' })
})
