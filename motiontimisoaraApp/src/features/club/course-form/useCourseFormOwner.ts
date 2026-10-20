import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getClubRosterForSelect, getClubSelectableLocations, getMyClub } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'
import type { Tables } from '@/lib/database.types'

export type CourseFormPortal = 'club' | 'admin'

export const INDEPENDENT_OWNER = 'independent'

export function useCourseFormOwner(
  portal: CourseFormPortal,
  existing: Tables<'courses'> | null | undefined,
  isEdit: boolean,
) {
  const isAdmin = portal === 'admin'
  const [chosen, setChosen] = useState('')
  const { data: myClub } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    enabled: !isAdmin,
  })
  const { data: clubs = [] } = useQuery({
    queryKey: ['admin-clubs'],
    queryFn: getAllClubs,
    enabled: isAdmin,
  })

  const savedOwner = existing ? (existing.club_id ?? INDEPENDENT_OWNER) : ''
  const owner = !isAdmin ? (myClub?.id ?? '') : isEdit ? savedOwner : chosen
  const independent = owner === INDEPENDENT_OWNER
  const clubId = owner && !independent ? owner : null
  const keepLocationId = existing?.location_id ?? null

  const { data: coaches = [], isSuccess: coachesReady } = useQuery({
    queryKey: isAdmin ? ['admin-course-coaches', owner] : ['club-roster-select', owner],
    queryFn: () => (independent ? getCoachesForSelect() : getClubRosterForSelect(owner)),
    enabled: !!owner,
  })
  const { data: locations = [], isSuccess: locationsReady } = useQuery({
    queryKey: isAdmin
      ? ['admin-course-locations', owner, keepLocationId]
      : ['club-selectable-locations', owner, keepLocationId],
    queryFn: () =>
      independent ? getSelectableLocations() : getClubSelectableLocations(owner, keepLocationId),
    enabled: !!owner && (!isEdit || !!existing),
  })

  return {
    isAdmin,
    owner,
    setOwner: setChosen,
    clubs,
    clubId,
    hasOwner: !!owner,
    coaches,
    coachesReady,
    locations,
    locationsReady,
    listPath: isAdmin ? '/admin/courses' : '/club/courses',
    listQueryKey: isAdmin ? 'admin-courses' : 'club-courses',
  }
}
