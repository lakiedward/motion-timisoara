import * as React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, UserRound } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth-context'
import { signOut, type Role } from '@/api/auth'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/cursuri', label: 'Cursuri' },
  { to: '/activitati', label: 'Activități' },
  { to: '/tabere', label: 'Tabere' },
  { to: '/harta', label: 'Hartă' },
  { to: '/antrenori', label: 'Antrenori' },
  { to: '/cluburi', label: 'Cluburi' },
  { to: '/despre', label: 'Despre' },
  { to: '/contact', label: 'Contact' },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Role-specific dashboard links shown in the account menu. */
function roleLinks(role: Role) {
  const links: { to: string; label: string }[] = [{ to: '/account', label: 'Contul meu' }]
  if (role === 'COACH' || role === 'ADMIN') links.push({ to: '/coach', label: 'Panou antrenor' })
  if (role === 'CLUB') links.push({ to: '/club', label: 'Panou club' })
  if (role === 'ADMIN') links.push({ to: '/admin', label: 'Administrare' })
  return links
}

export function Header() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = React.useState(
    () => typeof window !== 'undefined' && window.scrollY > 8
  )
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onLogout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-colors',
        scrolled
          ? 'bg-background/85 supports-[backdrop-filter]:bg-background/70 border-border backdrop-blur'
          : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" aria-label="Acasă" className="shrink-0">
          <Logo />
        </Link>

        <nav className="ml-2 hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop auth area */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hover:bg-accent flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 transition-colors">
                  <span className="bg-primary grid size-8 place-items-center rounded-full text-xs font-bold text-white">
                    {initials(user.name)}
                  </span>
                  <span className="text-sm font-medium">{user.name.split(' ')[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-muted-foreground truncate text-xs font-normal">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roleLinks(user.role).map((l) => (
                  <DropdownMenuItem key={l.to} asChild>
                    <Link to={l.to}>
                      {l.to === '/account' ? <UserRound /> : <LayoutDashboard />}
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onLogout}>
                  <LogOut /> Deconectare
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Autentificare</Link>
              </Button>
              <Link
                to="/signup"
                className="inline-flex items-center rounded-full px-5 py-2 text-sm font-bold text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--gradient-primary)' }}
              >
                Înregistrare
              </Link>
            </>
          )}
        </div>

        {/* Mobile drawer */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto lg:hidden" aria-label="Meniu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="text-left">
                <Logo />
              </SheetTitle>
            </SheetHeader>
            {user && (
              <div className="bg-muted mx-4 flex items-center gap-3 rounded-2xl p-3">
                <span className="bg-primary grid size-9 place-items-center rounded-full text-xs font-bold text-white">
                  {initials(user.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{user.name}</div>
                  <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                </div>
              </div>
            )}
            <nav className="flex flex-col gap-1 px-2">
              {NAV.map((item) => (
                <SheetClose asChild key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'hover:bg-accent rounded-md px-3 py-2.5 text-sm font-medium',
                        isActive ? 'text-primary' : 'text-foreground'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 p-4">
              {user ? (
                <>
                  {roleLinks(user.role).map((l) => (
                    <SheetClose asChild key={l.to}>
                      <Button variant="outline" asChild>
                        <Link to={l.to}>{l.label}</Link>
                      </Button>
                    </SheetClose>
                  ))}
                  <Button variant="ghost" className="text-destructive" onClick={onLogout}>
                    <LogOut /> Deconectare
                  </Button>
                </>
              ) : (
                <>
                  <SheetClose asChild>
                    <Button variant="outline" asChild>
                      <Link to="/login">Autentificare</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      to="/signup"
                      className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)]"
                      style={{ background: 'var(--gradient-primary)' }}
                    >
                      Înregistrare
                    </Link>
                  </SheetClose>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
