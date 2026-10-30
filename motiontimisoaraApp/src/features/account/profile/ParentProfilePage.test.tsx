import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { AppUser } from '@/api/auth'

import ParentProfilePage from './ParentProfilePage'

const state = vi.hoisted(() => ({
  user: null as AppUser | null,
  loading: false,
  profileError: null as string | null,
  refresh: vi.fn(),
}))
const api = vi.hoisted(() => ({ completeProfile: vi.fn(), requestPasswordReset: vi.fn() }))
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('@/lib/auth-context', () => ({ useAuth: () => state }))
vi.mock('@/api/auth', () => api)
vi.mock('sonner', () => ({ toast: toasts }))

const parent: AppUser = {
  id: 'parent-1',
  email: 'parinte@example.com',
  name: 'Ana Pop',
  role: 'PARENT',
  phone: '+40700000001',
  avatarUrl: null,
  needsProfileCompletion: false,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ParentProfilePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.user = parent
  state.loading = false
  state.refresh.mockReset()
  api.completeProfile.mockReset()
  api.completeProfile.mockResolvedValue({ error: null })
  api.requestPasswordReset.mockReset()
  api.requestPasswordReset.mockResolvedValue({ error: null })
  toasts.success.mockReset()
  toasts.error.mockReset()
})

test('afișează numele, telefonul și emailul doar de citit', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Profilul meu' })).toBeInTheDocument()
  expect(screen.getByLabelText(/Nume/)).toHaveValue('Ana Pop')
  expect(screen.getByLabelText(/Telefon/)).toHaveValue('+40700000001')
  expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  expect(screen.getByText('Date de contact')).toBeInTheDocument()
})

test('salvează numele și telefonul fără spații, apoi reîncarcă profilul', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.clear(screen.getByLabelText(/Nume/))
  await user.type(screen.getByLabelText(/Nume/), 'Ana Popescu')
  await user.clear(screen.getByLabelText(/Telefon/))
  await user.type(screen.getByLabelText(/Telefon/), '0722 111 222')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(api.completeProfile).toHaveBeenCalledWith('parent-1', {
      name: 'Ana Popescu',
      phone: '0722111222',
    }),
  )
  expect(state.refresh).toHaveBeenCalled()
})

test('nu salvează un telefon gol sau invalid', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.clear(screen.getByLabelText(/Telefon/))
  await user.type(screen.getByLabelText(/Telefon/), 'abc')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Număr de telefon invalid')).toBeInTheDocument()
  expect(screen.getByLabelText(/Telefon/)).toHaveAttribute('aria-invalid', 'true')
  expect(api.completeProfile).not.toHaveBeenCalled()
})

test('cât se încarcă userul se vede skeleton', () => {
  state.user = null
  state.loading = true
  renderPage()
  expect(screen.getByRole('status', { name: 'Se încarcă profilul' })).toBeInTheDocument()
})

test('Schimbă parola trimite linkul de resetare pe emailul contului, fără să salveze profilul', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Schimbă parola' }))
  await waitFor(() =>
    expect(api.requestPasswordReset).toHaveBeenCalledWith(
      'parinte@example.com',
      `${window.location.origin}/reset-password`,
    ),
  )
  expect(toasts.success).toHaveBeenCalledWith('Ți-am trimis pe email linkul pentru parola nouă.')
  expect(api.completeProfile).not.toHaveBeenCalled()
})

test('Schimbă parola arată eroarea când linkul nu poate fi trimis', async () => {
  api.requestPasswordReset.mockResolvedValue({ error: new Error('rețea') })
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Schimbă parola' }))
  await waitFor(() =>
    expect(toasts.error).toHaveBeenCalledWith(
      'Nu am putut trimite linkul. Verifică conexiunea și încearcă din nou.',
    ),
  )
  expect(screen.getByRole('button', { name: 'Schimbă parola' })).toBeEnabled()
})
