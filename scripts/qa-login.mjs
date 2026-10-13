#!/usr/bin/env node
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROLES = {
  admin: { email: 'laki.admin@motiontimisoara.test', home: '/admin', name: 'QA Admin' },
  club: { email: 'uiaudit.club@gmail.com', home: '/club', name: 'QA Club' },
  coach: { email: 'laki.antrenor@motiontimisoara.test', home: '/coach', name: 'QA Antrenor' },
  parent: { email: 'spec.parent.mt@gmail.com', home: '/account', name: 'QA Părinte' },
}

const LIVE_ORIGINS = new Set([
  'https://motiontimisoara.com',
  'https://www.motiontimisoara.com',
  'https://motiontimisoara-demo.netlify.app',
])

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function usage(message) {
  if (message) console.error(message)
  console.error(
    [
      'Folosire:',
      '  node scripts/qa-login.mjs <admin|club|coach|parent> [--base-url URL] [--out FILE] [--allow-live]',
      '  node scripts/qa-login.mjs --check',
      '  node scripts/qa-login.mjs --provision [rol...]',
    ].join('\n'),
  )
  process.exit(2)
}

function credentials(role) {
  const key = role.toUpperCase()
  const email = process.env[`MT_TEST_${key}_EMAIL`] || ROLES[role].email
  const password = process.env[`MT_TEST_${key}_PASSWORD`] || ''
  return { email, password }
}

function parseArgs(argv) {
  const opts = { roles: [], baseUrl: process.env.QA_BASE_URL || 'http://127.0.0.1:3017', out: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--base-url') opts.baseUrl = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--allow-live') opts.allowLive = true
    else if (arg === '--check') opts.check = true
    else if (arg === '--provision') opts.provision = true
    else if (arg === '--help' || arg === '-h') usage()
    else if (ROLES[arg]) opts.roles.push(arg)
    else usage(`Argument necunoscut: ${arg}`)
  }
  return opts
}

function check() {
  const supabase = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)
  console.log(`Supabase client: ${supabase ? 'configurat' : 'lipsește VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY'}`)
  let ready = true
  for (const role of Object.keys(ROLES)) {
    const { email, password } = credentials(role)
    if (!password) ready = false
    const custom = Boolean(process.env[`MT_TEST_${role.toUpperCase()}_EMAIL`])
    console.log(`${role.padEnd(6)} ${email}${custom ? '' : ' (implicit)'}  parolă: ${password ? 'prezentă' : 'LIPSĂ'}`)
  }
  process.exit(ready ? 0 : 1)
}

async function provision(roles) {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) usage('Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.')
  let failed = false
  for (const role of roles.length ? roles : Object.keys(ROLES)) {
    const { email, password } = credentials(role)
    if (!password) {
      console.log(`${role}: sărit, parola lipsește din mediu`)
      failed = true
      continue
    }
    const response = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: { name: ROLES[role].name } }),
    })
    const body = await response.json().catch(() => ({}))
    const id = body.user?.id || body.id
    const status = response.ok ? `creat ca PARENT (id ${id ?? 'necunoscut'})` : `eroare ${response.status} ${body.error_code || body.msg || ''}`
    if (!response.ok) failed = true
    console.log(`${role}: ${email} ${status}`)
  }
  console.log('Rolul final, confirmarea emailului și fixture-urile se aplică separat, cu aprobare.')
  process.exit(failed ? 1 : 0)
}

function assertAllowedOrigin(baseUrl, allowLive) {
  const origin = new URL(baseUrl).origin
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  if (allowLive && LIVE_ORIGINS.has(origin)) return origin
  usage(`Origine refuzată: ${origin}. Local merge direct; live doar cu --allow-live pe ${[...LIVE_ORIGINS].join(', ')}.`)
}

async function login(role, opts) {
  const origin = assertAllowedOrigin(opts.baseUrl, opts.allowLive)
  const { email, password } = credentials(role)
  if (!password) usage(`Lipsește MT_TEST_${role.toUpperCase()}_PASSWORD.`)
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${origin}/login`)
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password)
    await page.getByRole('button', { name: 'Autentificare' }).click()
    const home = ROLES[role].home
    try {
      await page.waitForURL((u) => u.pathname.startsWith(home), { timeout: 20000 })
    } catch {
      const error = await page.locator('.text-destructive').first().textContent().catch(() => null)
      throw new Error(`Login ${role} nu a ajuns la ${home}; pagina curentă ${new URL(page.url()).pathname}${error ? `; mesaj: ${error.trim()}` : ''}`)
    }
    const out = resolve(repoRoot, opts.out || `.qa-auth/${role}.json`)
    mkdirSync(dirname(out), { recursive: true })
    await context.storageState({ path: out })
    console.log(`${role}: autentificat ca ${email} pe ${origin}${home}; sesiune salvată în ${out}`)
  } finally {
    await browser.close()
  }
}

const opts = parseArgs(process.argv.slice(2))
try {
  if (opts.check) check()
  else if (opts.provision) await provision(opts.roles)
  else if (opts.roles.length !== 1) usage('Alege exact un rol.')
  else await login(opts.roles[0], opts)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
