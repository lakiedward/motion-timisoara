import { describe, expect, it, vi } from 'vitest'

import {
  createOAuthCoordinator,
  FLOW_LIFETIME_MS,
  GOOGLE_ERROR,
  NATIVE_CALLBACK,
  type OAuthDependencies,
  type PendingFlow,
} from './coordinator'

const nonce = 'a'.repeat(64)
const session = { accessToken: 'audit-token' }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function harness(initial: PendingFlow | null = null) {
  let stored = initial
  let time = 1_000_000
  const deps = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (flow: PendingFlow) => {
      stored = { ...flow }
    }),
    clear: vi.fn(async () => {
      stored = null
    }),
    clearVerifier: vi.fn(async () => undefined),
    prepare: vi.fn<(redirect: string) => Promise<string>>(
      async () => 'https://accounts.google.com/authorize',
    ),
    open: vi.fn<(url: string) => Promise<void>>(async () => undefined),
    close: vi.fn(async () => undefined),
    exchange: vi.fn<(code: string) => Promise<typeof session>>(async () => session),
    hasSession: vi.fn(async () => false),
    commit: vi.fn<(value: typeof session) => Promise<void>>(async () => undefined),
    nonce: vi.fn(() => nonce),
    now: () => time,
    complete: vi.fn<(returnUrl?: string) => void>(() => undefined),
    error: vi.fn<(message: string) => void>(() => undefined),
  } satisfies OAuthDependencies<typeof session>
  return {
    deps,
    coordinator: createOAuthCoordinator(deps),
    stored: () => stored,
    advance: (elapsed: number) => {
      time += elapsed
    },
  }
}

function callback(query = `nonce=${nonce}&code=valid-code`) {
  return `${NATIVE_CALLBACK}?${query}`
}

function pending(overrides: Partial<PendingFlow> = {}): PendingFlow {
  return { nonce, createdAt: 1_000_000, status: 'awaiting', ...overrides }
}

