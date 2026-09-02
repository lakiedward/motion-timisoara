import { beforeEach, expect, test, vi } from 'vitest'

import { updateMyCoachProfile } from './coach'

const getSession = vi.fn()
const profilesEq = vi.fn()
const coachUpdateSelect = vi.fn()
const coachInsert = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        // Scrierea cere acum rândul înapoi, deci lanțul se termină în `.single()`.
        return {
          update: () => ({
            eq: () => ({ select: () => ({ single: (...args: unknown[]) => profilesEq(...args) }) }),
          }),
        }
      }
      return {
        update: () => ({
          eq: () => ({ select: (...args: unknown[]) => coachUpdateSelect(...args) }),
        }),
        insert: (...args: unknown[]) => coachInsert(...args),
      }
    },
  },
}))

beforeEach(() => {
  getSession.mockReset()
  profilesEq.mockReset()
  coachUpdateSelect.mockReset()
  coachInsert.mockReset()
  getSession.mockResolvedValue({ data: { session: { user: { id: 'coach-1' } } } })
  profilesEq.mockResolvedValue({ error: null })
})

test('updateMyCoachProfile updates bio when a coach_profiles row exists', async () => {
  coachUpdateSelect.mockResolvedValue({ data: [{ id: 'cp-1' }], error: null })

  await updateMyCoachProfile({ name: 'Audit Antrenor', phone: null, bio: 'Bio nou' })

  expect(coachInsert).not.toHaveBeenCalled()
})

test('updateMyCoachProfile inserts coach_profiles when update matches zero rows', async () => {
  coachUpdateSelect.mockResolvedValue({ data: [], error: null })
  coachInsert.mockResolvedValue({ error: null })

  await updateMyCoachProfile({ name: 'Audit Antrenor', phone: null, bio: 'Bio nou' })

  expect(coachInsert).toHaveBeenCalledWith({ user_id: 'coach-1', bio: 'Bio nou' })
})
