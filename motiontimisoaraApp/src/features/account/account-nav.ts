export const ACCOUNT_NAV = [
  { to: '/account', label: 'Panou' },
  { to: '/account/children', label: 'Copiii mei' },
  { to: '/account/enrollments', label: 'Înscrieri' },
  { to: '/account/attendance', label: 'Prezență' },
  { to: '/account/announcements', label: 'Anunțuri' },
] as const

const SECTION_PREFIXES: [string, string][] = [
  ['/account/children', '/account/children'],
  ['/account/child/', '/account/children'],
  ['/account/enrollments', '/account/enrollments'],
  ['/account/checkout', '/account/enrollments'],
  ['/account/competitions/', '/account/enrollments'],
  ['/account/attendance', '/account/attendance'],
  ['/account/announcements', '/account/announcements'],
  ['/account/locatie', '/account'],
]

export function activeAccountTab(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/account') return '/account'
  const match = SECTION_PREFIXES.find(
    ([prefix]) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
  )
  return match ? match[1] : null
}
