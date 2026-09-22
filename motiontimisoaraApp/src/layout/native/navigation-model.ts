import {
  CalendarCheck,
  ClipboardCheck,
  Compass,
  CreditCard,
  Home,
  LayoutDashboard,
  MapPin,
  Megaphone,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { matchPath } from 'react-router-dom'

import type { Role } from '@/api/auth'
import {
  adminNavigation,
  clubNavigation,
  coachNavigation,
  publicNavigation,
  type PortalNavItem,
} from '@/layout/navigation'

const account: PortalNavItem = { to: '/cont', label: 'Cont', icon: UserRound, end: true }
const explore: PortalNavItem = { to: '/exploreaza', label: 'Explorează', icon: Compass }

export const personalNavigation: PortalNavItem[] = [
  { to: '/account', label: 'Panou părinte', icon: Home, end: true },
  { to: '/account/children', label: 'Copiii mei', icon: Users },
  { to: '/account/enrollments', label: 'Înscrieri', icon: CalendarCheck },
  { to: '/account/attendance', label: 'Prezență', icon: ClipboardCheck },
  { to: '/account/announcements', label: 'Anunțuri', icon: Megaphone },
]

export function bottomNavigation(role: Role | null): PortalNavItem[] {
  if (!role)
    return [
      { to: '/', label: 'Acasă', icon: Home, end: true },
      explore,
      { to: '/harta', label: 'Hartă', icon: MapPin },
      account,
    ]
  if (role === 'PARENT')
    return [
      { to: '/account', label: 'Acasă', icon: Home, end: true },
      explore,
      { to: '/account/children', label: 'Copii', icon: Users },
      { to: '/account/announcements', label: 'Anunțuri', icon: Megaphone },
      account,
    ]
  const choices =
    role === 'COACH'
      ? ([
          coachNavigation,
          ['/coach', '/coach/courses', '/coach/camps', '/coach/attendance'],
        ] as const)
      : role === 'CLUB'
        ? ([
            clubNavigation,
            ['/club', '/club/courses', '/club/camps', '/club/announcements'],
          ] as const)
        : ([adminNavigation, ['/admin', '/admin/users', '/admin/clubs', '/admin/camps']] as const)
  return [...choices[1].flatMap((to) => choices[0].filter((item) => item.to === to)), account]
}

export function accountGroups(role: Role) {
  const groups: { title: string; items: PortalNavItem[] }[] = []
  if (role === 'ADMIN') groups.push({ title: 'Administrare', items: adminNavigation })
  if (role === 'COACH' || role === 'ADMIN')
    groups.push({
      title: 'Antrenor',
      items: [
        ...coachNavigation,
        { to: '/coach/profile', label: 'Profil antrenor', icon: UserRound },
        { to: '/coach/stripe', label: 'Încasări', icon: CreditCard },
      ],
    })
  if (role === 'CLUB')
    groups.push({
      title: 'Club',
      items: [...clubNavigation, { to: '/club/stripe', label: 'Încasări', icon: CreditCard }],
    })
  groups.push({ title: 'Familia mea', items: personalNavigation })
  return groups
}

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

export function activeDestination(pathname: string, role: Role | null) {
  const tabs = bottomNavigation(role)
  const direct = tabs.find(
    (item) => item.to !== '/cont' && (item.end ? item.to === pathname : matches(pathname, item.to)),
  )
  if (direct) return direct.to
  if (role === 'PARENT' && matches(pathname, '/account/child')) return '/account/children'
  if ((role === 'COACH' || role === 'ADMIN') && matches(pathname, '/coach/children')) {
    return role === 'COACH' ? '/coach/attendance' : '/cont'
  }
  if (role === 'CLUB' && matches(pathname, '/club/children')) return '/club/camps'
  if (
    (!role || role === 'PARENT') &&
    (pathname === '/' || publicNavigation.some((item) => matches(pathname, item.to)))
  )
    return '/exploreaza'
  return '/cont'
}

const secondaryScreens = [
  ['/account/child/new', 'Adaugă copil', '/account/children'],
  ['/account/child/:id/qr', 'Codul QR al copilului', '/account/children'],
  ['/account/child/:id', 'Profil copil', '/account/children'],
  ['/account/checkout', 'Înscriere', '/account/enrollments'],
  ['/cursuri/:id', 'Detalii curs', '/cursuri'],
  ['/activitati/:id', 'Detalii activitate', '/activitati'],
  ['/tabere/:slug', 'Detalii tabără', '/tabere'],
  ['/antrenori/:id', 'Profil antrenor', '/antrenori'],
  ['/cluburi/:id', 'Detalii club', '/cluburi'],
  ['/login', 'Autentificare', '/cont'],
  ['/signup', 'Înregistrare', '/cont'],
  ['/register', 'Cont părinte', '/signup'],
  ['/register-coach', 'Cont antrenor', '/signup'],
  ['/register-club', 'Cont club', '/signup'],
  ['/forgot-password', 'Recuperare parolă', '/login'],
  ['/reset-password', 'Parolă nouă', '/login'],
  ['/auth/callback', 'Contul tău', '/cont'],
  ['/termeni', 'Termeni și condiții', '/cont'],
  ['/confidentialitate', 'Confidențialitate', '/cont'],
  ['/coach/profile', 'Profil antrenor', '/cont'],
  ['/coach/stripe', 'Încasări', '/cont'],
  ['/club/stripe', 'Încasări', '/cont'],
  ['/stripe/onboarding/:state', 'Configurare încasări', '/coach/stripe'],
  ['/club/stripe/onboarding/:state', 'Configurare încasări', '/club/stripe'],
  ...['coach', 'club', 'admin'].flatMap((role) => [
    [`/${role}/camps/new`, 'Adaugă tabără', `/${role}/camps`],
    [`/${role}/camps/:id/edit`, 'Editează tabăra', `/${role}/camps`],
    [`/${role}/camps/:id/enrolled`, 'Participanți', `/${role}/camps`],
    [
      `/${role}/children/:id/qr`,
      'Codul QR al copilului',
      role === 'coach' ? '/coach/attendance' : `/${role}/camps`,
    ],
    [`/${role}/courses/new`, 'Adaugă curs', `/${role}/courses`],
    [`/${role}/courses/:id/edit`, 'Editează cursul', `/${role}/courses`],
    [`/${role}/locations/new`, 'Adaugă locație', `/${role}/locations`],
    [`/${role}/locations/:id/edit`, 'Editează locația', `/${role}/locations`],
  ]),
  ['/club/activities/:id', 'Regulament activitate', '/club/activities'],
  ['/coach/activities/new', 'Adaugă activitate', '/coach/activities'],
  ['/coach/activities/:id/edit', 'Editează activitatea', '/coach/activities'],
]

export function nativeScreen(pathname: string, role: Role | null) {
  const secondary = secondaryScreens.find(([pattern]) => matchPath(pattern, pathname))
  if (secondary) return { title: secondary[1], backTo: secondary[2] }
  const tab = bottomNavigation(role).find((item) => item.to === pathname)
  if (tab) return { title: tab.label, backTo: null }
  if (pathname === '/') return { title: 'Motion Timișoara', backTo: role ? '/cont' : null }
  if (pathname === '/exploreaza') return { title: 'Explorează', backTo: '/cont' }
  const destination = [
    ...publicNavigation,
    ...personalNavigation,
    ...coachNavigation,
    ...clubNavigation,
    ...adminNavigation,
  ].find((item) => item.to === pathname)
  return { title: destination?.label ?? 'Motion Timișoara', backTo: '/cont' }
}

export const informationNavigation: PortalNavItem[] = [
  ...publicNavigation.slice(6),
  { to: '/termeni', label: 'Termeni și condiții', icon: ShieldCheck },
  { to: '/confidentialitate', label: 'Confidențialitate', icon: ShieldCheck },
]

export const discoveryNavigation: PortalNavItem[] = [
  { to: '/', label: 'Motion Timișoara', icon: LayoutDashboard, end: true },
  ...publicNavigation.slice(0, 6),
]
