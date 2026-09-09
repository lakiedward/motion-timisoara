import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LocationError,
  type LocationPoint,
  type LocationRequest,
  type LocationResponse,
} from '@/api/live-location'
import { SharingController, type SharingDependencies } from './sharing-controller'

const instant = new Date('2026-09-09T12:00:00Z')
const response = (): LocationResponse => ({
  success: true,
  sessionId: 'session',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function fixture() {
  let receive!: (point: Omit<LocationPoint, 'updatedAt'>) => void
  let fail!: (error: Error) => void
  const cancel = vi.fn(async () => undefined)
  const remoteStop = vi.fn(async () => undefined)
  const request = vi.fn<SharingDependencies['request']>(async () => response())
  const capture = vi.fn<SharingDependencies['capture']>(async (_expiry, point, error) => {
    receive = point
    fail = error
    return cancel
  })
  const controller = new SharingController({ request, makeStop: async () => remoteStop, capture })
  return {
    controller,
    request,
    capture,
    cancel,
    remoteStop,
    point: () =>
      receive({
        latitude: 45.75,
        longitude: 21.23,
        accuracy: 8,
        capturedAt: new Date().toISOString(),
      }),
    fail: (error: Error) => fail(error),
  }
}

describe('session-scoped location sharing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(instant)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks the server for consent and expiry before opening GPS, and drops intermediate points', async () => {
    const f = fixture()
    expect(f.capture).not.toHaveBeenCalled()
    await f.controller.start('occurrence')
    expect(f.request).toHaveBeenNthCalledWith(1, {
      action: 'start',
      occurrenceId: 'occurrence',
      requestId: expect.any(String),
      consent: true,
    })
    expect(f.capture).toHaveBeenCalledWith(
      response().expiresAt,
      expect.any(Function),
      expect.any(Function),
    )
    f.point()
    await flush()
    f.point()
    await flush()
    expect(f.request.mock.calls.filter(([body]) => body.action === 'update')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(15_000)
    f.point()
    await flush()
    expect(f.request.mock.calls.filter(([body]) => body.action === 'update')).toHaveLength(2)
    await f.controller.stop()
    expect(f.cancel).toHaveBeenCalledOnce()
    expect(f.remoteStop).toHaveBeenCalledOnce()
    f.point()
    await flush()
    expect(f.request.mock.calls.filter(([body]) => body.action === 'update')).toHaveLength(2)
    expect(f.controller.getSnapshot().active).toBeNull()
  })

  it('cancels GPS and deletes the session at the server deadline', async () => {
    const f = fixture()
    await f.controller.start('occurrence')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(f.cancel).toHaveBeenCalledOnce()
    expect(f.remoteStop).toHaveBeenCalledOnce()
    expect(f.controller.getSnapshot().active).toBeNull()
  })

  it('closes a server session that finishes starting after sign-out or stop', async () => {
    const f = fixture()
    const start = deferred<LocationResponse>()
    f.request.mockImplementationOnce(() => start.promise)
    const starting = f.controller.start('occurrence')
    await flush()
    const stopping = f.controller.stop()
    start.resolve(response())
    await starting
    await stopping
    expect(f.capture).not.toHaveBeenCalled()
    expect(f.remoteStop).toHaveBeenCalledOnce()
    expect(f.controller.getSnapshot().active).toBeNull()
  })

  it('closes GPS if its asynchronous permission request finishes after stop', async () => {
    const f = fixture()
    const capture = deferred<() => Promise<void>>()
    f.capture.mockImplementationOnce(() => capture.promise)
    const starting = f.controller.start('occurrence')
    await flush()
    const stopping = f.controller.stop()
    capture.resolve(f.cancel)
    await starting
    await stopping
    expect(f.cancel).toHaveBeenCalledOnce()
    expect(f.remoteStop).toHaveBeenCalledOnce()
    expect(f.controller.getSnapshot().active).toBeNull()
  })

  it('retains failed cleanup returned by a late capture for retry', async () => {
    const f = fixture()
    const capture = deferred<() => Promise<void>>()
    f.capture.mockImplementationOnce(() => capture.promise)
    const starting = f.controller.start('occurrence')
    await flush()
    expect(f.controller.getSnapshot()).toMatchObject({ busy: true, stopping: false })
    const stopping = f.controller.stop()
    expect(f.controller.getSnapshot()).toMatchObject({ active: null, stopping: true })
    f.cancel.mockRejectedValueOnce(new Error('native unavailable'))
    capture.resolve(f.cancel)
    await starting
    await stopping
    expect(f.controller.getSnapshot().needsStopRetry).toBe(true)
    await f.controller.stop()
    expect(f.cancel).toHaveBeenCalledTimes(2)
    expect(f.controller.getSnapshot().needsStopRetry).toBe(false)
  })

  it('deduplicates simultaneous stops and retains a failed cancellation for explicit retry', async () => {
    const f = fixture()
    await f.controller.start('occurrence')
    f.cancel.mockRejectedValueOnce(new Error('native stop unavailable'))
    const first = f.controller.stop()
    const second = f.controller.stop()
    expect(first).toBe(second)
    await first
    expect(f.controller.getSnapshot().needsStopRetry).toBe(true)
    await f.controller.start('another')
    expect(f.capture).toHaveBeenCalledOnce()
    await f.controller.stop()
    expect(f.cancel).toHaveBeenCalledTimes(2)
    expect(f.remoteStop).toHaveBeenCalledOnce()
    expect(f.controller.getSnapshot().needsStopRetry).toBe(false)
  })

  it('keeps network-failed points out of a queue and stops on revoked server access', async () => {
    const f = fixture()
    await f.controller.start('occurrence')
    f.request.mockRejectedValueOnce(new LocationError('NETWORK', 'offline'))
    f.point()
    await flush()
    expect(f.controller.getSnapshot().active?.lastSentAt).toBeNull()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(f.request).toHaveBeenCalledTimes(2)
    f.request.mockRejectedValueOnce(new LocationError('FORBIDDEN', 'access revoked'))
    f.point()
    await flush()
    expect(f.cancel).toHaveBeenCalledOnce()
    expect(f.remoteStop).toHaveBeenCalledOnce()
    expect(f.controller.getSnapshot().active).toBeNull()
  })

  it('does not let an old in-flight update block a new session or restore its display', async () => {
    const f = fixture()
    await f.controller.start('first')
    const oldUpdate = deferred<LocationResponse>()
    f.request.mockImplementationOnce(() => oldUpdate.promise)
    f.point()
    await flush()
    await f.controller.stop()
    await f.controller.start('second')
    f.point()
    await flush()
    expect(
      f.request.mock.calls
        .filter(([body]) => body.action === 'update')
        .map(([body]) => (body as LocationRequest).occurrenceId),
    ).toEqual(['first', 'second'])
    oldUpdate.resolve(response())
    await flush()
    expect(f.controller.getSnapshot().active?.occurrenceId).toBe('second')
    await f.controller.stop()
  })

  it('stops the remote session when capture fails', async () => {
    const f = fixture()
    await f.controller.start('occurrence')
    f.fail(new Error('permission revoked'))
    await flush()
    expect(f.cancel).toHaveBeenCalledOnce()
    expect(f.remoteStop).toHaveBeenCalledOnce()
    expect(f.controller.getSnapshot().error).toBe('permission revoked')
  })
})
