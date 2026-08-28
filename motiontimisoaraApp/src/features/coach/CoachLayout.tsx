import { CalendarRange, ClipboardCheck, GraduationCap, LayoutDashboard, MapPin, Tent } from 'lucide-react'

import { PortalLayout, type PortalNavItem } from '@/layout/PortalLayout'

const NAV: PortalNavItem[] = [
  { to: '/coach', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/coach/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/coach/activities', label: 'Activități', icon: CalendarRange },
  { to: '/coach/camps', label: 'Tabere', icon: Tent },
  { to: '/coach/locations', label: 'Locații', icon: MapPin },
  { to: '/coach/attendance', label: 'Prezență', icon: ClipboardCheck },
]

export default function CoachLayout() {
  return <PortalLayout nav={NAV} roleLabel="Antrenor" profileTo="/coach/profile" />
}
