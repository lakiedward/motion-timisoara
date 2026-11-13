#!/usr/bin/env node
import { defaultIo, execute, isEntryPoint, UsageError } from './stripe-admin-common.mjs'

const API = 'https://api.stripe.com/v1'
const KEY_NAME = 'STRIPE_INVENTORY_KEY'
const PLAN_CODES = ['COACH', 'CLUB_START', 'CLUB', 'CLUB_PRO']
const DEAD_HOSTS = ['api.motiontimisoara.com', 'triathlonteambe-production.up.railway.app']

export const USAGE = [
  'Folosire:',
  `  ${KEY_NAME}=rk_live_… node scripts/stripe-inventory.mjs [--json] [--supabase-ref <ref>]`,
  '',
  'Inventar DOAR CITIRE al contului Stripe: cont, verificare, webhook-uri, conturi Connect, prețuri abonamente,',
  'Customer Portal, sold și plăți. Face numai cereri GET și acceptă DOAR o cheie restricționată rk_live_/rk_test_',
  'creată cu drepturi doar de citire. O cheie secretă completă sk_ este refuzată. Cheia nu se afișează.',
].join('\n')

function parseArgs(argv) {
  const options = { json: false, ref: 'ehdzafadshbaaghzdzdo' }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') options.json = true
    else if (argv[index] === '--supabase-ref' && argv[index + 1]) options.ref = argv[++index]
    else throw new UsageError(`Argument necunoscut: ${argv[index]}`)
  }
  return options
}

export function modeFromKey(key) {
  if (/^rk_live_/.test(key)) return 'live'
  if (/^rk_test_/.test(key)) return 'test'
  return null
}

async function get(fetchImpl, key, path, params = []) {
  const query = params.length ? `?${new URLSearchParams(params)}` : ''
  const response = await fetchImpl(`${API}${path}${query}`, {
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

async function collect(fetchImpl, key, ref) {
  const account = await get(fetchImpl, key, '/account')
  const webhooks = await get(fetchImpl, key, '/webhook_endpoints', [['limit', '100']])
  const connected = await get(fetchImpl, key, '/accounts', [['limit', '100']])
  const prices = await get(fetchImpl, key, '/prices', [...PLAN_CODES.map((code) => ['lookup_keys[]', code]), ['limit', '10']])
  const portals = await get(fetchImpl, key, '/billing_portal/configurations', [['limit', '10']])
  const balance = await get(fetchImpl, key, '/balance')
  const payouts = await get(fetchImpl, key, '/payouts', [['limit', '5']])
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

function section(log, title, value) {
  log(`\n## ${title}`)
  if (value?.error) {
    log(`Nu am putut citi: ${value.error}`)
    return
  }
  log(JSON.stringify(value, null, 2))
}

export async function run(argv, io) {
  const options = parseArgs(argv)
  const key = io.env[KEY_NAME]
  if (!key) throw new UsageError(`Lipsește ${KEY_NAME}.`)
  if (!modeFromKey(key)) {
    throw new UsageError(
      `${KEY_NAME} trebuie să fie o cheie restricționată doar de citire (rk_live_… sau rk_test_…). ` +
        'Cheile sk_ complete pot scrie în Stripe și sunt refuzate. Nu am trimis nicio cerere.',
    )
  }
  const report = await collect(io.fetch, key, options.ref)
  if (options.json) {
    io.log(JSON.stringify(report, null, 2))
    return 0
  }
  io.log(`# Inventar Stripe, mod ${report.mode.toUpperCase()}, ${new Date().toISOString()}`)
  section(io.log, 'Contul platformei', report.account)
  section(io.log, 'Webhook-uri', report.webhooks)
  section(io.log, 'Conturi Connect', report.connected_accounts)
  section(io.log, 'Prețuri abonamente (lookup_key)', report.subscription_prices)
  section(io.log, 'Customer Portal', report.billing_portal)
  section(io.log, 'Sold', report.balance)
  section(io.log, 'Ultimele plăți către bancă', report.recent_payouts)
  return 0
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await execute(run, USAGE, process.argv.slice(2), defaultIo())
}
