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

/** Loads the current session's profile row, or null if signed out. */
export async function loadAppUser(): Promise<AppUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, phone, avatar_url')
    .eq('id', session.user.id)
    .single()
  if (error || !data) return null

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
  if (error) return { error: await edgeError(error) }
  return supabase.auth.signInWithPassword({ email: input.email, password: input.password })
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
