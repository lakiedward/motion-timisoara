import { test, expect } from '@playwright/test'

import { isLocalPreview } from './helpers/target'

/**
 * Smoke tests for the React app (Romanian public routes).
 *
 * Local:  BASE_URL=http://localhost:3017 npx playwright test tests/smoke-tests.spec.ts
 * Prod:   npx playwright test tests/smoke-tests.spec.ts
 *         (default baseURL = https://www.motiontimisoara.com)
 * React copy assertions (headings, labels) run only against the local preview.
 * Against production they skip, because that host may still serve the Angular app.
 */

test.describe('Smoke — health', () => {
  test('homepage is UP', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('static assets load on homepage', async ({ page }) => {
    await page.goto('/')
    const styles = await page.locator('style, link[rel="stylesheet"]').count()
    const scripts = await page.locator('script').count()
    expect(styles).toBeGreaterThan(0)
    expect(scripts).toBeGreaterThan(0)
  })

  test('no critical page errors on homepage', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const critical = errors.filter(
      (err) =>
        !/warning|info|favicon/i.test(err) && !/ResizeObserver|Loading chunk/i.test(err)
    )
    expect(critical).toEqual([])
  })

  test('header and footer are present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header, nav').first()).toBeVisible()
    await expect(page.locator('footer').first()).toBeVisible()
  })

  test('HTTPS only when not running against local preview', async ({ page, baseURL }) => {
    test.skip(isLocalPreview(baseURL), 'Local preview uses http://localhost')

    await page.goto('/')
    expect(page.url()).toMatch(/^https:\/\//)
  })

  test('robots.txt does not 500', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBeLessThan(500)
  })
})

test.describe('Smoke — Romanian routes', () => {
  test('main public pages return 200', async ({ page }) => {
    for (const path of ['/', '/cursuri', '/login']) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should return 200`).toBe(200)
    }
  })

  test('homepage shows Motion branding', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Motion Timișoara/i).first()).toBeVisible()
  })

  test('courses list loads at /cursuri', async ({ page, baseURL }) => {
    const response = await page.goto('/cursuri')
    expect(response?.status()).toBeLessThan(400)
    expect(page.url()).toContain('/cursuri')
    test.skip(
      !isLocalPreview(baseURL),
      'React heading copy is asserted on the local preview, not on the still-Angular production host'
    )
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Cursuri' })).toBeVisible()
  })

  test('login page loads at /login', async ({ page, baseURL }) => {
    const response = await page.goto('/login')
    expect(response?.status()).toBeLessThan(400)
    test.skip(
      !isLocalPreview(baseURL),
      'React login copy is asserted on the local preview, not on the still-Angular production host'
    )
    await expect(page.getByRole('heading', { name: /Bine ai revenit|Autentific/i })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel(/Parolă|Parola/)).toBeVisible()
  })

  test('register page loads at /register', async ({ page, baseURL }) => {
    const response = await page.goto('/register')
    expect(response?.status()).toBeLessThan(400)
    test.skip(
      !isLocalPreview(baseURL),
      'React register copy is asserted on the local preview, not on the still-Angular production host'
    )
    await expect(page.getByRole('heading', { name: /Creează cont/i })).toBeVisible()
  })

  test('back/forward between / and /cursuri', async ({ page }) => {
    await page.goto('/')
    const homeUrl = page.url()
    await page.goto('/cursuri')
    await page.goBack()
    expect(page.url()).toBe(homeUrl)
    await page.goForward()
    expect(page.url()).toContain('/cursuri')
  })
})

test.describe('Smoke — console & performance', () => {
  test('browser console has no flood of critical errors on /', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (
        /favicon|Google Maps|analytics|supabase|Failed to load resource|net::ERR_/i.test(text)
      ) {
        return
      }
      consoleErrors.push(text)
    })

    // Waiting on the rendered hero rather than networkidle: the dev server keeps
    // an HMR socket open and the page embeds third-party iframes, so "the network
    // went quiet" never reliably arrives and the wait times out under load.
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

    expect(consoleErrors.length).toBeLessThan(5)
  })

  // The local preview is a dev server that compiles routes on demand, so these
  // stopwatches only guard against a hang there. The tight figures are the ones
  // the deployed build has to meet.
  test('homepage reaches DOMContentLoaded within budget', async ({ page, baseURL }) => {
    const start = Date.now()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    expect(Date.now() - start).toBeLessThan(isLocalPreview(baseURL) ? 30_000 : 5_000)
  })

  test('/cursuri reaches DOMContentLoaded within budget', async ({ page, baseURL }) => {
    const start = Date.now()
    await page.goto('/cursuri')
    await page.waitForLoadState('domcontentloaded')
    expect(Date.now() - start).toBeLessThan(isLocalPreview(baseURL) ? 30_000 : 15_000)
  })
})
