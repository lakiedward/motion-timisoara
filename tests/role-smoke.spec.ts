import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { test, expect, type Page, type TestInfo } from '@playwright/test'

import { installSupabaseWriteGuard, type WriteGuard } from './helpers/supabase-write-guard'

type Role = 'admin' | 'club' | 'coach' | 'parent'

type RolePlan = {
  home: string
  nav: { kind: 'portal'; label: string } | { kind: 'tabs'; label: string }
  links: { name: string; to: string }[]
  forms: string[]
}

const PLANS: Record<Role, RolePlan> = {
  admin: {
    home: '/admin',
    nav: { kind: 'portal', label: 'Navigare administrare' },
    links: [
      { name: 'Utilizatori', to: '/admin/users' },
      { name: 'Cluburi', to: '/admin/clubs' },
      { name: 'Cursuri', to: '/admin/courses' },
      { name: 'Activități', to: '/admin/activities' },
      { name: 'Locații', to: '/admin/locations' },
      { name: 'Tabere', to: '/admin/camps' },
      { name: 'Concursuri', to: '/admin/competitions' },
      { name: 'Anunțuri', to: '/admin/announcements' },
      { name: 'Prezență', to: '/admin/attendance' },
      { name: 'Sporturi', to: '/admin/sports' },
      { name: 'Coduri invitație', to: '/admin/codes' },
      { name: 'Panou', to: '/admin' },
    ],
    forms: ['/admin/courses/new', '/admin/locations/new', '/admin/announcements/new', '/admin/profile'],
  },
  club: {
    home: '/club',
    nav: { kind: 'portal', label: 'Navigare club' },
    links: [
      { name: 'Profil club', to: '/club/profile' },
      { name: 'Cursuri', to: '/club/courses' },
      { name: 'Activități', to: '/club/activities' },
      { name: 'Tabere', to: '/club/camps' },
      { name: 'Concursuri', to: '/club/competitions' },
      { name: 'Locații', to: '/club/locations' },
      { name: 'Antrenori', to: '/club/coaches' },
      { name: 'Anunțuri', to: '/club/announcements' },
      { name: 'Panou', to: '/club' },
    ],
    forms: ['/club/courses/new', '/club/activities/new', '/club/locations/new', '/club/camps/new'],
  },
  coach: {
    home: '/coach',
    nav: { kind: 'portal', label: 'Navigare antrenor' },
    links: [
      { name: 'Cursuri', to: '/coach/courses' },
      { name: 'Activități', to: '/coach/activities' },
      { name: 'Tabere', to: '/coach/camps' },
      { name: 'Concursuri', to: '/coach/competitions' },
      { name: 'Locații', to: '/coach/locations' },
      { name: 'Prezență', to: '/coach/attendance' },
      { name: 'Anunțuri', to: '/coach/announcements' },
      { name: 'Panou', to: '/coach' },
    ],
    forms: ['/coach/courses/new', '/coach/activities/new', '/coach/locations/new', '/coach/profile'],
  },
  parent: {
    home: '/account',
    nav: { kind: 'tabs', label: 'Contul meu' },
    links: [
      { name: 'Copiii mei', to: '/account/children' },
      { name: 'Înscrieri', to: '/account/enrollments' },
      { name: 'Prezență', to: '/account/attendance' },
      { name: 'Anunțuri', to: '/account/announcements' },
      { name: 'Panou', to: '/account' },
    ],
    forms: ['/account/child/new'],
  },
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobil', width: 375, height: 812 },
] as const

const TARGET = process.env.BASE_URL

const ERROR_STATE = /Nu am putut|Ceva n-a mers|Ceva nu a mers/i

function storageOrigins(file: string): string[] {
  try {
    const state = JSON.parse(readFileSync(file, 'utf8')) as { origins?: { origin: string }[] }
    return (state.origins ?? []).map((o) => o.origin)
  } catch {
    return []
  }
}

