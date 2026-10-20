import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CalendarRange, ClipboardCheck, GraduationCap, LayoutDashboard, MapPin } from 'lucide-react'
import { vi } from 'vitest'

import { PortalLayout, type PortalNavItem } from './PortalLayout'
import { coachNavigation } from './navigation'

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
  const hrefs = [
    '/coach',
    '/coach/courses',
    '/coach/activities',
    '/coach/locations',
    '/coach/attendance',
  ]
  const links = labels.map((label) => screen.getByRole('link', { name: label }))
  links.forEach((link, i) => expect(link).toHaveAttribute('href', hrefs[i]))
  expect(screen.getAllByRole('link', { name: /motion timișoara/i })[0]).toHaveAttribute('href', '/')
  expect(screen.getByRole('button', { name: 'Deconectare' })).toBeInTheDocument()
})

test('profile card and topbar chip open the coach profile, outside the nav list', () => {
  renderLayout()
  const card = screen.getByRole('link', { name: /^Audit Antrenor/ })
  expect(card).toHaveAttribute('href', '/coach/profile')
  expect(card).toHaveTextContent('AA')
  const chip = screen.getByRole('link', { name: 'Audit' })
  expect(chip).toHaveAttribute('href', '/coach/profile')
  const nav = screen.getByRole('navigation')
  expect(nav).not.toHaveTextContent('Audit')
})

test('coach navigation groups offers and organisation under labelled groups', () => {
  render(
    <MemoryRouter initialEntries={['/coach']}>
      <Routes>
        <Route
          element={
            <PortalLayout nav={coachNavigation} roleLabel="Antrenor" profileTo="/coach/profile" />
          }
        >
          <Route path="/coach" element={<div>dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  const nav = screen.getByRole('navigation')
  expect(
    within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Panou', 'Cursuri', 'Activități', 'Tabere', 'Concursuri', 'Locații', 'Prezență', 'Anunțuri'])
  const offers = within(nav).getByRole('group', { name: 'Oferte' })
  expect(within(offers).getAllByRole('link')).toHaveLength(4)
  const organisation = within(nav).getByRole('group', { name: 'Organizare' })
  expect(
    within(organisation)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Locații', 'Prezență', 'Anunțuri'])
  expect(screen.getByRole('link', { name: 'Panou' })).toHaveAttribute('aria-current', 'page')
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
  expect(screen.getByRole('button', { name: 'Deconectare' }).className).toMatch(
    /focus-visible:outline-ring/,
  )
  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  const close = await screen.findByRole('button', { name: 'Închide' })
  expect(close.className).toMatch(/size-touch-target/)
  expect(screen.getAllByText('Antrenor').length).toBeGreaterThanOrEqual(2)
})
