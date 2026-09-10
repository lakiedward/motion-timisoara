import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export const ids = {
  coach: '00000000-0000-4000-8000-000000000001',
  parent: '00000000-0000-4000-8000-000000000002',
  camp: '00000000-0000-4000-8000-000000000401',
  child: '00000000-0000-4000-8000-000000000201',
  enrollment: '00000000-0000-4000-8000-000000000501',
};
export const coachName = 'Antrenor Simulat';
export const campTitle = 'Tabără simulată #320';
type Action = {
  action: string; campId?: string; coachId?: string; enrollmentId?: string; occurrenceId?: string;
  sessionId?: string; consent?: boolean; expectedVersion?: number; latitude?: number;
  longitude?: number; accuracy?: number; capturedAt?: string;
};
export function campState() {
  return {
    arrivedAt: null as string | null, departedAt: null as string | null,
    active: false, session: 0, consented: false, consentVersion: 0, listUnavailable: false,
    point: null as null | { latitude: number; longitude: number; accuracy: number; capturedAt: string; updatedAt: string },
  };
}

export async function simulateCamp(page: Page, role: 'COACH' | 'PARENT', state: ReturnType<typeof campState>) {
  const backend = 'http://127.0.0.1:54329';
  const actor = { id: role === 'COACH' ? ids.coach : ids.parent, role, enabled: true,
    email: `${role.toLowerCase()}@example.invalid`, name: `${role} Simulat`, avatar_url: null };
  const evidence = {
    scope: 'Synthetic Chromium auth, backend, GPS, map tiles and Realtime; no real child, live backend or native runtime.',
    role, errors: [] as string[], unexpectedApi: [] as string[], externalRequests: [] as string[],
    expectedFailures: [] as string[], actions: [] as Action[], lists: [] as object[][],
    socketJoins: [] as { topic: string; private: boolean }[], tileCount: 0,
  };
  const child = { id: ids.child, parent_id: ids.parent, name: 'Copil Simulat Ana', birth_date: '2018-09-01' };
  const camp = { id: ids.camp, title: campTitle, coach_id: ids.coach, club_id: null,
    period_start: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    period_end: new Date(Date.now() + 86400000).toISOString().slice(0, 10), capacity: 10, price: 10000 };
  const sessionId = () => `00000000-0000-4000-8000-${String(300 + state.session).padStart(12, '0')}`;
  const expiresAt = () => new Date(Date.now() + 45 * 60000).toISOString();
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if ((state.listUnavailable && message.text().includes('503')) ||
      (!state.active && message.text().includes('409')) ||
      (state.departedAt && message.text().includes('403'))) evidence.expectedFailures.push(message.text());
    else evidence.errors.push(message.text());
  });
  await page.addInitScript(({ profile, origin }) => {
    const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expires_at = Math.floor(Date.now() / 1000) + 86400;
    localStorage.setItem(`sb-${new URL(origin).hostname.split('.')[0]}-auth-token`, JSON.stringify({
      access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: profile.id, exp: expires_at, role: 'authenticated' })}.simulation`,
      refresh_token: 'simulation-only', token_type: 'bearer', expires_at, expires_in: 86400,
      user: { id: profile.id, email: profile.email, aud: 'authenticated', role: 'authenticated',
        app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }));
    const watches = new Set<number>();
    let nextWatch = 0;
    const deliver = (callback: PositionCallback) => callback({ coords: {
      latitude: 45.75, longitude: 21.23, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null,
    }, timestamp: Date.now() } as GeolocationPosition);
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (callback: PositionCallback) => {
        const id = ++nextWatch;
        watches.add(id);
        queueMicrotask(() => { if (watches.has(id)) deliver(callback); });
        return id;
      },
      clearWatch: (id: number) => watches.delete(id), getCurrentPosition: deliver,
    } });
    Object.defineProperty(window, '__campLocationSimulation', { value: { activeWatches: () => watches.size } });
  }, { profile: actor, origin: backend });
  await page.routeWebSocket('ws://127.0.0.1:54329/**', (socket) => {
    socket.onMessage((raw) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(raw.toString());
      if (event === 'phx_join') evidence.socketJoins.push({ topic, private: payload.config?.private === true });
      socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  const appOrigin = new URL(test.info().project.use.baseURL as string).origin;
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    if (url.origin === 'https://js.stripe.com' && url.pathname.endsWith('/stripe.js')) {
      return route.fulfill({ contentType: 'application/javascript',
        body: 'window.Stripe = function () { throw new Error("Payments are outside this simulation"); };' });
    }
    if (url.hostname.endsWith('.basemaps.cartocdn.com')) {
      evidence.tileCount++;
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf1e9"/><path d="M0 80H256M80 0V256M0 180H256M180 0V256" stroke="#cad4c3" stroke-width="8"/><text x="18" y="135" fill="#53604b" font-size="13">TABĂRĂ SIMULATĂ #320</text></svg>' });
    }
    if (url.origin !== backend) {
      evidence.externalRequests.push(`${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    const respond = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body),
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Cache-Control': 'no-store' } });
    if (request.method() === 'OPTIONS') return respond(null);
    if (url.pathname === '/auth/v1/user') return respond({ ...actor, aud: 'authenticated', user_metadata: {} });
    if (url.pathname === '/rest/v1/rpc/my_profile') return respond([actor]);
    if (url.pathname === '/rest/v1/camps') return respond(camp);
    if (url.pathname === '/rest/v1/children') return respond([child]);
    if (url.pathname === '/rest/v1/enrollments') return respond([{ id: ids.enrollment, kind: 'CAMP', entity_id: ids.camp,
      child_id: ids.child, status: 'ACTIVE', child, created_at: new Date().toISOString() }]);
    if (['/rest/v1/course_announcements', '/rest/v1/club_announcements'].includes(url.pathname)) return respond([]);
    if (url.pathname === '/functions/v1/coach-live-location') {
      const body = request.postDataJSON() as Action;
      evidence.actions.push(body);
      const eligible = Boolean(state.arrivedAt && !state.departedAt);
      const meta = () => ({ success: true, sessionId: sessionId(), expiresAt: expiresAt(),
        ...(role === 'PARENT' ? { consentGranted: state.consented, consentVersion: state.consentVersion } : {}) });
      if (body.action === 'list') {
        if (state.listUnavailable) return respond({ success: false, message: 'Rețeaua simulată este indisponibilă.' }, 503);
        const sessions = state.active && eligible ? [{ sessionId: sessionId(), campId: ids.camp, occurrenceId: null,
          coachId: ids.coach, coachName, title: campTitle, expiresAt: expiresAt() }] : [];
        evidence.lists.push(sessions);
        return respond({ success: true, sessions });
      }
      if (body.action === 'participants') return respond({ success: true,
        startsAt: new Date(Date.now() - 86400000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), canShare: role === 'COACH',
        participants: [{ enrollmentId: ids.enrollment,
        childName: child.name, arrivedAt: state.arrivedAt, departedAt: state.departedAt }] });
      if (body.action === 'arrive') {
        if (state.departedAt) return respond({ success: false, message: 'Participarea s-a încheiat.' }, 409);
        state.arrivedAt ??= new Date().toISOString();
        return respond({ success: true });
      }
      if (body.action === 'depart') {
        state.departedAt = new Date().toISOString();
        return respond({ success: true });
      }
      if (body.action === 'start') {
        state.active = true;
        state.session++;
        state.consented = false;
        state.consentVersion = 0;
        state.point = null;
        return respond(meta());
      }
      if (body.action === 'stop') {
        state.active = false;
        state.point = null;
        return respond({ success: true, sessionId: sessionId() });
      }
      if (!state.active) return respond({ success: false, code: 'SESSION_NOT_FOUND', message: 'Partajarea locației nu este activă.' }, 409);
      if (role === 'PARENT' && !eligible) return respond({ success: false, code: 'ACCESS_DENIED', message: 'Participarea s-a încheiat.' }, 403);
      if (body.action === 'status') return respond(meta());
      if (body.action === 'consent') {
        if (body.expectedVersion !== state.consentVersion) return respond({ success: false, code: 'REQUEST_CONFLICT', message: 'Acordul a fost modificat.' }, 409);
        state.consented = body.consent === true;
        state.consentVersion++;
        return respond(meta());
      }
      if (body.action === 'update') {
        state.point = { latitude: body.latitude!, longitude: body.longitude!, accuracy: body.accuracy!, capturedAt: body.capturedAt!, updatedAt: new Date().toISOString() };
        return respond(meta());
      }
      if (body.action === 'read') {
        if (!state.consented) return respond({ success: false, code: 'CONSENT_REQUIRED', message: 'Confirmă acordul.' }, 403);
        return respond({ ...meta(), location: state.point });
      }
    }
    evidence.unexpectedApi.push(`${request.method()} ${url.pathname}`);
    return respond({ error: 'Unexpected synthetic API request' }, 500);
  });
  return { evidence };
}

