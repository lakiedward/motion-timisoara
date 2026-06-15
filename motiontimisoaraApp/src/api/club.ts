import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

async function uid(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export type Club = Tables<'clubs'>

export async function getMyClub(): Promise<Club | null> {
  const owner = await uid()
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('owner_user_id', owner)
    .maybeSingle()
  if (error) throw error
  return data
}

export interface ClubProfileInput {
  name: string
  description: string | null
  website: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  public_email_consent: boolean
  company_name: string | null
  company_cui: string | null
  bank_account: string | null
  bank_name: string | null
}

export async function updateClub(id: string, input: ClubProfileInput) {
  const { error } = await supabase.from('clubs').update(input).eq('id', id)
  if (error) throw error
}

// ===== Coaches roster =====
export type ClubCoach = {
  coach_profile_id: string
  name: string
  email: string
  photo_storage_path: string | null
}

export async function getClubCoaches(clubId: string): Promise<ClubCoach[]> {
  const { data, error } = await supabase
    .from('club_coaches')
    .select('coach_profile:coach_profiles(id, photo_storage_path, profile:profiles(name, email))')
    .eq('club_id', clubId)
  if (error) throw error
  type Row = {
    coach_profile: {
      id: string
      photo_storage_path: string | null
      profile: { name: string; email: string } | null
    } | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.coach_profile)
    .map((r) => ({
      coach_profile_id: r.coach_profile!.id,
      name: r.coach_profile!.profile?.name ?? '—',
      email: r.coach_profile!.profile?.email ?? '',
      photo_storage_path: r.coach_profile!.photo_storage_path,
    }))
}

export async function removeClubCoach(clubId: string, coachProfileId: string) {
  const { error } = await supabase
    .from('club_coaches')
    .delete()
    .eq('club_id', clubId)
    .eq('coach_profile_id', coachProfileId)
  if (error) throw error
}

// ===== Club invitation codes =====
export type ClubCode = Tables<'club_invitation_codes'>

export async function getClubCodes(clubId: string): Promise<ClubCode[]> {
  const { data, error } = await supabase
    .from('club_invitation_codes')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

function randomCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('')
  return `${part()}-${part()}`
}

export async function generateClubCode(clubId: string, maxUses = 1): Promise<string> {
  const owner = await uid()
  const code = randomCode()
  const { error } = await supabase.from('club_invitation_codes').insert({
    club_id: clubId,
    code,
    created_by_user_id: owner,
    max_uses: maxUses,
    current_uses: 0,
  })
  if (error) throw error
  return code
}

export async function deleteClubCode(id: string) {
  const { error } = await supabase.from('club_invitation_codes').delete().eq('id', id)
  if (error) throw error
}

// ===== Club announcements =====
export type ClubAnnouncement = Tables<'club_announcements'>

export async function getClubAnnouncements(clubId: string): Promise<ClubAnnouncement[]> {
  const { data, error } = await supabase
    .from('club_announcements')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createClubAnnouncement(input: {
  club_id: string
  title: string
  content: string
  priority: string
}) {
  const author = await uid()
  const { error } = await supabase
    .from('club_announcements')
    .insert({ ...input, author_user_id: author, is_active: true })
  if (error) throw error
}

export async function setAnnouncementActive(id: string, is_active: boolean) {
  const { error } = await supabase.from('club_announcements').update({ is_active }).eq('id', id)
  if (error) throw error
}

export async function deleteClubAnnouncement(id: string) {
  const { error } = await supabase.from('club_announcements').delete().eq('id', id)
  if (error) throw error
}
