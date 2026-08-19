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
  course: { id: string; name: string; location: { name: string } | null } | null
  enrolled_count: number
  attendance_recorded: boolean
}

/** Ședințele mai vechi de atâtea zile stau strânse în spatele lui „Vezi mai mult”. */
export const PAST_VISIBLE_DAYS = 14

/** Câte ședințe aducem din fiecare grup. Peste atât, lista o spune pe ecran. */
export const SESSION_GROUP_LIMIT = 100

export interface CoachSessionGroups {
  /** Ședințele care urmează, cea mai apropiată prima. */
  upcoming: CoachSession[]
  /** Ședințele trecute, cea mai recentă prima. */
  past: CoachSession[]
  /** Câte dintre `past` intră în fereastra de PAST_VISIBLE_DAYS; sunt primele din listă. */
  pastRecentCount: number
  /** Un grup a atins limita de încărcare, deci există ședințe neafișate. */
  truncated: boolean
}

const SESSION_SELECT = '*, course:courses!inner(id, name, coach_id, location:locations(name))'

export async function getCoachSessions(): Promise<CoachSessionGroups> {
  const coachId = await uid()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const pastCutoff = now - PAST_VISIBLE_DAYS * 24 * 60 * 60 * 1000

  const [upcomingRes, pastRes] = await Promise.all([
    supabase
      .from('course_occurrences')
      .select(SESSION_SELECT)
      .eq('course.coach_id', coachId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(SESSION_GROUP_LIMIT + 1),
    supabase
      .from('course_occurrences')
      .select(SESSION_SELECT)
      .eq('course.coach_id', coachId)
      .lt('starts_at', nowIso)
      .order('starts_at', { ascending: false })
      .limit(SESSION_GROUP_LIMIT + 1),
  ])
  if (upcomingRes.error) throw upcomingRes.error
  if (pastRes.error) throw pastRes.error

  const rawUpcoming = (upcomingRes.data ?? []) as unknown as CoachSession[]
  const rawPast = (pastRes.data ?? []) as unknown as CoachSession[]
  const truncated =
    rawUpcoming.length > SESSION_GROUP_LIMIT || rawPast.length > SESSION_GROUP_LIMIT

  const upcoming = rawUpcoming.slice(0, SESSION_GROUP_LIMIT)
  const past = rawPast.slice(0, SESSION_GROUP_LIMIT)
  // `past` e descrescător, deci ședințele din fereastră sunt exact primele.
  const pastRecentCount = past.filter((s) => new Date(s.starts_at).getTime() >= pastCutoff).length
  const all = [...upcoming, ...past]
  if (!all.length) return { upcoming, past, pastRecentCount, truncated }

  const courseIds = [...new Set(all.map((s) => s.course?.id).filter(Boolean))] as string[]
  const [enrollmentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('entity_id')
      .eq('kind', 'COURSE')
      .eq('status', 'ACTIVE')
      .in('entity_id', courseIds),
    supabase
      .from('attendance')
      .select('occurrence_id')
      .in(
        'occurrence_id',
        all.map((s) => s.id)
      ),
  ])

  const enrolled = new Map<string, number>()
  for (const row of (enrollmentsRes.data ?? []) as { entity_id: string }[]) {
    enrolled.set(row.entity_id, (enrolled.get(row.entity_id) ?? 0) + 1)
  }
  const marked = new Set(
    ((attendanceRes.data ?? []) as { occurrence_id: string }[]).map((r) => r.occurrence_id)
  )

  const decorate = (s: CoachSession): CoachSession => ({
    ...s,
    enrolled_count: s.course ? (enrolled.get(s.course.id) ?? 0) : 0,
    attendance_recorded: marked.has(s.id),
  })

  return {
    upcoming: upcoming.map(decorate),
    past: past.map(decorate),
    pastRecentCount,
    truncated,
  }
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

export async function getMyCoachProfile() {
  const coachId = await uid()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, phone, email')
    .eq('id', coachId)
    .single()
  if (profileError) throw profileError

  const { data: coach, error: coachError } = await supabase
    .from('coach_profiles')
    .select('id, bio')
    .eq('user_id', coachId)
    .maybeSingle()
  if (coachError) throw coachError

  return {
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    bio: coach?.bio ?? '',
  }
}

export async function updateMyCoachProfile(input: {
  name: string
  phone: string | null
  bio: string | null
}) {
  const coachId = await uid()
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ name: input.name, phone: input.phone })
    .eq('id', coachId)
  if (profileError) throw profileError

  const { data: updated, error: coachError } = await supabase
    .from('coach_profiles')
    .update({ bio: input.bio })
    .eq('user_id', coachId)
    .select('id')
  if (coachError) throw coachError

  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from('coach_profiles')
      .insert({ user_id: coachId, bio: input.bio })
    if (insertError) throw insertError
  }
}

