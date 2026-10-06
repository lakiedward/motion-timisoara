import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { PortalLayout } from './PortalLayout'
import { adminNavigation, clubNavigation, coachNavigation, type PortalNavItem } from './navigation'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<{ error: { message: string } | null }>>(),
  nativeNavigation: vi.fn(() => false),
  role: 'ADMIN',
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { name: 'Audit Admin', role: mocks.role } }),
}))
vi.mock('@/api/auth', () => ({ signOut: mocks.signOut }))
vi.mock('@/layout/native/native-runtime', () => ({
  usesNativeNavigation: mocks.nativeNavigation,
}))

function CurrentPage() {
  return <div data-testid="current-route">{useLocation().pathname}</div>
}

function renderPortal({
  path = '/admin',
  nav = adminNavigation,
  roleLabel = 'Administrare',
  profileTo = '/admin/profile',
}: {
  path?: string
  nav?: PortalNavItem[]
  roleLabel?: string
  profileTo?: string
} = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PortalLayout nav={nav} roleLabel={roleLabel} profileTo={profileTo} />}>
          <Route path="/admin/*" element={<CurrentPage />} />
          <Route path="/coach/*" element={<CurrentPage />} />
          <Route path="/club/*" element={<CurrentPage />} />
        </Route>
        <Route path="/" element={<div>Pagina publică</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.role = 'ADMIN'
  mocks.nativeNavigation.mockReturnValue(false)
  mocks.signOut.mockReset().mockResolvedValue({ error: null })
})

test('admin navigation keeps the eight accepted destinations in order', () => {
  renderPortal()
  const links = within(screen.getByRole('navigation')).getAllByRole('link')
  expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['Panou', '/admin'],
    ['Utilizatori', '/admin/users'],
    ['Cluburi', '/admin/clubs'],
    ['Cursuri', '/admin/courses'],
    ['Tabere', '/admin/camps'],
    ['Concursuri', '/admin/competitions'],
    ['Sporturi', '/admin/sports'],
    ['Coduri invitație', '/admin/codes'],
  ])
})

test.each([
  ['/admin', 'Panou'],
  ['/admin/users/audit', 'Utilizatori'],
  ['/admin/clubs/audit', 'Cluburi'],
  ['/admin/courses/audit', 'Cursuri'],
  ['/admin/camps/audit', 'Tabere'],
  ['/admin/competitions/audit', 'Concursuri'],
  ['/admin/sports', 'Sporturi'],
  ['/admin/codes', 'Coduri invitație'],
])('route %s highlights only %s', (path, label) => {
  renderPortal({ path })
  const links = within(screen.getByRole('navigation')).getAllByRole('link')
  expect(links.filter((link) => link.getAttribute('aria-current') === 'page')).toEqual([
    screen.getByRole('link', { name: label }),
  ])
})

test('admin profile keeps its route without activating the dashboard', async () => {
  const user = userEvent.setup()
  renderPortal()
  await user.click(screen.getAllByRole('link', { name: 'Audit' })[0])
  expect(screen.getByTestId('current-route')).toHaveTextContent('/admin/profile')
  for (const link of within(screen.getByRole('navigation')).getAllByRole('link')) {
    expect(link).not.toHaveAttribute('aria-current')
  }
})

test('admin drawer announces its purpose and choosing a destination closes it', async () => {
  const user = userEvent.setup()
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  renderPortal()
  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  const dialog = screen.getByRole('dialog', { name: 'Meniu administrare — Motion Timișoara' })
  expect(dialog.className).toContain('[&>button]:top-20')
  expect(dialog).toHaveAccessibleDescription(
    'Navighează în secțiunea administrare, deschide profilul sau deconectează-te.',
  )
  await user.click(within(dialog).getByRole('link', { name: 'Sporturi' }))
  expect(screen.getByTestId('current-route')).toHaveTextContent('/admin/sports')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(warning.mock.calls.flat().join(' ')).not.toMatch(/Missing.*Description|aria-describedby/)
  warning.mockRestore()
})

