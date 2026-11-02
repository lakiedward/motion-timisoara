#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FUNCTION = 'setup-subscription-webhook'
const SECRET_NAME = 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET'
const SUPABASE_CLI = 'supabase@2.122.0'

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      'Folosire:',
      '  node scripts/setup-subscription-webhook.mjs             creează endpointul în modul cheii Stripe din Supabase (TEST)',
      '  node scripts/setup-subscription-webhook.mjs --replace   înlocuiește endpointul existent (secret nou)',
      '  node scripts/setup-subscription-webhook.mjs --live      doar la lansare, când STRIPE_SECRET_KEY este cheia LIVE',
      '  node scripts/setup-subscription-webhook.mjs --check     arată ce variabile lipsesc, fără valori',
      '',
      `Secretul endpointului merge direct în ${SECRET_NAME} prin Supabase CLI și nu se afișează.`,
      'Variabile: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN și un cont ADMIN:',
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

function storeSecret(projectRef, secret) {
  const dir = mkdtempSync(join(tmpdir(), 'motion-webhook-'))
  const file = join(dir, 'secret.env')
  try {
    writeFileSync(file, `${SECRET_NAME}=${secret}\n`, { mode: 0o600 })
    const result = spawnSync(
      'npx',
      ['-y', SUPABASE_CLI, 'secrets', 'set', '--project-ref', projectRef, '--env-file', file],
      { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
    )
    if (result.status !== 0) throw new Error(`Supabase CLI a eșuat la salvarea secretului (cod ${result.status}).`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main() {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => !['--live', '--replace', '--check'].includes(arg))
  if (unknown.length) usage(`Argument necunoscut: ${unknown.join(' ')}`)
  const cfg = config()

  if (args.includes('--check')) {
    for (const [name, value] of Object.entries(cfg)) console.log(`${name}: ${value ? 'prezent' : 'LIPSĂ'}`)
    return
  }
  if (Object.values(cfg).some((value) => !value)) usage('Lipsesc variabile; rulează cu --check.')
  const projectRef = new URL(cfg.url).hostname.split('.')[0]

  const token = await signIn(cfg)
  const response = await fetch(`${cfg.url}/functions/v1/${FUNCTION}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replace: args.includes('--replace'), ...(args.includes('--live') ? { confirmLive: true } : {}) }),
  })
  const report = await response.json().catch(() => ({ error: `Răspuns invalid (${response.status})` }))
  if (!response.ok) {
    console.error(`Eroare ${response.status}: ${report.error ?? 'necunoscută'}`)
    if (report.endpoint_ids) console.error(`Endpointuri existente: ${report.endpoint_ids.join(', ')}`)
    process.exit(1)
  }

  storeSecret(projectRef, report.secret)
  console.log(`Mod Stripe: ${report.mode.toUpperCase()}`)
  console.log(`Endpoint: ${report.endpoint_id} → ${report.url}`)
  console.log(`Evenimente: ${report.events.join(', ')}`)
  if (report.replaced.length) console.log(`Înlocuite: ${report.replaced.join(', ')}`)
  console.log(`${SECRET_NAME} salvat în proiectul ${projectRef} (valoarea nu se afișează).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
