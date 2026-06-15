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

function NavList({ nav, onNavigate }: { nav: PortalNavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )
          }
        >
          <item.icon className="size-4.5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function PortalLayout({ nav, roleLabel }: { nav: PortalNavItem[]; roleLabel: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  const onLogout = async () => {
    await signOut()
    navigate('/')
  }

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
          <p className="text-muted-foreground px-4 pt-4 pb-1 text-xs font-bold tracking-wider uppercase">
            {roleLabel}
          </p>
          <NavList nav={nav} />
        </div>
        <div className="border-t p-3">
          <Button variant="ghost" className="text-destructive w-full justify-start" onClick={onLogout}>
            <LogOut /> Deconectare
          </Button>
        </div>
      </aside>

      {/* Topbar (mobile) */}
      <header className="bg-card sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Meniu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b">
              <SheetTitle className="text-left">
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <NavList nav={nav} onNavigate={() => setOpen(false)} />
            <div className="mt-auto border-t p-3">
              <SheetClose asChild>
                <Button variant="ghost" className="text-destructive w-full justify-start" onClick={onLogout}>
                  <LogOut /> Deconectare
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/">
          <Logo />
        </Link>
        <span className="ml-auto text-sm font-medium">{user?.name?.split(' ')[0]}</span>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
