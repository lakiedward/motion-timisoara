import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/lib/database.types'

export type Child = Tables<'children'>
export type ChildInput = Omit<TablesInsert<'children'>, 'id' | 'parent_id' | 'created_at'>

export async function getMyChildren(): Promise<Child[]> {
  const { data, error } = await supabase.from('children').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function getChild(id: string): Promise<Child | null> {
  const { data, error } = await supabase.from('children').select('*').eq('id', id).single()
  if (error) return null
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

export function childAge(birthDate: string): number {
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}
