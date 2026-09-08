import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Scenario = 'by-age' | 'single' | 'old-backend' | 'missing-quote' | 'unmatched' | 'changed' | 'offering-error' | 'children-error';
type Quote = { childId: string; name: string; eligible: boolean; severity?: string; reason?: string; amount?: number; currency?: string; priceVersion?: string };

const backendOrigin = 'http://127.0.0.1:54329';
const children = [
  { id: 'child-a', name: 'Copil Simulat Ana', parent_id: 'parent-simulation', birth_date: '2018-09-01' },
  { id: 'child-b', name: 'Copil Simulat Bogdan', parent_id: 'parent-simulation', birth_date: '2014-09-01' },
];
const profile = {
  id: 'parent-simulation', email: 'parent@example.invalid', name: 'Părinte Simulat',
  role: 'PARENT', phone: '0000000000', avatar_url: null,
};

async function simulate(page: Page, scenario: Scenario = 'by-age') {
  const errors: string[] = [];
  const expectedHttpErrors: string[] = [];
  const externalRequests: string[] = [];
  const unexpectedApi: string[] = [];
  const submissions: Record<string, unknown>[] = [];
  const mockedExternalScripts: string[] = [];
  let recovered = false;
  let changed = false;
  let created = false;
  const quote = (): Quote[] => children.map((child, index) => ({
    childId: child.id, name: child.name, eligible: true,
    amount: scenario === 'single' ? 50000 : index === 0 ? 60000 : changed ? 90000 : 80000,
    currency: 'RON', priceVersion: `simulated-version-${child.id}-${changed ? 'new' : 'original'}`,
  }));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if ((scenario === 'changed' && message.text().includes('409')) || (scenario.endsWith('-error') && message.text().includes('503'))) expectedHttpErrors.push(message.text());
    else errors.push(`${message.text()} ${message.location().url}`);
  });
  await page.addInitScript(({ fakeProfile, origin }) => {
    const tokenPart = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    const session = {
      access_token: `${tokenPart({ alg: 'HS256', typ: 'JWT' })}.${tokenPart({ sub: fakeProfile.id, exp: expiry, role: 'authenticated' })}.simulation`,
      refresh_token: 'simulation-only', token_type: 'bearer', expires_at: expiry, expires_in: 86400,
      user: { id: fakeProfile.id, email: fakeProfile.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    };
    localStorage.setItem(`sb-${new URL(origin).hostname.split('.')[0]}-auth-token`, JSON.stringify(session));
  }, { fakeProfile: profile, origin: backendOrigin });
  const appOrigin = new URL(test.info().project.use.baseURL as string).origin;
  await page.routeWebSocket((url) => url.origin.replace(/^ws/, 'http') !== appOrigin, (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/functions/v1/');
    if (!isApi) {
      if (url.origin === 'https://js.stripe.com' && url.pathname.endsWith('/stripe.js')) {
        mockedExternalScripts.push(url.href);
        return route.fulfill({ contentType: 'application/javascript', body: 'window.Stripe = function () { throw new Error("Real Stripe is forbidden in this simulation"); };' });
      }
      if (url.origin === new URL(test.info().project.use.baseURL as string).origin) return route.continue();
      externalRequests.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    }
    if (url.origin !== backendOrigin) externalRequests.push(url.origin + url.pathname);
    const respond = (body: unknown, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Retry-After', 'Retry-After': '0' },
    });
    if (request.method() === 'OPTIONS') return respond(null);
    const path = url.pathname;
    if (path === '/rest/v1/rpc/my_profile') return respond([profile]);
    if (path === '/auth/v1/user') return respond({ ...profile, aud: 'authenticated', user_metadata: {} });
    if (path === '/rest/v1/children') return scenario === 'children-error' && !recovered
      ? respond({ message: 'Simulated children failure' }, 503) : respond(children);
    if (path === '/rest/v1/camps') {
      if (scenario === 'offering-error' && !recovered && url.searchParams.get('select') === '*') return respond({ message: 'Simulated offering failure' }, 503);
      const camp = {
        id: 'camp-simulation', slug: 'test-315', title: 'Tabără simulată #315', description: 'Date fictive pentru verificarea locală a înscrierii.',
        price: 99000, pricing_mode: scenario === 'single' ? 'single' : 'by_age', currency: 'RON',
        period_start: '2099-10-01', period_end: '2099-10-07', capacity: 20, allow_cash: true,
        hero_photo_storage_path: null, location_text: 'Locație simulată', club: null, coach: null,
      };
      return respond(request.headers().accept?.includes('vnd.pgrst.object') ? camp : [camp]);
    }
    if (['/rest/v1/camp_price_items', '/rest/v1/camp_coaches', '/rest/v1/camp_photos'].includes(path)) return respond([]);
    if (path === '/rest/v1/rpc/camp_spots_remaining') return respond(20);
    if (path === '/rest/v1/enrollments') return respond(created ? quote().map((item, index) => ({
      id: `simulated-enrollment-${index}`, kind: 'CAMP', status: 'PENDING', child: children[index],
      payments: [{ amount: item.amount, status: 'PENDING', method: 'CASH', paid_at: null }],
    })) : []);
    if (path === '/functions/v1/validate-enrollment') {
      let results = quote();
      if (scenario === 'old-backend') results = results.map(({ amount: _amount, currency: _currency, priceVersion: _version, ...item }) => item);
      if (scenario === 'missing-quote') results = results.slice(0, 1);
      if (scenario === 'unmatched') results[1] = { childId: children[1].id, name: children[1].name, eligible: false, severity: 'error', reason: 'Nu există o categorie de preț pentru vârsta copilului la începutul taberei.' };
      return respond({ results, capacity: { available: 20, requested: 2, sufficient: true }, allowCash: true });
    }
    if (path === '/functions/v1/create-enrollment') {
      submissions.push(request.postDataJSON());
      if (scenario === 'changed' && !changed) {
        changed = true;
        return respond({ error: 'Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.', code: 'PRICE_CHANGED' }, 409);
      }
      created = true;
      return respond({ enrollmentId: 'simulated-enrollment-0', enrollmentIds: ['simulated-enrollment-0', 'simulated-enrollment-1'], requiresPaymentIntent: false, prices: quote() });
    }
    unexpectedApi.push(`${request.method()} ${path}`);
    return respond({ error: 'Unexpected simulated API request' }, 500);
  });
  return { errors, expectedHttpErrors, externalRequests, unexpectedApi, submissions, mockedExternalScripts, recover: () => { recovered = true; } };
}