describe('native OAuth transaction', () => {
  it('persists only the validated destination before opening the browser', async () => {
    const h = harness()
    h.deps.open.mockImplementation(async () => {
      expect(h.stored()).toEqual(pending({ returnUrl: '/account/checkout?course=123#price' }))
    })
    await h.coordinator.start('/account/checkout?course=123#price')
    expect(h.deps.prepare).toHaveBeenCalledWith(callback(`nonce=${nonce}`))
    expect(h.coordinator.getState()).toBe('awaiting')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example'])(
    'rejects an external destination %s',
    async (target) => {
      const h = harness()
      await h.coordinator.start(target)
      expect(h.stored()?.returnUrl).toBeUndefined()
      await h.coordinator.receive(callback())
      expect(h.deps.complete).toHaveBeenCalledWith(undefined)
    },
  )

  it('serializes simultaneous starts and keeps the first destination', async () => {
    const h = harness()
    await Promise.all([h.coordinator.start('/account'), h.coordinator.start('/coach')])
    expect(h.deps.prepare).toHaveBeenCalledTimes(1)
    expect(h.deps.open).toHaveBeenCalledTimes(1)
    expect(h.stored()?.returnUrl).toBe('/account')
  })

  it('restores a pending flow after process recreation and completes its destination', async () => {
    const h = harness(pending({ returnUrl: '/account/enrollments' }))
    await h.coordinator.restore()
    expect(h.coordinator.getState()).toBe('awaiting')
    expect(await h.coordinator.receive(callback())).toBe(true)
    expect(h.deps.complete).toHaveBeenCalledWith('/account/enrollments')
    expect(h.deps.prepare).not.toHaveBeenCalled()
  })

  it.each([
    pending({ createdAt: 1_000_000 - FLOW_LIFETIME_MS }),
    pending({ createdAt: 1_000_001 }),
    pending({ createdAt: Number.NaN }),
    pending({ nonce: 'short' }),
    pending({ status: 'exchanging' }),
  ])('clears stale or interrupted persisted transactions on restoration: %j', async (flow) => {
    const h = harness(flow)
    await h.coordinator.restore()
    expect(h.stored()).toBeNull()
    expect(h.coordinator.getState()).toBe('idle')
    expect(h.deps.clearVerifier).toHaveBeenCalledOnce()
    expect(h.deps.exchange).not.toHaveBeenCalled()
  })

  it('consumes a transaction before exchanging and deduplicates callback delivery', async () => {
    const h = harness(pending())
    h.deps.exchange.mockImplementation(async () => {
      expect(h.stored()?.status).toBe('exchanging')
      return session
    })
    const results = await Promise.all([
      h.coordinator.receive(callback()),
      h.coordinator.receive(callback()),
    ])
    expect(results).toEqual([true, false])
    expect(h.deps.exchange).toHaveBeenCalledExactlyOnceWith('valid-code')
    expect(h.deps.commit).toHaveBeenCalledExactlyOnceWith(session)
    expect(h.deps.complete).toHaveBeenCalledOnce()
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.deps.error).not.toHaveBeenCalled()
  })

  it.each([
    'not-a-url',
    'https://auth/callback',
    'com.motiontimisoara.app://evil/callback',
    'com.motiontimisoara.app://auth/callback/extra',
    'com.motiontimisoara.app://user@auth/callback',
    'com.motiontimisoara.app://auth:123/callback',
    `${callback()}#access_token=injected`,
    callback(`nonce=wrong&code=valid-code`),
    callback(`nonce=${nonce}&nonce=${nonce}&code=valid-code`),
    callback(`nonce=${nonce}&code=first&code=second`),
    callback(`nonce=${nonce}&code=`),
    callback(`nonce=${nonce}`),
    callback(`nonce=${nonce}&code=${'x'.repeat(4097)}`),
  ])(
    'ignores an invalid callback without destroying a valid pending transaction: %s',
    async (url) => {
      const h = harness(pending())
      expect(await h.coordinator.receive(url)).toBe(false)
      expect(h.stored()).toEqual(pending())
      expect(h.deps.clearVerifier).not.toHaveBeenCalled()
      expect(h.deps.exchange).not.toHaveBeenCalled()
      expect(h.deps.commit).not.toHaveBeenCalled()
      expect(h.deps.error).not.toHaveBeenCalled()
    },
  )

  it('ignores callbacks when no transaction exists', async () => {
    const h = harness()
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.deps.exchange).not.toHaveBeenCalled()
  })

  it('rejects an expired matching callback and requires a new flow', async () => {
    const h = harness(pending())
    h.advance(FLOW_LIFETIME_MS)
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.stored()).toBeNull()
    expect(h.deps.exchange).not.toHaveBeenCalled()
    expect(h.deps.error).toHaveBeenCalledWith(GOOGLE_ERROR)
  })

  it('uses the persisted destination rather than callback-controlled navigation', async () => {
    const h = harness(pending({ returnUrl: '/account' }))
    await h.coordinator.receive(`${callback()}&returnUrl=https://evil.example`)
    expect(h.deps.complete).toHaveBeenCalledWith('/account')
  })

  it('revalidates a corrupted persisted destination', async () => {
    const h = harness(pending({ returnUrl: '//evil.example' }))
    await h.coordinator.receive(callback())
    expect(h.deps.complete).toHaveBeenCalledWith(undefined)
  })

  it('does not start Google sign-in over an existing session', async () => {
    const h = harness()
    h.deps.hasSession.mockResolvedValue(true)
    await h.coordinator.start()
    expect(h.deps.prepare).not.toHaveBeenCalled()
    expect(h.deps.commit).not.toHaveBeenCalled()
  })

  it('does not exchange a callback over an existing session', async () => {
    const h = harness(pending())
    h.deps.hasSession.mockResolvedValue(true)
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.deps.exchange).not.toHaveBeenCalled()
    expect(h.deps.commit).not.toHaveBeenCalled()
    expect(h.deps.error).not.toHaveBeenCalled()
  })

  it('does not overwrite a session established during exchange', async () => {
    const h = harness(pending())
    h.deps.hasSession.mockResolvedValueOnce(false).mockResolvedValue(true)
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.deps.exchange).toHaveBeenCalledOnce()
    expect(h.deps.commit).not.toHaveBeenCalled()
    expect(h.deps.complete).not.toHaveBeenCalled()
  })

  it('invalidates an in-flight exchange immediately when cancellation is requested', async () => {
    const h = harness(pending())
    const entered = deferred<void>()
    const response = deferred<typeof session>()
    h.deps.exchange.mockImplementation(() => {
      entered.resolve()
      return response.promise
    })
    const receiving = h.coordinator.receive(callback())
    await entered.promise
    const cancelled = h.coordinator.cancel()
    response.resolve(session)
    expect(await receiving).toBe(false)
    await cancelled
    expect(h.deps.commit).not.toHaveBeenCalled()
    expect(h.deps.complete).not.toHaveBeenCalled()
    expect(h.deps.error).not.toHaveBeenCalled()
    expect(h.stored()).toBeNull()
  })

  it('invalidates a callback queued immediately before cancellation', async () => {
    const h = harness(pending())
    await Promise.all([h.coordinator.receive(callback()), h.coordinator.cancel()])
    expect(h.deps.commit).not.toHaveBeenCalled()
    expect(h.deps.complete).not.toHaveBeenCalled()
  })

  it('does not open a sign-in queued immediately before cancellation', async () => {
    const h = harness()
    await Promise.all([h.coordinator.start(), h.coordinator.cancel()])
    expect(h.deps.open).not.toHaveBeenCalled()
  })

  it('does not launch the browser when cancellation arrives during preparation', async () => {
    const h = harness()
    const entered = deferred<void>()
    const prepared = deferred<string>()
    h.deps.prepare.mockImplementation(() => {
      entered.resolve()
      return prepared.promise
    })
    const starting = h.coordinator.start()
    await entered.promise
    const cancelling = h.coordinator.cancel()
    prepared.resolve('https://accounts.google.com/authorize')
    await Promise.all([starting, cancelling])
    expect(h.deps.open).not.toHaveBeenCalled()
    expect(h.stored()).toBeNull()
    expect(h.coordinator.getState()).toBe('idle')
  })

  it('honors cancellation while checking for a competing session before commit', async () => {
    const h = harness(pending())
    const checking = deferred<void>()
    const existing = deferred<boolean>()
    h.deps.hasSession.mockResolvedValueOnce(false).mockImplementationOnce(() => {
      checking.resolve()
      return existing.promise
    })
    const receiving = h.coordinator.receive(callback())
    await checking.promise
    const cancelling = h.coordinator.cancel()
    existing.resolve(false)
    await Promise.all([receiving, cancelling])
    expect(h.deps.commit).not.toHaveBeenCalled()
    expect(h.deps.complete).not.toHaveBeenCalled()
  })

  it('does not open the browser after cancellation during pending-state persistence', async () => {
    const h = harness()
    const writing = deferred<void>()
    const persisted = deferred<void>()
    const write = h.deps.write.getMockImplementation()!
    h.deps.write.mockImplementation(async (flow) => {
      writing.resolve()
      await persisted.promise
      await write(flow)
    })
    const starting = h.coordinator.start()
    await writing.promise
    const cancelling = h.coordinator.cancel()
    persisted.resolve()
    await Promise.all([starting, cancelling])
    expect(h.deps.open).not.toHaveBeenCalled()
  })

  it.each(['prepare', 'open'] as const)(
    'clears state and reports a safe message on %s failure',
    async (operation) => {
      const h = harness()
      h.deps[operation].mockRejectedValue(new Error('sensitive provider detail'))
      await h.coordinator.start()
      expect(h.stored()).toBeNull()
      expect(h.deps.error).toHaveBeenCalledExactlyOnceWith(GOOGLE_ERROR)
      expect(h.coordinator.getState()).toBe('idle')
    },
  )

  it.each(['error=access_denied', 'error_code=access_denied'])(
    'handles provider cancellation %s without token exchange',
    async (error) => {
      const h = harness(pending())
      expect(await h.coordinator.receive(callback(`nonce=${nonce}&${error}`))).toBe(false)
      expect(h.deps.exchange).not.toHaveBeenCalled()
      expect(h.deps.commit).not.toHaveBeenCalled()
      expect(h.deps.error).toHaveBeenCalledWith(GOOGLE_ERROR)
      expect(h.stored()).toBeNull()
    },
  )

  it.each(['exchange', 'commit'] as const)(
    'cleans up after %s failure without announcing completion',
    async (operation) => {
      const h = harness(pending())
      h.deps[operation].mockRejectedValue(new Error('sensitive token detail'))
      expect(await h.coordinator.receive(callback())).toBe(false)
      expect(h.deps.complete).not.toHaveBeenCalled()
      expect(h.deps.error).toHaveBeenCalledExactlyOnceWith(GOOGLE_ERROR)
      expect(h.stored()).toBeNull()
      expect(h.deps.clearVerifier).toHaveBeenCalledOnce()
    },
  )

  it('preserves successful authentication when browser close fails', async () => {
    const h = harness(pending())
    h.deps.close.mockRejectedValue(new Error('browser already closed'))
    expect(await h.coordinator.receive(callback())).toBe(true)
    expect(h.deps.commit).toHaveBeenCalledWith(session)
    expect(h.deps.error).not.toHaveBeenCalled()
  })

  it('notifies subscribers and supports cleanup', async () => {
    const h = harness(pending())
    const states: string[] = []
    const unsubscribe = h.coordinator.subscribe(() => states.push(h.coordinator.getState()))
    await h.coordinator.restore()
    await h.coordinator.receive(callback())
    expect(states).toEqual(['awaiting', 'exchanging', 'committing', 'idle'])
    unsubscribe()
    await h.coordinator.cancel()
    expect(states).toHaveLength(4)
  })

  it('serializes password authentication with newly requested Google flows', async () => {
    const h = harness()
    const entered = deferred<void>()
    const password = deferred<void>()
    const authenticating = h.coordinator.authenticate(async () => {
      entered.resolve()
      await password.promise
      h.deps.hasSession.mockResolvedValue(true)
    })
    await entered.promise
    const starting = h.coordinator.start()
    expect(h.deps.prepare).not.toHaveBeenCalled()
    password.resolve()
    await Promise.all([authenticating, starting])
    expect(h.deps.prepare).not.toHaveBeenCalled()
  })

  it('treats session commit as non-cancellable and completes it consistently', async () => {
    const h = harness(pending())
    const entered = deferred<void>()
    const committed = deferred<void>()
    h.deps.commit.mockImplementation(() => {
      entered.resolve()
      return committed.promise
    })
    const receiving = h.coordinator.receive(callback())
    await entered.promise
    expect(h.coordinator.getState()).toBe('committing')
    const cancelling = h.coordinator.cancel()
    committed.resolve()
    expect(await receiving).toBe(true)
    await cancelling
    expect(h.deps.complete).toHaveBeenCalledOnce()
  })
})
