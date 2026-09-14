import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import ResetPasswordPage from '../ResetPasswordPage'

const mocks = vi.hoisted(() => ({
  ready: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  events: new Set<() => void>(),
}))
vi.mock('@/api/auth', () => ({
  isPasswordRecoveryReady: mocks.ready,
  updatePassword: mocks.update,
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ refresh: mocks.refresh }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.success } }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: () => void) => {
        mocks.events.add(callback)
        return { data: { subscription: { unsubscribe: () => mocks.events.delete(callback) } } }
      },
    },
  },
}))

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>
}
function mount(path = '/reset-password') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ResetPasswordPage />
      <Location />
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.events.clear()
  mocks.ready.mockResolvedValue(false)
  mocks.update.mockResolvedValue({ error: null })
  mocks.refresh.mockResolvedValue(undefined)
})

it('does not offer password mutation for an ordinary or missing session', async () => {
  mount()
  expect(
    await screen.findByText('Link-ul de resetare este invalid sau a expirat.'),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('Parolă nouă')).not.toBeInTheDocument()
  expect(mocks.update).not.toHaveBeenCalled()
})

it('rechecks when the SDK delivers recovery after INITIAL_SESSION', async () => {
  mount()
  await screen.findByText('Link-ul de resetare este invalid sau a expirat.')
  mocks.ready.mockResolvedValue(true)
  await act(async () => {
    mocks.events.forEach((callback) => callback())
  })
  expect(await screen.findByLabelText('Parolă nouă')).toBeInTheDocument()
})

it('cannot reuse a previous recovery grant on an explicitly rejected callback', async () => {
  mocks.ready.mockResolvedValue(true)
  mount('/reset-password?invalid=1')
  expect(await screen.findByRole('heading', { name: 'Link de email invalid' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mergi la autentificare' })).toHaveAttribute(
    'href',
    '/login',
  )
  expect(screen.queryByLabelText('Parolă nouă')).not.toBeInTheDocument()
})

it('contains session lookup failures and offers a new link', async () => {
  mocks.ready.mockRejectedValue(new Error('storage failed'))
  mount()
  expect(await screen.findByRole('link', { name: 'Solicită un link nou' })).toBeInTheDocument()
})

it('updates the verified recovery account then refreshes the main session without global signout', async () => {
  mocks.ready.mockResolvedValue(true)
  const user = userEvent.setup()
  mount()
  await user.type(await screen.findByLabelText('Parolă nouă'), 'test-new-password')
  await user.type(screen.getByLabelText('Confirmă parola'), 'test-new-password')
  await user.click(screen.getByRole('button', { name: 'Salvează parola' }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('test-new-password'))
  expect(mocks.refresh).toHaveBeenCalledOnce()
  expect(screen.getByTestId('location')).toHaveTextContent('/login')
})

it('does not report success when the grant expires or the update rejects', async () => {
  mocks.ready.mockResolvedValue(true)
  mocks.update.mockRejectedValue(new Error('expired'))
  const user = userEvent.setup()
  mount()
  await user.type(await screen.findByLabelText('Parolă nouă'), 'test-new-password')
  await user.type(screen.getByLabelText('Confirmă parola'), 'test-new-password')
  await user.click(screen.getByRole('button', { name: 'Salvează parola' }))
  expect(
    await screen.findByText('Link-ul de resetare este invalid sau a expirat.'),
  ).toBeInTheDocument()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