test('drawer traps focus in the accepted order and Escape restores the trigger', async () => {
  const user = userEvent.setup()
  renderPortal()
  const trigger = screen.getByRole('button', { name: 'Meniu' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog')
  const links = within(dialog).getAllByRole('link')
  const logout = within(dialog).getByRole('button', { name: 'Deconectare' })
  const close = within(dialog).getByRole('button', { name: 'Închide' })
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/',
    ...adminNavigation.map((item) => item.to),
    '/admin/profile',
  ])
  await waitFor(() => expect(links[0]).toHaveFocus())
  for (const control of [...links.slice(1), logout, close, links[0]]) {
    await user.tab()
    expect(control).toHaveFocus()
  }
  await user.tab({ shift: true })
  expect(close).toHaveFocus()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(screen.getByTestId('current-route')).toHaveTextContent('/admin')
})

test('close control restores focus without changing the route', async () => {
  const user = userEvent.setup()
  renderPortal({ path: '/admin/codes' })
  const trigger = screen.getByRole('button', { name: 'Meniu' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Închide' }))
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(screen.getByTestId('current-route')).toHaveTextContent('/admin/codes')
})

test('logout waits for its real result, disables repeated requests and navigates on success', async () => {
  const user = userEvent.setup()
  let resolveLogout!: (result: { error: null }) => void
  mocks.signOut.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveLogout = resolve
      }),
  )
  renderPortal()
  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Deconectare' }))
  const pending = within(dialog).getByRole('button', { name: 'Se deconectează…' })
  expect(pending).toBeDisabled()
  expect(pending).toHaveAttribute('aria-busy', 'true')
  await user.click(pending)
  expect(mocks.signOut).toHaveBeenCalledTimes(1)
  expect(dialog).toBeInTheDocument()
  expect(screen.getByTestId('current-route')).toHaveTextContent('/admin')
  await act(async () => resolveLogout({ error: null }))
  expect(screen.getByText('Pagina publică')).toBeInTheDocument()
})

describe.each(['returned error', 'rejected promise'])('logout %s', (failure) => {
  test('keeps the current page and drawer, then permits a successful retry', async () => {
    const user = userEvent.setup()
    if (failure === 'returned error')
      mocks.signOut.mockResolvedValueOnce({ error: { message: 'audit failure' } })
    else mocks.signOut.mockRejectedValueOnce(new Error('audit failure'))
    renderPortal({ path: '/admin/sports' })
    await user.click(screen.getByRole('button', { name: 'Meniu' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Deconectare' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Nu te-am putut deconecta. Încearcă din nou.',
    )
    expect(screen.getByTestId('current-route')).toHaveTextContent('/admin/sports')
    const retry = within(dialog).getByRole('button', { name: 'Deconectare' })
    expect(retry).not.toBeDisabled()
    await user.click(retry)
    expect(screen.getByText('Pagina publică')).toBeInTheDocument()
    expect(mocks.signOut).toHaveBeenCalledTimes(2)
  })
})

test.each([
  ['COACH', coachNavigation, '/coach', 'Antrenor'],
  ['CLUB', clubNavigation, '/club', 'Club'],
] as const)(
  '%s drawer keeps its own destinations and focus behavior',
  async (role, nav, path, roleLabel) => {
    mocks.role = role
    const user = userEvent.setup()
    renderPortal({ path, nav, roleLabel, profileTo: `${path}/profile` })
    await user.click(screen.getByRole('button', { name: 'Meniu' }))
    const dialog = screen.getByRole('dialog', {
      name: `Meniu ${roleLabel.toLowerCase()} — Motion Timișoara`,
    })
    const navigation = within(dialog).getByRole('navigation')
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(nav.map((item) => item.to))
    expect(dialog.querySelector('a[href^="/admin"]')).toBeNull()
    await user.click(within(navigation).getAllByRole('link')[1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('current-route')).toHaveTextContent(nav[1].to)
    const trigger = screen.getByRole('button', { name: 'Meniu' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
)

test('native navigation branch renders the page without web sidebar or drawer', () => {
  mocks.nativeNavigation.mockReturnValue(true)
  renderPortal()
  expect(screen.getByTestId('current-route')).toHaveTextContent('/admin')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Meniu' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Deconectare' })).not.toBeInTheDocument()
})
