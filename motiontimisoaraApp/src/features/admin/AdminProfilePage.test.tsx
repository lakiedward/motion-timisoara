import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import AdminProfilePage from './AdminProfilePage'

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
  completeProfile: vi.fn(),
}))

test('profilul admin are un singur h1 și câmpurile de nume și telefon', () => {
  render(
    <MemoryRouter>
      <AdminProfilePage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByLabelText('Nume')).toHaveValue('Audit Admin')
  expect(screen.getByLabelText('Telefon')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument()
})
