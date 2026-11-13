#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  adminConfig,
  defaultIo,
  execute,
  functionClient,
  isEntryPoint,
  modeProblem,
  OLD_FUNCTION_MESSAGE,
  printPlannedWrites,
  printPresence,
  signIn,
  UsageError,
  writeMode,
} from './stripe-admin-common.mjs'

const FUNCTION = 'setup-subscription-webhook'
const SUPABASE_CLI = 'supabase@2.122.0'
export const KINDS = ['subscriptions', 'payments', 'connect']
export const SECRET_NAMES = {
  subscriptions: 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET',
  payments: 'STRIPE_WEBHOOK_SECRET',
  connect: 'STRIPE_CONNECT_WEBHOOK_SECRET',
}
const FLAGS = ['--live', '--replace', '--check', '--list', '--proba', '--aplica']

export const USAGE = [
  'Folosire:',
  '  node scripts/setup-stripe-webhooks.mjs --list                       arată endpointurile (doar citire)',
  '  node scripts/setup-stripe-webhooks.mjs --kind <tip>                 PROBĂ (implicit): ce ar crea, nu scrie nimic',
  '  node scripts/setup-stripe-webhooks.mjs --kind all --replace         PROBĂ pentru toate trei, cu înlocuire',
  '  node scripts/setup-stripe-webhooks.mjs --remove we_A,we_B           PROBĂ: ce ar șterge',
  '  node scripts/setup-stripe-webhooks.mjs ... --proba                  probă, explicit',
  '  node scripts/setup-stripe-webhooks.mjs ... --aplica                 scrie (rulează întâi proba și se oprește la orice blocaj)',
  '  node scripts/setup-stripe-webhooks.mjs ... --live --aplica          obligatoriu pentru scrieri când cheia din Supabase este LIVE',
  '  node scripts/setup-stripe-webhooks.mjs --check                      arată ce variabile lipsesc, fără valori',
  '',
  `Tipuri: ${KINDS.join(', ')}, all. --replace creează endpointul nou, îl verifică, salvează secretul`,
  `în ${Object.values(SECRET_NAMES).join(' / ')} prin Supabase CLI (nu se afișează)`,
  'și abia apoi șterge endpointul vechi. Dacă salvarea secretului eșuează, endpointul nou se șterge și cel vechi rămâne.',
  'Variabile: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN (doar la --aplica cu --kind) și un cont ADMIN:',
  '  MT_SYNC_ADMIN_EMAIL / MT_SYNC_ADMIN_PASSWORD sau, implicit, MT_TEST_ADMIN_EMAIL / MT_TEST_ADMIN_PASSWORD.',
].join('\n')

function parseArgs(argv) {
  const options = { flags: new Set(), kind: null, remove: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--kind' || arg === '--remove') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new UsageError(`${arg} cere o valoare.`)
      options[arg.slice(2)] = value
      index += 1
    } else if (FLAGS.includes(arg)) {
      options.flags.add(arg)
    } else {
      throw new UsageError(`Argument necunoscut: ${arg}`)
    }
  }
  const actions = [options.flags.has('--list'), options.remove !== null, options.kind !== null].filter(Boolean)
  if (actions.length > 1) throw new UsageError('Alege o singură acțiune: --list, --remove sau --kind.')
  if (options.kind && options.kind !== 'all' && !KINDS.includes(options.kind)) {
    throw new UsageError(`Tip necunoscut: ${options.kind}`)
  }
  if (options.flags.has('--list') && options.flags.has('--aplica')) throw new UsageError('--list doar citește; nu are --aplica.')
  return options
}

