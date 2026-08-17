import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: null, loading: false, refresh: async () => {} }),
}))

import SignupChoicePage from './SignupChoicePage'

function renderSignup(path = '/signup') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SignupChoicePage />
    </MemoryRouter>,
  )
}

test('Club card says the club stays inactive until an administrator approves it', () => {
  renderSignup()
  expect(screen.getByRole('link', { name: /Club/ })).toHaveTextContent(
    /rămâne inactiv până la aprobarea administratorului/i,
  )
})

test('role cards and Autentifică-te keep a safe returnUrl', () => {
  renderSignup('/signup?returnUrl=%2Fcursuri%2Fabc-123')
  expect(screen.getByRole('link', { name: /Părinte/ })).toHaveAttribute(
    'href',
    '/register?returnUrl=%2Fcursuri%2Fabc-123',
  )
  expect(screen.getByRole('link', { name: /Antrenor/ })).toHaveAttribute(
    'href',
    '/register-coach?returnUrl=%2Fcursuri%2Fabc-123',
  )
  expect(screen.getByRole('link', { name: /Club/ })).toHaveAttribute(
    'href',
    '/register-club?returnUrl=%2Fcursuri%2Fabc-123',
  )
  expect(screen.getByRole('link', { name: 'Autentifică-te' })).toHaveAttribute(
    'href',
    '/login?returnUrl=%2Fcursuri%2Fabc-123',
  )
})
