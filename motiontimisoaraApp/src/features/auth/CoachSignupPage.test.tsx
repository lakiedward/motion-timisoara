import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { StrictMode } from 'react'

import CoachSignupPage from './CoachSignupPage'
import { registerCoach, signInWithGoogle, type AppUser } from '@/api/auth'
import { redeemCoachInvitation } from '@/api/coach-registration'
import { fetchSports } from '@/api/sports'
import { useAuth } from '@/lib/auth-context'
import { readCoachInvitationDraft, saveCoachInvitationDraft } from './coach/invitation-draft'

vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  registerCoach: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('@/api/coach-registration', () => ({ redeemCoachInvitation: vi.fn() }))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/platform', () => ({ isNative: () => false }))

const mockedRegisterCoach = vi.mocked(registerCoach)
const mockedRedeem = vi.mocked(redeemCoachInvitation)
const mockedUseAuth = vi.mocked(useAuth)
const parent: AppUser = {
  id: 'parent-1',
  email: 'p@example.test',
  name: 'Ana Părinte',
  role: 'PARENT',
  phone: null,
  avatarUrl: null,
  needsProfileCompletion: true,
}
const coach: AppUser = { ...parent, role: 'COACH' }
const refresh = vi.fn()

function CurrentLocation() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(route = '/register-coach', strict = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const page = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <CurrentLocation />
        <Routes>
          <Route path="/register-coach" element={<CoachSignupPage />} />
          <Route path="/account" element={<p>panou părinte</p>} />
          <Route path="/coach" element={<p>panou antrenor</p>} />
          <Route path="/admin" element={<p>panou admin</p>} />
          <Route path="/club" element={<p>panou club</p>} />
          <Route path="/login" element={<p>autentificare existentă</p>} />
          <Route path="/cursuri/abc" element={<p>pagina cursului</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(strict ? <StrictMode>{page}</StrictMode> : page)
}

async function enterCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Cod de invitație'), 'XXXXX-FAKE')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuă' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
}

async function fillUntilConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await enterCode(user)
  await user.type(screen.getByLabelText('Nume complet'), 'Ana Spec')
  await user.type(screen.getByLabelText('Email'), 'ana@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
}

function signedIn(user: AppUser = parent) {
  mockedUseAuth.mockReturnValue({ user, loading: false, profileError: null, refresh })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.mocked(fetchSports).mockResolvedValue([])
  refresh.mockResolvedValue(coach)
  mockedRedeem.mockResolvedValue({ coachProfileId: 'coach-profile-1', alreadyCoach: false })
  mockedUseAuth.mockReturnValue({ user: null, loading: false, profileError: null, refresh })
})

