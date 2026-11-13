import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execute } from './stripe-admin-common.mjs'
import { run as runSync, USAGE as SYNC_USAGE } from './sync-subscription-prices.mjs'
import { run as runWebhooks, USAGE as WEBHOOK_USAGE } from './setup-stripe-webhooks.mjs'
import { run as runInventory, USAGE as INVENTORY_USAGE } from './stripe-inventory.mjs'

const ENV = {
  VITE_SUPABASE_URL: 'https://ref.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  MT_TEST_ADMIN_EMAIL: 'admin@example.test',
  MT_TEST_ADMIN_PASSWORD: 'pw',
  SUPABASE_ACCESS_TOKEN: 'sbp_x',
}
const BASE = 'https://ref.supabase.co/functions/v1'
const SUB_URL = `${BASE}/stripe-subscription-webhook`

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function harness(routes, env = ENV) {
  const requests = []
  const out = []
  const err = []
  const secrets = []
  const io = {
    env,
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
    storeSecret: (ref, name, value) => {
      secrets.push({ ref, name, value })
      if (routes.secretFails) throw new Error('Supabase CLI a eșuat la salvarea secretului (cod 1).')
    },
    fetch: async (url, init = {}) => {
      const method = init.method ?? 'GET'
      const body = init.body ? JSON.parse(init.body) : undefined
      const parsed = new URL(url)
      requests.push({ method, url: String(url), path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), body })
      if (parsed.pathname === '/auth/v1/token') return reply(200, { access_token: 'jwt' })
      const route = routes[method]
      if (!route) return reply(405, { error: 'Method not allowed' })
      return route({ query: Object.fromEntries(parsed.searchParams), body, url: String(url) })
    },
  }
  const writes = () => requests.filter((request) => request.path.startsWith('/functions/') && request.method !== 'GET' && request.body?.action !== 'list')
  return { io, requests, out, err, secrets, writes, text: () => out.join('\n'), errors: () => err.join('\n') }
}

const SYNC_PLAN = {
  dry_run: true,
  mode: 'live',
  skipped_inactive: [],
  plans: [
    { code: 'COACH', unit_amount: 10000, product_id: 'motion_sub_coach', price_id: '(preț nou COACH)', product: 'created', price: 'created', plan_row: 'updated' },
  ],
  planned_writes: [
    { target: 'stripe', operation: 'products.create', id: 'motion_sub_coach', detail: 'Motion România · Antrenor' },
    { target: 'stripe', operation: 'prices.create', id: '(preț nou COACH)', detail: '100 ron/lună, lookup_key=COACH' },
    { target: 'database', operation: 'subscription_plans.stripe_price_id', id: 'COACH', detail: '(preț nou COACH)' },
  ],
}

function syncRoutes(mode = 'live', planned = SYNC_PLAN.planned_writes) {
  return {
    GET: () => reply(200, { ...SYNC_PLAN, mode, planned_writes: planned }),
    POST: ({ body }) => reply(200, { mode, plans: SYNC_PLAN.plans.map((plan) => ({ ...plan, price_id: 'price_1' })), skipped_inactive: [], echo: body }),
  }
}

test('sync: without flags it is a dry run that sends only the GET plan and writes nothing', async () => {
  const h = harness(syncRoutes())
  assert.equal(await execute(runSync, SYNC_USAGE, [], h.io), 0)
  assert.deepEqual(h.requests.map((r) => `${r.method} ${r.path}`), ['POST /auth/v1/token', 'GET /functions/v1/sync-subscription-prices'])
  assert.deepEqual(h.writes(), [])
  assert.match(h.text(), /PROBĂ, mod Stripe LIVE/)
  assert.match(h.text(), /\[stripe\] prices\.create \(preț nou COACH\): 100 ron\/lună/)
  assert.match(h.text(), /Nu am scris nimic \(probă\)/)
  assert.equal(h.requests.some((r) => r.url.includes('api.stripe.com')), false)
})

