import { supabase } from '@/lib/supabase'
import {
  packagesToPayload,
  type CoursePackage,
  type CoursePackageDraft,
} from '@/lib/course-packages/course-packages'

const PACKAGE_COLUMNS = 'id, position, sessions, price, validity, validity_days'

export async function getCoursePackages(courseId: string): Promise<CoursePackage[]> {
  const { data, error } = await supabase
    .from('course_packages')
    .select(PACKAGE_COLUMNS)
    .eq('course_id', courseId)
    .order('position')
  if (error?.code === '22P02') return []
  if (error) throw error
  return data ?? []
}

export async function getCoursePackagesByCourse(
  courseIds: string[],
): Promise<Record<string, CoursePackage[]>> {
  if (courseIds.length === 0) return {}
  const { data, error } = await supabase
    .from('course_packages')
    .select(`course_id, ${PACKAGE_COLUMNS}`)
    .in('course_id', courseIds)
    .order('position')
  if (error) throw error
  const grouped: Record<string, CoursePackage[]> = {}
  for (const { course_id, ...item } of data ?? []) {
    ;(grouped[course_id] ??= []).push(item)
  }
  return grouped
}

export async function saveCoursePackages(
  courseId: string,
  drafts: CoursePackageDraft[],
): Promise<CoursePackage[]> {
  const { data, error } = await supabase.rpc('save_course_packages', {
    p_course_id: courseId,
    p_packages: packagesToPayload(drafts),
  })
  if (error) throw error
  return data ?? []
}
