import { test, expect } from '@playwright/test';

test.describe('Homepage Tests', () => {
  test('should load homepage successfully', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('http://localhost:4200');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify the page title contains relevant text
    await expect(page).toHaveTitle(/Motion|Triathlon|Timișoara/i);
  });

  test('should display header with navigation', async ({ page }) => {
    await page.goto('http://localhost:4200');

    // Check if header exists
    const header = page.locator('header, app-header, [role="banner"]').first();
    await expect(header).toBeVisible();
  });

  test('should have main content area', async ({ page }) => {
    await page.goto('http://localhost:4200');

    // Check if main content area exists
    const main = page.locator('main, [role="main"], .main-content').first();
    await expect(main).toBeVisible();
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:4200');
    await page.waitForLoadState('networkidle');

    // Check that there are no critical console errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') && // Ignore favicon errors
      !err.includes('LiveReload') // Ignore dev server messages
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:4200');
    await expect(page.locator('body')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:4200');
    await expect(page.locator('body')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:4200');
    await expect(page.locator('body')).toBeVisible();
  });
});
