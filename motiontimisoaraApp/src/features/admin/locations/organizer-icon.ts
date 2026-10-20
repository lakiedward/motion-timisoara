import { Building2, MapPinned, UserRound } from 'lucide-react'

import type { OrganizerKind } from './location-overview'

export const ORGANIZER_ICON: Record<OrganizerKind, typeof Building2> = {
  club: Building2,
  coach: UserRound,
  shared: MapPinned,
}
