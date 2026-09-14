import { beforeEach, describe, expect, it, vi } from 'vitest'

type Storage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const mocks = vi.hoisted(() => ({
  preferences: new Map<string, string>(),
  get: vi.fn<({ key }: { key: string }) => Promise<{ value: string | null }>>(),
  set: vi.fn<({ key, value }: { key: string; value: string }) => Promise<void>>(),
  remove: vi.fn<({ key }: { key: string }) => Promise<void>>(),
  open: vi.fn(),
  close: vi.fn(),
  createClient: vi.fn(),
  oauth: vi.fn(),
  exchange: vi.fn(),
  getSession: vi.fn(),
  setSession: vi.fn(),
  native: vi.fn(),
}))

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: mocks.get, set: mocks.set, remove: mocks.remove },
}))
vi.mock('@capacitor/browser', () => ({ Browser: { open: mocks.open, close: mocks.close } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, setSession: mocks.setSession } },
}))
vi.mock('@/lib/platform', () => ({ isNative: mocks.native }))

const storageKey = 'motion-native-google'
const verifierKey = `${storageKey}-code-verifier`
const pendingKey = `${storageKey}-pending`
const accessToken = 'fake-oauth-access-token'
const refreshToken = 'fake-oauth-refresh-token'

function storage(): Storage {
  return mocks.createClient.mock.calls.at(-1)![2].auth.storage as Storage
}

function pendingCallback() {
  const pending = JSON.parse(mocks.preferences.get(pendingKey)!) as { nonce: string }
  return `com.motiontimisoara.app://auth/callback?nonce=${pending.nonce}&code=one-use-code`
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.preferences.clear()
  mocks.get.mockImplementation(async ({ key }) => ({ value: mocks.preferences.get(key) ?? null }))
  mocks.set.mockImplementation(async ({ key, value }) => {
    mocks.preferences.set(key, value)
  })
  mocks.remove.mockImplementation(async ({ key }) => {
    mocks.preferences.delete(key)
  })
  mocks.native.mockReturnValue(true)
  mocks.open.mockResolvedValue(undefined)
  mocks.close.mockResolvedValue(undefined)
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.setSession.mockResolvedValue({ error: null })
  mocks.oauth.mockImplementation(async () => {
    await storage().setItem(verifierKey, JSON.stringify('fake-pkce-verifier'))
    return { data: { url: 'https://accounts.google.com/authorize' }, error: null }
  })
  mocks.exchange.mockResolvedValue({
    data: { session: { access_token: accessToken, refresh_token: refreshToken } },
    error: null,
  })
  mocks.createClient.mockReturnValue({
    auth: { signInWithOAuth: mocks.oauth, exchangeCodeForSession: mocks.exchange },
  })
})

