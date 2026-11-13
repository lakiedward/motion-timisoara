#!/usr/bin/env node
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

const FUNCTION = 'sync-subscription-prices'
const FLAGS = ['--live', '--check', '--proba', '--aplica']

export const USAGE = [
  'Folosire:',
  '  node scripts/sync-subscription-prices.mjs                  PROBĂ (implicit): arată ce ar crea/schimba/arhiva, nu scrie nimic',
  '  node scripts/sync-subscription-prices.mjs --proba          la fel, explicit',
  '  node scripts/sync-subscription-prices.mjs --aplica         scrie în Stripe TEST și în subscription_plans',
  '  node scripts/sync-subscription-prices.mjs --live --proba   proba pe cheia LIVE din Supabase (doar citire)',
  '  node scripts/sync-subscription-prices.mjs --live --aplica  doar la lansare, după aprobarea proprietarului',
  '  node scripts/sync-subscription-prices.mjs --check          arată ce variabile lipsesc, fără valori',
  '',
  '--aplica rulează întâi proba și se oprește dacă funcția din Supabase nu o cunoaște.',
  'Variabile: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY și un cont ADMIN:',
  '  MT_SYNC_ADMIN_EMAIL / MT_SYNC_ADMIN_PASSWORD sau, implicit, MT_TEST_ADMIN_EMAIL / MT_TEST_ADMIN_PASSWORD.',
].join('\n')

const STATE_LABELS = {
  created: 'nou',
  updated: 'actualizat',
  replaced: 'înlocuit',
  unchanged: 'neschimbat',
}

function printPlans(report, log) {
  for (const plan of report.plans) {
    log(
      `  ${plan.code}: ${plan.unit_amount / 100} lei | produs ${plan.product_id} ${STATE_LABELS[plan.product] ?? plan.product}` +
        ` | preț ${plan.price_id} ${STATE_LABELS[plan.price] ?? plan.price} | rând ${STATE_LABELS[plan.plan_row] ?? plan.plan_row}`,
    )
  }
  if (report.skipped_inactive?.length) log(`  Planuri inactive, sărite: ${report.skipped_inactive.join(', ')}`)
}

export async function run(argv, io) {
  const unknown = argv.filter((arg) => !FLAGS.includes(arg))
  if (unknown.length) throw new UsageError(`Argument necunoscut: ${unknown.join(' ')}`)
  const flags = new Set(argv)
  const config = adminConfig(io.env)
  if (flags.has('--check')) {
    printPresence(config, io.log)
    return 0
  }
  const action = writeMode(flags)
  const live = flags.has('--live')
  if (Object.values(config).some((value) => !value)) throw new UsageError('Lipsesc variabile; rulează cu --check.')

  const token = await signIn(io.fetch, config)
  const client = functionClient(io.fetch, config, token, FUNCTION)
  const planned = await client.plan()
  if (planned.status === 405) {
    io.error(OLD_FUNCTION_MESSAGE)
    return 1
  }
  if (!planned.ok || planned.report.dry_run !== true) {
    io.error(`Proba a eșuat (${planned.status}): ${planned.report.error ?? 'răspuns fără dry_run'}. Nu am scris nimic.`)
    return 1
  }
  const plan = planned.report
  io.log(`PROBĂ, mod Stripe ${plan.mode.toUpperCase()}: ce ar face sincronizarea`)
  printPlans(plan, io.log)
  printPlannedWrites(plan.planned_writes, io.log)

  const problem = modeProblem(plan.mode, live, action)
  if (problem) {
    io.error(problem)
    return 1
  }
  if (action === 'proba') {
    if (plan.mode === 'live' && !live) io.log('Cheia din Supabase este LIVE: scrierea ar cere --live --aplica.')
    io.log('Nu am scris nimic (probă). Pentru scriere: --aplica.')
    return 0
  }
  if (!plan.planned_writes.length) {
    io.log('Nimic de scris: Stripe și subscription_plans sunt deja la zi.')
    return 0
  }
  const applied = await client.apply(live ? { confirmLive: true } : {})
  if (!applied.ok) {
    io.error(`Eroare ${applied.status}: ${applied.report.error ?? 'necunoscută'}`)
    return 1
  }
  io.log(`APLICAT, mod Stripe ${applied.report.mode.toUpperCase()}:`)
  printPlans(applied.report, io.log)
  return 0
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await execute(run, USAGE, process.argv.slice(2), defaultIo())
}