async function openCheckout(page: Page) {
  await page.goto('/tabere/test-315');
  await expect(page.getByRole('heading', { name: 'Tabără simulată #315' })).toBeVisible();
  await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/checkout\?kind=CAMP&slug=test-315/);
  await expect(page.getByRole('heading', { name: 'Finalizează înscrierea' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Copil Simulat Ana/ })).toBeVisible();
}

async function selectChildren(page: Page) {
  await page.getByRole('checkbox', { name: /Copil Simulat Ana/ }).check();
  await page.getByRole('checkbox', { name: /Copil Simulat Bogdan/ }).check();
}

async function details(page: Page) {
  await selectChildren(page);
  await page.getByRole('button', { name: 'Continuă', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Am citit și accept/ })).toBeVisible();
}

async function payment(page: Page) {
  await page.getByRole('checkbox', { name: /Am citit și accept/ }).check();
  await page.getByRole('button', { name: 'Continuă', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sumar comandă' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Cash, la antrenor/ })).toBeChecked();
}

async function capture(page: Page, info: TestInfo, state: string) {
  const overflow = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(overflow.content, `Horizontal overflow in simulated ${state}`).toBeLessThanOrEqual(overflow.width);
  const path = info.outputPath(`SIMULATED-${state}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(`SIMULATED ${state}; ${page.viewportSize()?.width}x${page.viewportSize()?.height}; ${page.url()}`, { path, contentType: 'image/png' });
}

async function proof(info: TestInfo, state: Awaited<ReturnType<typeof simulate>>) {
  const path = info.outputPath('SIMULATED-network-console.json');
  await writeFile(path, JSON.stringify(state, null, 2));
  await info.attach('SIMULATED network and console evidence', { path, contentType: 'application/json' });
  expect(state.errors).toEqual([]);
  expect(state.externalRequests).toEqual([]);
  expect(state.unexpectedApi).toEqual([]);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
  test(`SIMULATED camp age pricing cash journey ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const state = await simulate(page);
    await openCheckout(page);
    await details(page);
    await expect(page.getByText('600,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('800,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('1.400,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('990,00 lei', { exact: true })).toHaveCount(0);
    await capture(page, info, 'age-pricing-details');
    await payment(page);
    await expect(page.getByText('1.400,00 lei', { exact: true }).first()).toBeVisible();
    await capture(page, info, 'cash-payment');
    await page.getByRole('button', { name: 'Finalizează', exact: true }).click();
    await expect(page).toHaveURL(/\/account\/enrollments$/);
    await expect(page.getByRole('heading', { name: 'Înscrieri și plăți' })).toBeVisible();
    await expect(page.getByText('600,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('800,00 lei', { exact: true })).toBeVisible();
    expect(state.submissions).toEqual([{
      kind: 'CAMP', entityId: 'camp-simulation', childIds: ['child-a', 'child-b'], paymentMethod: 'CASH',
      priceVersions: { 'child-a': 'simulated-version-child-a-original', 'child-b': 'simulated-version-child-b-original' },
    }]);
    await proof(info, state);
  });
}

for (const scenario of ['old-backend', 'missing-quote'] as const) {
  test(`SIMULATED ${scenario} blocks checkout with no fallback price`, async ({ page }, info) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const state = await simulate(page, scenario);
    await openCheckout(page);
    await selectChildren(page);
    await expect(page.getByRole('button', { name: 'Continuă', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('Prețul sau eligibilitatea');
    await capture(page, info, scenario);
    expect(state.submissions).toEqual([]);
    await proof(info, state);
  });
}

test('SIMULATED unmatched age prevents selecting the ineligible child', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, 'unmatched');
  await openCheckout(page);
  await expect(page.getByRole('checkbox', { name: /Copil Simulat Bogdan/ })).toBeDisabled();
  await expect(page.getByText('Nu există o categorie de preț pentru vârsta copilului la începutul taberei.')).toBeVisible();
  await capture(page, info, 'unmatched-age');
  expect(state.submissions).toEqual([]);
  await proof(info, state);
});

test('SIMULATED single price still follows server quotes for each child', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await simulate(page, 'single');
  await openCheckout(page);
  await details(page);
  await expect(page.getByText('500,00 lei', { exact: true })).toHaveCount(2);
  await expect(page.getByText('1.000,00 lei', { exact: true })).toBeVisible();
  await capture(page, info, 'single-price');
  expect(state.submissions).toEqual([]);
  await proof(info, state);
});

test('SIMULATED offering failure shows retry and recovers the checkout', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, 'offering-error');
  await page.goto('/tabere/test-315');
  await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nu am putut încărca oferta');
  await capture(page, info, 'offering-error');
  state.recover();
  await page.getByRole('button', { name: 'Reîncearcă', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finalizează înscrierea' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Copil Simulat Ana/ })).toBeVisible();
  expect(state.submissions).toEqual([]);
  await proof(info, state);
});

test('SIMULATED child list failure shows retry and recovers selection', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, 'children-error');
  await page.goto('/tabere/test-315');
  await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nu am putut încărca lista de copii');
  await expect(page.getByRole('button', { name: 'Continuă', exact: true })).toBeDisabled();
  await capture(page, info, 'children-error');
  state.recover();
  await page.getByRole('button', { name: 'Reîncearcă', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Copil Simulat Ana/ })).toBeVisible();
  expect(state.submissions).toEqual([]);
  await proof(info, state);
});

test('SIMULATED changed server quote returns to details and requires fresh acceptance', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, 'changed');
  await openCheckout(page);
  await details(page);
  await payment(page);
  await page.getByRole('button', { name: 'Finalizează', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Am citit și accept/ })).not.toBeChecked();
  await expect(page.getByText('900,00 lei', { exact: true })).toBeVisible();
  await expect(page.getByText('1.500,00 lei', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuă', exact: true })).toBeDisabled();
  await capture(page, info, 'changed-price-reacceptance');
  await payment(page);
  await page.getByRole('button', { name: 'Finalizează', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/enrollments$/);
  expect(state.submissions).toHaveLength(2);
  expect(state.submissions[1].priceVersions).toEqual({ 'child-a': 'simulated-version-child-a-new', 'child-b': 'simulated-version-child-b-new' });
  await proof(info, state);
});

test('SIMULATED background quote refresh preserves cached prices and accepted continuation', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page);
  await openCheckout(page);
  await details(page);
  await page.getByRole('checkbox', { name: /Am citit și accept/ }).check();
  await expect(page.getByRole('button', { name: 'Continuă', exact: true })).toBeEnabled();

  let releaseRefresh!: () => void;
  let observeRefresh!: () => void;
  const refreshHeld = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  const refreshStarted = new Promise<void>((resolve) => { observeRefresh = resolve; });
  await page.route('**/functions/v1/validate-enrollment', async (route) => {
    observeRefresh();
    await refreshHeld;
    await route.fallback();
  });

  try {
    await page.clock.setFixedTime(new Date(Date.now() + 31000));
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await refreshStarted;
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByText('600,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('800,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('1.400,00 lei', { exact: true })).toBeVisible();
    await expect(page.getByText('Preț indisponibil', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /Am citit și accept/ })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Continuă', exact: true })).toBeEnabled();
    await capture(page, info, 'cached-prices-during-background-refresh');
  } finally {
    releaseRefresh();
  }

  await page.getByRole('button', { name: 'Continuă', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sumar comandă' })).toBeVisible();
  await expect(page.getByText('1.400,00 lei', { exact: true }).first()).toBeVisible();
  expect(state.submissions).toEqual([]);
  await proof(info, state);
});
