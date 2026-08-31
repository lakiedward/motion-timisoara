import { supabase } from '@/lib/supabase'

export type Role = 'PARENT' | 'COACH' | 'CLUB' | 'ADMIN'

export interface AppUser {
  id: string
  email: string
  name: string
  role: Role
  phone: string | null
  avatarUrl: string | null
  /** True when the profile is missing a phone (e.g. fresh OAuth sign-up). */
  needsProfileCompletion: boolean
}

export const PROFILE_LOAD_ERROR = 'Nu am putut încărca profilul.'

export type LoadAppUserResult =
  | { status: 'signed_out' }
  | { status: 'ok'; user: AppUser }
  | { status: 'error'; message: string }

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

/** Loads the current session's profile, distinguishing signed-out from a failed fetch. */
export async function loadAppUserResult(): Promise<LoadAppUserResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { status: 'signed_out' }

  // Prin `my_profile()`, nu prin tabel: din migrarea 00036, `email` și `phone`
  // nu mai sunt lizibile de rolul `authenticated`, fiindcă înainte orice cont
  // citea contactele tuturor. Funcția e SECURITY DEFINER și filtrează ea însăși
  // pe auth.uid(), deci întoarce doar rândul celui logat.
  const { data, error } = await supabase.rpc('my_profile')
  const profile = (data as Array<Parameters<typeof toAppUser>[0]> | null)?.[0]
  if (error || !profile) return { status: 'error', message: PROFILE_LOAD_ERROR }

  return { status: 'ok', user: toAppUser(profile) }
}

/** Loads the current session's profile row, or null if signed out or the profile cannot be read. */
export async function loadAppUser(): Promise<AppUser | null> {
  const result = await loadAppUserResult()
  return result.status === 'ok' ? result.user : null
}

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signUpParent(input: {
  name: string
  email: string
  password: string
  phone: string
}) {
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, phone: input.phone, role: 'PARENT' } },
  })
}

export function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}

export function signOut() {
  return supabase.auth.signOut()
}

export function requestPasswordReset(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export function updatePassword(password: string) {
  return supabase.auth.updateUser({ password })
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

/** Calls the register-coach Edge Function, then signs the new coach in. */
export async function registerCoach(input: RegisterCoachInput) {
  const { error } = await supabase.functions.invoke('register-coach', { body: input })
  if (error) {
    const { message } = await edgeError(error)
    return { error: { message: coachRegisterMessage(message) } }
  }
  return supabase.auth.signInWithPassword({ email: input.email, password: input.password })
}

/**
 * register-coach answers in English ("Invalid invitation code"), and the signup
 * form puts whatever comes back straight in front of the coach, so the cases
 * someone can actually hit are translated before they reach the screen.
 * Anything unrecognised becomes a plain Romanian sentence rather than leaking
 * an internal message.
 */
function coachRegisterMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invitation code expired')) {
    return 'Codul de invitație a expirat. Cere unul nou clubului.'
  }
  if (m.includes('invitation code fully used')) {
    return 'Codul de invitație a fost deja folosit de numărul maxim de ori.'
  }
  if (m.includes('invalid invitation code')) return 'Cod de invitație invalid.'
  if (m.includes('already been registered') || m.includes('already registered')) {
    return 'Există deja un cont cu acest email.'
  }
  return 'Nu am putut crea contul. Verifică datele și încearcă din nou.'
}

/** Calls the register-club Edge Function, then signs the new club owner in. */
export async function registerClub(input: RegisterClubInput) {
  const { error } = await supabase.functions.invoke('register-club', { body: input })
  if (error) return { error: await edgeError(error) }
  return supabase.auth.signInWithPassword({ email: input.email, password: input.password })
}

/** Extracts a human message from an Edge Function error response. */
async function edgeError(error: unknown): Promise<{ message: string }> {
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return { message: body.error as string }
    } catch {
      /* ignore */
    }
  }
  return { message: (error as { message?: string })?.message ?? 'A apărut o eroare.' }
}

/** Default landing route for a role after login. */
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
