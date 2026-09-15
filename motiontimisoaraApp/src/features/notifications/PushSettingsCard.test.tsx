import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PushSnapshot } from '@/api/notifications/types'
import { PushSettingsCard } from './PushSettingsCard'

const mocks = vi.hoisted(() => ({
  supported: true,
  state: { status: 'disabled', busy: false, error: null, pendingDisable: false } as PushSnapshot,
  enable: vi.fn(),
  disable: vi.fn(),
  restore: vi.fn(),
  listeners: new Set<() => void>(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent', role: 'PARENT' }, loading: false }),
}))
vi.mock('@/api/notifications', () => ({
  supportsPush: () => mocks.supported,
  pushNotifications: {
    getSnapshot: () => mocks.state,
    subscribe: (fn: () => void) => {
      mocks.listeners.add(fn)
      return () => mocks.listeners.delete(fn)
    },
    enable: mocks.enable,
    disable: mocks.disable,
    restore: mocks.restore,
  },
}))

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PushSettingsCard />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.supported = true
  mocks.state = { status: 'disabled', busy: false, error: null, pendingDisable: false }
})
afterEach(cleanup)

it('renders nothing on web and never requests native consent', () => {
  mocks.supported = false
  const { container } = mount()
  expect(container).toBeEmptyDOMElement()
  expect(mocks.enable).not.toHaveBeenCalled()
})

it('explains the three event types and optional consent before activation', async () => {
  mount()
  expect(
    screen.getByText(/Primești anunțuri de la organizatori, confirmări de prezență/),
  ).toBeInTheDocument()
  expect(screen.getByText(/Android îți va cere permisiunea/)).toBeInTheDocument()
  expect(mocks.enable).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Activează notificările' }))
  })
  expect(mocks.enable).toHaveBeenCalledExactlyOnceWith('parent')
})

it('shows a loading skeleton without an activation control', () => {
  mocks.state = { ...mocks.state, status: 'loading' }
  mount()
  expect(
    screen.getByRole('status', { name: 'Se încarcă setările notificărilor' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('offers global opt-out when this phone is enabled', async () => {
  mocks.state = { ...mocks.state, status: 'enabled' }
  mount()
  expect(screen.getByText(/pe toate telefoanele/)).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Dezactivează notificările' }))
  })
  expect(mocks.disable).toHaveBeenCalledExactlyOnceWith('parent')
})

it('keeps denied permission distinct and tells the parent where to re-enable it', async () => {
  mocks.state = { ...mocks.state, status: 'denied' }
  mount()
  expect(screen.getByText(/Setări → Aplicații → Motion Timișoara → Notificări/)).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  })
  expect(mocks.restore).toHaveBeenCalledExactlyOnceWith('parent')
  expect(mocks.enable).not.toHaveBeenCalled()
})

it('shows the offline opt-out failure and retries disabling, not activation', async () => {
  mocks.state = {
    status: 'error',
    busy: false,
    error: 'Dezactivarea contului nu a fost salvată.',
    pendingDisable: true,
  }
  mount()
  expect(screen.getByRole('alert')).toHaveTextContent('Dezactivarea contului nu a fost salvată.')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  })
  expect(mocks.disable).toHaveBeenCalledExactlyOnceWith('parent')
  expect(mocks.enable).not.toHaveBeenCalled()
})
