import { test, expect, type Page } from '@playwright/test';
import { campState, simulateCamp, captureCamp, campProof, ids, coachName, campTitle } from './camp-location-fixture';

const activeHeading = `${coachName} partajează locația`;
const map = (page: Page) => page.getByLabel('Harta locației antrenorului');
const coachPanel = (page: Page) => page.getByRole('region', { name: 'Partajarea locației antrenorului' });
const activeBanner = (page: Page) => page.getByRole('complementary', { name: 'Partajare locație activă' });
const watches = (page: Page) => page.evaluate(() =>
  (window as unknown as { __campLocationSimulation: { activeWatches: () => number } }).__campLocationSimulation.activeWatches());

async function startSharing(page: Page) {
  const panel = coachPanel(page);
  await expect(panel.getByRole('checkbox')).toBeEnabled();
  await panel.getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'Pornește partajarea' }).click();
  await expect(activeBanner(page)).toBeVisible();
  await expect(panel.getByText(/Ultima poziție trimisă/)).toBeVisible();
}

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`SIMULATED camp arrival manual start announcement consent stop restart departure ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }, info) => {
    test.setTimeout(75000);
    const coachContext = await browser.newContext({ baseURL, viewport });
    const parentContext = await browser.newContext({ baseURL, viewport });
    const coach = await coachContext.newPage();
    const parent = await parentContext.newPage();
    const state = campState();
    const coachSimulation = await simulateCamp(coach, 'COACH', state);
    const parentSimulation = await simulateCamp(parent, 'PARENT', state);
    const coachActions = (action: string) => coachSimulation.evidence.actions.filter((entry) => entry.action === action);
    const parentActions = (action: string) => parentSimulation.evidence.actions.filter((entry) => entry.action === action);
    try {
      await coach.goto(`/coach/camps/${ids.camp}/enrolled`);
      await parent.goto('/account/announcements');
      await expect(coach.getByRole('heading', { name: 'Prezență în tabără' })).toBeVisible();
      await expect.poll(() => parentActions('list').length).toBeGreaterThan(0);
      await expect(parent.getByText(activeHeading, { exact: true })).toHaveCount(0);
      await expect(coachPanel(coach).getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled();
      expect(await watches(coach)).toBe(0);
      await captureCamp(coach, info, 'before-arrival');

      await coach.getByRole('button', { name: 'Confirmă sosirea', exact: true }).click();
      await expect(coach.getByRole('button', { name: 'Confirmă plecarea', exact: true })).toBeVisible();
      const arrivedAt = state.arrivedAt;
      expect(arrivedAt).not.toBeNull();
      expect(coachActions('start')).toHaveLength(0);
      expect(coachActions('update')).toHaveLength(0);
      expect(await watches(coach)).toBe(0);
      await expect(parent.getByText(activeHeading, { exact: true })).toHaveCount(0);
      await captureCamp(coach, info, 'arrived-no-sharing');

      await startSharing(coach);
      expect(coachActions('start')).toHaveLength(1);
      expect(coachActions('start')[0]).toMatchObject({ campId: ids.camp, consent: true });
      expect(coachActions('start')[0].occurrenceId).toBeUndefined();
      await expect(parent.getByText(activeHeading, { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(parent.getByText(campTitle, { exact: true })).toBeVisible();
      expect(parentActions('read')).toHaveLength(0);
      await expect(map(parent)).toHaveCount(0);
      await captureCamp(parent, info, 'active-announcement');
      await parent.getByRole('button', { name: 'Vezi locația', exact: true }).click();
      await expect(parent.getByRole('button', { name: 'Accept și văd locația' })).toBeVisible();
      expect(parentActions('read')).toHaveLength(0);
      await expect(map(parent)).toHaveCount(0);
      await captureCamp(parent, info, 'parent-consent');
      await parent.getByRole('button', { name: 'Accept și văd locația' }).click();
      await expect(map(parent)).toBeVisible();
      expect(parentActions('consent')[0]).toMatchObject({ campId: ids.camp, coachId: ids.coach, consent: true });
      expect(parentActions('read')[0]).toMatchObject({ campId: ids.camp, coachId: ids.coach });
      await captureCamp(parent, info, 'parent-map');
      await parent.getByRole('button', { name: 'Retrage acordul' }).click();
      await expect(map(parent)).toHaveCount(0);
      await expect(parent.getByRole('button', { name: 'Accept și văd locația' })).toBeEnabled();
      expect(parentActions('consent').at(-1)).toMatchObject({ consent: false, expectedVersion: 1 });
      await captureCamp(parent, info, 'parent-revoked');
      await parent.getByRole('button', { name: 'Accept și văd locația' }).click();
      await expect(map(parent)).toBeVisible();

      await activeBanner(coach).getByRole('button', { name: 'Oprește locația' }).click();
      await expect(activeBanner(coach)).toHaveCount(0);
      await expect(parent.getByText(activeHeading, { exact: true })).toHaveCount(0, { timeout: 10000 });
      await expect(map(parent)).toHaveCount(0);
      expect(await watches(coach)).toBe(0);
      await captureCamp(parent, info, 'announcement-removed-after-stop');

      await startSharing(coach);
      expect(coachActions('arrive')).toHaveLength(1);
      expect(state.arrivedAt).toBe(arrivedAt);
      expect(coachActions('start')).toHaveLength(2);
      await expect(parent.getByText(activeHeading, { exact: true })).toBeVisible({ timeout: 10000 });
      await parent.getByRole('button', { name: 'Vezi locația', exact: true }).click();
      await expect(parent.getByRole('button', { name: 'Accept și văd locația' })).toBeVisible();
      await expect(map(parent)).toHaveCount(0);
      await parent.getByRole('button', { name: 'Accept și văd locația' }).click();
      await expect(map(parent)).toBeVisible();
      await captureCamp(parent, info, 'second-sharing-new-consent');

      await coach.getByRole('button', { name: 'Confirmă plecarea', exact: true }).click();
      expect(coachActions('depart')).toHaveLength(0);
      await captureCamp(coach, info, 'departure-confirmation');
      await coach.getByRole('button', { name: 'Da, a plecat', exact: true }).click();
      await expect.poll(() => coachActions('depart').length).toBe(1);
      await expect(coach.getByRole('button', { name: 'Confirmă sosirea', exact: true })).toHaveCount(0);
      await expect(coach.getByRole('button', { name: 'Confirmă plecarea', exact: true })).toHaveCount(0);
      await expect(parent.getByText(activeHeading, { exact: true })).toHaveCount(0, { timeout: 10000 });
      await expect(map(parent)).toHaveCount(0);
      await captureCamp(coach, info, 'departed-final');
      await captureCamp(parent, info, 'access-removed-after-departure');
      await activeBanner(coach).getByRole('button', { name: 'Oprește locația' }).click();
      await expect(activeBanner(coach)).toHaveCount(0);
      expect(await watches(coach)).toBe(0);
      await campProof(info, [coachSimulation, parentSimulation]);
    } finally {
      await coachContext.close();
      await parentContext.close();
    }
  });
}

test('SIMULATED camp announcement network failure clears stale map and retry recovers', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = campState();
  state.arrivedAt = new Date().toISOString();
  state.active = true;
  state.session = 1;
  state.point = { latitude: 45.75, longitude: 21.23, accuracy: 5, capturedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const simulation = await simulateCamp(page, 'PARENT', state);
  await page.goto('/account/announcements');
  await expect(page.getByText(activeHeading, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vezi locația', exact: true }).click();
  await page.getByRole('button', { name: 'Accept și văd locația' }).click();
  await expect(map(page)).toBeVisible();
  state.listUnavailable = true;
  await expect(page.getByRole('alert').filter({ hasText: /locați|partaj|Rețeaua/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(activeHeading, { exact: true })).toHaveCount(0);
  await expect(map(page)).toHaveCount(0);
  await captureCamp(page, info, 'list-error-hides-stale-session');
  state.listUnavailable = false;
  await page.getByRole('button', { name: 'Reîncearcă locațiile', exact: true }).click();
  await expect(page.getByText(activeHeading, { exact: true })).toBeVisible();
  await captureCamp(page, info, 'list-retry-recovered');
  await campProof(info, [simulation]);
});
