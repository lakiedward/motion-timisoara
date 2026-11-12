import { PREFIX_COD_QR } from '@/lib/cod-qr'

const TOKEN = /^[0-9a-f]{32}$/
const PATH = /\/prezenta\/([0-9a-f]{32})\/?$/
const PUBLIC_SITE = 'https://motionromania.ro'

export type ScannedEntrance =
  | { kind: 'entrance'; token: string }
  | { kind: 'child' }
  | { kind: 'unknown' }

export function entrancePath(token: string): string {
  return `/prezenta/${token}`
}

export function entranceUrl(origin: string, token: string): string {
  const base = /^https?:\/\//.test(origin) ? origin.replace(/\/+$/, '') : PUBLIC_SITE
  return `${base}${entrancePath(token)}`
}

export function isEntranceToken(value: string | undefined): value is string {
  return !!value && TOKEN.test(value)
}

export function readScannedEntrance(text: string): ScannedEntrance {
  const value = text.trim()
  if (value.startsWith(PREFIX_COD_QR)) return { kind: 'child' }
  if (TOKEN.test(value)) return { kind: 'entrance', token: value }
  try {
    const url = new URL(value)
    const match = PATH.exec(url.pathname)
    if (match && /^https?:$/.test(url.protocol)) return { kind: 'entrance', token: match[1] }
  } catch {
    return { kind: 'unknown' }
  }
  return { kind: 'unknown' }
}
