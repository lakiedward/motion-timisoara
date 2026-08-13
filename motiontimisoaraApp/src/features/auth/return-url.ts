import { useSearchParams } from 'react-router-dom'

/**
 * Where to send someone once they finish authenticating.
 *
 * A visitor who tries to enrol without an account is bounced to /login with the
 * course in `returnUrl`. From there they may still hop to /signup and on to one
 * of the register pages, so every link along that chain has to carry the
 * destination or the visitor lands in their dashboard instead of the course
 * they came for.
 */
export function useReturnUrl(): string | undefined {
  const [params] = useSearchParams()
  // `redirect` is the older spelling, still produced by some links.
  return params.get('returnUrl') || params.get('redirect') || undefined
}

/** Appends the destination to an auth route so the next hop keeps it. */
export function withReturnUrl(path: string, returnUrl: string | undefined): string {
  return returnUrl ? `${path}?returnUrl=${encodeURIComponent(returnUrl)}` : path
}