test('sync: --proba with --live is still read-only', async () => {
  const h = harness(syncRoutes())
  assert.equal(await execute(runSync, SYNC_USAGE, ['--live', '--proba'], h.io), 0)
  assert.deepEqual(h.writes(), [])
})

test('sync: --proba together with --aplica is refused before any request', async () => {
  const h = harness(syncRoutes())
  assert.equal(await execute(runSync, SYNC_USAGE, ['--proba', '--aplica'], h.io), 2)
  assert.equal(h.requests.length, 0)
})

test('sync: --aplica stops when the deployed function has no dry run (405)', async () => {
  const h = harness({ POST: () => reply(200, {}) })
  assert.equal(await execute(runSync, SYNC_USAGE, ['--live', '--aplica'], h.io), 1)
  assert.deepEqual(h.writes(), [])
  assert.match(h.errors(), /versiunea fără probă/)
})

test('sync: --aplica on a LIVE key without --live writes nothing', async () => {
  const h = harness(syncRoutes('live'))
  assert.equal(await execute(runSync, SYNC_USAGE, ['--aplica'], h.io), 1)
  assert.deepEqual(h.writes(), [])
})

test('sync: --live on a TEST key writes nothing', async () => {
  const h = harness(syncRoutes('test'))
  assert.equal(await execute(runSync, SYNC_USAGE, ['--live', '--aplica'], h.io), 1)
  assert.deepEqual(h.writes(), [])
})

test('sync: --live --aplica runs the plan first and then one confirmed POST', async () => {
  const h = harness(syncRoutes('live'))
  assert.equal(await execute(runSync, SYNC_USAGE, ['--live', '--aplica'], h.io), 0)
  assert.deepEqual(h.requests.slice(1).map((r) => r.method), ['GET', 'POST'])
  assert.deepEqual(h.writes()[0].body, { confirmLive: true })
  assert.match(h.text(), /APLICAT, mod Stripe LIVE/)
})

test('sync: --aplica with nothing planned does not POST', async () => {
  const h = harness(syncRoutes('test', []))
  assert.equal(await execute(runSync, SYNC_USAGE, ['--aplica'], h.io), 0)
  assert.deepEqual(h.writes(), [])
  assert.match(h.text(), /Nimic de scris/)
})

