import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import SignupChoicePage from './SignupChoicePage'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
type AuthState = ReturnType<typeof useAuth>

function authState(user: AuthState['user']): AuthState {
  return { user, loading: false, profileError: null, refresh: vi.fn() } as AuthState
}

function renderSignup(entry = '/signup') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/signup" element={<SignupChoicePage />} />
        <Route path="/account" element={<div>contul părintelui</div>} />
        <Route path="/coach" element={<div>panoul antrenorului</div>} />
        <Route path="/club" element={<div>panoul clubului</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseAuth.mockReturnValue(authState(null))
})

test('every role card and the login link carry the returnUrl forward', () => {
  renderSignup('/signup?returnUrl=%2Fcursuri%2F42')

  expect(screen.getByRole('link', { name: /^Părinte/ })).toHaveAttribute(
    'href',
    '/register?returnUrl=%2Fcursuri%2F42',
  )
  expect(screen.getByRole('link', { name: /^Antrenor/ })).toHaveAttribute(
    'href',
    '/register-coach?returnUrl=%2Fcursuri%2F42',
  )
  expect(screen.getByRole('link', { name: /^Club/ })).toHaveAttribute(
    'href',
    '/register-club?returnUrl=%2Fcursuri%2F42',
  )
  expect(screen.getByRole('link', { name: 'Autentifică-te' })).toHaveAttribute(
    'href',
    '/login?returnUrl=%2Fcursuri%2F42',
  )
})

test('the conditional role cards state their access condition before the form', () => {
  renderSignup()

  expect(screen.getByRole('link', { name: /^Antrenor/ })).toHaveTextContent('Necesită cod de invitație')
  expect(screen.getByRole('link', { name: /^Club/ })).toHaveTextContent(
    'Necesită aprobarea unui administrator',
  )
})

test.each([
  ['PARENT', 'contul părintelui'],
  ['COACH', 'panoul antrenorului'],
  ['CLUB', 'panoul clubului'],
] as const)('a signed-in %s skips the choice and lands on their dashboard', (role, landing) => {
  mockedUseAuth.mockReturnValue(authState({ id: 'u1', role } as AuthState['user']))
  renderSignup()

  expect(screen.getByText(landing)).toBeInTheDocument()
  expect(screen.queryByText('Alege tipul de cont')).not.toBeInTheDocument()
})
