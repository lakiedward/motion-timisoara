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
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PortalNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  group?: string
}

export const coachNavigation: PortalNavItem[] = [
  { to: '/coach', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/coach/courses', label: 'Cursuri', icon: GraduationCap, group: 'Oferte' },
  { to: '/coach/activities', label: 'Activități', icon: CalendarRange, group: 'Oferte' },
  { to: '/coach/camps', label: 'Tabere', icon: Tent, group: 'Oferte' },
  { to: '/coach/competitions', label: 'Concursuri', icon: Trophy, group: 'Oferte' },
  { to: '/coach/locations', label: 'Locații', icon: MapPin, group: 'Organizare' },
  { to: '/coach/attendance', label: 'Prezență', icon: ClipboardCheck, group: 'Organizare' },
  { to: '/coach/announcements', label: 'Anunțuri', icon: Megaphone, group: 'Organizare' },
]

export const clubNavigation: PortalNavItem[] = [
  { to: '/club', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/club/profile', label: 'Profil club', icon: Building2 },
  { to: '/club/courses', label: 'Cursuri', icon: GraduationCap, group: 'Oferte' },
  { to: '/club/activities', label: 'Activități', icon: CalendarRange, group: 'Oferte' },
  { to: '/club/camps', label: 'Tabere', icon: Tent, group: 'Oferte' },
  { to: '/club/competitions', label: 'Concursuri', icon: Trophy, group: 'Oferte' },
  { to: '/club/locations', label: 'Locații', icon: MapPin, group: 'Organizare' },
  { to: '/club/coaches', label: 'Antrenori', icon: Users, group: 'Organizare' },
  { to: '/club/announcements', label: 'Anunțuri', icon: Megaphone, group: 'Organizare' },
]

export const adminNavigation: PortalNavItem[] = [
  { to: '/admin', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Utilizatori', icon: Users },
  { to: '/admin/clubs', label: 'Cluburi', icon: Building2 },
  { to: '/admin/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/admin/activities', label: 'Activități', icon: CalendarRange },
  { to: '/admin/locations', label: 'Locații', icon: MapPin },
  { to: '/admin/camps', label: 'Tabere', icon: Tent },
  { to: '/admin/competitions', label: 'Concursuri', icon: Trophy },
  { to: '/admin/announcements', label: 'Anunțuri', icon: Megaphone },
  { to: '/admin/attendance', label: 'Prezență', icon: ClipboardCheck },
  { to: '/admin/sports', label: 'Sporturi', icon: Dumbbell },
  { to: '/admin/codes', label: 'Coduri invitație', icon: Ticket },
]

export const publicNavigation: PortalNavItem[] = [
  { to: '/cursuri', label: 'Cursuri', icon: GraduationCap },
  { to: '/activitati', label: 'Activități', icon: CalendarRange },
  { to: '/tabere', label: 'Tabere', icon: Tent },
  { to: '/concursuri', label: 'Concursuri', icon: Trophy },
  { to: '/harta', label: 'Hartă', icon: MapPin },
  { to: '/antrenori', label: 'Antrenori', icon: Users },
  { to: '/cluburi', label: 'Cluburi', icon: Building2 },
  { to: '/despre', label: 'Despre', icon: Info },
  { to: '/contact', label: 'Contact', icon: Mail },
]
