import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const api = vi.hoisted(() => ({ completeProfile: vi.fn() }))
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('@/lib/auth-context', () => ({ useAuth: () => state }))
vi.mock('@/api/auth', () => api)
vi.mock('sonner', () => ({ toast: toasts }))

const admin: AppUser = {
  id: 'admin-1',
  email: 'uiaudit.admin@motiontimisoara.test',
  name: 'Audit Admin',
  role: 'ADMIN',
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: false,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminProfilePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.user = admin
  state.loading = false
  state.refresh.mockReset()
  api.completeProfile.mockReset()
  api.completeProfile.mockResolvedValue({ error: null })
  toasts.success.mockReset()
  toasts.error.mockReset()
})

test('profilul admin are un singur h1, cardul Date de contact și nota de câmpuri obligatorii', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Profil administrator' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByText('Date de contact')).toBeInTheDocument()
  expect(
    screen.getByText('Numele apare în meniul de administrare; telefonul e pentru contact.'),
  ).toBeInTheDocument()
  expect(screen.getByText(/Câmpurile marcate cu/)).toBeInTheDocument()
  expect(screen.getByLabelText(/Nume/)).toHaveValue('Audit Admin')
  expect(screen.getByLabelText(/Nume/)).toHaveAttribute('aria-required', 'true')
  expect(screen.getByLabelText(/Nume/)).toHaveAttribute('autocomplete', 'name')
  expect(screen.getByLabelText('Telefon')).not.toHaveAttribute('aria-required')
  expect(screen.getByLabelText('Telefon')).toHaveAttribute('autocomplete', 'tel')
  expect(screen.getByLabelText('Telefon')).toHaveAttribute('type', 'tel')
  const save = screen.getByRole('button', { name: 'Salvează' })
  expect(save.className).toMatch(/min-h-touch-target/)
  expect(save.className).toMatch(/h-11/)
})

test('cât user lipsește se vede scheletul anunțat, nu un ecran gol', () => {
  state.user = null
  state.loading = true
  const { container } = renderPage()
  expect(screen.getByRole('status', { name: 'Se încarcă profilul' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Profil administrator' })).not.toBeInTheDocument()
  expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(1)
})

test('salvează numele tăiat și telefonul fără spații, apoi reîmprospătează', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.clear(screen.getByLabelText(/Nume/))
  await user.type(screen.getByLabelText(/Nume/), '  Ion Pop  ')
  await user.type(screen.getByLabelText('Telefon'), '+40 700 000 001')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(api.completeProfile).toHaveBeenCalledWith('admin-1', {
      name: 'Ion Pop',
      phone: '+40700000001',
    }),
  )
  expect(state.refresh).toHaveBeenCalled()
  expect(toasts.success).toHaveBeenCalledWith('Profil actualizat.')
})

test('un telefon gol se salvează ca null', async () => {
  const user = userEvent.setup()
  state.user = { ...admin, phone: '+40700000001' }
  renderPage()
  await user.clear(screen.getByLabelText('Telefon'))
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(api.completeProfile).toHaveBeenCalledWith('admin-1', {
      name: 'Audit Admin',
      phone: null,
    }),
  )
})

test('un nume doar din spații sau prea scurt nu se salvează și primește focus', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.clear(screen.getByLabelText(/Nume/))
  await user.type(screen.getByLabelText(/Nume/), '    ')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Minim 2 caractere')).toBeInTheDocument()
  expect(api.completeProfile).not.toHaveBeenCalled()
  expect(screen.getByLabelText(/Nume/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText(/Nume/)).toHaveAttribute('aria-describedby', 'admin-profile-name-error')
  expect(screen.getByLabelText(/Nume/)).toHaveFocus()
})

test('un telefon invalid arată eroarea legată de câmp și nu se salvează', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.type(screen.getByLabelText('Telefon'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Număr de telefon invalid')).toBeInTheDocument()
  expect(api.completeProfile).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Telefon')).toHaveAttribute(
    'aria-describedby',
    'admin-profile-phone-error',
  )
  expect(screen.getByLabelText('Telefon')).toHaveFocus()
})

test('când salvarea eșuează apare mesajul și valorile rămân', async () => {
  const user = userEvent.setup()
  api.completeProfile.mockResolvedValue({ error: { message: 'x' } })
  renderPage()
  await user.type(screen.getByLabelText('Telefon'), '0700000001')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Nu am putut salva profilul.'))
  expect(state.refresh).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Telefon')).toHaveValue('0700000001')
})
