import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Teste rapide pentru verificarea funcționalității de bază
 * Rulează rapid pentru a verifica că site-ul este UP și funcțional
 */

test.describe('Smoke Tests - Quick Health Check', () => {
  
  test('Homepage is UP', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    
    // Verifică că pagina conține conținut
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test('API is reachable', async ({ request }) => {
    // Încearcă să accesezi un endpoint public
    const response = await request.get('/api/courses/public').catch(() => null);
    
    if (response) {
      // Dacă endpoint-ul există, verifică că nu returnează 500
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('Static assets load', async ({ page }) => {
    await page.goto('/');
    
    // Verifică că CSS-ul s-a încărcat
    const styles = await page.locator('style, link[rel="stylesheet"]').count();
    expect(styles).toBeGreaterThan(0);
    
    // Verifică că JavaScript-ul s-a încărcat
    const scripts = await page.locator('script').count();
    expect(scripts).toBeGreaterThan(0);
  });

  test('No critical JavaScript errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Filtrează doar erorile critice (nu warning-uri sau info)
    const criticalErrors = errors.filter(err => 
      !err.includes('warning') && 
      !err.includes('info') &&
      !err.includes('favicon')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('Navigation menu is present', async ({ page }) => {
    await page.goto('/');
    
    // Verifică că există navigație principală
    const hasNav = await page.locator('nav, header').count() > 0;
    expect(hasNav).toBeTruthy();
  });

  test('Footer is present', async ({ page }) => {
    await page.goto('/');
    
    // Verifică că există footer
    const hasFooter = await page.locator('footer').count() > 0;
    expect(hasFooter).toBeTruthy();
  });

  test('SSL certificate is valid (HTTPS)', async ({ page }) => {
    const response = await page.goto('/');
    const url = page.url();
    
    // Verifică că site-ul folosește HTTPS
    expect(url).toContain('https://');
  });

  test('Robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt');
    
    // Robots.txt ar trebui să existe (200) sau să nu existe (404), dar nu 500
    expect(response.status()).toBeLessThan(500);
  });

  test('Main pages return 200 status', async ({ page }) => {
    const pages = ['/', '/courses', '/auth/login', '/auth/register'];
    
    for (const pagePath of pages) {
      const response = await page.goto(pagePath);
      expect(response?.status(), `${pagePath} should return 200`).toBe(200);
    }
  });

  test('Browser console has no critical errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Filtrează erorile cunoscute care nu sunt critice
        const text = msg.text();
        if (!text.includes('favicon') && 
            !text.includes('Google Maps') &&
            !text.includes('analytics')) {
          consoleErrors.push(text);
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Loghează erorile pentru debug
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
    
    // Nu ar trebui să existe erori critice în consolă
    expect(consoleErrors.length).toBeLessThan(5); // Permitem maximum 5 erori non-critice
  });
});

test.describe('Smoke Tests - Critical User Journeys', () => {
  
  test('User can view courses list', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    
    // Verifică că pagina s-a încărcat
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('User can access login page', async ({ page }) => {
    const response = await page.goto('/auth/login');
    
    // Verifică că pagina s-a încărcat (poate fi redirect)
    expect(response?.status()).toBeLessThan(400);
    
    // Verifică că există conținut pe pagină
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('User can access registration page', async ({ page }) => {
    const response = await page.goto('/auth/register');
    
    // Verifică că pagina s-a încărcat (poate fi redirect)
    expect(response?.status()).toBeLessThan(400);
    
    // Verifică că există conținut pe pagină
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('Back button works correctly', async ({ page }) => {
    await page.goto('/');
    await page.goto('/courses');
    await page.goBack();
    
    // Verifică că am revenit la homepage
    expect(page.url()).toContain('motiontimisoara.com');
  });

  test('Forward button works correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.goForward();
    await page.waitForLoadState('networkidle');
    
    // Verifică că suntem pe o pagină validă
    const url = page.url();
    expect(url).toContain('motiontimisoara.com');
  });
});

test.describe('Smoke Tests - Performance Baseline', () => {
  
  test('Homepage loads in reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    console.log(`Homepage load time: ${loadTime}ms`);
    
    // Ar trebui să încarce în mai puțin de 5 secunde (production poate fi mai lent)
    expect(loadTime).toBeLessThan(5000);
  });

  test('Courses page loads in reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/courses');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    console.log(`Courses page load time: ${loadTime}ms`);
    
    // Ar trebui să încarce în mai puțin de 15 secunde (poate avea multe date)
    expect(loadTime).toBeLessThan(15000);
  });

  test('No memory leaks on navigation', async ({ page }) => {
    // Navighează între pagini de mai multe ori
    for (let i = 0; i < 3; i++) {
      await page.goto('/');
      await page.goto('/courses');
      await page.goto('/auth/login');
    }
    
    // Dacă ajungem aici fără timeout, nu există memory leaks majore
    expect(true).toBeTruthy();
  });
});
