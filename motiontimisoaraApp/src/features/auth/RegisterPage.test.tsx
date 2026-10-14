import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import RegisterPage from './RegisterPage'
import { signUpParent } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  signUpParent: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

const mockedSignUp = vi.mocked(signUpParent)
const mockedUseAuth = vi.mocked(useAuth)
type SignUpResult = Awaited<ReturnType<typeof signUpParent>>
type AuthState = ReturnType<typeof useAuth>

function signedOut(): AuthState {
  return { user: null, loading: false, profileError: null, refresh: vi.fn() } as AuthState
}

function renderRegister(entry = '/register') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div>pagina de autentificare</div>} />
        <Route path="/account" element={<div>contul părintelui</div>} />
        <Route path="/coach" element={<div>panoul antrenorului</div>} />
        <Route path="/courses/42" element={<div>cursul ales</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(phone = '+40712345678') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Nume complet'), 'Ana Popescu')
  await user.type(screen.getByLabelText('Email'), 'parinte@example.test')
  await user.type(screen.getByLabelText('Telefon'), phone)
  await user.type(screen.getByLabelText('Parolă'), 'parola123')
  await user.click(screen.getByRole('button', { name: 'Creează cont' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseAuth.mockReturnValue(signedOut())
})

test('a failed signup request shows a connection message instead of Failed to fetch', async () => {
  mockedSignUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
  } as unknown as SignUpResult)
  renderRegister()
  await fillAndSubmit()

  expect(await screen.findByRole('alert')).toHaveTextContent(/Verifică conexiunea/)
  expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
})

test('a thrown network failure is reported as a connection problem', async () => {
  mockedSignUp.mockRejectedValue(new TypeError('Failed to fetch'))
  renderRegister()
  await fillAndSubmit()

  expect(await screen.findByRole('alert')).toHaveTextContent(/Verifică conexiunea/)
})

test('an email already in use says so', async () => {
  mockedSignUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
  } as unknown as SignUpResult)
  renderRegister()
  await fillAndSubmit()

  expect(await screen.findByRole('alert')).toHaveTextContent('Există deja un cont cu acest email.')
})

test('an international phone number passes validation and submits', async () => {
  mockedSignUp.mockReturnValue(new Promise(() => {}))
  renderRegister()
  await fillAndSubmit('+4915112345678')

  expect(mockedSignUp).toHaveBeenCalledWith(expect.objectContaining({ phone: '+4915112345678' }))
})

test('the button stays disabled on Se creează while the request is pending', async () => {
  mockedSignUp.mockReturnValue(new Promise(() => {}))
  renderRegister()
  await fillAndSubmit()

  expect(await screen.findByRole('button', { name: 'Se creează…' })).toBeDisabled()
  expect(mockedSignUp).toHaveBeenCalledTimes(1)
})

test('an empty submit keeps the current field messages', async () => {
  const user = userEvent.setup()
  renderRegister()
  await user.click(screen.getByRole('button', { name: 'Creează cont' }))

  expect(await screen.findByText('Minim 3 caractere')).toBeInTheDocument()
  expect(screen.getByText('Email invalid')).toBeInTheDocument()
  expect(screen.getByText('Număr de telefon invalid')).toBeInTheDocument()
  expect(screen.getByText('Minim 6 caractere')).toBeInTheDocument()
  expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-describedby', 'phone-error')
  expect(mockedSignUp).not.toHaveBeenCalled()
})

test('a signed-in parent opening /register lands on their account', () => {
  mockedUseAuth.mockReturnValue({
    ...signedOut(),
    user: { id: 'u1', role: 'PARENT' },
  } as unknown as AuthState)
  renderRegister()

  expect(screen.getByText('contul părintelui')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Creează cont' })).not.toBeInTheDocument()
})

test('a signed-in coach opening /register lands on their panel', () => {
  mockedUseAuth.mockReturnValue({
    ...signedOut(),
    user: { id: 'u2', role: 'COACH' },
  } as unknown as AuthState)
  renderRegister()

  expect(screen.getByText('panoul antrenorului')).toBeInTheDocument()
})

test('a signed-in user with a returnUrl goes to that page', () => {
  mockedUseAuth.mockReturnValue({
    ...signedOut(),
    user: { id: 'u1', role: 'PARENT' },
  } as unknown as AuthState)
  renderRegister('/register?returnUrl=%2Fcourses%2F42')

  expect(screen.getByText('cursul ales')).toBeInTheDocument()
})

test('while the session is still loading the form is not shown', () => {
  mockedUseAuth.mockReturnValue({ ...signedOut(), loading: true })
  renderRegister()

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
})

test('Autentifică-te leads to the login page', async () => {
  const user = userEvent.setup()
  renderRegister()
  await user.click(screen.getByRole('link', { name: 'Autentifică-te' }))

  expect(screen.getByText('pagina de autentificare')).toBeInTheDocument()
})
