import { beforeEach, expect, test, vi } from 'vitest'

import { createCoachAccount, deleteInviteCode, generateCoachInviteCode } from '../admin'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  insert: vi.fn(),
  invoke: vi.fn(),
  deleteCode: vi.fn(),
  equal: vi.fn(),
  single: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    functions: { invoke: mocks.invoke },
    from: () => ({
      insert: mocks.insert,
      delete: mocks.deleteCode,
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'admin-test' } } } })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.deleteCode.mockReturnValue({ eq: mocks.equal })
  mocks.equal.mockReturnValue({ select: () => ({ single: mocks.single }) })
  mocks.single.mockResolvedValue({ error: null })
})

test('generation retains one use and no expiry by default', async () => {
  const code = await generateCoachInviteCode()
  expect(code).toMatch(/^COACH-[A-Z2-9]{8}$/)
  expect(mocks.insert).toHaveBeenCalledWith({
    code,
    created_by_admin_id: 'admin-test',
    max_uses: 1,
    current_uses: 0,
    expires_at: null,
  })
})

test('generation forwards the configured limit and expiry instant', async () => {
  const expiresAt = new Date(Date.now() + 3600000).toISOString()
  await generateCoachInviteCode(3, expiresAt)
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({ max_uses: 3, expires_at: expiresAt }),
  )
})

test.each([0, -1, 1.5, NaN, Infinity, 2147483648])(
  'invalid max uses %s never sends a request',
  async (value) => {
    await expect(generateCoachInviteCode(value)).rejects.toThrow('întreg')
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  },
)

test.each(['invalid', '2000-01-01T00:00:00Z', ''])(
  'invalid expiry %s never sends a request',
  async (value) => {
    await expect(generateCoachInviteCode(1, value)).rejects.toThrow('viitor')
    expect(mocks.insert).not.toHaveBeenCalled()
  },
)

test('generation propagates a backend failure without returning a code', async () => {
  mocks.insert.mockResolvedValue({ error: new Error('Rejected') })
  await expect(generateCoachInviteCode()).rejects.toThrow('Rejected')
})

test('deletion targets the chosen row and propagates rejection', async () => {
  mocks.single.mockResolvedValue({ error: new Error('Rejected') })
  await expect(deleteInviteCode('chosen-row')).rejects.toThrow('Rejected')
  expect(mocks.equal).toHaveBeenCalledWith('id', 'chosen-row')
})

test('coach API propagates the partial-profile error', async () => {
  mocks.invoke.mockResolvedValue({
    data: null,
    error: { context: { json: async () => ({ error: 'Profilul nu a putut fi creat.' }) } },
  })
  await expect(
    createCoachAccount({ name: 'Test Coach', email: 'coach@example.test' }),
  ).rejects.toThrow('Profilul nu a putut fi creat.')
})

test.each([null, {}, { userId: 'synthetic', email: 'coach@example.test' }])(
  'incomplete coach response cannot report success: %s',
  async (data) => {
    mocks.invoke.mockResolvedValue({ data, error: null })
    await expect(
      createCoachAccount({ name: 'Test Coach', email: 'coach@example.test' }),
    ).rejects.toThrow('nu confirmă')
  },
)

test('coach API sends the chosen club and returns the confirmed club', async () => {
  const clubId = '00000000-0000-4000-8000-0000000000a1'
  mocks.invoke.mockResolvedValue({
    data: { userId: 'synthetic', email: 'coach@example.test', tempPassword: 'synthetic', clubId },
    error: null,
  })
  await expect(
    createCoachAccount({ name: 'Test Coach', email: 'coach@example.test', clubId }),
  ).resolves.toEqual({
    userId: 'synthetic',
    email: 'coach@example.test',
    tempPassword: 'synthetic',
    clubId,
  })
  expect(mocks.invoke).toHaveBeenCalledWith('create-managed-coach', {
    body: { name: 'Test Coach', email: 'coach@example.test', clubId },
  })
})

test('coach API rejects a response that does not confirm the chosen club', async () => {
  mocks.invoke.mockResolvedValue({
    data: {
      userId: 'synthetic',
      email: 'coach@example.test',
      tempPassword: 'synthetic',
      clubId: null,
    },
    error: null,
  })
  await expect(
    createCoachAccount({
      name: 'Test Coach',
      email: 'coach@example.test',
      clubId: '00000000-0000-4000-8000-0000000000a1',
    }),
  ).rejects.toThrow('nu confirmă adăugarea antrenorului în club')
})
