import { toast } from 'sonner'

import { saveCoursePackages } from '@/api/course-packages'
import type { CoursePackageDraft } from '@/lib/course-packages/course-packages'

export async function saveNewCoursePackages(courseId: string, drafts: CoursePackageDraft[]) {
  try {
    await saveCoursePackages(courseId, drafts)
  } catch {
    toast.error(
      'Cursul a fost creat, dar pachetele nu s-au salvat. Deschide cursul și adaugă-le din nou.',
    )
  }
}
