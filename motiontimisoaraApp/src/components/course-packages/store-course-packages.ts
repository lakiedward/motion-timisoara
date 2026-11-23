import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { saveCoursePackages } from '@/api/course-packages'
import type { CoursePackage, CoursePackageDraft } from '@/lib/course-packages/course-packages'

const FAILED = {
  new: 'Cursul rămâne inactiv. Pachetele nu s-au salvat. Verifică-le și apasă din nou Salvează.',
  edit: 'Cursul s-a salvat, dar pachetele nu. Verifică pachetele și apasă din nou Salvează.',
}

export async function storeCoursePackages(
  qc: QueryClient,
  courseId: string,
  drafts: CoursePackageDraft[],
  mode: keyof typeof FAILED,
): Promise<boolean> {
  try {
    const saved = await saveCoursePackages(courseId, drafts)
    const batches = {
      queryKey: ['course-packages-by-course'],
      predicate: ({ queryKey }: { queryKey: readonly unknown[] }) =>
        Array.isArray(queryKey[1]) && queryKey[1].includes(courseId),
    }
    await qc.cancelQueries(batches)
    qc.setQueryData(['course-packages', courseId], saved)
    qc.setQueriesData<Record<string, CoursePackage[]>>(batches, (cached) =>
      cached ? { ...cached, [courseId]: saved } : undefined,
    )
    void qc.invalidateQueries(batches)
    return true
  } catch {
    toast.error(FAILED[mode])
    return false
  }
}

export function refreshPublicCourses(qc: QueryClient) {
  void qc.invalidateQueries({
    predicate: ({ queryKey }) =>
      ['course-catalog', 'course', 'club-courses', 'coach-courses'].some(
        (key) => key === queryKey[0],
      ),
  })
}
