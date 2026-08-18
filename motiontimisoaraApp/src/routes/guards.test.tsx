import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import { RequireRole } from './guards'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

function renderCoachGate() {
  return render(
    <MemoryRouter initialEntries={['/coach']}>
      <Routes>
        <Route element={<RequireRole roles={['COACH']} />}>
          <Route path="/coach" element={<div>panou</div>} />
        </Route>
        <Route path="/login" element={<div>Bine ai revenit</div>} />
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
