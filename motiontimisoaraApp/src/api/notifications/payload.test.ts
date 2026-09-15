import { describe, expect, it } from 'vitest'
import { parsePushPayload } from './payload'
import { pushSessionId } from './types'

const uuid = '11111111-1111-4111-8111-111111111111'
const now = 1_800_000_000_000
const payload = {
  eventId: uuid,
  bindingId: uuid,
  entityId: uuid,
  kind: 'announcement',
  path: '/account/announcements',
  title: 'Anunț nou',
  body: 'Deschide aplicația.',
  expiresAt: String(now + 60_000),
}

describe('push destination contract', () => {
  it.each([
    ['announcement', '/account/announcements'],
    ['attendance', '/account/attendance'],
    ['course', `/cursuri/${uuid}`],
    ['camp', '/tabere/tabara--vara-'],
    ['camp', '/tabere'],
  ])('accepts %s destination %s', (kind, path) => {
    expect(parsePushPayload({ ...payload, kind, path }, now)?.path).toBe(path)
  })

  it.each([
    'https://example.com/account/announcements',
    '//evil.example',
    '/account/announcements?returnUrl=https://evil.example',
    '/account/announcements#x',
    '/admin',
    '/account/attendance',
    '/account/../admin',
  ])('rejects unrelated or external announcement path %s', (path) => {
    expect(parsePushPayload({ ...payload, path }, now)).toBeNull()
  })

  it.each(['/tabere/a', '/tabere/a%2fb', '/tabere/a/b', '/tabere/a?b', '/tabere/Aaa'])(
    'rejects malformed camp path %s',
    (path) => {
      expect(parsePushPayload({ ...payload, kind: 'camp', path }, now)).toBeNull()
    },
  )

  it('requires course path to match the entity and rejects unknown kinds', () => {
    expect(
      parsePushPayload(
        { ...payload, kind: 'course', path: '/cursuri/22222222-2222-4222-8222-222222222222' },
        now,
      ),
    ).toBeNull()
    expect(parsePushPayload({ ...payload, kind: 'admin' }, now)).toBeNull()
  })

  it.each([
    String(now),
    String(now - 1),
    'invalid',
    '999999999999999999999',
    new Date(now + 1000).toISOString(),
  ])('rejects expired or malformed expiry %s', (expiresAt) => {
    expect(parsePushPayload({ ...payload, expiresAt }, now)).toBeNull()
  })

  it('rejects malformed identities and excessive display text', () => {
    expect(parsePushPayload({ ...payload, bindingId: 'other' }, now)).toBeNull()
    expect(parsePushPayload({ ...payload, eventId: '' }, now)).toBeNull()
    expect(parsePushPayload({ ...payload, title: 'x'.repeat(161) }, now)).toBeNull()
    expect(parsePushPayload({ ...payload, body: 'x'.repeat(501) }, now)).toBeNull()
  })
})

it('reads only a valid session identifier from a JWT and fails closed', () => {
  expect(pushSessionId(`head.${btoa(JSON.stringify({ session_id: uuid }))}.signature`)).toBe(uuid)
  expect(pushSessionId('invalid')).toBeNull()
  expect(pushSessionId(`head.${btoa(JSON.stringify({ session_id: 'bad' }))}.signature`)).toBeNull()
})
