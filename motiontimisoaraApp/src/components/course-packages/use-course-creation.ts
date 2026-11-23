import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { renuntaLaOfertaFaraHero, schimbaPozaOferta } from '@/api/offer-hero'
import type { CoursePackageDraft } from '@/lib/course-packages/course-packages'
import { storeCoursePackages } from './store-course-packages'

export function useCourseCreation() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<{ id: string; hero: File } | null>(null)

  async function saveCourse({
    create,
    update,
    activate,
    refreshLists,
    hero,
    packages,
  }: {
    create: (active: boolean) => Promise<{ id: string }>
    update: (id: string) => Promise<unknown>
    activate: (id: string) => Promise<unknown>
    refreshLists: () => void
    hero: File | null
    packages: CoursePackageDraft[]
  }): Promise<string | null> {
    const needsActivation = Boolean(draft) || packages.length > 0
    let courseId: string
    if (draft) {
      courseId = draft.id
      await update(courseId)
      if (hero && hero !== draft.hero) {
        await schimbaPozaOferta('courses', 'course-photos', courseId, hero)
        setDraft({ id: courseId, hero })
      }
    } else {
      if (!hero) return null
      const course = await create(!needsActivation)
      courseId = course.id
      try {
        await schimbaPozaOferta('courses', 'course-photos', courseId, hero)
      } catch {
        await renuntaLaOfertaFaraHero('courses', courseId)
        toast.error('Fără poza din capul paginii cursul nu se salvează.')
        return null
      }
      if (needsActivation) setDraft({ id: courseId, hero })
    }
    if (needsActivation) {
      refreshLists()
      if (!(await storeCoursePackages(qc, courseId, packages, 'new'))) return null
      try {
        await activate(courseId)
      } catch {
        toast.error('Cursul și pachetele s-au salvat. Apasă din nou Salvează pentru activare.')
        return null
      }
      setDraft(null)
    }
    return courseId
  }

  return { hasDraft: Boolean(draft), saveCourse }
}