test('reaching confirmation cannot register or redeem without explicit Finalizează', async () => {
  const user = userEvent.setup()
  renderPage()
  await fillUntilConfirmation(user)
  expect(screen.getByText('Verifică datele înainte de finalizare:')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Finalizează' })).toHaveAttribute('type', 'button')
  expect(mockedRegisterCoach).not.toHaveBeenCalled()
  expect(mockedRedeem).not.toHaveBeenCalled()
})

test('password registration preserves its payload and navigates after confirmed COACH', async () => {
  const user = userEvent.setup()
  mockedRegisterCoach.mockResolvedValue({ error: null } as Awaited<
    ReturnType<typeof registerCoach>
  >)
  renderPage('/register-coach?returnUrl=%2Fcursuri%2Fabc')
  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  expect(mockedRegisterCoach).toHaveBeenCalledExactlyOnceWith({
    invitationCode: 'XXXXX-FAKE',
    name: 'Ana Spec',
    email: 'ana@example.test',
    password: 'parola123',
    phone: undefined,
    bio: undefined,
    sportIds: [],
  })
  expect(mockedRedeem).not.toHaveBeenCalled()
  expect(await screen.findByText('pagina cursului')).toBeInTheDocument()
})

test('a rejected password code returns to its field with Romanian feedback', async () => {
  const user = userEvent.setup()
  mockedRegisterCoach.mockResolvedValue({ error: { message: 'Cod de invitație invalid.' } })
  renderPage()
  await fillUntilConfirmation(user)
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  expect(await screen.findByText('Cod de invitație invalid.')).toBeInTheDocument()
  expect(screen.getByLabelText('Cod de invitație')).toHaveValue('XXXXX-FAKE')
})

test('PARENT reuses the current identity with optional phone and no password', async () => {
  const user = userEvent.setup()
  signedIn()
  renderPage()
  await enterCode(user)
  expect(screen.getByText(parent.email)).toBeInTheDocument()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Parolă')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Continuă cu Google' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(mockedRedeem).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  expect(mockedRedeem).toHaveBeenCalledExactlyOnceWith({
    invitationCode: 'XXXXX-FAKE',
    name: parent.name,
    phone: undefined,
    bio: undefined,
    sportIds: [],
  })
  expect(mockedRegisterCoach).not.toHaveBeenCalled()
  expect(await screen.findByText('panou antrenor')).toBeInTheDocument()
})

test('expired redemption keeps the current account and corrected code clears the server error', async () => {
  const user = userEvent.setup()
  signedIn()
  mockedRedeem.mockResolvedValue({
    error: { message: 'Codul de invitație a expirat. Cere unul nou clubului.' },
  })
  renderPage()
  await enterCode(user)
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Codul de invitație a expirat.')
  expect(refresh).not.toHaveBeenCalled()
  await user.clear(screen.getByLabelText('Cod de invitație'))
  await user.type(screen.getByLabelText('Cod de invitație'), 'NEW-INVITE')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(
    screen.queryByText('Codul de invitație a expirat. Cere unul nou clubului.'),
  ).not.toBeInTheDocument()
  expect(mockedRegisterCoach).not.toHaveBeenCalled()
})

test.each(['ADMIN', 'CLUB', 'COACH'] as const)(
  '%s keeps its panel even with an onboarding return path',
  async (role) => {
    signedIn({ ...parent, role })
    renderPage('/register-coach?returnUrl=%2Fregister-coach')
    expect(await screen.findByTestId('location')).toHaveTextContent(`/${role.toLowerCase()}`)
    expect(screen.queryByLabelText('Cod de invitație')).not.toBeInTheDocument()
    expect(mockedRedeem).not.toHaveBeenCalled()
  },
)

test('successful redemption retries only profile loading, never the invitation transaction', async () => {
  const user = userEvent.setup()
  signedIn()
  refresh.mockResolvedValueOnce(null).mockResolvedValueOnce(coach)
  renderPage('/register-coach?returnUrl=%2Fcursuri%2Fabc')
  await enterCode(user)
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Contul de antrenor a fost activat')
  expect(screen.getByTestId('location')).toHaveTextContent('/register-coach')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă încărcarea profilului' }))
  expect(await screen.findByText('pagina cursului')).toBeInTheDocument()
  expect(mockedRedeem).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledTimes(2)
})

test.each([{ ...parent }, { ...coach, id: 'another-user' }])(
  'a stale or different refreshed profile cannot navigate',
  async (confirmed) => {
    const user = userEvent.setup()
    signedIn()
    refresh.mockResolvedValue(confirmed)
    renderPage()
    await enterCode(user)
    await user.click(screen.getByRole('button', { name: 'Continuă' }))
    await user.click(screen.getByRole('button', { name: 'Finalizează' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('profilul nu s-a încărcat')
    expect(screen.queryByText('panou antrenor')).not.toBeInTheDocument()
  },
)

test('Google persists the code before redirecting, while the continuation excludes its value', async () => {
  const user = userEvent.setup()
  vi.mocked(signInWithGoogle).mockResolvedValue({ error: null } as Awaited<
    ReturnType<typeof signInWithGoogle>
  >)
  renderPage('/register-coach?returnUrl=%2Fcursuri%2Fabc')
  await enterCode(user)
  await user.click(screen.getByRole('button', { name: 'Continuă cu Google' }))
  await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1))
  expect(await readCoachInvitationDraft()).toBe('XXXXX-FAKE')
  const callback = new URL(vi.mocked(signInWithGoogle).mock.calls[0][0])
  expect(callback.searchParams.get('returnUrl')).toBe('/register-coach?returnUrl=%2Fcursuri%2Fabc')
  expect(callback.toString()).not.toContain('XXXXX-FAKE')
  expect(mockedRedeem).not.toHaveBeenCalled()
})

test('existing-account sign-in carries the coach continuation and locally stages the code', async () => {
  const user = userEvent.setup()
  renderPage()
  await enterCode(user)
  await user.click(screen.getByRole('link', { name: 'Autentifică-te' }))
  expect(await screen.findByText('autentificare existentă')).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/login?returnUrl=%2Fregister-coach')
  expect(await readCoachInvitationDraft()).toBe('XXXXX-FAKE')
})

test('returning from authentication restores and consumes the invitation without creating anything', async () => {
  await saveCoachInvitationDraft('SAVED-INVITE')
  signedIn()
  renderPage()
  expect(await screen.findByLabelText('Nume complet')).toHaveValue(parent.name)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(screen.getByLabelText('Cod de invitație')).toHaveValue('SAVED-INVITE')
  expect(await readCoachInvitationDraft()).toBeNull()
  expect(mockedRegisterCoach).not.toHaveBeenCalled()
  expect(mockedRedeem).not.toHaveBeenCalled()
})

test('StrictMode restoration keeps the one-time draft in the form', async () => {
  await saveCoachInvitationDraft('SAVED-INVITE')
  signedIn()
  renderPage('/register-coach', true)
  await screen.findByLabelText('Nume complet')
  await userEvent.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(screen.getByLabelText('Cod de invitație')).toHaveValue('SAVED-INVITE')
  expect(await readCoachInvitationDraft()).toBeNull()
})

test('the updated COACH auth state cannot override the successful public completion destination', async () => {
  const user = userEvent.setup()
  signedIn()
  refresh.mockImplementationOnce(async () => {
    signedIn(coach)
    return coach
  })
  renderPage('/register-coach?returnUrl=%2Fcursuri%2Fabc')
  await enterCode(user)
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await user.click(screen.getByRole('button', { name: 'Finalizează' }))
  expect(await screen.findByText('pagina cursului')).toBeInTheDocument()
  expect(screen.queryByText('panou antrenor')).not.toBeInTheDocument()
})

test('sports loading failure offers retry and successful empty state stays distinct', async () => {
  const user = userEvent.setup()
  vi.mocked(fetchSports).mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce([])
  renderPage()
  await enterCode(user)
  expect(await screen.findByText('Nu am putut încărca sporturile.')).toBeInTheDocument()
  expect(screen.queryByText('Nu sunt sporturi disponibile momentan.')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă sporturile' }))
  expect(await screen.findByText('Nu sunt sporturi disponibile momentan.')).toBeInTheDocument()
})

test('the code step renders immediately', () => {
  renderPage()
  expect(screen.getByLabelText('Cod de invitație')).toBeInTheDocument()
})
