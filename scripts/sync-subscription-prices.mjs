#!/usr/bin/env node

const FUNCTION = 'sync-subscription-prices'

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      'Folosire:',
      '  node scripts/sync-subscription-prices.mjs            sincronizează în modul cheii Stripe din Supabase (TEST)',
      '  node scripts/sync-subscription-prices.mjs --live     doar la lansare, când secretul STRIPE_SECRET_KEY este cheia LIVE',
      '  node scripts/sync-subscription-prices.mjs --check    arată ce variabile lipsesc, fără valori',
      '',
      'Variabile: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY și un cont ADMIN:',
      '  MT_SYNC_ADMIN_EMAIL / MT_SYNC_ADMIN_PASSWORD sau, implicit, MT_TEST_ADMIN_EMAIL / MT_TEST_ADMIN_PASSWORD.',
    ].join('\n'),
  )
  process.exit(2)
}

function config() {
  return {
    url: process.env.VITE_SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY,
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

async function main() {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => !['--live', '--check'].includes(arg))
  if (unknown.length) usage(`Argument necunoscut: ${unknown.join(' ')}`)
  const cfg = config()

  if (args.includes('--check')) {
    for (const [name, value] of Object.entries(cfg)) console.log(`${name}: ${value ? 'prezent' : 'LIPSĂ'}`)
    return
  }
  if (!cfg.url || !cfg.anonKey || !cfg.email || !cfg.password) usage('Lipsesc variabile; rulează cu --check.')

  const token = await signIn(cfg)
  const response = await fetch(`${cfg.url}/functions/v1/${FUNCTION}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.includes('--live') ? { confirmLive: true } : {}),
  })
  const report = await response.json().catch(() => ({ error: `Răspuns invalid (${response.status})` }))
  if (!response.ok) {
    console.error(`Eroare ${response.status}: ${report.error ?? 'necunoscută'}`)
    process.exit(1)
  }

  console.log(`Mod Stripe: ${report.mode.toUpperCase()}`)
  console.table(
    report.plans.map((plan) => ({
      plan: plan.code,
      lei: plan.unit_amount / 100,
      produs: `${plan.product_id} (${plan.product})`,
      pret: `${plan.price_id} (${plan.price})`,
      tabel: plan.plan_row,
    })),
  )
  if (report.skipped_inactive.length) console.log(`Planuri inactive, sărite: ${report.skipped_inactive.join(', ')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
