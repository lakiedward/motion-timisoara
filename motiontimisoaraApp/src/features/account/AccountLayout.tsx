import { Link, Outlet, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { usesNativeNavigation } from '@/layout/native/native-runtime'
import { ACCOUNT_NAV, activeAccountTab } from './account-nav'

function AccountTabs() {
  const { pathname } = useLocation()
  const active = activeAccountTab(pathname)
  return (
    <nav aria-label="Contul meu" className="border-border mb-8 border-b">
      <div className="-mb-px grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">
        {ACCOUNT_NAV.map((n) => {
          const current = n.to === active
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'min-h-touch-target flex items-center justify-center rounded-t-md border-b-2 px-2 py-2 text-center text-sm font-medium transition-colors focus-visible:-outline-offset-2 sm:px-4',
                current
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {n.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function AccountLayout() {
  if (usesNativeNavigation()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <AccountTabs />
      <Outlet />
    </div>
  )
}