describe('dedicated native Google adapter', () => {
  it('creates one isolated PKCE client and leaves URL detection and token refresh disabled', async () => {
    const { nativeGoogle } = await import('./google')
    await nativeGoogle.start('/account')
    expect(mocks.createClient).toHaveBeenCalledOnce()
    expect(mocks.createClient).toHaveBeenCalledWith(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey,
          storage: expect.any(Object),
        },
      },
    )
    await nativeGoogle.cancel()
    await nativeGoogle.start('/account')
    expect(mocks.createClient).toHaveBeenCalledOnce()
    expect(mocks.oauth).toHaveBeenCalledTimes(2)
  })

  it('opens the provider in the browser with an exact callback and random transaction nonce', async () => {
    const { nativeGoogle } = await import('./google')
    await nativeGoogle.start('/account/checkout?course=1')
    const request = mocks.oauth.mock.calls[0][0]
    expect(request.provider).toBe('google')
    expect(request.options.skipBrowserRedirect).toBe(true)
    const redirect = new URL(request.options.redirectTo)
    expect(redirect.protocol).toBe('com.motiontimisoara.app:')
    expect(redirect.host).toBe('auth')
    expect(redirect.pathname).toBe('/callback')
    expect([...redirect.searchParams.keys()]).toEqual(['nonce'])
    expect(redirect.searchParams.get('nonce')).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith({
      url: 'https://accounts.google.com/authorize',
    })
  })

  it('persists only the exact verifier key through the SDK storage adapter', async () => {
    const { nativeGoogle } = await import('./google')
    await nativeGoogle.start()
    mocks.set.mockClear()
    mocks.get.mockClear()
    const adapter = storage()
    await adapter.setItem(verifierKey, 'serialized-verifier')
    await adapter.setItem(storageKey, accessToken)
    await adapter.setItem(`${storageKey}-user`, 'fake-user')
    await adapter.setItem(`${verifierKey}-other`, 'other')
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({
      key: verifierKey,
      value: 'serialized-verifier',
    })
    expect(await adapter.getItem(verifierKey)).toBe('serialized-verifier')
    expect(await adapter.getItem(storageKey)).toBe(accessToken)
    expect(await adapter.getItem(`${storageKey}-user`)).toBe('fake-user')
    expect(await adapter.getItem(`${verifierKey}-other`)).toBe('other')
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ key: verifierKey })
    expect([...mocks.preferences.values()]).not.toContain(accessToken)
    mocks.remove.mockClear()
    await adapter.removeItem(storageKey)
    await adapter.removeItem(verifierKey)
    expect(await adapter.getItem(storageKey)).toBeNull()
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ key: verifierKey })
  })

  it('hands only session tokens to the main client and clears OAuth-owned state', async () => {
    const { nativeGoogle, onNativeGoogleResult } = await import('./google')
    const result = vi.fn()
    onNativeGoogleResult(result)
    await nativeGoogle.start('/account/enrollments')
    const adapter = storage()
    mocks.preferences.set('existing-main-session', 'preserved')
    await adapter.setItem(storageKey, 'volatile-token-state')
    expect(await nativeGoogle.receive(pendingCallback())).toBe(true)
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('one-use-code')
    expect(mocks.setSession).toHaveBeenCalledExactlyOnceWith({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    expect(result).toHaveBeenCalledExactlyOnceWith({ returnUrl: '/account/enrollments' })
    expect(await adapter.getItem(storageKey)).toBeNull()
    expect(mocks.preferences.has(verifierKey)).toBe(false)
    expect(mocks.preferences.has(pendingKey)).toBe(false)
    expect(mocks.preferences.get('existing-main-session')).toBe('preserved')
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('recovers the persisted verifier after recreating the module without preserving its tokens', async () => {
    const first = await import('./google')
    await first.nativeGoogle.start('/account')
    const callback = pendingCallback()
    await storage().setItem(storageKey, accessToken)
    vi.resetModules()
    const second = await import('./google')
    const result = vi.fn()
    second.onNativeGoogleResult(result)
    mocks.exchange.mockImplementation(async () => {
      expect(await storage().getItem(verifierKey)).toBe(JSON.stringify('fake-pkce-verifier'))
      expect(await storage().getItem(storageKey)).toBeNull()
      return {
        data: { session: { access_token: accessToken, refresh_token: refreshToken } },
        error: null,
      }
    })
    await second.nativeGoogle.restore()
    expect(second.nativeGoogle.getState()).toBe('awaiting')
    expect(await second.nativeGoogle.receive(callback)).toBe(true)
    expect(mocks.createClient).toHaveBeenCalledTimes(2)
    expect(mocks.oauth).toHaveBeenCalledOnce()
    expect(result).toHaveBeenCalledWith({ returnUrl: '/account' })
  })

  it('removes malformed pending JSON before a new attempt', async () => {
    mocks.preferences.set(pendingKey, 'invalid-json')
    const { nativeGoogle } = await import('./google')
    await nativeGoogle.start()
    expect(mocks.remove).toHaveBeenCalledWith({ key: pendingKey })
    expect(mocks.open).toHaveBeenCalledOnce()
    expect(JSON.parse(mocks.preferences.get(pendingKey)!).status).toBe('awaiting')
  })

  it('does not establish a main session when exchange fails', async () => {
    const { nativeGoogle, onNativeGoogleResult } = await import('./google')
    const result = vi.fn()
    onNativeGoogleResult(result)
    await nativeGoogle.start()
    mocks.exchange.mockResolvedValue({ data: { session: null }, error: new Error('private error') })
    expect(await nativeGoogle.receive(pendingCallback())).toBe(false)
    expect(mocks.setSession).not.toHaveBeenCalled()
    expect(result).toHaveBeenCalledWith({ error: expect.not.stringContaining('private error') })
    expect(mocks.preferences.size).toBe(0)
  })

  it('reports a failed main session handoff without publishing success', async () => {
    const { nativeGoogle, onNativeGoogleResult } = await import('./google')
    const result = vi.fn()
    onNativeGoogleResult(result)
    await nativeGoogle.start('/account')
    mocks.setSession.mockResolvedValue({ error: new Error('handoff failed') })
    expect(await nativeGoogle.receive(pendingCallback())).toBe(false)
    expect(result).toHaveBeenCalledExactlyOnceWith({ error: expect.any(String) })
    expect(mocks.preferences.size).toBe(0)
  })

  it('leaves an established main session intact when a callback arrives', async () => {
    const { nativeGoogle } = await import('./google')
    await nativeGoogle.start()
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'existing' } },
      error: null,
    })
    expect(await nativeGoogle.receive(pendingCallback())).toBe(false)
    expect(mocks.exchange).not.toHaveBeenCalled()
    expect(mocks.setSession).not.toHaveBeenCalled()
  })

  it('stops delivering results after a listener unsubscribes', async () => {
    const { nativeGoogle, onNativeGoogleResult } = await import('./google')
    const result = vi.fn()
    const unsubscribe = onNativeGoogleResult(result)
    await nativeGoogle.start()
    unsubscribe()
    await nativeGoogle.receive(pendingCallback())
    expect(result).not.toHaveBeenCalled()
  })
})

