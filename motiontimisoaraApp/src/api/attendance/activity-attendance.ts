import type { RosterEntry } from '@/api/coach'
import { supabase } from '@/lib/supabase'
import { AttendanceError } from './index'

export type ActivityAttendanceStatus = 'PRESENT' | 'ABSENT'

const messages: Record<string, string> = {
  NOT_ENROLLED: 'Copilul nu are o înscriere activă la această activitate.',
  TOO_EARLY: 'Pontajul se deschide în ziua activității.',
  FORBIDDEN: 'Nu ai acces la această activitate.',
}

type EnrolledChild = { child: { id: string; name: string; birth_date: string } | null }

export async function getActivityRoster(activityId: string): Promise<RosterEntry[]> {
  const [enrollmentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('child:children(id, name, birth_date)')
      .eq('kind', 'ACTIVITY')
      .eq('entity_id', activityId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('activity_attendance')
      .select('child_id, status')
      .eq('activity_id', activityId),
  ])
  if (enrollmentsRes.error) throw enrollmentsRes.error
  if (attendanceRes.error) throw attendanceRes.error

  const marks = new Map((attendanceRes.data ?? []).map((a) => [a.child_id, a.status]))
  return ((enrollmentsRes.data ?? []) as unknown as EnrolledChild[])
    .flatMap((e) => (e.child ? [e.child] : []))
    .map((c) => ({
      child_id: c.id,
      child_name: c.name,
      child_birth_date: c.birth_date,
      status: (marks.get(c.id) as ActivityAttendanceStatus | undefined) ?? null,
    }))
    .sort((a, b) => a.child_name.localeCompare(b.child_name, 'ro'))
}

export async function getActivityMarkedCounts(activityIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!activityIds.length) return counts
  const { data, error } = await supabase
    .from('activity_attendance')
    .select('activity_id')
    .in('activity_id', activityIds)
  if (error) throw error
  for (const row of data ?? []) counts.set(row.activity_id, (counts.get(row.activity_id) ?? 0) + 1)
  return counts
}

export async function markActivityAttendance(
  activityId: string,
  childIds: string[],
  status: ActivityAttendanceStatus | null,
  onlyUnmarked = false,
): Promise<number> {
  if (!childIds.length) return 0
  const { data, error } = await supabase.rpc('record_activity_attendance', {
    p_activity_id: activityId,
    p_child_ids: childIds,
    p_status: status as string,
    p_only_unmarked: onlyUnmarked,
  })
  if (error) {
    const code = error.message in messages ? error.message : 'NETWORK'
    throw new AttendanceError(messages[code] ?? 'Nu am putut salva prezența. Reîncearcă.', false, code)
  }
  return data ?? 0
}

export interface ActivityAttendanceRow {
  id: string
  child_id: string
  activity_id: string
  status: ActivityAttendanceStatus
  activity: { name: string; activity_date: string; start_time: string } | null
}

export async function getMyChildrenActivityAttendance(): Promise<ActivityAttendanceRow[]> {
  const { data, error } = await supabase
    .from('activity_attendance')
    .select('id, child_id, activity_id, status, activity:activities(name, activity_date, start_time)')
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ActivityAttendanceRow[]
}
