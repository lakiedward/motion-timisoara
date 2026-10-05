import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AppleSignInButton } from './AppleSignInButton'
import { signInWithApple } from '@/api/auth'
import {
  APPLE_ERROR,
  AppleSignInCancelledError,
  shouldOfferAppleSignIn,
  signInNativeApple,
  usesNativeAppleSignIn,
} from '@/api/auth-native/apple'
import { oauthCallbackUrl } from '@/lib/auth/return-path'

vi.mock('@/api/auth', () => ({ signInWithApple: vi.fn() }))
vi.mock('@/api/auth-native/apple', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/auth-native/apple')>()
  return {
    ...actual,
    shouldOfferAppleSignIn: vi.fn(),
    usesNativeAppleSignIn: vi.fn(),
    signInNativeApple: vi.fn(),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderButton(returnUrl?: string) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<AppleSignInButton returnUrl={returnUrl} />} />
        <Route path="/auth/callback" element={<p>callback</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(shouldOfferAppleSignIn).mockReturnValue(true)
  vi.mocked(usesNativeAppleSignIn).mockReturnValue(false)
  vi.mocked(signInWithApple).mockResolvedValue({ error: null } as Awaited<
    ReturnType<typeof signInWithApple>
  >)
  vi.mocked(signInNativeApple).mockResolvedValue(undefined)
})

test('web OAuth uses the same callback redirectTo contract as Google', async () => {
  renderButton('/account/enrollments')
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Apple' }))
  expect(signInWithApple).toHaveBeenCalledExactlyOnceWith(
    oauthCallbackUrl(window.location.origin, '/account/enrollments'),
  )
  expect(signInNativeApple).not.toHaveBeenCalled()
})

test('native iOS uses the plugin path then the existing callback page', async () => {
  vi.mocked(usesNativeAppleSignIn).mockReturnValue(true)
  renderButton('/account')
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Apple' }))
  await waitFor(() => expect(signInNativeApple).toHaveBeenCalledTimes(1))
  expect(signInWithApple).not.toHaveBeenCalled()
  expect(screen.getByTestId('location')).toHaveTextContent('/auth/callback?returnUrl=%2Faccount')
})

test('user-cancelled Apple sheet does not toast an error', async () => {
  vi.mocked(usesNativeAppleSignIn).mockReturnValue(true)
  vi.mocked(signInNativeApple).mockRejectedValue(new AppleSignInCancelledError())
  renderButton()
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Apple' }))
  await waitFor(() => expect(signInNativeApple).toHaveBeenCalledTimes(1))
  expect(toast.error).not.toHaveBeenCalled()
  expect(screen.getByTestId('location')).toHaveTextContent('/login')
})

test('a real Apple failure uses the same toast error UX as Google', async () => {
  vi.mocked(signInWithApple).mockResolvedValue({
    error: { message: 'provider disabled' },
  } as Awaited<ReturnType<typeof signInWithApple>>)
  renderButton()
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Apple' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(APPLE_ERROR))
})

test('the button is omitted on Android native', () => {
  vi.mocked(shouldOfferAppleSignIn).mockReturnValue(false)
  renderButton()
  expect(screen.queryByRole('button', { name: 'Continuă cu Apple' })).not.toBeInTheDocument()
})

test('a custom label replaces the default Continuă cu Apple copy', () => {
  render(
    <MemoryRouter>
      <AppleSignInButton label="Înregistrare cu Apple" />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Înregistrare cu Apple' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Continuă cu Apple' })).not.toBeInTheDocument()
})
