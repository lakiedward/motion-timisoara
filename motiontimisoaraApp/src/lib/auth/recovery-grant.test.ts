import { describe, expect, it } from 'vitest'
import { createRecoveryGrant, RECOVERY_LIFETIME_MS } from './recovery-grant'

const start = 1_000_000
const session = {
  access_token: 'test-token',
  expires_at: start / 1000 + 3600,
  user: { id: 'user-a' },
}

describe('recovery authorization grant', () => {
  it('rejects an ordinary active session without an issued recovery grant', () => {
    const grant = createRecoveryGrant(() => start)
    expect(grant.valid(session)).toBe(false)
    expect(grant.valid(null)).toBe(false)
  })

  it('binds authorization to both the exact user and access token', () => {
    const grant = createRecoveryGrant(() => start)
    grant.issue(session)
    expect(grant.valid({ ...session })).toBe(true)
    expect(grant.valid({ ...session, access_token: 'new-token' })).toBe(false)
    expect(grant.valid({ ...session, user: { id: 'user-b' } })).toBe(false)
    expect(grant.valid(null)).toBe(false)
  })

  it('expires at ten minutes even when the underlying session lasts longer', () => {
    let now = start
    const grant = createRecoveryGrant(() => now)
    grant.issue(session)
    now += RECOVERY_LIFETIME_MS - 1
    expect(grant.valid(session)).toBe(true)
    now += 1
    expect(grant.valid(session)).toBe(false)
  })

  it('expires when the underlying session expires first', () => {
    let now = start
    const grant = createRecoveryGrant(() => now)
    const short = { ...session, expires_at: now / 1000 + 1 }
    grant.issue(short)
    now += 1000
    expect(grant.valid(short)).toBe(false)
  })

  it.each([undefined, 0, start / 1000 - 1])(
    'does not authorize a session with expiry %s',
    (expires_at) => {
      const grant = createRecoveryGrant(() => start)
      const invalid = { ...session, expires_at }
      grant.issue(invalid)
      expect(grant.valid(invalid)).toBe(false)
    },
  )

  it('clears grants and does not persist them in a newly created store', () => {
    const grant = createRecoveryGrant(() => start)
    grant.issue(session)
    expect(createRecoveryGrant(() => start).valid(session)).toBe(false)
    grant.clear()
    expect(grant.valid(session)).toBe(false)
  })

  it('replaces an older grant when another recovery is verified', () => {
    const grant = createRecoveryGrant(() => start)
    const second = { ...session, access_token: 'second-token' }
    grant.issue(session)
    grant.issue(second)
    expect(grant.valid(session)).toBe(false)
    expect(grant.valid(second)).toBe(true)
  })
})
