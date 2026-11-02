import { isNative } from '@/lib/platform'
import type { PushPermission } from './types'

export const WEB_PUSH_PUBLIC_KEY =
  'BJQFm6cPhf0YJvCoizGhsMwZG4uOj51wNeixIXtXncQDJKGc_kfa9ReWVIZ5EHemnaF4EUzam4CCgMZquvfzc64'
export const WEB_PUSH_WORKER = '/push-sw.js'
const INSTALLATION_KEY = 'motion-web-push-installation'
let pendingPermission: Promise<NotificationPermission> | null = null

export function supportsWebPush() {
  return (
    !isNative() &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function needsHomeScreenForPush() {
  if (isNative() || typeof window === 'undefined' || supportsWebPush()) return false
  const appleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return appleMobile && !standalone
}

export function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

export function bytesToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) throw new Error('Push subscription key missing')
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export function subscriptionToken(subscription: PushSubscription) {
  return JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: bytesToBase64Url(subscription.getKey('p256dh')),
      auth: bytesToBase64Url(subscription.getKey('auth')),
    },
  })
}

function sameServerKey(subscription: PushSubscription) {
  const current = subscription.options?.applicationServerKey
  if (!current) return false
  return bytesToBase64Url(current) === WEB_PUSH_PUBLIC_KEY
}

function installationId() {
  try {
    const stored = localStorage.getItem(INSTALLATION_KEY)
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored
    const created = crypto.randomUUID()
    localStorage.setItem(INSTALLATION_KEY, created)
    return created
  } catch {
    throw new Error('Push installation unavailable')
  }
}

async function workerRegistration() {
  await navigator.serviceWorker.register(WEB_PUSH_WORKER, { scope: '/' })
  return navigator.serviceWorker.ready
}

export async function configureWebPush({ bindingId }: { bindingId: string }) {
  const registration = await workerRegistration()
  let subscription = await registration.pushManager.getSubscription()
  if (subscription && !sameServerKey(subscription)) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(WEB_PUSH_PUBLIC_KEY),
  })
  return { bindingId, installationId: installationId(), token: subscriptionToken(subscription) }
}

export async function clearWebPush() {
  if (!supportsWebPush()) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
}

function mapPermission(value: NotificationPermission): PushPermission {
  return value === 'default' ? 'prompt' : value
}

export async function webPushPermission(): Promise<PushPermission> {
  return supportsWebPush() ? mapPermission(Notification.permission) : 'denied'
}

export function promptWebPushPermission() {
  if (!supportsWebPush() || Notification.permission !== 'default') return
  pendingPermission ??= Notification.requestPermission().finally(() => {
    pendingPermission = null
  })
}

export async function requestWebPushPermission(): Promise<PushPermission> {
  if (!supportsWebPush()) return 'denied'
  if (Notification.permission !== 'default') return mapPermission(Notification.permission)
  const result = await (pendingPermission ?? Notification.requestPermission())
  return result === 'granted' ? 'granted' : 'denied'
}
