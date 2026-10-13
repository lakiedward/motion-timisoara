import { getMyCoachClubs, joinClubByInvitation } from './club-membership'

const rpc = vi.fn()
const eq = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ select: () => ({ eq: (...args: unknown[]) => eq(...args) }) }),
  },
}))
beforeEach(() => {
  rpc.mockReset()
  eq.mockReset()
})

test('joining sends only the trimmed code; identity comes from the session', async () => {
  rpc.mockResolvedValue({
    data: { clubId: 'club-1', clubName: 'Club Test', alreadyMember: false },
    error: null,
  })
  expect(await joinClubByInvitation('  ABCD-2345 ')).toEqual({
    clubId: 'club-1',
    clubName: 'Club Test',
    alreadyMember: false,
  })
  expect(rpc).toHaveBeenCalledExactlyOnceWith('join_club_by_invitation', { p_code: 'ABCD-2345' })
})

test.each([
  ['INVITATION_EXPIRED', 'Codul de invitație a expirat. Cere unul nou clubului.'],
  ['INVITATION_EXHAUSTED', 'Codul de invitație a fost deja folosit de numărul maxim de ori.'],
  ['INVALID_INVITATION', 'Cod de invitație invalid.'],
  ['ROLE_NOT_ELIGIBLE', 'Doar un cont de antrenor se poate alătura unui club cu acest cod.'],
  ['permission denied for function', 'Nu am putut adăuga clubul. Încearcă din nou.'],
])('database rejection %s becomes Romanian feedback', async (code, message) => {
  rpc.mockResolvedValue({ data: null, error: { message: code } })
  expect(await joinClubByInvitation('ABCD-2345')).toEqual({ error: { message } })
})

test.each([
  { data: null, error: null },
  { data: { clubId: 'club-1' }, error: null },
])('malformed response cannot claim membership: %j', async (result) => {
  rpc.mockResolvedValue(result)
  expect(await joinClubByInvitation('ABCD-2345')).toHaveProperty('error')
})

test('network exceptions use the safe fallback', async () => {
  rpc.mockRejectedValue(new Error('transport details'))
  expect(await joinClubByInvitation('ABCD-2345')).toEqual({
    error: { message: 'Nu am putut adăuga clubul. Încearcă din nou.' },
  })
})

test('coach clubs are read for the session coach profile and sorted by name', async () => {
  rpc.mockResolvedValue({ data: 'coach-profile-1', error: null })
  eq.mockResolvedValue({
    data: [
      { club_id: 'b', clubs: { id: 'b', name: 'Ștrand Club' } },
      { club_id: 'a', clubs: { id: 'a', name: 'Atletic' } },
      { club_id: 'c', clubs: null },
    ],
    error: null,
  })
  expect(await getMyCoachClubs()).toEqual([
    { id: 'a', name: 'Atletic' },
    { id: 'b', name: 'Ștrand Club' },
  ])
  expect(rpc).toHaveBeenCalledWith('get_my_coach_profile_id')
  expect(eq).toHaveBeenCalledWith('coach_profile_id', 'coach-profile-1')
})

test('an account without a coach profile has no clubs', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  expect(await getMyCoachClubs()).toEqual([])
  expect(eq).not.toHaveBeenCalled()
})
