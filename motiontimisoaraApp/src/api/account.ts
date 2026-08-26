import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/lib/database.types'

export type Child = Tables<'children'>
export type ChildInput = Omit<TablesInsert<'children'>, 'id' | 'parent_id' | 'created_at'>

export async function getMyChildren(): Promise<Child[]> {
  const { data, error } = await supabase.from('children').select('*').order('name')
  if (error) throw error
  return data ?? []
}

/**
 * Copilul cerut, sau `null` cand nu exista ori nu e al parintelui (RLS il ascunde).
 *
 * `maybeSingle` + aruncarea erorii, nu `single` cu `return null` pe orice esec:
 * altfel „nu exista" si „n-am putut citi" arata la fel pentru apelant, iar ecranul
 * ii spune parintelui ca nu are copilul cand de fapt a picat reteaua.
 */
export async function getChild(id: string): Promise<Child | null> {
  const { data, error } = await supabase.from('children').select('*').eq('id', id).maybeSingle()
  // `22P02` = id-ul din adresa nu e nici macar un uuid valid. Pentru Postgres e o
  // eroare de sintaxa, dar pentru parinte e tot „copilul asta nu exista": niciun
  // rand nu l-ar fi putut potrivi. Restul erorilor sunt esecuri reale si urca.
  if (error) {
    if (error.code === '22P02') return null
    throw error
  }
  return data
}

export async function createChild(input: ChildInput): Promise<Child> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('children')
    .insert({ ...input, parent_id: session.user.id, gdpr_consent_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateChild(id: string, input: Partial<ChildInput>): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteChild(id: string) {
  return supabase.from('children').delete().eq('id', id)
}

/** Enrollment rows for the current parent (RLS-scoped via children), with payment + child. */
export type EnrollmentRow = Tables<'enrollments'> & {
  child: Pick<Tables<'children'>, 'id' | 'name'> | null
  payments: Pick<Tables<'payments'>, 'amount' | 'status' | 'method' | 'paid_at'>[]
}

export async function getMyEnrollments(): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, child:children(id,name), payments(amount,status,method,paid_at)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EnrollmentRow[]
}

/** Attendance for a child, joined to occurrence + course, newest first. */
export type AttendanceRow = Tables<'attendance'> & {
  occurrence: { starts_at: string; course: { name: string } | null } | null
}

export async function getChildAttendance(childId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, occurrence:course_occurrences(starts_at, course:courses(name))')
    .eq('child_id', childId)
  if (error) throw error
  return (data ?? []) as unknown as AttendanceRow[]
}

/**
 * Prezenta mai multor copii deodata, pentru vederea „Toti copiii".
 *
 * Un singur `.in(...)` in loc de cate o cerere per copil: politica `attendance_select`
 * restrange oricum randurile la copiii parintelui, deci lista de id-uri e o comoditate
 * pentru client, nu o masura de securitate. Randul poarta `child_id`, deci numele se
 * pune din lista de copii deja incarcata — fara join in plus.
 */
export async function getChildrenAttendance(childIds: string[]): Promise<AttendanceRow[]> {
  if (!childIds.length) return []
  const { data, error } = await supabase
    .from('attendance')
    .select('*, occurrence:course_occurrences(starts_at, course:courses(name))')
    .in('child_id', childIds)
  if (error) throw error
  return (data ?? []) as unknown as AttendanceRow[]
}

/** Course announcements for courses the parent's children are enrolled in (RLS-scoped). */
export type CourseAnnouncementRow = Tables<'course_announcements'> & {
  course: Pick<Tables<'courses'>, 'id' | 'name'> | null
}

export async function getMyCourseAnnouncements(): Promise<CourseAnnouncementRow[]> {
  const { data, error } = await supabase
    .from('course_announcements')
    .select('*, course:courses(id,name)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CourseAnnouncementRow[]
}

export function childAge(birthDate: string): number {
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}
