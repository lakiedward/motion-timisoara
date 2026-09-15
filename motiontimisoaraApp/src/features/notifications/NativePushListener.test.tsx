import { StrictMode } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NativePushListener } from './NativePushListener'

type Handler = (value: never) => void
const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'parent-a', role: 'PARENT' }, loading: false } as {
    user: { id: string; role: string } | null
    loading: boolean
  },
  state: { status: 'loading', busy: false },
  supported: true,
  navigate: vi.fn(),
  invalidate: vi.fn(),
  restore: vi.fn(),
  clear: vi.fn(),
  refreshToken: vi.fn(),
  listeners: new Map<string, Set<Handler>>(),
  stateListeners: new Set<() => void>(),
  seen: new Set<string>(),
  unsubscribeAuth: vi.fn(),
  toast: vi.fn(),
}))

const bindingId = '44444444-4444-4444-8444-444444444444'
const payload = {
  eventId: '66666666-6666-4666-8666-666666666666',
  bindingId,
  entityId: '11111111-1111-4111-8111-111111111111',
  kind: 'announcement',
  path: '/account/announcements',
  title: 'Anunț nou',
  body: 'Deschide aplicația.',
  expiresAt: String(Date.now() + 60_000),
}

vi.mock('@/lib/auth-context', () => ({ useAuth: () => mocks.auth }))
vi.mock('sonner', () => ({ toast: { info: mocks.toast } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@tanstack/react-query', () => {
  const client = { invalidateQueries: mocks.invalidate }
  return { useQueryClient: () => client }
})
vi.mock('@/api/notifications', () => ({
  supportsPush: () => mocks.supported,
  observePushAuth: () => mocks.unsubscribeAuth,
  pushNotifications: {
    restore: mocks.restore,
    clearForSignOut: mocks.clear,
    refreshToken: mocks.refreshToken,
    getSnapshot: () => mocks.state,
    subscribe: (fn: () => void) => {
      mocks.stateListeners.add(fn)
      return () => mocks.stateListeners.delete(fn)
    },
    authorizedPayload: (value: { bindingId: string }) =>
      value.bindingId === '44444444-4444-4444-8444-444444444444' ? value : null,
    consume: (value: { bindingId: string; eventId: string }) => {
      if (
        value.bindingId !== '44444444-4444-4444-8444-444444444444' ||
        mocks.seen.has(value.eventId)
      )
        return null
      mocks.seen.add(value.eventId)
      return value
    },
  },
}))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { addListener: addListenerMock },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: addListenerMock } }))

async function addListenerMock(name: string, handler: Handler) {
  const set = mocks.listeners.get(name) ?? new Set<Handler>()
  mocks.listeners.set(name, set)
  set.add(handler)
  return {
    remove: async () => {
      set.delete(handler)
    },
  }
}

async function emit(name: string, event: unknown) {
  await act(async () => {
    mocks.listeners.get(name)?.forEach((fn) => fn(event as never))
  })
}

async function ready() {
  await act(async () => {
    mocks.state = { status: 'enabled', busy: false }
    mocks.stateListeners.forEach((fn) => fn())
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { user: { id: 'parent-a', role: 'PARENT' }, loading: false }
  mocks.state = { status: 'loading', busy: false }
  mocks.supported = true
  mocks.listeners.clear()
  mocks.stateListeners.clear()
  mocks.seen.clear()
  mocks.restore.mockResolvedValue(undefined)
  mocks.clear.mockResolvedValue(undefined)
  mocks.refreshToken.mockResolvedValue(undefined)
})
afterEach(cleanup)

it('waits for verified parent and binding restoration before opening a cold-start tap', async () => {
  mocks.auth = { user: null, loading: true }
  const view = render(<NativePushListener />)
  await emit('pushNotificationActionPerformed', { notification: { data: payload } })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.restore).not.toHaveBeenCalled()
  mocks.auth = { user: { id: 'parent-a', role: 'PARENT' }, loading: false }
  view.rerender(<NativePushListener />)
  expect(mocks.restore).toHaveBeenCalledWith('parent-a')
  expect(mocks.navigate).not.toHaveBeenCalled()
  await ready()
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/account/announcements')
})

