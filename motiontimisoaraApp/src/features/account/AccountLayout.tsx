import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const NAV = [
  { to: '/account', label: 'Panou', end: true },
  { to: '/account/children', label: 'Copiii mei', end: false },
  { to: '/account/enrollments', label: 'Înscrieri', end: false },
  { to: '/account/attendance', label: 'Prezență', end: false },
]

export default function AccountLayout() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="border-border mb-8 flex gap-1 overflow-x-auto border-b">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
