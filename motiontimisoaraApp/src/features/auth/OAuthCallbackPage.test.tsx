import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OAuthCallbackPage from './OAuthCallbackPage'
import { loadAppUser, type AppUser } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  loadAppUser: vi.fn(),
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
