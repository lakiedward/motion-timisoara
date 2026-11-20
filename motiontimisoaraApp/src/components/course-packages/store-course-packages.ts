import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { saveCoursePackages } from '@/api/course-packages'
import type { CoursePackageDraft } from '@/lib/course-packages/course-packages'

const FAILED = {
  new: 'Cursul a fost creat, dar pachetele nu s-au salvat. Deschide cursul și adaugă-le din nou.',
  edit: 'Cursul s-a salvat, dar pachetele nu. Verifică pachetele și apasă din nou Salvează.',
}

export async function storeCoursePackages(
  qc: QueryClient,
  courseId: string,
  drafts: CoursePackageDraft[],
  mode: keyof typeof FAILED,
): Promise<boolean> {
  try {
    qc.setQueryData(['course-packages', courseId], await saveCoursePackages(courseId, drafts))
    return true
  } catch {
    qc.invalidateQueries({ queryKey: ['course-packages', courseId] })
    toast.error(FAILED[mode])
    return false
  }
}
