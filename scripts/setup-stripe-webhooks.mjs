#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FUNCTION = 'setup-subscription-webhook'
const SUPABASE_CLI = 'supabase@2.122.0'
const KINDS = ['subscriptions', 'payments', 'connect']
const SECRET_NAMES = {
  subscriptions: 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET',
  payments: 'STRIPE_WEBHOOK_SECRET',
  connect: 'STRIPE_CONNECT_WEBHOOK_SECRET',
}
const FLAGS = ['--live', '--replace', '--check', '--list']

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      'Folosire:',
      '  node scripts/setup-stripe-webhooks.mjs --list                     arată endpointurile din modul cheii Stripe din Supabase (doar citire)',
      '  node scripts/setup-stripe-webhooks.mjs --kind <tip>               creează endpointul pentru tip (implicit subscriptions)',
      '  node scripts/setup-stripe-webhooks.mjs --kind all                 creează toate trei: subscriptions, payments, connect',
      '  node scripts/setup-stripe-webhooks.mjs --kind <tip> --replace     înlocuiește endpointul existent (secret nou)',
      '  node scripts/setup-stripe-webhooks.mjs --remove we_A,we_B         șterge endpointurile date (de ex. cele moarte)',
      '  node scripts/setup-stripe-webhooks.mjs ... --live                 obligatoriu pentru scrieri când STRIPE_SECRET_KEY este cheia LIVE',
      '  node scripts/setup-stripe-webhooks.mjs --check                    arată ce variabile lipsesc, fără valori',
      '',
      `Tipuri: ${KINDS.join(', ')}. Secretul fiecărui endpoint merge direct în ${Object.values(SECRET_NAMES).join(' / ')}`,
      'prin Supabase CLI și nu se afișează.',
      'Variabile: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN (doar la creare) și un cont ADMIN:',
      '  MT_SYNC_ADMIN_EMAIL / MT_SYNC_ADMIN_PASSWORD sau, implicit, MT_TEST_ADMIN_EMAIL / MT_TEST_ADMIN_PASSWORD.',
    ].join('\n'),
  )
  process.exit(2)
}

function config() {
  return {
    url: process.env.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY,
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    email: process.env.MT_SYNC_ADMIN_EMAIL || process.env.MT_TEST_ADMIN_EMAIL,
    password: process.env.MT_SYNC_ADMIN_PASSWORD || process.env.MT_TEST_ADMIN_PASSWORD,
  }
}

function parseArgs(argv) {
  const options = { flags: new Set(), kind: null, remove: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--kind' || arg === '--remove') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) usage(`${arg} cere o valoare.`)
      options[arg.slice(2)] = value
      index += 1
    } else if (FLAGS.includes(arg)) {
      options.flags.add(arg)
    } else {
      usage(`Argument necunoscut: ${arg}`)
    }
  }
  const actions = [options.flags.has('--list'), options.remove !== null, options.kind !== null].filter(Boolean)
  if (actions.length > 1) usage('Alege o singură acțiune: --list, --remove sau --kind.')
  if (options.kind && options.kind !== 'all' && !KINDS.includes(options.kind)) usage(`Tip necunoscut: ${options.kind}`)
  return options
}

async function signIn({ url, anonKey, email, password }) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
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

function storeSecret(projectRef, name, secret) {
  const dir = mkdtempSync(join(tmpdir(), 'motion-webhook-'))
  const file = join(dir, 'secret.env')
  try {
    writeFileSync(file, `${name}=${secret}\n`, { mode: 0o600 })
    const result = spawnSync(
      'npx',
      ['-y', SUPABASE_CLI, 'secrets', 'set', '--project-ref', projectRef, '--env-file', file],
      { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32' },
    )
    if (result.status !== 0) throw new Error(`Supabase CLI a eșuat la salvarea secretului (cod ${result.status}).`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function callSetup(cfg, token, body) {
  const response = await fetch(`${cfg.url}/functions/v1/${FUNCTION}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const report = await response.json().catch(() => ({ error: `Răspuns invalid (${response.status})` }))
  if (!response.ok) {
    console.error(`Eroare ${response.status}: ${report.error ?? 'necunoscută'}`)
    if (report.endpoint_ids) console.error(`Endpointuri existente: ${report.endpoint_ids.join(', ')}`)
    if (report.missing) console.error(`Inexistente: ${report.missing.join(', ')}`)
    process.exit(1)
  }
  return report
}

function printList(report) {
  console.log(`Mod Stripe: ${report.mode.toUpperCase()}, ${report.endpoints.length} endpointuri`)
  for (const endpoint of report.endpoints) {
    console.log(`- ${endpoint.id} [${endpoint.status ?? '?'}] ${endpoint.kind ?? 'necunoscut'} → ${endpoint.url}`)
    console.log(`    evenimente: ${endpoint.enabled_events.join(', ') || '-'}`)
  }
}

async function createKind(cfg, token, projectRef, kind, live, replace) {
  const report = await callSetup(cfg, token, { kind, replace, ...(live ? { confirmLive: true } : {}) })
  if (report.secret_name !== SECRET_NAMES[kind]) throw new Error(`Funcția a întors alt secret: ${report.secret_name}`)
  storeSecret(projectRef, report.secret_name, report.secret)
  console.log(`[${kind}] Mod Stripe: ${report.mode.toUpperCase()}`)
  console.log(`[${kind}] Endpoint: ${report.endpoint_id} → ${report.url}${report.connect ? ' (conturi Connect)' : ''}`)
  console.log(`[${kind}] Evenimente: ${report.events.join(', ')}`)
  if (report.replaced.length) console.log(`[${kind}] Înlocuite: ${report.replaced.join(', ')}`)
  console.log(`[${kind}] ${report.secret_name} salvat în proiectul ${projectRef} (valoarea nu se afișează).`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const cfg = config()

  if (options.flags.has('--check')) {
    for (const [name, value] of Object.entries(cfg)) console.log(`${name}: ${value ? 'prezent' : 'LIPSĂ'}`)
    return
  }
  const creating = !options.flags.has('--list') && options.remove === null
  const required = creating ? Object.values(cfg) : [cfg.url, cfg.anonKey, cfg.email, cfg.password]
  if (required.some((value) => !value)) usage('Lipsesc variabile; rulează cu --check.')
  const projectRef = new URL(cfg.url).hostname.split('.')[0]
  const live = options.flags.has('--live')
  const token = await signIn(cfg)

  if (options.flags.has('--list')) {
    printList(await callSetup(cfg, token, { action: 'list' }))
    return
  }
  if (options.remove !== null) {
    const ids = options.remove.split(',').map((id) => id.trim()).filter(Boolean)
    const report = await callSetup(cfg, token, { action: 'remove', remove: ids, ...(live ? { confirmLive: true } : {}) })
    console.log(`Mod Stripe: ${report.mode.toUpperCase()}. Șterse: ${report.removed.join(', ')}`)
    return
  }
  const kinds = options.kind === 'all' ? KINDS : [options.kind ?? 'subscriptions']
  for (const kind of kinds) await createKind(cfg, token, projectRef, kind, live, options.flags.has('--replace'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
