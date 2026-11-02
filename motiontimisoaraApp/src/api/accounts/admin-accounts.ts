import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export const CLUB_PROFILE_COLUMNS =
  'id, name, description, website, phone, county, city, address, lat, lng, public_email_consent, logo_storage_path, hero_photo_storage_path'

export type ClubProfileRow = Pick<
  Tables<'clubs'>,
  | 'id'
  | 'name'
  | 'description'
  | 'website'
  | 'email'
  | 'phone'
  | 'county'
  | 'city'
  | 'address'
  | 'lat'
  | 'lng'
  | 'public_email_consent'
  | 'logo_storage_path'
  | 'hero_photo_storage_path'
>

export async function getAdminClub(id: string): Promise<ClubProfileRow> {
  const [row, list] = await Promise.all([
    supabase.from('clubs').select(CLUB_PROFILE_COLUMNS).eq('id', id).single(),
    supabase.rpc('admin_clubs'),
  ])
  if (row.error) throw row.error
  if (list.error) throw list.error
  const email = (list.data ?? []).find((c) => c.id === id)?.email ?? null
  return { ...(row.data as Omit<ClubProfileRow, 'email'>), email }
}

export type AdminUserProfile = {
  id: string
  name: string
  email: string
  role: string
  enabled: boolean
  phone: string | null
  phoneKnown: boolean
  bio: string | null
  hasCoachProfile: boolean
}

type DetailRow = {
  id: string
  name: string
  email: string
  role: string
  enabled: boolean
  phone: string | null
}

async function readDetail(id: string): Promise<{ row: DetailRow | null; phoneKnown: boolean }> {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: id })
  if (!error) {
    const rows = (data as DetailRow[] | null) ?? []
    return { row: rows[0] ?? null, phoneKnown: true }
  }
  if (error.code !== 'PGRST202') throw error
  const { data: all, error: listError } = await supabase.rpc('admin_users')
  if (listError) throw listError
  const found = ((all as Omit<DetailRow, 'phone'>[] | null) ?? []).find((u) => u.id === id)
  return { row: found ? { ...found, phone: null } : null, phoneKnown: false }
}

export async function getAdminUserProfile(id: string): Promise<AdminUserProfile | null> {
  const { row, phoneKnown } = await readDetail(id)
  if (!row) return null
  let bio: string | null = null
  let hasCoachProfile = false
  if (row.role === 'COACH') {
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('bio')
      .eq('user_id', id)
      .maybeSingle()
    if (error) throw error
    hasCoachProfile = Boolean(data)
    bio = data?.bio ?? null
  }
  return { ...row, phoneKnown, bio, hasCoachProfile }
}

export type AdminUserProfileInput = {
  name: string
  phone?: string | null
  bio?: string | null
}

export async function updateAdminUserProfile(
  user: Pick<AdminUserProfile, 'id' | 'role' | 'hasCoachProfile'>,
  input: AdminUserProfileInput,
) {
  const patch: { name: string; phone?: string | null } = { name: input.name }
  if (input.phone !== undefined) patch.phone = input.phone
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id')
    .single()
  if (error) throw error

  if (user.role !== 'COACH' || input.bio === undefined) return
  if (user.hasCoachProfile) {
    const { error: bioError } = await supabase
      .from('coach_profiles')
      .update({ bio: input.bio })
      .eq('user_id', user.id)
      .select('id')
      .single()
    if (bioError) throw bioError
    return
  }
  const { error: insertError } = await supabase
    .from('coach_profiles')
    .insert({ user_id: user.id, bio: input.bio })
  if (insertError) throw insertError
}
