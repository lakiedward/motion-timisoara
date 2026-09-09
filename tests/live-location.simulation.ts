import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Role = 'COACH' | 'PARENT' | 'CLUB';
type LocationAction = { action: string; occurrenceId?: string; sessionId?: string; consent?: boolean; expectedVersion?: number; accuracy?: number; latitude?: number; longitude?: number; capturedAt?: string; requestId?: string };
const backend = 'http://127.0.0.1:54329';
const fixedTime = new Date().toISOString();
const ids = {
  coach: '00000000-0000-0000-0000-000000000001', parent: '00000000-0000-0000-0000-000000000002',
  clubOwner: '00000000-0000-0000-0000-000000000006', course: '00000000-0000-0000-0000-000000000011',
  club: '00000000-0000-0000-0000-000000000021', occurrence: '00000000-0000-0000-0000-000000000101',
  child: '00000000-0000-0000-0000-000000000201', session: '00000000-0000-0000-0000-000000000301',
};
const child = { id: ids.child, parent_id: ids.parent, name: 'Copil Simulat Ana', birth_date: '2018-09-01' };
const course = {
  id: ids.course, name: 'Triatlon simulat #320', coach_id: ids.coach, club_id: ids.club, active: true,
  price: 10000, location: { name: 'Locație fictivă pentru test' }, sport: { id: 'triathlon', name: 'Triatlon' },
  coach: { id: ids.coach, name: 'Antrenor Simulat' },
};
const occurrence = { id: ids.occurrence, course_id: ids.course,
  starts_at: new Date(Date.parse(fixedTime) - 15 * 60000).toISOString(), ends_at: new Date(Date.parse(fixedTime) + 30 * 60000).toISOString(), course };
const expiresAt = new Date(Date.parse(fixedTime) + 45 * 60000).toISOString();

