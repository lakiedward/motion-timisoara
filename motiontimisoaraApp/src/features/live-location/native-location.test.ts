import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startLocationCapture } from './native-location'

const { native, platform, permission, start, stop, watch, clear } = vi.hoisted(() => ({
  native: vi.fn(),
  platform: vi.fn(),
  permission: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  watch: vi.fn(),
  clear: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: native, getPlatform: platform },
}))
vi.mock('@capgo/background-geolocation', () => ({
  BackgroundGeolocation: { requestPermissions: permission, start, stop },
}))

let cleanup: (() => Promise<void>) | undefined
const deadline = () => new Date(Date.now() + 60000).toISOString()
const point = () => ({ latitude: 45.75, longitude: 21.23, accuracy: 8, time: Date.now() })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-09T14:00:00Z'))
  vi.clearAllMocks()
  native.mockReturnValue(true)
  platform.mockReturnValue('android')
  permission.mockResolvedValue({ location: 'granted', notification: 'granted' })
  start.mockResolvedValue(undefined)
  stop.mockResolvedValue(undefined)
  watch.mockReturnValue(42)
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: watch, clearWatch: clear },
  })
})

afterEach(async () => {
  await cleanup?.()
  cleanup = undefined
  vi.useRealTimers()
})

it('starts only an explicit bounded native watcher without HTTP credentials or persistence configuration', async () => {
  const receive = vi.fn()
  cleanup = await startLocationCapture(deadline(), receive, vi.fn())
  const [options, callback] = start.mock.calls[0]
  expect(options.expiresAt).toBe(Date.now() + 60000)
  expect(options).not.toHaveProperty('url')
  expect(options).not.toHaveProperty('headers')
  expect(permission).toHaveBeenCalledWith({ permissions: ['location', 'notification'] })
  callback(point())
  expect(receive).toHaveBeenCalledWith({
    latitude: 45.75,
    longitude: 21.23,
    accuracy: 8,
    capturedAt: new Date().toISOString(),
  })
  await cleanup()
  callback(point())
  expect(receive).toHaveBeenCalledTimes(1)
  expect(stop).toHaveBeenCalledTimes(1)
})

it('rejects denied permissions without starting GPS and permits a later deliberate attempt', async () => {
  permission.mockResolvedValueOnce({ location: 'denied' })
  await expect(startLocationCapture(deadline(), vi.fn(), vi.fn())).rejects.toThrow(
    'Permite accesul',
  )
  expect(start).not.toHaveBeenCalled()
  cleanup = await startLocationCapture(deadline(), vi.fn(), vi.fn())
  expect(start).toHaveBeenCalledTimes(1)
})

it('never starts when the permission dialog finishes after expiry', async () => {
  let complete!: (value: { location: string }) => void
  permission.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const pending = startLocationCapture(deadline(), vi.fn(), vi.fn())
  const rejected = expect(pending).rejects.toThrow('s-a încheiat')
  await vi.advanceTimersByTimeAsync(60001)
  complete({ location: 'granted' })
  await rejected
  expect(start).not.toHaveBeenCalled()
})

it('stops a pending native start after a native error and reports notification stop', async () => {
  let complete!: () => void
  start.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      complete = resolve
    }),
  )
  const error = vi.fn()
  const pending = startLocationCapture(deadline(), vi.fn(), error)
  await Promise.resolve()
  start.mock.calls[0][1](undefined, { code: 'CAPTURE_STOPPED' })
  await vi.advanceTimersByTimeAsync(0)
  complete()
  cleanup = await pending
  await vi.advanceTimersByTimeAsync(0)
  expect(stop).toHaveBeenCalledTimes(1)
  expect(error.mock.calls[0][0].name).toBe('CAPTURE_STOPPED')
})

it('drops inaccurate, old, future and missing native timestamps before they leave the adapter', async () => {
  const receive = vi.fn()
  cleanup = await startLocationCapture(deadline(), receive, vi.fn())
  const callback = start.mock.calls[0][1]
  for (const changed of [
    { time: null },
    { time: Date.now() - 120001 },
    { time: Date.now() + 30001 },
    { accuracy: -1 },
    { latitude: Infinity },
  ]) {
    callback({ ...point(), ...changed })
  }
  expect(receive).not.toHaveBeenCalled()
})

it('stops browser GPS at expiry and clears its watcher only once', async () => {
  native.mockReturnValue(false)
  const error = vi.fn()
  cleanup = await startLocationCapture(deadline(), vi.fn(), error)
  expect(start).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(60000)
  await cleanup()
  expect(clear).toHaveBeenCalledOnce()
  expect(clear).toHaveBeenCalledWith(42)
  expect(error.mock.calls[0][0].name).toBe('CAPTURE_EXPIRED')
})

it('retries failed native cleanup before another capture can acquire ownership', async () => {
  cleanup = await startLocationCapture(deadline(), vi.fn(), vi.fn())
  stop.mockRejectedValueOnce(new Error('Native stop failed'))
  await expect(cleanup()).rejects.toThrow('Native stop failed')
  expect(start).toHaveBeenCalledTimes(1)
  stop.mockRejectedValueOnce(new Error('Still stopping'))
  await expect(startLocationCapture(deadline(), vi.fn(), vi.fn())).rejects.toThrow('Still stopping')
  expect(start).toHaveBeenCalledTimes(1)
  await cleanup()
  cleanup = await startLocationCapture(deadline(), vi.fn(), vi.fn())
  expect(start).toHaveBeenCalledTimes(2)
})

it('recovers cleanup after a failed startup without losing a native watcher', async () => {
  start.mockRejectedValueOnce(new Error('Native start failed'))
  stop.mockRejectedValueOnce(new Error('Native cleanup failed'))
  await expect(startLocationCapture(deadline(), vi.fn(), vi.fn())).rejects.toThrow(
    'Native start failed',
  )
  cleanup = await startLocationCapture(deadline(), vi.fn(), vi.fn())
  expect(stop).toHaveBeenCalledTimes(2)
  expect(start).toHaveBeenCalledTimes(2)
})
