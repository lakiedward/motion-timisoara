import { supabase } from '@/lib/supabase'
import { authenticateNative } from './auth-native/google'
import { nativeEmail, requestNativePasswordReset, signUpNativeParent } from './auth-native/email'
import { webRecoveryGrant } from '@/lib/auth/recovery-grant'
import { isNative } from '@/lib/platform'

export type Role = 'PARENT' | 'COACH' | 'CLUB' | 'ADMIN'

export interface AppUser {
  id: string
  email: string
  name: string
  role: Role
  phone: string | null
  avatarUrl: string | null
  needsProfileCompletion: boolean
}

export const PROFILE_LOAD_ERROR = 'Nu am putut încărca profilul.'

export type LoadAppUserResult =
  | { status: 'signed_out' }
  | { status: 'ok'; user: AppUser }
  | { status: 'error'; message: string; sessionUserId?: string; retryable?: boolean }

function toAppUser(data: {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  avatar_url: string | null
}): AppUser {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as Role,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    needsProfileCompletion: !data.phone,
  }
}

export async function loadAppUserResult(): Promise<LoadAppUserResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) return { status: 'error', message: PROFILE_LOAD_ERROR }
  if (!session) return { status: 'signed_out' }

  const sessionUserId = session.user.id
  const { data, error, status } = await supabase.rpc('my_profile')
  if (error) {
    const permissionFailure = ['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(error.code)
    return {
      status: 'error',
      message: PROFILE_LOAD_ERROR,
      sessionUserId,
      retryable:
        !permissionFailure && (status === 0 || status === 408 || status === 429 || status >= 500),
    }
  }
  const profile = (
    data as Array<Parameters<typeof toAppUser>[0] & { enabled?: boolean }> | null
  )?.[0]
  if (
    !profile ||
    profile.id !== sessionUserId ||
    profile.enabled === false ||
    !['ADMIN', 'CLUB', 'COACH', 'PARENT'].includes(profile.role)
  ) {
    return { status: 'error', message: PROFILE_LOAD_ERROR, sessionUserId, retryable: false }
  }

  return { status: 'ok', user: toAppUser(profile) }
}

export async function loadAppUser(): Promise<AppUser | null> {
  const result = await loadAppUserResult()
  return result.status === 'ok' ? result.user : null
}

export async function signInWithPassword(email: string, password: string) {
  return authenticateNative(() => supabase.auth.signInWithPassword({ email, password }))
}

export async function signUpParent(input: {
  name: string
  email: string
  password: string
  phone: string
}) {
  if (isNative()) return signUpNativeParent(input)
  return authenticateNative(() =>
    supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name, phone: input.phone, role: 'PARENT' } },
    }),
  )
}

export function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}

export async function signOut() {
  return authenticateNative(() => supabase.auth.signOut())
}

export function requestPasswordReset(email: string, redirectTo: string) {
  if (isNative()) return requestNativePasswordReset(email)
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export async function isPasswordRecoveryReady() {
  if (isNative()) return nativeEmail.ready()
  const { data, error } = await supabase.auth.getSession()
  return !error && webRecoveryGrant.valid(data.session)
}

export async function updatePassword(password: string) {
  if (isNative()) return nativeEmail.updatePassword(password)
  const { data, error } = await supabase.auth.getSession()
  if (error || !webRecoveryGrant.valid(data.session))
    return { error: { message: 'Invalid recovery link' } }
  webRecoveryGrant.clear()
  const result = await supabase.auth.updateUser({ password })
  if (!result.error) await supabase.auth.signOut({ scope: 'local' })
  return result
}

export function completeProfile(userId: string, input: { name: string; phone: string }) {
  return supabase.from('profiles').update({ name: input.name, phone: input.phone }).eq('id', userId)
}

export interface RegisterCoachInput {
  email: string
  password: string
  name: string
  phone?: string
  invitationCode: string
  bio?: string
  sportIds?: string[]
}

export interface RegisterClubInput {
  email: string
  password: string
  name: string
  phone?: string
  clubName: string
  clubDescription?: string
  clubCity?: string
  clubEmail?: string
  clubPhone?: string
  sportIds?: string[]
}

export async function registerCoach(input: RegisterCoachInput) {
  const { error } = await supabase.functions.invoke('register-coach', { body: input })
  if (error) {
    const { message } = await edgeError(error)
    return { error: { message: coachRegisterMessage(message) } }
  }
  return signInWithPassword(input.email, input.password)
}

function coachRegisterMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invitation code expired')) {
    return 'Codul de invitație a expirat. Cere unul nou clubului.'
  }
  if (m.includes('invitation code fully used')) {
    return 'Codul de invitație a fost deja folosit de numărul maxim de ori.'
  }
  if (m.includes('invalid invitation code')) return 'Cod de invitație invalid.'
  return sharedRegisterMessage(m)
}

function clubRegisterMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('failed to create club')) {
    return 'Contul a fost creat, dar clubul nu. Scrie-ne ca să-l legăm de contul tău.'
  }
  if (m.includes('could not finish club registration')) {
    return 'Nu am putut finaliza înregistrarea clubului. Încearcă din nou.'
  }
  return sharedRegisterMessage(m)
}

function sharedRegisterMessage(lowered: string): string {
  if (lowered.includes('already been registered') || lowered.includes('already registered')) {
    return 'Există deja un cont cu acest email.'
  }
  return 'Nu am putut crea contul. Verifică datele și încearcă din nou.'
}

export async function registerClub(input: RegisterClubInput) {
  const { error } = await supabase.functions.invoke('register-club', { body: input })
  if (error) {
    const { message } = await edgeError(error)
    return { error: { message: clubRegisterMessage(message) } }
  }
  return signInWithPassword(input.email, input.password)
}

async function edgeError(error: unknown): Promise<{ message: string }> {
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    const body = await ctx.json().catch(() => null)
    if (body?.error) return { message: body.error as string }
  }
  return { message: (error as { message?: string })?.message ?? 'A apărut o eroare.' }
}

export function roleHome(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'CLUB':
      return '/club'
    case 'COACH':
      return '/coach'
    default:
      return '/account'
  }
}
