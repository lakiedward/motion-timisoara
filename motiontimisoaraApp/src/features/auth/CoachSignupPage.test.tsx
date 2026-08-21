import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachSignupPage from './CoachSignupPage'
import { registerCoach } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/sports', () => ({ fetchSports: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  registerCoach: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))

const mockedRegisterCoach = vi.mocked(registerCoach)
const mockedUseAuth = vi.mocked(useAuth)

function renderPage(route = '/register-coach') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/register-coach" element={<CoachSignupPage />} />
          <Route path="/account" element={<p>panou părinte</p>} />
          <Route path="/coach" element={<p>panou antrenor</p>} />
          <Route path="/cursuri/abc" element={<p>pagina cursului</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Walks the wizard from the code step to the data step with a code the server would reject. */
async function fillUntilConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Cod de invitație'), 'XXXXX-FAKE')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.type(screen.getByLabelText('Nume complet'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseAuth.mockReturnValue({ user: null, loading: false, profileError: null, refresh: vi.fn() })
})

test('reaching the confirmation step does not register anything on its own', async () => {
  const user = userEvent.setup()
  renderPage()

  await fillUntilConfirmation(user)

  expect(screen.getByText('Verifică datele înainte de finalizare:')).toBeInTheDocument()
  const finish = screen.getByRole('button', { name: 'Finalizează' })
  expect(finish).toBeEnabled()
  expect(mockedRegisterCoach).not.toHaveBeenCalled()
  // The wizard's buttons share a slot, so a real browser hands this one the DOM
  // node — and the pending click — of the Continuă that just moved us here. A
  // submit button would turn that click into a registration; jsdom does not
  // reproduce that activation, so the type itself is what the test pins down.
  expect(finish).toHaveAttribute('type', 'button')
})

test('the coach is registered only once Finalizează is pressed', async () => {
  const user = userEvent.setup()
  mockedRegisterCoach.mockResolvedValue({ error: { message: 'Cod de invitație invalid.' } })
  renderPage()

  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))

  await waitFor(() => expect(mockedRegisterCoach).toHaveBeenCalledTimes(1))
})

test('a rejected code sends the coach back to the code step, message in Romanian', async () => {
  const user = userEvent.setup()
  mockedRegisterCoach.mockResolvedValue({ error: { message: 'Cod de invitație invalid.' } })
  renderPage()

  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))

  expect(await screen.findByText('Cod de invitație invalid.')).toBeInTheDocument()
  expect(screen.getByLabelText('Cod de invitație')).toHaveValue('XXXXX-FAKE')
})

test('a signed-in parent is sent to their own panel instead of the coach form', () => {
  mockedUseAuth.mockReturnValue({
    user: { id: '1', email: 'p@example.test', name: 'P', role: 'PARENT', phone: null, avatarUrl: null, needsProfileCompletion: false },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage()

  expect(screen.getByText('panou părinte')).toBeInTheDocument()
  expect(screen.queryByLabelText('Cod de invitație')).not.toBeInTheDocument()
})

test('a signed-in visitor keeps the destination they arrived with', () => {
  mockedUseAuth.mockReturnValue({
    user: { id: '1', email: 'p@example.test', name: 'P', role: 'PARENT', phone: null, avatarUrl: null, needsProfileCompletion: false },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage('/register-coach?returnUrl=%2Fcursuri%2Fabc')

  expect(screen.getByText('pagina cursului')).toBeInTheDocument()
})

test('the code step is shown without waiting for a request', () => {
  renderPage()
  expect(screen.getByLabelText('Cod de invitație')).toBeInTheDocument()
})
