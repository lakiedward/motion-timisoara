import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CalendarRange, ClipboardCheck, GraduationCap, LayoutDashboard, MapPin } from 'lucide-react'
import { vi } from 'vitest'

import { PortalLayout, type PortalNavItem } from './PortalLayout'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'coach-1',
      email: 'uiaudit.coach@motiontimisoara.test',
      name: 'Audit Antrenor',
      role: 'COACH',
      phone: null,
      avatarUrl: null,
      needsProfileCompletion: false,
    },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/api/auth', () => ({
  signOut: vi.fn(),
}))

const NAV: PortalNavItem[] = [
  { to: '/coach', label: 'Panou', icon: LayoutDashboard, end: true },
  { to: '/coach/courses', label: 'Cursuri', icon: GraduationCap },
  { to: '/coach/activities', label: 'Activități', icon: CalendarRange },
  { to: '/coach/locations', label: 'Locații', icon: MapPin },
  { to: '/coach/attendance', label: 'Prezență', icon: ClipboardCheck },
]

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/coach']}>
      <Routes>
        <Route element={<PortalLayout nav={NAV} roleLabel="Antrenor" profileTo="/coach/profile" />}>
          <Route path="/coach" element={<div>dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('coach chrome keeps the five nav links in order and logo to public home', () => {
  renderLayout()
  const labels = ['Panou', 'Cursuri', 'Activități', 'Locații', 'Prezență']
  const hrefs = ['/coach', '/coach/courses', '/coach/activities', '/coach/locations', '/coach/attendance']
  const links = labels.map((label) => screen.getByRole('link', { name: label }))
  links.forEach((link, i) => expect(link).toHaveAttribute('href', hrefs[i]))
  expect(screen.getAllByRole('link', { name: /motion timișoara/i })[0]).toHaveAttribute('href', '/')
  expect(screen.getByRole('button', { name: 'Deconectare' })).toBeInTheDocument()
})

test('first name is a profile control, not a sixth nav item', () => {
  renderLayout()
  const profileLinks = screen.getAllByRole('link', { name: 'Audit' })
  expect(profileLinks.length).toBeGreaterThanOrEqual(1)
  for (const link of profileLinks) {
    expect(link).toHaveAttribute('href', '/coach/profile')
  }
  const nav = screen.getByRole('navigation')
  expect(nav).not.toHaveTextContent('Audit')
})

test('inactive nav items use a visible gray hover, not the active blue fill', () => {
  renderLayout()
  const panou = screen.getByRole('link', { name: 'Panou' })
  const cursuri = screen.getByRole('link', { name: 'Cursuri' })
  expect(panou.className).toMatch(/bg-primary\/10/)
  expect(cursuri.className).toMatch(/hover:bg-secondary/)
  expect(cursuri.className).toMatch(/\[&:hover\]:bg-secondary/)
  expect(cursuri.className).not.toMatch(/hover:bg-accent/)
  expect(cursuri.className).toMatch(/min-h-11/)
  expect(cursuri.className).toMatch(/cursor-pointer/)
})

test('menu button, logout and close control meet the 44px tap class', async () => {
  const user = userEvent.setup()
  renderLayout()
  expect(screen.getByRole('button', { name: 'Meniu' }).className).toMatch(/size-11/)
  expect(screen.getByRole('button', { name: 'Deconectare' }).className).toMatch(/min-h-11/)
  expect(screen.getByRole('button', { name: 'Deconectare' }).className).toMatch(/outline-primary/)
  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  const close = await screen.findByRole('button', { name: 'Închide' })
  expect(close.className).toMatch(/size-11/)
  expect(screen.getAllByText('Antrenor').length).toBeGreaterThanOrEqual(2)
})
