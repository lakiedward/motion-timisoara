import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

async function count(table: 'profiles' | 'coach_profiles' | 'clubs' | 'courses'): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function getAdminStats() {
  const [users, coaches, clubs, courses] = await Promise.all([
    count('profiles'),
    count('coach_profiles'),
    count('clubs'),
    count('courses'),
  ])
  return { users, coaches, clubs, courses }
}

export type AdminUser = Pick<Tables<'profiles'>, 'id' | 'name' | 'email' | 'role' | 'enabled' | 'created_at'>

export async function getAllUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, enabled, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setUserEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from('profiles').update({ enabled }).eq('id', id)
  if (error) throw error
}

// ===== Sports =====
export async function createSport(code: string, name: string) {
  const { error } = await supabase.from('sports').insert({ code, name })
  if (error) throw error
}

export async function updateSport(id: string, code: string, name: string) {
  const { error } = await supabase.from('sports').update({ code, name }).eq('id', id)
  if (error) throw error
}

/** Upload or replace the admin default hero photo for a sport (all courses of that type). */
export async function setSportDefaultPhoto(sportId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${sportId}/default.${ext}`
  const { error: upErr } = await supabase.storage.from('sport-photos').upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${ext}`,
  })
  if (upErr) throw upErr
  const { error } = await supabase
    .from('sports')
    .update({ default_photo_storage_path: path })
    .eq('id', sportId)
  if (error) throw error
  return path
}

export async function clearSportDefaultPhoto(sportId: string, currentPath: string | null) {
  if (currentPath && !currentPath.startsWith('http') && !currentPath.startsWith('/')) {
    await supabase.storage.from('sport-photos').remove([currentPath])
  }
  const { error } = await supabase
    .from('sports')
    .update({ default_photo_storage_path: null })
    .eq('id', sportId)
  if (error) throw error
}

export async function deleteSport(id: string) {
  const { error } = await supabase.from('sports').delete().eq('id', id)
  if (error) throw error
}

// ===== Coach invitation codes =====
export type InviteCode = Tables<'coach_invitation_codes'>

export async function getCoachInviteCodes(): Promise<InviteCode[]> {
  const { data, error } = await supabase
    .from('coach_invitation_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `COACH-${s}`
}

export async function generateCoachInviteCode(maxUses = 1): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const code = randomCode()
  const { error } = await supabase.from('coach_invitation_codes').insert({
    code,
    created_by_admin_id: session.user.id,
    max_uses: maxUses,
    current_uses: 0,
  })
  if (error) throw error
  return code
}

export async function deleteInviteCode(id: string) {
  const { error } = await supabase.from('coach_invitation_codes').delete().eq('id', id)
  if (error) throw error
}

export interface CreatedCoach {
  userId: string
  email: string
  tempPassword: string
}

/** Creates a standalone coach account (no club) via the create-managed-coach EF. */
export async function createCoachAccount(input: {
  name: string
  email: string
  phone?: string
}): Promise<CreatedCoach> {
  const { data, error } = await supabase.functions.invoke('create-managed-coach', { body: input })
  if (error) {
    let msg = 'Nu am putut crea antrenorul.'
    const ctx = (error as { context?: Response })?.context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const b = await ctx.json()
        if (b?.error) msg = b.error as string
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg)
  }
  return data as CreatedCoach
}

// ===== Clubs / Courses (overview) =====
export async function getAllClubs(): Promise<Pick<Tables<'clubs'>, 'id' | 'name' | 'city' | 'email'>[]> {
  const { data, error } = await supabase.from('clubs').select('id, name, city, email').order('name')
  if (error) throw error
  return data ?? []
}

export type AdminCourse = Tables<'courses'> & {
  sport: Pick<Tables<'sports'>, 'name'> | null
  coach: Pick<Tables<'profiles'>, 'name'> | null
}

export async function getAllCourses(): Promise<AdminCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, sport:sports(name), coach:profiles(name)')
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as AdminCourse[]
}

export async function setCourseActiveAdmin(id: string, active: boolean) {
  const { error } = await supabase.from('courses').update({ active }).eq('id', id)
  if (error) throw error
}
