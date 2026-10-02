import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { AppUser } from '@/api/auth'

import AdminProfilePage from './AdminProfilePage'

const state = vi.hoisted(() => ({
  user: null as AppUser | null,
  loading: false,
  profileError: null as string | null,
  refresh: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => state,
}))

vi.mock('@/api/auth', () => ({
  completeProfile: vi.fn(),
}))

const admin: AppUser = {
  id: 'admin-1',
  email: 'uiaudit.admin@motiontimisoara.test',
  name: 'Audit Admin',
  role: 'ADMIN',
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: false,
}

test('profilul admin are un singur h1 și câmpurile de nume și telefon', () => {
  state.user = admin
  state.loading = false
  render(
    <MemoryRouter>
      <AdminProfilePage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Profil administrator' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByLabelText('Nume')).toHaveValue('Audit Admin')
  expect(screen.getByLabelText('Telefon')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' }).className).toMatch(/min-h-11/)
  expect(screen.getByRole('button', { name: 'Salvează' }).className).toMatch(/h-11/)
})

test('cât user lipsește se vede skeleton, nu un ecran gol', () => {
  state.user = null
  state.loading = true
  const { container } = render(
    <MemoryRouter>
      <AdminProfilePage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('heading', { name: 'Profil administrator' })).not.toBeInTheDocument()
  expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
})
