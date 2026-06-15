import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type CoachCourse = Tables<'courses'> & {
  sport: Pick<Tables<'sports'>, 'id' | 'code' | 'name'> | null
  location: Pick<Tables<'locations'>, 'id' | 'name' | 'city'> | null
}

async function uid(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export async function getMyCourses(): Promise<CoachCourse[]> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('courses')
    .select('*, sport:sports(id,code,name), location:locations(id,name,city)')
    .eq('coach_id', coachId)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as CoachCourse[]
}

export async function getCourseById(id: string): Promise<Tables<'courses'> | null> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export interface CourseFormInput {
  name: string
  sport_id: string
  location_id: string
  level: string | null
  age_from: number | null
  age_to: number | null
  capacity: number | null
  price_per_session: number // bani
  description: string | null
}

export async function createCourse(input: CourseFormInput): Promise<Tables<'courses'>> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('courses')
    .insert({
      ...input,
      coach_id: coachId,
      price: input.price_per_session * 8,
      active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(id: string, input: CourseFormInput): Promise<Tables<'courses'>> {
  const { data, error } = await supabase
    .from('courses')
    .update({ ...input, price: input.price_per_session * 8 })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setCourseActive(id: string, active: boolean) {
  const { error } = await supabase.from('courses').update({ active }).eq('id', id)
  if (error) throw error
}

/** Active locations a coach can pick (RLS allows privileged read). */
export async function getSelectableLocations(): Promise<
  Pick<Tables<'locations'>, 'id' | 'name' | 'city'>[]
> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, city')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

// ===== Activities =====
export type CoachActivity = Tables<'activities'> & {
  sport: Pick<Tables<'sports'>, 'id' | 'code' | 'name'> | null
  location: Pick<Tables<'locations'>, 'id' | 'name'> | null
}

export async function getMyActivities(): Promise<CoachActivity[]> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('activities')
    .select('*, sport:sports(id,code,name), location:locations(id,name)')
    .eq('coach_id', coachId)
    .order('activity_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CoachActivity[]
}

export async function getActivityById(id: string): Promise<Tables<'activities'> | null> {
  const { data, error } = await supabase.from('activities').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export interface ActivityFormInput {
  name: string
  description: string | null
  sport_id: string
  location_id: string
  activity_date: string
  start_time: string
  end_time: string
  price: number // bani
  capacity: number | null
}

export async function createActivity(input: ActivityFormInput): Promise<Tables<'activities'>> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...input, coach_id: coachId, active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateActivity(id: string, input: ActivityFormInput): Promise<Tables<'activities'>> {
  const { data, error } = await supabase.from('activities').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setActivityActive(id: string, active: boolean) {
  const { error } = await supabase.from('activities').update({ active }).eq('id', id)
  if (error) throw error
}

// ===== Locations (coach-owned) =====
export async function getMyLocations(): Promise<Tables<'locations'>[]> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('created_by_user_id', coachId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getLocationById(id: string): Promise<Tables<'locations'> | null> {
  const { data, error } = await supabase.from('locations').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export interface LocationFormInput {
  name: string
  type: string
  address: string | null
  city: string | null
  lat: number | null
  lng: number | null
  description: string | null
}

export async function createLocation(input: LocationFormInput): Promise<Tables<'locations'>> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('locations')
    .insert({ ...input, created_by_user_id: coachId, is_active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLocation(id: string, input: LocationFormInput): Promise<Tables<'locations'>> {
  const { data, error } = await supabase.from('locations').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setLocationActive(id: string, is_active: boolean) {
  const { error } = await supabase.from('locations').update({ is_active }).eq('id', id)
  if (error) throw error
}

// ===== Attendance =====
export type CoachSession = Tables<'course_occurrences'> & {
  course: { id: string; name: string } | null
}

export async function getCoachSessions(): Promise<CoachSession[]> {
  const coachId = await uid()
  const { data, error } = await supabase
    .from('course_occurrences')
    .select('*, course:courses!inner(id, name, coach_id)')
    .eq('course.coach_id', coachId)
    .order('starts_at', { ascending: false })
    .limit(60)
  if (error) throw error
  return (data ?? []) as unknown as CoachSession[]
}

export interface RosterEntry {
  child_id: string
  child_name: string
  status: 'PRESENT' | 'ABSENT' | null
}

export async function getSessionRoster(courseId: string, occurrenceId: string): Promise<RosterEntry[]> {
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('child:children(id, name)')
    .eq('kind', 'COURSE')
    .eq('entity_id', courseId)
    .eq('status', 'ACTIVE')
  const { data: attendance } = await supabase
    .from('attendance')
    .select('child_id, status')
    .eq('occurrence_id', occurrenceId)
  const attMap = new Map((attendance ?? []).map((a) => [a.child_id, a.status]))
  return ((enrollments ?? []) as unknown as { child: { id: string; name: string } | null }[])
    .filter((e) => e.child)
    .map((e) => ({
      child_id: e.child!.id,
      child_name: e.child!.name,
      status: (attMap.get(e.child!.id) as 'PRESENT' | 'ABSENT' | undefined) ?? null,
    }))
}

export async function markAttendance(
  occurrenceId: string,
  childId: string,
  status: 'PRESENT' | 'ABSENT'
) {
  const { error } = await supabase
    .from('attendance')
    .upsert(
      { occurrence_id: occurrenceId, child_id: childId, status },
      { onConflict: 'occurrence_id,child_id' }
    )
  if (error) throw error
}
