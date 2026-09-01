import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubSignupPage from './ClubSignupPage'
import { registerClub } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/sports', () => ({ fetchSports: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  registerClub: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))

const mockedRegisterClub = vi.mocked(registerClub)
const mockedUseAuth = vi.mocked(useAuth)

const semnat = (role: 'PARENT' | 'COACH') => ({
  id: '1',
  email: 'p@example.test',
  name: 'P',
  role,
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: false,
})

function renderPage(route = '/register-club') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/register-club" element={<ClubSignupPage />} />
          <Route path="/account" element={<p>panou părinte</p>} />
          <Route path="/coach" element={<p>panou antrenor</p>} />
          <Route path="/club" element={<p>panou club</p>} />
          <Route path="/cursuri/abc" element={<p>pagina cursului</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Walks the wizard from the admin step to the confirmation step. */
async function fillUntilConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
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
  expect(mockedRegisterClub).not.toHaveBeenCalled()
  // The wizard's buttons share a slot, so a real browser hands this one the DOM
  // node — and the pending click — of the Continuă that just moved us here. A
  // submit button would turn that click into a registration; jsdom does not
  // reproduce that activation, so the type itself is what the test pins down.
  expect(finish).toHaveAttribute('type', 'button')
})

test('the club is registered only once Finalizează is pressed', async () => {
  const user = userEvent.setup()
  mockedRegisterClub.mockResolvedValue({ error: { message: 'Există deja un cont cu acest email.' } })
  renderPage()

  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))

  await waitFor(() => expect(mockedRegisterClub).toHaveBeenCalledTimes(1))
})

test('a rejected email sends the owner back to the first step, message in Romanian', async () => {
  const user = userEvent.setup()
  mockedRegisterClub.mockResolvedValue({ error: { message: 'Există deja un cont cu acest email.' } })
  renderPage()

  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))

  expect(await screen.findByText('Există deja un cont cu acest email.')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveValue('ana@example.test')
})

test('a malformed club email is caught on its own step, never as a silent dead end', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
  await user.type(screen.getByLabelText('Email club (opțional)'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  // Fără clubEmail în STEP_FIELDS, pasul trecea și „Finalizează” nu făcea
  // absolut nimic: schema întreagă pica pe un câmp al cărui mesaj nu se
  // randează pe pasul de confirmare.
  expect(await screen.findByText('Email invalid')).toBeInTheDocument()
  expect(screen.queryByText('Verifică datele înainte de finalizare:')).not.toBeInTheDocument()
})

test('a signed-in parent is sent to their own panel instead of the club form', () => {
  mockedUseAuth.mockReturnValue({
    user: semnat('PARENT'),
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage()

  expect(screen.getByText('panou părinte')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nume administrator')).not.toBeInTheDocument()
})

test('a signed-in coach lands on their own panel, not the parent one', () => {
  // Cu destinația veche, hardcodată pe /account, cazul PARENT trecea din
  // coincidență. Antrenorul e cel care deosebește garda de vechiul cod.
  mockedUseAuth.mockReturnValue({
    user: semnat('COACH'),
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage()

  expect(screen.getByText('panou antrenor')).toBeInTheDocument()
})

test('a signed-in visitor keeps the destination they arrived with', () => {
  mockedUseAuth.mockReturnValue({
    user: semnat('PARENT'),
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage('/register-club?returnUrl=%2Fcursuri%2Fabc')

  expect(screen.getByText('pagina cursului')).toBeInTheDocument()
})

test('a new club owner lands in the club panel, not the parent one', async () => {
  const user = userEvent.setup()
  const refresh = vi.fn()
  mockedUseAuth.mockReturnValue({ user: null, loading: false, profileError: null, refresh })
  // Pagina se uită doar după `error`; un User și un Session complet ar fi
  // douăzeci de câmpuri fără nicio treabă cu ce probează testul.
  mockedRegisterClub.mockResolvedValue({ error: null } as Awaited<ReturnType<typeof registerClub>>)
  renderPage()

  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))

  expect(await screen.findByText('panou club')).toBeInTheDocument()
})

test('the admin step is shown without waiting for a request', () => {
  renderPage()
  expect(screen.getByLabelText('Nume administrator')).toBeInTheDocument()
})
