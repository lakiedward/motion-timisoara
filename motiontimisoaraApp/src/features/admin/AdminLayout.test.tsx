import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import AdminLayout from './AdminLayout'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      email: 'uiaudit.admin@motiontimisoara.test',
      name: 'Audit Admin',
      role: 'ADMIN',
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

function renderLayout(ruta = '/admin') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<div>dashboard</div>} />
          <Route path="/admin/profile" element={<div>profil</div>} />
          <Route path="/admin/camps/new" element={<div>tabără nouă</div>} />
          <Route path="/admin/courses" element={<div>cursuri</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('admin chrome include Tabere către formularul de tabără', () => {
  renderLayout()
  expect(screen.getByRole('link', { name: 'Tabere' })).toHaveAttribute('href', '/admin/camps')
  expect(screen.getByRole('link', { name: 'Concursuri' })).toHaveAttribute(
    'href',
    '/admin/competitions',
  )
  expect(screen.getByRole('link', { name: 'Cursuri' })).toHaveAttribute('href', '/admin/courses')
  expect(screen.getByRole('link', { name: 'Panou' })).toHaveAttribute('href', '/admin')
})

test('prenumele din dreapta e link către profil, nu un item de navigare', () => {
  renderLayout()
  const profileLinks = screen.getAllByRole('link', { name: 'Audit' })
  expect(profileLinks.length).toBeGreaterThanOrEqual(1)
  for (const link of profileLinks) {
    expect(link).toHaveAttribute('href', '/admin/profile')
  }
  const nav = screen.getByRole('navigation')
  expect(nav).not.toHaveTextContent('Audit')
})

test('sub 1024px hamburgerul are 44px și meniul se închide la navigare', async () => {
  const user = userEvent.setup()
  renderLayout()
  expect(screen.getByRole('button', { name: 'Meniu' }).className).toMatch(/size-11/)
  await user.click(screen.getByRole('button', { name: 'Meniu' }))
  expect(await screen.findByRole('button', { name: 'Închide' })).toBeInTheDocument()
  const dinMeniu = screen
    .getAllByRole('link', { name: 'Cursuri' })
    .find((el) => el.closest('[data-slot="sheet-content"]'))
  expect(dinMeniu).toBeTruthy()
  await user.click(dinMeniu!)
  expect(screen.queryByRole('button', { name: 'Închide' })).not.toBeInTheDocument()
  expect(screen.getByText('cursuri')).toBeInTheDocument()
})
