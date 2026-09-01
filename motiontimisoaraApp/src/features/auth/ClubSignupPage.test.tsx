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

const signedInParent = {
  id: '1',
  email: 'p@example.test',
  name: 'P',
  role: 'PARENT' as const,
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: false,
}

function renderPage(route = '/register-club') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/register-club" element={<ClubSignupPage />} />
          <Route path="/account" element={<p>panou părinte</p>} />
          <Route path="/club" element={<p>panou club</p>} />
          <Route path="/cursuri/abc" element={<p>pagina cursului</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Walks the wizard from the admin step to the confirmation step with valid data. */
async function fillUntilConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
  await user.type(screen.getByLabelText('Denumire fiscală'), 'Club Spec Motion SRL')
  await user.type(screen.getByLabelText('CUI'), 'RO12345678')
  await user.type(screen.getByLabelText('Nr. înregistrare (Reg. Com. / RAF)'), 'J35/1234/2020')
  await user.type(screen.getByLabelText('Adresă firmă'), 'Str. Sportului 1, Timișoara')
  await user.type(screen.getByLabelText('IBAN'), 'RO49AAAA1B31007593840000')
  await user.type(screen.getByLabelText('Bancă'), 'Banca Transilvania')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseAuth.mockReturnValue({ user: null, loading: false, profileError: null, refresh: vi.fn() })
})

test('the club step asks for the billing identity, not just the trading name', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  for (const label of [
    'Denumire fiscală',
    'CUI',
    'Nr. înregistrare (Reg. Com. / RAF)',
    'Adresă firmă',
    'IBAN',
    'Bancă',
  ]) {
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  }
})

test('the confirmation step is out of reach until the billing identity is filled in', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  expect(await screen.findByText('CUI invalid (ex. RO12345678)')).toBeInTheDocument()
  expect(screen.queryByText('Verifică datele înainte de finalizare:')).not.toBeInTheDocument()
})

test('a malformed IBAN is refused with the shape it should have', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
  await user.type(screen.getByLabelText('Denumire fiscală'), 'Club Spec Motion SRL')
  await user.type(screen.getByLabelText('CUI'), 'RO12345678')
  await user.type(screen.getByLabelText('Nr. înregistrare (Reg. Com. / RAF)'), 'J35/1234/2020')
  await user.type(screen.getByLabelText('Adresă firmă'), 'Str. Sportului 1, Timișoara')
  // Prefix corect, lungime gresita: daca testul ar folosi un IBAN strain, ar
  // trece si daca cineva slabeste cuantificatorul de lungime.
  await user.type(screen.getByLabelText('IBAN'), 'RO49AAAA1B3100759384')
  await user.type(screen.getByLabelText('Bancă'), 'Banca Transilvania')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  expect(
    await screen.findByText('IBAN invalid (ex. RO49AAAA1B31007593840000)'),
  ).toBeInTheDocument()
})

test('a club registered as an association can get through the step', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'ACS Spec Motion')
  await user.type(screen.getByLabelText('Denumire fiscală'), 'Asociația Club Sportiv Spec')
  await user.type(screen.getByLabelText('CUI'), '12345678')
  // Registrul Asociațiilor și Fundațiilor, nu Registrul Comerțului: forma
  // juridică obișnuită a unui club sportiv românesc.
  await user.type(screen.getByLabelText('Nr. înregistrare (Reg. Com. / RAF)'), '123/A/2015')
  await user.type(screen.getByLabelText('Adresă firmă'), 'Str. Sportului 1, Timișoara')
  await user.type(screen.getByLabelText('IBAN'), 'RO49AAAA1B31007593840000')
  await user.type(screen.getByLabelText('Bancă'), 'Banca Transilvania')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  expect(await screen.findByText('Verifică datele înainte de finalizare:')).toBeInTheDocument()
})

test('a company registered under the 2022 ONRC format can get through the step', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
  await user.type(screen.getByLabelText('Denumire fiscală'), 'Club Spec Motion SRL')
  await user.type(screen.getByLabelText('CUI'), 'RO12345678')
  await user.type(screen.getByLabelText('Nr. înregistrare (Reg. Com. / RAF)'), 'J2023012345678')
  await user.type(screen.getByLabelText('Adresă firmă'), 'Str. Sportului 1, Timișoara')
  await user.type(screen.getByLabelText('IBAN'), 'RO49AAAA1B31007593840000')
  await user.type(screen.getByLabelText('Bancă'), 'Banca Transilvania')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  expect(await screen.findByText('Verifică datele înainte de finalizare:')).toBeInTheDocument()
})

test('a malformed club email is caught on its own step, never as a silent dead end', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Nume administrator'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  await user.type(screen.getByLabelText('Email club (opțional)'), 'abc')
  await user.type(screen.getByLabelText('Nume club'), 'Club Spec Motion')
  await user.type(screen.getByLabelText('Denumire fiscală'), 'Club Spec Motion SRL')
  await user.type(screen.getByLabelText('CUI'), 'RO12345678')
  await user.type(screen.getByLabelText('Nr. înregistrare (Reg. Com. / RAF)'), 'J35/1234/2020')
  await user.type(screen.getByLabelText('Adresă firmă'), 'Str. Sportului 1, Timișoara')
  await user.type(screen.getByLabelText('IBAN'), 'RO49AAAA1B31007593840000')
  await user.type(screen.getByLabelText('Bancă'), 'Banca Transilvania')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))

  // Fără asta, pasul trecea și „Finalizează” nu făcea absolut nimic, în tăcere:
  // schema întreagă pica pe clubEmail, al cărui mesaj nu se randează pe pasul 3.
  expect(await screen.findByText('Email invalid')).toBeInTheDocument()
  expect(screen.queryByText('Verifică datele înainte de finalizare:')).not.toBeInTheDocument()
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

test('the club is registered only once Finalizează is pressed, with the billing identity', async () => {
  const user = userEvent.setup()
  mockedRegisterClub.mockResolvedValue({ error: { message: 'Există deja un cont cu acest email.' } })
  renderPage()

  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))

  await waitFor(() => expect(mockedRegisterClub).toHaveBeenCalledTimes(1))
  expect(mockedRegisterClub).toHaveBeenCalledWith(
    expect.objectContaining({
      companyName: 'Club Spec Motion SRL',
      companyCui: 'RO12345678',
      companyRegNumber: 'J35/1234/2020',
      companyAddress: 'Str. Sportului 1, Timișoara',
      bankAccount: 'RO49AAAA1B31007593840000',
      bankName: 'Banca Transilvania',
    }),
  )
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

test('a signed-in parent is sent to their own panel instead of the club form', () => {
  mockedUseAuth.mockReturnValue({
    user: signedInParent,
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage()

  expect(screen.getByText('panou părinte')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nume administrator')).not.toBeInTheDocument()
})

test('a signed-in visitor keeps the destination they arrived with', () => {
  mockedUseAuth.mockReturnValue({
    user: signedInParent,
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
  renderPage('/register-club?returnUrl=%2Fcursuri%2Fabc')

  expect(screen.getByText('pagina cursului')).toBeInTheDocument()
})

test('the admin step is shown without waiting for a request', () => {
  renderPage()
  expect(screen.getByLabelText('Nume administrator')).toBeInTheDocument()
})
