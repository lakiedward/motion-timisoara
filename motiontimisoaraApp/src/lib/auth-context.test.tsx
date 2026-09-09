import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { LoadAppUserResult } from '@/api/auth'
import { AuthProvider, useAuth } from './auth-context'

const mocks = vi.hoisted(() => ({
  load: vi.fn<() => Promise<LoadAppUserResult>>(),
  native: vi.fn(() => true),
  authCallback: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  foreground: null as null | ((state: { isActive: boolean }) => void),
}))
vi.mock('@/api/auth', () => ({
  loadAppUserResult: mocks.load,
  PROFILE_LOAD_ERROR: 'Profile unavailable',
}))
vi.mock('./platform', () => ({ isNative: mocks.native }))
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof mocks.authCallback) => {
        mocks.authCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event, callback) => {
      mocks.foreground = callback
      return { remove: vi.fn() }
    }),
  },
}))

function verified(id = 'coach-a'): LoadAppUserResult {
  return {
    status: 'ok',
    user: {
      id,
      name: id,
      email: `${id}@test.local`,
      role: 'COACH',
      phone: null,
      avatarUrl: null,
      needsProfileCompletion: false,
    },
  }
}
const offline = (id = 'coach-a'): LoadAppUserResult => ({
  status: 'error',
  message: 'Offline',
  sessionUserId: id,
  retryable: true,
})
function State() {
  const { user, profileError, loading } = useAuth()
  return (
    <output data-role={user?.role}>
      {loading ? 'Loading' : `${user?.id ?? 'no user'}|${profileError ?? 'no error'}`}
    </output>
  )
}
function mount() {
  return render(
    <AuthProvider>
      <State />
    </AuthProvider>,
  )
}
async function auth(event: string, id: string | null) {
  await act(async () => mocks.authCallback?.(event, id ? { user: { id } } : null))
}
function deferred() {
  let resolve!: (result: LoadAppUserResult) => void
  const promise = new Promise<LoadAppUserResult>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.load.mockReset()
  mocks.native.mockReturnValue(true)
  mocks.authCallback = null
  mocks.foreground = null
})

it('keeps only the verified native warm session after temporary network failure', async () => {
  mocks.load.mockResolvedValue(verified())
  mount()
  expect(await screen.findByText('coach-a|no error')).toBeInTheDocument()
  mocks.load.mockResolvedValue(offline())
  await auth('TOKEN_REFRESHED', 'coach-a')
  expect(screen.getByText('coach-a|no error')).toBeInTheDocument()
  await waitFor(() => expect(mocks.foreground).not.toBeNull())
  mocks.load.mockResolvedValue({
    status: 'error',
    message: 'Disabled',
    sessionUserId: 'coach-a',
    retryable: false,
  })
  await act(async () => mocks.foreground?.({ isActive: true }))
  expect(await screen.findByText('no user|Disabled')).toBeInTheDocument()
})

it('never restores a role on a cold offline start', async () => {
  mocks.load.mockResolvedValue(offline())
  mount()
  expect(await screen.findByText('no user|Offline')).toBeInTheDocument()
})

it('fails closed when the latest profile result disagrees with the current auth identity', async () => {
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  mocks.load.mockResolvedValueOnce(offline('coach-b'))
  await auth('TOKEN_REFRESHED', 'coach-a')
  expect(await screen.findByText('no user|Profile unavailable')).toBeInTheDocument()
})

it('does not keep the previous user for an offline account switch or a late request', async () => {
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  const old = deferred()
  mocks.load.mockReturnValueOnce(old.promise)
  await auth('TOKEN_REFRESHED', 'coach-a')
  mocks.load.mockResolvedValueOnce(offline('coach-b'))
  await auth('SIGNED_IN', 'coach-b')
  expect(await screen.findByText('no user|Offline')).toBeInTheDocument()
  await act(async () => old.resolve(verified('coach-a')))
  expect(screen.getByText('no user|Offline')).toBeInTheDocument()
})

it('signed-out immediately clears the warm session and ignores a late refresh result', async () => {
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  const pending = deferred()
  mocks.load.mockReturnValueOnce(pending.promise)
  await auth('TOKEN_REFRESHED', 'coach-a')
  await auth('SIGNED_OUT', null)
  expect(screen.getByText('no user|no error')).toBeInTheDocument()
  await act(async () => pending.resolve(verified()))
  expect(screen.getByText('no user|no error')).toBeInTheDocument()
})

it('a later successful account switch is not overwritten by an old account failure', async () => {
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  const old = deferred()
  mocks.load.mockReturnValueOnce(old.promise)
  await auth('TOKEN_REFRESHED', 'coach-a')
  mocks.load.mockResolvedValueOnce(verified('coach-b'))
  await auth('SIGNED_IN', 'coach-b')
  await screen.findByText('coach-b|no error')
  await act(async () => old.resolve(offline('coach-a')))
  expect(screen.getByText('coach-b|no error')).toBeInTheDocument()
})

it('web profiles still fail closed on a transient error', async () => {
  mocks.native.mockReturnValue(false)
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  mocks.load.mockResolvedValueOnce(offline())
  await auth('TOKEN_REFRESHED', 'coach-a')
  expect(await screen.findByText('no user|Offline')).toBeInTheDocument()
})

it('network recovery revalidates the warm session and adopts its current role', async () => {
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  mocks.load.mockResolvedValueOnce(offline())
  await auth('TOKEN_REFRESHED', 'coach-a')
  const changed = verified()
  if (changed.status !== 'ok') throw new Error('Fixture error')
  changed.user.role = 'PARENT'
  mocks.load.mockResolvedValueOnce(changed)
  await act(async () => window.dispatchEvent(new Event('online')))
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3))
  expect(screen.getByText('coach-a|no error')).toHaveAttribute('data-role', 'PARENT')
})

it('a definitive denial discards the verified role before any subsequent offline error', async () => {
  mocks.load.mockResolvedValueOnce(verified())
  mount()
  await screen.findByText('coach-a|no error')
  mocks.load.mockResolvedValueOnce({
    status: 'error',
    message: 'Forbidden',
    sessionUserId: 'coach-a',
    retryable: false,
  })
  await auth('TOKEN_REFRESHED', 'coach-a')
  expect(await screen.findByText('no user|Forbidden')).toBeInTheDocument()
  mocks.load.mockResolvedValueOnce(offline())
  await auth('TOKEN_REFRESHED', 'coach-a')
  expect(await screen.findByText('no user|Offline')).toBeInTheDocument()
})
