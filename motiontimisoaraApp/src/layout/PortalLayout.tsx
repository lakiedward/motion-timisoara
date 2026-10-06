import * as React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, UserRound } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth-context'
import { signOut } from '@/api/auth'
import { cn } from '@/lib/utils'
import type { PortalNavItem } from '@/layout/navigation'
import { usesNativeNavigation } from '@/layout/native/native-runtime'

export type { PortalNavItem } from '@/layout/navigation'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-secondary hover:text-foreground [&:hover]:bg-secondary [&:hover]:text-foreground',
  )

const logoutClassName = cn(
  'text-destructive flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium',
  'hover:bg-secondary [&:hover]:bg-secondary',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary',
  'disabled:cursor-wait disabled:opacity-60',
)

const logoLinkClassName = cn(
  'inline-flex min-h-11 min-w-11 items-center rounded-md',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary',
)

function firstNameOf(name: string | undefined) {
  const first = name?.trim().split(/\s+/)[0]
  return first || null
}

function LogoutControl({
  pending,
  error,
  onLogout,
}: {
  pending: boolean
  error: string | null
  onLogout: () => Promise<void>
}) {
  return (
    <>
      {error && (
        <p role="alert" className="text-destructive mb-2 px-3 text-sm">
          {error}
        </p>
      )}
      <button
        type="button"
        className={logoutClassName}
        onClick={onLogout}
        disabled={pending}
        aria-busy={pending}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {pending ? 'Se deconectează…' : 'Deconectare'}
      </button>
    </>
  )
}

function NavList({ nav, onNavigate }: { nav: PortalNavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={navItemClass}
        >
          <item.icon className="size-4.5" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function RoleLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground px-4 pt-4 pb-1 text-xs font-bold tracking-wider uppercase">
      {children}
    </p>
  )
}

function ProfileNameLink({
  to,
  name,
  onNavigate,
  className,
}: {
  to: string
  name: string
  onNavigate?: () => void
  className?: string
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'text-primary flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium underline-offset-4',
        'hover:bg-secondary hover:underline [&:hover]:bg-secondary [&:hover]:underline',
        'outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className,
      )}
    >
      <UserRound className="size-4 shrink-0" aria-hidden="true" />
      {name}
    </Link>
  )
}

export function PortalLayout({
  nav,
  roleLabel,
  profileTo,
}: {
  nav: PortalNavItem[]
  roleLabel: string
  profileTo?: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [logoutError, setLogoutError] = React.useState<string | null>(null)
  const logoutPending = React.useRef(false)
  const drawerLogo = React.useRef<HTMLAnchorElement>(null)
  const firstName = firstNameOf(user?.name)

  const onLogout = async () => {
    if (logoutPending.current) return
    logoutPending.current = true
    setLoggingOut(true)
    setLogoutError(null)
    try {
      const result = await signOut()
      if (result.error) throw result.error
      setOpen(false)
      navigate('/')
    } catch {
      setLogoutError('Nu te-am putut deconecta. Încearcă din nou.')
    } finally {
      logoutPending.current = false
      setLoggingOut(false)
    }
  }

  const closeSheet = () => setOpen(false)

  if (usesNativeNavigation()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="bg-card fixed inset-y-0 left-0 hidden w-64 flex-col border-r lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Link to="/" className={logoLinkClassName}>
            <Logo />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RoleLabel>{roleLabel}</RoleLabel>
          <NavList nav={nav} />
        </div>
        <div className="shrink-0 border-t p-3">
          {profileTo && firstName ? (
            <ProfileNameLink to={profileTo} name={firstName} className="mb-1" />
          ) : null}
          <LogoutControl pending={loggingOut} error={logoutError} onLogout={onLogout} />
        </div>
      </aside>

      <header className="bg-card sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Meniu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 gap-0 p-0 [&>button]:top-20"
            onOpenAutoFocus={(event) => {
              if (drawerLogo.current) {
                event.preventDefault()
                drawerLogo.current.focus()
              }
            }}
          >
            <SheetHeader className="shrink-0 border-b">
              <SheetTitle className="sr-only">
                Meniu {roleLabel.toLowerCase()} — Motion Timișoara
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navighează în secțiunea {roleLabel.toLowerCase()}, deschide profilul sau
                deconectează-te.
              </SheetDescription>
              <Link ref={drawerLogo} to="/" onClick={closeSheet} className={logoLinkClassName}>
                <Logo />
              </Link>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <RoleLabel>{roleLabel}</RoleLabel>
              <NavList nav={nav} onNavigate={closeSheet} />
            </div>
            <div className="mt-auto shrink-0 border-t p-3">
              {profileTo && firstName ? (
                <ProfileNameLink
                  to={profileTo}
                  name={firstName}
                  onNavigate={closeSheet}
                  className="mb-1"
                />
              ) : null}
              <LogoutControl pending={loggingOut} error={logoutError} onLogout={onLogout} />
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/" className={logoLinkClassName}>
          <Logo />
        </Link>
        {profileTo && firstName ? (
          <ProfileNameLink to={profileTo} name={firstName} className="ml-auto px-2" />
        ) : (
          <span className="ml-auto text-sm font-medium">{firstName}</span>
        )}
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