export function storeSecretWithCli(projectRef, name, secret) {
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

function failure(io, response) {
  io.error(`Eroare ${response.status}: ${response.report.error ?? 'necunoscută'}`)
  if (response.report.endpoint_ids) io.error(`Endpointuri existente: ${response.report.endpoint_ids.join(', ')}`)
  if (response.report.missing) io.error(`Inexistente: ${response.report.missing.join(', ')}`)
  return 1
}

async function planOrStop(io, client, params) {
  const planned = await client.plan(params)
  if (planned.status === 405) {
    io.error(OLD_FUNCTION_MESSAGE)
    return null
  }
  if (!planned.ok || planned.report.dry_run !== true) {
    failure(io, planned)
    io.error('Proba a eșuat. Nu am scris nimic.')
    return null
  }
  return planned.report
}

function printList(report, log) {
  log(`Mod Stripe: ${report.mode.toUpperCase()}, ${report.endpoints.length} endpointuri`)
  for (const endpoint of report.endpoints) {
    log(`- ${endpoint.id} [${endpoint.status ?? '?'}] ${endpoint.kind ?? 'necunoscut'} → ${endpoint.url}`)
    log(`    evenimente: ${endpoint.enabled_events.join(', ') || '-'}`)
  }
}

function printCreatePlan(plan, log) {
  log(`[${plan.kind}] PROBĂ, mod Stripe ${plan.mode.toUpperCase()}: ${plan.url}`)
  if (plan.existing.length) {
    for (const endpoint of plan.existing) {
      log(`[${plan.kind}]   există ${endpoint.id} [${endpoint.status ?? '?'}], evenimente ${endpoint.events_match ? 'la zi' : 'DIFERITE'}`)
    }
  } else {
    log(`[${plan.kind}]   nu există încă`)
  }
  if (plan.blocked) log(`[${plan.kind}]   BLOCAT: endpointul există; ar trebui --replace ca să fie înlocuit.`)
  printPlannedWrites(plan.planned_writes, (line) => log(`[${plan.kind}] ${line}`))
}

async function removeIds(io, client, ids, live, action) {
  const plan = await planOrStop(io, client, { action: 'remove', remove: ids.join(',') })
  if (!plan) return 1
  io.log(`PROBĂ, mod Stripe ${plan.mode.toUpperCase()}: ar șterge ${plan.would_remove.length} endpointuri`)
  for (const endpoint of plan.would_remove) io.log(`  - ${endpoint.id} → ${endpoint.url}`)
  if (plan.missing.length) {
    io.error(`Inexistente în Stripe: ${plan.missing.join(', ')}. Nu am șters nimic.`)
    return 1
  }
  const problem = modeProblem(plan.mode, live, action)
  if (problem) {
    io.error(problem)
    return 1
  }
  if (action === 'proba') {
    io.log('Nu am scris nimic (probă). Pentru ștergere: --aplica.')
    return 0
  }
  const removed = await client.apply({ action: 'remove', remove: ids, ...(live ? { confirmLive: true } : {}) })
  if (!removed.ok) return failure(io, removed)
  io.log(`Mod Stripe: ${removed.report.mode.toUpperCase()}. Șterse: ${removed.report.removed.join(', ')}`)
  return 0
}

async function applyKind(io, client, plan, context) {
  const { live, replace, projectRef, storeSecret } = context
  const created = await client.apply({ kind: plan.kind, replace, ...(live ? { confirmLive: true } : {}) })
  if (!created.ok) {
    failure(io, created)
    return { kind: plan.kind, ok: false, state: 'eșuat la creare; endpointurile vechi au rămas neatinse' }
  }
  const report = created.report
  if (report.secret_name !== SECRET_NAMES[plan.kind]) {
    await client.apply({ action: 'remove', remove: [report.endpoint_id], ...(live ? { confirmLive: true } : {}) })
    io.error(`[${plan.kind}] Funcția a întors alt secret: ${report.secret_name}. Am șters endpointul nou.`)
    return { kind: plan.kind, ok: false, state: 'oprit: secret neașteptat; endpointul nou șters, cel vechi a rămas' }
  }
  try {
    await storeSecret(projectRef, report.secret_name, report.secret)
  } catch (error) {
    io.error(`[${plan.kind}] ${error instanceof Error ? error.message : String(error)}`)
    const rollback = await client.apply({ action: 'remove', remove: [report.endpoint_id], ...(live ? { confirmLive: true } : {}) })
    const rolledBack = rollback.ok
      ? `endpointul nou ${report.endpoint_id} a fost șters`
      : `ATENȚIE: endpointul nou ${report.endpoint_id} NU a putut fi șters; șterge-l cu --remove ${report.endpoint_id} --aplica`
    return { kind: plan.kind, ok: false, state: `secretul NU s-a salvat; ${rolledBack}; endpointul vechi și secretul vechi au rămas` }
  }
  io.log(`[${plan.kind}] Endpoint nou verificat: ${report.endpoint_id} → ${report.url}${report.connect ? ' (conturi Connect)' : ''}`)
  io.log(`[${plan.kind}] ${report.secret_name} salvat în proiectul ${projectRef} (valoarea nu se afișează).`)
  const pending = report.pending_removal ?? []
  if (!pending.length) return { kind: plan.kind, ok: true, state: `creat ${report.endpoint_id}` }
  const removed = await client.apply({ action: 'remove', remove: pending, ...(live ? { confirmLive: true } : {}) })
  if (!removed.ok) {
    failure(io, removed)
    return {
      kind: plan.kind,
      ok: true,
      leftover: true,
      state: `creat ${report.endpoint_id}, secret salvat; vechiul ${pending.join(', ')} NU s-a șters: rulează --remove ${pending.join(',')} --aplica`,
    }
  }
  return { kind: plan.kind, ok: true, state: `înlocuit: nou ${report.endpoint_id}, șters ${pending.join(', ')}` }
}

async function createKinds(io, client, options, context) {
  const kinds = options.kind === 'all' ? KINDS : [options.kind ?? 'subscriptions']
  const plans = []
  for (const kind of kinds) {
    const plan = await planOrStop(io, client, { action: 'create', kind, replace: String(context.replace) })
    if (!plan) return 1
    printCreatePlan(plan, io.log)
    plans.push(plan)
  }
  const blocked = plans.filter((plan) => plan.blocked).map((plan) => plan.kind)
  const problem = plans.map((plan) => modeProblem(plan.mode, context.live, context.action)).find(Boolean)
  if (problem) {
    io.error(problem)
    return 1
  }
  if (blocked.length) {
    io.error(`Blocat pentru ${blocked.join(', ')}: endpointul există deja. Adaugă --replace. Nu am scris nimic.`)
    return 1
  }
  if (context.action === 'proba') {
    io.log('Nu am scris nimic (probă). Pentru scriere: --aplica.')
    return 0
  }
  const results = []
  let code = 0
  for (const plan of plans) {
    const result = await applyKind(io, client, plan, context)
    results.push(result)
    if (!result.ok || result.leftover) code = 1
    if (!result.ok) break
  }
  io.log('Rezumat:')
  for (const plan of plans) {
    const result = results.find((item) => item.kind === plan.kind)
    io.log(`  ${plan.kind}: ${result ? result.state : 'neatins (oprit înainte)'}`)
  }
  return code
}

export async function run(argv, io) {
  const options = parseArgs(argv)
  const config = { ...adminConfig(io.env), accessToken: io.env.SUPABASE_ACCESS_TOKEN }
  if (options.flags.has('--check')) {
    printPresence(config, io.log)
    return 0
  }
  const action = writeMode(options.flags)
  const creating = !options.flags.has('--list') && options.remove === null
  const required = [config.url, config.anonKey, config.email, config.password]
  if (creating && action === 'aplica') required.push(config.accessToken)
  if (required.some((value) => !value)) throw new UsageError('Lipsesc variabile; rulează cu --check.')
  const live = options.flags.has('--live')
  const token = await signIn(io.fetch, config)
  const client = functionClient(io.fetch, config, token, FUNCTION)

  if (options.flags.has('--list')) {
    const listed = await client.apply({ action: 'list' })
    if (!listed.ok) return failure(io, listed)
    printList(listed.report, io.log)
    return 0
  }
  if (options.remove !== null) {
    const ids = options.remove.split(',').map((id) => id.trim()).filter(Boolean)
    return removeIds(io, client, ids, live, action)
  }
  return createKinds(io, client, options, {
    action,
    live,
    replace: options.flags.has('--replace'),
    projectRef: new URL(config.url).hostname.split('.')[0],
    storeSecret: io.storeSecret ?? storeSecretWithCli,
  })
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await execute(run, USAGE, process.argv.slice(2), defaultIo())
}
