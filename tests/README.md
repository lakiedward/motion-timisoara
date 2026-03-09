# E2E Tests - Production Readiness

Acest director conține teste end-to-end (E2E) pentru a valida că aplicația Motion Timișoara este pregătită pentru producție.

## 📋 Suite de Teste

### 1. **Smoke Tests** (`smoke-tests.spec.ts`)
Teste rapide pentru verificarea funcționalității de bază:
- ✅ Homepage UP și funcțional
- ✅ API accesibil
- ✅ Asset-uri statice se încarcă
- ✅ Nu există erori JavaScript critice
- ✅ SSL funcționează (HTTPS)
- ✅ Performance baseline

**Rulare:** Aproximativ 1-2 minute

### 2. **Production Readiness Tests** (`production-readiness.spec.ts`)
Teste comprehensive pentru validare producție:
- ✅ Fluxuri critice utilizator (homepage, cursuri, auth)
- ✅ Securitate și headers
- ✅ Performance și timp de încărcare
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Integritate date și validare formulare
- ✅ Gestionare erori (404, etc.)

**Rulare:** Aproximativ 5-10 minute

## 🚀 Cum să Rulezi Testele

### Instalare Dependențe

Dacă nu ai instalat Playwright încă:

```bash
# Instalează Playwright și browser-ele
npx playwright install
```

### Rulare Teste - Producție (Recomandat)

Testează site-ul live de producție:

```bash
# Rulează toate testele
npx playwright test

# Rulează doar smoke tests (rapid)
npx playwright test smoke-tests

# Rulează doar production readiness tests
npx playwright test production-readiness

# Rulează în UI mode pentru debugging
npx playwright test --ui

# Rulează cu raport detaliat
npx playwright test --reporter=html
```

### Rulare Teste - Local Development

Pentru a testa aplicația local:

```bash
# Setează BASE_URL la localhost
BASE_URL=http://localhost:4200 npx playwright test

# Sau pe Windows PowerShell:
$env:BASE_URL="http://localhost:4200"; npx playwright test
```

**IMPORTANT:** Asigură-te că:
1. Backend rulează pe `http://localhost:8081`
2. Frontend rulează pe `http://localhost:4200`
3. Meta tag `api-base-url` din `TriathlonTeamFE/src/index.html` pointează la `http://localhost:8081`

### Vizualizare Rapoarte

După rularea testelor, vezi raportul detaliat:

```bash
# Deschide raportul HTML
npx playwright show-report
```

## 🎯 Strategie de Testare

### Pre-Deploy Checklist

Înainte de orice deploy în producție:

1. ✅ **Rulează Smoke Tests**
   ```bash
   npx playwright test smoke-tests
   ```
   
2. ✅ **Rulează Production Readiness Tests**
   ```bash
   npx playwright test production-readiness
   ```

3. ✅ **Verifică raportul** - zero erori critice

4. ✅ **Testează manual** funcționalități noi

### CI/CD Integration

Testele sunt configurate să ruleze automat în CI/CD:
- Retry automat: 2 încercări în CI
- Screenshots la eșec
- Video recording la retry
- Timeout extins pentru producție

## 🔧 Configurare

Configurația Playwright se află în `/playwright.config.ts`:

```typescript
baseURL: process.env.BASE_URL || 'https://www.motiontimisoara.com'
```

### Environment Variables

- `BASE_URL`: URL-ul site-ului de testat (default: producție)
- `CI`: Detectare automată pentru CI/CD

## 📊 Metrici de Succes

Testele verifică:

| Metric | Target | Prioritate |
|--------|--------|-----------|
| Homepage load time | < 3s | Critică |
| API response time | < 2s | Critică |
| Mobile responsive | 100% | Critică |
| Zero JS errors | 0 erori critice | Critică |
| HTTPS enabled | Da | Critică |
| All pages return 200 | Da | Critică |

## 🐛 Debugging

### Teste Eșuează?

1. **Verifică screenshots** - în `test-results/`
2. **Verifică video** - în `test-results/` (doar pentru retry)
3. **Rulează în UI mode**:
   ```bash
   npx playwright test --ui
   ```

4. **Rulează în debug mode**:
   ```bash
   npx playwright test --debug
   ```

5. **Verifică logs**:
   ```bash
   npx playwright test --reporter=list
   ```

### Probleme Comune

**Timeout errors:**
- Verifică că site-ul este UP
- Verifică conexiunea internet
- Crește timeout în `playwright.config.ts`

**Element not found:**
- UI-ul s-a schimbat - actualizează selectorii
- Element-ul se încarcă async - adaugă waitFor

**Network errors:**
- Verifică că API-ul rulează
- Verifică CORS settings
- Verifică firewall/proxy

## 📝 Adăugare Teste Noi

Pentru a adăuga teste noi:

1. Creează un fișier nou: `tests/my-feature.spec.ts`
2. Importă Playwright test:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```

3. Scrie testele:
   ```typescript
   test.describe('My Feature', () => {
     test('should work correctly', async ({ page }) => {
       await page.goto('/my-feature');
       await expect(page.locator('h1')).toBeVisible();
     });
   });
   ```

4. Rulează testele:
   ```bash
   npx playwright test my-feature
   ```

## 🔗 Resurse Utile

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)

## ✅ Status Teste

Ultima actualizare: 24 Noiembrie 2025

| Test Suite | Status | Coverage |
|------------|--------|----------|
| Smoke Tests | ✅ Implementat | Homepage, API, Assets |
| Production Readiness | ✅ Implementat | Auth, Courses, Navigation |
| Mobile Tests | ✅ Implementat | Responsive design |
| Performance Tests | ✅ Implementat | Load times |

---

**Note:** Testele sunt configurate pentru a rula împotriva site-ului de producție by default. Pentru teste locale, setează `BASE_URL` environment variable.