async function simulate(page: Page, role: Role) {
  const actor = { id: role === 'COACH' ? ids.coach : role === 'CLUB' ? ids.clubOwner : ids.parent,
    email: `${role.toLowerCase()}@example.invalid`, name: `${role} Simulat`, role, enabled: true, avatar_url: null };
  const evidence = {
    scope: 'Chromium uses synthetic auth, backend, geolocation, map tiles and Realtime frames. No live account, device background GPS or deployed backend is verified.',
    role, errors: [] as string[], unexpectedApi: [] as string[], externalRequests: [] as string[],
    actions: [] as LocationAction[], socketJoins: [] as { topic: string; private: boolean }[],
    socketEvents: [] as { event: string; payload: object }[], mockedScripts: [] as string[], tileCount: 0,
  };
  let active = role !== 'COACH';
  let consented = false;
  let consentVersion = 0;
  let point = { latitude: 45.75, longitude: 21.23, accuracy: 5, capturedAt: fixedTime, updatedAt: fixedTime };
  let emit: (() => void) | null = null;
  let releaseRead: (() => void) | null = null;
  let readGate: Promise<void> | null = null;
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') evidence.errors.push(message.text()); });
  await page.addInitScript(({ profile, origin }) => {
    const tokenPart = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    const session = {
      access_token: `${tokenPart({ alg: 'HS256', typ: 'JWT' })}.${tokenPart({ sub: profile.id, exp: expiry, role: 'authenticated' })}.simulation`,
      refresh_token: 'simulation-only', token_type: 'bearer', expires_at: expiry, expires_in: 86400,
      user: { id: profile.id, email: profile.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    };
    localStorage.setItem(`sb-${new URL(origin).hostname.split('.')[0]}-auth-token`, JSON.stringify(session));
    const watches = new Map<number, PositionCallback>();
    let nextWatch = 0;
    const deliver = (callback: PositionCallback) => callback({
      coords: { latitude: 45.75, longitude: 21.23, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: Date.now(),
    } as GeolocationPosition);
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (callback: PositionCallback) => {
        const id = ++nextWatch;
        watches.set(id, callback);
        queueMicrotask(() => { if (watches.has(id)) deliver(callback); });
        return id;
      },
      clearWatch: (id: number) => watches.delete(id),
      getCurrentPosition: deliver,
    } });
    Object.defineProperty(window, '__liveLocationSimulation', { value: { activeWatches: () => watches.size } });
  }, { profile: actor, origin: backend });

  await page.routeWebSocket('ws://127.0.0.1:54329/**', (socket) => {
    socket.onMessage((raw) => {
      const frame = JSON.parse(raw.toString()) as [string | null, string | null, string, string, Record<string, unknown>];
      const [joinRef, ref, topic, event, payload] = frame;
      if (event === 'phx_join') {
        const config = payload.config as { private?: boolean };
        evidence.socketJoins.push({ topic, private: config.private === true });
        emit = () => {
          evidence.socketEvents.push({ event: 'invalidate', payload: {} });
          socket.send(JSON.stringify([joinRef, null, topic, 'broadcast', { type: 'broadcast', event: 'invalidate', payload: {} }]));
        };
      }
      socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  const appOrigin = new URL(test.info().project.use.baseURL as string).origin;
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    if (url.origin === 'https://js.stripe.com' && url.pathname.endsWith('/stripe.js')) {
      evidence.mockedScripts.push(url.href);
      return route.fulfill({ contentType: 'application/javascript', body: 'window.Stripe = function () { throw new Error("Payments are outside this simulation"); };' });
    }
    if (url.hostname.endsWith('.basemaps.cartocdn.com')) {
      evidence.tileCount++;
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf1e9"/><path d="M0 80H256M80 0V256M0 180H256M180 0V256" stroke="#cad4c3" stroke-width="8"/><text x="18" y="135" fill="#53604b" font-size="13">HARTĂ SIMULATĂ #320</text></svg>' });
    }
    if (url.origin !== backend) {
      evidence.externalRequests.push(`${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    const respond = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body),
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Cache-Control': 'no-store' } });
    if (request.method() === 'OPTIONS') return respond(null);
    if (url.pathname === '/rest/v1/rpc/my_profile') return respond([actor]);
    if (url.pathname === '/auth/v1/user') return respond({ ...actor, aud: 'authenticated', user_metadata: {} });
    if (url.pathname === '/rest/v1/rpc/my_club') return respond([{ id: ids.club, owner_user_id: ids.clubOwner, name: 'Club Simulat' }]);
    if (url.pathname === '/rest/v1/children') return respond([child]);
    if (url.pathname === '/rest/v1/courses') return respond([course]);
    if (url.pathname === '/rest/v1/course_occurrences') {
      const future = url.searchParams.get('starts_at')?.startsWith('gte.');
      return respond(future ? [] : [occurrence]);
    }
    if (url.pathname === '/rest/v1/enrollments') return respond([{ id: 'enrollment-simulation', kind: 'COURSE', entity_id: ids.course,
      child_id: ids.child, status: 'ACTIVE', remaining_sessions: 5, sessions_used: 1, child, payments: [], created_at: fixedTime }]);
    if (url.pathname === '/rest/v1/attendance') return respond([{ id: 'attendance-simulation', occurrence_id: ids.occurrence,
      child_id: ids.child, status: 'PRESENT', occurrence: { starts_at: occurrence.starts_at, course } }]);
    if (url.pathname === '/functions/v1/coach-live-location') {
      const body = request.postDataJSON() as LocationAction;
      evidence.actions.push(body);
      const meta = () => ({ success: true, sessionId: ids.session, expiresAt,
        ...(role === 'PARENT' ? { consentGranted: consented, consentVersion } : {}) });
      if (body.action === 'start') {
        active = true;
        return respond(meta());
      }
      if (body.action === 'stop') {
        active = false;
        return respond({ success: true, sessionId: ids.session });
      }
      if (!active) return respond({ success: false, code: 'SESSION_NOT_FOUND', message: 'Partajarea locației nu este activă.' }, 409);
      if (body.action === 'status') return respond(meta());
      if (body.action === 'consent') {
        if (body.expectedVersion !== consentVersion) return respond({ success: false, code: 'REQUEST_CONFLICT', message: 'Acordul a fost modificat.' }, 409);
        consented = body.consent === true;
        consentVersion++;
        return respond(meta());
      }
      if (body.action === 'update') {
        point = { latitude: body.latitude!, longitude: body.longitude!, accuracy: body.accuracy!, capturedAt: body.capturedAt!, updatedAt: fixedTime };
        return respond(meta());
      }
      if (body.action === 'read') {
        if (readGate) await readGate;
        if (role === 'PARENT' && !consented) return respond({ success: false, code: 'CONSENT_REQUIRED', message: 'Confirmă acordul.' }, 403);
        return respond({ ...meta(), location: point });
      }
    }
    evidence.unexpectedApi.push(`${request.method()} ${url.pathname}`);
    return respond({ error: 'Unexpected synthetic API request' }, 500);
  });
  return {
    evidence,
    invalidate: () => { if (!emit) throw new Error('Synthetic Realtime channel has not joined'); emit(); },
    holdUpdatedRead: () => {
      point = { ...point, latitude: 45.751, longitude: 21.231, accuracy: 17 };
      readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    },
    releaseUpdatedRead: () => { releaseRead?.(); readGate = null; },
  };
}

async function capture(page: Page, info: TestInfo, name: string) {
  if (await page.getByLabel('Harta locației antrenorului').count()) {
    await expect.poll(() => page.locator('.leaflet-tile-loaded').evaluateAll((tiles) => tiles.length > 0 && tiles.every((tile) =>
      (tile as HTMLImageElement).complete && (tile as HTMLImageElement).naturalWidth > 0 && getComputedStyle(tile).opacity === '1'))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow').toBe(true);
  const path = info.outputPath(`SIMULATED-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(`SIMULATED ${name}; ${page.url()}; ${page.viewportSize()?.width}x${page.viewportSize()?.height}`, { path, contentType: 'image/png' });
}

async function proof(info: TestInfo, simulation: Awaited<ReturnType<typeof simulate>>) {
  const path = info.outputPath('SIMULATED-evidence.json');
  await writeFile(path, JSON.stringify(simulation.evidence, null, 2));
  await info.attach('Synthetic API, GPS and Realtime evidence', { path, contentType: 'application/json' });
  expect(simulation.evidence.errors).toEqual([]);
  expect(simulation.evidence.unexpectedApi).toEqual([]);
  expect(simulation.evidence.externalRequests).toEqual([]);
}

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`SIMULATED coach explicit start and global stop ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const simulation = await simulate(page, 'COACH');
    await page.goto('/coach/attendance');
    const panel = page.getByRole('region', { name: 'Partajarea locației antrenorului' });
    await expect(panel.getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled();
    await expect(panel.getByRole('checkbox')).toBeEnabled();
    expect(simulation.evidence.actions.filter((entry) => entry.action === 'start')).toHaveLength(0);
    await capture(page, info, 'coach-consent');
    await panel.getByRole('checkbox').check();
    await panel.getByRole('button', { name: 'Pornește partajarea' }).click();
    await expect(page.getByRole('complementary', { name: 'Partajare locație activă' })).toBeVisible();
    await expect(panel.getByText(/Ultima poziție trimisă/)).toBeVisible();
    expect(simulation.evidence.actions.find((entry) => entry.action === 'start')).toMatchObject({ consent: true, occurrenceId: ids.occurrence });
    expect(simulation.evidence.actions.find((entry) => entry.action === 'update')).toMatchObject({ latitude: 45.75, longitude: 21.23 });
    await capture(page, info, 'coach-active');
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Meniu', exact: true }).click();
    await page.getByRole('link', { name: 'Cursuri', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cursurile mele' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Partajare locație activă' })).toBeVisible();
    await capture(page, info, 'coach-global-control-after-navigation');
    await page.getByRole('complementary', { name: 'Partajare locație activă' }).getByRole('button', { name: 'Oprește locația' }).click();
    await expect(page.getByRole('complementary', { name: 'Partajare locație activă' })).toHaveCount(0);
    expect(simulation.evidence.actions.filter((entry) => entry.action === 'stop')).toHaveLength(1);
    expect(await page.evaluate(() => (window as unknown as { __liveLocationSimulation: { activeWatches: () => number } }).__liveLocationSimulation.activeWatches())).toBe(0);
    await capture(page, info, 'coach-stopped');
    await proof(info, simulation);
  });

  test(`SIMULATED parent consent map Realtime revoke ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const simulation = await simulate(page, 'PARENT');
    await page.goto('/account/attendance');
    const sessions = page.getByRole('region', { name: 'Ședințe cu locație în timp real' });
    await sessions.getByRole('button', { name: /Ședință ·/ }).click();
    await expect(sessions.getByRole('button', { name: 'Accept și văd locația' })).toBeVisible();
    await expect(page.getByLabel('Harta locației antrenorului')).toHaveCount(0);
    expect(simulation.evidence.actions.filter((entry) => entry.action === 'read')).toHaveLength(0);
    await capture(page, info, 'parent-consent');
    await sessions.getByRole('button', { name: 'Accept și văd locația' }).click();
    await expect(page.getByLabel('Harta locației antrenorului')).toBeVisible();
    await expect(page.getByTitle('Poziția antrenorului', { exact: true })).toBeVisible();
    await expect.poll(() => simulation.evidence.tileCount).toBeGreaterThan(0);
    await expect.poll(() => simulation.evidence.socketJoins.length).toBeGreaterThan(0);
    expect(simulation.evidence.socketJoins.every((join) => join.private && join.topic.endsWith(`coach-live-location:${ids.session}`))).toBe(true);
    await capture(page, info, 'parent-map');
    simulation.holdUpdatedRead();
    const reads = simulation.evidence.actions.filter((entry) => entry.action === 'read').length;
    simulation.invalidate();
    await expect(page.getByLabel('Harta locației antrenorului')).toHaveCount(0);
    await expect.poll(() => simulation.evidence.actions.filter((entry) => entry.action === 'read').length, { timeout: 2000 }).toBeGreaterThan(reads);
    simulation.releaseUpdatedRead();
    await expect(sessions.getByText(/precizie aproximativă 17 m/)).toBeVisible();
    await capture(page, info, 'parent-realtime-updated');
    await sessions.getByRole('button', { name: 'Retrage acordul' }).click();
    await expect(page.getByLabel('Harta locației antrenorului')).toHaveCount(0);
    await expect(sessions.getByRole('button', { name: 'Accept și văd locația' })).toBeVisible();
    expect(simulation.evidence.actions.filter((entry) => entry.action === 'consent')).toEqual([
      { action: 'consent', occurrenceId: ids.occurrence, sessionId: ids.session, consent: true, expectedVersion: 0 },
      { action: 'consent', occurrenceId: ids.occurrence, sessionId: ids.session, consent: false, expectedVersion: 1 },
    ]);
    const afterRevoke = simulation.evidence.actions.filter((entry) => entry.action === 'read').length;
    simulation.invalidate();
    await expect(sessions.getByRole('button', { name: 'Accept și văd locația' })).toBeEnabled();
    expect(simulation.evidence.actions.filter((entry) => entry.action === 'read').length).toBe(afterRevoke);
    await capture(page, info, 'parent-revoked');
    await proof(info, simulation);
  });

  test(`SIMULATED owning club map ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const simulation = await simulate(page, 'CLUB');
    await page.goto('/club/courses');
    const sessions = page.getByRole('region', { name: 'Ședințe cu locație în timp real' });
    await sessions.getByRole('button', { name: /Triatlon simulat #320 ·/ }).click();
    await expect(page.getByLabel('Harta locației antrenorului')).toBeVisible();
    await expect(page.getByTitle('Poziția antrenorului', { exact: true })).toBeVisible();
    await expect(sessions.getByRole('button', { name: 'Accept și văd locația' })).toHaveCount(0);
    expect(simulation.evidence.actions.some((entry) => ['start', 'update', 'consent'].includes(entry.action))).toBe(false);
    await capture(page, info, 'club-map');
    await proof(info, simulation);
  });
}
