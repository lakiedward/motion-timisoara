import { supabase } from '@/lib/supabase'
import { generateOccurrenceSlots, parseRecurrenceRuleJson } from '@/lib/course-program/occurrences'

export async function regenerateCourseOccurrences(
  courseId: string,
  recurrenceRule: string,
  now = new Date(),
): Promise<number> {
  const rule = parseRecurrenceRuleJson(recurrenceRule)
  const desired = generateOccurrenceSlots(rule, now)
  const desiredStarts = new Set(desired.map((slot) => slot.startsAt.toISOString()))

  const { data: future, error: futureError } = await supabase
    .from('course_occurrences')
    .select('id, starts_at')
    .eq('course_id', courseId)
    .gt('starts_at', now.toISOString())
  if (futureError) throw futureError
  const futureRows = Array.isArray(future) ? future : []

  const attendanceIds = new Set<string>()
  if (futureRows.length) {
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('occurrence_id')
      .in(
        'occurrence_id',
        futureRows.map((row) => row.id),
      )
    if (attendanceError) throw attendanceError
    for (const row of Array.isArray(attendance) ? attendance : [])
      attendanceIds.add(row.occurrence_id)
  }

  const existingStarts = new Set(futureRows.map((row) => new Date(row.starts_at).toISOString()))
  const toInsert = desired
    .filter((slot) => !existingStarts.has(slot.startsAt.toISOString()))
    .map((slot) => ({
      course_id: courseId,
      starts_at: slot.startsAt.toISOString(),
      ends_at: slot.endsAt.toISOString(),
    }))
  if (toInsert.length) {
    const { error: insertError } = await supabase.from('course_occurrences').insert(toInsert)
    if (insertError) throw insertError
  }

  const toDelete = futureRows
    .filter((row) => {
      if (attendanceIds.has(row.id)) return false
      return !desiredStarts.has(new Date(row.starts_at).toISOString())
    })
    .map((row) => row.id)
  if (toDelete.length) {
    const { error: deleteError } = await supabase
      .from('course_occurrences')
      .delete()
      .in('id', toDelete)
    if (deleteError) throw deleteError
  }

  return desired.length
}
