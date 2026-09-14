const INTERNAL_ORIGIN = 'https://internal.invalid'

export function validReturnPath(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return undefined
  try {
    const resolved = new URL(raw, INTERNAL_ORIGIN)
    if (resolved.origin !== INTERNAL_ORIGIN) return undefined
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return undefined
  }
}
