import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/** Portul pe care suita își pornește singură previzualizarea aplicației. */
const PREVIEW_PORT = 3021;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

/**
 * Ținta implicită era https://www.motiontimisoara.com — un domeniu care
 * răspunde 404 „Application not found" (Railway), verificat pe 24.08.2026 și
 * încă mort pe 27.08. Suita cădea deci la FIECARE push pe master, inclusiv pe
 * cele doar de documentație, iar un CI permanent roșu nu mai deosebește o
 * regresie reală de fundalul obișnuit.
 *
 * Implicitul e acum aplicația din ACEST repo, construită și servită local, adică
 * exact codul pe care îl verifică pull request-ul. Rularea împotriva unui domeniu
 * public rămâne posibilă, dar cere `BASE_URL` explicit — un host din afara
 * repo-ului nu mai poate să pice build-ul nimănui.
 */
const baseURL = process.env.BASE_URL || PREVIEW_URL;
const targetIsLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(baseURL);

const ALL_PROJECTS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. Locally the default (one worker per core)
     saturates the single-threaded Vite dev server that BASE_URL points at, so
     cold route compiles start timing out; cap it instead. */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on retry */
    video: 'retain-on-failure',
    
    /* Extended timeout for production tests */
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  
  /* Global timeout for each test */
  timeout: 60000,
  
  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Configure projects for major browsers.
     Pe CI rulează doar chromium: suita ia ~7 minute pe browser cu un singur
     worker, deci toate trei ar însemna ~21 de minute la fiecare push pe
     aplicație. Local rulează toate trei, iar pe CI se pot reactiva ștergând
     ramura `process.env.CI` de mai jos. */
  projects: process.env.CI
    ? ALL_PROJECTS.filter((p) => p.name === 'chromium')
    : ALL_PROJECTS,

  /* Viewporturile de telefon și browserele de marcă nu sunt acoperite aici:
     responsivitatea se verifică pe suprafețele din tracker, la 375x812. */

  /* Pornește singură aplicația din repo când ținta e locală.
     Construiește întâi, fiindcă `vite preview` servește `dist/`, nu sursa; pe
     CI asta durează câteva secunde. Când `BASE_URL` arată spre un host public,
     nu se pornește nimic — acolo aplicația rulează deja. */
  webServer: targetIsLocal
    ? {
        command:
          'npm run build && ' +
          `npm run preview -- --port ${PREVIEW_PORT} --strictPort --host 127.0.0.1`,
        // `cwd`, nu `npm --prefix`: previzualizarea trebuie să pornească din
        // folderul aplicației. Iar `--host 127.0.0.1` explicit fiindcă vite se
        // leagă implicit pe `localhost`, care pe Windows poate rezolva întâi la
        // ::1 — și atunci Playwright bate degeaba la 127.0.0.1.
        cwd: 'motiontimisoaraApp',
        url: PREVIEW_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
