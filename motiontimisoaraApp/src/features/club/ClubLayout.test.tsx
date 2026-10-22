import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import ClubLayout from './ClubLayout'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'club-1',
      email: 'uiaudit.club@motiontimisoara.test',
      name: 'Audit Club',
      role: 'CLUB',
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

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/club']}>
      <Routes>
        <Route element={<ClubLayout />}>
          <Route path="/club" element={<div>dashboard</div>} />
          <Route path="/club/profile" element={<div>profile</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('club chrome keeps the portal nav links and logo to public home', () => {
  renderLayout()
  const labels = [
    'Panou',
    'Profil club',
    'Cursuri',
    'Activități',
    'Tabere',
    'Concursuri',
    'Locații',
    'Antrenori',
    'Anunțuri',
  ]
  const hrefs = [
    '/club',
    '/club/profile',
    '/club/courses',
    '/club/activities',
    '/club/camps',
    '/club/competitions',
    '/club/locations',
    '/club/coaches',
    '/club/announcements',
  ]
  const nav = screen.getByRole('navigation', { name: 'Navigare club' })
  const links = within(nav).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual(labels)
  links.forEach((link, i) => expect(link).toHaveAttribute('href', hrefs[i]))
  expect(within(nav).getByRole('group', { name: 'Oferte' })).toHaveTextContent(
    'CursuriActivitățiTabereConcursuri',
  )
  expect(within(nav).getByRole('group', { name: 'Organizare' })).toHaveTextContent(
    'LocațiiAntrenoriAnunțuri',
  )
  expect(screen.getAllByRole('link', { name: /motion românia/i })[0]).toHaveAttribute('href', '/')
  expect(screen.getByRole('button', { name: 'Deconectare' })).toBeInTheDocument()
})

test('first name is a profile control, not a seventh nav item', () => {
  renderLayout()
  const profileLinks = screen.getAllByRole('link', { name: 'Audit' })
  expect(profileLinks.length).toBeGreaterThanOrEqual(1)
  for (const link of profileLinks) {
    expect(link).toHaveAttribute('href', '/club/profile')
  }
  const nav = screen.getByRole('navigation')
  expect(nav).not.toHaveTextContent('Audit')
  expect(screen.getByRole('link', { name: 'Profil club' })).toHaveAttribute('href', '/club/profile')
})

test('menu, logout and close meet the 44px tap class; CLUB label is in chrome', async () => {
  const user = userEvent.setup()
  renderLayout()
  expect(screen.getByRole('button', { name: 'Meniu' }).className).toMatch(/size-11/)
  expect(screen.getByRole('button', { name: 'Deconectare' }).className).toMatch(/min-h-11/)
  expect(screen.getByRole('button', { name: 'Deconectare' }).className).toMatch(/focus-visible:outline-ring/)
  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  const close = await screen.findByRole('button', { name: 'Închide' })
  expect(close.className).toMatch(/size-touch-target/)
  expect(screen.getAllByText('Club').length).toBeGreaterThanOrEqual(2)
})
