import { pathToFileURL } from 'node:url'

export class UsageError extends Error {}

export const OLD_FUNCTION_MESSAGE =
  'Funcția din Supabase este versiunea fără probă (a răspuns 405 la GET). Fă întâi deploy-ul funcției, cu aprobarea proprietarului. Nu am scris nimic.'

export function adminConfig(env) {
  return {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    email: env.MT_SYNC_ADMIN_EMAIL || env.MT_TEST_ADMIN_EMAIL,
    password: env.MT_SYNC_ADMIN_PASSWORD || env.MT_TEST_ADMIN_PASSWORD,
  }
}

export function printPresence(config, log) {
  for (const [name, value] of Object.entries(config)) log(`${name}: ${value ? 'prezent' : 'LIPSĂ'}`)
}

export function writeMode(flags) {
  if (flags.has('--proba') && flags.has('--aplica')) throw new UsageError('Ai dat și --proba și --aplica. Alege unul.')
  return flags.has('--aplica') ? 'aplica' : 'proba'
}

export async function signIn(fetchImpl, { url, anonKey, email, password }) {
  const response = await fetchImpl(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    throw new Error(`Autentificarea contului admin a eșuat (${response.status}).`)
  }
  return body.access_token
}

export function functionClient(fetchImpl, config, token, name) {
  const base = `${config.url}/functions/v1/${name}`
  const headers = { apikey: config.anonKey, Authorization: `Bearer ${token}` }
  async function send(method, query, body) {
    const response = await fetchImpl(`${base}${query}`, {
      method,
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const report = await response.json().catch(() => ({ error: `Răspuns invalid (${response.status})` }))
    return { ok: response.ok, status: response.status, report }
  }
  return {
    plan: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return send('GET', query ? `?${query}` : '', undefined)
    },
    apply: (body) => send('POST', '', body),
  }
}

export function modeProblem(mode, live, action) {
  if (live && mode !== 'live') return `Ai dat --live, dar cheia Stripe din Supabase este ${String(mode).toUpperCase()}. Nu am scris nimic.`
  if (mode === 'live' && !live) {
    return action === 'aplica'
      ? 'Cheia Stripe din Supabase este LIVE. Scrierea cere --live --aplica, după aprobarea proprietarului. Nu am scris nimic.'
      : null
  }
  return null
}

export function printPlannedWrites(writes, log) {
  if (!writes.length) {
    log('Scrieri plănuite: niciuna.')
    return
  }
  log(`Scrieri plănuite (${writes.length}):`)
  for (const write of writes) log(`  - [${write.target}] ${write.operation} ${write.id}: ${write.detail}`)
}

export function defaultIo() {
  return {
    env: process.env,
    fetch: globalThis.fetch,
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
  }
}

export function isEntryPoint(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(process.argv[1]).href
}

export async function execute(run, usage, argv, io) {
  try {
    return await run(argv, io)
  } catch (error) {
    if (error instanceof UsageError) {
      io.error(error.message)
      io.error(usage)
      return 2
    }
    io.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}
