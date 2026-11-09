export const ACCOUNT_DISABLED_MESSAGE =
  'Contul tău a fost dezactivat, așa că te-am deconectat. Dacă nu știi de ce, scrie-ne din pagina Contact.'

type Listener = () => void

const listeners = new Set<Listener>()

export function onAccountDisabled(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function reportAccountDisabled() {
  for (const listener of [...listeners]) listener()
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function watchedFailure(url: string, status: number) {
  if (status === 403 && url.includes('/rest/v1/')) return 'data'
  if (status === 400 && url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token'))
    return 'auth'
  if (status === 403 && /\/auth\/v1\/user(\?|$)/.test(url)) return 'auth'
  return null
}

export async function isAccountDisabledResponse(url: string, response: Response) {
  const kind = watchedFailure(url, response.status)
  if (!kind) return false
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown; error_code?: unknown } | null
  if (!body) return false
  if (kind === 'data') return body.code === 'account_disabled'
  return body.code === 'user_banned' || body.error_code === 'user_banned'
}

export function createAccountDisabledFetch(baseFetch: typeof fetch = (...args) => fetch(...args)) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await baseFetch(input, init)
    if (await isAccountDisabledResponse(requestUrl(input), response)) reportAccountDisabled()
    return response
  }
}
