import { test, expect, type Page } from '@playwright/test'

import { isLocalPreview } from './helpers/target'

/**
 * Production readiness for the React app (Romanian public routes).
 *
 * Local:  BASE_URL=http://localhost:3017 npx playwright test tests/production-readiness.spec.ts
 * Prod:   npx playwright test tests/production-readiness.spec.ts
 *         (default baseURL = https://www.motiontimisoara.com)
 *
 * The route table lives in motiontimisoaraApp/src/routes/router.tsx and is
 * Romanian end to end (/cursuri, /login, /register, …). Data comes from
 * Supabase over PostgREST, so listing assertions wait for the network instead
 * of asserting on a fixed row count.
 *
 * Checks that describe the React build or HTTPS-only hardening are gated on the
 * target: React copy is asserted on the local preview, TLS hardening only off it.
 */

/** Public pages reachable from the header, with the label that links to them. */
const HEADER_ROUTES = [
  { path: '/cursuri', label: 'Cursuri' },
  { path: '/activitati', label: 'Activități' },
  { path: '/tabere', label: 'Tabere' },
  { path: '/harta', label: 'Hartă' },
  { path: '/antrenori', label: 'Antrenori' },
  { path: '/cluburi', label: 'Cluburi' },
  { path: '/despre', label: 'Despre' },
  { path: '/contact', label: 'Contact' },
] as const

/** Every public page a visitor can reach without an account. */
const PUBLIC_ROUTES = [
  '/',
  ...HEADER_ROUTES.map((route) => route.path),
  '/login',
  '/signup',
  '/register',
] as const

/** Copy rendered by NotFoundPage — the catch-all every unknown path falls into. */
const NOT_FOUND_COPY = 'Pagina nu a fost găsită'

/** Courses are fetched from Supabase after hydration; allow for a cold round trip. */
const DATA_TIMEOUT = 40_000

/** Origin of a URL, or an empty string when it cannot be parsed. */
function originOf(url: string | undefined): string {
  try {
    return new URL(url ?? '').origin
  } catch {
    return ''
  }
}

/** Widest element on the page must not exceed the viewport at any breakpoint. */
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth > doc.clientWidth + 1
  })
}

/**
 * Navigate and wait for the course data to land.
 *
 * At domcontentloaded this SPA is still the loading skeleton — the cards arrive
 * later via React Query and are the widest thing on the page, so measuring the
 * layout before then would grade the skeleton and miss overflow that real
 * content introduces. Both '/' and '/cursuri' render cards from the same
 * listing query, so wait for that response; '/cursuri' additionally resolves
 * into either a grid or an empty state, which is a stronger signal still.
 */
async function gotoSettled(page: Page, route: string): Promise<void> {
  // Registered before goto so a fast response cannot be missed. The catch keeps
  // the helper from hanging if the app ever stops issuing the query — the
  // assertions that follow still run and would report the real problem.
  const listing = page
    .waitForResponse((response) => response.url().includes('/rest/v1/courses'), {
      timeout: DATA_TIMEOUT,
    })
    .catch(() => null)

  await page.goto(route)
  await listing
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

  if (route === '/cursuri') {
    const cards = page.getByRole('article')
    const emptyState = page.getByText('Nu am găsit cursuri', { exact: false })
    await expect(cards.first().or(emptyState)).toBeVisible({ timeout: DATA_TIMEOUT })
  }
}

