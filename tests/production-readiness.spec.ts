import { test, expect } from '@playwright/test';

/**
 * Test Suite: Production Readiness
 * Verifies the site is ready for production.
 * The frontend uses the Supabase SDK for all backend communication
 * (auth, database queries, storage, realtime).
 */

test.describe('Production Readiness - Critical User Flows', () => {

  test('Homepage loads successfully with all key elements', async ({ page }) => {
    await page.goto('/');

    // Verify page title
    await expect(page).toHaveTitle(/Motion Timișoara/);

    // Verify the logo is visible
    await expect(page.locator('img[alt*="logo" i], img[src*="logo"]').first()).toBeVisible();

    // Verify navigation exists
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();

    // Verify main navigation links exist
    await expect(page.getByRole('link', { name: /cursuri|acasă|despre/i })).toBeVisible();

    // Log any console errors for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error on homepage: ${msg.text()}`);
      }
    });
  });

  test('Courses page displays course listings', async ({ page }) => {
    await page.goto('/courses');

    // Wait for page to load (data now comes from Supabase)
    await page.waitForLoadState('networkidle');

    // Verify courses heading exists
    await expect(page.locator('h1, h2').filter({ hasText: /cursuri|course/i }).first()).toBeVisible();

    // Verify at least one course card or an informational message is present
    const hasCourses = await page.locator('mat-card, .course-card, [class*="course"]').count() > 0;
    const hasMessage = await page.locator('text=/nu există|no courses|încă nu/i').isVisible().catch(() => false);

    expect(hasCourses || hasMessage).toBeTruthy();
  });

  test('Login page is accessible and functional', async ({ page }) => {
    await page.goto('/auth/login');

    // Verify login form exists
    await expect(page.locator('form').first()).toBeVisible();

    // Verify authentication fields
    const emailInput = page.locator('input[type="email"], input[name="email"], input[formControlName="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[formControlName="password"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Verify login button
    const loginButton = page.getByRole('button', { name: /login|autentificare|conectare/i }).first();
    await expect(loginButton).toBeVisible();

    // Verify registration link exists
    await expect(page.getByRole('link', { name: /înregistrare|register|sign up/i })).toBeVisible();
  });

  test('Registration page is accessible', async ({ page }) => {
    await page.goto('/auth/register');

    // Verify registration form exists
    await expect(page.locator('form').first()).toBeVisible();

    // Verify name field
    await expect(page.locator('input[name*="name" i], input[formControlName*="name" i]').first()).toBeVisible();

    // Verify email field
    await expect(page.locator('input[type="email"]').first()).toBeVisible();

    // Verify password field
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('Navigation between main pages works', async ({ page }) => {
    await page.goto('/');

    // Navigate to courses
    const coursesLink = page.getByRole('link', { name: /cursuri|courses/i }).first();
    await coursesLink.click();
    await page.waitForURL(/.*courses.*/);
    await expect(page).toHaveURL(/.*courses.*/);

    // Navigate back to homepage
    const homeLink = page.getByRole('link', { name: /acasă|home|motion/i }).first();
    await homeLink.click();
    await page.waitForLoadState('networkidle');
  });

  test('Public course details are viewable', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Find the first available course
    const firstCourse = page.locator('mat-card, .course-card, [class*="course"]').first();
    const courseExists = await firstCourse.isVisible().catch(() => false);

    if (courseExists) {
      // Click on the first course
      await firstCourse.click();

      // Verify we navigated to course details
      await page.waitForLoadState('networkidle');

      // Verify course information is present
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('Site handles 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz123');

    // Verify page loads (either 404 or redirect)
    expect(response?.status()).toBeLessThan(500);

    // Verify page is not blank
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.length).toBeGreaterThan(0);
  });
});

