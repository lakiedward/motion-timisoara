import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoogleSignInButton } from './GoogleSignInButton'
import { signInWithGoogle } from '@/api/auth'
import { nativeGoogle } from '@/api/auth-native/google'
import { isNative } from '@/lib/platform'

vi.mock('@/api/auth', () => ({ signInWithGoogle: vi.fn() }))
vi.mock('@/lib/platform', () => ({ isNative: vi.fn() }))
vi.mock('@/api/auth-native/google', () => ({
  nativeGoogle: {
    subscribe: () => () => undefined,
    getState: () => 'idle',
    start: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isNative).mockReturnValue(false)
  vi.mocked(signInWithGoogle).mockResolvedValue({ error: null } as Awaited<
    ReturnType<typeof signInWithGoogle>
  >)
})

test('waits for invitation persistence before allowing the web OAuth redirect', async () => {
  let finish!: () => void
  const saved = new Promise<void>((resolve) => {
    finish = resolve
  })
  const before = vi.fn(() => saved)
  render(<GoogleSignInButton returnUrl="/register-coach" onBeforeSignIn={before} />)
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Google' }))
  expect(before).toHaveBeenCalledTimes(1)
  expect(signInWithGoogle).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Se conectează cu Google…' })).toBeDisabled()
  finish()
  await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1))
})

test('a rejected preflight leaves the flow on the invitation without OAuth', async () => {
  render(<GoogleSignInButton onBeforeSignIn={async () => false} />)
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Google' }))
  expect(signInWithGoogle).not.toHaveBeenCalled()
  expect(nativeGoogle.start).not.toHaveBeenCalled()
})

test('native OAuth receives the same continuation after the awaited draft hook', async () => {
  vi.mocked(isNative).mockReturnValue(true)
  const before = vi.fn(async () => true)
  render(<GoogleSignInButton returnUrl="/register-coach" onBeforeSignIn={before} />)
  await userEvent.click(screen.getByRole('button', { name: 'Continuă cu Google' }))
  expect(nativeGoogle.start).toHaveBeenCalledExactlyOnceWith('/register-coach')
  expect(before).toHaveBeenCalledBefore(vi.mocked(nativeGoogle.start))
  expect(signInWithGoogle).not.toHaveBeenCalled()
})
