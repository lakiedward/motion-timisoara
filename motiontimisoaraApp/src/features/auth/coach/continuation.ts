import { validReturnPath } from '@/lib/auth/return-path'

const AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/register',
  '/register-coach',
  '/register-club',
  '/forgot-password',
  '/reset-password',
])

export function coachReturnPath(raw: string | null | undefined): string | undefined {
  const path = validReturnPath(raw)
  if (!path) return undefined
  try {
    const pathname = decodeURIComponent(new URL(path, 'https://internal.invalid').pathname)
      .toLowerCase()
      .replace(/\/+$/, '')
    if (AUTH_PATHS.has(pathname) || pathname === '/auth' || pathname.startsWith('/auth/'))
      return undefined
    return path
  } catch {
    return undefined
  }
}

export function coachContinuation(returnUrl?: string): string {
  const target = coachReturnPath(returnUrl)
  return target ? `/register-coach?returnUrl=${encodeURIComponent(target)}` : '/register-coach'
}

export function isCoachContinuation(raw: string | undefined): boolean {
  const path = validReturnPath(raw)
  return !!path && new URL(path, 'https://internal.invalid').pathname === '/register-coach'
}
