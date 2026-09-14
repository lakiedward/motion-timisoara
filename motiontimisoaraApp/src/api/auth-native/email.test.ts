import { beforeEach, describe, expect, it, vi } from 'vitest'

type Storage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
const mocks = vi.hoisted(() => ({
  preferences: new Map<string, string>(),
  createClient: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  reset: vi.fn(),
  signup: vi.fn(),
  exchange: vi.fn(),
  session: vi.fn(),
  update: vi.fn(),
  run: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: mocks.get, set: mocks.set, remove: mocks.remove },
}))
vi.mock('./google', () => ({ nativeGoogle: { run: mocks.run } }))

const key = 'motion-native-email'
const verifier = `${key}-code-verifier`
const pending = `${key}-pending`
const fakeSession = {
  access_token: 'fake-email-access',
  refresh_token: 'fake-email-refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'email-user' },
}
const parent = {
  email: 'audit@example.test',
  name: 'Audit Parent',
  password: 'fake-password',
  phone: '+40700000000',
}
function storage(): Storage {
  return mocks.createClient.mock.calls.at(-1)![2].auth.storage as Storage
}
function callback() {
  const flow = JSON.parse(mocks.preferences.get(pending)!) as { nonce: string }
  return `com.motiontimisoara.app://auth/email-callback?nonce=${flow.nonce}&code=email-code`
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.preferences.clear()
  mocks.get.mockImplementation(async ({ key }: { key: string }) => ({
    value: mocks.preferences.get(key) ?? null,
  }))
  mocks.set.mockImplementation(async ({ key, value }: { key: string; value: string }) => {
    mocks.preferences.set(key, value)
  })
  mocks.remove.mockImplementation(async ({ key }: { key: string }) => {
    mocks.preferences.delete(key)
  })
  let tail: Promise<unknown> = Promise.resolve()
  mocks.run.mockImplementation(<T>(work: () => Promise<T>) => {
    const result = tail.then(work)
    tail = result.catch(() => undefined)
    return result
  })
  mocks.reset.mockImplementation(async () => {
    await storage().setItem(verifier, JSON.stringify('fake-verifier/recovery'))
    return { error: null, data: {} }
  })
  mocks.signup.mockImplementation(async () => {
    await storage().setItem(verifier, JSON.stringify('fake-verifier'))
    return { error: null, data: { user: fakeSession.user, session: null } }
  })
  mocks.exchange.mockImplementation(async () => {
    await storage().setItem(key, JSON.stringify(fakeSession))
    return { error: null, data: { session: fakeSession } }
  })
  mocks.session.mockImplementation(async () => {
    const stored = await storage().getItem(key)
    return { error: null, data: { session: stored ? JSON.parse(stored) : null } }
  })
  mocks.update.mockResolvedValue({ error: null })
  mocks.createClient.mockReturnValue({
    auth: {
      resetPasswordForEmail: mocks.reset,
      signUp: mocks.signup,
      exchangeCodeForSession: mocks.exchange,
      getSession: mocks.session,
      updateUser: mocks.update,
    },
  })
})

