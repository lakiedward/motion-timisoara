import { registerCoach } from '@/api/auth'

const invoke = vi.fn()
const signIn = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: { signInWithPassword: (...args: unknown[]) => signIn(...args) },
  },
}))
vi.mock('@/api/auth-native/google', () => ({
  authenticateNative: (work: () => Promise<unknown>) => work(),
}))
vi.mock('@/api/auth-native/email', () => ({ nativeEmail: {} }))
vi.mock('@/api/notifications', () => ({
  authenticateWithPushIsolation: (work: () => Promise<unknown>) => work(),
}))

const input = {
  email: 'ana@example.test',
  password: 'test-password',
  name: 'Ana',
  invitationCode: 'INVITE',
}

beforeEach(() => {
  invoke.mockReset()
  signIn.mockReset()
})

test.each([
  ['INVALID_INVITATION', 'Cod de invitație invalid.'],
  ['INVITATION_EXPIRED', 'Codul de invitație a expirat. Cere unul nou clubului.'],
  ['INVITATION_EXHAUSTED', 'Codul de invitație a fost deja folosit de numărul maxim de ori.'],
  [
    'ACCOUNT_EXISTS',
    'Există deja un cont cu acest email. Autentifică-te pentru a folosi invitația.',
  ],
  ['INVALID_SPORTS', 'Selecția sporturilor nu mai este disponibilă. Alege din nou.'],
])(
  'password registration preserves the transactional %s feedback without signing in',
  async (code, message) => {
    invoke.mockResolvedValue({
      error: {
        context: Response.json({ code, error: 'Untrusted backend detail' }, { status: 409 }),
      },
    })
    expect(await registerCoach(input)).toEqual({ error: { message } })
    expect(signIn).not.toHaveBeenCalled()
  },
)

test.each([
  ['Invalid invitation code', 'Cod de invitație invalid.'],
  ['Invitation code expired', 'Codul de invitație a expirat. Cere unul nou clubului.'],
  ['Invitation code fully used', 'Codul de invitație a fost deja folosit de numărul maxim de ori.'],
  [
    'User already registered',
    'Există deja un cont cu acest email. Autentifică-te pentru a folosi invitația.',
  ],
])('legacy deployed endpoint remains compatible with %s', async (error, message) => {
  invoke.mockResolvedValue({ error: { context: Response.json({ error }, { status: 400 }) } })
  expect(await registerCoach(input)).toEqual({ error: { message } })
})

test('unknown backend details never escape through registration feedback', async () => {
  invoke.mockResolvedValue({
    error: {
      context: Response.json(
        { code: 'UNKNOWN', error: 'Internal database credentials' },
        { status: 500 },
      ),
    },
  })
  expect(await registerCoach(input)).toEqual({
    error: { message: 'Nu am putut crea contul. Verifică datele și încearcă din nou.' },
  })
})

test('successful password creation still signs in only with the submitted credentials', async () => {
  invoke.mockResolvedValue({ error: null })
  signIn.mockResolvedValue({ error: null, data: { session: 'verified-session' } })
  expect(await registerCoach(input)).toEqual({ error: null, data: { session: 'verified-session' } })
  expect(invoke).toHaveBeenCalledExactlyOnceWith('register-coach', { body: input })
  expect(signIn).toHaveBeenCalledExactlyOnceWith({ email: input.email, password: input.password })
})

test('transport exception becomes retry feedback without uncaught promise rejection', async () => {
  invoke.mockRejectedValue(new Error('Network'))
  expect(await registerCoach(input)).toEqual({
    error: { message: 'Nu am putut finaliza contul de antrenor. Încearcă din nou.' },
  })
})
