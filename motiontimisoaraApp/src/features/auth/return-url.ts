import { useSearchParams } from 'react-router-dom'

/**
 * A base the app is never served from, used only to resolve candidate
 * destinations. Anything that resolves to a different origin was pointing off
 * this site, however it was spelled.
 */
const PROBE_BASE = 'https://internal.invalid'

/**
 * Where to send someone once they finish authenticating.
 *
 * A visitor who tries to enrol without an account is bounced to /login with the
 * course in `returnUrl`. From there they may still hop to /signup and on to one
 * of the register pages, so every link along that chain has to carry the
 * destination or the visitor lands in their dashboard instead of the course
 * they came for.
 *
 * The value comes from the address bar, and some of the pages that read it
 * navigate on load with no interaction at all, so it is validated here rather
 * than at each call site. Matching the shape of a path with a pattern is not
 * enough: "/%09/evil.com" decodes to a tab, and URL parsing then strips the tab
 * and leaves "//evil.com" — a protocol-relative jump off the site. So the
 * candidate is put through the same parser the browser uses and kept only if it
 * still belongs to this app afterwards.
 */
export function useReturnUrl(): string | undefined {
  const [params] = useSearchParams()
  // `redirect` is the older spelling, still produced by some links.
  const raw = params.get('returnUrl') || params.get('redirect')
  if (!raw || !raw.startsWith('/')) return undefined

  let resolved: URL
  try {
    resolved = new URL(raw, PROBE_BASE)
  } catch {
    return undefined
  }
  if (resolved.origin !== PROBE_BASE) return undefined

  // Hand back the parsed form, so whatever the parser stripped stays stripped.
  return resolved.pathname + resolved.search + resolved.hash
}

/** Appends the destination to an auth route so the next hop keeps it. */
export function withReturnUrl(path: string, returnUrl: string | undefined): string {
  return returnUrl ? `${path}?returnUrl=${encodeURIComponent(returnUrl)}` : path
}
