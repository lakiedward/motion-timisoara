import {
  Building2,
  CalendarRange,
  ClipboardCheck,
  Dumbbell,
  GraduationCap,
  Info,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  Tent,
  Ticket,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PortalNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const coachNavigation: PortalNavItem[] = [
  { to: '/coach', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/coach/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/coach/activities', label: 'Activități', icon: CalendarRange },
  { to: '/coach/camps', label: 'Tabere', icon: Tent },
  { to: '/coach/locations', label: 'Locații', icon: MapPin },
  { to: '/coach/attendance', label: 'Prezență', icon: ClipboardCheck },
]

export const clubNavigation: PortalNavItem[] = [
  { to: '/club', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/club/profile', label: 'Profil club', icon: Building2 },
  { to: '/club/coaches', label: 'Antrenori', icon: Users },
  { to: '/club/announcements', label: 'Anunțuri', icon: Megaphone },
  { to: '/club/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/club/camps', label: 'Tabere', icon: Tent },
  { to: '/club/locations', label: 'Locații', icon: MapPin },
]

export const adminNavigation: PortalNavItem[] = [
  { to: '/admin', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Utilizatori', icon: Users },
  { to: '/admin/clubs', label: 'Cluburi', icon: Building2 },
  { to: '/admin/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/admin/camps', label: 'Tabere', icon: Tent },
  { to: '/admin/sports', label: 'Sporturi', icon: Dumbbell },
  { to: '/admin/codes', label: 'Coduri invitație', icon: Ticket },
]

export const publicNavigation: PortalNavItem[] = [
  { to: '/cursuri', label: 'Cursuri', icon: GraduationCap },
  { to: '/activitati', label: 'Activități', icon: CalendarRange },
  { to: '/tabere', label: 'Tabere', icon: Tent },
  { to: '/harta', label: 'Hartă', icon: MapPin },
  { to: '/antrenori', label: 'Antrenori', icon: Users },
  { to: '/cluburi', label: 'Cluburi', icon: Building2 },
  { to: '/despre', label: 'Despre', icon: Info },
  { to: '/contact', label: 'Contact', icon: Mail },
]