function sessionFor(role: Role, baseURL: string | undefined): string | null {
  if (!baseURL) return null
  const dir = '.qa-auth'
  if (!existsSync(dir)) return null
  const origin = new URL(baseURL).origin
  const candidates = [`${role}.json`, ...readdirSync(dir).filter((f) => f.startsWith(`${role}-`) && f.endsWith('.json'))]
  const match = candidates.map((f) => join(dir, f)).find((f) => existsSync(f) && storageOrigins(f).includes(origin))
  return match ?? null
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function expectHealthyPage(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}/?(\\?.*)?$`))
  await expect(page.locator('main h1').first()).toBeVisible()
  await expect(page.getByText(ERROR_STATE)).toHaveCount(0)
}

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page, path)
}

async function followNav(page: Page, plan: RolePlan, link: { name: string; to: string }, mobile: boolean) {
  if (plan.nav.kind === 'portal' && mobile) {
    await page.getByRole('button', { name: 'Meniu' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('navigation', { name: plan.nav.label }).getByRole('link', { name: link.name, exact: true }).click()
    await expect(drawer).toBeHidden()
  } else {
    await page
      .getByRole('navigation', { name: plan.nav.label })
      .getByRole('link', { name: link.name, exact: true })
      .click()
  }
  await expectHealthyPage(page, link.to)
}

async function report(guard: WriteGuard, errors: string[], testInfo: TestInfo) {
  const blocked = [...new Set(guard.blocked)]
  if (blocked.length) {
    testInfo.annotations.push({ type: 'scrieri blocate', description: blocked.join(', ') })
  }
  expect(errors, 'erori JavaScript necapturate în pagină').toEqual([])
}

for (const role of Object.keys(PLANS) as Role[]) {
  const plan = PLANS[role]
  const session = sessionFor(role, TARGET)

  for (const viewport of VIEWPORTS) {
    const mobile = viewport.width < 768

    test.describe(`Smoke ${role} · ${viewport.name} ${viewport.width}×${viewport.height}`, () => {
      let guard: WriteGuard
      const errors: string[] = []

      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        storageState: session ?? { cookies: [], origins: [] },
      })

      test.beforeEach(async ({ browserName, context, page }, testInfo) => {
        test.skip(browserName !== 'chromium', 'Rulăm doar pe chromium ca să nu încărcăm de trei ori datele reale.')
        test.skip(
          !session,
          `Lipsește sesiunea ${role} pentru ${TARGET}: rulează node scripts/qa-login.mjs ${role} --base-url ${TARGET} --allow-live --out .qa-auth/${role}-<țintă>.json`,
        )
        guard = await installSupabaseWriteGuard(context)
        errors.length = 0
        page.on('pageerror', (error) => errors.push(error.message))
        testInfo.annotations.push({ type: 'sesiune', description: session! })
      })

      test('blocajul de scrieri spre Supabase e activ', async ({ page }, testInfo) => {
        await open(page, plan.home)
        const result = await guard.probe(page)
        expect(result.rejected, 'un POST de probă spre Supabase trebuie să eșueze în browser').toBe(true)
        expect(result.recorded, 'POST-ul de probă trebuie oprit de blocaj, nu de rețea').toBe(true)
        await report(guard, errors, testInfo)
      })

      test('panoul și navigația duc la fiecare listă', async ({ page }, testInfo) => {
        await open(page, plan.home)
        const shot = testInfo.outputPath(`${role}-${viewport.width}-panou.png`)
        await page.screenshot({ path: shot, fullPage: true })
        await testInfo.attach(`${role}-${viewport.width}-panou`, { path: shot, contentType: 'image/png' })
        for (const link of plan.links) {
          await followNav(page, plan, link, mobile)
        }
        await report(guard, errors, testInfo)
      })

      test('formularele principale se deschid', async ({ page }, testInfo) => {
        for (const path of plan.forms) {
          await open(page, path)
          await expect(page.locator('main').locator('input:not([type=hidden]), select, textarea').first()).toBeVisible()
        }
        await report(guard, errors, testInfo)
      })
    })
  }
}
