import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import { nativeGoogle } from './google'
import {
  createEmailCoordinator,
  type EmailFlow,
  type EmailKind,
  type EmailResult,
} from './email-coordinator'

const STORAGE_KEY = 'motion-native-email'
const VERIFIER_KEY = `${STORAGE_KEY}-code-verifier`
const PENDING_KEY = `${STORAGE_KEY}-pending`
const memory = new Map<string, string>()
const listeners = new Set<(result: EmailResult) => void>()

let client: ReturnType<typeof createClient> | undefined

function emailClient() {
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
              : (memory.get(key) ?? null)
          },
          async setItem(key: string, value: string) {
            if (key === VERIFIER_KEY) await Preferences.set({ key, value })
            else memory.set(key, value)
          },
          async removeItem(key: string) {
            if (key === VERIFIER_KEY) await Preferences.remove({ key })
            else memory.delete(key)
          },
        },
      },
    },
  )
  return client
}

export const nativeEmail = createEmailCoordinator({
  run: (work) => nativeGoogle.run(work),
  async read() {
    const { value } = await Preferences.get({ key: PENDING_KEY })
    if (!value) return null
    try {
      return JSON.parse(value) as EmailFlow
    } catch {
      await Preferences.remove({ key: PENDING_KEY })
      return null
    }
  },
  async write(flow) {
    await Preferences.set({ key: PENDING_KEY, value: JSON.stringify(flow) })
  },
  async clearPending() {
    await Preferences.remove({ key: PENDING_KEY })
    await Preferences.remove({ key: VERIFIER_KEY })
  },
  async clearSession() {
    memory.clear()
  },
  async exchange(code: string, kind: EmailKind) {
    const { value } = await Preferences.get({ key: VERIFIER_KEY })
    const verifier: unknown = value ? JSON.parse(value) : null
    if (
      typeof verifier !== 'string' ||
      !verifier ||
      verifier.endsWith('/recovery') !== (kind === 'recovery')
    )
      throw new Error('Invalid verifier')
    const { data, error } = await emailClient().auth.exchangeCodeForSession(code)
    if (error || !data.session) throw error ?? new Error('Missing email session')
    return data.session
  },
  async session() {
    const { data, error } = await emailClient().auth.getSession()
    if (error) throw error
    return data.session
  },
  update: (password) => emailClient().auth.updateUser({ password }),
  nonce: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(''),
  now: () => Date.now(),
  result: (result) => listeners.forEach((listener) => listener(result)),
})

export function requestNativePasswordReset(email: string) {
  return nativeEmail.send('recovery', (redirectTo) =>
    emailClient().auth.resetPasswordForEmail(email, { redirectTo }),
  )
}

export function signUpNativeParent(input: {
  name: string
  email: string
  password: string
  phone: string
}) {
  return nativeEmail.send('signup', async (emailRedirectTo) => {
    const { data, error } = await emailClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo, data: { name: input.name, phone: input.phone, role: 'PARENT' } },
    })
    memory.clear()
    return { data: { ...data, session: null }, error }
  })
}

export function onNativeEmailResult(listener: (result: EmailResult) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
