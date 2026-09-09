import { Capacitor } from '@capacitor/core'
import { BackgroundGeolocation } from '@capgo/background-geolocation'

export type CapturedLocation = {
  latitude: number
  longitude: number
  accuracy: number
  capturedAt: string
}

let captureOwner: symbol | null = null
let pendingCaptureCleanup: (() => Promise<void>) | null = null

function captureError(value: unknown): Error {
  const code = value && typeof value === 'object' && 'code' in value ? String(value.code) : ''
  const message =
    code === 'CAPTURE_EXPIRED'
      ? 'Partajarea locației s-a încheiat.'
      : code === 'CAPTURE_STOPPED'
        ? 'Partajarea locației a fost oprită din notificare.'
        : code === 'NOT_AUTHORIZED' || code === '1'
          ? 'Permite accesul la locație în setările dispozitivului pentru a porni partajarea.'
          : 'Locația nu este disponibilă. Verifică permisiunile și serviciile de localizare.'
  const error = new Error(message)
  error.name = code || 'LOCATION_UNAVAILABLE'
  return error
}

export async function startLocationCapture(
  expiresAt: string,
  onLocation: (point: CapturedLocation) => void,
  onError: (error: Error) => void,
): Promise<() => Promise<void>> {
  const deadline = Date.parse(expiresAt)
  if (!Number.isFinite(deadline) || deadline <= Date.now()) {
    throw captureError({ code: 'CAPTURE_EXPIRED' })
  }
  if (pendingCaptureCleanup) await pendingCaptureCleanup()
  if (captureOwner) throw new Error('Partajarea locației este deja pornită.')
  const owner = Symbol('location-capture')
  captureOwner = owner
  const native = Capacitor.isNativePlatform()
  let closed = false
  let watchId: number | undefined
  let nativeStarting: Promise<void> | undefined
  let stopping: Promise<void> | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  const stop = (): Promise<void> => {
    if (stopping) return stopping
    closed = true
    pendingCaptureCleanup = stop
    clearTimeout(expiryTimer)
    if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
    stopping = (async () => {
      if (nativeStarting) {
        await nativeStarting.catch(() => undefined)
        await BackgroundGeolocation.stop()
      }
      if (captureOwner === owner) {
        captureOwner = null
        pendingCaptureCleanup = null
      }
    })().catch((error) => {
      stopping = undefined
      throw error
    })
    return stopping
  }

  const fail = (value: unknown) => {
    if (closed) return
    const error = captureError(value)
    void stop()
      .catch(() => undefined)
      .finally(() => onError(error))
  }

  const receive = (latitude: number, longitude: number, accuracy: number, timestamp: number) => {
    if (closed) return
    const now = Date.now()
    if (now >= deadline) {
      fail({ code: 'CAPTURE_EXPIRED' })
      return
    }
    if (
      ![latitude, longitude, accuracy, timestamp].every(Number.isFinite) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      accuracy < 0 ||
      accuracy > 10000 ||
      timestamp < now - 120000 ||
      timestamp > now + 30000 ||
      timestamp >= deadline
    )
      return
    onLocation({ latitude, longitude, accuracy, capturedAt: new Date(timestamp).toISOString() })
  }

  const scheduleExpiry = () => {
    expiryTimer = setTimeout(
      () => {
        if (Date.now() >= deadline) fail({ code: 'CAPTURE_EXPIRED' })
        else if (!closed) scheduleExpiry()
      },
      Math.min(deadline - Date.now(), 2147483647),
    )
  }
  scheduleExpiry()
  try {
    if (native) {
      const permissions = await BackgroundGeolocation.requestPermissions({
        permissions:
          Capacitor.getPlatform() === 'ios'
            ? ['location', 'backgroundLocation']
            : ['location', 'notification'],
      })
      if (closed || Date.now() >= deadline) throw captureError({ code: 'CAPTURE_EXPIRED' })
      if (permissions.location !== 'granted' || permissions.notification === 'denied') {
        throw captureError({ code: 'NOT_AUTHORIZED' })
      }
      nativeStarting = BackgroundGeolocation.start(
        {
          expiresAt: deadline,
          backgroundTitle: 'Motion Timișoara — locație partajată',
          backgroundMessage: 'Locația ta este partajată pentru ședința activă. Poți opri oricând.',
          requestPermissions: false,
          stale: false,
          distanceFilter: 0,
          minIntervalMs: 15000,
        },
        (point, error) => {
          if (error) queueMicrotask(() => fail(error))
          else if (point && point.time !== null)
            receive(point.latitude, point.longitude, point.accuracy, point.time)
        },
      )
      await nativeStarting
      if (closed) await stop()
    } else {
      if (!navigator.geolocation) throw captureError(null)
      watchId = navigator.geolocation.watchPosition(
        ({ coords, timestamp }) =>
          receive(coords.latitude, coords.longitude, coords.accuracy, timestamp),
        fail,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      )
      if (closed) navigator.geolocation.clearWatch(watchId)
    }
    return stop
  } catch (error) {
    await stop().catch(() => undefined)
    throw error instanceof Error ? error : captureError(error)
  }
}
