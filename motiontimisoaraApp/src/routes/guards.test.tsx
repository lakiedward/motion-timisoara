import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'

import { RequireRole } from './guards'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

function LoginStub() {
  const location = useLocation()
  return <div>Bine ai revenit {location.search}</div>
}

function renderCoachGate() {
  return render(
    <MemoryRouter initialEntries={['/coach']}>
      <Routes>
        <Route element={<RequireRole roles={['COACH']} />}>
          <Route path="/coach" element={<div>panou</div>} />
        </Route>
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderAdminGate() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>pagina principală</div>} />
        <Route path="/login" element={<LoginStub />} />
        <Route element={<RequireRole roles={['ADMIN']} />}>
          <Route path="/admin" element={<div>dashboard admin</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('profile load failure stays on /coach with a visible error, not login', () => {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    profileError: 'Nu am putut încărca profilul.',
    refresh: vi.fn(),
  })
  renderCoachGate()
  expect(screen.getByText('Nu am putut încărca profilul.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText('Bine ai revenit')).not.toBeInTheDocument()
  expect(screen.queryByText('panou')).not.toBeInTheDocument()
})

test('loading session shows a spinner without coach chrome', () => {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: true,
    profileError: null,
    refresh: vi.fn(),
  })
  const { container } = renderCoachGate()
  expect(container.querySelector('.animate-spin')).toBeTruthy()
  expect(screen.queryByText('Panou')).not.toBeInTheDocument()
  expect(screen.queryByText('Deconectare')).not.toBeInTheDocument()
  expect(screen.queryByText('panou')).not.toBeInTheDocument()
})

test('fără sesiune, /admin duce la login cu revenire la /admin', () => {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderAdminGate()
  expect(screen.getByText('Bine ai revenit ?returnUrl=%2Fadmin')).toBeInTheDocument()
  expect(screen.queryByText('dashboard admin')).not.toBeInTheDocument()
})

test('un non-admin pe /admin e trimis pe pagina principală', () => {
  mockedUseAuth.mockReturnValue({
    user: {
      id: 'parent-1',
      email: 'uiaudit.parent@motiontimisoara.test',
      name: 'Audit Părinte',
      role: 'PARENT',
      phone: null,
      avatarUrl: null,
      needsProfileCompletion: false,
    },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderAdminGate()
  expect(screen.getByText('pagina principală')).toBeInTheDocument()
  expect(screen.queryByText('dashboard admin')).not.toBeInTheDocument()
})

test('un admin vede /admin', () => {
  mockedUseAuth.mockReturnValue({
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
  })
  renderAdminGate()
  expect(screen.getByText('dashboard admin')).toBeInTheDocument()
})
