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
