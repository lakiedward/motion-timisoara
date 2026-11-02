import { beforeEach, expect, test, vi } from 'vitest'

import { getAdminClub, getAdminUserProfile, updateAdminUserProfile } from './admin-accounts'

type Answer = { data: unknown; error: unknown }
let answers: Record<string, Answer> = {}
let calls: string[] = []

function table(name: string) {
  const chain: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(answers[name] ?? { data: null, error: null }))
      }
      return (...args: unknown[]) => {
        calls.push(`${name}.${prop}(${args.map((a) => JSON.stringify(a)).join(',')})`)
        return chain
      }
    },
  })
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (name: string) => table(name),
    rpc: async (name: string, args?: unknown) => {
      calls.push(`rpc.${name}(${JSON.stringify(args ?? null)})`)
      return answers[`rpc:${name}`] ?? { data: null, error: { message: `missing ${name}` } }
    },
  },
}))

const parent = {
  id: 'u1',
  name: 'Ana Pop',
  email: 'ana@example.com',
  role: 'PARENT',
  enabled: true,
  phone: '0722000000',
}

beforeEach(() => {
  answers = {}
  calls = []
})

test('reads the phone through admin_user_detail when the function exists', async () => {
  answers['rpc:admin_user_detail'] = { data: [parent], error: null }
  const user = await getAdminUserProfile('u1')
  expect(user).toMatchObject({ name: 'Ana Pop', phone: '0722000000', phoneKnown: true })
  expect(calls).toContain('rpc.admin_user_detail({"p_user_id":"u1"})')
})

test('falls back to admin_users without a phone while the migration is not applied', async () => {
  answers['rpc:admin_user_detail'] = { data: null, error: { code: 'PGRST202' } }
  answers['rpc:admin_users'] = {
    data: [{ id: 'u1', name: 'Ana Pop', email: 'ana@example.com', role: 'PARENT', enabled: true }],
    error: null,
  }
  const user = await getAdminUserProfile('u1')
  expect(user).toMatchObject({ name: 'Ana Pop', phone: null, phoneKnown: false })
})

test('any other read error is thrown, not hidden as a missing user', async () => {
  answers['rpc:admin_user_detail'] = { data: null, error: { code: '42501' } }
  await expect(getAdminUserProfile('u1')).rejects.toEqual({ code: '42501' })
})

test('an unknown id returns null', async () => {
  answers['rpc:admin_user_detail'] = { data: [], error: null }
  expect(await getAdminUserProfile('nope')).toBeNull()
})

test('a coach profile brings its bio', async () => {
  answers['rpc:admin_user_detail'] = { data: [{ ...parent, role: 'COACH' }], error: null }
  answers.coach_profiles = { data: { bio: 'Antrenor de înot' }, error: null }
  const user = await getAdminUserProfile('u1')
  expect(user).toMatchObject({ bio: 'Antrenor de înot', hasCoachProfile: true })
})

test('saving without a known phone never writes the phone column', async () => {
  await updateAdminUserProfile(
    { id: 'u1', role: 'PARENT', hasCoachProfile: false },
    { name: 'Ana Pop' },
  )
  expect(calls).toContain('profiles.update({"name":"Ana Pop"})')
  expect(calls.some((c) => c.startsWith('coach_profiles'))).toBe(false)
})

test('saving a coach updates the profile and the bio', async () => {
  await updateAdminUserProfile(
    { id: 'u1', role: 'COACH', hasCoachProfile: true },
    { name: 'Ion', phone: null, bio: 'Bio nou' },
  )
  expect(calls).toContain('profiles.update({"name":"Ion","phone":null})')
  expect(calls).toContain('coach_profiles.update({"bio":"Bio nou"})')
  expect(calls).toContain('coach_profiles.eq("user_id","u1")')
})

test('a coach without a profile row gets one inserted with the bio', async () => {
  await updateAdminUserProfile(
    { id: 'u1', role: 'COACH', hasCoachProfile: false },
    { name: 'Ion', bio: 'Bio' },
  )
  expect(calls).toContain('coach_profiles.insert({"user_id":"u1","bio":"Bio"})')
})

test('a refused profile write is thrown', async () => {
  answers.profiles = { data: null, error: { message: 'denied' } }
  await expect(
    updateAdminUserProfile({ id: 'u1', role: 'PARENT', hasCoachProfile: false }, { name: 'X' }),
  ).rejects.toEqual({ message: 'denied' })
})

test('a club is read without the email column and gets its email from admin_clubs', async () => {
  answers.clubs = { data: { id: 'c1', name: 'Club' }, error: null }
  answers['rpc:admin_clubs'] = {
    data: [
      { id: 'c0', email: 'altul@example.com' },
      { id: 'c1', email: 'club@example.com' },
    ],
    error: null,
  }
  expect(await getAdminClub('c1')).toEqual({ id: 'c1', name: 'Club', email: 'club@example.com' })
  const select = calls.find((c) => c.startsWith('clubs.select'))!
  expect(select).not.toMatch(/\bemail\b/)
  expect(select).not.toMatch(/bank|company|stripe/)
})

test('a refused club list is thrown', async () => {
  answers.clubs = { data: { id: 'c1' }, error: null }
  answers['rpc:admin_clubs'] = { data: null, error: { code: '42501' } }
  await expect(getAdminClub('c1')).rejects.toEqual({ code: '42501' })
})
