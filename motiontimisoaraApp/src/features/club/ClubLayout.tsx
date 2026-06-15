import { Building2, GraduationCap, LayoutDashboard, MapPin, Megaphone, Users } from 'lucide-react'

import { PortalLayout, type PortalNavItem } from '@/layout/PortalLayout'

const NAV: PortalNavItem[] = [
  { to: '/club', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/club/profile', label: 'Profil club', icon: Building2 },
  { to: '/club/coaches', label: 'Antrenori', icon: Users },
  { to: '/club/announcements', label: 'Anunțuri', icon: Megaphone },
  { to: '/club/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/club/locations', label: 'Locații', icon: MapPin },
]

export default function ClubLayout() {
  return <PortalLayout nav={NAV} roleLabel="Club" />
}
