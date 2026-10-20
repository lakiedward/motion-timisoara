import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getClubLocationById, getMyClub } from '@/api/club'
import {
  getLocationAdmin,
  type AdminLocation,
  type LocationOwner,
} from '@/api/locations/admin-locations'
import type { Tables } from '@/lib/database.types'

export type LocationFormPortal = 'club' | 'admin'

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

export function useLocationFormOwner(portal: LocationFormPortal, id: string | undefined) {
  const isAdmin = portal === 'admin'
  const isEdit = !!id
  const [chosen, setChosen] = useState('')
  const { data: club } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    enabled: !isAdmin,
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
    queryKey: isAdmin ? ['admin-location-edit', id] : ['club-location-edit', myClubId, id],
    queryFn: (): Promise<EditableLocation | null> =>
      isAdmin ? getLocationAdmin(id as string) : getClubLocationById(id as string, myClubId),
    enabled: isEdit && (isAdmin || !!myClubId),
  })
  const existing = existingQuery.data
  const owner = !isAdmin
    ? myClubId && `club:${myClubId}`
    : isEdit
      ? existing
        ? ownerValue(existing)
        : ''
      : chosen

  return {
    isAdmin,
    club,
    clubs,
    coaches,
    owner,
    setOwner: setChosen,
    nearbyScope: owner.startsWith('club:') ? owner.slice(5) : owner || (isAdmin ? 'admin' : ''),
    readyToRead: isAdmin || !!myClubId,
    existingQuery,
    listPath: isAdmin ? '/admin/locations' : '/club/locations',
    listQueryKey: isAdmin ? 'admin-locations' : 'club-locations',
  }
}
