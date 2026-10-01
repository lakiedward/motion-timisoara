import { redeemCoachInvitation, type CoachInvitationInput } from './index'

const invoke = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))
beforeEach(() => {
  invoke.mockReset()
})

test('redemption sends coach details but never a supplied identity or credentials', async () => {
  invoke.mockResolvedValue({
    data: { coachProfileId: 'profile-1', alreadyCoach: false },
    error: null,
  })
  const input = {
    invitationCode: 'INVITE',
    name: 'Ana',
    sportIds: ['sport-1'],
    userId: 'forged-user',
    email: 'forged@example.test',
    password: 'unused',
  } as CoachInvitationInput
  expect(await redeemCoachInvitation(input)).toEqual({
    coachProfileId: 'profile-1',
    alreadyCoach: false,
  })
  expect(invoke).toHaveBeenCalledExactlyOnceWith('redeem-coach-invitation', {
    body: {
      invitationCode: 'INVITE',
      name: 'Ana',
      phone: undefined,
      bio: undefined,
      sportIds: ['sport-1'],
    },
  })
})

test('the server Romanian rejection is shown on the invitation form', async () => {
  invoke.mockResolvedValue({
    error: {
      context: new Response(
        JSON.stringify({
          code: 'INVITATION_EXPIRED',
          error: 'Codul de invitație a expirat. Cere unul nou clubului.',
        }),
        {
          status: 400,
        },
      ),
    },
  })
  expect(await redeemCoachInvitation({ invitationCode: 'INVITE', name: 'Ana' })).toEqual({
    error: { message: 'Codul de invitație a expirat. Cere unul nou clubului.' },
  })
})

test.each([{ data: null }, { data: { coachProfileId: 'profile-1' } }, { error: {} }])(
  'malformed or failed response cannot claim promotion: %j',
  async (result) => {
    invoke.mockResolvedValue(result)
    expect(await redeemCoachInvitation({ invitationCode: 'INVITE', name: 'Ana' })).toHaveProperty(
      'error',
    )
  },
)

test('network exceptions use the safe fallback instead of SDK or transport details', async () => {
  invoke.mockRejectedValue(new Error('sensitive transport details'))
  expect(await redeemCoachInvitation({ invitationCode: 'INVITE', name: 'Ana' })).toEqual({
    error: { message: 'Nu am putut activa contul de antrenor. Încearcă din nou.' },
  })
})
