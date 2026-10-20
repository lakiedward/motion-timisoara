import { useQuery } from '@tanstack/react-query'

import { getSelectableLocations } from '@/api/coach'
import {
  INDEPENDENT_OWNER,
  useCourseFormOwner,
} from '@/features/club/course-form/useCourseFormOwner'
import type { Tables } from '@/lib/database.types'

export type ActivityFormPortal = 'coach' | 'admin'

export function useActivityFormOwner(
  portal: ActivityFormPortal,
  existing: Tables<'activities'> | null | undefined,
  isEdit: boolean,
) {
  const isAdmin = portal === 'admin'
  const admin = useCourseFormOwner('admin', existing, isEdit, isAdmin)
  const own = useQuery({
    queryKey: ['sel-locations'],
    queryFn: getSelectableLocations,
    enabled: !isAdmin,
  })
  const owner = isAdmin ? admin.owner : ''

  return {
    isAdmin,
    owner,
    setOwner: admin.setOwner,
    clubs: admin.clubs,
    clubId: isAdmin && owner && owner !== INDEPENDENT_OWNER ? owner : null,
    hasOwner: !!owner,
    coaches: isAdmin ? admin.coaches : [],
    coachesReady: !isAdmin || admin.coachesReady,
    locations: isAdmin ? admin.locations : (own.data ?? []),
    locationsReady: isAdmin ? admin.locationsReady : own.isSuccess,
    listPath: isAdmin ? '/admin/activities' : '/coach/activities',
    listQueryKey: isAdmin ? 'admin-activities' : 'my-activities',
  }
}
