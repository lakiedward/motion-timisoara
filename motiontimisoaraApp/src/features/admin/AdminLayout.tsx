import { Building2, Dumbbell, GraduationCap, LayoutDashboard, Ticket, Users } from 'lucide-react'

import { PortalLayout, type PortalNavItem } from '@/layout/PortalLayout'

const NAV: PortalNavItem[] = [
  { to: '/admin', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Utilizatori', icon: Users },
  { to: '/admin/clubs', label: 'Cluburi', icon: Building2 },
  { to: '/admin/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/admin/sports', label: 'Sporturi', icon: Dumbbell },
  { to: '/admin/codes', label: 'Coduri invitație', icon: Ticket },
]

export default function AdminLayout() {
  return <PortalLayout nav={NAV} roleLabel="Administrare" />
}
