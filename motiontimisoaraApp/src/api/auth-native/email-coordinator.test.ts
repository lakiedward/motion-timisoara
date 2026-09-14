import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import {
  createEmailCoordinator,
  EMAIL_CALLBACK,
  EMAIL_FLOW_LIFETIME_MS,
  EMAIL_LINK_ERROR,
  type EmailDependencies,
  type EmailFlow,
} from './email-coordinator'
import { RECOVERY_LIFETIME_MS } from '@/lib/auth/recovery-grant'

const nonce = 'a'.repeat(64)
const start = 1_000_000
const session: Session = {
  access_token: 'test-access',
  refresh_token: 'test-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: start / 1000 + 3600,
  user: { id: 'user-a', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' },
}

function pending(overrides: Partial<EmailFlow> = {}): EmailFlow {
  return { nonce, kind: 'recovery', status: 'awaiting', createdAt: start, ...overrides }
}

function callback(query = `nonce=${nonce}&code=test-code`) {
  return `${EMAIL_CALLBACK}?${query}`
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function harness(initial: EmailFlow | null = null) {
  let saved = initial
  let current: Session | null = null
  let now = start
  let tail: Promise<unknown> = Promise.resolve()
  const deps = {
    run<T>(work: () => Promise<T>) {
      const result = tail.then(work)
      tail = result.catch(() => undefined)
      return result
    },
    read: vi.fn(async () => saved),
    write: vi.fn(async (flow: EmailFlow) => {
      saved = { ...flow }
    }),
    clearPending: vi.fn(async () => {
      saved = null
    }),
    clearSession: vi.fn(async () => {
      current = null
    }),
    exchange: vi.fn<EmailDependencies['exchange']>(async () => {
      current = session
      return session
    }),
    session: vi.fn(async () => current),
    update: vi.fn<EmailDependencies['update']>(async () => ({ error: null })),
    nonce: () => nonce,
    now: () => now,
    result: vi.fn<EmailDependencies['result']>(),
  } satisfies EmailDependencies
  return {
    deps,
    coordinator: createEmailCoordinator(deps),
    saved: () => saved,
    advance: (ms: number) => {
      now += ms
    },
    setSession: (value: Session) => {
      current = value
    },
  }
}

describe('native email transaction coordinator', () => {
  it.each(['signup', 'recovery'] as const)(
    'persists a %s transaction before requesting the real email',
    async (kind) => {
      const h = harness()
      const prepare = vi.fn(async (redirect: string) => {
        expect(h.saved()).toEqual(pending({ kind }))
        expect(redirect).toBe(callback(`nonce=${nonce}`))
        return { error: null }
      })
      await h.coordinator.send(kind, prepare)
      expect(prepare).toHaveBeenCalledOnce()
    },
  )

  it('verifies signup and discards its temporary session without authorizing password reset', async () => {
    const h = harness(pending({ kind: 'signup' }))
    expect(await h.coordinator.receive(callback())).toBe(true)
    expect(h.deps.exchange).toHaveBeenCalledExactlyOnceWith('test-code', 'signup')
    expect(h.deps.clearSession).toHaveBeenCalledOnce()
    expect(h.deps.result).toHaveBeenCalledExactlyOnceWith({ kind: 'signup' })
    expect(await h.coordinator.ready()).toBe(false)
  })

  it('consumes recovery before exchanging and grants exactly one password update', async () => {
    const h = harness(pending())
    const exchange = h.deps.exchange.getMockImplementation()!
    h.deps.exchange.mockImplementation(async (code, kind) => {
      expect(h.saved()?.status).toBe('exchanging')
      return exchange(code, kind)
    })
    expect(await h.coordinator.receive(callback())).toBe(true)
    expect(await h.coordinator.ready()).toBe(true)
    expect(await h.coordinator.updatePassword('new-password')).toEqual({ error: null })
    expect(await h.coordinator.updatePassword('another-password')).toEqual({
      error: { message: EMAIL_LINK_ERROR },
    })
    expect(h.deps.update).toHaveBeenCalledExactlyOnceWith('new-password')
    expect(await h.coordinator.ready()).toBe(false)
  })

  it('restores a pending cold-start flow but does not invent a recovery grant', async () => {
    const h = harness(pending())
    h.setSession(session)
    await h.coordinator.restore()
    expect(await h.coordinator.ready()).toBe(false)
    expect(h.saved()).toEqual(pending())
    expect(await h.coordinator.receive(callback())).toBe(true)
    expect(await h.coordinator.ready()).toBe(true)
  })

  it.each([
    pending({ createdAt: start - EMAIL_FLOW_LIFETIME_MS }),
    pending({ createdAt: start + 1 }),
    pending({ status: 'exchanging' }),
    pending({ nonce: 'bad' }),
    pending({ kind: 'other' as EmailFlow['kind'] }),
  ])('cleans stale, malformed or consumed state on restore: %j', async (flow) => {
    const h = harness(flow)
    await h.coordinator.restore()
    expect(h.saved()).toBeNull()
    expect(h.deps.exchange).not.toHaveBeenCalled()
  })

  it.each([
    'invalid-url',
    'https://auth/email-callback',
    'com.motiontimisoara.app://evil/email-callback',
    'com.motiontimisoara.app://user@auth/email-callback',
    callback(`nonce=wrong&code=c`),
    callback(`nonce=${nonce}&nonce=${nonce}&code=c`),
    callback(`nonce=${nonce}&code=a&code=b`),
    callback(`nonce=${nonce}&code=`),
    callback(`nonce=${nonce}`),
    callback(`nonce=${nonce}&code=${'a'.repeat(4097)}`),
    `${callback()}#access_token=x`,
    `${callback()}&kind=signup`,
    `${callback()}&type=recovery`,
    `${callback()}&returnUrl=https://evil.example`,
    `${callback()}&access_token=x`,
    callback(`nonce=${nonce}&error=expired`),
  ])(
    'rejects an invalid or unbound callback without consuming the pending flow: %s',
    async (url) => {
      const h = harness(pending())
      expect(await h.coordinator.receive(url)).toBe(false)
      expect(h.deps.exchange).not.toHaveBeenCalled()
      expect(h.saved()).toEqual(pending())
    },
  )

  it('rejects expired and unsolicited links', async () => {
    const h = harness(pending())
    h.advance(EMAIL_FLOW_LIFETIME_MS)
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.deps.exchange).not.toHaveBeenCalled()
    expect(await harness().coordinator.receive(callback())).toBe(false)
  })

  it('deduplicates simultaneous delivery and preserves a verified recovery grant on replay', async () => {
    const h = harness(pending())
    expect(
      await Promise.all([h.coordinator.receive(callback()), h.coordinator.receive(callback())]),
    ).toEqual([true, false])
    expect(h.deps.exchange).toHaveBeenCalledOnce()
    expect(await h.coordinator.ready()).toBe(true)
  })

  it('expires a verified recovery grant and rejects an unrelated active session', async () => {
    const h = harness(pending())
    h.setSession(session)
    expect(await h.coordinator.updatePassword('not-authorized')).toEqual({
      error: { message: EMAIL_LINK_ERROR },
    })
    expect(h.deps.update).not.toHaveBeenCalled()
    const recovery = harness(pending())
    await recovery.coordinator.receive(callback())
    recovery.advance(RECOVERY_LIFETIME_MS)
    expect(await recovery.coordinator.ready()).toBe(false)
    await recovery.coordinator.updatePassword('expired')
    expect(recovery.deps.update).not.toHaveBeenCalled()
  })

  it('never sends email when pending-state persistence fails', async () => {
    const h = harness()
    h.deps.write.mockRejectedValue(new Error('storage unavailable'))
    const prepare = vi.fn(async () => ({ error: null }))
    await expect(h.coordinator.send('recovery', prepare)).rejects.toThrow('storage unavailable')
    expect(prepare).not.toHaveBeenCalled()
    expect(h.saved()).toBeNull()
  })

  it('does not exchange when consumption cannot be persisted', async () => {
    const h = harness(pending())
    h.deps.write.mockRejectedValue(new Error('storage unavailable'))
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(h.deps.exchange).not.toHaveBeenCalled()
    expect(await h.coordinator.ready()).toBe(false)
  })

  it('does not grant recovery when consumption cleanup fails after exchange', async () => {
    const h = harness(pending())
    h.deps.clearPending.mockRejectedValueOnce(new Error('storage unavailable'))
    expect(await h.coordinator.receive(callback())).toBe(false)
    expect(await h.coordinator.ready()).toBe(false)
    expect(h.deps.result).toHaveBeenCalledWith({ error: EMAIL_LINK_ERROR })
  })

  it('cleans a rejected email request and propagates its normal result', async () => {
    const h = harness()
    const rejected = { error: { message: 'rate limited' } }
    expect(await h.coordinator.send('signup', async () => rejected)).toBe(rejected)
    expect(h.saved()).toBeNull()
  })

  it('clears the grant even when password update fails', async () => {
    const h = harness(pending())
    await h.coordinator.receive(callback())
    h.deps.update.mockResolvedValue({ error: { message: 'rejected' } })
    expect(await h.coordinator.updatePassword('new-password')).toEqual({
      error: { message: 'rejected' },
    })
    expect(await h.coordinator.ready()).toBe(false)
  })

  it('shares serialization with a competing authentication operation', async () => {
    const h = harness(pending())
    const entered = deferred<void>()
    const release = deferred<void>()
    const other = h.deps.run(async () => {
      entered.resolve()
      await release.promise
    })
    await entered.promise
    const receiving = h.coordinator.receive(callback())
    expect(h.deps.exchange).not.toHaveBeenCalled()
    release.resolve()
    await other
    expect(await receiving).toBe(true)
  })
})
