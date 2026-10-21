import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getClubLocationById, getMyClub } from '@/api/club'
import { getCurrentCoachId, getLocationById } from '@/api/coach'
import {
  getLocationAdmin,
  type AdminLocation,
  type LocationOwner,
} from '@/api/locations/admin-locations'
import type { Tables } from '@/lib/database.types'

export type LocationFormPortal = 'club' | 'admin' | 'coach'

export type EditableLocation = Tables<'locations'> &
  Partial<Pick<AdminLocation, 'club' | 'creator'>>

export const SHARED_OWNER = 'shared'

export function ownerValue(location: Tables<'locations'>): string {
  if (location.club_id) return `club:${location.club_id}`
  if (location.created_by_user_id) return `coach:${location.created_by_user_id}`
  return SHARED_OWNER
}

export function parseOwner(value: string): LocationOwner | null {
  const [kind, id] = value.split(':')
  if ((kind === 'club' || kind === 'coach') && id) return { kind, id }
  return null
}

const PORTAL_PATHS: Record<LocationFormPortal, { list: string; listKey: string }> = {
  club: { list: '/club/locations', listKey: 'club-locations' },
  admin: { list: '/admin/locations', listKey: 'admin-locations' },
  coach: { list: '/coach/locations', listKey: 'my-locations' },
}

export function useLocationFormOwner(portal: LocationFormPortal, id: string | undefined) {
  const isAdmin = portal === 'admin'
  const isCoach = portal === 'coach'
  const isEdit = !!id
  const [chosen, setChosen] = useState('')
  const { data: club } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    enabled: portal === 'club',
  })
  const { data: coachId = '' } = useQuery({
    queryKey: ['current-coach-id'],
    queryFn: getCurrentCoachId,
    enabled: isCoach,
  })
  const myClubId = club?.id ?? ''
  const { data: clubs = [] } = useQuery({
    queryKey: ['admin-clubs'],
    queryFn: getAllClubs,
    enabled: isAdmin,
  })
  const { data: coaches = [] } = useQuery({
    queryKey: ['admin-location-coaches'],
    queryFn: getCoachesForSelect,
    enabled: isAdmin && !isEdit,
  })
  const existingQuery = useQuery({
    queryKey: isAdmin
      ? ['admin-location-edit', id]
      : isCoach
        ? ['location-edit', coachId, id]
        : ['club-location-edit', myClubId, id],
    queryFn: (): Promise<EditableLocation | null> =>
      isAdmin
        ? getLocationAdmin(id as string)
        : isCoach
          ? getLocationById(id as string)
          : getClubLocationById(id as string, myClubId),
    enabled: isEdit && (isAdmin || (isCoach ? !!coachId : !!myClubId)),
  })
  const existing = existingQuery.data
  const owner = isCoach
    ? coachId && `coach:${coachId}`
    : !isAdmin
      ? myClubId && `club:${myClubId}`
      : isEdit
        ? existing
          ? ownerValue(existing)
          : ''
        : chosen
  const ownerId = owner.includes(':') ? owner.slice(owner.indexOf(':') + 1) : ''

  return {
    isAdmin,
    isCoach,
    club,
    clubs,
    coaches,
    owner,
    setOwner: setChosen,
    nearbyScope: ownerId || owner || (isAdmin ? 'admin' : ''),
    readyToRead: isAdmin || (isCoach ? !!coachId : !!myClubId),
    existingQuery,
    listPath: PORTAL_PATHS[portal].list,
    listQueryKey: PORTAL_PATHS[portal].listKey,
  }
}
