import * as React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'

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
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-secondary hover:text-foreground [&:hover]:bg-secondary [&:hover]:text-foreground',
  )

const logoutClassName = cn(
  'text-destructive flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium',
  'hover:bg-secondary [&:hover]:bg-secondary',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'disabled:cursor-wait disabled:opacity-60',
)

const logoLinkClassName = cn(
  'inline-flex min-h-11 min-w-11 items-center rounded-md',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
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

function navSections(nav: PortalNavItem[]) {
  const sections: { group?: string; items: PortalNavItem[] }[] = []
  for (const item of nav) {
    const last = sections[sections.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else sections.push({ group: item.group, items: [item] })
  }
  return sections
}

function NavList({
  nav,
  label,
  onNavigate,
}: {
  nav: PortalNavItem[]
  label: string
  onNavigate?: () => void
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-1 p-3">
      {navSections(nav).map((section) => (
        <div
          key={section.group ?? section.items[0].to}
          role={section.group ? 'group' : undefined}
          aria-label={section.group}
          className="flex flex-col gap-1 [&+&]:mt-3"
        >
          {section.group ? (
            <p aria-hidden="true" className="text-muted-foreground px-3 pb-1 text-xs font-medium">
              {section.group}
            </p>
          ) : null}
          {section.items.map((item) => (
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
        </div>
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

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ProfileCard({
  to,
  name,
  onNavigate,
}: {
  to: string
  name: string
  onNavigate?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'bg-muted mb-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl p-3 transition-colors',
        'hover:bg-secondary [&:hover]:bg-secondary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <span
        aria-hidden="true"
        className="bg-primary grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="text-muted-foreground block truncate text-xs">Profilul meu</span>
      </span>
    </Link>
  )
}

function ProfileChip({ to, name }: { to: string; name: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'ml-auto flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium transition-colors',
        'hover:bg-secondary [&:hover]:bg-secondary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <span
        aria-hidden="true"
        className="bg-primary grid size-8 place-items-center rounded-full text-xs font-bold text-white"
      >
        {initialsOf(name)}
      </span>
      {firstNameOf(name)}
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
  const fullName = user?.name.trim() || null
  const firstName = firstNameOf(user?.name)
  const navLabel = `Navigare ${roleLabel.toLowerCase()}`

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
          <NavList nav={nav} label={navLabel} />
        </div>
        <div className="shrink-0 border-t p-3">
          {profileTo && fullName ? <ProfileCard to={profileTo} name={fullName} /> : null}
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
                Meniu {roleLabel.toLowerCase()} — Motion România
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
              <NavList nav={nav} label={navLabel} onNavigate={closeSheet} />
            </div>
            <div className="mt-auto shrink-0 border-t p-3">
              {profileTo && fullName ? (
                <ProfileCard to={profileTo} name={fullName} onNavigate={closeSheet} />
              ) : null}
              <LogoutControl pending={loggingOut} error={logoutError} onLogout={onLogout} />
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/" className={logoLinkClassName}>
          <Logo />
        </Link>
        {profileTo && fullName ? (
          <ProfileChip to={profileTo} name={fullName} />
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
