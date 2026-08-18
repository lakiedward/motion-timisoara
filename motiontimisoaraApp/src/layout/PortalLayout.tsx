import * as React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth-context'
import { signOut } from '@/api/auth'
import { cn } from '@/lib/utils'

export interface PortalNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

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
)

function firstNameOf(name: string | undefined) {
  const first = name?.trim().split(/\s+/)[0]
  return first || null
}

function NavList({ nav, onNavigate }: { nav: PortalNavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={navItemClass}>
          <item.icon className="size-4.5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function RoleLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground px-4 pt-4 pb-1 text-xs font-bold tracking-wider uppercase">{children}</p>
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
        'flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-sm font-medium',
        'hover:bg-secondary focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary',
        className,
      )}
    >
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
  const firstName = firstNameOf(user?.name)

  const onLogout = async () => {
    await signOut()
    navigate('/')
  }

  const closeSheet = () => setOpen(false)

  return (
    <div className="bg-muted/30 min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="bg-card fixed inset-y-0 left-0 hidden w-64 flex-col border-r lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <RoleLabel>{roleLabel}</RoleLabel>
          <NavList nav={nav} />
        </div>
        <div className="border-t p-3">
          {profileTo && firstName ? <ProfileNameLink to={profileTo} name={firstName} className="mb-1" /> : null}
          <button type="button" className={logoutClassName} onClick={onLogout}>
            <LogOut className="size-4" /> Deconectare
          </button>
        </div>
      </aside>

      {/* Topbar (mobile) */}
      <header className="bg-card sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Meniu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 gap-0 p-0">
            <SheetHeader className="border-b">
              <SheetTitle className="text-left">
                <Link to="/" onClick={closeSheet}>
                  <Logo />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <RoleLabel>{roleLabel}</RoleLabel>
              <NavList nav={nav} onNavigate={closeSheet} />
            </div>
            <div className="mt-auto border-t p-3">
              {profileTo && firstName ? (
                <ProfileNameLink to={profileTo} name={firstName} onNavigate={closeSheet} className="mb-1" />
              ) : null}
              <SheetClose asChild>
                <button type="button" className={logoutClassName} onClick={onLogout}>
                  <LogOut className="size-4" /> Deconectare
                </button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/">
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
