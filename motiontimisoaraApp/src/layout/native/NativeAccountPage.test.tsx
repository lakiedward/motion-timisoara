import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import type { AppUser } from '@/api/auth'
import NativeAccountPage from './NativeAccountPage'

const state = vi.hoisted(() => ({
  user: null as AppUser | null,
  loading: false,
  profileError: null as string | null,
  refresh: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({ useAuth: () => state }))
vi.mock('@/api/auth', () => ({ signOut: () => state.signOut() }))

beforeEach(() => {
  state.user = null
  state.loading = false
  state.profileError = null
  vi.clearAllMocks()
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <NativeAccountPage />
    </MemoryRouter>,
  )

test('a signed-out visitor can sign in or choose a registration type', () => {
  renderPage()
  expect(screen.getByRole('link', { name: 'Autentificare' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('link', { name: 'Creează cont' })).toHaveAttribute('href', '/signup')
  expect(screen.queryByRole('button', { name: 'Deconectare' })).not.toBeInTheDocument()
})

test('profile loading and failure do not appear as a signed-out account', async () => {
  state.loading = true
  const view = renderPage()
  expect(screen.getByRole('status')).toHaveAccessibleName('Se încarcă profilul')
  expect(screen.queryByRole('link', { name: 'Autentificare' })).not.toBeInTheDocument()
  state.loading = false
  state.profileError = 'Profil indisponibil'
  view.rerender(
    <MemoryRouter>
      <NativeAccountPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Profil indisponibil')
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(state.refresh).toHaveBeenCalledOnce()
})

test('failed logout leaves the account available and permits retry', async () => {
  state.user = {
    id: 'coach',
    email: 'audit@example.test',
    name: 'Audit',
    role: 'COACH',
    phone: null,
    avatarUrl: null,
    needsProfileCompletion: false,
  }
  state.signOut
    .mockResolvedValueOnce({ error: new Error('offline') })
    .mockResolvedValueOnce({ error: null })
  renderPage()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Deconectare' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Nu te-am putut deconecta')
  expect(screen.getByRole('link', { name: 'Încasări' })).toHaveAttribute('href', '/coach/stripe')
  await user.click(screen.getByRole('button', { name: 'Deconectare' }))
  expect(state.signOut).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
