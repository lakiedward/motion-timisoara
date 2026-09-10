import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
  post: vi.fn(),
  native: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    functions: { invoke: mocks.invoke },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}))
vi.mock('@/lib/platform', () => ({ isNative: mocks.native }))
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { post: mocks.post } }))
import { locationRequest, prepareLocationStop, subscribeToLocation } from './index'
import { campLocationKey } from './target'

const session = (id = 'coach', token = 'coach-token') => ({
  data: { session: { user: { id }, access_token: token } },
  error: null,
})
const success = { success: true, sessionId: 'session', expiresAt: '2026-09-09T15:00:00Z' }
const read = { action: 'read' as const, occurrenceId: 'occurrence', sessionId: 'session' }

describe('location transport', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getSession.mockResolvedValue(session())
    mocks.native.mockReturnValue(false)
    mocks.invoke.mockResolvedValue({ data: success, error: null })
  })

  it('binds every request to the intended authenticated account', async () => {
    mocks.getSession.mockResolvedValue(session('someone-else'))
    await expect(locationRequest(read, 'coach')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('sends explicit camp and coach targets for capture and the retained stop capability', async () => {
    const target = campLocationKey('camp-id', 'coach-id')
    await locationRequest({ action: 'status', occurrenceId: target }, 'coach')
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'coach-live-location',
      expect.objectContaining({
        body: { action: 'status', campId: 'camp-id', coachId: 'coach-id' },
      }),
    )
    const stop = await prepareLocationStop(target, 'coach')
    mocks.getSession.mockResolvedValue(session('replacement', 'different-token'))
    await stop('session')
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'coach-live-location',
      expect.objectContaining({
        body: { action: 'stop', campId: 'camp-id', coachId: 'coach-id', sessionId: 'session' },
        headers: { Authorization: 'Bearer coach-token' },
      }),
    )
  })

  it('preserves server rejection codes without treating an HTTP error as success', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ code: 'NOT_ELIGIBLE', message: 'Fără acces la această ședință.' }),
          { status: 403 },
        ),
      },
    })
    await expect(locationRequest(read, 'coach')).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' })
  })

  it('uses native HTTP with a bounded timeout and only the current session token', async () => {
    mocks.native.mockReturnValue(true)
    mocks.post.mockResolvedValue({ status: 200, data: JSON.stringify(success) })
    await expect(locationRequest(read, 'coach')).resolves.toEqual(success)
    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        data: read,
        headers: expect.objectContaining({ Authorization: 'Bearer coach-token' }),
        connectTimeout: 15000,
        readTimeout: 15000,
      }),
    )
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('rejects malformed native responses and impossible map points', async () => {
    mocks.native.mockReturnValue(true)
    mocks.post.mockResolvedValue({ status: 200, data: '<html>unavailable</html>' })
    await expect(locationRequest(read)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    mocks.native.mockReturnValue(false)
    mocks.invoke.mockResolvedValue({
      data: {
        ...success,
        location: {
          latitude: 100,
          longitude: 21,
          accuracy: 8,
          capturedAt: success.expiresAt,
          updatedAt: success.expiresAt,
        },
      },
    })
    await expect(locationRequest(read)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('retains only a stop capability across logout and never uses a replacement account token', async () => {
    const stop = await prepareLocationStop('occurrence', 'coach')
    mocks.getSession.mockResolvedValue(session('parent', 'parent-token'))
    await stop('session')
    expect(mocks.invoke).toHaveBeenCalledWith(
      'coach-live-location',
      expect.objectContaining({
        body: { action: 'stop', occurrenceId: 'occurrence', sessionId: 'session' },
        headers: { Authorization: 'Bearer coach-token' },
      }),
    )
    mocks.getSession.mockResolvedValue(session('coach', 'refreshed-coach-token'))
    await stop('session')
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'coach-live-location',
      expect.objectContaining({ headers: { Authorization: 'Bearer refreshed-coach-token' } }),
    )
  })

  it('subscribes privately to invalidations and ignores events after teardown', () => {
    let event!: () => void
    let status!: () => void
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, callback: () => void) => {
        event = callback
        return channel
      }),
      subscribe: vi.fn((callback: () => void) => {
        status = callback
        return channel
      }),
    }
    mocks.channel.mockReturnValue(channel)
    const invalidate = vi.fn()
    const unsubscribe = subscribeToLocation('session', invalidate)
    expect(mocks.channel).toHaveBeenCalledWith('coach-live-location:session', {
      config: { private: true },
    })
    expect(channel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'invalidate' },
      expect.any(Function),
    )
    event()
    status()
    expect(invalidate).toHaveBeenCalledTimes(2)
    unsubscribe()
    event()
    status()
    expect(invalidate).toHaveBeenCalledTimes(2)
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel)
  })

  it.each(['SESSION_EXPIRED', 'SESSION_NOT_FOUND'])(
    'accepts confirmed absence %s during stop cleanup',
    async (code) => {
      const stop = await prepareLocationStop('occurrence', 'coach')
      mocks.invoke.mockResolvedValue({
        data: null,
        error: {
          context: new Response(JSON.stringify({ code, message: 'Closed session' }), {
            status: 409,
          }),
        },
      })
      await expect(stop('session')).resolves.toBeUndefined()
    },
  )

  it('keeps a failed stop retryable when the server has not confirmed absence', async () => {
    const stop = await prepareLocationStop('occurrence', 'coach')
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ code: 'UNAUTHORIZED', message: 'Session expired' }),
          { status: 401 },
        ),
      },
    })
    await expect(stop('session')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
