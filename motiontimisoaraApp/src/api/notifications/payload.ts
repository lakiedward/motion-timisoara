import { isUuid, type PushPayload } from './types'

export function parsePushPayload(value: unknown, now = Date.now()): PushPayload | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (!isUuid(item.eventId) || !isUuid(item.bindingId) || !isUuid(item.entityId)) return null
  if (typeof item.path !== 'string' || typeof item.expiresAt !== 'string') return null
  if (typeof item.title !== 'string' || typeof item.body !== 'string') return null
  if (!item.title || item.title.length > 160 || item.body.length > 500) return null
  if (
    item.kind !== 'announcement' &&
    item.kind !== 'attendance' &&
    item.kind !== 'course' &&
    item.kind !== 'camp'
  )
    return null
  const expiry = /^\d{13}$/.test(item.expiresAt) ? Number(item.expiresAt) : NaN
  if (!Number.isFinite(expiry) || expiry <= now) return null
  const validPath =
    (item.kind === 'announcement' && item.path === '/account/announcements') ||
    (item.kind === 'attendance' && item.path === '/account/attendance') ||
    (item.kind === 'course' && item.path === `/cursuri/${item.entityId}`) ||
    (item.kind === 'camp' &&
      (item.path === '/tabere' || /^\/tabere\/[a-z0-9-]{3,2000}$/.test(item.path)))
  if (!validPath) return null
  return {
    eventId: item.eventId,
    bindingId: item.bindingId,
    entityId: item.entityId,
    kind: item.kind,
    path: item.path,
    title: item.title,
    body: item.body,
    expiresAt: item.expiresAt,
  }
}
