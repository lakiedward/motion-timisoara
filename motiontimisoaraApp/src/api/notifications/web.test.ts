import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/platform', () => ({ isNative: () => mocks.native }))

const serverKey =
  'BJQFm6cPhf0YJvCoizGhsMwZG4uOj51wNeixIXtXncQDJKGc_kfa9ReWVIZ5EHemnaF4EUzam4CCgMZquvfzc64'
const p256dh = new Uint8Array(65).fill(4)
const auth = new Uint8Array(16).fill(7)

function subscription(endpoint: string, key = serverKey) {
  return {
    endpoint,
    options: {
      applicationServerKey: Uint8Array.from(
        atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='),
        (c) => c.charCodeAt(0),
      ).buffer,
    },
    getKey: (name: string) => (name === 'p256dh' ? p256dh.buffer : auth.buffer),
    unsubscribe: vi.fn(async () => true),
  }
}

function browser(existing: ReturnType<typeof subscription> | null, permission = 'default') {
  const created = subscription('https://fcm.googleapis.com/fcm/send/new')
  const pushManager = {
    getSubscription: vi.fn(async () => existing),
    subscribe: vi.fn(async () => created),
  }
  const registration = { pushManager }
  const serviceWorker = {
    register: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(async () => registration),
  }
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() {},
    configurable: true,
  })
  const request = vi.fn(async () => 'granted' as NotificationPermission)
  Object.defineProperty(window, 'Notification', {
    value: { permission, requestPermission: request },
    configurable: true,
  })
  return { pushManager, serviceWorker, created, request }
}

beforeEach(() => {
  vi.resetModules()
  mocks.native = false
  localStorage.clear()
})
afterEach(() => {
  Reflect.deleteProperty(window, 'PushManager')
  Reflect.deleteProperty(window, 'Notification')
})

it('subscribes with the Motion server key and returns a compact subscription token', async () => {
  const env = browser(null)
  const { configureWebPush } = await import('./web')
  const device = await configureWebPush({ bindingId: 'binding' })
  expect(env.serviceWorker.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/' })
  const options = env.pushManager.subscribe.mock.calls[0] as unknown as [
    { userVisibleOnly: boolean },
  ]
  expect(options[0].userVisibleOnly).toBe(true)
  expect(device.bindingId).toBe('binding')
  expect(device.installationId).toMatch(/^[0-9a-f-]{36}$/)
  expect(JSON.parse(device.token)).toEqual({
    endpoint: 'https://fcm.googleapis.com/fcm/send/new',
    keys: { p256dh: 'BAQE'.repeat(21) + 'BAQ', auth: 'BwcHBwcHBwcHBwcHBwcHBw' },
  })
  expect(device.token).not.toMatch(/\s/)
  const again = await configureWebPush({ bindingId: 'binding' })
  expect(again.installationId).toBe(device.installationId)
})

it('reuses a current subscription and replaces one made with another server key', async () => {
  const current = subscription('https://fcm.googleapis.com/fcm/send/current')
  let env = browser(current)
  let web = await import('./web')
  expect(JSON.parse((await web.configureWebPush({ bindingId: 'b' })).token).endpoint).toBe(
    'https://fcm.googleapis.com/fcm/send/current',
  )
  expect(env.pushManager.subscribe).not.toHaveBeenCalled()
  vi.resetModules()
  const stale = subscription('https://fcm.googleapis.com/fcm/send/stale', 'B'.repeat(86) + 'A')
  env = browser(stale)
  web = await import('./web')
  await web.configureWebPush({ bindingId: 'b' })
  expect(stale.unsubscribe).toHaveBeenCalledOnce()
  expect(env.pushManager.subscribe).toHaveBeenCalledOnce()
})

it('maps browser permission and unsubscribes on clear', async () => {
  const current = subscription('https://fcm.googleapis.com/fcm/send/current')
  const env = browser(current)
  const web = await import('./web')
  expect(web.supportsWebPush()).toBe(true)
  expect(await web.webPushPermission()).toBe('prompt')
  web.promptWebPushPermission()
  expect(await web.requestWebPushPermission()).toBe('granted')
  expect(env.request).toHaveBeenCalledOnce()
  await web.clearWebPush()
  expect(current.unsubscribe).toHaveBeenCalledOnce()
})

it('stays off inside the native app and when the browser lacks push', async () => {
  browser(null)
  mocks.native = true
  const web = await import('./web')
  expect(web.supportsWebPush()).toBe(false)
  mocks.native = false
  Reflect.deleteProperty(window, 'PushManager')
  expect(web.supportsWebPush()).toBe(false)
})

it('shows the home screen hint only to iPhone Safari outside the installed app', async () => {
  const web = await import('./web')
  const agent = vi.spyOn(navigator, 'userAgent', 'get')
  agent.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')
  window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia
  expect(web.needsHomeScreenForPush()).toBe(true)
  window.matchMedia = vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia
  expect(web.needsHomeScreenForPush()).toBe(false)
  agent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0) Chrome/130')
  window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia
  expect(web.needsHomeScreenForPush()).toBe(false)
  agent.mockRestore()
})
