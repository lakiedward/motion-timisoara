import { vi } from 'vitest'
import {
  getCompetitionCoaches,
  getMyCompetitionInvitations,
  getPublicCompetitionCoaches,
  inviteCompetitionCoach,
  respondToCompetitionInvitation,
} from './competition-coaches'

const state = vi.hoisted(() => ({
  replies: [] as Array<{ data: unknown; error: { message: string } | null }>,
  queries: [] as Array<{
    table: string
    action: string
    filters: Array<[string, unknown]>
    payload?: unknown
  }>,
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
}))

vi.mock('@/api/camp-coaches', () => ({ cautaAntrenori: vi.fn().mockResolvedValue([]) }))

vi.mock('@/lib/supabase', () => {
  function tableQuery(table: string) {
    let action = 'select'
    let payload: unknown
    const filters: Array<[string, unknown]> = []
    const reply = () => {
      state.queries.push({ table, action, filters, payload })
      return state.replies.shift() ?? { data: [], error: null }
    }
    const query = {
      select: () => query,
      order: () => query,
      limit: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return query
      },
      in: (column: string, value: unknown) => {
        filters.push([column, value])
        return query
      },
      insert: (value: unknown) => {
        action = 'insert'
        payload = value
        return query
      },
      delete: () => {
        action = 'delete'
        return query
      },
      single: async () => reply(),
      maybeSingle: async () => reply(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(reply()).then(resolve),
    }
    return query
  }
  return {
    supabase: {
      from: tableQuery,
      rpc: async (name: string, args: unknown) => {
        state.rpcCalls.push({ name, args })
        return { error: null }
      },
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }),
        }),
      },
    },
  }
})

beforeEach(() => {
  state.replies = []
  state.queries = []
  state.rpcCalls = []
})

test('the public coach query explicitly filters accepted invitations', async () => {
  state.replies = [
    {
      data: [{ coach_profile_id: 'coach-1', status: 'accepted', responded_at: '2026-09-22' }],
      error: null,
    },
    {
      data: [{ id: 'coach-1', photo_storage_path: 'photo.jpg', profile: { name: 'Ana' } }],
      error: null,
    },
  ]
  const coaches = await getPublicCompetitionCoaches('competition-1')
  expect(state.queries[0].filters).toContainEqual(['status', 'accepted'])
  expect(coaches).toEqual([
    {
      coachProfileId: 'coach-1',
      name: 'Ana',
      photoUrl: 'https://example.test/photo.jpg',
      status: 'accepted',
      respondedAt: '2026-09-22',
    },
  ])
})

test('organizer query includes pending invitations while invite insert omits status', async () => {
  state.replies = [
    { data: [{ coach_profile_id: 'coach-1', status: 'invited', responded_at: null }], error: null },
    { data: [{ id: 'coach-1', photo_storage_path: null, profile: { name: 'Ana' } }], error: null },
    { data: { id: 'invitation-1' }, error: null },
  ]
  expect((await getCompetitionCoaches('competition-1'))[0].status).toBe('invited')
  expect(state.queries[0].filters).not.toContainEqual(['status', 'accepted'])
  await inviteCompetitionCoach('competition-1', 'coach-2')
  expect(state.queries[2].payload).toEqual({
    competition_id: 'competition-1',
    coach_profile_id: 'coach-2',
  })
})

test('coach invitation response uses the consent RPC with the authenticated caller', async () => {
  await respondToCompetitionInvitation('competition-1', false)
  expect(state.rpcCalls).toEqual([
    {
      name: 'respond_to_competition_invitation',
      args: { p_competition_id: 'competition-1', p_accept: false },
    },
  ])
})

test('coach invitations resolve competition details without exposing another coach profile', async () => {
  state.replies = [
    { data: { id: 'coach-1' }, error: null },
    { data: [{ competition_id: 'competition-1', status: 'invited' }], error: null },
    {
      data: [
        {
          id: 'competition-1',
          title: 'Cupa Motion',
          slug: 'cupa-motion',
          start_at: null,
          end_at: null,
          location_text: 'Timișoara',
        },
      ],
      error: null,
    },
  ]
  const invitations = await getMyCompetitionInvitations('user-1')
  expect(state.queries[0].filters).toContainEqual(['user_id', 'user-1'])
  expect(state.queries[1].filters).toContainEqual(['coach_profile_id', 'coach-1'])
  expect(invitations[0]).toMatchObject({
    competitionId: 'competition-1',
    status: 'invited',
    title: 'Cupa Motion',
  })
})