export async function captureCamp(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if (await page.getByLabel('Harta locației antrenorului').count()) {
    await expect.poll(() => page.locator('.leaflet-tile-loaded').evaluateAll((tiles) => tiles.length > 0 && tiles.every((tile) =>
      (tile as HTMLImageElement).complete && (tile as HTMLImageElement).naturalWidth > 0 && getComputedStyle(tile).opacity === '1'))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow').toBe(true);
  const path = info.outputPath(`SIMULATED-camp-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(`SIMULATED ${name}; ${page.url()}; ${page.viewportSize()?.width}x${page.viewportSize()?.height}`, { path, contentType: 'image/png' });
}

export async function campProof(info: TestInfo, simulations: Awaited<ReturnType<typeof simulateCamp>>[]) {
  const path = info.outputPath('SIMULATED-camp-evidence.json');
  await writeFile(path, JSON.stringify(simulations.map(({ evidence }) => evidence), null, 2));
  await info.attach('Synthetic camp API and GPS evidence', { path, contentType: 'application/json' });
  for (const { evidence } of simulations) {
    expect(evidence.errors).toEqual([]);
    expect(evidence.unexpectedApi).toEqual([]);
    expect(evidence.externalRequests).toEqual([]);
    for (const session of evidence.lists.flat()) {
      expect(Object.keys(session).sort()).toEqual(['campId', 'coachId', 'coachName', 'expiresAt', 'occurrenceId', 'sessionId', 'title']);
    }
  }
}
