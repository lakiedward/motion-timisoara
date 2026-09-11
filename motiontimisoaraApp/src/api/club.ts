import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import type { LocationFormInput } from '@/api/coach'

async function uid(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export type Club = Tables<'clubs'>

export async function getMyClub(): Promise<Club | null> {
  const { data, error } = await supabase.rpc('my_club')
  if (error) throw error
  return (data as Club[] | null)?.[0] ?? null
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
  const { error } = await supabase.from('clubs').update(input).eq('id', id).select().single()
  if (error) throw error
}
export type ClubCoach = {
  coach_profile_id: string
  name: string
  email: string
  photo_storage_path: string | null
}

export async function getClubCoaches(clubId: string): Promise<ClubCoach[]> {
  const { data, error } = await supabase.rpc('club_coach_contacts', { p_club_id: clubId })
  if (error) throw error
  return ((data as ClubCoach[] | null) ?? []).map((r) => ({
    coach_profile_id: r.coach_profile_id,
    name: r.name ?? '—',
    email: r.email ?? '',
    photo_storage_path: r.photo_storage_path,
  }))
}

export interface CreateManagedCoachInput {
  email: string
  name: string
  phone?: string
  bio?: string
  sportIds?: string[]
}
export interface CreateManagedCoachResult {
  userId: string
  email: string
  tempPassword: string
}

export async function createManagedCoach(
  input: CreateManagedCoachInput,
): Promise<CreateManagedCoachResult> {
  const { data, error } = await supabase.functions.invoke('create-managed-coach', { body: input })
  if (error) {
    let msg = 'Nu am putut crea antrenorul.'
    const ctx = (error as { context?: Response })?.context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const b = await ctx.json()
        if (b?.error) msg = b.error as string
      } catch {
        throw new Error(msg)
      }
    }
    throw new Error(msg)
  }
  return data as CreateManagedCoachResult
}

export async function removeClubCoach(clubId: string, coachProfileId: string) {
  const { error } = await supabase
    .from('club_coaches')
    .delete()
    .eq('club_id', clubId)
    .eq('coach_profile_id', coachProfileId)
    .select()
    .single()
  if (error) throw error
}
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
  const part = () =>
    Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('')
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
  const { error } = await supabase
    .from('club_invitation_codes')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}
export type ClubAnnouncement = Tables<'club_announcements'>

export type AudienceKind = 'CLUB' | 'COURSE' | 'ACTIVITY'

export type ClubAudience = {
  kind: Exclude<AudienceKind, 'CLUB'>
  id: string
  name: string
  active: boolean
}

export async function getClubAudiences(clubId: string): Promise<ClubAudience[]> {
  const [cursuri, activitati] = await Promise.all([
    supabase.from('courses').select('id, name, active').eq('club_id', clubId).order('name'),
    supabase.from('activities').select('id, name, active').eq('club_id', clubId).order('name'),
  ])
  if (cursuri.error) throw cursuri.error
  if (activitati.error) throw activitati.error
  return [
    ...(cursuri.data ?? []).map((c) => ({
      kind: 'COURSE' as const,
      id: c.id,
      name: c.name,
      active: c.active,
    })),
    ...(activitati.data ?? []).map((a) => ({
      kind: 'ACTIVITY' as const,
      id: a.id,
      name: a.name,
      active: a.active,
    })),
  ]
}

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
  audience_kind: AudienceKind

  audience_id: string | null
}): Promise<ClubAnnouncement> {
  const author = await uid()
  const { data, error } = await supabase
    .from('club_announcements')
    .insert({ ...input, author_user_id: author, is_active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setAnnouncementActive(
  id: string,
  is_active: boolean,
): Promise<ClubAnnouncement> {
  const { data, error } = await supabase
    .from('club_announcements')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClubAnnouncement(id: string): Promise<ClubAnnouncement> {
  const { data, error } = await supabase
    .from('club_announcements')
    .delete()
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export type ClubLocation = Tables<'locations'> & { courseCount: number }

export async function getClubLocations(clubId: string): Promise<ClubLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*, courses(count)')
    .eq('club_id', clubId)
    .order('name')
  if (error) throw error
  type Row = Tables<'locations'> & { courses?: { count: number }[] }
  return ((data ?? []) as unknown as Row[]).map(({ courses, ...loc }) => ({
    ...loc,
    courseCount: courses?.[0]?.count ?? 0,
  }))
}

export async function getClubSelectableLocations(
  clubId: string,
  keepId?: string | null,
): Promise<Pick<Tables<'locations'>, 'id' | 'name' | 'city'>[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, city, is_active')
    .or(`club_id.eq.${clubId},club_id.is.null`)
    .order('name')
  if (error) throw error
  return (data ?? [])
    .filter((l) => l.is_active || l.id === keepId)
    .map(({ id, name, city }) => ({ id, name, city }))
}

export async function getClubLocationById(
  id: string,
  clubId: string,
): Promise<Tables<'locations'> | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .eq('club_id', clubId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createClubLocation(clubId: string, input: LocationFormInput) {
  const owner = await uid()
  const { error } = await supabase
    .from('locations')
    .insert({ ...input, club_id: clubId, created_by_user_id: owner, is_active: true })
  if (error) throw error
}

export async function updateClubLocation(
  id: string,
  input: LocationFormInput,
): Promise<Tables<'locations'>> {
  const { data, error } = await supabase
    .from('locations')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setClubLocationActive(id: string, is_active: boolean) {
  const { error } = await supabase
    .from('locations')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}
export type ClubCourse = Tables<'courses'> & {
  sport: Pick<Tables<'sports'>, 'id' | 'name'> | null
  location: Pick<Tables<'locations'>, 'id' | 'name'> | null
  coach: Pick<Tables<'profiles'>, 'id' | 'name'> | null
}

export async function getClubCourses(clubId: string): Promise<ClubCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(
      '*, sport:sports(id,name), location:locations(id,name), coach:profiles!courses_coach_id_fkey(id,name)',
    )
    .eq('club_id', clubId)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as ClubCourse[]
}

export async function getClubCourseById(id: string): Promise<Tables<'courses'> | null> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function getClubRosterForSelect(
  clubId: string,
): Promise<{ user_id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('club_coaches')
    .select('coach_profile:coach_profiles(user_id, profile:profiles(name))')
    .eq('club_id', clubId)
  if (error) throw error
  type Row = {
    coach_profile: { user_id: string; profile: { name: string } | null } | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.coach_profile)
    .map((r) => ({
      user_id: r.coach_profile!.user_id,
      name: r.coach_profile!.profile?.name ?? '—',
    }))
}

export interface ClubCourseFormInput {
  currency: 'RON' | 'EUR'
  eur_ron_rate_micros: number | null
  name: string
  sport_id: string
  location_id: string
  coach_id: string
  level: string | null
  age_from: number | null
  age_to: number | null
  capacity: number | null
  price_per_session: number
  description: string | null
}

export async function createClubCourse(clubId: string, input: ClubCourseFormInput) {
  const { error } = await supabase.from('courses').insert({
    ...input,
    club_id: clubId,
    payment_recipient: 'CLUB',
    price: input.price_per_session * 8,
    active: true,
  })
  if (error) throw error
}

export async function updateClubCourse(id: string, input: ClubCourseFormInput) {
  const { error } = await supabase
    .from('courses')
    .update({ ...input, price: input.price_per_session * 8 })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function setClubCourseActive(id: string, active: boolean) {
  const { error } = await supabase.from('courses').update({ active }).eq('id', id).select().single()
  if (error) throw error
}
