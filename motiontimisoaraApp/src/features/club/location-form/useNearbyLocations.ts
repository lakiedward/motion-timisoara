import { useQuery } from '@tanstack/react-query'

import { getLocations } from '@/api/public'
import { findNearbyLocations, type LocationPoint } from './nearby-locations'

export function useNearbyLocations(point: LocationPoint | null, clubId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['club-nearby-locations', clubId, point?.lat, point?.lng],
    queryFn: async () => findNearbyLocations(await getLocations(), point as LocationPoint),
    enabled: enabled && !!clubId && point !== null,
  })
}
