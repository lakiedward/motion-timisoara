import { supabase } from '@/lib/supabase'
import { POSTGREST_MAX_ROWS } from '@/api/admin'
import type { ActivityFormInput } from '@/api/coach'
import type { Tables } from '@/lib/database.types'

export type AdminActivity = Tables<'activities'> & {
  sport: Pick<Tables<'sports'>, 'id' | 'name'> | null
  coach: Pick<Tables<'profiles'>, 'id' | 'name'> | null
  location: Pick<Tables<'locations'>, 'id' | 'name'> | null
  club: Pick<Tables<'clubs'>, 'id' | 'name'> | null
  enrolled: number
}

export type ActivityOwner = { clubId: string | null; coachId: string }

const ADMIN_ACTIVITY_SELECT =
  '*, sport:sports(id,name), coach:profiles!activities_coach_id_fkey(id,name), location:locations(id,name), club:clubs(id,name)'

async function getActivityEnrollmentRows() {
  const rows: { entity_id: string }[] = []
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('entity_id')
      .eq('kind', 'ACTIVITY')
      .eq('status', 'ACTIVE')
      .order('id')
      .range(from, from + POSTGREST_MAX_ROWS - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < POSTGREST_MAX_ROWS) return rows
  }
}

export function countActivityEnrollments(rows: { entity_id: string }[]) {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.entity_id, (counts.get(row.entity_id) ?? 0) + 1)
  return counts
}

export async function getAllActivitiesAdmin(): Promise<AdminActivity[]> {
  const [activities, enrollments] = await Promise.all([
    supabase
      .from('activities')
      .select(ADMIN_ACTIVITY_SELECT)
      .order('activity_date', { ascending: false })
      .order('start_time')
      .order('id'),
    getActivityEnrollmentRows(),
  ])
  if (activities.error) throw activities.error
  const counts = countActivityEnrollments(enrollments)
  return ((activities.data ?? []) as unknown as Omit<AdminActivity, 'enrolled'>[]).map((a) => ({
    ...a,
    enrolled: counts.get(a.id) ?? 0,
  }))
}

export async function setActivityActiveAdmin(id: string, active: boolean) {
  const { error } = await supabase
    .from('activities')
    .update({ active })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function createAdminActivity(
  owner: ActivityOwner,
  input: ActivityFormInput,
): Promise<Tables<'activities'>> {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      ...input,
      coach_id: owner.coachId,
      club_id: owner.clubId,
      payment_recipient: owner.clubId ? 'CLUB' : 'COACH',
      active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAdminActivity(
  id: string,
  coachId: string,
  input: ActivityFormInput,
): Promise<Tables<'activities'>> {
  const { data, error } = await supabase
    .from('activities')
    .update({ ...input, coach_id: coachId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
