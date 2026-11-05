import { beforeEach, expect, test, vi } from 'vitest'

import { createCourse, updateCourse } from './coach'

const insert = vi.fn()
const update = vi.fn()

vi.mock('@/api/course-occurrences', () => ({ regenerateCourseOccurrences: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'coach-1' } } } }) },
    from: () => ({
      insert: (row: unknown) => {
        insert(row)
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }
      },
      update: (row: unknown) => {
        update(row)
        return {
          eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }),
        }
      },
    }),
  },
}))

const input = {
  name: 'Înot',
  sport_id: 's1',
  location_id: 'l1',
  level: null,
  age_from: 6,
  age_to: 10,
  capacity: null,
  price_per_session: 1_000,
  currency: 'RON' as const,
  eur_ron_rate_micros: null,
  description: null,
  recurrence_rule: '{}',
}

beforeEach(() => {
  insert.mockReset()
  update.mockReset()
})

test('a new course stores the per-session price, not a weekly-schedule multiple', async () => {
  await createCourse(input)
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ price: 1_000, price_per_session: 1_000 }))
})

test('editing a course keeps price equal to the per-session price', async () => {
  await updateCourse('c1', { ...input, price_per_session: 1_500 })
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ price: 1_500, price_per_session: 1_500 }))
})
