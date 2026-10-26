import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OAuthCallbackPage from './OAuthCallbackPage'
import { completeProfile, loadAppUser, type AppUser } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  loadAppUser: vi.fn(),
  completeProfile: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))
const refresh = vi.fn()
const parent: AppUser = {
  id: 'parent-1',
  email: 'p@example.test',
  name: 'Ana Părinte',
  role: 'PARENT',
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: true,
}

function renderCallback(returnUrl?: string) {
  return render(
    <MemoryRouter
      initialEntries={[
        `/auth/callback${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
      ]}
    >
      <Routes>
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/register-coach" element={<p>invitație antrenor</p>} />
        <Route path="/account" element={<p>panou părinte</p>} />
        <Route path="/account/child/new" element={<p>ecranul copilului</p>} />
        <Route path="/cursuri/abc" element={<p>pagina cursului</p>} />
        <Route path="/register-coach-extra" element={<p>alt traseu</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadAppUser).mockResolvedValue(parent)
  refresh.mockResolvedValue(parent)
  vi.mocked(useAuth).mockReturnValue({ user: parent, loading: false, profileError: null, refresh })
})

test('exact coach continuation refreshes the existing identity and hands off without required phone', async () => {
  renderCallback('/register-coach?returnUrl=%2Fcursuri%2Fabc')
  expect(await screen.findByText('invitație antrenor')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(screen.queryByLabelText('Telefon')).not.toBeInTheDocument()
})

test.each([undefined, '/cursuri/abc', '/register-coach-extra'])(
  'ordinary OAuth still requires profile completion for %s',
  async (returnUrl) => {
    renderCallback(returnUrl)
    expect(await screen.findByLabelText('Telefon')).toBeInTheDocument()
    expect(screen.getByLabelText('Nume complet')).toHaveValue(parent.name)
    expect(refresh).not.toHaveBeenCalled()
  },
)

test('a complete ordinary profile retains its normal destination', async () => {
  vi.mocked(loadAppUser).mockResolvedValue({
    ...parent,
    phone: '+40722123456',
    needsProfileCompletion: false,
  })
  renderCallback('/cursuri/abc')
  expect(await screen.findByText('pagina cursului')).toBeInTheDocument()
  expect(refresh).not.toHaveBeenCalled()
})

test.each([null, { ...parent, id: 'different-user' }])(
  'failed or mismatched profile refresh cannot hand off to the coach wizard',
  async (result) => {
    refresh.mockResolvedValue(result)
    renderCallback('/register-coach')
    expect(await screen.findByText('Autentificare eșuată')).toBeInTheDocument()
    expect(screen.queryByText('invitație antrenor')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Înapoi la autentificare' })).toHaveAttribute(
      'href',
      '/login?returnUrl=%2Fregister-coach',
    )
  },
)

test('failed handoff can refresh again while retaining its coach continuation', async () => {
  refresh.mockResolvedValueOnce(null).mockResolvedValueOnce(parent)
  renderCallback('/register-coach')
  await screen.findByText('Autentificare eșuată')
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('invitație antrenor')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(2)
})

test('a new Google parent who completes the profile lands on the add-child screen', async () => {
  vi.mocked(completeProfile).mockResolvedValue({ error: null } as never)
  const user = userEvent.setup()
  renderCallback('/cursuri/abc')
  await user.type(await screen.findByLabelText('Telefon'), '+40722123456')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByText('ecranul copilului')).toBeInTheDocument()
})

test('loading keeps the auth layout and announces the sign-in check', async () => {
  vi.mocked(loadAppUser).mockReturnValue(new Promise(() => {}))
  renderCallback()
  expect(screen.getByRole('heading', { name: 'Te conectăm…' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Se încarcă')
})

test('a failed callback shows the shared alert banner with the email fallback', async () => {
  refresh.mockResolvedValue(null)
  renderCallback('/register-coach')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nu am putut finaliza autentificarea. Încearcă din nou sau intră cu email și parolă.',
  )
})

test('profile completion uses the shared fields with described errors', async () => {
  const user = userEvent.setup()
  renderCallback()
  const phone = await screen.findByLabelText('Telefon')
  expect(phone).toHaveAttribute('autocomplete', 'tel')
  expect(screen.getByLabelText('Nume complet')).toHaveAttribute('autocomplete', 'name')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByText('Număr de telefon invalid')).toBeInTheDocument()
  expect(phone).toHaveAttribute('aria-invalid', 'true')
  expect(phone).toHaveAttribute('aria-describedby', 'phone-error')
  expect(completeProfile).not.toHaveBeenCalled()
})

test('profile completion explains the phone and names the Google account', async () => {
  renderCallback()
  expect(
    await screen.findByText(
      /Adaugă un număr de telefon ca să te putem contacta despre înscrierile copiilor\./,
    ),
  ).toBeInTheDocument()
  expect(screen.getByText(/Conectat ca/)).toHaveTextContent(`Conectat ca ${parent.email}`)
})

test('a phone typed with spaces or dashes is accepted and saved without them', async () => {
  vi.mocked(completeProfile).mockResolvedValue({ error: null } as never)
  const user = userEvent.setup()
  renderCallback()
  await user.type(await screen.findByLabelText('Telefon'), '0722 123-456')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByText('ecranul copilului')).toBeInTheDocument()
  expect(completeProfile).toHaveBeenCalledWith(parent.id, {
    name: parent.name,
    phone: '0722123456',
  })
})

test('a failed save shows the inline alert and keeps the typed values', async () => {
  vi.mocked(completeProfile).mockResolvedValue({ error: { message: 'x' } } as never)
  const user = userEvent.setup()
  renderCallback()
  const phone = await screen.findByLabelText('Telefon')
  await user.type(phone, '+40722123456')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nu am putut salva profilul. Încearcă din nou.',
  )
  expect(phone).toHaveValue('+40722123456')
  expect(screen.getByLabelText('Nume complet')).toHaveValue(parent.name)
  expect(refresh).not.toHaveBeenCalled()
})
