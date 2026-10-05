import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { signInWithAppleIdToken } from '@/api/auth'

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  platform: vi.fn(),
  authorize: vi.fn(),
  idToken: vi.fn(),
  isolatePush: vi.fn(),
  authenticateNative: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@capacitor-community/apple-sign-in', () => ({
  SignInWithApple: { authorize: mocks.authorize },
}))
vi.mock('@/api/auth', () => ({ signInWithAppleIdToken: mocks.idToken }))
vi.mock('@/lib/platform', () => ({ isNative: mocks.native, platform: mocks.platform }))
vi.mock('@/api/notifications', () => ({ authenticateWithPushIsolation: mocks.isolatePush }))
vi.mock('./google', () => ({ authenticateNative: mocks.authenticateNative }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: mocks.from,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.native.mockReturnValue(true)
  mocks.platform.mockReturnValue('ios')
  mocks.authenticateNative.mockImplementation((work: () => Promise<unknown>) => work())
  mocks.isolatePush.mockImplementation((work: () => Promise<unknown>) => work())
  mocks.idToken.mockResolvedValue({ error: null })
  mocks.authorize.mockResolvedValue({
    response: {
      identityToken: 'apple-id-token',
      givenName: 'Ana',
      familyName: 'Părinte',
    },
  })
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
  mocks.eq.mockResolvedValue({ error: null })
  mocks.update.mockReturnValue({ eq: mocks.eq })
  mocks.from.mockReturnValue({ update: mocks.update })
})

describe('Apple sign-in platform gating', () => {
  it('hides the native Android button and keeps web plus iOS', async () => {
    const apple = await import('./apple')
    mocks.native.mockReturnValue(false)
    mocks.platform.mockReturnValue('web')
    expect(apple.shouldOfferAppleSignIn()).toBe(true)
    expect(apple.usesNativeAppleSignIn()).toBe(false)
    mocks.native.mockReturnValue(true)
    mocks.platform.mockReturnValue('ios')
    expect(apple.shouldOfferAppleSignIn()).toBe(true)
    expect(apple.usesNativeAppleSignIn()).toBe(true)
    mocks.platform.mockReturnValue('android')
    expect(apple.shouldOfferAppleSignIn()).toBe(false)
    expect(apple.usesNativeAppleSignIn()).toBe(false)
  })
})

describe('native Apple nonce handling', () => {
  it('sends the SHA-256 nonce to Apple and the raw nonce to signInWithIdToken', async () => {
    const apple = await import('./apple')
    await apple.signInNativeApple()
    const options = vi.mocked(SignInWithApple.authorize).mock.calls[0]?.[0]
    const raw = vi.mocked(signInWithAppleIdToken).mock.calls[0]?.[1]
    expect(options).toMatchObject({
      clientId: apple.APPLE_BUNDLE_ID,
      redirectURI: 'http://127.0.0.1:54321/auth/v1/callback',
      scopes: 'email name',
    })
    expect(raw).toMatch(/^[0-9a-f]{64}$/)
    expect(options?.nonce).toBe(await apple.sha256Hex(raw ?? ''))
    expect(options?.nonce).not.toBe(raw)
    expect(signInWithAppleIdToken).toHaveBeenCalledExactlyOnceWith('apple-id-token', raw)
    expect(mocks.update).toHaveBeenCalledWith({ name: 'Ana Părinte' })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('treats Apple sheet cancellation as a dedicated error', async () => {
    const apple = await import('./apple')
    mocks.authorize.mockRejectedValue({
      message:
        'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)',
    })
    await expect(apple.signInNativeApple()).rejects.toBeInstanceOf(apple.AppleSignInCancelledError)
    expect(signInWithAppleIdToken).not.toHaveBeenCalled()
  })

  it('does not treat a real plugin failure as cancel', async () => {
    const apple = await import('./apple')
    mocks.authorize.mockRejectedValue({ message: 'The authorization attempt failed' })
    await expect(apple.signInNativeApple()).rejects.toMatchObject({
      message: 'The authorization attempt failed',
    })
    expect(signInWithAppleIdToken).not.toHaveBeenCalled()
  })
})