it('deduplicates a notification tap delivered again while the app is warm', async () => {
  render(<NativePushListener />)
  await ready()
  await emit('pushNotificationActionPerformed', { notification: { data: payload } })
  await emit('pushNotificationActionPerformed', { notification: { data: payload } })
  expect(mocks.navigate).toHaveBeenCalledTimes(1)
})

it('drops another binding, unrelated destinations and signed-out taps', async () => {
  const view = render(<NativePushListener />)
  await ready()
  await emit('pushNotificationActionPerformed', {
    notification: { data: { ...payload, bindingId: payload.entityId } },
  })
  await emit('pushNotificationActionPerformed', {
    notification: { data: { ...payload, path: 'https://example.com' } },
  })
  mocks.auth = { user: null, loading: false }
  view.rerender(<NativePushListener />)
  await emit('pushNotificationActionPerformed', { notification: { data: payload } })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.clear).toHaveBeenCalled()
})

it('leaves one listener per event after StrictMode mounts and removes all on unmount', async () => {
  const view = render(
    <StrictMode>
      <NativePushListener />
    </StrictMode>,
  )
  await waitFor(() =>
    expect([...mocks.listeners.values()].map((set) => set.size)).toEqual([1, 1, 1, 1]),
  )
  await ready()
  await emit('registration', { value: 'new-fcm-token' })
  expect(mocks.refreshToken).toHaveBeenCalledExactlyOnceWith('new-fcm-token')
  view.unmount()
  await waitFor(() =>
    expect([...mocks.listeners.values()].every((set) => set.size === 0)).toBe(true),
  )
})

it('does not attach native listeners or restore push preferences on web', () => {
  mocks.supported = false
  render(<NativePushListener />)
  expect(mocks.listeners.size).toBe(0)
  expect(mocks.restore).not.toHaveBeenCalled()
})

it('shows one actionable foreground notification and rechecks its binding when clicked', async () => {
  render(<NativePushListener />)
  await ready()
  await emit('pushNotificationReceived', { data: payload })
  await emit('pushNotificationReceived', { data: payload })
  expect(mocks.toast).toHaveBeenCalledTimes(1)
  expect(mocks.toast).toHaveBeenCalledWith(
    'Anunț nou',
    expect.objectContaining({ action: expect.objectContaining({ label: 'Deschide' }) }),
  )
  await act(async () => {
    mocks.toast.mock.calls[0][1].action.onClick()
  })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/account/announcements')
})

it('does not interrupt consent or opt-out when Android resumes or the network returns', async () => {
  render(<NativePushListener />)
  mocks.restore.mockClear()
  mocks.state = { status: 'disabled', busy: true }
  await emit('appStateChange', { isActive: true })
  await act(async () => {
    window.dispatchEvent(new Event('online'))
  })
  expect(mocks.restore).not.toHaveBeenCalled()
})

it('buffers foreground delivery while restoring and rejects a buffered previous-account binding', async () => {
  mocks.auth = { user: null, loading: true }
  const view = render(<NativePushListener />)
  const message = { ...payload, eventId: '77777777-7777-4777-8777-777777777777' }
  await emit('pushNotificationReceived', { data: message })
  await emit('pushNotificationReceived', { data: { ...message, bindingId: payload.entityId } })
  expect(mocks.toast).not.toHaveBeenCalled()
  mocks.auth = { user: { id: 'parent-a', role: 'PARENT' }, loading: false }
  view.rerender(<NativePushListener />)
  await ready()
  expect(mocks.toast).toHaveBeenCalledOnce()
  await emit('pushNotificationReceived', { data: message })
  expect(mocks.toast).toHaveBeenCalledOnce()
})
