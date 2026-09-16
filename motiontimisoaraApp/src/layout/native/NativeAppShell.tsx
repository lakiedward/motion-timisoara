import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import type { Role } from '@/api/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { activeDestination, bottomNavigation, nativeScreen } from './navigation-model'
import './native-shell.css'

export function NativeAppShell({ role, children }: { role: Role | null; children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const tabs = bottomNavigation(role)
  const active = activeDestination(location.pathname, role)
  const screen = nativeScreen(location.pathname, role)

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]')
    const original = viewport?.getAttribute('content')
    if (viewport && original && !original.includes('viewport-fit')) {
      viewport.setAttribute('content', `${original}, viewport-fit=cover`)
    }
    document.documentElement.classList.add('native-navigation')
    return () => {
      document.documentElement.classList.remove('native-navigation')
      if (viewport && original) viewport.setAttribute('content', original)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  const goBack = () => {
    if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1)
    } else if (screen.backTo) {
      navigate(screen.backTo, { replace: true })
    }
  }

  return (
    <div className="native-app-shell bg-background min-h-dvh">
      <header className="native-topbar bg-card fixed inset-x-0 top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          {screen.backTo ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-11"
              onClick={goBack}
              aria-label="Înapoi"
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          ) : (
            <Logo showText={false} />
          )}
          <p className="min-w-0 flex-1 truncate text-base font-semibold">{screen.title}</p>
        </div>
      </header>
      <main className="native-content">{children}</main>
      <nav
        aria-label="Navigare principală"
        className="native-bottom-bar bg-card fixed inset-x-0 bottom-0 z-40 border-t"
      >
        <div className="mx-auto flex min-h-16 max-w-2xl items-stretch px-1">
          {tabs.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active === item.to ? 'page' : undefined}
              className={cn(
                'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-primary',
                active === item.to
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full',
                  active === item.to && 'bg-primary/10',
                )}
              >
                <item.icon aria-hidden="true" className="size-5" />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