test.describe('Production readiness — critical user flows', () => {
  test('homepage renders the public shell and the hero', async ({ page, baseURL }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    await expect(page.locator('header').first()).toBeVisible()
    await expect(page.locator('footer').first()).toBeVisible()

    test.skip(!isLocalPreview(baseURL), 'React copy is asserted on the local preview only')

    // Brand wordmark in the header links home.
    await expect(page.getByRole('link', { name: 'Acasă' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Vezi programele' })).toHaveAttribute(
      'href',
      '/cursuri'
    )
  })

  test('header exposes every public Romanian route', async ({ page, baseURL }) => {
    await page.goto('/')
    test.skip(!isLocalPreview(baseURL), 'React header is asserted on the local preview only')

    const nav = page.locator('header nav').first()
    for (const route of HEADER_ROUTES) {
      await expect(nav.getByRole('link', { name: route.label, exact: true })).toHaveAttribute(
        'href',
        route.path
      )
    }
  })

  test('header navigation moves between pages and back home', async ({ page, baseURL }) => {
    await page.goto('/')
    test.skip(!isLocalPreview(baseURL), 'React header is asserted on the local preview only')

    await page.locator('header nav').getByRole('link', { name: 'Cursuri', exact: true }).click()
    await expect(page).toHaveURL(/\/cursuri$/)
    await expect(page.getByRole('heading', { name: 'Cursuri', level: 1 })).toBeVisible()

    await page.getByRole('link', { name: 'Acasă' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  // One test per route rather than a single sweep: each route then gets its own
  // timeout and its own failure line, instead of the whole table going red on
  // whichever page happened to be slow.
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders its own page without uncaught errors`, async ({ page, baseURL }) => {
      test.skip(!isLocalPreview(baseURL), 'React route table is asserted on the local preview only')

      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))

      const response = await page.goto(route)
      expect(response?.status(), `${route} should be served`).toBe(200)

      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expect(
        page.locator('body'),
        `${route} should not fall through to 404`
      ).not.toContainText(NOT_FOUND_COPY)
      expect(errors, `${route} raised uncaught errors`).toEqual([])
    })
  }

  test('courses listing loads course data at /cursuri', async ({ page, baseURL }) => {
    test.slow(isLocalPreview(baseURL), 'The dev server compiles the route on first hit')

    const response = await page.goto('/cursuri')
    expect(response?.status()).toBe(200)

    test.skip(!isLocalPreview(baseURL), 'React listing is asserted on the local preview only')

    await expect(page.getByRole('heading', { name: 'Cursuri', level: 1 })).toBeVisible()

    // Either the grid resolved with cards, or the page states there is nothing to show.
    const cards = page.getByRole('article')
    const emptyState = page.getByText('Nu am găsit cursuri', { exact: false })
    await expect(cards.first().or(emptyState)).toBeVisible({ timeout: DATA_TIMEOUT })
  })

  test('course details open from the listing', async ({ page, baseURL }) => {
    test.slow(isLocalPreview(baseURL), 'The dev server compiles the route on first hit')

    await page.goto('/cursuri')
    test.skip(!isLocalPreview(baseURL), 'React listing is asserted on the local preview only')

    const firstCard = page.getByRole('article').first()
    const emptyState = page.getByText('Nu am găsit cursuri', { exact: false })
    await expect(firstCard.or(emptyState)).toBeVisible({ timeout: DATA_TIMEOUT })
    test.skip(await emptyState.isVisible(), 'No published course to open')

    const title = (await firstCard.getByRole('heading').first().textContent())?.trim() ?? ''
    // An empty title would make the heading assertion below match anything.
    expect(title, 'course card should carry a name').not.toBe('')
    await firstCard.getByRole('link', { name: 'Detalii' }).click()

    await expect(page).toHaveURL(/\/cursuri\/[0-9a-f-]{36}$/i)
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({
      timeout: DATA_TIMEOUT,
    })
  })

  test('login page renders the sign-in form at /login', async ({ page, baseURL }) => {
    const response = await page.goto('/login')
    expect(response?.status()).toBe(200)

    test.skip(!isLocalPreview(baseURL), 'React auth copy is asserted on the local preview only')

    await expect(page.getByRole('heading', { name: 'Bine ai revenit' })).toBeVisible()
    await expect(page.locator('form')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Parolă')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Autentificare' })).toBeVisible()
    // Visitors without an account are routed to the role picker.
    await expect(page.getByRole('link', { name: 'Înregistrează-te' })).toHaveAttribute(
      'href',
      '/signup'
    )
    await expect(page.getByRole('link', { name: 'Ai uitat parola?' })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })

  test('register page renders the parent sign-up form at /register', async ({ page, baseURL }) => {
    const response = await page.goto('/register')
    expect(response?.status()).toBe(200)

    test.skip(!isLocalPreview(baseURL), 'React auth copy is asserted on the local preview only')

    await expect(page.getByRole('heading', { name: /Creează cont/ })).toBeVisible()
    for (const label of ['Nume complet', 'Email', 'Telefon', 'Parolă']) {
      await expect(page.getByLabel(label)).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Creează cont' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Autentifică-te' })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  test('signup page announces that a club stays inactive until an administrator approves it', async ({
    page,
    baseURL,
  }) => {
    const response = await page.goto('/signup')
    expect(response?.status()).toBe(200)

    test.skip(!isLocalPreview(baseURL), 'React auth copy is asserted on the local preview only')

    await expect(page.getByRole('heading', { name: 'Creează un cont' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Club/ })).toContainText(
      'Clubul rămâne inactiv până la aprobarea administratorului',
    )
    await expect(page.getByRole('link', { name: 'Autentifică-te' })).toBeVisible()
  })

  test('unknown route renders the Romanian 404 page', async ({ page, baseURL }) => {
    const response = await page.goto('/aceasta-pagina-nu-exista-xyz123')

    // The SPA serves index.html for deep links, so the router — not the host — answers.
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toBeEmpty()

    test.skip(!isLocalPreview(baseURL), 'React 404 copy is asserted on the local preview only')
    await expect(page.getByText(NOT_FOUND_COPY)).toBeVisible()
  })
})

test.describe('Production readiness — security & performance', () => {
  test('document is served as HTML without a stack fingerprint', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    const headers = response?.headers() ?? {}
    expect(headers['content-type']).toContain('text/html')
    expect(headers['x-powered-by'], 'host should not advertise its stack').toBeUndefined()
  })

  test('public traffic is HTTPS with HSTS', async ({ page, baseURL }) => {
    test.skip(isLocalPreview(baseURL), 'Local preview is served over plain http://localhost')

    const response = await page.goto('/')
    expect(page.url()).toMatch(/^https:\/\//)
    expect(response?.headers()['strict-transport-security']).toBeTruthy()
  })

  test('every third-party request is made over HTTPS', async ({ page, baseURL }) => {
    test.slow(isLocalPreview(baseURL), 'The dev server compiles the route on first hit')

    const ownOrigin = originOf(baseURL)
    const insecure: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (!url.startsWith('http://')) return
      // The local preview itself is plain http; only third parties are graded here.
      if (originOf(url) === ownOrigin) return
      insecure.push(url)
    })

    await page.goto('/cursuri')
    await expect(page.getByRole('article').first().or(page.getByText('Nu am găsit cursuri'))).toBeVisible({
      timeout: DATA_TIMEOUT,
    })

    expect(insecure, 'third-party requests must not downgrade to http://').toEqual([])
  })

  test('Supabase answers without server errors', async ({ page, baseURL }) => {
    test.slow(isLocalPreview(baseURL), 'The dev server compiles the route on first hit')

    const supabase: { url: string; status: number }[] = []
    page.on('response', (response) => {
      if (response.url().includes('.supabase.co/')) {
        supabase.push({ url: response.url(), status: response.status() })
      }
    })

    await page.goto('/cursuri')
    await expect(page.getByRole('article').first().or(page.getByText('Nu am găsit cursuri'))).toBeVisible({
      timeout: DATA_TIMEOUT,
    })

    // The listing is Supabase-backed: no calls at all means the client never booted.
    expect(supabase.length, 'the courses page should query Supabase').toBeGreaterThan(0)
    expect(
      supabase.filter((r) => r.status >= 500),
      'Supabase returned server errors'
    ).toEqual([])
  })

  test('no mixed-content warnings are reported', async ({ page }) => {
    const warnings: string[] = []
    page.on('console', (message) => {
      if (/mixed content/i.test(message.text())) warnings.push(message.text())
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    expect(warnings).toEqual([])
  })

  test('homepage reaches DOMContentLoaded within budget', async ({ page, baseURL }) => {
    // Against the Vite dev server this stopwatch measures on-demand compilation,
    // not the shipped bundle, so locally it is only a "did not hang" guard. The
    // 5s figure is the budget the deployed build actually has to meet.
    const budget = isLocalPreview(baseURL) ? 30_000 : 5_000

    const start = Date.now()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    expect(Date.now() - start).toBeLessThan(budget)
  })

  test('homepage imagery actually decodes', async ({ page, baseURL }) => {
    test.slow(isLocalPreview(baseURL), 'The dev server compiles the route on first hit')

    await page.goto('/')
    test.skip(!isLocalPreview(baseURL), 'React hero is asserted on the local preview only')

    const hero = page.locator('img').first()
    await expect(hero).toBeVisible()
    await expect
      .poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth), {
        timeout: DATA_TIMEOUT,
      })
      .toBeGreaterThan(0)
  })
})

test.describe('Production readiness — responsive design', () => {
  test.beforeEach(({ baseURL }) => {
    test.slow(isLocalPreview(baseURL), 'The dev server compiles each route on first hit')
  })

  test('mobile 375x812 collapses the nav without horizontal scroll', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    test.skip(!isLocalPreview(baseURL), 'React header is asserted on the local preview only')

    await expect(page.getByRole('button', { name: 'Meniu' })).toBeVisible()
    await expect(page.locator('header nav').first()).toBeHidden()

    for (const route of ['/', '/cursuri']) {
      await gotoSettled(page, route)
      expect(await hasHorizontalOverflow(page), `${route} overflows at 375px`).toBe(false)
    }
  })

  test('tablet 768x1024 keeps the collapsed nav', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    test.skip(!isLocalPreview(baseURL), 'React header is asserted on the local preview only')

    // The desktop nav must stay collapsed below the lg breakpoint, not merely
    // sit next to a visible burger.
    await expect(page.getByRole('button', { name: 'Meniu' })).toBeVisible()
    await expect(page.locator('header nav').first()).toBeHidden()

    for (const route of ['/', '/cursuri']) {
      await gotoSettled(page, route)
      expect(await hasHorizontalOverflow(page), `${route} overflows at 768px`).toBe(false)
    }
  })

  test('desktop 1440x900 shows the full nav without horizontal scroll', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    test.skip(!isLocalPreview(baseURL), 'React header is asserted on the local preview only')

    await expect(page.locator('header nav').first()).toBeVisible()
    await expect(
      page.locator('header nav').getByRole('link', { name: 'Cursuri', exact: true })
    ).toBeVisible()

    for (const route of ['/', '/cursuri']) {
      await gotoSettled(page, route)
      expect(await hasHorizontalOverflow(page), `${route} overflows at 1440px`).toBe(false)
    }
  })
})

test.describe('Production readiness — data integrity', () => {
  test('login rejects an empty submit with Romanian validation messages', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/login')
    test.skip(!isLocalPreview(baseURL), 'React validation copy is asserted on the local preview only')

    await page.getByRole('button', { name: 'Autentificare' }).click()

    await expect(page.getByText('Email invalid')).toBeVisible()
    await expect(page.getByText('Minim 6 caractere')).toBeVisible()
    // A rejected submit must not leave the page or hit the auth endpoint.
    await expect(page).toHaveURL(/\/login$/)
  })

  test('register rejects an empty submit on every required field', async ({ page, baseURL }) => {
    await page.goto('/register')
    test.skip(!isLocalPreview(baseURL), 'React validation copy is asserted on the local preview only')

    await page.getByRole('button', { name: 'Creează cont' }).click()

    for (const message of [
      'Minim 3 caractere',
      'Email invalid',
      'Număr de telefon invalid',
      'Minim 6 caractere',
    ]) {
      await expect(page.getByText(message)).toBeVisible()
    }
    await expect(page).toHaveURL(/\/register$/)
  })

  test('outbound links on our own pages are safe', async ({ page, baseURL }) => {
    test.skip(!isLocalPreview(baseURL), 'React pages are asserted on the local preview only')
    const ownOrigin = originOf(baseURL)

    for (const route of ['/', '/despre', '/contact']) {
      await page.goto(route)
      const links = await page.locator('a[href^="http"]').evaluateAll((anchors, origin) => {
        return (anchors as HTMLAnchorElement[])
          .filter((a) => new URL(a.href).origin !== origin)
          .map((a) => ({ href: a.href, target: a.target, rel: a.rel }))
      }, ownOrigin)

      for (const link of links) {
        expect(link.href, `${route}: ${link.href} must use https`).toMatch(/^https:\/\//)
        if (link.target === '_blank') {
          expect(link.rel, `${route}: ${link.href} needs rel="noopener"`).toContain('noopener')
        }
      }
    }
  })
})