function webhookWorld({ existing = [], failCreate = [], failRemove = false } = {}) {
  const endpoints = existing.map((endpoint) => ({ ...endpoint }))
  let seq = 0
  const kindUrl = (kind) => `${BASE}/${{ subscriptions: 'stripe-subscription-webhook', payments: 'stripe-webhook', connect: 'stripe-connect-webhook' }[kind]}`
  const secretName = (kind) => ({ subscriptions: 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET', payments: 'STRIPE_WEBHOOK_SECRET', connect: 'STRIPE_CONNECT_WEBHOOK_SECRET' }[kind])
  return {
    endpoints,
    GET: ({ query }) => {
      if (query.action === 'remove') {
        const ids = query.remove.split(',')
        return reply(200, {
          dry_run: true,
          mode: 'live',
          action: 'remove',
          would_remove: endpoints.filter((e) => ids.includes(e.id)),
          missing: ids.filter((id) => !endpoints.some((e) => e.id === id)),
        })
      }
      const url = kindUrl(query.kind)
      const found = endpoints.filter((e) => e.url === url)
      const blocked = found.length > 0 && query.replace !== 'true'
      return reply(200, {
        dry_run: true,
        mode: 'live',
        action: 'create',
        kind: query.kind,
        url,
        secret_name: secretName(query.kind),
        existing: found.map((e) => ({ ...e, events_match: true })),
        blocked,
        planned_writes: blocked ? [] : [
          { target: 'stripe', operation: 'webhook_endpoints.create', id: '(endpoint nou)', detail: url },
          { target: 'supabase_secrets', operation: 'secrets.set', id: secretName(query.kind), detail: 'secretul endpointului nou (nu se afișează)' },
          ...found.map((e) => ({ target: 'stripe', operation: 'webhook_endpoints.delete', id: e.id, detail: 'după verificare' })),
        ],
      })
    },
    POST: ({ body }) => {
      if (body.action === 'remove') {
        if (failRemove) return reply(500, { error: 'Stripe indisponibil' })
        for (const id of body.remove) endpoints.splice(endpoints.findIndex((e) => e.id === id), 1)
        return reply(200, { mode: 'live', removed: body.remove })
      }
      if (body.action === 'list') return reply(200, { mode: 'live', endpoints: [] })
      if (failCreate.includes(body.kind)) return reply(502, { error: 'Endpointul nou nu apare în lista Stripe. L-am șters pe cel nou; endpointurile vechi au rămas neatinse.' })
      const url = kindUrl(body.kind)
      const old = endpoints.filter((e) => e.url === url).map((e) => e.id)
      const created = { id: `we_new${++seq}`, url }
      endpoints.push(created)
      return reply(200, { mode: 'live', kind: body.kind, endpoint_id: created.id, url, events: [], connect: body.kind === 'connect', secret_name: secretName(body.kind), pending_removal: old, secret: 'whsec_mock' })
    },
  }
}

test('webhooks: --kind all --replace without --aplica plans three kinds and writes nothing', async () => {
  const world = webhookWorld({ existing: [{ id: 'we_old', url: SUB_URL }] })
  const h = harness(world)
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'all', '--replace', '--live'], h.io), 0)
  assert.deepEqual(h.writes(), [])
  assert.equal(h.secrets.length, 0)
  assert.deepEqual(h.requests.filter((r) => r.method === 'GET').map((r) => r.query.kind), ['subscriptions', 'payments', 'connect'])
  assert.match(h.text(), /webhook_endpoints\.delete we_old/)
  assert.equal(h.text().includes('whsec'), false)
  assert.deepEqual(world.endpoints.map((e) => e.id), ['we_old'])
})

test('webhooks: --remove without --aplica only lists what it would delete', async () => {
  const world = webhookWorld({ existing: [{ id: 'we_rail', url: 'https://old.up.railway.app/hook' }] })
  const h = harness(world)
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--remove', 'we_rail', '--live'], h.io), 0)
  assert.deepEqual(h.writes(), [])
  assert.match(h.text(), /ar șterge 1 endpointuri/)
  assert.equal(world.endpoints.length, 1)
})

test('webhooks: --aplica stops on an old function without dry run', async () => {
  const h = harness({ POST: () => reply(200, {}) })
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'payments', '--replace', '--live', '--aplica'], h.io), 1)
  assert.deepEqual(h.writes(), [])
  assert.equal(h.secrets.length, 0)
})

test('webhooks: --replace --aplica creates, stores the secret, and only then deletes the old endpoint', async () => {
  const world = webhookWorld({ existing: [{ id: 'we_old', url: SUB_URL }] })
  const h = harness(world)
  const order = []
  h.io.fetch = ((inner) => async (url, init = {}) => {
    const response = await inner(url, init)
    if (init.method === 'POST' && String(url).includes('/functions/')) order.push(`POST ${JSON.parse(init.body).action ?? 'create'}`)
    return response
  })(h.io.fetch)
  const store = h.io.storeSecret
  h.io.storeSecret = (...args) => {
    order.push('secret')
    return store(...args)
  }
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'subscriptions', '--replace', '--live', '--aplica'], h.io), 0)
  assert.deepEqual(order, ['POST create', 'secret', 'POST remove'])
  assert.deepEqual(h.secrets.map((s) => [s.ref, s.name]), [['ref', 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET']])
  assert.deepEqual(world.endpoints.map((e) => e.id), ['we_new1'])
  assert.equal(h.text().includes('whsec_mock'), false)
  assert.match(h.text(), /înlocuit: nou we_new1, șters we_old/)
})

test('webhooks: if saving the secret fails the new endpoint is removed and the old one stays', async () => {
  const world = webhookWorld({ existing: [{ id: 'we_old', url: SUB_URL }] })
  const h = harness({ ...world, secretFails: true })
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'subscriptions', '--replace', '--live', '--aplica'], h.io), 1)
  assert.deepEqual(world.endpoints.map((e) => e.id), ['we_old'])
  assert.deepEqual(h.writes().map((r) => r.body.remove ?? r.body.kind), ['subscriptions', ['we_new1']])
  assert.match(h.text(), /secretul NU s-a salvat; endpointul nou we_new1 a fost șters/)
})