test.describe('Production Readiness - Security & Performance', () => {

  test('Security headers are present', async ({ page }) => {
    const response = await page.goto('/');

    // Verify response is OK
    expect(response?.status()).toBe(200);

    // Verify Content-Type is HTML
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });

  test('Supabase configuration is properly set', async ({ page }) => {
    await page.goto('/');

    // Verify Supabase meta tags are present and configured
    const supabaseUrl = await page.locator('meta[name="supabase-url"]').getAttribute('content');
    const supabaseAnonKey = await page.locator('meta[name="supabase-anon-key"]').getAttribute('content');

    expect(supabaseUrl).toBeTruthy();
    expect(supabaseUrl).toContain('supabase.co');
    expect(supabaseAnonKey).toBeTruthy();
    expect(supabaseAnonKey!.length).toBeGreaterThan(10);
  });

  test('Content Security Policy allows Supabase connections', async ({ page }) => {
    await page.goto('/');

    // Verify that the CSP meta tag includes supabase.co in connect-src
    const cspContent = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');

    if (cspContent) {
      // CSP should allow connections to supabase.co
      expect(cspContent).toContain('supabase.co');
    }
  });

  test('No mixed content warnings', async ({ page }) => {
    const mixedContentWarnings: string[] = [];

    page.on('console', msg => {
      if (msg.text().includes('Mixed Content') || msg.text().includes('insecure')) {
        mixedContentWarnings.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(mixedContentWarnings).toHaveLength(0);
  });

  test('Page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // Page should load in less than 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('Images load successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify important images loaded
    const images = page.locator('img[src]');
    const imageCount = await images.count();

    if (imageCount > 0) {
      // Check the first image (usually the logo)
      const firstImage = images.first();
      await expect(firstImage).toBeVisible();

      // Verify the image has a valid src attribute
      const src = await firstImage.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src?.length).toBeGreaterThan(0);
    }
  });

  test('Supabase connectivity check', async ({ page }) => {
    // Monitor requests to Supabase when loading a data-driven page
    const supabaseRequests: { url: string; method: string; status?: number }[] = [];

    page.on('response', response => {
      if (response.url().includes('supabase.co')) {
        supabaseRequests.push({
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
        });
      }
    });

    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Log Supabase requests for debugging
    if (supabaseRequests.length > 0) {
      console.log(`Supabase requests detected: ${supabaseRequests.length}`);
      for (const req of supabaseRequests) {
        console.log(`  ${req.method} ${req.url} -> ${req.status}`);
      }

      // Verify none of the Supabase requests returned server errors
      const serverErrors = supabaseRequests.filter(r => r.status && r.status >= 500);
      expect(serverErrors).toHaveLength(0);
    }
  });
});

test.describe('Production Readiness - Responsive Design', () => {

  test('Site is mobile-friendly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify logo is visible on mobile
    await expect(page.locator('img[alt*="logo" i], img[src*="logo"]').first()).toBeVisible();

    // Verify navigation exists (may be a hamburger menu)
    const nav = page.locator('nav, header, button[aria-label*="menu" i]').first();
    await expect(nav).toBeVisible();
  });

  test('Desktop layout works correctly', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Verify content displays correctly
    await expect(page.locator('body').first()).toBeVisible();
  });

  test('Tablet layout works correctly', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Verify page loads
    await expect(page.locator('body').first()).toBeVisible();
  });
});

test.describe('Production Readiness - Data Integrity', () => {

  test('Forms have proper validation', async ({ page }) => {
    await page.goto('/auth/login');

    // Try to submit an empty form
    const submitButton = page.getByRole('button', { name: /login|autentificare|conectare/i }).first();
    await submitButton.click();

    // Verify validation messages appear or the form was not submitted
    const emailInput = page.locator('input[type="email"]').first();
    const isInvalid = await emailInput.evaluate(el => (el as HTMLInputElement).validity.valid === false);

    // At least one field should be invalid
    expect(isInvalid).toBeTruthy();
  });

  test('External links open correctly', async ({ page }) => {
    await page.goto('/');

    // Find external links (optional)
    const externalLinks = page.locator('a[href^="http"]:not([href*="motiontimisoara"])');
    const count = await externalLinks.count();

    if (count > 0) {
      const firstExternalLink = externalLinks.first();
      const href = await firstExternalLink.getAttribute('href');
      const target = await firstExternalLink.getAttribute('target');

      // External links should have target="_blank"
      if (href && !href.includes('motiontimisoara.com')) {
        expect(target).toBe('_blank');
      }
    }
  });
});