describe('isolated email authentication adapter', () => {
  it('uses a dedicated PKCE key and persists only its verifier', async () => {
    const { nativeEmail } = await import('./email')
    await nativeEmail.ready()
    expect(mocks.createClient).toHaveBeenCalledWith(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: key,
          storage: expect.any(Object),
        },
      },
    )
    const adapter = storage()
    await adapter.setItem(verifier, 'serialized-verifier')
    await adapter.setItem(key, 'private-session')
    await adapter.setItem(`${key}-user`, 'private-user')
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({
      key: verifier,
      value: 'serialized-verifier',
    })
    expect(await adapter.getItem(verifier)).toBe('serialized-verifier')
    expect(await adapter.getItem(key)).toBe('private-session')
    expect(await adapter.getItem(`${key}-user`)).toBe('private-user')
    expect([...mocks.preferences.values()]).not.toContain('private-session')
    await adapter.removeItem(key)
    await adapter.removeItem(verifier)
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ key: verifier })
    expect(await adapter.getItem(key)).toBeNull()
  })

  it('sends recovery with a device callback and does not expose email in its URL', async () => {
    const { requestNativePasswordReset } = await import('./email')
    await requestNativePasswordReset(parent.email)
    expect(mocks.reset).toHaveBeenCalledWith(parent.email, {
      redirectTo: expect.stringMatching(
        /^com\.motiontimisoara\.app:\/\/auth\/email-callback\?nonce=[a-f0-9]{64}$/,
      ),
    })
    expect(mocks.reset.mock.calls[0][1].redirectTo).not.toContain(parent.email)
    expect(JSON.parse(mocks.preferences.get(pending)!).kind).toBe('recovery')
    expect(mocks.run).toHaveBeenCalledOnce()
  })

  it('sends signup metadata and its custom redirect without promoting a returned session', async () => {
    const { signUpNativeParent } = await import('./email')
    mocks.signup.mockImplementation(async () => {
      await storage().setItem(verifier, JSON.stringify('fake-verifier'))
      await storage().setItem(key, JSON.stringify(fakeSession))
      return { error: null, data: { session: fakeSession, user: fakeSession.user } }
    })
    const result = await signUpNativeParent(parent)
    expect(mocks.signup).toHaveBeenCalledWith({
      email: parent.email,
      password: parent.password,
      options: {
        emailRedirectTo: expect.stringContaining(
          'com.motiontimisoara.app://auth/email-callback?nonce=',
        ),
        data: { name: parent.name, phone: parent.phone, role: 'PARENT' },
      },
    })
    expect(result.data.session).toBeNull()
    expect(await storage().getItem(key)).toBeNull()
  })

  it('exchanges a recovery code only with its locally bound recovery verifier', async () => {
    const { requestNativePasswordReset, nativeEmail, onNativeEmailResult } = await import('./email')
    const result = vi.fn()
    onNativeEmailResult(result)
    await requestNativePasswordReset(parent.email)
    expect(await nativeEmail.receive(callback())).toBe(true)
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('email-code')
    expect(await nativeEmail.ready()).toBe(true)
    expect(result).toHaveBeenCalledWith({ kind: 'recovery' })
    expect(await nativeEmail.updatePassword('replacement')).toEqual({ error: null })
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ password: 'replacement' })
    expect(await storage().getItem(key)).toBeNull()
    expect(mocks.preferences.size).toBe(0)
  })

  it('discards a confirmed signup session and never enables the recovery form', async () => {
    const { signUpNativeParent, nativeEmail, onNativeEmailResult } = await import('./email')
    const result = vi.fn()
    onNativeEmailResult(result)
    await signUpNativeParent(parent)
    expect(await nativeEmail.receive(callback())).toBe(true)
    expect(result).toHaveBeenCalledWith({ kind: 'signup' })
    expect(await storage().getItem(key)).toBeNull()
    expect(await nativeEmail.ready()).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each([
    ['recovery', JSON.stringify('fake-verifier')],
    ['signup', JSON.stringify('fake-verifier/recovery')],
    ['recovery', 'invalid-json'],
    ['recovery', JSON.stringify(123)],
    ['recovery', JSON.stringify('')],
  ])('rejects mismatched or malformed verifier for %s before exchanging', async (kind, value) => {
    const module = await import('./email')
    if (kind === 'signup') await module.signUpNativeParent(parent)
    else await module.requestNativePasswordReset(parent.email)
    const url = callback()
    mocks.preferences.set(verifier, value)
    expect(await module.nativeEmail.receive(url)).toBe(false)
    expect(mocks.exchange).not.toHaveBeenCalled()
    expect(await module.nativeEmail.ready()).toBe(false)
  })

  it('retains the email verifier across cold reload without persisting session tokens or recovery grants', async () => {
    const first = await import('./email')
    await first.requestNativePasswordReset(parent.email)
    const url = callback()
    await storage().setItem(key, JSON.stringify(fakeSession))
    vi.resetModules()
    const second = await import('./email')
    expect(await second.nativeEmail.ready()).toBe(false)
    expect(await storage().getItem(key)).toBeNull()
    expect(await storage().getItem(verifier)).toBe(JSON.stringify('fake-verifier/recovery'))
    await second.nativeEmail.restore()
    expect(await second.nativeEmail.ready()).toBe(false)
    expect(await second.nativeEmail.receive(url)).toBe(true)
    expect(await second.nativeEmail.ready()).toBe(true)
  })

  it('does not clear another auth client storage while consuming email state', async () => {
    const { requestNativePasswordReset, nativeEmail } = await import('./email')
    mocks.preferences.set('motion-native-google-pending', 'google-pending')
    mocks.preferences.set('motion-native-google-code-verifier', 'google-verifier')
    mocks.preferences.set('main-session', 'existing-main-session')
    await requestNativePasswordReset(parent.email)
    await nativeEmail.receive(callback())
    await nativeEmail.updatePassword('replacement')
    expect(mocks.preferences.get('motion-native-google-pending')).toBe('google-pending')
    expect(mocks.preferences.get('motion-native-google-code-verifier')).toBe('google-verifier')
    expect(mocks.preferences.get('main-session')).toBe('existing-main-session')
  })

  it('never sends an email after persistent storage failure', async () => {
    const { requestNativePasswordReset } = await import('./email')
    mocks.set.mockRejectedValue(new Error('storage unavailable'))
    await expect(requestNativePasswordReset(parent.email)).rejects.toThrow('storage unavailable')
    expect(mocks.reset).not.toHaveBeenCalled()
  })

  it('does not deliver results to removed subscribers', async () => {
    const { requestNativePasswordReset, nativeEmail, onNativeEmailResult } = await import('./email')
    const result = vi.fn()
    const remove = onNativeEmailResult(result)
    await requestNativePasswordReset(parent.email)
    remove()
    await nativeEmail.receive(callback())
    expect(result).not.toHaveBeenCalled()
  })
})