test('webhooks: an existing endpoint without --replace blocks every write', async () => {
  const h = harness(webhookWorld({ existing: [{ id: 'we_old', url: SUB_URL }] }))
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'all', '--live', '--aplica'], h.io), 1)
  assert.deepEqual(h.writes(), [])
  assert.match(h.errors(), /Blocat pentru subscriptions/)
})

test('webhooks: --kind all stops at the first failure and reports what was left untouched', async () => {
  const world = webhookWorld({ failCreate: ['payments'] })
  const h = harness(world)
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'all', '--live', '--aplica'], h.io), 1)
  assert.deepEqual(h.writes().map((r) => r.body.kind), ['subscriptions', 'payments'])
  assert.match(h.text(), /subscriptions: creat we_new1/)
  assert.match(h.text(), /payments: eșuat la creare/)
  assert.match(h.text(), /connect: neatins/)
})

test('webhooks: a failed old-endpoint delete is reported with the command to finish it', async () => {
  const h = harness(webhookWorld({ existing: [{ id: 'we_old', url: SUB_URL }], failRemove: true }))
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--kind', 'subscriptions', '--replace', '--live', '--aplica'], h.io), 1)
  assert.match(h.text(), /NU s-a șters: rulează --remove we_old --aplica/)
})

test('webhooks: --list stays read-only and refuses --aplica', async () => {
  const h = harness(webhookWorld())
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--list', '--aplica'], h.io), 2)
  assert.equal(h.requests.length, 0)
  assert.equal(await execute(runWebhooks, WEBHOOK_USAGE, ['--list'], h.io), 0)
  assert.deepEqual(h.writes(), [])
})

function inventoryHarness(key) {
  const h = harness({}, key === undefined ? {} : { STRIPE_INVENTORY_KEY: key })
  h.io.fetch = async (url, init = {}) => {
    h.requests.push({ method: init.method ?? 'GET', url: String(url) })
    return reply(200, { data: [], available: [], pending: [] })
  }
  return h
}

test('inventory: full secret keys and missing keys are refused before any request', async () => {
  for (const key of ['sk_live_abc', 'sk_test_abc', 'pk_live_abc', 'whsec_abc', undefined]) {
    const h = inventoryHarness(key)
    assert.equal(await execute(runInventory, INVENTORY_USAGE, [], h.io), 2, String(key))
    assert.equal(h.requests.length, 0)
  }
  const h = inventoryHarness('sk_live_secretvalue')
  await execute(runInventory, INVENTORY_USAGE, [], h.io)
  assert.equal(h.errors().includes('secretvalue'), false)
})

test('inventory: a restricted key reads with GET only', async () => {
  for (const key of ['rk_live_abc', 'rk_test_abc']) {
    const h = inventoryHarness(key)
    assert.equal(await execute(runInventory, INVENTORY_USAGE, ['--json'], h.io), 0)
    assert.equal(h.requests.length, 7)
    assert.ok(h.requests.every((r) => r.method === 'GET' && r.url.startsWith('https://api.stripe.com/v1/')))
    assert.equal(h.text().includes(key), false)
  }
})
