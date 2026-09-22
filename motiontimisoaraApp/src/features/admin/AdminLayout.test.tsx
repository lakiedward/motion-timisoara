import { render, screen } from '@testing-library/react'
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
          <Route path="/admin/camps/new" element={<div>tabără nouă</div>} />
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
})