describe('existing authentication integration', () => {
  it('runs web authentication without touching native storage, browser or OAuth client', async () => {
    mocks.native.mockReturnValue(false)
    const { authenticateNative } = await import('./google')
    const work = vi.fn(async () => 'password-result')
    expect(await authenticateNative(work)).toBe('password-result')
    expect(work).toHaveBeenCalledOnce()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.set).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('cancels pending Google state before executing native password authentication', async () => {
    const { authenticateNative, nativeGoogle } = await import('./google')
    await nativeGoogle.start()
    const callback = pendingCallback()
    const work = vi.fn(async () => {
      expect(mocks.preferences.has(pendingKey)).toBe(false)
      expect(mocks.preferences.has(verifierKey)).toBe(false)
      expect(mocks.close).toHaveBeenCalledOnce()
      return 'password-result'
    })
    expect(await authenticateNative(work)).toBe('password-result')
    expect(await nativeGoogle.receive(callback)).toBe(false)
    expect(mocks.exchange).not.toHaveBeenCalled()
  })

  it('serializes new Google attempts behind the whole native password request', async () => {
    const { authenticateNative, nativeGoogle } = await import('./google')
    const entered = deferred<void>()
    const finished = deferred<void>()
    const password = authenticateNative(async () => {
      entered.resolve()
      await finished.promise
      mocks.getSession.mockResolvedValue({
        data: { session: { access_token: 'password-session' } },
        error: null,
      })
      return 'signed-in'
    })
    await entered.promise
    const google = nativeGoogle.start()
    expect(mocks.createClient).not.toHaveBeenCalled()
    finished.resolve()
    expect(await password).toBe('signed-in')
    await google
    expect(mocks.oauth).not.toHaveBeenCalled()
    expect(mocks.open).not.toHaveBeenCalled()
  })
})
