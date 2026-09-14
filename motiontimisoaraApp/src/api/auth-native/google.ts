import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import { Browser } from '@capacitor/browser'
import { supabase } from '@/lib/supabase'
import { isNative } from '@/lib/platform'
import { createOAuthCoordinator, type PendingFlow } from './coordinator'

const STORAGE_KEY = 'motion-native-google'
const VERIFIER_KEY = `${STORAGE_KEY}-code-verifier`
const PENDING_KEY = `${STORAGE_KEY}-pending`
const volatileStorage = new Map<string, string>()
let client: SupabaseClient | undefined
type Result = { returnUrl?: string } | { error: string }
const resultListeners = new Set<(result: Result) => void>()

function oauthClient() {
  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEY,
        storage: {
          async getItem(key: string) {
            return key === VERIFIER_KEY
              ? (await Preferences.get({ key })).value
              : (volatileStorage.get(key) ?? null)
          },
          async setItem(key: string, value: string) {
            if (key === VERIFIER_KEY) await Preferences.set({ key, value })
            else volatileStorage.set(key, value)
          },
          async removeItem(key: string) {
            if (key === VERIFIER_KEY) await Preferences.remove({ key })
            else volatileStorage.delete(key)
          },
        },
      },
    },
  )
  return client
}

export const nativeGoogle = createOAuthCoordinator<Session>({
  async read() {
    const { value } = await Preferences.get({ key: PENDING_KEY })
    if (!value) return null
    try {
      return JSON.parse(value) as PendingFlow
    } catch {
      await Preferences.remove({ key: PENDING_KEY })
      return null
    }
  },
  async write(flow) {
    await Preferences.set({ key: PENDING_KEY, value: JSON.stringify(flow) })
  },
  async clear() {
    await Preferences.remove({ key: PENDING_KEY })
  },
  async clearVerifier() {
    await Preferences.remove({ key: VERIFIER_KEY })
    volatileStorage.clear()
  },
  async prepare(redirectTo) {
    const { data, error } = await oauthClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data.url) throw error ?? new Error('Missing authorization URL')
    return data.url
  },
  async open(url) {
    await Browser.open({ url })
  },
  async close() {
    await Browser.close()
  },
  async exchange(code) {
    const { data, error } = await oauthClient().auth.exchangeCodeForSession(code)
    if (error || !data.session) throw error ?? new Error('Missing session')
    return data.session
  },
  async hasSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return !!data.session
  },
  async commit(session) {
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (error) throw error
  },
  nonce: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(''),
  now: () => Date.now(),
  complete: (returnUrl) => resultListeners.forEach((listener) => listener({ returnUrl })),
  error: (error) => resultListeners.forEach((listener) => listener({ error })),
})

export function onNativeGoogleResult(listener: (result: Result) => void) {
  resultListeners.add(listener)
  return () => {
    resultListeners.delete(listener)
  }
}

export function authenticateNative<T>(work: () => Promise<T>): Promise<T> {
  return isNative() ? nativeGoogle.authenticate(work) : work()
}
