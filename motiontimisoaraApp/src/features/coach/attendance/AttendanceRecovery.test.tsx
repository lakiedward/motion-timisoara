import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { AttendanceProvider } from './AttendanceProvider'
import { AttendanceScanner } from './AttendanceScanner'
import { AttendanceContext } from './attendance-context'
import { AttendanceQueue } from './attendance-queue'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  send: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  listeners: [] as Array<(state: { isActive: boolean }) => void>,
}))
vi.mock('@/api/auth', () => ({ loadAppUserResult: mocks.load }))
vi.mock('@/api/attendance', async (original) => ({
  ...(await original<typeof import('@/api/attendance')>()),
  recordAttendance: mocks.send,
}))
vi.mock('@/lib/platform', () => ({ isNative: () => true }))
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: mocks.set } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event, callback) => {
      mocks.listeners.push(callback)
      return { remove: vi.fn() }
    }),
  },
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  },
}))

const occurrenceId = '00000000-0000-4000-8000-000000000001'
const entry = {
  id: '00000000-0000-4000-8000-000000000002',
  occurrenceId,
  label: 'Înot',
  capturedAt: '2026-09-08T10:00:00.000Z',
  token: 'a'.repeat(32),
  state: 'pending',
  message: 'În așteptare',
}

function ProtectedQueue() {
  const { user } = useAuth()
  return user ? (
    <AttendanceProvider>
      <AttendanceScanner occurrenceId={occurrenceId} label="Înot" />
    </AttendanceProvider>
  ) : (
    <p>Profil indisponibil</p>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listeners.length = 0
  mocks.get.mockResolvedValue({ value: JSON.stringify({ version: 1, entries: [entry] }) })
  mocks.set.mockResolvedValue(undefined)
  mocks.send.mockResolvedValue({ success: true, outcome: 'recorded', childName: 'Copil Test' })
})

it.each(['online', 'foreground'])(
  'resumes a stored scan after an offline restart on %s',
  async (event) => {
    mocks.load.mockResolvedValueOnce({ status: 'error', message: 'Offline' }).mockResolvedValue({
      status: 'ok',
      user: { id: `coach-${event}`, name: 'Audit', role: 'COACH', needsProfileCompletion: false },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <ProtectedQueue />
        </AuthProvider>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(mocks.listeners.length).toBeGreaterThan(0))
    expect(mocks.send).not.toHaveBeenCalled()
    await act(async () => {
      if (event === 'online') window.dispatchEvent(new Event('online'))
      else mocks.listeners[0]({ isActive: true })
    })
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        {
          requestId: entry.id,
          occurrenceId,
          qrToken: entry.token,
          status: 'PRESENT',
        },
        `coach-${event}`,
      ),
    )
    expect(await screen.findByText('Copil Test · Prezent confirmat')).toBeInTheDocument()
  },
)

it.each(['COACH', 'PARENT', 'CLUB', 'ADMIN'])(
  'resumes saved attendance from the public home only for a coach, current role %s',
  async (role) => {
    mocks.load.mockResolvedValue({
      status: 'ok',
      user: { id: `public-${role}`, name: 'Audit', role, needsProfileCompletion: false },
    })
    function PublicHome() {
      const { loading } = useAuth()
      return <p>{loading ? 'Se încarcă' : 'Pagina publică'}</p>
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <AttendanceProvider>
            <MemoryRouter initialEntries={['/']}>
              <Routes>
                <Route path="/" element={<PublicHome />} />
              </Routes>
            </MemoryRouter>
          </AttendanceProvider>
        </AuthProvider>
      </QueryClientProvider>,
    )
    await screen.findByText('Pagina publică')
    if (role === 'COACH') {
      await waitFor(() =>
        expect(mocks.send).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: entry.id }),
          `public-${role}`,
        ),
      )
    } else {
      expect(mocks.get).not.toHaveBeenCalled()
      expect(mocks.send).not.toHaveBeenCalled()
    }
  },
)

it('allows dismissing a rejected scan whose occurrence is absent from the current catalog', async () => {
  let saved = JSON.stringify({
    version: 1,
    entries: [{ ...entry, state: 'rejected', message: 'Ședința a fost eliminată.' }],
  })
  const queue = new AttendanceQueue(
    'coach',
    {
      get: async () => saved,
      set: async (value) => {
        saved = value
      },
    },
    mocks.send,
    vi.fn(),
  )
  await queue.load()
  render(
    <AttendanceContext.Provider value={queue}>
      <AttendanceScanner occurrenceId="another-occurrence" label="Curs curent" />
    </AttendanceContext.Provider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByText('Scanări din alte ședințe'))
  await user.click(screen.getByRole('button', { name: 'Ascunde rezultatul' }))
  await waitFor(() => expect(JSON.parse(saved).entries).toEqual([]))
  expect(screen.getByRole('status')).toHaveTextContent('0 în așteptare · 0 de verificat')
})
