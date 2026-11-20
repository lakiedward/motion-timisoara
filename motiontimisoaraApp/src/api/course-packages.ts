import { supabase } from '@/lib/supabase'
import {
  packagesToPayload,
  type CoursePackage,
  type CoursePackageDraft,
} from '@/lib/course-packages/course-packages'

const PACKAGE_COLUMNS = 'id, position, sessions, price, validity'

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
