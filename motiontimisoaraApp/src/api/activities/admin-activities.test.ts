import { beforeEach, expect, test, vi } from 'vitest'

import { createAdminActivity, getAllActivitiesAdmin, updateAdminActivity } from './admin-activities'
import type { ActivityFormInput } from '@/api/coach'

const calls: { table: string; op: string; arg?: unknown }[] = []
const results: Record<string, { data: unknown; error: null | { message: string } }> = {}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: () => chain,
        range: () => chain,
        single: () => chain,
        insert: (arg: unknown) => (calls.push({ table, op: 'insert', arg }), chain),
        update: (arg: unknown) => (calls.push({ table, op: 'update', arg }), chain),
        then: (resolve: (v: unknown) => unknown) => resolve(results[table]),
      }
      return chain
    },
  },
}))

const input = { name: 'Atelier', price: 5000 } as ActivityFormInput

beforeEach(() => {
  calls.length = 0
  results.activities = { data: [], error: null }
  results.enrollments = { data: [], error: null }
})

test('counts active enrollments per activity', async () => {
  results.activities.data = [
    { id: 'a1', name: 'Atelier' },
    { id: 'a2', name: 'Tură' },
  ]
  results.enrollments.data = [{ entity_id: 'a1' }, { entity_id: 'a1' }, { entity_id: 'x' }]
  const [a1, a2] = await getAllActivitiesAdmin()
  expect(a1.enrolled).toBe(2)
  expect(a2.enrolled).toBe(0)
})

test('throws the database error', async () => {
  results.activities.error = { message: 'nope' }
  await expect(getAllActivitiesAdmin()).rejects.toEqual({ message: 'nope' })
})

test('a club activity pays the club, an independent one pays the coach', async () => {
  results.activities.data = { id: 'n1' }
  await createAdminActivity({ clubId: 'c1', coachId: 'u1' }, input)
  await createAdminActivity({ clubId: null, coachId: 'u2' }, input)
  expect(calls.map((c) => c.arg)).toEqual([
    { ...input, coach_id: 'u1', club_id: 'c1', payment_recipient: 'CLUB', active: true },
    { ...input, coach_id: 'u2', club_id: null, payment_recipient: 'COACH', active: true },
  ])
})

test('editing can change the coach but never the organizer', async () => {
  results.activities.data = { id: 'a1' }
  await updateAdminActivity('a1', 'u3', input)
  expect(calls[0].arg).toEqual({ ...input, coach_id: 'u3' })
})
