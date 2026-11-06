import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PushSnapshot } from '@/api/notifications/types'
import { PushSettingsCard } from './PushSettingsCard'

const mocks = vi.hoisted(() => ({
  supported: true,
  web: false,
  homeScreen: false,
  granted: false,
  prompt: vi.fn(),
  toast: vi.fn(),
  state: { status: 'disabled', busy: false, error: null, pendingDisable: false } as PushSnapshot,
  enable: vi.fn(),
  disable: vi.fn(),
  restore: vi.fn(),
  listeners: new Set<() => void>(),
}))

vi.mock('sonner', () => ({ toast: { success: mocks.toast } }))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent', role: 'PARENT' }, loading: false }),
}))
vi.mock('@/api/notifications', () => ({
  supportsPush: () => mocks.supported,
  supportsWebPush: () => mocks.web,
  needsHomeScreenForPush: () => mocks.homeScreen,
  webPushPermissionGranted: () => mocks.granted,
  promptWebPushPermission: mocks.prompt,
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

function mount(hideWhenEnabled = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PushSettingsCard hideWhenEnabled={hideWhenEnabled} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.supported = true
  mocks.web = false
  mocks.homeScreen = false
  mocks.granted = false
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
  expect(screen.getByText(/Setări → Aplicații → Motion România → Notificări/)).toBeInTheDocument()
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

it('uses browser wording on the website and asks permission inside the click', async () => {
  mocks.web = true
  mount()
  expect(screen.getByRole('heading', { name: 'Notificări în browser' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Notificările sunt oprite în acest browser.')
  expect(screen.getByText(/browserul îți va cere permisiunea/)).toBeInTheDocument()
  expect(screen.queryByText(/Android/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Activează notificările' }))
  expect(mocks.prompt).toHaveBeenCalledOnce()
  await act(async () => undefined)
  expect(mocks.enable).toHaveBeenCalledWith('parent')
})

it('explains how to unblock a browser that denied notifications', () => {
  mocks.web = true
  mocks.state = { status: 'denied', busy: false, error: null, pendingDisable: false }
  mount()
  expect(screen.getByText(/Browserul blochează notificările/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

it('tells iPhone visitors in Safari to add Motion to the home screen first', () => {
  mocks.supported = false
  mocks.homeScreen = true
  mount()
  expect(screen.getByRole('heading', { name: 'Notificări pe iPhone' })).toBeInTheDocument()
  expect(screen.getByText(/Adaugă pe ecranul principal/)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('leaves the dashboard once notifications are on and confirms where to turn them off', async () => {
  mocks.web = true
  mocks.enable.mockImplementation(async () => {
    mocks.state = { status: 'enabled', busy: false, error: null, pendingDisable: false }
    mocks.listeners.forEach((fn) => fn())
  })
  const view = mount(true)
  fireEvent.click(screen.getByRole('button', { name: 'Activează notificările' }))
  await act(async () => undefined)
  expect(view.container).toBeEmptyDOMElement()
  expect(mocks.toast).toHaveBeenCalledWith('Notificările sunt active.', {
    description: 'Le poți opri oricând din Profilul meu.',
  })
})

it('keeps the dashboard quiet while enabled but shows it when off or blocked', () => {
  mocks.state = { status: 'enabled', busy: false, error: null, pendingDisable: false }
  expect(mount(true).container).toBeEmptyDOMElement()
  cleanup()
  mocks.state = { status: 'denied', busy: false, error: null, pendingDisable: false }
  mount(true)
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  cleanup()
  mocks.state = { status: 'enabled', busy: false, error: null, pendingDisable: false }
  mount()
  expect(screen.getByRole('button', { name: 'Dezactivează notificările' })).toBeInTheDocument()
})

it('reserves the dashboard slot while loading only when the browser cannot already be enabled', () => {
  mocks.state = { status: 'loading', busy: false, error: null, pendingDisable: false }
  expect(mount(true).container).toBeEmptyDOMElement()
  cleanup()
  mocks.web = true
  mount(true)
  expect(
    screen.getByRole('status', { name: 'Se încarcă setările notificărilor' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  cleanup()
  mocks.granted = true
  expect(mount(true).container).toBeEmptyDOMElement()
})

it('shows a compact dashboard prompt with one sentence and the activation button', () => {
  mocks.web = true
  mount(true)
  const region = screen.getByRole('region', { name: 'Notificări în browser' })
  expect(region).toContainElement(screen.getByRole('heading', { level: 2 }))
  expect(screen.getByRole('status')).toHaveTextContent('Notificările sunt oprite în acest browser.')
  expect(screen.getByRole('button', { name: 'Activează notificările' })).toBeInTheDocument()
  expect(screen.queryByText(/Primești anunțuri de la organizatori/)).not.toBeInTheDocument()
  expect(mocks.prompt).not.toHaveBeenCalled()
})

it('reports a failed update on the dashboard with a retry', async () => {
  mocks.web = true
  mocks.state = {
    status: 'error',
    busy: false,
    error: 'Nu am putut actualiza notificările. Verifică internetul și reîncearcă.',
    pendingDisable: false,
  }
  mount(true)
  expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut actualiza notificările.')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  })
  expect(mocks.restore).toHaveBeenCalledExactlyOnceWith('parent')
})

it('shows the iPhone home-screen steps on the dashboard without an activation button', () => {
  mocks.supported = false
  mocks.homeScreen = true
  mount(true)
  expect(screen.getByRole('region', { name: 'Notificări pe iPhone' })).toBeInTheDocument()
  expect(screen.getByText(/Distribuie → „Adaugă pe ecranul principal”/)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
