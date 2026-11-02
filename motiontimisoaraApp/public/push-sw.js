const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const KINDS = new Set(['announcement', 'attendance', 'course', 'camp'])

function routeFor(item) {
  if (item.kind === 'announcement') return item.path === '/account/announcements'
  if (item.kind === 'attendance') return item.path === '/account/attendance'
  if (item.kind === 'course') return item.path === `/cursuri/${item.entityId}`
  return item.path === '/tabere' || /^\/tabere\/[a-z0-9-]{3,2000}$/.test(item.path)
}

function parse(data) {
  let item
  try {
    item = data ? data.json() : null
  } catch {
    return null
  }
  if (!item || typeof item !== 'object' || !KINDS.has(item.kind)) return null
  if (![item.eventId, item.bindingId, item.entityId].every((value) => UUID.test(value))) return null
  if (typeof item.title !== 'string' || !item.title || item.title.length > 160) return null
  if (typeof item.body !== 'string' || item.body.length > 500) return null
  if (typeof item.path !== 'string' || !routeFor(item)) return null
  if (!/^\d{13}$/.test(item.expiresAt) || Number(item.expiresAt) <= Date.now()) return null
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

async function windows() {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return list.filter((client) => new URL(client.url).origin === self.location.origin)
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const payload = parse(event.data)
  if (!payload) return
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.eventId,
        icon: '/apple-touch-icon.png',
        badge: '/favicon-32.png',
        lang: 'ro',
        data: payload,
      }),
      windows().then((list) =>
        list.forEach((client) => client.postMessage({ type: 'motion-push-received', payload })),
      ),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const payload = event.notification.data
  if (!payload || typeof payload.path !== 'string' || !routeFor(payload)) return
  event.waitUntil(
    windows().then(async (list) => {
      const client = list.find((item) => item.focused) ?? list[0]
      if (!client) {
        await self.clients.openWindow(payload.path)
        return
      }
      await client.focus()
      if (Number(payload.expiresAt) > Date.now())
        client.postMessage({ type: 'motion-push-open', payload })
      else await client.navigate(payload.path).catch(() => undefined)
    }),
  )
})
