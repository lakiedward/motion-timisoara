import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

// Shared nested shapes returned by the embedded selects below.
export type SportRow = Pick<Tables<'sports'>, 'id' | 'code' | 'name'>
export type CoachMini = Pick<Tables<'profiles'>, 'id' | 'name' | 'avatar_url'>
export type LocationRow = Tables<'locations'>

export type CourseListItem = Tables<'courses'> & {
  sport: SportRow | null
  coach: CoachMini | null
  location: LocationRow | null
  occurrences: Pick<Tables<'course_occurrences'>, 'id' | 'starts_at' | 'ends_at'>[]
  course_photos: Pick<Tables<'course_photos'>, 'storage_path' | 'display_order'>[]
}

export interface CourseFilters {
  sportCode?: string
  level?: string
  city?: string
}

export async function getCourses(filters: CourseFilters = {}): Promise<CourseListItem[]> {
  let q = supabase
    .from('courses')
    .select(
      '*, sport:sports(id,code,name), coach:profiles(id,name,avatar_url), location:locations(*), occurrences:course_occurrences(id,starts_at,ends_at), course_photos(storage_path,display_order)'
    )
    .eq('active', true)
  if (filters.level) q = q.eq('level', filters.level)
  const { data, error } = await q.order('name')
  if (error) throw error
  let rows = (data ?? []) as unknown as CourseListItem[]
  if (filters.sportCode) rows = rows.filter((c) => c.sport?.code === filters.sportCode)
  if (filters.city) rows = rows.filter((c) => c.location?.city === filters.city)
  return rows
}

export async function getCourse(id: string): Promise<CourseListItem | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(
      '*, sport:sports(id,code,name), coach:profiles(id,name,avatar_url), location:locations(*), occurrences:course_occurrences(id,starts_at,ends_at), course_photos(storage_path,display_order)'
    )
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as CourseListItem
}

export type ActivityListItem = Tables<'activities'> & {
  sport: SportRow | null
  location: LocationRow | null
}

export async function getActivities(): Promise<ActivityListItem[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, sport:sports(id,code,name), location:locations(*)')
    .eq('active', true)
    .order('activity_date')
  if (error) throw error
  return (data ?? []) as unknown as ActivityListItem[]
}

export async function getActivity(id: string): Promise<ActivityListItem | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, sport:sports(id,code,name), location:locations(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as ActivityListItem
}

export async function getCamps(): Promise<Tables<'camps'>[]> {
  const { data, error } = await supabase.from('camps').select('*').order('period_start')
  if (error) throw error
  return data ?? []
}

export async function getCampBySlug(slug: string): Promise<Tables<'camps'> | null> {
  const { data, error } = await supabase.from('camps').select('*').eq('slug', slug).single()
  if (error) return null
  return data
}

export async function getCamp(id: string): Promise<Tables<'camps'> | null> {
  const { data, error } = await supabase.from('camps').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export type CoachListItem = Tables<'coach_profiles'> & {
  profile: CoachMini | null
  coach_sports: { sport: SportRow | null }[]
}

export async function getCoaches(): Promise<CoachListItem[]> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select(
      'id, user_id, bio, avatar_url, photo_storage_path, profile:profiles(id,name,avatar_url), coach_sports(sport:sports(id,code,name))'
    )
  if (error) throw error
  return (data ?? []) as unknown as CoachListItem[]
}

export async function getCoachByUserId(userId: string): Promise<CoachListItem | null> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select(
      'id, user_id, bio, avatar_url, photo_storage_path, profile:profiles(id,name,avatar_url), coach_sports(sport:sports(id,code,name))'
    )
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as unknown as CoachListItem
}

export type ClubListItem = Tables<'clubs'> & {
  club_sports: { sport: SportRow | null }[]
}

export async function getPublicClubs(): Promise<ClubListItem[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select(
      'id, owner_user_id, name, description, logo_storage_path, hero_photo_storage_path, website, phone, email, public_email_consent, address, city, created_at, club_sports(sport:sports(id,code,name))'
    )
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as ClubListItem[]
}

export async function getPublicClub(id: string): Promise<ClubListItem | null> {
  const { data, error } = await supabase
    .from('clubs')
    .select(
      'id, owner_user_id, name, description, logo_storage_path, hero_photo_storage_path, website, phone, email, public_email_consent, address, city, created_at, club_sports(sport:sports(id,code,name))'
    )
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as ClubListItem
}

export async function getLocations(): Promise<LocationRow[]> {
  const { data, error } = await supabase.from('locations').select('*').eq('is_active', true)
  if (error) throw error
  return data ?? []
}

/** Public storage URL for a path in a bucket. */
export function publicUrl(bucket: string, path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function submitContactForm(input: {
  name: string
  email: string
  subject?: string
  message: string
}) {
  return supabase.functions.invoke('contact-form', { body: input })
}
