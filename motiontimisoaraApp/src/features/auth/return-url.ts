import { useSearchParams } from 'react-router-dom'

/**
 * A destination is only honoured when it is a path inside this app: it must
 * start with a single "/" that is not followed by another "/" or a "\".
 *
 * That rejects absolute URLs ("https://evil.com"), protocol-relative hosts
 * ("//evil.com"), the backslash spelling browsers normalise into one
 * ("/\evil.com"), and script payloads ("javascript:..."). Without this a
 * crafted link could bounce a visitor straight off the site on page load,
 * since some of these destinations are navigated to without any interaction.
 */
const INTERNAL_PATH = /^\/(?![/\\])/

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
  const raw = params.get('returnUrl') || params.get('redirect')
  if (!raw || !INTERNAL_PATH.test(raw)) return undefined
  return raw
}

/** Appends the destination to an auth route so the next hop keeps it. */
export function withReturnUrl(path: string, returnUrl: string | undefined): string {
  return returnUrl ? `${path}?returnUrl=${encodeURIComponent(returnUrl)}` : path
}
