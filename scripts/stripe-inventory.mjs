#!/usr/bin/env node

const API = 'https://api.stripe.com/v1'
const KEY_NAME = 'STRIPE_INVENTORY_KEY'
const PLAN_CODES = ['COACH', 'CLUB_START', 'CLUB', 'CLUB_PRO']
const DEAD_HOSTS = ['api.motiontimisoara.com', 'triathlonteambe-production.up.railway.app']

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      'Folosire:',
      `  ${KEY_NAME}=rk_live_… node scripts/stripe-inventory.mjs [--json] [--supabase-ref <ref>]`,
      '',
      'Inventar DOAR CITIRE al contului Stripe: cont, verificare, webhook-uri, conturi Connect, prețuri abonamente,',
      'Customer Portal, sold și plăți. Face numai cereri GET. Cheia recomandată este o cheie restricționată',
      'cu drepturi doar de citire. Cheia nu se afișează.',
    ].join('\n'),
  )
  process.exit(2)
}

function parseArgs(argv) {
  const options = { json: false, ref: 'ehdzafadshbaaghzdzdo' }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') options.json = true
    else if (argv[index] === '--supabase-ref' && argv[index + 1]) options.ref = argv[++index]
    else usage(`Argument necunoscut: ${argv[index]}`)
  }
  return options
}

function modeFromKey(key) {
  if (/^(sk|rk)_live_/.test(key)) return 'live'
  if (/^(sk|rk)_test_/.test(key)) return 'test'
  return null
}

async function get(key, path, params = []) {
  const query = params.length ? `?${new URLSearchParams(params)}` : ''
  const response = await fetch(`${API}${path}${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2024-04-10' },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { error: `${response.status} ${body?.error?.message ?? 'eroare necunoscută'}` }
  return body
}

function webhookSummary(endpoints, ref) {
  const base = `https://${ref}.supabase.co/functions/v1/`
  return (endpoints.data ?? []).map((endpoint) => {
    const host = new URL(endpoint.url).hostname
    let role = 'necunoscut'
    if (endpoint.url.startsWith(base)) role = `supabase:${endpoint.url.slice(base.length)}`
    else if (DEAD_HOSTS.includes(host)) role = 'mort (server vechi)'
    return {
      id: endpoint.id,
      status: endpoint.status,
      url: endpoint.url,
      role,
      events: endpoint.enabled_events,
      api_version: endpoint.api_version,
      application: endpoint.application,
    }
  })
}

async function collect(key, ref) {
  const account = await get(key, '/account')
  const webhooks = await get(key, '/webhook_endpoints', [['limit', '100']])
  const connected = await get(key, '/accounts', [['limit', '100']])
  const prices = await get(key, '/prices', [...PLAN_CODES.map((code) => ['lookup_keys[]', code]), ['limit', '10']])
  const portals = await get(key, '/billing_portal/configurations', [['limit', '10']])
  const balance = await get(key, '/balance')
  const payouts = await get(key, '/payouts', [['limit', '5']])
  return {
    mode: modeFromKey(key),
    account: account.error ? account : {
      id: account.id,
      country: account.country,
      default_currency: account.default_currency,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      business_name: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      business_url: account.business_profile?.url ?? null,
      statement_descriptor: account.settings?.payments?.statement_descriptor ?? null,
      payout_schedule: account.settings?.payouts?.schedule ?? null,
      requirements: {
        disabled_reason: account.requirements?.disabled_reason ?? null,
        current_deadline: account.requirements?.current_deadline ?? null,
        past_due: account.requirements?.past_due ?? [],
        currently_due: account.requirements?.currently_due ?? [],
        eventually_due: account.requirements?.eventually_due ?? [],
        errors: (account.requirements?.errors ?? []).map((item) => `${item.requirement}: ${item.code}`),
      },
    },
    webhooks: webhooks.error ? webhooks : webhookSummary(webhooks, ref),
    connected_accounts: connected.error ? connected : (connected.data ?? []).map((item) => ({
      id: item.id,
      type: item.type ?? item.controller?.type ?? null,
      charges_enabled: item.charges_enabled,
      payouts_enabled: item.payouts_enabled,
      created: new Date(item.created * 1000).toISOString().slice(0, 10),
    })),
    subscription_prices: prices.error ? prices : (prices.data ?? []).map((price) => ({
      lookup_key: price.lookup_key,
      id: price.id,
      product: price.product,
      unit_amount: price.unit_amount,
      currency: price.currency,
      tax_behavior: price.tax_behavior,
      active: price.active,
    })),
    billing_portal: portals.error ? portals : (portals.data ?? []).map((item) => ({
      id: item.id,
      is_default: item.is_default,
      active: item.active,
      subscription_update: item.features?.subscription_update?.enabled ?? null,
      subscription_cancel: item.features?.subscription_cancel?.enabled ?? null,
      cancel_mode: item.features?.subscription_cancel?.mode ?? null,
      invoice_history: item.features?.invoice_history?.enabled ?? null,
    })),
    balance: balance.error ? balance : {
      available: (balance.available ?? []).map((item) => `${item.amount / 100} ${item.currency}`),
      pending: (balance.pending ?? []).map((item) => `${item.amount / 100} ${item.currency}`),
    },
    recent_payouts: payouts.error ? payouts : (payouts.data ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      amount: `${item.amount / 100} ${item.currency}`,
      arrival: new Date(item.arrival_date * 1000).toISOString().slice(0, 10),
      failure: item.failure_code ?? null,
    })),
  }
}

function section(title, value) {
  console.log(`\n## ${title}`)
  if (value?.error) {
    console.log(`Nu am putut citi: ${value.error}`)
    return
  }
  console.log(JSON.stringify(value, null, 2))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const key = process.env[KEY_NAME]
  if (!key) usage(`Lipsește ${KEY_NAME}.`)
  if (!modeFromKey(key)) usage(`${KEY_NAME} trebuie să fie o cheie secretă sau restricționată (sk_/rk_).`)
  const report = await collect(key, options.ref)
  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`# Inventar Stripe, mod ${report.mode.toUpperCase()}, ${new Date().toISOString()}`)
  section('Contul platformei', report.account)
  section('Webhook-uri', report.webhooks)
  section('Conturi Connect', report.connected_accounts)
  section('Prețuri abonamente (lookup_key)', report.subscription_prices)
  section('Customer Portal', report.billing_portal)
  section('Sold', report.balance)
  section('Ultimele plăți către bancă', report.recent_payouts)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
