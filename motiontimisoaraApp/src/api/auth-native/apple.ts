import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { signInWithAppleIdToken } from '@/api/auth'
import { authenticateWithPushIsolation } from '@/api/notifications'
import { supabase } from '@/lib/supabase'
import { isNative, platform } from '@/lib/platform'
import { authenticateNative } from './google'

export const APPLE_ERROR = 'Nu am putut finaliza autentificarea cu Apple. Încearcă din nou.'
export const APPLE_BUNDLE_ID = 'com.motiontimisoara.app'

export class AppleSignInCancelledError extends Error {
  readonly code = '1001'
  constructor() {
    super('The user canceled the authorization attempt')
    this.name = 'AppleSignInCancelledError'
  }
}

export function shouldOfferAppleSignIn(): boolean {
  return !(isNative() && platform() === 'android')
}

export function usesNativeAppleSignIn(): boolean {
  return isNative() && platform() === 'ios'
}

export function isAppleSignInCancelled(error: unknown): boolean {
  if (error instanceof AppleSignInCancelledError) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string | number; message?: string; errorMessage?: string }
  const code = String(candidate.code ?? '')
  if (code === '1001' || code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return true
  const message = `${candidate.message ?? ''} ${candidate.errorMessage ?? ''}`
  return /\b1001\b/.test(message) || /cancell?ed/i.test(message) || /\banulat/i.test(message)
}

export function createRawNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function applePluginRedirectUri(): string {
  return `${String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')}/auth/v1/callback`
}

async function rememberAppleFullName(givenName: string | null, familyName: string | null) {
  const name = [givenName, familyName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim()
  if (!name) return
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return
  await supabase.from('profiles').update({ name }).eq('id', session.user.id)
}

export async function signInNativeApple() {
  return authenticateNative(async () => {
    const rawNonce = createRawNonce()
    const hashedNonce = await sha256Hex(rawNonce)
    let identityToken: string
    let givenName: string | null
    let familyName: string | null
    try {
      const result = await SignInWithApple.authorize({
        clientId: APPLE_BUNDLE_ID,
        redirectURI: applePluginRedirectUri(),
        scopes: 'email name',
        nonce: hashedNonce,
      })
      identityToken = result.response.identityToken
      givenName = result.response.givenName
      familyName = result.response.familyName
    } catch (error) {
      if (isAppleSignInCancelled(error)) throw new AppleSignInCancelledError()
      throw error
    }
    if (!identityToken) throw new Error('missing-apple-identity-token')
    const { error } = await authenticateWithPushIsolation(() =>
      signInWithAppleIdToken(identityToken, rawNonce),
    )
    if (error) throw error
    await rememberAppleFullName(givenName, familyName).catch(() => undefined)
  })
}
