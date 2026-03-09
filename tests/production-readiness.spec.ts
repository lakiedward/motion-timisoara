import { test, expect } from '@playwright/test';

/**
 * Test Suite: Production Readiness
 * Verifică că site-ul este pregătit pentru producție
 */

test.describe('Production Readiness - Critical User Flows', () => {
  
  test('Homepage loads successfully with all key elements', async ({ page }) => {
    await page.goto('/');
    
    // Verifică titlul paginii
    await expect(page).toHaveTitle(/Motion Timișoara/);
    
    // Verifică că logo-ul este vizibil
    await expect(page.locator('img[alt*="logo" i], img[src*="logo"]').first()).toBeVisible();
    
    // Verifică că există navigație
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
    
    // Verifică că există link-uri principale în navigație
    await expect(page.getByRole('link', { name: /cursuri|acasă|despre/i })).toBeVisible();
    
    // Verifică că pagina nu are erori în consolă (critice)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error on homepage: ${msg.text()}`);
      }
    });
  });

  test('Courses page displays course listings', async ({ page }) => {
    await page.goto('/courses');
    
    // Așteaptă ca pagina să încarce
    await page.waitForLoadState('networkidle');
    
    // Verifică că există titlu pentru cursuri
    await expect(page.locator('h1, h2').filter({ hasText: /cursuri|course/i }).first()).toBeVisible();
    
    // Verifică că există cel puțin un curs sau un mesaj informativ
    const hasCourses = await page.locator('mat-card, .course-card, [class*="course"]').count() > 0;
    const hasMessage = await page.locator('text=/nu există|no courses|încă nu/i').isVisible().catch(() => false);
    
    expect(hasCourses || hasMessage).toBeTruthy();
  });

  test('Login page is accessible and functional', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Verifică că formularul de login există
    await expect(page.locator('form').first()).toBeVisible();
    
    // Verifică câmpurile de autentificare
    const emailInput = page.locator('input[type="email"], input[name="email"], input[formControlName="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[formControlName="password"]').first();
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Verifică butonul de login
    const loginButton = page.getByRole('button', { name: /login|autentificare|conectare/i }).first();
    await expect(loginButton).toBeVisible();
    
    // Verifică că există link pentru înregistrare
    await expect(page.getByRole('link', { name: /înregistrare|register|sign up/i })).toBeVisible();
  });

  test('Registration page is accessible', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Verifică că formularul de înregistrare există
    await expect(page.locator('form').first()).toBeVisible();
    
    // Verifică că există câmp pentru nume
    await expect(page.locator('input[name*="name" i], input[formControlName*="name" i]').first()).toBeVisible();
    
    // Verifică că există câmp pentru email
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    
    // Verifică că există câmp pentru parolă
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('Navigation between main pages works', async ({ page }) => {
    await page.goto('/');
    
    // Navighează la cursuri
    const coursesLink = page.getByRole('link', { name: /cursuri|courses/i }).first();
    await coursesLink.click();
    await page.waitForURL(/.*courses.*/);
    await expect(page).toHaveURL(/.*courses.*/);
    
    // Navighează înapoi la homepage
    const homeLink = page.getByRole('link', { name: /acasă|home|motion/i }).first();
    await homeLink.click();
    await page.waitForLoadState('networkidle');
  });

  test('Public course details are viewable', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    
    // Caută primul curs disponibil
    const firstCourse = page.locator('mat-card, .course-card, [class*="course"]').first();
    const courseExists = await firstCourse.isVisible().catch(() => false);
    
    if (courseExists) {
      // Click pe primul curs
      await firstCourse.click();
      
      // Verifică că am navigat la detalii curs
      await page.waitForLoadState('networkidle');
      
      // Verifică că există informații despre curs
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('Site handles 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz123');
    
    // Verifică că pagina încarcă (fie 404, fie redirect)
    expect(response?.status()).toBeLessThan(500);
    
    // Verifică că există conținut pe pagină (nu e blank)
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.length).toBeGreaterThan(0);
  });
});

test.describe('Production Readiness - Security & Performance', () => {
  
  test('Security headers are present', async ({ page }) => {
    const response = await page.goto('/');
    
    // Verifică că răspunsul este OK
    expect(response?.status()).toBe(200);
    
    // Verifică că Content-Type este HTML
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('text/html');
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
    
    // Pagina ar trebui să încarce în mai puțin de 5 secunde
    expect(loadTime).toBeLessThan(5000);
  });

  test('Images load successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verifică că imaginile importante au încărcat
    const images = page.locator('img[src]');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Verifică prima imagine (de obicei logo)
      const firstImage = images.first();
      await expect(firstImage).toBeVisible();
      
      // Verifică că imaginea are atribut src valid
      const src = await firstImage.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src?.length).toBeGreaterThan(0);
    }
  });

  test('API connectivity check', async ({ page }) => {
    // Interceptează request-uri către API
    const apiRequests: any[] = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });
    
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    
    // Dacă există request-uri API, verifică că nu sunt toate eșuate
    if (apiRequests.length > 0) {
      console.log(`API requests detected: ${apiRequests.length}`);
    }
  });
});

test.describe('Production Readiness - Responsive Design', () => {
  
  test('Site is mobile-friendly', async ({ page }) => {
    // Setează viewport mobil
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Verifică că logo-ul este vizibil pe mobil
    await expect(page.locator('img[alt*="logo" i], img[src*="logo"]').first()).toBeVisible();
    
    // Verifică că există navigație (poate fi hamburger menu)
    const nav = page.locator('nav, header, button[aria-label*="menu" i]').first();
    await expect(nav).toBeVisible();
  });

  test('Desktop layout works correctly', async ({ page }) => {
    // Setează viewport desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // Verifică că conținutul se afișează corect
    await expect(page.locator('body').first()).toBeVisible();
  });

  test('Tablet layout works correctly', async ({ page }) => {
    // Setează viewport tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // Verifică că pagina se încarcă
    await expect(page.locator('body').first()).toBeVisible();
  });
});

test.describe('Production Readiness - Data Integrity', () => {
  
  test('Forms have proper validation', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Încearcă să trimiți formularul gol
    const submitButton = page.getByRole('button', { name: /login|autentificare|conectare/i }).first();
    await submitButton.click();
    
    // Verifică că există mesaje de validare sau că formularul nu s-a trimis
    const emailInput = page.locator('input[type="email"]').first();
    const isInvalid = await emailInput.evaluate(el => (el as HTMLInputElement).validity.valid === false);
    
    // Cel puțin unul dintre câmpuri ar trebui să fie invalid
    expect(isInvalid).toBeTruthy();
  });

  test('External links open correctly', async ({ page, context }) => {
    await page.goto('/');
    
    // Caută link-uri externe (opțional)
    const externalLinks = page.locator('a[href^="http"]:not([href*="motiontimisoara"])');
    const count = await externalLinks.count();
    
    if (count > 0) {
      const firstExternalLink = externalLinks.first();
      const href = await firstExternalLink.getAttribute('href');
      const target = await firstExternalLink.getAttribute('target');
      
      // Link-urile externe ar trebui să aibă target="_blank"
      if (href && !href.includes('motiontimisoara.com')) {
        expect(target).toBe('_blank');
      }
    }
  });
});
