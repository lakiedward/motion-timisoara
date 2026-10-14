import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import LoginPage from './LoginPage'
import { signInWithPassword } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  signInWithPassword: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

const mockedSignIn = vi.mocked(signInWithPassword)
const mockedUseAuth = vi.mocked(useAuth)
type SignInResult = Awaited<ReturnType<typeof signInWithPassword>>
type AuthState = ReturnType<typeof useAuth>

function signedOut(): AuthState {
  return { user: null, loading: false, profileError: null, refresh: vi.fn() } as AuthState
}

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<div>contul părintelui</div>} />
        <Route path="/account/children" element={<div>copiii mei</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Parolă'), password)
  await user.click(screen.getByRole('button', { name: 'Autentificare' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseAuth.mockReturnValue(signedOut())
})

test('an unreachable auth server shows a connection message, not wrong credentials', async () => {
  mockedSignIn.mockResolvedValue({
    data: { user: null, session: null },
    error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
  } as unknown as SignInResult)
  renderLogin()
  await submit('parinte@example.test', 'parola123')

  expect(await screen.findByRole('alert')).toHaveTextContent(/Verifică conexiunea/)
  expect(screen.queryByText('Email sau parola sunt greșite.')).not.toBeInTheDocument()
})

test('a thrown network failure is reported as a connection problem', async () => {
  mockedSignIn.mockRejectedValue(new TypeError('Failed to fetch'))
  renderLogin()
  await submit('parinte@example.test', 'parola123')

  expect(await screen.findByRole('alert')).toHaveTextContent(/Verifică conexiunea/)
})

test('wrong credentials keep the wrong email or password message', async () => {
  mockedSignIn.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
  } as unknown as SignInResult)
  renderLogin()
  await submit('parinte@example.test', 'parola123')

  expect(await screen.findByRole('alert')).toHaveTextContent('Email sau parola sunt greșite.')
})

test('the button stays disabled on Se conectează while the request is pending', async () => {
  mockedSignIn.mockReturnValue(new Promise(() => {}))
  renderLogin()
  await submit('parinte@example.test', 'parola123')

  const button = await screen.findByRole('button', { name: 'Se conectează…' })
  expect(button).toBeDisabled()
  expect(mockedSignIn).toHaveBeenCalledTimes(1)
})

test('Tab goes from Email to Parolă before the forgotten password link', async () => {
  const user = userEvent.setup()
  renderLogin()
  await user.click(screen.getByLabelText('Email'))
  await user.tab()
  expect(screen.getByLabelText('Parolă')).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('link', { name: 'Ai uitat parola?' })).toHaveFocus()
})

test('an empty password says it is required and links the error to the input', async () => {
  const user = userEvent.setup()
  renderLogin()
  await user.click(screen.getByRole('button', { name: 'Autentificare' }))

  expect(await screen.findByText('Parola e obligatorie')).toBeInTheDocument()
  expect(screen.queryByText('Minim 6 caractere')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Parolă')).toHaveAttribute('aria-describedby', 'password-error')
  expect(mockedSignIn).not.toHaveBeenCalled()
})

test('a short password still reports the minimum length', async () => {
  const user = userEvent.setup()
  renderLogin()
  await user.type(screen.getByLabelText('Email'), 'parinte@example.test')
  await user.type(screen.getByLabelText('Parolă'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Autentificare' }))

  expect(await screen.findByText('Minim 6 caractere')).toBeInTheDocument()
})

test('a signed-in parent opening /login lands on their account', () => {
  mockedUseAuth.mockReturnValue({
    ...signedOut(),
    user: { id: 'u1', role: 'PARENT' },
  } as unknown as AuthState)
  renderLogin()

  expect(screen.getByText('contul părintelui')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Autentificare' })).not.toBeInTheDocument()
})

test('a signed-in user with a returnUrl goes to that page', () => {
  mockedUseAuth.mockReturnValue({
    ...signedOut(),
    user: { id: 'u1', role: 'PARENT' },
  } as unknown as AuthState)
  renderLogin('/login?returnUrl=%2Faccount%2Fchildren')

  expect(screen.getByText('copiii mei')).toBeInTheDocument()
})

test('while the session is still loading the form is not shown', () => {
  mockedUseAuth.mockReturnValue({ ...signedOut(), loading: true })
  renderLogin()

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
})
