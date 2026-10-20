import { beforeEach, expect, test, vi } from 'vitest'

import { getAllLocationsAdmin } from './admin-locations'

const result = { data: [] as unknown[], error: null as null | { message: string } }
vi.mock('@/lib/supabase', () => {
  const chain = {
    select: () => chain,
    order: () => chain,
    then: (resolve: (v: typeof result) => unknown) => resolve(result),
  }
  return { supabase: { from: () => chain } }
})

beforeEach(() => {
  result.error = null
})

test('lists the other organizers whose courses use a location, without its owner', async () => {
  result.data = [
    {
      id: 'l1',
      name: 'Bazin Audit',
      club_id: 'c1',
      created_by_user_id: null,
      club: { id: 'c1', name: 'Club Audit' },
      creator: null,
      courses: [
        { club_id: 'c1', coach_id: 'u9', club: { name: 'Club Audit' }, coach: { name: 'X' } },
        { club_id: null, coach_id: 'u2', club: null, coach: { name: 'Ana Rusu' } },
        { club_id: null, coach_id: 'u2', club: null, coach: { name: 'Ana Rusu' } },
      ],
    },
    {
      id: 'l2',
      name: 'Parc',
      club_id: null,
      created_by_user_id: 'u2',
      club: null,
      creator: { id: 'u2', name: 'Ana Rusu' },
      courses: [
        { club_id: null, coach_id: 'u2', club: null, coach: { name: 'Ana Rusu' } },
        { club_id: 'c3', coach_id: 'u7', club: { name: 'Baschet Vest' }, coach: { name: 'Y' } },
      ],
    },
  ]
  const [bazin, parc] = await getAllLocationsAdmin()
  expect(bazin).toMatchObject({ courseCount: 3, usedBy: ['Ana Rusu'] })
  expect(parc).toMatchObject({ courseCount: 2, usedBy: ['Baschet Vest'] })
  expect(bazin).not.toHaveProperty('courses')
})

test('throws the database error', async () => {
  result.error = { message: 'nope' }
  await expect(getAllLocationsAdmin()).rejects.toEqual({ message: 'nope' })
})
