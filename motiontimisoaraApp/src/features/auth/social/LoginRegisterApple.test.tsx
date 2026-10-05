import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'
import RegisterPage from '../RegisterPage'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/api/auth-native/apple', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/auth-native/apple')>()
  return {
    ...actual,
    shouldOfferAppleSignIn: () => true,
    usesNativeAppleSignIn: () => false,
    signInNativeApple: vi.fn(),
  }
})
vi.mock('@/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/auth')>()),
  signInWithApple: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('@/lib/platform', () => ({ isNative: () => false, platform: () => 'web' }))
vi.mock('@/api/auth-native/google', () => ({
  nativeGoogle: {
    subscribe: () => () => undefined,
    getState: () => 'idle',
    start: vi.fn(),
  },
}))

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  })
})

test('login shows Continuă cu Apple next to Google', () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Continuă cu Apple' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Continuă cu Google' })).toBeEnabled()
})

test('register shows Înregistrare cu Apple next to Google', () => {
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Înregistrare cu Apple' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Înregistrare cu Google' })).toBeEnabled()
})
